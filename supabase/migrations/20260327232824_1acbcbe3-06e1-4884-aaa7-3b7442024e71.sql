
-- GAP 1: Validação sequencial de marcações
CREATE OR REPLACE FUNCTION public.validar_sequencia_marcacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tem_entrada BOOLEAN;
  v_tem_saida_almoco BOOLEAN;
  v_tem_retorno_almoco BOOLEAN;
BEGIN
  SELECT
    EXISTS(SELECT 1 FROM ponto_marcacoes WHERE tenant_id = NEW.tenant_id AND colaborador_cpf = NEW.colaborador_cpf AND data_marcacao = NEW.data_marcacao AND tipo_marcacao = 'entrada'),
    EXISTS(SELECT 1 FROM ponto_marcacoes WHERE tenant_id = NEW.tenant_id AND colaborador_cpf = NEW.colaborador_cpf AND data_marcacao = NEW.data_marcacao AND tipo_marcacao = 'saida_almoco'),
    EXISTS(SELECT 1 FROM ponto_marcacoes WHERE tenant_id = NEW.tenant_id AND colaborador_cpf = NEW.colaborador_cpf AND data_marcacao = NEW.data_marcacao AND tipo_marcacao = 'retorno_almoco')
  INTO v_tem_entrada, v_tem_saida_almoco, v_tem_retorno_almoco;

  IF NEW.tipo_marcacao = 'saida_almoco' AND NOT v_tem_entrada THEN
    RAISE EXCEPTION 'Não é possível registrar Saída Almoço sem Entrada prévia.';
  END IF;
  IF NEW.tipo_marcacao = 'retorno_almoco' AND NOT v_tem_saida_almoco THEN
    RAISE EXCEPTION 'Não é possível registrar Retorno Almoço sem Saída Almoço prévia.';
  END IF;
  IF NEW.tipo_marcacao = 'saida' AND NOT v_tem_entrada THEN
    RAISE EXCEPTION 'Não é possível registrar Saída sem Entrada prévia.';
  END IF;
  IF NEW.tipo_marcacao = 'saida' AND v_tem_saida_almoco AND NOT v_tem_retorno_almoco THEN
    RAISE EXCEPTION 'Não é possível registrar Saída Final sem Retorno do Almoço.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_sequencia_marcacao ON ponto_marcacoes;
CREATE TRIGGER trg_validar_sequencia_marcacao
  BEFORE INSERT ON ponto_marcacoes
  FOR EACH ROW
  EXECUTE FUNCTION validar_sequencia_marcacao();

-- GAP 2: Bloquear colaboradores inativos/afastados
CREATE OR REPLACE FUNCTION public.validar_colaborador_ativo_ponto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_status TEXT;
  v_tem_afastamento BOOLEAN;
BEGIN
  SELECT status INTO v_status
  FROM admissoes
  WHERE tenant_id = NEW.tenant_id AND cpf = NEW.colaborador_cpf
  ORDER BY created_at DESC LIMIT 1;

  IF v_status IS NOT NULL AND v_status = 'desligado' THEN
    RAISE EXCEPTION 'Colaborador desligado. Não é possível registrar ponto.';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM afastamentos
    WHERE tenant_id = NEW.tenant_id
      AND colaborador_cpf = NEW.colaborador_cpf
      AND status = 'ativo'
      AND data_inicio <= NEW.data_marcacao
      AND (data_fim IS NULL OR data_fim >= NEW.data_marcacao)
  ) INTO v_tem_afastamento;

  IF v_tem_afastamento THEN
    RAISE EXCEPTION 'Colaborador afastado. Não é possível registrar ponto durante período de afastamento.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_colaborador_ativo_ponto ON ponto_marcacoes;
CREATE TRIGGER trg_validar_colaborador_ativo_ponto
  BEFORE INSERT ON ponto_marcacoes
  FOR EACH ROW
  EXECUTE FUNCTION validar_colaborador_ativo_ponto();

