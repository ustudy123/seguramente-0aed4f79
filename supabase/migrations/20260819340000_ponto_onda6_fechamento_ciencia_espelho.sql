-- ============================================================================
-- ONDA 6 (parte 3) — Espelho sem ciência bloqueia o fechamento
-- PONTO-387
--
-- A tabela ponto_espelhos tem status, data_confirmacao e assinatura_hash, mas o
-- fechamento não os consulta: fecha com espelho ainda pendente de confirmação.
-- Espelho sem ciência do colaborador enfraquece a prova (Súmula 338 do TST).
--
-- O QUE FAZ (estende a parte 2): a lista de pendências críticas e o portão do
-- fechamento passam a considerar também o ESPELHO SEM CIÊNCIA — status ainda não
-- confirmado/assinado, sem data de confirmação e sem assinatura. Um espelho com
-- RESSALVA/justificativa formal registrada NÃO bloqueia (recusa formalizada).
--
-- GARANTIAS: só leitura + o guardião que aborta. Não altera o motor de saldo, o
-- espelho nem a transição de banco. CREATE OR REPLACE das duas funções da parte
-- 2 (aditivo). Idempotente.
-- ============================================================================

-- (1) Lista de pendências: + espelho sem ciência ------------------------------
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

  -- Dias INCOMPLETOS sem tratamento.
  RETURN QUERY
  SELECT 'dia_incompleto'::text, d.colaborador_cpf, d.data,
         format('Dia incompleto sem tratamento (status %s)', d.status)::text
  FROM public.ponto_diario d
  WHERE d.tenant_id = p_tenant_id
    AND d.data BETWEEN v_ini AND v_fim
    AND d.status IN ('incompleto', 'ajuste_pendente')
    AND (p_empresa_id IS NULL OR d.empresa_id = p_empresa_id);

  -- (387) Espelho SEM CIÊNCIA (Súmula 338): status ainda não confirmado/assinado,
  -- sem data_confirmacao e sem assinatura_hash. Espelho com RESSALVA formal
  -- registrada não bloqueia (a recusa está formalizada).
  RETURN QUERY
  SELECT 'espelho_sem_ciencia'::text, e.colaborador_cpf, NULL::date,
         format('Espelho sem ciencia do colaborador (status %s, sem confirmacao/assinatura)', COALESCE(e.status,'-'))::text
  FROM public.ponto_espelhos e
  WHERE e.tenant_id = p_tenant_id
    AND e.competencia = p_competencia
    AND (p_empresa_id IS NULL OR e.empresa_id = p_empresa_id)
    AND COALESCE(e.status, '') NOT IN ('confirmado', 'assinado')
    AND e.data_confirmacao IS NULL
    AND COALESCE(e.assinatura_hash, '') = ''
    AND NULLIF(btrim(COALESCE(e.ressalva_texto, '')), '') IS NULL;
END;
$$;

COMMENT ON FUNCTION public.ponto_fechamento_pendencias_criticas(uuid, uuid, text) IS
  'Lista as pendencias criticas que bloqueiam o fechamento: ajustes pendentes de aprovacao, dias incompletos sem tratamento e espelhos sem ciencia do colaborador (Sumula 338; ressalva formal nao bloqueia). Somente leitura. PONTO-388/387.';

-- (2) Portão do fechamento: + espelho sem ciência -----------------------------
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
  v_n        int;
  v_ajustes  int;
  v_dias     int;
  v_espelhos int;
BEGIN
  SELECT count(*),
         count(*) FILTER (WHERE tipo = 'ajuste_pendente'),
         count(*) FILTER (WHERE tipo = 'dia_incompleto'),
         count(*) FILTER (WHERE tipo = 'espelho_sem_ciencia')
    INTO v_n, v_ajustes, v_dias, v_espelhos
  FROM public.ponto_fechamento_pendencias_criticas(p_tenant_id, p_empresa_id, p_competencia);

  IF v_n > 0 THEN
    -- Bloqueia o fechamento: pendencia critica aberta. Inclui o ESPELHO sem
    -- ciencia — o fechamento confere status/confirmacao/assinatura dos espelhos
    -- (Sumula 338); espelho com ressalva formal nao bloqueia.
    RAISE EXCEPTION 'Fechamento bloqueado na competencia %: % pendencia(s) critica(s) — % ajuste(s) pendente(s) de aprovacao, % dia(s) incompleto(s) e % espelho(s) sem ciencia (status/confirmacao/assinatura). Trate antes de fechar.',
      p_competencia, v_n, v_ajustes, v_dias, v_espelhos
      USING ERRCODE = 'raise_exception';
  END IF;

  RETURN 0;  -- sem pendencias: pode fechar
END;
$$;

COMMENT ON FUNCTION public.ponto_fechar_competencia_verificar(uuid, uuid, text) IS
  'Portao do fechamento: aborta se houver pendencia critica — ajuste pendente, dia incompleto ou ESPELHO sem ciencia (confere status/confirmacao/assinatura, Sumula 338). Devolve 0 quando pode fechar. PONTO-388/387.';
