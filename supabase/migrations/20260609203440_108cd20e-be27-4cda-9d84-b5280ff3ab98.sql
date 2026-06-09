
-- Permite excluir marcação de ponto via RPC autorizado (gestor/RH)
CREATE OR REPLACE FUNCTION public.bloquear_delete_ponto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Permitir deletes em cascata acionados por outras triggers do sistema
  IF pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;

  -- Permitir quando RPC autorizado seta o flag de sessão
  IF current_setting('app.allow_ponto_delete', true) = 'true' THEN
    RETURN OLD;
  END IF;

  INSERT INTO public.ponto_audit_log (
    tenant_id, tabela_origem, registro_id, acao,
    dados_anteriores, usuario_id
  ) VALUES (
    OLD.tenant_id, TG_TABLE_NAME, OLD.id, 'TENTATIVA_DELETE',
    to_jsonb(OLD), auth.uid()
  );

  RAISE EXCEPTION 'Operação de exclusão não permitida para registros de ponto. Tentativa registrada.';
  RETURN NULL;
END;
$$;

-- RPC para gestor/RH excluir uma marcação duplicada/incorreta
CREATE OR REPLACE FUNCTION public.excluir_marcacao_ponto(p_marcacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_marc public.ponto_marcacoes%ROWTYPE;
  v_tenant uuid;
  v_role text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO v_marc FROM public.ponto_marcacoes WHERE id = p_marcacao_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Marcação não encontrada';
  END IF;

  -- valida tenant + papel mínimo (manager/admin/super_admin/owner)
  SELECT tenant_id, role::text INTO v_tenant, v_role
  FROM public.usuario_tenants
  WHERE user_id = v_uid AND tenant_id = v_marc.tenant_id AND ativo = true
  LIMIT 1;

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Sem acesso a este tenant';
  END IF;

  IF v_role NOT IN ('manager','admin','super_admin','owner','rh') THEN
    RAISE EXCEPTION 'Apenas gestor/RH pode excluir marcações';
  END IF;

  -- Audit log antes de deletar
  INSERT INTO public.ponto_audit_log (
    tenant_id, tabela_origem, registro_id, acao,
    dados_anteriores, usuario_id
  ) VALUES (
    v_marc.tenant_id, 'ponto_marcacoes', v_marc.id, 'EXCLUSAO_GESTOR',
    to_jsonb(v_marc), v_uid
  );

  -- Libera o trigger e deleta
  PERFORM set_config('app.allow_ponto_delete', 'true', true);
  DELETE FROM public.ponto_marcacoes WHERE id = p_marcacao_id;
  PERFORM set_config('app.allow_ponto_delete', 'false', true);

  -- Reconsolida o dia para recalcular jornada e status
  PERFORM public.consolidar_ponto_diario_para(
    v_marc.tenant_id, v_marc.colaborador_cpf, v_marc.data_marcacao
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.excluir_marcacao_ponto(uuid) TO authenticated;
