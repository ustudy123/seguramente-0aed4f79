
-- =============================================
-- 1. REWRITE consolidar_ponto_diario trigger function
--    Now uses escala atribuída, calculates tolerâncias,
--    HE 50%/100%, adicional noturno com hora ficta
-- =============================================

CREATE OR REPLACE FUNCTION public.consolidar_ponto_diario()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_entrada TIME;
  v_saida_almoco TIME;
  v_retorno_almoco TIME;
  v_saida TIME;
  v_horas_trabalhadas INTERVAL;
  v_status TEXT;
  -- Escala vars
  v_escala_id UUID;
  v_jornada_diaria_min INT := 480; -- default 8h
  v_tolerancia_min INT := 5;
  v_tolerancia_diaria_min INT := 10;
  v_hora_entrada TIME := '08:00'::TIME;
  v_hora_saida TIME := '17:00'::TIME;
  v_intervalo_min INT := 60;
  v_usa_hora_ficta BOOLEAN := TRUE;
  v_noturno_inicio TIME := '22:00'::TIME;
  v_noturno_fim TIME := '05:00'::TIME;
  -- Calc vars
  v_trabalhadas_min INT;
  v_atraso_min INT := 0;
  v_total_tolerancia_usada INT := 0;
  v_he_total_min INT := 0;
  v_he_50_min INT := 0;
  v_he_100_min INT := 0;
  v_noturno_min INT := 0;
  v_intervalo_real_min INT := 0;
  v_tolerancia_aplicada BOOLEAN := FALSE;
  v_diff_entrada INT;
  v_diff_saida INT;
  v_dia_semana INT;
  v_sabado_util BOOLEAN := FALSE;
  v_domingo_util BOOLEAN := FALSE;
