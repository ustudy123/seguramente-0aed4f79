
-- =============================================
-- FASE B: Aplicar RLS com user_has_empresa_vinculo
-- em TODAS as tabelas restantes com empresa_id
-- =============================================

DO $$
DECLARE
  t TEXT;
  tables_to_protect TEXT[] := ARRAY[
    'avaliacao_ciclos',
    'beneficios_colaboradores',
    'cargos',
    'contratos_experiencia',
    'cultura_acoes',
    'cultura_config',
    'cultura_datas',
    'cultura_marcos',
    'cultura_rituais',
    'departamentos',
    'documento_pastas',
    'documentos',
    'empresa_experiencia_config',
    'epi_entregas',
    'ergonomia_acoes',
    'ergonomia_analises',
    'ergonomia_evidencias',
    'ergonomia_itens_nr17',
    'ergonomia_riscos',
    'esocial_certificados',
    'esocial_transmissoes',
    'estrategia_cultura',
    'estrategia_oceano_azul',
    'estrategia_organograma',
    'estrategia_swot',
    'feedbacks',
    'filiais',
    'folha_periodos',
    'gro_riscos',
    'hub_config',
    'hub_processos',
    'pdis',
    'perfil_excecoes',
    'permissoes_trabalho',
    'plano_acoes',
    'ponto_alertas',
    'ponto_banco_horas',
    'ponto_cct_config',
    'ponto_diario',
    'ponto_escalas',
    'ponto_espelhos',
    'ponto_exportacoes_folha',
    'ponto_fechamentos',
    'ponto_marcacoes',
    'ponto_repc_importacoes',
    'questionario_psicossocial_campanhas',
    'sst_documentos',
    'terceiros',
    'trilhas',
    'usuario_perfil_vinculos',
    'usuario_vinculos'
  ];
BEGIN
  FOREACH t IN ARRAY tables_to_protect
  LOOP
    -- Drop existing vinculo policies if they exist
    EXECUTE format('DROP POLICY IF EXISTS "select_%s_vinculo" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "insert_%s_vinculo" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "update_%s_vinculo" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "delete_%s_vinculo" ON public.%I', t, t);

    -- SELECT
    EXECUTE format($f$
      CREATE POLICY "select_%s_vinculo"
      ON public.%I FOR SELECT TO authenticated
      USING (
        tenant_id = public.get_user_tenant_id()
        AND public.user_has_empresa_vinculo(empresa_id)
      )
    $f$, t, t);

    -- INSERT
    EXECUTE format($f$
      CREATE POLICY "insert_%s_vinculo"
      ON public.%I FOR INSERT TO authenticated
      WITH CHECK (
        tenant_id = public.get_user_tenant_id()
        AND public.user_has_empresa_vinculo(empresa_id)
      )
    $f$, t, t);

    -- UPDATE
    EXECUTE format($f$
      CREATE POLICY "update_%s_vinculo"
      ON public.%I FOR UPDATE TO authenticated
      USING (
        tenant_id = public.get_user_tenant_id()
        AND public.user_has_empresa_vinculo(empresa_id)
      )
    $f$, t, t);

    -- DELETE
    EXECUTE format($f$
      CREATE POLICY "delete_%s_vinculo"
      ON public.%I FOR DELETE TO authenticated
      USING (
        tenant_id = public.get_user_tenant_id()
        AND public.user_has_empresa_vinculo(empresa_id)
      )
    $f$, t, t);
  END LOOP;
END $$;
