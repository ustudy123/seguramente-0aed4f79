-- ============================================================================
-- YourEyes · Conferência: a homologação é mesmo cópia fiel da produção?
--
-- PARA QUE SERVE
--
-- A esteira `homologacao` copia a ESTRUTURA da produção para a homologação e,
-- no fim, imprime três números. Três números só querem dizer alguma coisa se
-- houver com o que comparar — e a comparação é o ponto: a homologação não
-- precisa estar "certa", precisa estar IGUAL à produção, defeitos e tudo.
--
-- COMO USAR
--
--   1. cole este arquivo no SQL Editor da PRODUÇÃO e guarde o resultado;
--   2. cole o MESMO arquivo no SQL Editor da HOMOLOGAÇÃO;
--   3. compare linha a linha. A coluna `quantidade` tem que bater em todas,
--      menos onde a própria tabela avisa que a diferença é esperada.
--
-- É SÓ LEITURA: nenhum INSERT, UPDATE, DELETE ou DDL. Rodar na produção é
-- seguro, e rodar duas vezes não muda nada.
--
-- O QUE NÃO É DIFERENÇA (não se assuste)
--
-- A esteira roda o pg_dump com --no-privileges e --no-owner, então as
-- PERMISSÕES (os GRANT para anon/authenticated, que é como as telas leem o
-- banco) NÃO são copiadas. A linha "permissoes de tela" existe para deixar
-- isso à vista: na produção ela vem alta, na homologação vem zero ou perto
-- disso. É esperado — e é também o motivo de a homologação, deste jeito,
-- servir para conferir se um SCRIPT APLICA, não para navegar nas telas.
-- ============================================================================

WITH numeros AS MATERIALIZED (
  SELECT 1 AS ordem, 'tabelas' AS item,
         count(*) AS quantidade,
         'as tabelas do schema public' AS o_que_e
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')

  UNION ALL
  SELECT 2, 'colunas', count(*),
         'soma das colunas de todas as tabelas — pega diferença fina'
    FROM information_schema.columns
   WHERE table_schema = 'public'

  UNION ALL
  SELECT 3, 'visoes', count(*),
         'views e views materializadas'
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind IN ('v', 'm')

  UNION ALL
  SELECT 4, 'funcoes', count(*),
         'funções e procedimentos, inclusive as rotinas de QA'
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'

  UNION ALL
  SELECT 5, 'politicas', count(*),
         'políticas de RLS — quem enxerga o quê'
    FROM pg_policies WHERE schemaname = 'public'

  UNION ALL
  SELECT 6, 'gatilhos', count(*),
         'triggers próprios (os internos de chave estrangeira não contam)'
    FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND NOT tg.tgisinternal

  UNION ALL
  SELECT 7, 'indices', count(*),
         'índices, inclusive os de chave primária e únicos'
    FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'

  UNION ALL
  SELECT 8, 'restricoes', count(*),
         'CHECK, chaves primárias, estrangeiras e únicas'
    FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
   WHERE n.nspname = 'public'

  UNION ALL
  SELECT 9, 'tipos_enum', count(*),
         'os ENUM do projeto (admissao_status, perfil_escopo_tipo, ...)'
    FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
   WHERE n.nspname = 'public' AND t.typtype = 'e'

  UNION ALL
  SELECT 10, 'valores_de_enum', count(*),
         'soma dos valores de todos os ENUM — pega valor faltando'
    FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
   WHERE n.nspname = 'public'

  UNION ALL
  -- Lido direto do catálogo, e não por information_schema: as visões do
  -- information_schema escondem permissões de papéis que o usuário atual não
  -- integra, e o número viria menor na produção só por causa de quem consulta.
  SELECT 11, 'permissoes de tela', count(*),
         'GRANT para anon/authenticated — NAO copiado pela esteira, ver cabecalho'
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL aclexplode(c.relacl) a
    JOIN pg_roles r ON r.oid = a.grantee
   WHERE n.nspname = 'public'
     AND c.relkind IN ('r', 'p', 'v', 'm')
     AND r.rolname IN ('anon', 'authenticated')
)
SELECT item, quantidade, o_que_e
  FROM numeros
 ORDER BY ordem;
