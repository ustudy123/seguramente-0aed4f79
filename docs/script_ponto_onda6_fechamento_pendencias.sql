-- ============================================================================
-- ENTREGA — ONDA 6 (parte 2): pendencia critica bloqueia o fechamento
-- Alvos: ponto_fechamento_pendencias_criticas (nova); ponto_fechar_competencia_verificar (nova)
-- PONTO-388
--
-- O fechamento nao verificava pendencias: com ajuste pendente de aprovacao ou
-- dia incompleto sem tratamento, a competencia fechava por cima e mandava o dado
-- errado para a folha. Passa a existir a lista de pendencias criticas e o portao
-- do fechamento, que aborta quando ha pendencia aberta.
--
-- GARANTIAS: so leitura + um guardiao que aborta quando nao pode fechar. Nao
-- altera o motor de saldo, o espelho nem a transicao de banco. Nao roda por
-- gatilho — a tela chama o portao antes de concluir. Aditivo e idempotente.
-- ============================================================================

-- (1) Lista de pendências críticas -------------------------------------------
CREATE OR REPLACE FUNCTION public.ponto_fechamento_pendencias_criticas(
  p_tenant_id   uuid,
  p_empresa_id  uuid,
  p_competencia text
)
RETURNS TABLE(tipo text, colaborador_cpf text, data_referencia date, descricao text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ini date := to_date(p_competencia || '-01', 'YYYY-MM-DD');
  v_fim date := (to_date(p_competencia || '-01', 'YYYY-MM-DD') + INTERVAL '1 month - 1 day')::date;
BEGIN
  -- Ajustes de ponto PENDENTES de aprovação.
  RETURN QUERY
  SELECT 'ajuste_pendente'::text, a.colaborador_cpf, a.data_referencia,
         'Ajuste de ponto pendente de aprovacao'::text
  FROM public.ponto_ajustes a
  WHERE a.tenant_id = p_tenant_id
    AND a.status = 'pendente'
    AND a.data_referencia BETWEEN v_ini AND v_fim
    AND (p_empresa_id IS NULL OR a.empresa_id = p_empresa_id);

  -- Dias INCOMPLETOS sem tratamento (sequência de marcações incompleta / ajuste
  -- ainda pendente na consolidação do dia).
  RETURN QUERY
  SELECT 'dia_incompleto'::text, d.colaborador_cpf, d.data,
         format('Dia incompleto sem tratamento (status %s)', d.status)::text
  FROM public.ponto_diario d
  WHERE d.tenant_id = p_tenant_id
    AND d.data BETWEEN v_ini AND v_fim
    AND d.status IN ('incompleto', 'ajuste_pendente')
    AND (p_empresa_id IS NULL OR d.empresa_id = p_empresa_id);
END;
$$;

COMMENT ON FUNCTION public.ponto_fechamento_pendencias_criticas(uuid, uuid, text) IS
  'Lista as pendencias criticas que bloqueiam o fechamento da competencia: ajustes pendentes de aprovacao e dias incompletos sem tratamento. Somente leitura. PONTO-388.';

-- (2) Portão do fechamento ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.ponto_fechar_competencia_verificar(
  p_tenant_id   uuid,
  p_empresa_id  uuid,
  p_competencia text
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_n       int;
  v_ajustes int;
  v_dias    int;
BEGIN
  SELECT count(*),
         count(*) FILTER (WHERE tipo = 'ajuste_pendente'),
         count(*) FILTER (WHERE tipo = 'dia_incompleto')
    INTO v_n, v_ajustes, v_dias
  FROM public.ponto_fechamento_pendencias_criticas(p_tenant_id, p_empresa_id, p_competencia);

  IF v_n > 0 THEN
    -- Bloqueia o fechamento: ha pendencia critica aberta (ajuste pendente de
    -- aprovacao / dia incompleto sem tratamento).
    RAISE EXCEPTION 'Fechamento bloqueado na competencia %: % pendencia(s) critica(s) — % ajuste(s) pendente(s) de aprovacao e % dia(s) incompleto(s) sem tratamento. Trate antes de fechar.',
      p_competencia, v_n, v_ajustes, v_dias
      USING ERRCODE = 'raise_exception';
  END IF;

  RETURN 0;  -- sem pendencias: pode fechar
END;
$$;

COMMENT ON FUNCTION public.ponto_fechar_competencia_verificar(uuid, uuid, text) IS
  'Portao do fechamento: aborta se houver pendencia critica (ajuste pendente de aprovacao / dia incompleto sem tratamento); devolve 0 quando pode fechar. A tela chama antes de concluir. PONTO-388.';

-- ---------------------------------------------------------------------------
-- CONFERENCIA — o SQL Editor mostra apenas o ultimo resultado.
-- Esperado: t | t | t | OK
--   lista_existe  : t  (ponto_fechamento_pendencias_criticas)
--   portao_existe : t  (ponto_fechar_competencia_verificar)
--   portao_checa  : t  (o portao verifica pendencia)
-- ---------------------------------------------------------------------------
WITH src AS (SELECT prosrc FROM pg_proc WHERE proname='ponto_fechar_competencia_verificar' LIMIT 1)
SELECT
  (to_regprocedure('public.ponto_fechamento_pendencias_criticas(uuid,uuid,text)') IS NOT NULL) AS lista_existe,
  (to_regprocedure('public.ponto_fechar_competencia_verificar(uuid,uuid,text)') IS NOT NULL)    AS portao_existe,
  ((SELECT prosrc FROM src) ILIKE '%pendencia%' OR (SELECT prosrc FROM src) ILIKE '%pendente%') AS portao_checa,
  CASE WHEN to_regprocedure('public.ponto_fechamento_pendencias_criticas(uuid,uuid,text)') IS NOT NULL
        AND to_regprocedure('public.ponto_fechar_competencia_verificar(uuid,uuid,text)') IS NOT NULL
        AND ((SELECT prosrc FROM src) ILIKE '%pendencia%' OR (SELECT prosrc FROM src) ILIKE '%pendente%')
       THEN 'OK' ELSE 'CONFERIR' END AS erro_tecnico;