-- GAP 4: Bloquear marcações em períodos fechados
CREATE OR REPLACE FUNCTION public.validar_periodo_aberto_ponto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_competencia TEXT;
  v_fechado BOOLEAN;
BEGIN
  v_competencia := to_char(NEW.data_marcacao::date, 'YYYY-MM');
  SELECT EXISTS(
    SELECT 1 FROM ponto_fechamentos
    WHERE tenant_id = NEW.tenant_id AND competencia = v_competencia AND status = 'fechado'
  ) INTO v_fechado;

  IF v_fechado THEN
    RAISE EXCEPTION 'Período % está fechado. Não é possível registrar marcações.', v_competencia;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_periodo_aberto_ponto ON ponto_marcacoes;
CREATE TRIGGER trg_validar_periodo_aberto_ponto
  BEFORE INSERT ON ponto_marcacoes
  FOR EACH ROW
  EXECUTE FUNCTION validar_periodo_aberto_ponto();

-- Bloquear UPDATE em ponto_diario quando período fechado
CREATE OR REPLACE FUNCTION public.validar_periodo_aberto_ponto_diario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_competencia TEXT;
  v_fechado BOOLEAN;
BEGIN
  v_competencia := to_char(NEW.data::date, 'YYYY-MM');
  SELECT EXISTS(
    SELECT 1 FROM ponto_fechamentos
    WHERE tenant_id = NEW.tenant_id AND competencia = v_competencia AND status = 'fechado'
  ) INTO v_fechado;

  IF TG_OP = 'UPDATE' AND v_fechado AND NEW.status != 'justificado' THEN
    RAISE EXCEPTION 'Período % está fechado. Alterações bloqueadas.', v_competencia;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_periodo_aberto_ponto_diario ON ponto_diario;
CREATE TRIGGER trg_validar_periodo_aberto_ponto_diario
  BEFORE UPDATE ON ponto_diario
  FOR EACH ROW
  EXECUTE FUNCTION validar_periodo_aberto_ponto_diario();

-- GAP 5: Coluna para HE indenizatória de intervalo suprimido
ALTER TABLE ponto_diario ADD COLUMN IF NOT EXISTS he_intervalo_suprimido_minutos INT DEFAULT 0;

-- GAP 3: Tabela consolidação semanal + coluna jornada semanal
ALTER TABLE ponto_escalas ADD COLUMN IF NOT EXISTS jornada_semanal_minutos INT DEFAULT 2640;

CREATE TABLE IF NOT EXISTS ponto_semanal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  colaborador_cpf TEXT NOT NULL,
  colaborador_nome TEXT NOT NULL,
  ano INT NOT NULL,
  semana INT NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  total_horas_trabalhadas_minutos INT DEFAULT 0,
  total_he_diaria_minutos INT DEFAULT 0,
  he_semanal_excedente_minutos INT DEFAULT 0,
  limite_semanal_minutos INT DEFAULT 2640,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, colaborador_cpf, ano, semana)
);

ALTER TABLE ponto_semanal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_ponto_semanal" ON ponto_semanal
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- Trigger consolidação semanal
CREATE OR REPLACE FUNCTION public.consolidar_ponto_semanal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ano INT;
  v_semana INT;
  v_data_inicio DATE;
  v_data_fim DATE;
  v_total_trabalhadas INT;
  v_total_he_diaria INT;
  v_he_semanal INT;
  v_limite INT := 2640;
