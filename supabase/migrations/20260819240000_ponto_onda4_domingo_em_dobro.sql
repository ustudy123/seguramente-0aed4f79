-- ============================================================================
-- ONDA 4 (parte 4) — Domingo trabalhado em dobro
-- PONTO-130
--
-- O trabalho em DOMINGO (descanso semanal) sem folga compensatória é pago EM
-- DOBRO por INTEIRO — jornada normal inclusive — e não apenas o que excede a
-- jornada (Lei 605/1949, art. 9º; Súmula 146 do TST). Para FERIADO já existe a
-- apuração própria (ponto_feriados_trabalhados / _adicional_competencia, com a
-- tabela feriado_folga_compensatoria); para DOMINGO não havia nada — o cálculo
-- tratava o domingo como mera hora extra 100%, dobrando só o excedente.
--
-- O QUE FAZ (mínimo e aditivo)
--   Em calcular_he_adicional_noturno_dia: quando o dia é DOMINGO trabalhado e o
--   domingo NÃO é dia de trabalho previsto na escala (é o repouso da semana), a jornada
--   trabalhada inteira vira 100% (dobra), não só o excedente. Quando a escala
--   PREVÊ trabalho no domingo (6x1 etc.), o descanso semanal está noutro dia e
--   não há dobra — cai no cálculo normal de sempre. Sem escala atribuída, o
--   domingo é o repouso padrão da semana e a dobra vale.
--
-- GARANTIAS
--   · Só muda o domingo de repouso trabalhado. Dia útil, sábado e domingo previsto na
--     escala ficam idênticos ao cálculo atual.
--   · Não toca no motor de saldo (ponto_saldo_dias_competencia_bruto lê
--     horas_extras/horas_faltantes, não horas_extras_100_minutos). Mexe apenas
--     nas colunas de apuração de HE/dobra do dia.
--   · O alerta do art. 59 (excesso de 2h) continua disparando pelo excesso real,
--     como antes.
--
-- LIMITAÇÃO CONHECIDA (documentada)
--   Escala legada sem dias_config (jornada fixa para todos os dias) reporta o
--   domingo como dia útil e não dobra — critério conservador (não cobra a mais).
--   A folga compensatória concedida ad-hoc (troca de descanso na semana) fica
--   modelada pela própria escala; um registro avulso de compensação de domingo,
--   se necessário, é evolução à parte (espelhando feriado_folga_compensatoria).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calcular_he_adicional_noturno_dia(p_colaborador_id uuid, p_data date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_diario RECORD;
  v_cct RECORD;
  v_jornada_diaria_min INTEGER := 480; -- 8h (fallback; a escala do vínculo tem prioridade)
  v_he50_pct NUMERIC := 50;
  v_he100_pct NUMERIC := 100;
  v_adn_pct NUMERIC := 20;
  v_noturno_inicio TIME := '22:00';
  v_noturno_fim TIME := '05:00';
  v_usa_hora_ficta BOOLEAN := true;
  v_he_limite_diario_min INTEGER := 120;
  v_he50 INTEGER := 0;
  v_he100 INTEGER := 0;
  v_adn_min INTEGER := 0;
  v_trab_min INTEGER := 0;
  v_dow INTEGER;
  v_empresa UUID;
  v_j_escala INTEGER;
  v_excesso INTEGER;
  v_domingo_dobra BOOLEAN := false;
BEGIN
  SELECT * INTO v_diario FROM public.ponto_diario
   WHERE colaborador_id = p_colaborador_id AND data = p_data
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'sem_diario');
  END IF;

  v_empresa := v_diario.empresa_id;

  -- CCT vigente (se houver) prioriza acordo individual, depois ACT, depois CCT
  SELECT c.* INTO v_cct
    FROM public.ponto_cct_config c
   WHERE c.tenant_id = v_diario.tenant_id
     AND (c.vigencia_inicio IS NULL OR c.vigencia_inicio <= p_data)
     AND (c.vigencia_fim IS NULL OR c.vigencia_fim >= p_data)
   ORDER BY c.created_at DESC
   LIMIT 1;
  IF FOUND THEN
    v_jornada_diaria_min := COALESCE(v_cct.jornada_diaria_horas,8) * 60;
    v_he50_pct := COALESCE(v_cct.he_percentual_dia_util,50);
    v_he100_pct := COALESCE(v_cct.he_percentual_domingos,100);
    v_adn_pct := COALESCE(v_cct.adicional_noturno_percentual,20);
    v_noturno_inicio := COALESCE(v_cct.hora_noturna_inicio,'22:00'::time);
    v_noturno_fim := COALESCE(v_cct.hora_noturna_fim,'05:00'::time);
    v_usa_hora_ficta := COALESCE(v_cct.usa_hora_ficta,true);
    v_he_limite_diario_min := COALESCE(v_cct.he_limite_diario_min,120);
  END IF;

  -- (091) Jornada do dia pela ESCALA vigente do vínculo — tem prioridade sobre
  -- a CCT/8h fixas. Respeita o versionamento de parâmetros da onda 1 (a própria
  -- ponto_jornada_do_dia aplica o overlay). Sem escala com jornada para o dia,
  -- mantém-se o que a CCT/8h definiram acima.
  BEGIN
    SELECT j.jornada_min INTO v_j_escala
      FROM public.ponto_jornada_do_dia(v_diario.tenant_id, v_diario.colaborador_cpf,
                                       v_diario.colaborador_id::text, p_data) j;
    IF COALESCE(v_j_escala, 0) > 0 THEN
      v_jornada_diaria_min := v_j_escala;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_j_escala := NULL; -- qualquer falha na leitura da escala: mantém o fallback CCT/8h
  END;

  -- Total trabalhado em minutos (a partir das marcações entrada/saida)
  IF v_diario.entrada IS NOT NULL AND v_diario.saida IS NOT NULL THEN
    v_trab_min := EXTRACT(EPOCH FROM (v_diario.saida::time - v_diario.entrada::time))/60;
    IF v_diario.saida_almoco IS NOT NULL AND v_diario.retorno_almoco IS NOT NULL THEN
      v_trab_min := v_trab_min - EXTRACT(EPOCH FROM (v_diario.retorno_almoco::time - v_diario.saida_almoco::time))/60;
    END IF;
  END IF;
  IF v_trab_min < 0 THEN v_trab_min := 0; END IF;

  v_dow := EXTRACT(DOW FROM p_data); -- 0=domingo

  -- (130) Domingo trabalhado como descanso semanal, sem folga
  -- compensatória: Lei 605/1949 art. 9º + Súmula 146 do TST -> a jornada
  -- trabalhada é paga EM DOBRO por inteiro (não só o que excede a jornada). Só
  -- vale quando o domingo NÃO é dia de trabalho previsto na escala — a escala
  -- 6x1 e afins já carregam o repouso noutro dia e caem no cálculo normal. Sem
  -- escala atribuída, o domingo é o repouso padrão da semana e a dobra vale.
  v_domingo_dobra := (v_dow = 0 AND v_trab_min > 0 AND COALESCE(v_j_escala, 0) = 0);

  -- (092) Horas extras: TODO o tempo que excede a jornada é apurado. O limite
  -- de 2h do art. 59 é norma de conduta, não de cálculo — não se trunca a
  -- apuração; apura-se tudo e sinaliza-se o excesso ao RH.
  IF v_trab_min > v_jornada_diaria_min THEN
    v_excesso := v_trab_min - v_jornada_diaria_min;
  ELSE
    v_excesso := 0;
  END IF;

  IF v_domingo_dobra THEN
    -- Jornada inteira em dobro (o eventual excedente também é do domingo).
    v_he100 := v_trab_min;
    v_he50  := 0;
  ELSIF v_excesso > 0 THEN
    IF v_dow = 0 THEN
      v_he100 := v_excesso;   -- domingo previsto na escala: excedente a 100%
    ELSE
      v_he50 := v_excesso;    -- dia útil / sábado: excedente a 50%
    END IF;
  END IF;

  -- Sinalização do excesso ao limite do art. 59 (sem deixar de apurar).
  -- Idempotente: um alerta por colaborador/dia.
  IF v_excesso > v_he_limite_diario_min THEN
    INSERT INTO public.ponto_alertas
      (tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
       tipo, severidade, titulo, descricao, data_referencia)
    SELECT v_diario.tenant_id, v_empresa, v_diario.colaborador_id::text,
           v_diario.colaborador_nome, v_diario.colaborador_cpf,
           'excesso_he_art59', 'alta',
           'Excesso ao limite de 2h extras (CLT art. 59)',
           format('Apuradas %s min de hora extra no dia, acima do limite de %s min do art. 59. '
               || 'O tempo foi apurado por inteiro (continua devido); regularizar o excesso.',
               v_excesso, v_he_limite_diario_min),
           p_data
    WHERE NOT EXISTS (
      SELECT 1 FROM public.ponto_alertas a
      WHERE a.tenant_id = v_diario.tenant_id
        AND a.colaborador_cpf = v_diario.colaborador_cpf
        AND a.data_referencia = p_data
        AND a.tipo = 'excesso_he_art59'
    );
  END IF;

  -- Adicional noturno: minutos trabalhados na janela 22h-05h
  -- Aproximação: se entrada < 05:00 OU saida > 22:00, calcula sobreposição da jornada bruta
  IF v_diario.entrada IS NOT NULL AND v_diario.saida IS NOT NULL THEN
    DECLARE
      v_e TIMESTAMP := (p_data::text || ' ' || v_diario.entrada::text)::timestamp;
      v_s TIMESTAMP := (p_data::text || ' ' || v_diario.saida::text)::timestamp;
      v_n_ini TIMESTAMP := (p_data::text || ' ' || v_noturno_inicio::text)::timestamp;
      v_n_fim TIMESTAMP := ((p_data + 1)::text || ' ' || v_noturno_fim::text)::timestamp;
      v_overlap_min INTEGER := 0;
      v_prorrog_min INTEGER := 0;
    BEGIN
      IF v_s < v_e THEN v_s := v_s + INTERVAL '1 day'; END IF;
      -- Parte estritamente noturna: minutos dentro da janela legal 22h-05h,
      -- convertidos pela hora ficta (52min30s) quando aplicavel.
      v_overlap_min := GREATEST(0,
        EXTRACT(EPOCH FROM (LEAST(v_s, v_n_fim) - GREATEST(v_e, v_n_ini)))/60
      )::INTEGER;
      v_adn_min := v_overlap_min;
      IF v_usa_hora_ficta AND v_adn_min > 0 THEN
        v_adn_min := ROUND(v_adn_min * 60.0 / 52.5);
      END IF;
      -- Súmula 60, II do TST: jornada cumprida integralmente no período noturno
      -- (entrada ate as 22h, cobrindo toda a janela) e prorrogada alem das 05h ->
      -- o adicional acompanha as horas prorrogadas. Criterio conservador: essas
      -- horas entram pelo tempo REAL (sem hora ficta, cuja aplicacao a prorrogacao
      -- e controvertida). A parte noturna acima ja levou a ficta.
      IF v_e <= v_n_ini AND v_s > v_n_fim THEN
        v_prorrog_min := GREATEST(0, EXTRACT(EPOCH FROM (v_s - v_n_fim))/60)::INTEGER;
        v_adn_min := v_adn_min + v_prorrog_min;
      END IF;
    END;
  END IF;

  UPDATE public.ponto_diario
     SET horas_extras_50_minutos = v_he50,
         horas_extras_100_minutos = v_he100,
         adicional_noturno_minutos = v_adn_min,
         updated_at = now()
   WHERE id = v_diario.id;

  RETURN jsonb_build_object(
    'ok', true,
    'he50_min', v_he50,
    'he100_min', v_he100,
    'adicional_noturno_min', v_adn_min,
    'percentual_he50', v_he50_pct,
    'percentual_he100', v_he100_pct,
    'percentual_adn', v_adn_pct,
    'domingo_dobra', v_domingo_dobra
  );
END;
$function$;

COMMENT ON FUNCTION public.calcular_he_adicional_noturno_dia(uuid, date) IS
  'Apura HE (50/100%), adicional noturno e a DOBRA de domingo trabalhado sem folga compensatoria (Lei 605/49 art. 9; Sumula 146). Domingo de repouso trabalhado -> jornada inteira a 100%; domingo previsto na escala -> calculo normal. CLT art. 59/73.';
