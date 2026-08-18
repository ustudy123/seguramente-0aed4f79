-- ============================================================================
-- PREENCHIMENTO HISTÓRICO DO NSR — PONTO-210
-- Rode DEPOIS de docs/script_ponto_onda1_nsr_e_lotacao.sql.
-- Serve tanto para o banco de TESTE quanto para o de PRODUÇÃO.
--
-- POR QUE ESTE SCRIPT É SEPARADO
--   Toda alteração em ponto_marcacoes dispara o gatilho de auditoria, que
--   grava uma linha com o JSON inteiro do antes e do depois. Preencher a
--   tabela toda de uma vez, dentro da entrega, inflaria a trilha de
--   auditoria sem ninguém acompanhando e correria risco de estourar o
--   tempo de execução. Aqui você controla o ritmo e enxerga o progresso.
--
-- COMO USAR
--   1. Rode a CONFERÊNCIA (final do arquivo) sozinha primeiro, para saber
--      quantas marcações estão sem NSR e dimensionar o trabalho.
--   2. Rode o script inteiro quantas vezes forem necessárias. Cada
--      execução preenche até 20.000 marcações e informa quanto sobrou.
--   3. Repita até "faltam: 0".
--
--   É seguro parar no meio e retomar depois: só toca em linhas sem NSR.
--
-- ORDEM DA NUMERAÇÃO
--   Por (tenant, empresa), na ordem em que as marcações foram gravadas
--   (created_at e, em empate, o id). O NSR histórico entra ANTES dos que
--   já foram distribuídos às marcações novas: as antigas recebem números
--   abaixo do contador atual, que é remontado ao final de cada lote.
-- ============================================================================

DO $backfill$
DECLARE
  v_lote      int := 20000;
  v_afetadas  int;
  v_restantes bigint;
BEGIN
  -- Numera o lote dentro de cada balde, continuando de onde parou.
  WITH alvo AS (
    SELECT m.id,
           m.tenant_id,
           COALESCE(m.empresa_id, '00000000-0000-0000-0000-000000000000'::uuid) AS balde,
           row_number() OVER (
             PARTITION BY m.tenant_id,
                          COALESCE(m.empresa_id, '00000000-0000-0000-0000-000000000000'::uuid)
             ORDER BY m.created_at, m.id
           ) AS ordem
    FROM public.ponto_marcacoes m
    WHERE m.nsr IS NULL
      AND m.tenant_id IS NOT NULL
      -- Marcacao apontando para tenant que nao existe mais fica de fora: o
      -- gatilho de auditoria tem chave estrangeira para tenants e abortaria
      -- o lote inteiro por causa dela. Sao contadas na conferencia.
      AND EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = m.tenant_id)
    ORDER BY m.created_at, m.id
    LIMIT v_lote
  ),
  base AS (
    SELECT a.tenant_id, a.balde, COALESCE(c.ultimo_nsr, 0) AS inicio
    FROM (SELECT DISTINCT tenant_id, balde FROM alvo) a
    LEFT JOIN public.ponto_nsr_controle c
      ON c.tenant_id = a.tenant_id AND c.empresa_id = a.balde
  )
  UPDATE public.ponto_marcacoes m
     SET nsr = b.inicio + a.ordem
    FROM alvo a
    JOIN base b ON b.tenant_id = a.tenant_id AND b.balde = a.balde
   WHERE m.id = a.id;

  GET DIAGNOSTICS v_afetadas = ROW_COUNT;

  -- Recoloca o contador acima do maior NSR de cada balde tocado.
  INSERT INTO public.ponto_nsr_controle (tenant_id, empresa_id, ultimo_nsr, updated_at)
  SELECT m.tenant_id,
         COALESCE(m.empresa_id, '00000000-0000-0000-0000-000000000000'::uuid),
         max(m.nsr),
         now()
  FROM public.ponto_marcacoes m
  WHERE m.nsr IS NOT NULL AND m.tenant_id IS NOT NULL
  GROUP BY 1, 2
  ON CONFLICT (tenant_id, empresa_id) DO UPDATE
    SET ultimo_nsr = GREATEST(public.ponto_nsr_controle.ultimo_nsr, EXCLUDED.ultimo_nsr),
        updated_at = now();

  SELECT count(*) INTO v_restantes
  FROM public.ponto_marcacoes m
  WHERE m.nsr IS NULL AND m.tenant_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = m.tenant_id);

  RAISE NOTICE 'Lote concluido: % marcacao(oes) numerada(s). Faltam: %.', v_afetadas, v_restantes;

  IF v_restantes > 0 THEN
    RAISE NOTICE 'Rode este script novamente para continuar.';
  ELSE
    RAISE NOTICE 'Preenchimento historico concluido.';
  END IF;
