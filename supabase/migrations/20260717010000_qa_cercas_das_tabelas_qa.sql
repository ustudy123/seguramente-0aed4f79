-- =========================================================
-- QA — cercas das próprias tabelas de QA
--
-- POR QUE ISTO EXISTE (três erros, dois meus):
--
--   1. qa_casos_teste: cerca LIGADA, ZERO regras. Isso nega para todo
--      mundo, inclusive para a tela /admin/qa/docs. Está assim desde
--      14/07. É o "furo 2" do meu próprio relatório de auditoria.
--
--   2. qa_modulos: cerca DESLIGADA. Qualquer usuário autenticado lê o mapa
--      dos módulos e o roadmap.
--
--   3. qa_execucoes, qa_resultados, qa_implementacoes, qa_tabelas_protegidas:
--      criadas por mim em 16/07 sem cerca nenhuma. Depois de eu ter
--      auditado o sistema e elogiado "287 de 287 tabelas protegidas".
--
-- E POR QUE A AUDITORIA NÃO PEGOU:
--   Ela filtrava tabelas com tenant_id. Nenhuma tabela de QA tem. As seis
--   ficaram fora do escopo inteiro, e o relatório entregue ao time diz
--   "0 tabelas com cerca ligada e nenhuma regra" sobre um universo
--   recortado sem aviso. O relatório precisa dessa nota.
--
-- O CONTEÚDO NÃO É INOFENSIVO:
--   qa_casos_teste.observacoes descreve, em português, as fragilidades
--   estruturais do sistema ("GAP ESTRUTURAL: nada impede a duplicata",
--   "a versão anterior estava ERRADA"). É um mapa das fraquezas. Tem que
--   ser superadmin.
--
--   qa_resultados.erro_tecnico guarda mensagem crua do Postgres, que
--   vaza nome de índice, constraint e estrutura interna.
--
-- REGRA ADOTADA: tudo de QA é superadmin. Não é dado de cliente, é
-- ferramenta interna. Ninguém além do dono do produto tem o que fazer aqui.
-- =========================================================

DO $cercas$
DECLARE
  t    text;
  tabs text[] := ARRAY[
    'qa_modulos', 'qa_casos_teste', 'qa_execucoes',
    'qa_resultados', 'qa_implementacoes', 'qa_tabelas_protegidas'
  ];
BEGIN
  IF to_regprocedure('public.is_superadmin(uuid)') IS NULL THEN
    RAISE EXCEPTION 'is_superadmin(uuid) nao existe. Sem ela nao da para escrever a regra.';
  END IF;

  FOREACH t IN ARRAY tabs LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'Pulando %: nao existe ainda.', t;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    -- Uma regra só, explícita, com nome que não mente sobre o que faz.
    EXECUTE format('DROP POLICY IF EXISTS "QA e ferramenta interna: apenas superadmin" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "QA e ferramenta interna: apenas superadmin"
         ON public.%I FOR ALL
         USING (public.is_superadmin(auth.uid()))
         WITH CHECK (public.is_superadmin(auth.uid()))', t);

    RAISE NOTICE 'Cerca fechada em public.% (apenas superadmin).', t;
  END LOOP;
END $cercas$;

-- ─────────────────────────────────────────────────────────
-- Conferência: nenhuma tabela de QA pode ficar sem cerca OU sem regra
-- ─────────────────────────────────────────────────────────
SELECT c.relname::text AS tabela,
       CASE WHEN NOT c.relrowsecurity THEN '>>> SEM CERCA'
            WHEN NOT EXISTS (SELECT 1 FROM pg_policies p
                             WHERE p.schemaname='public' AND p.tablename=c.relname)
                 THEN '>>> CERCA SEM REGRA (nega ate para voce)'
            ELSE 'ok — cerca + regra de superadmin' END AS situacao
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'qa\_%'
ORDER BY 2 DESC, 1;
