-- =====================================================================
-- EQUALIZAÇÃO MENSAL — FASE 1 (cálculo) + FASE 5 (base de feriados)
-- Espec: "Equalização Mensal com Sábado Variável"
--   RN01 contagem real de dias úteis (seg–sex) do mês civil
--   RN02 dedução de feriados cadastrados (nacional/estadual/municipal)
--   RN03 déficit diário = (2640 − carga semanal real da escala) / 5
--   RN04 total do mês = dias úteis efetivos × déficit diário
--   RN10 memória de cálculo completa (auditável) em JSONB
-- Nenhuma alteração de saldo/apuração nesta fase (fundação apenas).
-- =====================================================================

-- 1) BASE DE FERIADOS — JÁ EXISTE no banco (public.feriados), com colunas
--    abrangencia (nacional/estadual/municipal), tipo (feriado/facultativo),
--    ativo, uf, municipio, codigo_ibge. Nacionais já semeados até 2028.
--    Esta migration NÃO recria nem altera a tabela; apenas a consome.
--    IMPORTANTE: só tipo='feriado' e ativo=true são deduzidos dos dias úteis
--    — ponto facultativo NÃO suspende expediente obrigatoriamente.

-- 2) CÁLCULO DA EQUALIZAÇÃO DE UMA ESCALA NUMA COMPETÊNCIA --------------
CREATE OR REPLACE FUNCTION public.ponto_equalizacao_competencia(
  p_tenant_id uuid,
  p_escala_id uuid,
  p_competencia text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_ini date := to_date(p_competencia || '-01', 'YYYY-MM-DD');
  v_fim date := (to_date(p_competencia || '-01', 'YYYY-MM-DD') + INTERVAL '1 month - 1 day')::date;
  v_esc RECORD;
  v_emp RECORD;
  v_dias text[] := ARRAY['segunda','terca','quarta','quinta','sexta'];
  v_dia text;
  v_cfg jsonb;
  v_j int;
  v_carga int := 0;              -- carga semanal REAL (min)
  v_dias_uteis int := 0;         -- RN01
  v_feriados jsonb := '[]'::jsonb;
  v_qtd_fer int := 0;            -- RN02
  v_efetivos int;
  v_def_sem int;                 -- RN03
  v_total int;                   -- RN04
  v_obs text[] := ARRAY[]::text[];
BEGIN
  IF auth.uid() IS NOT NULL AND public.get_user_tenant_id() IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'Acesso negado ao tenant';
  END IF;

  SELECT id, nome, dias_config, jornada_diaria_minutos, empresa_id
    INTO v_esc
  FROM public.ponto_escalas
  WHERE id = p_escala_id AND tenant_id = p_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Escala não encontrada no tenant';
  END IF;

  SELECT estado, cidade INTO v_emp
  FROM public.empresa_cadastro WHERE id = v_esc.empresa_id;

  -- RN03: carga semanal REAL derivada do dias_config (seg–sex)
  IF v_esc.dias_config IS NOT NULL AND jsonb_typeof(v_esc.dias_config) = 'object' THEN
    FOREACH v_dia IN ARRAY v_dias LOOP
      v_cfg := v_esc.dias_config -> v_dia;
      IF v_cfg IS NOT NULL AND COALESCE((v_cfg->>'trabalha')::boolean, false) THEN
        v_j := (EXTRACT(EPOCH FROM ((v_cfg->>'saida')::time - (v_cfg->>'entrada')::time)) / 60)::int;
        IF COALESCE((v_cfg->>'tem_almoco')::boolean, false)
           AND (v_cfg->>'inicio_almoco') IS NOT NULL
           AND (v_cfg->>'fim_almoco') IS NOT NULL THEN
          v_j := v_j - (EXTRACT(EPOCH FROM (
            (v_cfg->>'fim_almoco')::time - (v_cfg->>'inicio_almoco')::time)) / 60)::int;
        END IF;
        v_carga := v_carga + GREATEST(v_j, 0);
      END IF;
    END LOOP;
  ELSE
    v_carga := COALESCE(v_esc.jornada_diaria_minutos, 0) * 5;
    v_obs := v_obs || 'Carga semanal estimada por jornada_diaria_minutos × 5 (escala sem dias_config).';
  END IF;

  -- RN01: contagem direta de seg–sex do mês civil (sem multiplicador fixo)
  SELECT count(*) INTO v_dias_uteis
  FROM generate_series(v_ini, v_fim, interval '1 day') g
  WHERE EXTRACT(ISODOW FROM g) BETWEEN 1 AND 5;

  -- RN02: feriados cadastrados que caem em dia útil no mês
  --   globais (nacionais) sempre; do tenant: nacionais sempre; estaduais
  --   pela UF da empresa da escala; municipais pela cidade da empresa.
  SELECT COALESCE(jsonb_agg(jsonb_build_object('data', f.data, 'nome', f.nome) ORDER BY f.data), '[]'::jsonb),
         count(*)
    INTO v_feriados, v_qtd_fer
  FROM (
    SELECT DISTINCT ON (data) data, nome
    FROM public.feriados
    WHERE data BETWEEN v_ini AND v_fim
      AND EXTRACT(ISODOW FROM data) BETWEEN 1 AND 5
      AND COALESCE(ativo, true) = true
      AND tipo = 'feriado'          -- facultativo não deduz dia útil
      AND (tenant_id IS NULL OR tenant_id = p_tenant_id)
      AND (
        abrangencia = 'nacional'
        OR (abrangencia = 'estadual'
            AND (uf IS NULL OR v_emp.estado IS NULL OR upper(uf) = upper(v_emp.estado)))
        OR (abrangencia = 'municipal'
            AND (municipio IS NULL OR v_emp.cidade IS NULL OR lower(municipio) = lower(v_emp.cidade)))
      )
    ORDER BY data, nome
  ) f;

  v_efetivos := GREATEST(v_dias_uteis - COALESCE(v_qtd_fer, 0), 0);
  v_def_sem  := GREATEST(2640 - v_carga, 0);                -- RN03
  v_total    := round(v_efetivos * v_def_sem / 5.0)::int;   -- RN04

  IF v_def_sem = 0 THEN
    v_obs := v_obs || 'Escala já cumpre 44h semanais — equalização não se aplica.';
  END IF;
  IF v_qtd_fer = 0 THEN
    v_obs := v_obs || 'Nenhum feriado deduzido neste mês (pontos facultativos não são deduzidos).';
  END IF;

  -- RN10: memória de cálculo completa
  RETURN jsonb_build_object(
    'competencia', p_competencia,
    'escala_id', v_esc.id,
    'escala_nome', v_esc.nome,
    'dias_uteis_brutos', v_dias_uteis,
    'feriados_deduzidos', v_feriados,
    'qtd_feriados_deduzidos', COALESCE(v_qtd_fer, 0),
    'dias_uteis_efetivos', v_efetivos,
    'carga_semanal_real_min', v_carga,
    'deficit_semanal_min', v_def_sem,
    'deficit_diario_min', round(v_def_sem / 5.0, 1),
    'total_equalizacao_min', v_total,
    'observacoes', to_jsonb(v_obs),
    'gerado_em', now()
  );
END;
$$;

-- 3) TODAS AS ESCALAS ATIVAS DO TENANT (para o card do Banco de Horas) ---
CREATE OR REPLACE FUNCTION public.ponto_equalizacao_competencia_tenant(
  p_tenant_id uuid,
  p_competencia text
)
RETURNS TABLE(
  escala_id uuid,
  escala_nome text,
  total_equalizacao_min int,
  dias_uteis_efetivos int,
  qtd_feriados int,
  memoria jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  r RECORD;
  m jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND public.get_user_tenant_id() IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'Acesso negado ao tenant';
  END IF;
  FOR r IN
    SELECT id FROM public.ponto_escalas
    WHERE tenant_id = p_tenant_id AND COALESCE(ativa, true) = true
    ORDER BY nome
  LOOP
    m := public.ponto_equalizacao_competencia(p_tenant_id, r.id, p_competencia);
    escala_id := (m->>'escala_id')::uuid;
    escala_nome := m->>'escala_nome';
    total_equalizacao_min := (m->>'total_equalizacao_min')::int;
    dias_uteis_efetivos := (m->>'dias_uteis_efetivos')::int;
    qtd_feriados := (m->>'qtd_feriados_deduzidos')::int;
    memoria := m;
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ponto_equalizacao_competencia(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ponto_equalizacao_competencia_tenant(uuid, text) TO authenticated, service_role;
