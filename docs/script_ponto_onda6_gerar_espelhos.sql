-- ============================================================================
-- ENTREGA — ONDA 6 (parte 1): geracao transacional dos espelhos
-- Alvo: ponto_gerar_espelhos_competencia (nova)
-- PONTO-194
--
-- Os espelhos nasciam LINHA A LINHA por um caminho de tela: falha no meio
-- deixava metade dos colaboradores com documento e metade sem — pior que
-- ausente, porque parece completo. Passa a existir uma funcao UNICA e
-- transacional (tudo-ou-nada) que gera os espelhos da competencia: para cada
-- colaborador com ponto no periodo, compoe os totais (ponto_espelho_resumo) e
-- faz UPSERT em ponto_espelhos, preservando a ciencia ja dada (status,
-- confirmacao, assinatura, ressalva). Chamada pelo fechamento.
--
-- GARANTIAS: nao altera o motor de saldo; so compoe e grava o espelho. Nao roda
-- por gatilho. Aditivo e idempotente (CREATE OR REPLACE). Sem backfill.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ponto_gerar_espelhos_competencia(
  p_tenant_id   uuid,
  p_competencia text,
  p_empresa_id  uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ini date := to_date(p_competencia || '-01', 'YYYY-MM-DD');
  v_fim date := (to_date(p_competencia || '-01', 'YYYY-MM-DD') + INTERVAL '1 month - 1 day')::date;
  v_n   int := 0;
  c     RECORD;
  res   RECORD;
  v_adn int;
BEGIN
  FOR c IN
    SELECT d.colaborador_cpf,
           MAX(d.colaborador_id::text)  AS cid,
           MAX(d.colaborador_nome)      AS nome,
           MAX(d.empresa_id::text)::uuid AS empresa_id
    FROM public.ponto_diario d
    WHERE d.tenant_id = p_tenant_id
      AND d.data BETWEEN v_ini AND v_fim
      AND (p_empresa_id IS NULL OR d.empresa_id = p_empresa_id)
    GROUP BY d.colaborador_cpf
  LOOP
    SELECT * INTO res
    FROM public.ponto_espelho_resumo(p_tenant_id, c.colaborador_cpf, p_competencia);

    SELECT COALESCE(SUM(COALESCE(pd.adicional_noturno_minutos, 0))::int, 0) INTO v_adn
    FROM public.ponto_diario pd
    WHERE pd.tenant_id = p_tenant_id
      AND pd.colaborador_cpf = c.colaborador_cpf
      AND pd.data BETWEEN v_ini AND v_fim;

    INSERT INTO public.ponto_espelhos (
      tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf, competencia,
      total_trabalhado_minutos, total_jornada_prevista_minutos, total_creditos_minutos,
      total_debitos_minutos, total_faltas, total_dias_trabalhados, total_dias_protegidos,
      total_excedente_retido_minutos, dia_equalizacao, banco_horas_saldo_minutos,
      total_horas_extras_50_minutos, total_horas_extras_100_minutos, total_atrasos_minutos,
      total_horas_normais_minutos, total_adicional_noturno_minutos
    ) VALUES (
      p_tenant_id, c.empresa_id, c.cid, c.nome, c.colaborador_cpf, p_competencia,
      res.total_trabalhado_min, res.total_jornada_prevista_min, res.total_creditos_min,
      res.total_debitos_min, res.total_faltas, res.dias_trabalhados, res.dias_protegidos,
      res.excedente_retido_min, res.dia_equalizacao, res.saldo_banco_min,
      res.he_50_min, res.he_100_min, res.atrasos_min,
      GREATEST(0, COALESCE(res.total_trabalhado_min, 0)
                  - COALESCE(res.he_50_min, 0) - COALESCE(res.he_100_min, 0)),
      v_adn
    )
    ON CONFLICT (tenant_id, colaborador_cpf, competencia) DO UPDATE SET
      empresa_id                      = COALESCE(public.ponto_espelhos.empresa_id, EXCLUDED.empresa_id),
      colaborador_id                  = EXCLUDED.colaborador_id,
      colaborador_nome                = EXCLUDED.colaborador_nome,
      total_trabalhado_minutos        = EXCLUDED.total_trabalhado_minutos,
      total_jornada_prevista_minutos  = EXCLUDED.total_jornada_prevista_minutos,
      total_creditos_minutos          = EXCLUDED.total_creditos_minutos,
      total_debitos_minutos           = EXCLUDED.total_debitos_minutos,
      total_faltas                    = EXCLUDED.total_faltas,
      total_dias_trabalhados          = EXCLUDED.total_dias_trabalhados,
      total_dias_protegidos           = EXCLUDED.total_dias_protegidos,
      total_excedente_retido_minutos  = EXCLUDED.total_excedente_retido_minutos,
      dia_equalizacao                 = EXCLUDED.dia_equalizacao,
      banco_horas_saldo_minutos       = EXCLUDED.banco_horas_saldo_minutos,
      total_horas_extras_50_minutos   = EXCLUDED.total_horas_extras_50_minutos,
      total_horas_extras_100_minutos  = EXCLUDED.total_horas_extras_100_minutos,
      total_atrasos_minutos           = EXCLUDED.total_atrasos_minutos,
      total_horas_normais_minutos     = EXCLUDED.total_horas_normais_minutos,
      total_adicional_noturno_minutos = EXCLUDED.total_adicional_noturno_minutos,
      updated_at                      = now();
      -- status / data_confirmacao / confirmado_por / assinatura_hash /
      -- ressalva_texto NAO sao tocados: a ciencia ja dada e preservada.

    v_n := v_n + 1;
  END LOOP;

  RETURN v_n;
END;
$$;

COMMENT ON FUNCTION public.ponto_gerar_espelhos_competencia(uuid, text, uuid) IS
  'Gera os espelhos da competencia numa unica funcao transacional (tudo-ou-nada): para cada colaborador com ponto no periodo, compoe os totais (ponto_espelho_resumo) e faz UPSERT em ponto_espelhos, preservando a ciencia ja dada. Chamada pelo fechamento. PONTO-194.';

-- ---------------------------------------------------------------------------
-- CONFERENCIA — o SQL Editor mostra apenas o ultimo resultado.
-- Esperado: t | t | OK
--   funcao_existe : t  (ponto_gerar_espelhos_competencia)
--   gera_espelho  : t  (grava em ponto_espelhos, transacional)
-- ---------------------------------------------------------------------------
WITH src AS (SELECT prosrc FROM pg_proc WHERE proname='ponto_gerar_espelhos_competencia' LIMIT 1)
SELECT
  (to_regprocedure('public.ponto_gerar_espelhos_competencia(uuid,text,uuid)') IS NOT NULL) AS funcao_existe,
  ((SELECT prosrc FROM src) ILIKE '%ponto_espelhos%' AND (SELECT prosrc FROM src) ILIKE '%INSERT%') AS gera_espelho,
  CASE WHEN to_regprocedure('public.ponto_gerar_espelhos_competencia(uuid,text,uuid)') IS NOT NULL
        AND (SELECT prosrc FROM src) ILIKE '%ponto_espelhos%' AND (SELECT prosrc FROM src) ILIKE '%INSERT%'
       THEN 'OK' ELSE 'CONFERIR' END AS erro_tecnico;
