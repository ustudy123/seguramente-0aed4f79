-- =========================================================
-- QA — Detector de vazamento: cobrir a superficie nova (30/07/2026)
--
-- MOTIVO: as rotinas do modulo Empresa escrevem em duas tabelas que o
-- detector nao enxergava.
--
--   admissoes        — o PORTE-005 insere 5 registros por execucao.
--   documento_pastas — pior: a trigger auto_gerar_pastas_empresa dispara a
--                      CADA empresa criada. Uma bateria do modulo cria cerca
--                      de uma duzia de empresas, gerando dezenas de pastas
--                      que nenhuma rotina pede explicitamente.
--
-- O funil descarta tudo por subtransacao, entao na pratica nao havia
-- vazamento — as execucoes voltaram limpas. Mas o detector estava dando um
-- "limpo" mais estreito do que aparentava: ele confirmava tres tabelas e
-- calava sobre duas. Rede de seguranca que nao acompanha a superficie
-- coberta e a mesma classe de problema do ON CONFLICT sem indice unico e do
-- p_empresa ignorado na qa_obrigacao_existe — a trava existe, so nao alcanca
-- o que deveria.
--
-- As tres verificacoes originais seguem identicas. Nada foi removido.
-- =========================================================

CREATE OR REPLACE FUNCTION public.qa_verifica_vazamento()
RETURNS TABLE(o_que text, encontrado bigint, esperado bigint, veredito text)
LANGUAGE plpgsql
AS $$
DECLARE v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  RETURN QUERY
  SELECT 'pessoas no cercado'::text,
         (SELECT count(*) FROM public.usuarios_base WHERE tenant_id = v_t),
         0::bigint,
         CASE WHEN (SELECT count(*) FROM public.usuarios_base WHERE tenant_id = v_t) = 0
              THEN 'limpo' ELSE '>>> VAZOU — rotina deixou pessoa para tras' END;

  RETURN QUERY
  SELECT 'vinculos no cercado'::text,
         (SELECT count(*) FROM public.usuario_vinculos WHERE tenant_id = v_t),
         0::bigint,
         CASE WHEN (SELECT count(*) FROM public.usuario_vinculos WHERE tenant_id = v_t) = 0
              THEN 'limpo' ELSE '>>> VAZOU — rotina deixou vinculo para tras' END;

  RETURN QUERY
  SELECT 'empresas no cercado (mobiliario fixo)'::text,
         (SELECT count(*) FROM public.empresa_cadastro WHERE tenant_id = v_t),
         2::bigint,
         CASE WHEN (SELECT count(*) FROM public.empresa_cadastro WHERE tenant_id = v_t) = 2
              THEN 'ok' ELSE '>>> ALTERADO — alguma rotina criou ou apagou empresa' END;

  -- NOVO: admissoes. Nenhuma faz parte do mobiliario fixo, entao o esperado e zero.
  RETURN QUERY
  SELECT 'admissoes no cercado'::text,
         (SELECT count(*) FROM public.admissoes WHERE tenant_id = v_t),
         0::bigint,
         CASE WHEN (SELECT count(*) FROM public.admissoes WHERE tenant_id = v_t) = 0
              THEN 'limpo' ELSE '>>> VAZOU — rotina deixou admissao para tras' END;

  -- NOVO: pastas orfas ou de empresa transitoria.
  -- As pastas do mobiliario fixo ([QA] Alfa e [QA] Beta) sao legitimas e ficam
  -- de fora da conta. O que nao pode sobrar e pasta apontando para empresa que
  -- nao existe mais, ou pasta de empresa de teste ('[QA-XXX-000] ...').
  -- A convencao de nome ja separa as duas coisas: colchete-espaco e mobiliario
  -- fixo, colchete-hifen e descartavel.
  RETURN QUERY
  SELECT 'pastas de empresa descartavel'::text,
         (SELECT count(*) FROM public.documento_pastas p
           WHERE p.tenant_id = v_t
             AND (NOT EXISTS (SELECT 1 FROM public.empresa_cadastro e WHERE e.id = p.empresa_id)
                  OR EXISTS (SELECT 1 FROM public.empresa_cadastro e
                              WHERE e.id = p.empresa_id AND e.razao_social LIKE '[QA-%'))),
         0::bigint,
         CASE WHEN (SELECT count(*) FROM public.documento_pastas p
                     WHERE p.tenant_id = v_t
                       AND (NOT EXISTS (SELECT 1 FROM public.empresa_cadastro e WHERE e.id = p.empresa_id)
                            OR EXISTS (SELECT 1 FROM public.empresa_cadastro e
                                        WHERE e.id = p.empresa_id AND e.razao_social LIKE '[QA-%'))) = 0
              THEN 'limpo' ELSE '>>> VAZOU — sobrou pasta de empresa de teste' END;
END $$;

COMMENT ON FUNCTION public.qa_verifica_vazamento() IS
  'Roda depois da bateria. O cercado deve conter apenas o mobiliario fixo '
  '(2 empresas e as pastas delas) e mais nada. Cobre pessoas, vinculos, '
  'empresas, admissoes e pastas. Ao escrever rotina que toque tabela nova, '
  'estender esta funcao no mesmo movimento — rede que nao acompanha a '
  'superficie coberta da falsa seguranca.';

-- Conferencia imediata.
SELECT * FROM public.qa_verifica_vazamento();