BEGIN
  -- Buscar todas as marcações do dia
  SELECT 
    MAX(CASE WHEN tipo_marcacao = 'entrada' THEN hora_marcacao END),
    MAX(CASE WHEN tipo_marcacao = 'saida_almoco' THEN hora_marcacao END),
    MAX(CASE WHEN tipo_marcacao = 'retorno_almoco' THEN hora_marcacao END),
    MAX(CASE WHEN tipo_marcacao = 'saida' THEN hora_marcacao END)
  INTO v_entrada, v_saida_almoco, v_retorno_almoco, v_saida
  FROM public.ponto_marcacoes
  WHERE tenant_id = NEW.tenant_id
    AND colaborador_cpf = NEW.colaborador_cpf
    AND data_marcacao = NEW.data_marcacao;

  -- Buscar escala atribuída ao colaborador
  SELECT ea.escala_id INTO v_escala_id
  FROM public.ponto_escala_atribuicoes ea
  WHERE ea.tenant_id = NEW.tenant_id
    AND ea.colaborador_cpf = NEW.colaborador_cpf
    AND ea.ativa = TRUE
    AND ea.data_inicio <= NEW.data_marcacao
    AND (ea.data_fim IS NULL OR ea.data_fim >= NEW.data_marcacao)
  ORDER BY ea.data_inicio DESC
  LIMIT 1;

  -- Se tem escala, carregar configurações
  IF v_escala_id IS NOT NULL THEN
    SELECT 
      e.jornada_diaria_minutos,
      e.tolerancia_minutos,
      e.tolerancia_diaria_minutos,
      COALESCE(e.hora_entrada_padrao, '08:00')::TIME,
      COALESCE(e.hora_saida_padrao, '17:00')::TIME,
      e.intervalo_intrajornada_minutos,
      e.usa_hora_ficta_noturna,
      COALESCE(e.adicional_noturno_inicio, '22:00')::TIME,
      COALESCE(e.adicional_noturno_fim, '05:00')::TIME,
      e.sabado_util,
      e.domingo_util
    INTO 
      v_jornada_diaria_min, v_tolerancia_min, v_tolerancia_diaria_min,
      v_hora_entrada, v_hora_saida, v_intervalo_min,
      v_usa_hora_ficta, v_noturno_inicio, v_noturno_fim,
      v_sabado_util, v_domingo_util
    FROM public.ponto_escalas e
    WHERE e.id = v_escala_id;
  END IF;

  -- Dia da semana (0=Dom, 6=Sáb)
  v_dia_semana := EXTRACT(DOW FROM NEW.data_marcacao);

  -- Calcular horas trabalhadas
  IF v_entrada IS NOT NULL AND v_saida IS NOT NULL THEN
    v_horas_trabalhadas := (v_saida - v_entrada);
    IF v_saida_almoco IS NOT NULL AND v_retorno_almoco IS NOT NULL THEN
      v_horas_trabalhadas := v_horas_trabalhadas - (v_retorno_almoco - v_saida_almoco);
      v_intervalo_real_min := EXTRACT(EPOCH FROM (v_retorno_almoco - v_saida_almoco))::INT / 60;
    END IF;
    v_trabalhadas_min := EXTRACT(EPOCH FROM v_horas_trabalhadas)::INT / 60;
  ELSE
    v_horas_trabalhadas := INTERVAL '0';
    v_trabalhadas_min := 0;
  END IF;

  -- ==========================================
  -- TOLERÂNCIA LEGAL (Art. 58 §1 CLT)
  -- Até 5 min por marcação, limitado a 10 min/dia
  -- Não desconta nem computa se dentro da tolerância
  -- ==========================================
  IF v_entrada IS NOT NULL THEN
    v_diff_entrada := EXTRACT(EPOCH FROM (v_entrada - v_hora_entrada))::INT / 60;
    -- Chegou atrasado mas dentro da tolerância
    IF v_diff_entrada > 0 AND v_diff_entrada <= v_tolerancia_min THEN
      v_total_tolerancia_usada := v_total_tolerancia_usada + v_diff_entrada;
      v_tolerancia_aplicada := TRUE;
      v_diff_entrada := 0; -- anula atraso
    END IF;
    -- Chegou adiantado dentro da tolerância (não computa HE)
    IF v_diff_entrada < 0 AND ABS(v_diff_entrada) <= v_tolerancia_min THEN
      v_total_tolerancia_usada := v_total_tolerancia_usada + ABS(v_diff_entrada);
      v_tolerancia_aplicada := TRUE;
    END IF;
  END IF;

  IF v_saida IS NOT NULL THEN
    v_diff_saida := EXTRACT(EPOCH FROM (v_saida - v_hora_saida))::INT / 60;
    -- Saiu mais cedo dentro da tolerância
    IF v_diff_saida < 0 AND ABS(v_diff_saida) <= v_tolerancia_min THEN
      IF v_total_tolerancia_usada + ABS(v_diff_saida) <= v_tolerancia_diaria_min THEN
        v_total_tolerancia_usada := v_total_tolerancia_usada + ABS(v_diff_saida);
        v_tolerancia_aplicada := TRUE;
        v_diff_saida := 0;
      END IF;
    END IF;
    -- Saiu mais tarde dentro da tolerância (não computa HE)
    IF v_diff_saida > 0 AND v_diff_saida <= v_tolerancia_min THEN
      IF v_total_tolerancia_usada + v_diff_saida <= v_tolerancia_diaria_min THEN
        v_total_tolerancia_usada := v_total_tolerancia_usada + v_diff_saida;
        v_tolerancia_aplicada := TRUE;
        v_diff_saida := 0;
      END IF;
    END IF;
  END IF;

  -- Se tolerância total ultrapassou 10min, não aplica
  IF v_total_tolerancia_usada > v_tolerancia_diaria_min THEN
    v_tolerancia_aplicada := FALSE;
    -- Recalcular com valores reais
    IF v_entrada IS NOT NULL THEN
      v_diff_entrada := EXTRACT(EPOCH FROM (v_entrada - v_hora_entrada))::INT / 60;
    END IF;
    IF v_saida IS NOT NULL THEN
      v_diff_saida := EXTRACT(EPOCH FROM (v_saida - v_hora_saida))::INT / 60;
    END IF;
  END IF;

  -- ==========================================
  -- CÁLCULO DE ATRASO
  -- ==========================================
  IF v_entrada IS NOT NULL AND v_diff_entrada > 0 AND NOT v_tolerancia_aplicada THEN
    v_atraso_min := v_diff_entrada;
  ELSIF v_entrada IS NOT NULL AND v_diff_entrada > v_tolerancia_min THEN
    v_atraso_min := v_diff_entrada;
  END IF;

  -- ==========================================
  -- HORAS EXTRAS
  -- Se trabalhou mais que a jornada (fora tolerância)
  -- Domingos/feriados = 100%, dias úteis = 50%
  -- ==========================================
  IF v_trabalhadas_min > v_jornada_diaria_min AND v_entrada IS NOT NULL AND v_saida IS NOT NULL THEN
    v_he_total_min := v_trabalhadas_min - v_jornada_diaria_min;
    
    -- Desconta atraso das HE se houver
    IF v_atraso_min > 0 AND v_he_total_min > v_atraso_min THEN
      v_he_total_min := v_he_total_min - v_atraso_min;
    ELSIF v_atraso_min > 0 THEN
      v_he_total_min := 0;
    END IF;

    -- Se tolerância aplicada e HE dentro da tolerância, zera
    IF v_tolerancia_aplicada AND v_he_total_min <= v_tolerancia_min THEN
      v_he_total_min := 0;
    END IF;

    -- Domingo ou dia não útil = 100%
    IF (v_dia_semana = 0 AND NOT v_domingo_util) OR (v_dia_semana = 6 AND NOT v_sabado_util) THEN
      v_he_100_min := v_he_total_min;
      v_he_50_min := 0;
    ELSE
      -- Dia útil: primeiras 2h = 50%, restante = 100%
      IF v_he_total_min <= 120 THEN
        v_he_50_min := v_he_total_min;
      ELSE
        v_he_50_min := 120;
        v_he_100_min := v_he_total_min - 120;
      END IF;
    END IF;
  END IF;

  -- ==========================================
  -- ADICIONAL NOTURNO (22h-5h, hora ficta 52m30s)
  -- ==========================================
  IF v_entrada IS NOT NULL AND v_saida IS NOT NULL THEN
    DECLARE
      v_noturno_start TIME;
      v_noturno_end TIME;
      v_work_start TIME;
      v_work_end TIME;
      v_overlap_min INT := 0;
    BEGIN
      v_noturno_start := v_noturno_inicio; -- 22:00
      v_noturno_end := v_noturno_fim;       -- 05:00
      v_work_start := v_entrada;
      v_work_end := v_saida;

      -- Período noturno pode cruzar meia-noite
      -- Caso 1: trabalho começa antes das 22h e vai até depois
      IF v_work_end > v_noturno_start THEN
        v_overlap_min := EXTRACT(EPOCH FROM (v_work_end - GREATEST(v_work_start, v_noturno_start)))::INT / 60;
        IF v_overlap_min < 0 THEN v_overlap_min := 0; END IF;
      END IF;

      -- Caso 2: trabalho começa antes das 5h (madrugada)
      IF v_work_start < v_noturno_end THEN
        v_overlap_min := v_overlap_min + EXTRACT(EPOCH FROM (LEAST(v_work_end, v_noturno_end) - v_work_start))::INT / 60;
      END IF;

      IF v_overlap_min > 0 THEN
        -- Hora ficta noturna: cada 52m30s = 60min
        IF v_usa_hora_ficta THEN
          -- Fator: 60/52.5 = 1.142857
          v_noturno_min := CEIL(v_overlap_min::NUMERIC * 60.0 / 52.5)::INT - v_overlap_min;
          -- v_noturno_min são os minutos ADICIONAIS pela hora ficta
          -- Mas para fins de registro, guardamos o total de minutos em período noturno
          v_noturno_min := v_overlap_min;
        ELSE
          v_noturno_min := v_overlap_min;
        END IF;
      END IF;
    END;
  END IF;

  -- ==========================================
  -- STATUS
  -- ==========================================
  IF v_entrada IS NULL THEN
    v_status := 'falta';
  ELSIF v_saida IS NULL THEN
    v_status := 'incompleto';
  ELSIF v_atraso_min > 0 THEN
    v_status := 'atraso';
  ELSE
    v_status := 'regular';
  END IF;

  -- Upsert no ponto diário
  INSERT INTO public.ponto_diario (
    tenant_id, colaborador_id, colaborador_nome, colaborador_cpf, data,
    entrada, saida_almoco, retorno_almoco, saida,
    horas_trabalhadas, status, escala_id,
    horas_extras_50_minutos, horas_extras_100_minutos,
    adicional_noturno_minutos, atraso_minutos,
    intervalo_intrajornada_minutos, tolerancia_aplicada
  ) VALUES (
    NEW.tenant_id, NEW.colaborador_id, NEW.colaborador_nome, NEW.colaborador_cpf, NEW.data_marcacao,
    v_entrada, v_saida_almoco, v_retorno_almoco, v_saida,
    v_horas_trabalhadas, v_status, v_escala_id,
    v_he_50_min, v_he_100_min,
    v_noturno_min, v_atraso_min,
    v_intervalo_real_min, v_tolerancia_aplicada
  )
  ON CONFLICT (tenant_id, colaborador_cpf, data)
  DO UPDATE SET
    entrada = v_entrada,
    saida_almoco = v_saida_almoco,
    retorno_almoco = v_retorno_almoco,
    saida = v_saida,
    horas_trabalhadas = v_horas_trabalhadas,
    escala_id = v_escala_id,
    horas_extras_50_minutos = v_he_50_min,
    horas_extras_100_minutos = v_he_100_min,
    adicional_noturno_minutos = v_noturno_min,
    atraso_minutos = v_atraso_min,
    intervalo_intrajornada_minutos = v_intervalo_real_min,
    tolerancia_aplicada = v_tolerancia_aplicada,
    status = CASE 
      WHEN public.ponto_diario.status = 'justificado' THEN 'justificado'
      ELSE v_status 
    END,
    updated_at = now();

  RETURN NEW;
