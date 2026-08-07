-- =====================================================================
-- Perfil de acesso passa a valer no banco — começando pelo dado sensível
--
-- Parecer de perfis de acesso (07/08/2026), ressalva central: das 400+
-- políticas de RLS, nenhuma consulta perfil_permissoes. O banco responde
-- "é do seu cliente?" e libera; não responde "seu perfil permite ver
-- isto?". Resultado: um colaborador com perfil restrito não vê o menu de
-- Saúde Ocupacional, mas os atestados e ASOs dos colegas continuam ao
-- alcance de uma requisição à API — dados de saúde, sensíveis pela LGPD,
-- protegidos apenas pela ausência de um botão na tela.
--
-- Este arquivo implementa a recomendação nº 1 do parecer, no escopo que
-- ele próprio sugere: NÃO reescreve as 400 políticas; acrescenta uma
-- camada RESTRITIVA de leitura apenas nas tabelas de maior risco.
-- Política restritiva soma por E às existentes: o que já era negado
-- continua negado; o que era permitido agora também exige o perfil.
--
-- A regra espelha a que a tela usa (usePerfilPermissions):
--   1. superadmin, papel >= manager, ou usuários de tipo administrador/
--      gestor: acesso amplo (é quem já gerencia esses dados hoje);
--   2. quem tem perfil vinculado: acesso amplo somente se o perfil tiver
--      permissão no módulo com escopo diferente de 'proprio_usuario' —
--      o mesmo critério do temAcessoModuloAdmin da tela;
--   3. qualquer colaborador continua vendo a PRÓPRIA linha (o próprio
--      atestado, o próprio documento): auto-serviço não quebra;
--   4. quem não tem perfil vinculado fica com o item 3 — que é
--      exatamente o que a tela mostra para ele hoje.
--
-- O teste decisivo do parecer passa a dar vazio: autenticar com perfil
-- restrito e pedir pela API os atestados dos colegas.
-- =====================================================================

-- 1) CPF DO USUÁRIO LOGADO --------------------------------------------
-- Fonte: usuarios_base (auth_user_id -> cpf), a mesma que vincula o
-- usuário ao colaborador no restante do sistema.
CREATE OR REPLACE FUNCTION public.cpf_do_usuario_logado()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT regexp_replace(COALESCE(ub.cpf, ''), '[^0-9]', '', 'g')
  FROM public.usuarios_base ub
  WHERE ub.auth_user_id = auth.uid()
    AND COALESCE(ub.cpf, '') <> ''
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.cpf_do_usuario_logado() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cpf_do_usuario_logado() TO authenticated;

-- 2) O PERFIL PERMITE O MÓDULO? ---------------------------------------
-- Aceita mais de um módulo porque algumas tabelas são alcançadas por
-- telas de módulos diferentes (ex.: documentos por configuracoes e por
-- colaboradores).
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
     AND COALESCE(pp.escopo, 'empresa') <> 'proprio_usuario'
    WHERE ub.auth_user_id = v_uid
      AND ub.tenant_id = p_tenant_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.perfil_permite_modulo(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.perfil_permite_modulo(uuid, text[]) TO authenticated;

COMMENT ON FUNCTION public.perfil_permite_modulo(uuid, text[]) IS
  'O perfil de acesso do usuário logado permite acesso amplo a algum destes módulos? Espelha o temAcessoModuloAdmin da interface. Superadmin, papel >= manager e tipo administrador/gestor têm acesso amplo por padrão.';

-- 3) CAMADA RESTRITIVA NAS TABELAS SENSÍVEIS ---------------------------
-- Uma por tabela, sempre FOR SELECT: a exposição apontada pelo parecer é
-- de leitura. Escrita segue com as políticas atuais (que já exigem
-- manager+ nas tabelas de saúde). Blocos independentes: a falha em uma
-- tabela não derruba as demais.
DO $rls$
DECLARE
  r RECORD;
  v_ok int := 0;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      -- (tabela, política, predicado)
      ('atestados', 'perfil_restringe_leitura_atestados',
       $p$public.perfil_permite_modulo(tenant_id, 'atestados', 'sst')
          OR regexp_replace(COALESCE(colaborador_cpf, ''), '[^0-9]', '', 'g')
             = public.cpf_do_usuario_logado()$p$),

      ('eventos_saude', 'perfil_restringe_leitura_eventos_saude',
       $p$public.perfil_permite_modulo(tenant_id, 'atestados', 'sst')
          OR regexp_replace(COALESCE(colaborador_cpf, ''), '[^0-9]', '', 'g')
             = public.cpf_do_usuario_logado()$p$),

      ('documentos', 'perfil_restringe_leitura_documentos',
       $p$public.perfil_permite_modulo(tenant_id, 'configuracoes', 'colaboradores')
          OR regexp_replace(COALESCE(colaborador_cpf, ''), '[^0-9]', '', 'g')
             = public.cpf_do_usuario_logado()$p$),

      ('admissao_documentos', 'perfil_restringe_leitura_admissao_documentos',
       $p$public.perfil_permite_modulo(tenant_id, 'admissoes', 'colaboradores')
          OR EXISTS (
               SELECT 1 FROM public.admissoes a
               WHERE a.id = admissao_id
                 AND regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g')
                     = public.cpf_do_usuario_logado())$p$),

      ('psicossocial_entrevistas', 'perfil_restringe_leitura_psico_entrevistas',
       $p$public.perfil_permite_modulo(tenant_id, 'psicossocial')
          OR EXISTS (
               SELECT 1 FROM public.admissoes a
               WHERE a.id = colaborador_id
                 AND regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g')
                     = public.cpf_do_usuario_logado())$p$),

      ('psicossocial_entrevistas_mensagens', 'perfil_restringe_leitura_psico_mensagens',
       $p$EXISTS (
            SELECT 1 FROM public.psicossocial_entrevistas e
            WHERE e.id = entrevista_id
              AND (public.perfil_permite_modulo(e.tenant_id, 'psicossocial')
                   OR EXISTS (
                        SELECT 1 FROM public.admissoes a
                        WHERE a.id = e.colaborador_id
                          AND regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g')
                              = public.cpf_do_usuario_logado())))$p$),

      ('psicossocial_alertas', 'perfil_restringe_leitura_psico_alertas',
       $p$public.perfil_permite_modulo(tenant_id, 'psicossocial')$p$)
    ) AS t(tabela, politica, predicado)
  LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.politica, r.tabela);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (%s)',
        r.politica, r.tabela, r.predicado);
      v_ok := v_ok + 1;
      RAISE NOTICE 'Camada de perfil aplicada em %.', r.tabela;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'ATENÇÃO: % ficou sem a camada de perfil: %', r.tabela, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '% tabela(s) sensível(is) com leitura condicionada ao perfil.', v_ok;
END $rls$;
