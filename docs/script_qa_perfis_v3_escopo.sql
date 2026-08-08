-- =====================================================================
-- YourEyes — Correção URGENTE do escopo (enum) + conferência da bateria
--
-- COLE ESTE ARQUIVO INTEIRO no SQL Editor do Supabase e execute UMA vez.
-- Pode rodar de novo sem medo: ele é idempotente.
--
-- O que a coluna erro_tecnico revelou (obrigada, rotina):
--   invalid input value for enum perfil_escopo_tipo: "empresa"
--
-- A coluna "escopo" das permissões de perfil é um tipo fechado (enum)
-- cujos valores são 'proprio_usuario', 'empresa_inteira', etc. —
-- 'empresa' NÃO existe. A função perfil_permite_modulo e a rotina
-- PERFIL-004 usavam o literal 'empresa' numa comparação, e o banco
-- rejeita na hora de executar.
--
-- Efeito prático até este script ser aplicado: um colaborador comum
-- (sem papel de gestão) recebia ERRO ao consultar as tabelas
-- protegidas pela camada de perfil — inclusive os próprios atestados.
-- Administradores e gestores não sentiram nada, porque a função
-- responde antes de chegar na comparação quebrada.
--
-- A correção compara como TEXTO (escopo::text), que funciona igual
-- para qualquer tipo. A regra não muda: escopo diferente de
-- 'proprio_usuario' segue valendo como acesso amplo.
--
-- No final, a bateria roda de novo: a expectativa é 5 x passou.
-- =====================================================================

