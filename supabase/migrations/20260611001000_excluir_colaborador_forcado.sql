-- =========================================================
-- FEAT: exclusão FORÇADA de colaborador (com vínculos)
--
-- Para colaboradores de teste com histórico: apaga os registros
-- vinculados em todos os módulos e depois a admissão.
--
-- Salvaguardas:
-- • Restrita a papéis altos (proprietário/administrador/
--   superadmin) — gestor comum continua só com Inativar
-- • Confirmação reforçada no front (digitar "EXCLUIR TUDO")
-- • Retorna o resumo do que foi apagado por módulo
-- • Casts ::text aplicados nas tabelas de coluna TEXT
--   (mesmo mapeamento do fix da verificação de vínculos)
-- =========================================================

CREATE OR REPLACE FUNCTION public.excluir_colaborador_forcado(_admissao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tenant uuid;
  v_cpf text;
  v_nome text;
  v_is_admin boolean := false;
  v_removidos jsonb := '{}'::jsonb;
  v_count int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT tenant_id, cpf, nome_completo INTO v_tenant, v_cpf, v_nome
  FROM public.admissoes WHERE id = _admissao_id;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Colaborador não encontrado';
  END IF;

  IF NOT public.has_tenant_access(v_tenant) THEN
    RAISE EXCEPTION 'Sem permissão para este tenant';
  END IF;

  -- Papel alto obrigatório para apagar histórico
  v_is_admin :=
    public.has_role(v_uid, 'owner'::public.app_role)
    OR public.has_role(v_uid, 'admin'::public.app_role)
    OR public.is_superadmin(v_uid)
    OR EXISTS (
      SELECT 1 FROM public.usuarios_base ub
      WHERE ub.auth_user_id = v_uid
        AND ub.tipo_usuario = 'administrador'::public.usuario_tipo
    );
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Apenas proprietário/administrador pode excluir colaborador com histórico. Use Inativar.';
  END IF;

  -- ── Ponto (libera a trava de delete das marcações) ──
  PERFORM set_config('app.allow_ponto_delete', 'true', true);
  DELETE FROM public.ponto_marcacoes
   WHERE tenant_id = v_tenant AND (colaborador_id = _admissao_id OR colaborador_cpf = v_cpf);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN v_removidos := v_removidos || jsonb_build_object('ponto_marcacoes', v_count); END IF;
  PERFORM set_config('app.allow_ponto_delete', 'false', true);

  DELETE FROM public.ponto_diario
   WHERE tenant_id = v_tenant AND (colaborador_id = _admissao_id OR colaborador_cpf = v_cpf);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN v_removidos := v_removidos || jsonb_build_object('ponto_diario', v_count); END IF;

  DELETE FROM public.ponto_ajustes
   WHERE tenant_id = v_tenant AND (colaborador_id = _admissao_id OR colaborador_cpf = v_cpf);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN v_removidos := v_removidos || jsonb_build_object('ponto_ajustes', v_count); END IF;

  -- ── Demais módulos (coluna UUID) ──
  DELETE FROM public.ferias_solicitacoes WHERE colaborador_id = _admissao_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN v_removidos := v_removidos || jsonb_build_object('ferias', v_count); END IF;

  DELETE FROM public.atestados WHERE colaborador_id = _admissao_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN v_removidos := v_removidos || jsonb_build_object('atestados', v_count); END IF;

  DELETE FROM public.afastamentos WHERE colaborador_id = _admissao_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN v_removidos := v_removidos || jsonb_build_object('afastamentos', v_count); END IF;

  DELETE FROM public.ordens_servico WHERE colaborador_id = _admissao_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN v_removidos := v_removidos || jsonb_build_object('ordens_servico', v_count); END IF;

  -- ── Demais módulos (coluna TEXT → cast) ──
  DELETE FROM public.folha_itens WHERE colaborador_id = _admissao_id::text;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN v_removidos := v_removidos || jsonb_build_object('folha', v_count); END IF;

  DELETE FROM public.folha_rescisoes
   WHERE colaborador_id = _admissao_id::text OR admissao_id = _admissao_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN v_removidos := v_removidos || jsonb_build_object('rescisoes', v_count); END IF;

  DELETE FROM public.eventos_sst WHERE colaborador_id = _admissao_id::text;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN v_removidos := v_removidos || jsonb_build_object('eventos_sst', v_count); END IF;

  DELETE FROM public.pdis WHERE colaborador_id = _admissao_id::text;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN v_removidos := v_removidos || jsonb_build_object('pdis', v_count); END IF;

  DELETE FROM public.metas WHERE colaborador_id = _admissao_id::text;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN v_removidos := v_removidos || jsonb_build_object('metas', v_count); END IF;

  DELETE FROM public.feedbacks WHERE colaborador_id = _admissao_id::text;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN v_removidos := v_removidos || jsonb_build_object('feedbacks', v_count); END IF;

  DELETE FROM public.ocorrencias WHERE colaborador_id = _admissao_id::text;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN v_removidos := v_removidos || jsonb_build_object('ocorrencias', v_count); END IF;

  DELETE FROM public.avaliacao_9box WHERE colaborador_id = _admissao_id::text;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN v_removidos := v_removidos || jsonb_build_object('avaliacoes', v_count); END IF;

  DELETE FROM public.holerite_assinaturas WHERE colaborador_id = _admissao_id::text;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN v_removidos := v_removidos || jsonb_build_object('holerites', v_count); END IF;

  DELETE FROM public.beneficios_colaboradores WHERE colaborador_id = _admissao_id::text;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN v_removidos := v_removidos || jsonb_build_object('beneficios', v_count); END IF;

  -- ── Documentos sincronizados do módulo Documentos (critério estrito) ──
  DELETE FROM public.documentos
   WHERE tenant_id = v_tenant AND colaborador_cpf = v_cpf AND observacoes = 'Documento da admissão';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN v_removidos := v_removidos || jsonb_build_object('documentos', v_count); END IF;

  -- ── Fluxo de admissão ──
  DELETE FROM public.admissao_documentos WHERE admissao_id = _admissao_id;
  DELETE FROM public.admissao_workflow WHERE admissao_id = _admissao_id;
  DELETE FROM public.admissao_historico WHERE admissao_id = _admissao_id;
  DELETE FROM public.contratos_experiencia WHERE admissao_id = _admissao_id;
  DELETE FROM public.onboarding_processos WHERE admissao_id = _admissao_id;

  DELETE FROM public.admissoes WHERE id = _admissao_id;

  RETURN jsonb_build_object('ok', true, 'colaborador', v_nome, 'removidos', v_removidos);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.excluir_colaborador_forcado(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.excluir_colaborador_forcado(uuid) TO authenticated;
