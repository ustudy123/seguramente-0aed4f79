-- =========================================================
-- HARDENING: Revoga EXECUTE de SECURITY DEFINER públicas
-- e regranta apenas para a whitelist usada pelo app/RLS
-- =========================================================

-- 1) REVOKE EXECUTE em todas as funções SECURITY DEFINER do schema public
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END $$;

-- 2) GRANT EXECUTE para AUTHENTICATED (whitelist: helpers RLS + RPCs do app)
DO $$
DECLARE
  fn text;
  r record;
  auth_whitelist text[] := ARRAY[
    -- Helpers usados em policies RLS (CRÍTICOS)
    'has_role','has_minimum_role','get_user_tenant_id','get_current_user_tipo',
    'get_auth_user_email','user_has_empresa_vinculo','user_can_access_storage_object',
    'is_superadmin',
    -- RPCs chamadas pelo frontend/edge functions
    'buscar_profissionais_proximos','colaborador_tem_vinculos','contar_colaboradores_por_empresa',
    'delete_empresa_segura','enqueue_email','epi_atualizar_estoque_local_otimista',
    'epi_atualizar_estoque_otimista','excluir_colaborador_seguro','inativar_colaborador',
    'clone_perfil_permissoes',
    -- Superadmin
    'superadmin_global_stats','superadmin_growth_series','superadmin_psicossocial_overview',
    'superadmin_tenants_list','superadmin_tenants_status','superadmin_usuarios_global',
    -- Estrutura
    'gerar_estrutura_padrao_pastas',
    -- Token-based (também precisam para usuário autenticado que abre o link logado)
    'assinar_contrato_por_token','assinar_manual_funcao_publica','assinar_ordem_servico_publica',
    'atualizar_cliente_por_onboarding_token','atualizar_convite_por_token',
    'atualizar_documento_link_por_token','buscar_campanha_por_token_publico',
    'buscar_cliente_por_activation_token','buscar_cliente_por_onboarding_token',
    'buscar_contrato_por_token','buscar_contratos_por_cliente','buscar_convite_por_token',
    'buscar_doc_links_por_cliente','buscar_documento_link_por_token',
    'buscar_experiencia_assinatura_link','buscar_ponto_link_por_token',
    'finalizar_admissao_by_token','get_admissao_by_token','get_admissao_documentos_by_token',
    'obter_assinatura_manual_publica','obter_ordem_servico_publica',
    'proximo_tipo_marcacao_externo','registrar_ponto_externo',
    'salvar_resposta_anonima_campanha','salvar_resposta_por_token_participacao',
    'salvar_resposta_psicossocial','solicitar_ajuste_ponto_externo',
    'update_admissao_documento_by_token','update_admissao_foto_by_token',
    'validar_cpf_colaborador_campanha','validar_token_participacao'
  ];
BEGIN
  FOREACH fn IN ARRAY auth_whitelist LOOP
    FOR r IN
      SELECT p.oid::regprocedure AS sig
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn
    LOOP
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    END LOOP;
  END LOOP;
END $$;

-- 3) GRANT EXECUTE para ANON (apenas funções de páginas públicas com token)
DO $$
DECLARE
  fn text;
  r record;
  anon_whitelist text[] := ARRAY[
    'assinar_contrato_por_token','assinar_manual_funcao_publica','assinar_ordem_servico_publica',
    'atualizar_cliente_por_onboarding_token','atualizar_convite_por_token',
    'atualizar_documento_link_por_token','buscar_campanha_por_token_publico',
    'buscar_cliente_por_activation_token','buscar_cliente_por_onboarding_token',
    'buscar_contrato_por_token','buscar_convite_por_token','buscar_documento_link_por_token',
    'buscar_experiencia_assinatura_link','buscar_ponto_link_por_token',
    'finalizar_admissao_by_token','get_admissao_by_token','get_admissao_documentos_by_token',
    'obter_assinatura_manual_publica','obter_ordem_servico_publica',
    'proximo_tipo_marcacao_externo','registrar_ponto_externo',
    'salvar_resposta_anonima_campanha','salvar_resposta_por_token_participacao',
    'salvar_resposta_psicossocial','solicitar_ajuste_ponto_externo',
    'update_admissao_documento_by_token','update_admissao_foto_by_token',
    'validar_cpf_colaborador_campanha','validar_token_participacao'
  ];
BEGIN
  FOREACH fn IN ARRAY anon_whitelist LOOP
    FOR r IN
      SELECT p.oid::regprocedure AS sig
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn
    LOOP
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', r.sig);
    END LOOP;
  END LOOP;
END $$;