-- =====================================================================
-- FERIADOS: fonte única entre o Espelho e a Equalização
--
-- O modelo de feriados evoluiu (tabelas nomeadas por localização, vínculo
-- por filial, abrangência 'filial' e feriados recorrentes por dia/mês) e o
-- feriado_do_dia acompanhou. A ponto_equalizacao_competencia (RN02) ficou
-- para trás: continua lendo direto de public.feriados com a regra antiga.
--
-- Duas divergências concretas, hoje, em produção:
--
--  1. Filial SEM cidade/UF (119 das 1.393 ativas):
--       espelho     -> feriado local NÃO se aplica (regra estrita)
--       equalização -> (uf IS NULL OR v_emp.estado IS NULL OR ...) fazia
--                      TODOS os estaduais e municipais valerem
--     O mesmo dia era feriado num cálculo e dia útil no outro.
--
--  2. Feriado cadastrado numa TABELA vinculada à filial, feriado de
--     abrangência 'filial' ou feriado RECORRENTE (dia/mês): reconhecido no
--     espelho, invisível para a equalização — que então contava dia útil a
--     mais e inflava o déficit do mês.
--
-- Correção: uma única função resolve feriado por empresa/período, com a
-- mesma ordem de prioridade do espelho, e as duas pontas passam a consumi-la.
-- =====================================================================

-- 1) RESOLUÇÃO ÚNICA, POR EMPRESA E PERÍODO ---------------------------
-- Prioridade (a mais específica vence, igual ao feriado_do_dia):
--   0 tabela nomeada vinculada à filial
--   1 feriado de abrangência 'filial'
--   2 municipal (exige UF E cidade casando)
--   3 estadual  (exige UF casando)
--   4 nacional
-- Sem UF/cidade na filial, o feriado local simplesmente não se aplica —
-- nunca "vale para todos".
CREATE OR REPLACE FUNCTION public.feriados_da_empresa(
  p_tenant_id uuid,
  p_empresa_id uuid,
  p_ini date,
  p_fim date
)
RETURNS TABLE(data date, nome text, origem text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH loc AS (
    -- Subselects escalares: devolve sempre UMA linha, com NULL quando a
    -- empresa não existe. Um JOIN aqui zeraria também os nacionais.
    SELECT
      (SELECT ec.estado FROM public.empresa_cadastro ec WHERE ec.id = p_empresa_id) AS uf,
      (SELECT ec.cidade FROM public.empresa_cadastro ec WHERE ec.id = p_empresa_id) AS cidade
  ),
  dias AS (
    SELECT g::date AS d FROM generate_series(p_ini, p_fim, interval '1 day') g
  ),
  candidatos AS (
    -- P0: tabela nomeada vinculada à filial
    SELECT d.d AS data, i.nome, 'tabela'::text AS origem, 0 AS prio
    FROM dias d
    JOIN public.feriado_tabela_empresas v ON v.empresa_id = p_empresa_id
    JOIN public.feriado_tabelas t
      ON t.id = v.tabela_id AND t.ativo = true AND t.tenant_id = p_tenant_id
     AND (t.ano IS NULL OR t.ano = EXTRACT(YEAR FROM d.d)::int)
    JOIN public.feriado_tabela_itens i
      ON i.tabela_id = t.id AND i.ativo = true AND i.tipo = 'feriado'
     AND (
       (i.recorrente = true
         AND i.dia = EXTRACT(DAY FROM d.d)::smallint
         AND i.mes = EXTRACT(MONTH FROM d.d)::smallint)
       OR (i.recorrente = false AND i.data = d.d)
     )
    WHERE p_empresa_id IS NOT NULL

    UNION ALL

    -- P1..P4: base public.feriados
    SELECT d.d, f.nome, f.abrangencia,
           CASE f.abrangencia
             WHEN 'filial' THEN 1 WHEN 'municipal' THEN 2
             WHEN 'estadual' THEN 3 ELSE 4 END
    FROM dias d
    CROSS JOIN loc
    JOIN public.feriados f
      ON COALESCE(f.ativo, true) = true AND f.tipo = 'feriado'
     AND (f.tenant_id IS NULL OR f.tenant_id = p_tenant_id)
     AND (
       (COALESCE(f.recorrente, false) = true
         AND f.dia = EXTRACT(DAY FROM d.d)::smallint
         AND f.mes = EXTRACT(MONTH FROM d.d)::smallint)
       OR (COALESCE(f.recorrente, false) = false AND f.data = d.d)
     )
     AND (
       f.abrangencia = 'nacional'
       OR (f.abrangencia = 'filial'
           AND p_empresa_id IS NOT NULL AND f.empresa_id = p_empresa_id)
       OR (f.abrangencia = 'estadual'
           AND loc.uf IS NOT NULL AND btrim(loc.uf) <> ''
           AND upper(btrim(f.uf)) = upper(btrim(loc.uf)))
       OR (f.abrangencia = 'municipal'
           AND loc.uf IS NOT NULL AND btrim(loc.uf) <> ''
           AND loc.cidade IS NOT NULL AND btrim(loc.cidade) <> ''
           AND upper(btrim(f.uf)) = upper(btrim(loc.uf))
           AND upper(btrim(f.municipio)) = upper(btrim(loc.cidade)))
     )
  )
  SELECT DISTINCT ON (c.data) c.data, c.nome, c.origem
  FROM candidatos c
  ORDER BY c.data, c.prio, c.nome;
$$;

GRANT EXECUTE ON FUNCTION public.feriados_da_empresa(uuid, uuid, date, date)
  TO authenticated, service_role;

-- 2) feriado_do_dia DELEGA À FONTE ÚNICA -------------------------------
-- Comportamento idêntico ao que já roda: mesma ordem de prioridade, mesma
-- resolução colaborador -> filial. Muda só de onde vem a regra.
CREATE OR REPLACE FUNCTION public.feriado_do_dia(
  p_tenant_id uuid,
  p_colaborador_id uuid,
  p_data date
)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT h.nome
  FROM public.feriados_da_empresa(
    p_tenant_id,
    public.ponto_empresa_do_colaborador(p_colaborador_id),
    p_data, p_data
  ) h
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.feriado_do_dia(uuid, uuid, date)
  TO authenticated, service_role;