-- 1) perfil_permite_modulo SEM o literal inválido -----------------------
CREATE OR REPLACE FUNCTION public.perfil_permite_modulo(
  p_tenant_id uuid,
  VARIADIC p_modulos text[]
)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR p_tenant_id IS NULL THEN
    RETURN false;
  END IF;

  -- Quem já administra hoje continua administrando: superadmin, papel
  -- de gestor para cima, ou tipo administrador/gestor no cadastro.
  IF public.is_superadmin(v_uid)
     OR public.has_minimum_role(v_uid, 'manager'::public.app_role) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.usuarios_base ub
    WHERE ub.auth_user_id = v_uid
      AND ub.tenant_id = p_tenant_id
      AND ub.status::text = 'ativo'
      AND ub.tipo_usuario::text IN ('administrador', 'gestor')
  ) THEN
    RETURN true;
  END IF;

  -- Perfil vinculado com permissão AMPLA no módulo (mesmo critério do
  -- temAcessoModuloAdmin da tela: escopo diferente de proprio_usuario).
  -- escopo é enum: a comparação é feita como texto.
  RETURN EXISTS (
    SELECT 1
    FROM public.usuarios_base ub
    JOIN public.usuario_perfil_vinculos v
      ON v.usuario_id = ub.id
     AND v.tenant_id = ub.tenant_id
     AND COALESCE(v.ativo, true) = true
     AND (v.expira_em IS NULL OR v.expira_em > now())
    JOIN public.perfis_acesso pa
      ON pa.id = v.perfil_id
     AND COALESCE(pa.ativo, true) = true
     AND (pa.expira_em IS NULL OR pa.expira_em > now())
    JOIN public.perfil_permissoes pp
      ON pp.perfil_id = v.perfil_id
     AND COALESCE(pp.ativo, true) = true
     AND pp.modulo = ANY (p_modulos)
     AND COALESCE(pp.escopo::text, '') <> 'proprio_usuario'
    WHERE ub.auth_user_id = v_uid
      AND ub.tenant_id = p_tenant_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.perfil_permite_modulo(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.perfil_permite_modulo(uuid, text[]) TO authenticated;

COMMENT ON FUNCTION public.perfil_permite_modulo(uuid, text[]) IS
  'O perfil de acesso do usuário logado permite acesso amplo a algum destes módulos? Espelha o temAcessoModuloAdmin da interface. Superadmin, papel >= manager e tipo administrador/gestor têm acesso amplo por padrão.';

-- 2) PERFIL-004 SEM o literal inválido ----------------------------------
CREATE OR REPLACE FUNCTION public.qa_caso_perfil_004()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  c RECORD;
  v_uid uuid;
  v_tenant uuid;
  v_claims_antes text;
  v_amplo boolean;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'FUNCIONAL (somente leitura): simular usuário de perfil restrito e avaliar a função de permissão';
  r.esperado    := 'perfil_permite_modulo(tenant, atestados) = false para o usuário restrito';

  -- Até 25 candidatos pelos critérios baratos; o papel é conferido só
  -- aqui dentro, um a um, e paramos no primeiro que serve.
  FOR c IN
    SELECT ub.auth_user_id, ub.tenant_id
    FROM public.usuarios_base ub
    WHERE ub.auth_user_id IS NOT NULL
      AND COALESCE(ub.status::text, 'ativo') = 'ativo'
      AND COALESCE(ub.tipo_usuario::text, '') NOT IN ('administrador', 'gestor')
      AND EXISTS (
        SELECT 1 FROM public.usuario_perfil_vinculos v
        WHERE v.usuario_id = ub.id AND COALESCE(v.ativo, true) = true
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_perfil_vinculos v
        JOIN public.perfil_permissoes pp
          ON pp.perfil_id = v.perfil_id
         AND COALESCE(pp.ativo, true) = true
         AND pp.modulo IN ('atestados', 'sst')
         AND COALESCE(pp.escopo::text, '') <> 'proprio_usuario'
        WHERE v.usuario_id = ub.id AND COALESCE(v.ativo, true) = true
      )
    LIMIT 25
  LOOP
    IF NOT public.has_minimum_role(c.auth_user_id, 'manager'::public.app_role)
       AND NOT public.is_superadmin(c.auth_user_id) THEN
      v_uid := c.auth_user_id;
      v_tenant := c.tenant_id;
      EXIT;
    END IF;
  END LOOP;

  IF v_uid IS NULL THEN
    r.situacao := 'nao_implementado';
    r.obtido   := 'Nenhum usuário com perfil restrito (sem atestados amplo) encontrado entre os '
               || 'candidatos. Crie um perfil sem o módulo de saúde e vincule a um usuário de teste.';
    RETURN r;
  END IF;

  v_claims_antes := current_setting('request.jwt.claims', true);
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', v_uid, 'role', 'authenticated')::text,
                     true);

  BEGIN
    v_amplo := public.perfil_permite_modulo(v_tenant, 'atestados');
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claims', COALESCE(v_claims_antes, ''), true);
    RAISE;
  END;

  PERFORM set_config('request.jwt.claims', COALESCE(v_claims_antes, ''), true);

  IF v_amplo IS FALSE THEN
    r.situacao := 'passou';
    r.obtido   := 'Usuário de perfil restrito negado para acesso amplo a atestados, como devido.';
  ELSE
    r.situacao := 'falhou';
    r.obtido   := 'Um usuário cujo perfil NÃO inclui o módulo de atestados obteve acesso amplo '
               || 'pela função de permissão. A camada restritiva está deixando passar.';
    r.detalhe  := jsonb_build_object('auth_user_id', v_uid, 'tenant_id', v_tenant);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- 3) CONFERÊNCIA: RODA A BATERIA DE NOVO -------------------------------
-- Expectativa: as 5 linhas com situacao = passou.
SELECT caso,
       (r).situacao     AS situacao,
       (r).obtido       AS obtido,
       (r).erro_tecnico AS erro_tecnico
FROM (
  SELECT 'PERFIL-001' AS caso, public.qa_caso_perfil_001() AS r
  UNION ALL SELECT 'PERFIL-002', public.qa_caso_perfil_002()
  UNION ALL SELECT 'PERFIL-003', public.qa_caso_perfil_003()
  UNION ALL SELECT 'PERFIL-004', public.qa_caso_perfil_004()
  UNION ALL SELECT 'PERFIL-005', public.qa_caso_perfil_005()
) b
ORDER BY caso;
