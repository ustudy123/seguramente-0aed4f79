-- 1) Guardião de imutabilidade da marcação original
CREATE OR REPLACE FUNCTION public.ponto_bloquear_update_marcacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF coalesce(current_setting('app.ponto_retificacao', true), 'off') = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.hora_marcacao IS DISTINCT FROM OLD.hora_marcacao
     OR NEW.data_marcacao IS DISTINCT FROM OLD.data_marcacao
     OR NEW.tipo_marcacao IS DISTINCT FROM OLD.tipo_marcacao
     OR NEW.colaborador_cpf IS DISTINCT FROM OLD.colaborador_cpf
     OR NEW.colaborador_id IS DISTINCT FROM OLD.colaborador_id
     OR NEW.marcacao_original IS DISTINCT FROM OLD.marcacao_original
  THEN
    RAISE EXCEPTION 'Marcação original é imutável (Portaria MTP 671/2021). Use a retificação com justificativa.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ponto_bloquear_update_marcacao ON public.ponto_marcacoes;
CREATE TRIGGER trg_ponto_bloquear_update_marcacao
  BEFORE UPDATE ON public.ponto_marcacoes
  FOR EACH ROW EXECUTE FUNCTION public.ponto_bloquear_update_marcacao();

-- 2) Retificação oficial com justificativa obrigatória
CREATE OR REPLACE FUNCTION public.ponto_retificar_marcacao(
  p_marcacao_id uuid,
  p_nova_hora time without time zone,
  p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_marc public.ponto_marcacoes%ROWTYPE;
  v_has_access boolean := false;
  v_is_gestor boolean := false;
  v_vinculo_role text;
  v_nome text;
  v_ajuste_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF p_nova_hora IS NULL THEN RAISE EXCEPTION 'Informe a nova hora'; END IF;
  IF p_motivo IS NULL OR length(btrim(p_motivo)) < 10 THEN
    RAISE EXCEPTION 'Justificativa obrigatória (mínimo 10 caracteres)';
  END IF;

  SELECT * INTO v_marc FROM public.ponto_marcacoes WHERE id = p_marcacao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Marcação não encontrada'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.usuarios_base ub
    WHERE ub.auth_user_id = v_uid AND ub.tenant_id = v_marc.tenant_id AND ub.status = 'ativo'
  ) INTO v_has_access;

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

  IF NOT v_has_access THEN
    SELECT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = v_uid AND p.tenant_id = v_marc.tenant_id
    ) INTO v_has_access;
  END IF;

  IF NOT v_has_access THEN RAISE EXCEPTION 'Sem acesso a este tenant'; END IF;

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
    RAISE EXCEPTION 'Apenas gestor/RH pode retificar marcações';
  END IF;

  SELECT coalesce(ub.nome_completo, 'Gestor') INTO v_nome
  FROM public.usuarios_base ub WHERE ub.auth_user_id = v_uid LIMIT 1;

  -- Registro do ajuste (rastreabilidade: hora original preservada)
  INSERT INTO public.ponto_ajustes (
    tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
    data_referencia, tipo_ajuste, tipo_marcacao, hora_original, hora_solicitada,
    motivo, status, aprovado_por, aprovado_por_nome, data_aprovacao,
    created_by, created_by_nome
  ) VALUES (
    v_marc.tenant_id, v_marc.empresa_id, v_marc.colaborador_id, v_marc.colaborador_nome,
    v_marc.colaborador_cpf, v_marc.data_marcacao, 'retificacao', v_marc.tipo_marcacao,
    v_marc.hora_marcacao, p_nova_hora, btrim(p_motivo), 'aprovado',
    v_uid, coalesce(v_nome, 'Gestor'), now(), v_uid, coalesce(v_nome, 'Gestor')
  ) RETURNING id INTO v_ajuste_id;

  INSERT INTO public.ponto_audit_log (
    tenant_id, tabela_origem, registro_id, acao, dados_anteriores, dados_novos, usuario_id
  ) VALUES (
    v_marc.tenant_id, 'ponto_marcacoes', v_marc.id, 'AJUSTE',
    to_jsonb(v_marc),
    jsonb_build_object(
      'operacao','RETIFICACAO_GESTOR',
      'hora_anterior', v_marc.hora_marcacao,
      'hora_nova', p_nova_hora,
      'motivo', btrim(p_motivo),
      'ajuste_id', v_ajuste_id
    ),
    v_uid
  );

  PERFORM set_config('app.ponto_retificacao', 'on', true);
  UPDATE public.ponto_marcacoes
     SET hora_marcacao = p_nova_hora,
         marcacao_original = false
   WHERE id = p_marcacao_id;
  PERFORM set_config('app.ponto_retificacao', 'off', true);

  PERFORM public.consolidar_ponto_diario_manual(
    v_marc.tenant_id, v_marc.colaborador_cpf, v_marc.data_marcacao
  );

  RETURN jsonb_build_object('success', true, 'ajuste_id', v_ajuste_id);
END;
$$;

REVOKE ALL ON FUNCTION public.ponto_retificar_marcacao(uuid, time without time zone, text) FROM public;
GRANT EXECUTE ON FUNCTION public.ponto_retificar_marcacao(uuid, time without time zone, text) TO authenticated;