-- 3) EQUALIZAÇÃO PASSA A USAR A MESMA RESOLUÇÃO ------------------------
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
  v_carga int := 0;
  v_contratada int;
  v_dias_uteis int := 0;
  v_feriados jsonb := '[]'::jsonb;
  v_qtd_fer int := 0;
  v_efetivos int;
  v_def_sem int;
  v_total int;
  v_obs text[] := ARRAY[]::text[];
BEGIN
  IF auth.uid() IS NOT NULL AND public.get_user_tenant_id() IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'Acesso negado ao tenant';
  END IF;

  SELECT id, nome, dias_config, jornada_diaria_minutos, empresa_id,
         COALESCE(equalizacao_mensal_ativa, false) AS ativa,
         COALESCE(carga_semanal_contratada_min, 2640) AS contratada
    INTO v_esc
  FROM public.ponto_escalas
  WHERE id = p_escala_id AND tenant_id = p_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Escala não encontrada no tenant';
  END IF;

  v_contratada := v_esc.contratada;

  SELECT estado, cidade INTO v_emp
  FROM public.empresa_cadastro WHERE id = v_esc.empresa_id;

  -- Carga semanal REAL derivada do dias_config (seg–sex)
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
    v_obs := v_obs || ARRAY['Carga semanal estimada por jornada_diaria_minutos × 5 (escala sem dias_config).'];
  END IF;

  v_def_sem  := GREATEST(v_contratada - v_carga, 0);

  -- Opt-in desligado: não aplica (mas devolve a memória para inspeção)
  IF NOT v_esc.ativa THEN
    RETURN jsonb_build_object(
      'aplicavel', false,
      'competencia', p_competencia,
      'escala_id', v_esc.id,
      'escala_nome', v_esc.nome,
      'carga_semanal_real_min', v_carga,
      'carga_semanal_contratada_min', v_contratada,
      'total_equalizacao_min', 0,
      'observacoes', to_jsonb(v_obs || ARRAY['Equalização mensal desativada para esta escala.']),
      'gerado_em', now()
    );
  END IF;

  -- RN01: dias úteis seg–sex por contagem direta
  SELECT count(*) INTO v_dias_uteis
  FROM generate_series(v_ini, v_fim, interval '1 day') g
  WHERE EXTRACT(ISODOW FROM g) BETWEEN 1 AND 5;

  -- RN02: feriados (só tipo='feriado' e ativo=true)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('data', f.data, 'nome', f.nome) ORDER BY f.data), '[]'::jsonb),
         count(*)
    INTO v_feriados, v_qtd_fer
  FROM (
    -- FONTE ÚNICA: mesma resolução do espelho (feriado_do_dia), agora ciente
    -- das tabelas nomeadas vinculadas à filial, de feriados de abrangência
    -- 'filial' e de feriados recorrentes (dia/mês).
    --
    -- A regra anterior era frouxa: sem UF/cidade na filial, TODOS os feriados
    -- estaduais e municipais da base eram deduzidos aqui, enquanto no espelho
    -- não valia nenhum — o mesmo dia contava como feriado num cálculo e como
    -- dia útil no outro.
    SELECT h.data, h.nome
    FROM public.feriados_da_empresa(p_tenant_id, v_esc.empresa_id, v_ini, v_fim) h
    WHERE EXTRACT(ISODOW FROM h.data) BETWEEN 1 AND 5
    ORDER BY h.data
  ) f;

  v_efetivos := GREATEST(v_dias_uteis - COALESCE(v_qtd_fer, 0), 0);
  v_total    := round(v_efetivos * v_def_sem / 5.0)::int;

  IF v_def_sem = 0 THEN
    v_obs := v_obs || ARRAY['Escala já cumpre a carga contratada — equalização não se aplica.'];
  END IF;
  IF v_qtd_fer = 0 THEN
    v_obs := v_obs || ARRAY['Nenhum feriado deduzido neste mês (pontos facultativos não são deduzidos).'];
  END IF;

  RETURN jsonb_build_object(
    'aplicavel', true,
    'competencia', p_competencia,
    'escala_id', v_esc.id,
    'escala_nome', v_esc.nome,
    'dias_uteis_brutos', v_dias_uteis,
    'feriados_deduzidos', v_feriados,
    'qtd_feriados_deduzidos', COALESCE(v_qtd_fer, 0),
    'dias_uteis_efetivos', v_efetivos,
    'carga_semanal_real_min', v_carga,
    'carga_semanal_contratada_min', v_contratada,
    'deficit_semanal_min', v_def_sem,
    'deficit_diario_min', round(v_def_sem / 5.0, 1),
    'total_equalizacao_min', v_total,
    'observacoes', to_jsonb(v_obs),
    'gerado_em', now()
  );
END;
$$;

-- O agregador do tenant passa a listar SÓ escalas com opt-in ligado.

GRANT EXECUTE ON FUNCTION public.ponto_equalizacao_competencia(uuid, uuid, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.feriados_da_empresa(uuid, uuid, date, date) IS
  'Resolução única de feriados por empresa/filial e período. Prioridade: tabela vinculada > filial > municipal > estadual > nacional. Consumida por feriado_do_dia (espelho) e por ponto_equalizacao_competencia (RN02).';
