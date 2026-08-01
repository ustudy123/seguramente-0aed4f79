-- =====================================================================
-- EQUALIZAÇÃO MENSAL — FASES 2+3+4 (marcação, efeito no saldo, teto)
-- Decisões de negócio confirmadas (Leiri/Bento, 31/07/2026):
--   1. Trabalhou MENOS que a equalização no sábado marcado -> débito da diferença
--   2. Mês encerrado SEM sábado trabalhado -> débito integral da equalização
--   3. Excedente -> CRÉDITO no banco (semestre formalizado)
--   4. Marcação INDIVIDUAL por colaborador (mesmo na mesma escala)
--   5. NUNCA bloquear batida; excedente acima do teto (+120min) fica RETIDO
--      (não vira crédito) até o RH liberar com justificativa (art. 61 CLT)
-- =====================================================================

-- 1) MARCAÇÃO DO SÁBADO DE EQUALIZAÇÃO (RN05) + memória congelada (RN10)
CREATE TABLE IF NOT EXISTS public.ponto_equalizacao_mensal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  empresa_id uuid,
  colaborador_cpf text NOT NULL,          -- apenas dígitos
  colaborador_nome text,
  competencia text NOT NULL,              -- 'YYYY-MM'
  data_equalizacao date NOT NULL,         -- o sábado escolhido
  escala_id uuid,
  total_equalizacao_min int NOT NULL,     -- congelado na marcação (RN04)
  memoria jsonb,                          -- memória de cálculo usada (RN10)
  origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual','auto')),
  art61_justificativa text,
  art61_liberado_por uuid,
  art61_liberado_em timestamptz,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, colaborador_cpf, competencia)
);

CREATE INDEX IF NOT EXISTS idx_pem_tenant_comp ON public.ponto_equalizacao_mensal(tenant_id, competencia);

