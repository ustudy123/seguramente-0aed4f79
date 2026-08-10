-- =====================================================================
-- PERFIL-004 passa a testar a população que EXISTE em produção
--
-- A bateria voltou 'nao_implementado' na PERFIL-004: nenhum usuário
-- tem vínculo de perfil ativo SEM o módulo de saúde amplo. É a foto
-- real da base hoje — quem tem perfil vinculado é gente de gestão, e
-- os colaboradores comuns estão SEM perfil nenhum (o "limbo" que o
-- perfil padrão automático só corrige para cadastros novos).
--
-- Ora, usuário sem vínculo é exatamente quem a função de permissão
-- também precisa negar — o "negado por padrão". Então a rotina agora
-- testa em dois estágios:
--
--   1º) usuário com vínculo ativo cujo perfil NÃO inclui saúde amplo
--       (o teste original — volta a valer sozinho no dia em que um
--       perfil restrito de verdade for vinculado);
--   2º) se não houver nenhum: usuário ativo comum SEM vínculo de
--       perfil — perfil_permite_modulo deve negar do mesmo jeito.
--
-- Só devolve 'nao_implementado' se a base inteira for administrador/
-- gestor — aí não há o que negar. O resultado diz qual variante rodou.
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

  -- 1º estágio: vínculo ativo cujo perfil não tem saúde em escopo amplo.
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

  -- 2º estágio: colaborador comum SEM vínculo de perfil — o "negado
  -- por padrão", que é a população real da base hoje.
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

  IF v_uid IS NULL THEN
    r.situacao := 'nao_implementado';
    r.obtido   := 'Não há usuário ativo sem acesso de gestão para simular: todos os candidatos são '
               || 'administradores, gestores ou têm papel de gestão. Nada a negar — nada a testar.';
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
      ELSE
        'Usuário sem vínculo de perfil negado para acesso amplo a atestados (negado por padrão), como devido. '
        || 'Quando houver usuário com perfil restrito vinculado, a rotina testa esse caso automaticamente.'
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

-- Registro do caso acompanha o comportamento novo -----------------------
UPDATE public.qa_casos_teste
SET objetivo = 'Teste funcional: simula (na transação, sem escrever nada) um usuário sem acesso amplo à saúde '
            || 'e verifica que perfil_permite_modulo nega. Prefere usuário com vínculo de perfil sem o módulo '
            || 'de saúde amplo; se não existir nenhum, usa colaborador comum sem vínculo de perfil (negado por padrão).',
    pre_condicoes = 'Existir ao menos um usuário ativo que não seja administrador/gestor nem tenha papel de gestão.',
    passos = '[{"ordem":1,"acao":"Escolher usuário: com perfil restrito; na falta, sem vínculo de perfil","resultado_esperado":"Um usuário simulável encontrado"},{"ordem":2,"acao":"Simular claims e avaliar perfil_permite_modulo(tenant, atestados)","resultado_esperado":"false"}]'::jsonb
WHERE codigo = 'PERFIL-004';