BEGIN
  v_ano := EXTRACT(ISOYEAR FROM NEW.data);
  v_semana := EXTRACT(WEEK FROM NEW.data);
  v_data_inicio := date_trunc('week', NEW.data)::DATE;
  v_data_fim := v_data_inicio + 6;

  IF NEW.escala_id IS NOT NULL THEN
    SELECT COALESCE(jornada_semanal_minutos, 2640) INTO v_limite
    FROM ponto_escalas WHERE id = NEW.escala_id;
  END IF;

  SELECT 
    COALESCE(SUM(EXTRACT(EPOCH FROM horas_trabalhadas)::INT / 60), 0),
    COALESCE(SUM(COALESCE(horas_extras_50_minutos, 0) + COALESCE(horas_extras_100_minutos, 0)), 0)
  INTO v_total_trabalhadas, v_total_he_diaria
  FROM ponto_diario
  WHERE tenant_id = NEW.tenant_id AND colaborador_cpf = NEW.colaborador_cpf
    AND data >= v_data_inicio AND data <= v_data_fim;

  v_he_semanal := GREATEST(0, v_total_trabalhadas - v_limite - v_total_he_diaria);

  INSERT INTO ponto_semanal (
    tenant_id, colaborador_cpf, colaborador_nome, ano, semana, data_inicio, data_fim,
    total_horas_trabalhadas_minutos, total_he_diaria_minutos, he_semanal_excedente_minutos, limite_semanal_minutos
  ) VALUES (
    NEW.tenant_id, NEW.colaborador_cpf, NEW.colaborador_nome, v_ano, v_semana, v_data_inicio, v_data_fim,
    v_total_trabalhadas, v_total_he_diaria, v_he_semanal, v_limite
  )
  ON CONFLICT (tenant_id, colaborador_cpf, ano, semana)
  DO UPDATE SET
    total_horas_trabalhadas_minutos = v_total_trabalhadas,
    total_he_diaria_minutos = v_total_he_diaria,
    he_semanal_excedente_minutos = v_he_semanal,
    limite_semanal_minutos = v_limite,
    colaborador_nome = NEW.colaborador_nome,
    updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_consolidar_ponto_semanal ON ponto_diario;
CREATE TRIGGER trg_consolidar_ponto_semanal
  AFTER INSERT OR UPDATE ON ponto_diario
  FOR EACH ROW
  EXECUTE FUNCTION consolidar_ponto_semanal();

-- Atualizar consolidar_ponto_diario com GAP 5 (HE intervalo suprimido)
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
  v_escala_id UUID;
  v_jornada_diaria_min INT := 480;
  v_tolerancia_min INT := 5;
  v_tolerancia_diaria_min INT := 10;
  v_hora_entrada TIME := '08:00'::TIME;
  v_hora_saida TIME := '17:00'::TIME;
  v_intervalo_min INT := 60;
  v_usa_hora_ficta BOOLEAN := TRUE;
  v_noturno_inicio TIME := '22:00'::TIME;
  v_noturno_fim TIME := '05:00'::TIME;
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
  v_he_intervalo_suprimido INT := 0;
