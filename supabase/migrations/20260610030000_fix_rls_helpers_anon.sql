-- =========================================================
-- FIX (YOUREYES-141): permission denied for function has_minimum_role
-- em páginas públicas (Finalizar Cadastro, links externos)
--
-- Causa: o hardening de 14/05 (20260514142705) revogou EXECUTE
-- de todas as funções SECURITY DEFINER e re-concedeu a whitelist
-- de helpers de RLS APENAS para `authenticated`. Porém, policies
-- de storage/tabelas que chamam esses helpers são avaliadas com o
-- papel do chamador — quando um anônimo (colaborador via link)
-- faz upload com upsert, a avaliação da policy chama
-- has_minimum_role() e explode com "permission denied",
-- derrubando o upload ("Erro ao carregar foto" / "Erro ao
-- enviar documento").
--
-- Correção: conceder EXECUTE dos helpers de RLS também ao anon.
-- É seguro — para anônimos auth.uid() é NULL e os helpers
-- retornam false/null, que é o comportamento esperado das
-- policies. Nenhum dado novo fica acessível; apenas a avaliação
-- das policies volta a funcionar sem erro.
-- =========================================================

DO $$
DECLARE
  fn text;
  r record;
  rls_helpers text[] := ARRAY[
    'has_role',
    'has_minimum_role',
    'get_user_tenant_id',
    'get_current_user_tipo',
    'get_auth_user_email',
    'user_has_empresa_vinculo',
    'user_can_access_storage_object',
    'is_superadmin'
  ];
BEGIN
  FOREACH fn IN ARRAY rls_helpers LOOP
    FOR r IN
      SELECT p.oid::regprocedure AS sig
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn
    LOOP
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', r.sig);
    END LOOP;
  END LOOP;
END $$;