END $backfill$;

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA — o SQL Editor mostra apenas o último resultado.
-- "orfas_sem_tenant" conta marcações que apontam para um tenant que não
-- existe mais. Elas ficam de fora do preenchimento de propósito e merecem
-- investigação à parte: são registros de jornada sem empregador conhecido.
-- Repita o script enquanto "faltam_nsr" for maior que zero.
-- "nsr_repetido" e "contador_atrasado" devem ser sempre 0.
-- ---------------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM public.ponto_marcacoes m
    WHERE m.nsr IS NULL AND m.tenant_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = m.tenant_id))
                                                                       AS faltam_nsr,

  (SELECT count(*) FROM public.ponto_marcacoes m
    WHERE m.tenant_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = m.tenant_id))
                                                                       AS orfas_sem_tenant,

  (SELECT count(*) FROM public.ponto_marcacoes
    WHERE nsr IS NOT NULL AND tenant_id IS NOT NULL)                   AS com_nsr,

  (SELECT count(*) FROM (
      SELECT tenant_id, COALESCE(empresa_id, '00000000-0000-0000-0000-000000000000'::uuid) AS balde, nsr
      FROM public.ponto_marcacoes
      WHERE nsr IS NOT NULL AND tenant_id IS NOT NULL
      GROUP BY 1, 2, 3 HAVING count(*) > 1
   ) d)                                                                AS nsr_repetido,

  (SELECT count(*) FROM (
      SELECT m.tenant_id,
             COALESCE(m.empresa_id, '00000000-0000-0000-0000-000000000000'::uuid) AS balde,
             max(m.nsr) AS maior
      FROM public.ponto_marcacoes m
      WHERE m.nsr IS NOT NULL AND m.tenant_id IS NOT NULL
      GROUP BY 1, 2
   ) x
   LEFT JOIN public.ponto_nsr_controle c
     ON c.tenant_id = x.tenant_id AND c.empresa_id = x.balde
   WHERE COALESCE(c.ultimo_nsr, 0) < x.maior)                          AS contador_atrasado,

  CASE
    WHEN (SELECT count(*) FROM (
            SELECT tenant_id, COALESCE(empresa_id, '00000000-0000-0000-0000-000000000000'::uuid) AS b, nsr
            FROM public.ponto_marcacoes WHERE nsr IS NOT NULL AND tenant_id IS NOT NULL
            GROUP BY 1, 2, 3 HAVING count(*) > 1) d) > 0
      THEN 'ERRO: existe NSR repetido dentro de um estabelecimento'
    WHEN (SELECT count(*) FROM public.ponto_marcacoes m
           WHERE m.nsr IS NULL AND m.tenant_id IS NOT NULL
             AND EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = m.tenant_id)) > 0
      THEN 'PARCIAL: rode o script novamente'
    WHEN (SELECT count(*) FROM public.ponto_marcacoes m
           WHERE m.tenant_id IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = m.tenant_id)) > 0
      THEN 'OK, com ressalva: ha marcacoes apontando para tenant inexistente (coluna orfas_sem_tenant). Ficaram sem NSR de proposito — investigar a origem delas.'
    ELSE 'OK'
  END                                                                  AS erro_tecnico;