BEGIN
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

  SELECT ea.escala_id INTO v_escala_id
  FROM public.ponto_escala_atribuicoes ea
  WHERE ea.tenant_id = NEW.tenant_id
    AND ea.colaborador_cpf = NEW.colaborador_cpf
    AND ea.ativa = TRUE
    AND ea.data_inicio <= NEW.data_marcacao
    AND (ea.data_fim IS NULL OR ea.data_fim >= NEW.data_marcacao)
  ORDER BY ea.data_inicio DESC LIMIT 1;

  IF v_escala_id IS NOT NULL THEN
    SELECT 
      e.jornada_diaria_minutos, e.tolerancia_minutos, e.tolerancia_diaria_minutos,
      COALESCE(e.hora_entrada_padrao, '08:00')::TIME, COALESCE(e.hora_saida_padrao, '17:00')::TIME,
      e.intervalo_intrajornada_minutos, e.usa_hora_ficta_noturna,
      COALESCE(e.adicional_noturno_inicio, '22:00')::TIME, COALESCE(e.adicional_noturno_fim, '05:00')::TIME,
      e.sabado_util, e.domingo_util
    INTO 
      v_jornada_diaria_min, v_tolerancia_min, v_tolerancia_diaria_min,
      v_hora_entrada, v_hora_saida, v_intervalo_min,
      v_usa_hora_ficta, v_noturno_inicio, v_noturno_fim,
      v_sabado_util, v_domingo_util
    FROM public.ponto_escalas e WHERE e.id = v_escala_id;
  END IF;

  v_dia_semana := EXTRACT(DOW FROM NEW.data_marcacao);

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

  -- GAP 5: HE indenizatória por supressão de intervalo (Art. 71 §4 CLT)
  IF v_trabalhadas_min + COALESCE(v_intervalo_real_min, 0) > 360 THEN
    IF v_saida_almoco IS NOT NULL AND v_retorno_almoco IS NOT NULL THEN
      IF v_intervalo_real_min < v_intervalo_min THEN
        v_he_intervalo_suprimido := v_intervalo_min - v_intervalo_real_min;
      END IF;
    ELSIF v_saida_almoco IS NULL AND v_retorno_almoco IS NULL AND v_saida IS NOT NULL THEN
      v_he_intervalo_suprimido := v_intervalo_min;
    END IF;
  END IF;

  -- TOLERÂNCIA
  IF v_entrada IS NOT NULL THEN
    v_diff_entrada := EXTRACT(EPOCH FROM (v_entrada - v_hora_entrada))::INT / 60;
    IF v_diff_entrada > 0 AND v_diff_entrada <= v_tolerancia_min THEN
      v_total_tolerancia_usada := v_total_tolerancia_usada + v_diff_entrada;
      v_tolerancia_aplicada := TRUE; v_diff_entrada := 0;
    END IF;
    IF v_diff_entrada < 0 AND ABS(v_diff_entrada) <= v_tolerancia_min THEN
      v_total_tolerancia_usada := v_total_tolerancia_usada + ABS(v_diff_entrada);
      v_tolerancia_aplicada := TRUE;
    END IF;
  END IF;
  IF v_saida IS NOT NULL THEN
    v_diff_saida := EXTRACT(EPOCH FROM (v_saida - v_hora_saida))::INT / 60;
    IF v_diff_saida < 0 AND ABS(v_diff_saida) <= v_tolerancia_min THEN
      IF v_total_tolerancia_usada + ABS(v_diff_saida) <= v_tolerancia_diaria_min THEN
        v_total_tolerancia_usada := v_total_tolerancia_usada + ABS(v_diff_saida);
        v_tolerancia_aplicada := TRUE; v_diff_saida := 0;
      END IF;
    END IF;
    IF v_diff_saida > 0 AND v_diff_saida <= v_tolerancia_min THEN
      IF v_total_tolerancia_usada + v_diff_saida <= v_tolerancia_diaria_min THEN
        v_total_tolerancia_usada := v_total_tolerancia_usada + v_diff_saida;
        v_tolerancia_aplicada := TRUE; v_diff_saida := 0;
      END IF;
    END IF;
  END IF;
  IF v_total_tolerancia_usada > v_tolerancia_diaria_min THEN
    v_tolerancia_aplicada := FALSE;
    IF v_entrada IS NOT NULL THEN v_diff_entrada := EXTRACT(EPOCH FROM (v_entrada - v_hora_entrada))::INT / 60; END IF;
    IF v_saida IS NOT NULL THEN v_diff_saida := EXTRACT(EPOCH FROM (v_saida - v_hora_saida))::INT / 60; END IF;
  END IF;

  -- ATRASO
  IF v_entrada IS NOT NULL AND v_diff_entrada > 0 AND NOT v_tolerancia_aplicada THEN
    v_atraso_min := v_diff_entrada;
  ELSIF v_entrada IS NOT NULL AND v_diff_entrada > v_tolerancia_min THEN
    v_atraso_min := v_diff_entrada;
  END IF;

  -- HORAS EXTRAS
  IF v_trabalhadas_min > v_jornada_diaria_min AND v_entrada IS NOT NULL AND v_saida IS NOT NULL THEN
    v_he_total_min := v_trabalhadas_min - v_jornada_diaria_min;
    IF v_atraso_min > 0 AND v_he_total_min > v_atraso_min THEN
      v_he_total_min := v_he_total_min - v_atraso_min;
    ELSIF v_atraso_min > 0 THEN v_he_total_min := 0; END IF;
    IF v_tolerancia_aplicada AND v_he_total_min <= v_tolerancia_min THEN v_he_total_min := 0; END IF;
    IF (v_dia_semana = 0 AND NOT v_domingo_util) OR (v_dia_semana = 6 AND NOT v_sabado_util) THEN
      v_he_100_min := v_he_total_min; v_he_50_min := 0;
    ELSE
      IF v_he_total_min <= 120 THEN v_he_50_min := v_he_total_min;
      ELSE v_he_50_min := 120; v_he_100_min := v_he_total_min - 120; END IF;
    END IF;
  END IF;

  -- ADICIONAL NOTURNO
  IF v_entrada IS NOT NULL AND v_saida IS NOT NULL THEN
    DECLARE
      v_noturno_start TIME; v_noturno_end TIME; v_work_start TIME; v_work_end TIME; v_overlap_min INT := 0;
    BEGIN
      v_noturno_start := v_noturno_inicio; v_noturno_end := v_noturno_fim;
      v_work_start := v_entrada; v_work_end := v_saida;
      IF v_work_end > v_noturno_start THEN
        v_overlap_min := EXTRACT(EPOCH FROM (v_work_end - GREATEST(v_work_start, v_noturno_start)))::INT / 60;
        IF v_overlap_min < 0 THEN v_overlap_min := 0; END IF;
      END IF;
      IF v_work_start < v_noturno_end THEN
        v_overlap_min := v_overlap_min + EXTRACT(EPOCH FROM (LEAST(v_work_end, v_noturno_end) - v_work_start))::INT / 60;
      END IF;
      IF v_overlap_min > 0 THEN v_noturno_min := v_overlap_min; END IF;
    END;
  END IF;

  -- STATUS
  IF v_entrada IS NULL THEN v_status := 'falta';
  ELSIF v_saida IS NULL THEN v_status := 'incompleto';
  ELSIF v_atraso_min > 0 THEN v_status := 'atraso';
  ELSE v_status := 'regular'; END IF;

  INSERT INTO public.ponto_diario (
    tenant_id, colaborador_id, colaborador_nome, colaborador_cpf, data,
    entrada, saida_almoco, retorno_almoco, saida,
    horas_trabalhadas, status, escala_id,
    horas_extras_50_minutos, horas_extras_100_minutos,
    adicional_noturno_minutos, atraso_minutos,
    intervalo_intrajornada_minutos, tolerancia_aplicada,
    he_intervalo_suprimido_minutos
  ) VALUES (
    NEW.tenant_id, NEW.colaborador_id, NEW.colaborador_nome, NEW.colaborador_cpf, NEW.data_marcacao,
    v_entrada, v_saida_almoco, v_retorno_almoco, v_saida,
    v_horas_trabalhadas, v_status, v_escala_id,
    v_he_50_min, v_he_100_min, v_noturno_min, v_atraso_min,
    v_intervalo_real_min, v_tolerancia_aplicada, v_he_intervalo_suprimido
  )
  ON CONFLICT (tenant_id, colaborador_cpf, data)
  DO UPDATE SET
    entrada = v_entrada, saida_almoco = v_saida_almoco,
    retorno_almoco = v_retorno_almoco, saida = v_saida,
    horas_trabalhadas = v_horas_trabalhadas, escala_id = v_escala_id,
    horas_extras_50_minutos = v_he_50_min, horas_extras_100_minutos = v_he_100_min,
    adicional_noturno_minutos = v_noturno_min, atraso_minutos = v_atraso_min,
    intervalo_intrajornada_minutos = v_intervalo_real_min,
    tolerancia_aplicada = v_tolerancia_aplicada,
    he_intervalo_suprimido_minutos = v_he_intervalo_suprimido,
    status = CASE WHEN public.ponto_diario.status = 'justificado' THEN 'justificado' ELSE v_status END,
    updated_at = now();

  RETURN NEW;
END;
$function$;