ALTER TABLE public.ponto_equalizacao_mensal ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "pem_select" ON public.ponto_equalizacao_mensal FOR SELECT
    USING (tenant_id = public.get_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "pem_all" ON public.ponto_equalizacao_mensal FOR ALL
    USING (tenant_id = public.get_user_tenant_id())
    WITH CHECK (tenant_id = public.get_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) FONTE ÚNICA DO SALDO — recriada com o dia de equalização (RN06+RN07)
--    (DROP porque o tipo de retorno ganha 2 colunas novas.)
DROP FUNCTION IF EXISTS public.ponto_saldo_dias_competencia(uuid, text, text);

CREATE FUNCTION public.ponto_saldo_dias_competencia(
  p_tenant_id uuid, p_colaborador_cpf text, p_competencia text
)
RETURNS TABLE(
  dia date, entrada time, saida time,
  trabalhado_min int, jornada_min int, saldo_min int, protegido boolean,
  equalizacao boolean, excedente_retido_min int
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_ini date := to_date(p_competencia || '-01', 'YYYY-MM-DD');
  v_fim date := (to_date(p_competencia || '-01', 'YYYY-MM-DD') + INTERVAL '1 month - 1 day')::date;
  v_cpf text := regexp_replace(COALESCE(p_colaborador_cpf, ''), '[^0-9]', '', 'g');
  v_colaborador_id text;
  v_fb_jornada int;
  v_fb_tol int := 0;
  v_fb_escala_id uuid;
  v_jornada int;
  v_tol int;
  v_esperado int;
  v_atest_min int;
  v_jornada_efetiva int;
  v_extras int;
  v_faltantes int;
  v_trab int;
  v_diff int;
  v_ent_esc time; v_sai_esc time; v_interv int; v_tol_bat int;
  v_ent_cons int; v_sai_cons int; v_trab_ajust int; v_usou_batida boolean;
  v_protegido boolean;
  -- Equalização mensal (marcação individual do colaborador)
  v_eq_data date;
  v_eq_total int;
  v_eq_liberado boolean := false;
  v_eq_teve_linha boolean := false;
  v_eq_m jsonb;
  r RECORD;
BEGIN
  SELECT colaborador_id INTO v_colaborador_id
  FROM public.ponto_diario
  WHERE tenant_id = p_tenant_id
    AND regexp_replace(colaborador_cpf, '[^0-9]', '', 'g') = v_cpf
    AND data BETWEEN v_ini AND v_fim
  ORDER BY data DESC
  LIMIT 1;

  SELECT e.jornada_diaria_minutos, COALESCE(e.tolerancia_diaria_minutos, 0), e.id
    INTO v_fb_jornada, v_fb_tol, v_fb_escala_id
  FROM public.ponto_escala_atribuicoes a
  JOIN public.ponto_escalas e ON e.id = a.escala_id
  WHERE a.tenant_id = p_tenant_id
    AND (regexp_replace(COALESCE(a.colaborador_cpf,''), '[^0-9]', '', 'g') = v_cpf OR a.colaborador_id = v_colaborador_id)
    AND COALESCE(a.ativa, true) = true
  ORDER BY a.data_inicio ASC
  LIMIT 1;

  -- Marcação de equalização do colaborador nesta competência (decisão 4)
  SELECT pem.data_equalizacao, pem.total_equalizacao_min, (pem.art61_liberado_em IS NOT NULL)
    INTO v_eq_data, v_eq_total, v_eq_liberado
  FROM public.ponto_equalizacao_mensal pem
  WHERE pem.tenant_id = p_tenant_id
    AND pem.colaborador_cpf = v_cpf
    AND pem.competencia = p_competencia;

  FOR r IN
    SELECT d.data, d.status, d.tipo_dia, d.observacao, d.horas_trabalhadas,
           d.horas_extras, d.horas_faltantes, d.colaborador_id, d.entrada, d.saida
    FROM public.ponto_diario d
    WHERE d.tenant_id = p_tenant_id
      AND regexp_replace(d.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf
      AND d.data BETWEEN v_ini AND v_fim
    ORDER BY d.data
  LOOP
    v_protegido := (
      r.status = 'justificado'
      OR COALESCE(r.tipo_dia, 'normal') IN ('ferias', 'atestado', 'afastamento', 'feriado')
      OR COALESCE(r.observacao, '') ILIKE '%atestado%'
      OR EXISTS (
        SELECT 1 FROM public.atestados a
        WHERE a.tenant_id = p_tenant_id
          AND regexp_replace(a.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf
          AND COALESCE(a.unidade_afastamento, 'dias') = 'dias'
          AND a.data_inicio_afastamento IS NOT NULL
          AND a.data_inicio_afastamento <= r.data
          AND COALESCE(a.data_fim_afastamento, a.data_inicio_afastamento) >= r.data
      )
    );

    IF v_protegido THEN
      IF v_eq_data IS NOT NULL AND r.data = v_eq_data THEN
        v_eq_teve_linha := true;  -- dia de equalização justificado: não cobra
      END IF;
      dia := r.data; entrada := r.entrada; saida := r.saida;
      trabalhado_min := COALESCE((EXTRACT(EPOCH FROM r.horas_trabalhadas)/60)::int, 0);
      jornada_min := 0; saldo_min := 0; protegido := true;
      equalizacao := false; excedente_retido_min := 0;
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- ============ DIA DE EQUALIZAÇÃO MENSAL (RN06 + RN07) ============
    -- Jornada esperada do dia = TOTAL de equalização do mês (RN04).
    -- Trabalhou menos -> débito da diferença (decisão 1). Excedente vira
    -- crédito (decisão 3), limitado a +120min quando não liberado pelo RH
    -- (art. 61 CLT — decisão 5); o que passar fica RETIDO, sem crédito.
    IF v_eq_data IS NOT NULL AND r.data = v_eq_data THEN
      v_eq_teve_linha := true;
      v_trab := COALESCE((EXTRACT(EPOCH FROM r.horas_trabalhadas)/60)::int, 0);
      v_diff := v_trab - COALESCE(v_eq_total, 0);
      excedente_retido_min := 0;
      IF v_diff > 120 AND NOT v_eq_liberado THEN
        excedente_retido_min := v_diff - 120;
        v_diff := 120;
      END IF;
      IF abs(v_diff) <= 10 THEN v_diff := 0; END IF;
      dia := r.data; entrada := r.entrada; saida := r.saida;
      trabalhado_min := v_trab;
      jornada_min := COALESCE(v_eq_total, 0);
      saldo_min := v_diff;
      protegido := false;
      equalizacao := true;
      RETURN NEXT;
      CONTINUE;
    END IF;

    SELECT j.jornada_min, j.tol_min INTO v_jornada, v_tol
    FROM public.ponto_jornada_do_dia(p_tenant_id, v_cpf, r.colaborador_id::text, r.data) j;

    IF v_jornada IS NULL OR v_jornada = 0 THEN
      IF EXTRACT(DOW FROM r.data)::int IN (0, 6) THEN
        v_esperado := 0;
      ELSE
        v_esperado := COALESCE(v_fb_jornada, 0);
      END IF;
    ELSE
      v_esperado := v_jornada;
    END IF;
    v_tol := CASE WHEN COALESCE(v_tol, 0) <> 0 THEN v_tol ELSE COALESCE(v_fb_tol, 0) END;

    SELECT COALESCE(SUM(COALESCE(a.horas_afastamento, 0) * 60 + COALESCE(a.minutos_afastamento, 0)), 0)
      INTO v_atest_min
    FROM public.atestados a
    WHERE a.tenant_id = p_tenant_id
      AND regexp_replace(a.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf
      AND COALESCE(a.unidade_afastamento, 'dias') = 'horas'
      AND a.data_inicio_afastamento IS NOT NULL
      AND a.data_inicio_afastamento <= r.data
      AND COALESCE(a.data_fim_afastamento, a.data_inicio_afastamento) >= r.data;

    v_jornada_efetiva := GREATEST(0, v_esperado - COALESCE(v_atest_min, 0));

    v_ent_esc := NULL; v_sai_esc := NULL; v_interv := 0; v_tol_bat := 10;
    BEGIN
      SELECT e.entrada, e.saida, COALESCE(e.intervalo_min, 0), COALESCE(e.tolerancia_batida_min, 10)
        INTO v_ent_esc, v_sai_esc, v_interv, v_tol_bat
      FROM public.ponto_escala_do_dia(p_tenant_id, v_cpf, r.colaborador_id::text, r.data) e;
    EXCEPTION WHEN OTHERS THEN
      v_ent_esc := NULL; v_sai_esc := NULL;
    END;

    v_trab := COALESCE((EXTRACT(EPOCH FROM r.horas_trabalhadas)/60)::int, 0);
    v_usou_batida := false;
    v_diff := 0;

    IF v_ent_esc IS NOT NULL AND v_sai_esc IS NOT NULL
       AND r.entrada IS NOT NULL AND r.saida IS NOT NULL
       AND v_jornada_efetiva > 0 THEN

      v_ent_cons := CASE
        WHEN abs((EXTRACT(EPOCH FROM r.entrada)/60)::int - (EXTRACT(EPOCH FROM v_ent_esc)/60)::int) <= COALESCE(v_tol_bat, 10)
          THEN (EXTRACT(EPOCH FROM v_ent_esc)/60)::int
        ELSE (EXTRACT(EPOCH FROM r.entrada)/60)::int
      END;

      v_sai_cons := CASE
        WHEN abs((EXTRACT(EPOCH FROM r.saida)/60)::int - (EXTRACT(EPOCH FROM v_sai_esc)/60)::int) <= COALESCE(v_tol_bat, 10)
          THEN (EXTRACT(EPOCH FROM v_sai_esc)/60)::int
        ELSE (EXTRACT(EPOCH FROM r.saida)/60)::int
      END;

      v_trab_ajust := GREATEST(0, v_sai_cons - v_ent_cons - COALESCE(v_interv, 0));
      v_diff := v_trab_ajust - v_jornada_efetiva;
      v_trab := v_trab_ajust;
      v_usou_batida := true;
    END IF;

    IF NOT v_usou_batida THEN
      v_extras    := COALESCE((EXTRACT(EPOCH FROM r.horas_extras)/60)::int, 0);
      v_faltantes := COALESCE((EXTRACT(EPOCH FROM r.horas_faltantes)/60)::int, 0);

      IF v_extras > 0 OR v_faltantes > 0 THEN
        v_diff := v_extras - v_faltantes;
      ELSIF v_jornada_efetiva = 0 THEN
        v_diff := GREATEST(0, v_trab);
      ELSIF r.status = 'falta' THEN
        v_diff := -v_jornada_efetiva;
      ELSE
        v_diff := v_trab - v_jornada_efetiva;
        IF abs(v_diff) <= COALESCE(v_tol, 0) THEN
          v_diff := 0;
        END IF;
      END IF;
    END IF;

    IF abs(v_diff) <= 10 THEN
      v_diff := 0;
    END IF;

    dia := r.data;
    entrada := r.entrada;
    saida := r.saida;
    trabalhado_min := v_trab;
    jornada_min := v_jornada_efetiva;
    saldo_min := v_diff;
    protegido := false;
    equalizacao := false;
    excedente_retido_min := 0;
    RETURN NEXT;
  END LOOP;

  -- Sábado MARCADO mas sem ponto (data já passou): débito integral (decisão 1)
  IF v_eq_data IS NOT NULL AND NOT v_eq_teve_linha AND v_eq_data < CURRENT_DATE THEN
    dia := v_eq_data; entrada := NULL; saida := NULL;
    trabalhado_min := 0;
    jornada_min := COALESCE(v_eq_total, 0);
    saldo_min := -COALESCE(v_eq_total, 0);
    protegido := false; equalizacao := true; excedente_retido_min := 0;
    IF saldo_min <> 0 THEN RETURN NEXT; END IF;
  END IF;

  -- SEM marcação nenhuma + mês ENCERRADO + escala com déficit:
  -- débito integral da equalização não realizada (decisão 2)
  IF v_eq_data IS NULL AND v_fim < CURRENT_DATE AND v_fb_escala_id IS NOT NULL THEN
    v_eq_m := public.ponto_equalizacao_competencia(p_tenant_id, v_fb_escala_id, p_competencia);
    v_eq_total := COALESCE((v_eq_m->>'total_equalizacao_min')::int, 0);
    IF v_eq_total > 0 THEN
      dia := v_fim; entrada := NULL; saida := NULL;
      trabalhado_min := 0;
      jornada_min := v_eq_total;
      saldo_min := -v_eq_total;
      protegido := false; equalizacao := true; excedente_retido_min := 0;
      RETURN NEXT;
    END IF;
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.ponto_saldo_dias_competencia(uuid, text, text) TO authenticated, service_role;

-- 3) RPCs DE GESTÃO DA MARCAÇÃO ----------------------------------------

-- 3a) Painel do gerenciador: colaboradores com escala de déficit, seus
--     sábados trabalhados no mês e a marcação atual.
CREATE OR REPLACE FUNCTION public.ponto_equalizacao_listar(
  p_tenant_id uuid, p_competencia text
)
RETURNS TABLE(
  colaborador_cpf text, colaborador_nome text,
  escala_id uuid, escala_nome text,
  total_equalizacao_min int,
  sabados jsonb,
  data_marcada date,
  art61_liberado boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_ini date := to_date(p_competencia || '-01', 'YYYY-MM-DD');
  v_fim date := (to_date(p_competencia || '-01', 'YYYY-MM-DD') + INTERVAL '1 month - 1 day')::date;
  r RECORD;
  v_m jsonb;
  v_total int;
BEGIN
  IF auth.uid() IS NOT NULL AND public.get_user_tenant_id() IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'Acesso negado ao tenant';
  END IF;

  FOR r IN
    SELECT DISTINCT ON (regexp_replace(COALESCE(a.colaborador_cpf,''), '[^0-9]', '', 'g'))
           regexp_replace(COALESCE(a.colaborador_cpf,''), '[^0-9]', '', 'g') AS cpf,
           COALESCE(a.colaborador_nome, '') AS nome,
           e.id AS esc_id, e.nome AS esc_nome
    FROM public.ponto_escala_atribuicoes a
    JOIN public.ponto_escalas e ON e.id = a.escala_id
    WHERE a.tenant_id = p_tenant_id
      AND COALESCE(a.ativa, true) = true
      AND a.data_inicio <= v_fim
      AND (a.data_fim IS NULL OR a.data_fim >= v_ini)
      AND COALESCE(a.colaborador_cpf,'') <> ''
    ORDER BY regexp_replace(COALESCE(a.colaborador_cpf,''), '[^0-9]', '', 'g'), a.data_inicio ASC
  LOOP
    v_m := public.ponto_equalizacao_competencia(p_tenant_id, r.esc_id, p_competencia);
    v_total := COALESCE((v_m->>'total_equalizacao_min')::int, 0);
    IF v_total <= 0 THEN CONTINUE; END IF;  -- escala já fecha 44h

    colaborador_cpf := r.cpf;
    colaborador_nome := r.nome;
    escala_id := r.esc_id;
    escala_nome := r.esc_nome;
    total_equalizacao_min := v_total;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'data', d.data,
             'trabalhado_min', COALESCE((EXTRACT(EPOCH FROM d.horas_trabalhadas)/60)::int, 0)
           ) ORDER BY d.data), '[]'::jsonb)
      INTO sabados
    FROM public.ponto_diario d
    WHERE d.tenant_id = p_tenant_id
      AND regexp_replace(d.colaborador_cpf, '[^0-9]', '', 'g') = r.cpf
      AND d.data BETWEEN v_ini AND v_fim
      AND EXTRACT(ISODOW FROM d.data) = 6
      AND (d.entrada IS NOT NULL OR COALESCE((EXTRACT(EPOCH FROM d.horas_trabalhadas)/60)::int,0) > 0);

    SELECT pem.data_equalizacao, (pem.art61_liberado_em IS NOT NULL)
      INTO data_marcada, art61_liberado
    FROM public.ponto_equalizacao_mensal pem
    WHERE pem.tenant_id = p_tenant_id
      AND pem.colaborador_cpf = r.cpf
      AND pem.competencia = p_competencia;
    IF NOT FOUND THEN data_marcada := NULL; art61_liberado := false; END IF;

    RETURN NEXT;
  END LOOP;
END;
$$;

-- 3b) Definir/alterar o sábado de equalização de um colaborador
CREATE OR REPLACE FUNCTION public.ponto_equalizacao_definir(
  p_tenant_id uuid, p_colaborador_cpf text, p_competencia text, p_data date
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_cpf text := regexp_replace(COALESCE(p_colaborador_cpf,''), '[^0-9]', '', 'g');
  v_esc RECORD;
  v_m jsonb;
  v_total int;
  v_nome text;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF public.get_user_tenant_id() IS DISTINCT FROM p_tenant_id
       OR NOT public.has_minimum_role(auth.uid(), 'manager') THEN
      RAISE EXCEPTION 'Sem permissão para definir equalização';
    END IF;
  END IF;
  IF EXTRACT(ISODOW FROM p_data) <> 6 THEN
    RAISE EXCEPTION 'A equalização mensal deve ser marcada em um sábado';
  END IF;
  IF to_char(p_data, 'YYYY-MM') <> p_competencia THEN
    RAISE EXCEPTION 'Data fora da competência informada';
  END IF;

  SELECT e.id, e.nome, e.empresa_id INTO v_esc
  FROM public.ponto_escala_atribuicoes a
  JOIN public.ponto_escalas e ON e.id = a.escala_id
  WHERE a.tenant_id = p_tenant_id
    AND regexp_replace(COALESCE(a.colaborador_cpf,''), '[^0-9]', '', 'g') = v_cpf
    AND COALESCE(a.ativa, true) = true
  ORDER BY a.data_inicio ASC
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Colaborador sem escala ativa — não é possível calcular a equalização';
  END IF;

  v_m := public.ponto_equalizacao_competencia(p_tenant_id, v_esc.id, p_competencia);
  v_total := COALESCE((v_m->>'total_equalizacao_min')::int, 0);
  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Escala do colaborador já cumpre 44h — equalização não se aplica';
  END IF;

  SELECT colaborador_nome INTO v_nome
  FROM public.ponto_escala_atribuicoes
  WHERE tenant_id = p_tenant_id
    AND regexp_replace(COALESCE(colaborador_cpf,''), '[^0-9]', '', 'g') = v_cpf
  LIMIT 1;

  INSERT INTO public.ponto_equalizacao_mensal (
    tenant_id, empresa_id, colaborador_cpf, colaborador_nome, competencia,
    data_equalizacao, escala_id, total_equalizacao_min, memoria, origem, criado_por
  ) VALUES (
    p_tenant_id, v_esc.empresa_id, v_cpf, v_nome, p_competencia,
    p_data, v_esc.id, v_total, v_m, 'manual', auth.uid()
  )
  ON CONFLICT (tenant_id, colaborador_cpf, competencia)
  DO UPDATE SET
    data_equalizacao = EXCLUDED.data_equalizacao,
    escala_id = EXCLUDED.escala_id,
    total_equalizacao_min = EXCLUDED.total_equalizacao_min,
    memoria = EXCLUDED.memoria,
    updated_at = now();

  RETURN jsonb_build_object('ok', true, 'total_equalizacao_min', v_total, 'data', p_data);
END;
$$;

-- 3c) Remover a marcação
CREATE OR REPLACE FUNCTION public.ponto_equalizacao_remover(
  p_tenant_id uuid, p_colaborador_cpf text, p_competencia text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_cpf text := regexp_replace(COALESCE(p_colaborador_cpf,''), '[^0-9]', '', 'g');
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF public.get_user_tenant_id() IS DISTINCT FROM p_tenant_id
       OR NOT public.has_minimum_role(auth.uid(), 'manager') THEN
      RAISE EXCEPTION 'Sem permissão';
    END IF;
  END IF;
  DELETE FROM public.ponto_equalizacao_mensal
  WHERE tenant_id = p_tenant_id AND colaborador_cpf = v_cpf AND competencia = p_competencia;
END;
$$;

-- 3d) Liberar excedente acima do teto (art. 61 CLT) com justificativa
CREATE OR REPLACE FUNCTION public.ponto_equalizacao_art61_liberar(
  p_tenant_id uuid, p_colaborador_cpf text, p_competencia text, p_justificativa text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_cpf text := regexp_replace(COALESCE(p_colaborador_cpf,''), '[^0-9]', '', 'g');
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF public.get_user_tenant_id() IS DISTINCT FROM p_tenant_id
       OR NOT public.has_minimum_role(auth.uid(), 'manager') THEN
      RAISE EXCEPTION 'Sem permissão';
    END IF;
  END IF;
  IF COALESCE(trim(p_justificativa), '') = '' THEN
    RAISE EXCEPTION 'Justificativa (art. 61 CLT) é obrigatória';
  END IF;
  UPDATE public.ponto_equalizacao_mensal
  SET art61_justificativa = trim(p_justificativa),
      art61_liberado_por = auth.uid(),
      art61_liberado_em = now(),
      updated_at = now()
  WHERE tenant_id = p_tenant_id AND colaborador_cpf = v_cpf AND competencia = p_competencia;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Marcação de equalização não encontrada';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ponto_equalizacao_listar(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ponto_equalizacao_definir(uuid, text, text, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ponto_equalizacao_remover(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ponto_equalizacao_art61_liberar(uuid, text, text, text) TO authenticated, service_role;
