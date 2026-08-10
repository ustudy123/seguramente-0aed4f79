-- =====================================================================
-- PERFIL-004: terceiro estágio — o colaborador de convite pendente
--
-- O raio-X da base (10/08) fechou o diagnóstico do nao_implementado:
-- TODOS os 33 usuários ativos com login são administradores ou
-- gestores. Os colaboradores comuns existem, mas estão nos 33
-- convites pendentes (e 1 rascunho) — contas criadas que ninguém
-- ativou ainda. Não há papéis inflados; há uma base onde só a gestão
-- ativou o acesso.
--
-- Só que o convite pendente é um usuário REAL, e a função de
-- permissão já precisa negá-lo hoje — se um dia ele ativar a conta,
-- a resposta tem que ser a mesma. Então a rotina ganha um terceiro
-- estágio de busca:
--
--   1º) usuário ATIVO com perfil vinculado sem saúde em escopo amplo;
--   2º) usuário ATIVO comum sem vínculo de perfil;
--   3º) colaborador com convite pendente/rascunho, sem vínculo —
--       a população real de colaboradores da base hoje.
--
-- Com isso a PERFIL-004 sai do nao_implementado e passa a vigiar de
-- verdade — e migra sozinha para os estágios 1/2 conforme a base
-- evoluir. nao_implementado fica reservado para base 100% gestão.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.qa_caso_perfil_004()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  c RECORD;
  v_uid uuid;
  v_tenant uuid;
  v_variante text;
  v_claims_antes text;
  v_amplo boolean;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'FUNCIONAL (somente leitura): simular usuário sem acesso amplo à saúde e avaliar a função de permissão';
  r.esperado    := 'perfil_permite_modulo(tenant, atestados) = false para o usuário simulado';

  -- 1º estágio: ATIVO com vínculo cujo perfil não tem saúde ampla.
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
    LIMIT 200
  LOOP
    IF NOT public.has_minimum_role(c.auth_user_id, 'manager'::public.app_role)
       AND NOT public.is_superadmin(c.auth_user_id) THEN
      v_uid := c.auth_user_id; v_tenant := c.tenant_id;
      v_variante := 'perfil_restrito';
      EXIT;
    END IF;
  END LOOP;

  -- 2º estágio: ATIVO comum sem vínculo de perfil (negado por padrão).
  IF v_uid IS NULL THEN
    FOR c IN
      SELECT ub.auth_user_id, ub.tenant_id
      FROM public.usuarios_base ub
      WHERE ub.auth_user_id IS NOT NULL
        AND COALESCE(ub.status::text, 'ativo') = 'ativo'
        AND COALESCE(ub.tipo_usuario::text, '') NOT IN ('administrador', 'gestor')
        AND NOT EXISTS (
          SELECT 1 FROM public.usuario_perfil_vinculos v
          WHERE v.usuario_id = ub.id AND COALESCE(v.ativo, true) = true
        )
      LIMIT 200
    LOOP
      IF NOT public.has_minimum_role(c.auth_user_id, 'manager'::public.app_role)
         AND NOT public.is_superadmin(c.auth_user_id) THEN
        v_uid := c.auth_user_id; v_tenant := c.tenant_id;
        v_variante := 'sem_perfil';
        EXIT;
      END IF;
    END LOOP;
  END IF;

  -- 3º estágio: colaborador de convite pendente/rascunho, sem vínculo.
  -- É a população real de colaboradores hoje (raio-X de 10/08/2026):
  -- a conta existe e a função de permissão já precisa negá-la — quando
  -- a pessoa ativar, a resposta tem que ser a mesma.
  IF v_uid IS NULL THEN
    FOR c IN
      SELECT ub.auth_user_id, ub.tenant_id
      FROM public.usuarios_base ub
      WHERE ub.auth_user_id IS NOT NULL
        AND COALESCE(ub.status::text, 'ativo') <> 'ativo'
        AND COALESCE(ub.tipo_usuario::text, '') NOT IN ('administrador', 'gestor')
        AND NOT EXISTS (
          SELECT 1 FROM public.usuario_perfil_vinculos v
          WHERE v.usuario_id = ub.id AND COALESCE(v.ativo, true) = true
        )
      LIMIT 200
    LOOP
      IF NOT public.has_minimum_role(c.auth_user_id, 'manager'::public.app_role)
         AND NOT public.is_superadmin(c.auth_user_id) THEN
        v_uid := c.auth_user_id; v_tenant := c.tenant_id;
        v_variante := 'convite_pendente';
        EXIT;
      END IF;
    END LOOP;
  END IF;

  IF v_uid IS NULL THEN
    r.situacao := 'nao_implementado';
    r.obtido   := 'Não há usuário sem acesso de gestão para simular — em nenhum status. A base é '
               || '100% administradores/gestores/papéis de gestão. Nada a negar — nada a testar.';
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
    r.obtido   := CASE v_variante
      WHEN 'perfil_restrito' THEN
        'Usuário com perfil restrito (sem saúde em escopo amplo) negado para acesso amplo a atestados, como devido.'
      WHEN 'sem_perfil' THEN
        'Usuário ativo sem vínculo de perfil negado para acesso amplo a atestados (negado por padrão), como devido.'
      ELSE
        'Colaborador com convite pendente negado para acesso amplo a atestados, como devido. '
        || 'Quando colaboradores ativarem a conta (ou receberem perfil), a rotina passa a testá-los automaticamente.'
    END;
  ELSE
    r.situacao := 'falhou';
    r.obtido   := 'Um usuário que NÃO deveria ter acesso amplo a atestados obteve acesso pela função '
               || 'de permissão (variante: ' || v_variante || '). A camada restritiva está deixando passar.';
  END IF;
  r.detalhe := jsonb_build_object('variante', v_variante, 'auth_user_id', v_uid, 'tenant_id', v_tenant);
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- Registro do caso acompanha o comportamento -----------------------------
UPDATE public.qa_casos_teste
SET objetivo = 'Teste funcional: simula (na transação, sem escrever nada) um usuário sem acesso amplo à saúde '
            || 'e verifica que perfil_permite_modulo nega. Busca em três estágios: ativo com perfil restrito; '
            || 'ativo sem vínculo de perfil; colaborador com convite pendente sem vínculo.',
    pre_condicoes = 'Existir ao menos um usuário (em qualquer status) que não seja administrador/gestor nem tenha papel de gestão.'
WHERE codigo = 'PERFIL-004';
