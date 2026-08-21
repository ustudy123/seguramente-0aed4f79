-- ============================================================================
-- Catálogo de colunas que alimenta o gerador da cópia mascarada.
--
-- Roda na PRODUÇÃO, e é SÓ LEITURA: consulta os catálogos do PostgreSQL, não
-- toca em nenhuma linha de dado. O que sai daqui é a descrição da estrutura —
-- nome de tabela, nome de coluna, tipo — nunca conteúdo.
--
-- Saída, um registro por linha, separado por barra vertical:
--
--   schema.tabela | coluna | tipo | tem_check_de_enum | e_lista_de_texto
--
-- POR QUE CADA CAMPO EXISTE
--
--   tipo               decide o tratamento: texto se mascara, data e número
--                      passam. jsonb e text[] são as exceções que quase
--                      escaparam — não são "texto", mas carregam texto livre.
--
--   tem_check_de_enum  um CHECK do tipo `IN (...)` prova que a coluna só
--                      aceita um conjunto fechado de valores. É enum escrito
--                      como texto ('aprovado', 'pendente'), e mascarar
--                      violaria o próprio CHECK.
--
--   e_lista_de_texto   separa text[] de uuid[] e integer[]. Só a lista de
--                      texto precisa ser esvaziada.
--
-- A ORDEM IMPORTA: as colunas saem na ordem em que existem na tabela, e é
-- nessa ordem que o COPY as espera do outro lado.
--
-- auth.users entra junto de propósito. Sem os usuários, 34 chaves
-- estrangeiras do schema public não teriam para onde apontar e a carga
-- inteira falharia — e, mesmo que carregasse, ninguém conseguiria entrar.
-- ============================================================================

-- quote_ident nos dois: nome de tabela ou schema que precise de aspas
-- entraria cru no COPY e quebraria o comando montado a partir daqui.
SELECT quote_ident(n.nspname) || '.' || quote_ident(c.relname)
       || '|' || a.attname
       || '|' || CASE
                   WHEN t.typtype = 'e' THEN 'USER-DEFINED'
                   WHEN format_type(a.atttypid, a.atttypmod) LIKE '%[]' THEN 'ARRAY'
                   ELSE format_type(a.atttypid, NULL)
                 END
       || '|' || CASE WHEN EXISTS (
                   SELECT 1
                     FROM pg_constraint k
                     JOIN unnest(k.conkey) u(attnum) ON true
                    WHERE k.conrelid = c.oid
                      AND k.contype = 'c'
                      AND u.attnum = a.attnum
                      AND pg_get_constraintdef(k.oid) ~* 'ANY \(ARRAY|IN \('
                 ) THEN 't' ELSE 'f' END
       || '|' || CASE WHEN format_type(a.atttypid, a.atttypmod)
                        IN ('text[]', 'character varying[]') THEN 't' ELSE 'f' END
  FROM pg_attribute a
  JOIN pg_class c     ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_type t      ON t.oid = a.atttypid
 WHERE a.attnum > 0
   AND NOT a.attisdropped
   -- Só tabelas comuns e particionadas. Visão não se copia: ela se recalcula
   -- a partir das tabelas, e copiar dados para dentro de uma nem é possível.
   AND c.relkind IN ('r', 'p')
   AND (
     n.nspname = 'public'
     OR (n.nspname = 'auth' AND c.relname = 'users')
   )
 ORDER BY n.nspname, c.relname, a.attnum;