END;
$function$;

-- =============================================
-- 2. Function to generate alerts automatically
--    Called after ponto_diario is updated
-- =============================================
CREATE OR REPLACE FUNCTION public.gerar_alertas_ponto()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_horas_trab_min INT;
  v_anterior_saida TIME;
  v_interjornada_min INT;
BEGIN
  v_horas_trab_min := COALESCE(EXTRACT(EPOCH FROM NEW.horas_trabalhadas)::INT / 60, 0);

  -- Alerta: excesso de jornada (>10h)
  IF v_horas_trab_min > 600 THEN
    INSERT INTO public.ponto_alertas (tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf, tipo, severidade, titulo, descricao, data_referencia)
    VALUES (NEW.tenant_id, NEW.empresa_id, NEW.colaborador_id, NEW.colaborador_nome, NEW.colaborador_cpf,
      'excesso_jornada', 'alta',
      'Excesso de jornada: ' || NEW.colaborador_nome,
      'Jornada de ' || (v_horas_trab_min / 60) || 'h ' || (v_horas_trab_min % 60) || 'min em ' || NEW.data::TEXT,
      NEW.data::TEXT)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Alerta: intervalo intrajornada suprimido (<60min quando jornada >6h)
  IF v_horas_trab_min > 360 AND COALESCE(NEW.intervalo_intrajornada_minutos, 0) < 60 AND COALESCE(NEW.intervalo_intrajornada_minutos, 0) > 0 THEN
    INSERT INTO public.ponto_alertas (tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf, tipo, severidade, titulo, descricao, data_referencia)
    VALUES (NEW.tenant_id, NEW.empresa_id, NEW.colaborador_id, NEW.colaborador_nome, NEW.colaborador_cpf,
      'intervalo_suprimido', 'alta',
      'Intervalo intrajornada insuficiente: ' || NEW.colaborador_nome,
      'Intervalo de apenas ' || NEW.intervalo_intrajornada_minutos || 'min em ' || NEW.data::TEXT || '. Mínimo legal: 60min.',
      NEW.data::TEXT)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Alerta: interjornada insuficiente (<11h entre saída anterior e entrada atual)
  IF NEW.entrada IS NOT NULL THEN
    SELECT saida INTO v_anterior_saida
    FROM public.ponto_diario
    WHERE tenant_id = NEW.tenant_id
      AND colaborador_cpf = NEW.colaborador_cpf
      AND data = NEW.data - 1
      AND saida IS NOT NULL;

    IF v_anterior_saida IS NOT NULL THEN
      -- Calcular intervalo: saída dia anterior até entrada de hoje
      v_interjornada_min := EXTRACT(EPOCH FROM (('24:00:00'::TIME - v_anterior_saida) + NEW.entrada))::INT / 60;
      IF v_interjornada_min < 660 THEN -- 11h = 660min
        INSERT INTO public.ponto_alertas (tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf, tipo, severidade, titulo, descricao, data_referencia)
        VALUES (NEW.tenant_id, NEW.empresa_id, NEW.colaborador_id, NEW.colaborador_nome, NEW.colaborador_cpf,
          'interjornada_insuficiente', 'critica',
          'Interjornada < 11h: ' || NEW.colaborador_nome,
          'Descanso de apenas ' || (v_interjornada_min / 60) || 'h ' || (v_interjornada_min % 60) || 'min entre ' || (NEW.data - 1)::TEXT || ' e ' || NEW.data::TEXT,
          NEW.data::TEXT)
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END IF;

  -- Alerta: falta de marcação
  IF NEW.status = 'incompleto' THEN
    INSERT INTO public.ponto_alertas (tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf, tipo, severidade, titulo, descricao, data_referencia)
    VALUES (NEW.tenant_id, NEW.empresa_id, NEW.colaborador_id, NEW.colaborador_nome, NEW.colaborador_cpf,
      'falta_marcacao', 'media',
      'Marcação incompleta: ' || NEW.colaborador_nome,
      'Registro incompleto em ' || NEW.data::TEXT,
      NEW.data::TEXT)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- Create trigger for auto alerts
