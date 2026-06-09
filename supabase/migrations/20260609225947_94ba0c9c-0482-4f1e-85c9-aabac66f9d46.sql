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
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO v_marc FROM public.ponto_marcacoes WHERE id = p_marcacao_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Marcação não encontrada';
  END IF;

  -- valida acesso ao tenant + papel via usuarios_base/has_role
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios_base ub
    WHERE ub.auth_user_id = v_uid
      AND ub.tenant_id = v_marc.tenant_id
      AND ub.status = 'ativo'
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Sem acesso a este tenant';
  END IF;

  IF NOT (
    public.has_role(v_uid, 'manager'::public.app_role)
    OR public.has_role(v_uid, 'admin'::public.app_role)
    OR public.has_role(v_uid, 'owner'::public.app_role)
    OR public.has_role(v_uid, 'superadmin'::public.app_role)
  ) THEN
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

  -- Reconsolida o dia
  PERFORM public.consolidar_ponto_diario_para(
    v_marc.tenant_id, v_marc.colaborador_cpf, v_marc.data_marcacao
  );

  RETURN jsonb_build_object('success', true);
END;
$function$;