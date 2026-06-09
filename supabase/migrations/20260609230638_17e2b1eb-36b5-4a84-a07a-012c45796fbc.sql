CREATE OR REPLACE FUNCTION public.excluir_marcacao_ponto(p_marcacao_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_marc public.ponto_marcacoes%ROWTYPE;
  v_has_access boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO v_marc FROM public.ponto_marcacoes WHERE id = p_marcacao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Marcação não encontrada'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.usuarios_base ub
    WHERE ub.auth_user_id = v_uid AND ub.tenant_id = v_marc.tenant_id AND ub.status = 'ativo'
  ) INTO v_has_access;
  IF NOT v_has_access THEN RAISE EXCEPTION 'Sem acesso a este tenant'; END IF;

  IF NOT (
    public.has_role(v_uid, 'manager'::public.app_role)
    OR public.has_role(v_uid, 'admin'::public.app_role)
    OR public.has_role(v_uid, 'owner'::public.app_role)
    OR public.has_role(v_uid, 'superadmin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Apenas gestor/RH pode excluir marcações';
  END IF;

  INSERT INTO public.ponto_audit_log (
    tenant_id, tabela_origem, registro_id, acao, dados_anteriores, dados_novos, usuario_id
  ) VALUES (
    v_marc.tenant_id, 'ponto_marcacoes', v_marc.id, 'AJUSTE',
    to_jsonb(v_marc),
    jsonb_build_object('operacao','EXCLUSAO_GESTOR','motivo','Exclusão manual de marcação duplicada/incorreta'),
    v_uid
  );

  PERFORM set_config('app.allow_ponto_delete', 'true', true);
  DELETE FROM public.ponto_marcacoes WHERE id = p_marcacao_id;
  PERFORM set_config('app.allow_ponto_delete', 'false', true);

  PERFORM public.consolidar_ponto_diario_manual(
    v_marc.tenant_id,
    v_marc.colaborador_cpf,
    v_marc.data_marcacao
  );

  RETURN jsonb_build_object('success', true);
END;
$function$;