DROP TRIGGER IF EXISTS trigger_gerar_alertas_ponto ON public.ponto_diario;
CREATE TRIGGER trigger_gerar_alertas_ponto
  AFTER INSERT OR UPDATE ON public.ponto_diario
  FOR EACH ROW
  EXECUTE FUNCTION gerar_alertas_ponto();

-- =============================================
-- 3. Function to auto-convert expired banco de horas
-- =============================================
CREATE OR REPLACE FUNCTION public.converter_banco_horas_vencido()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_banco RECORD;
BEGIN
  FOR v_banco IN
    SELECT * FROM public.ponto_banco_horas
    WHERE convertido_extras = FALSE
      AND prazo_compensacao IS NOT NULL
      AND prazo_compensacao < CURRENT_DATE
      AND saldo_atual_minutos > 0
  LOOP
    -- Mark as converted
    UPDATE public.ponto_banco_horas
    SET convertido_extras = TRUE,
        data_conversao = CURRENT_DATE,
        observacoes = COALESCE(observacoes, '') || ' [Convertido automaticamente em HE em ' || CURRENT_DATE::TEXT || '. Saldo: ' || v_banco.saldo_atual_minutos || ' min]'
    WHERE id = v_banco.id;

    -- Register conversion movement
    INSERT INTO public.ponto_banco_horas_movimentacoes (
      tenant_id, banco_horas_id, colaborador_cpf, data_referencia, tipo, minutos, descricao
    ) VALUES (
      v_banco.tenant_id, v_banco.id, v_banco.colaborador_cpf, CURRENT_DATE,
      'conversao_he', v_banco.saldo_atual_minutos,
      'Conversão automática: prazo de compensação vencido em ' || v_banco.prazo_compensacao::TEXT
    );
  END LOOP;
END;
$function$;

-- =============================================
-- 4. Add comprovante support to ponto_marcacoes
-- =============================================
-- Column already exists (comprovante_gerado), just ensure default
ALTER TABLE public.ponto_marcacoes ALTER COLUMN comprovante_gerado SET DEFAULT FALSE;

-- =============================================
-- 5. Add unique constraint on alertas to prevent duplicates
-- =============================================
CREATE UNIQUE INDEX IF NOT EXISTS ponto_alertas_unique_idx 
  ON public.ponto_alertas (tenant_id, colaborador_cpf, tipo, data_referencia)
  WHERE resolvido = FALSE;
