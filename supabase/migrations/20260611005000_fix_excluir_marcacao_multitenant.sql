-- =========================================================
-- FIX: "Sem acesso a este tenant" ao excluir marcação no
-- espelho (gestores vinculados — caso Cacilda)
--
-- excluir_marcacao_ponto validava acesso APENAS por
-- usuarios_base com status 'ativo' (a Cacilda está como
-- 'convite_enviado' no tenant onde opera por vínculo).
-- Mesmo padrão já corrigido na aprovação de ajustes.
-- Também removia: has_role('superadmin') — valor inexistente
-- no enum app_role (explodiria após passar o acesso).
-- =========================================================

CREATE OR REPLACE FUNCTION public.excluir_marcacao_ponto(p_marcacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_marc public.ponto_marcacoes%ROWTYPE;
  v_has_access boolean := false;
  v_is_gestor boolean := false;
  v_vinculo_role text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO v_marc FROM public.ponto_marcacoes WHERE id = p_marcacao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Marcação não encontrada'; END IF;

  -- Via 1: cadastro ativo no tenant
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios_base ub
    WHERE ub.auth_user_id = v_uid AND ub.tenant_id = v_marc.tenant_id AND ub.status = 'ativo'
  ) INTO v_has_access;

  -- Via 2: vínculo multi-empresa ativo no tenant
  IF NOT v_has_access THEN
    SELECT uv.tipo_vinculo::text INTO v_vinculo_role
    FROM public.usuario_vinculos uv
    JOIN public.usuarios_base ub2 ON ub2.id = uv.usuario_id
    WHERE ub2.auth_user_id = v_uid
      AND uv.tenant_id = v_marc.tenant_id
      AND uv.status = 'ativo'
      AND (uv.data_fim IS NULL OR uv.data_fim >= CURRENT_DATE)
    LIMIT 1;
    IF v_vinculo_role IS NOT NULL THEN
      v_has_access := true;
      v_is_gestor := v_vinculo_role IN ('gestor','administrador','rh','rh_dp');
    END IF;
  END IF;

  -- Via 3: perfil no tenant (mesma base do RLS que exibe o espelho)
  IF NOT v_has_access THEN
    SELECT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = v_uid AND p.tenant_id = v_marc.tenant_id
    ) INTO v_has_access;
  END IF;

  IF NOT v_has_access THEN RAISE EXCEPTION 'Sem acesso a este tenant'; END IF;

  -- Papel mínimo: gestor/RH (pelo vínculo, papéis globais ou tipo)
  IF NOT v_is_gestor THEN
    v_is_gestor :=
      public.has_role(v_uid, 'manager'::public.app_role)
      OR public.has_role(v_uid, 'admin'::public.app_role)
      OR public.has_role(v_uid, 'owner'::public.app_role)
      OR public.is_superadmin(v_uid);
  END IF;

  IF NOT v_is_gestor THEN
    SELECT EXISTS (
      SELECT 1 FROM public.usuarios_base ub3
      WHERE ub3.auth_user_id = v_uid
        AND ub3.tipo_usuario IN ('gestor','administrador','rh_dp')
    ) INTO v_is_gestor;
  END IF;

  IF NOT v_is_gestor THEN
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

REVOKE EXECUTE ON FUNCTION public.excluir_marcacao_ponto(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.excluir_marcacao_ponto(uuid) TO authenticated;
