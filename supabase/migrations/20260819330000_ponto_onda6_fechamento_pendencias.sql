-- ============================================================================
-- ONDA 6 (parte 2) — Pendência crítica bloqueia o fechamento
-- PONTO-388
--
-- Hoje o fechamento não verifica pendências: com ajuste pendente de aprovação
-- ou dia incompleto sem tratamento, a competência fecha por cima e manda o dado
-- errado para a folha — e depois de fechada não se mexe (PONTO-193). Falta a
-- lista de pendências críticas bloqueantes.
--
-- O QUE FAZ (aditivo)
--   (1) ponto_fechamento_pendencias_criticas(tenant, empresa, competencia):
--       lista as pendências que impedem fechar — ajustes PENDENTES de aprovação
--       e dias INCOMPLETOS sem tratamento na competência. Somente leitura.
--   (2) ponto_fechar_competencia_verificar(tenant, empresa, competencia): o
--       PORTÃO do fechamento — se houver qualquer pendência crítica, aborta com
--       a lista; sem pendências, devolve 0 (pode fechar). A tela chama este
--       portão antes de concluir o fechamento.
--
-- GARANTIAS: só leitura + um guardião que aborta quando não pode fechar. Não
-- altera o motor de saldo, o espelho nem a transição de banco. Não roda por
-- gatilho. Aditivo e idempotente.
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
