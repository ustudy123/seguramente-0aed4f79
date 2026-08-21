-- ============================================================================
-- YourEyes · PRODUÇÃO · Quais índices estão inválidos, e o que fazer com eles
--
-- DE ONDE VEIO ESTA PERGUNTA
--
-- A conferência entre produção e homologação (docs/script_conferencia_homologacao.sql)
-- bateu em dez das onze medidas. A única diferença foi em índices: 855 na
-- produção, 854 na homologação. Não é falha da cópia — o pg_dump não copia
-- índice INVÁLIDO (conferido: um índice marcado inválido não aparece no
-- retrato). A diferença é da produção.
--
-- O QUE É UM ÍNDICE INVÁLIDO
--
-- É o que sobra de um `CREATE INDEX CONCURRENTLY` que falhou no meio — ou de um
-- `REINDEX CONCURRENTLY` interrompido. Ele existe no catálogo, mas:
--
--   · o planejador NÃO o usa para consultar (não acelera nada);
--   · o banco CONTINUA atualizando a cada gravação (custa em toda escrita);
--   · se for UNIQUE, ele NÃO garante unicidade — e aí o custo vira risco:
--     a restrição que alguém acredita existir não está valendo.
--
-- Ou seja: paga-se o preço e não se recebe o benefício. O conserto é apagar e,
-- se o índice fizer falta, criar de novo.
--
-- É SÓ LEITURA. Este arquivo apenas diagnostica — ele MOSTRA o comando de
-- conserto na última coluna, mas não executa nada. Nada aqui altera a produção.
-- ============================================================================

SELECT
  t.relname                            AS tabela,
  c.relname                            AS indice,
  CASE WHEN i.indisunique THEN 'SIM — atenção: a unicidade NÃO está valendo'
       ELSE 'não' END                  AS e_unico,
  CASE WHEN i.indisready THEN 'sim (custa em toda gravação)'
       ELSE 'não' END                  AS acompanha_gravacoes,
  pg_size_pretty(pg_relation_size(c.oid)) AS espaco_ocupado,
  pg_get_indexdef(i.indexrelid)        AS definicao,
  format('DROP INDEX CONCURRENTLY IF EXISTS public.%I;', c.relname)
                                       AS comando_para_apagar
FROM pg_index i
JOIN pg_class c     ON c.oid = i.indexrelid
JOIN pg_class t     ON t.oid = i.indrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND NOT i.indisvalid
ORDER BY t.relname, c.relname;

-- ============================================================================
-- SE NÃO VOLTAR NENHUMA LINHA
--
-- Então a diferença de índices tem outra causa e precisa ser investigada — não
-- assuma que a cópia está fiel só porque as outras dez medidas bateram.
--
-- QUANDO FOR APAGAR (depois de decidir, e não por este arquivo)
--
-- Use `DROP INDEX CONCURRENTLY`, que não tranca a tabela — e ele NÃO pode rodar
-- dentro de transação. Como o SQL Editor executa o arquivo inteiro em UMA
-- transação, o comando da última coluna precisa ser colado SOZINHO, num editor
-- vazio, um índice de cada vez.
-- ============================================================================
