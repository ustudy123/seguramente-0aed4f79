
DO $$
DECLARE
  v_tenant uuid := '83f1b040-c857-45a4-b71d-506e2a32d527';
  v_cpf    text := '06153113931';
  v_cid    uuid := '865a3f4c-39fe-40a6-be6b-ea076643c05d';
  v_nome   text := 'Adriana Medeiros da Silva';
  v_emp    uuid;
BEGIN
  v_emp := public.ponto_empresa_do_colaborador(v_cid);
  SET LOCAL session_replication_role = replica;
  IF NOT EXISTS (SELECT 1 FROM public.ponto_marcacoes WHERE id='f9fad61d-e6fe-4ad5-bce3-6b95361ae928') THEN
    INSERT INTO public.ponto_marcacoes (
      id, tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
      data_marcacao, hora_marcacao, tipo_marcacao, marcacao_original,
      dispositivo, latitude, longitude, selfie_nome, selfie_url,
      hash_marcacao, classificacao_clt, comprovante_gerado, created_at
    ) VALUES (
      'f9fad61d-e6fe-4ad5-bce3-6b95361ae928', v_tenant, v_emp, v_cid, v_nome, v_cpf,
      '2026-06-29', '08:02:52.761235', 'entrada', true,
      'mobile_web', -25.9702566, -52.8145986,
      'ponto-selfie-1782730971286.jpg',
      'https://diayjpsrcerycycyaxst.supabase.co/storage/v1/object/public/ponto-selfies/externo/865a3f4c-39fe-40a6-be6b-ea076643c05d/1782730972303_entrada.jpg',
      '14d44b9a3922406ad1500a89475afb8d4b3ba53eedd4f0f3ea344936c4c4ac27',
      'verde', false, '2026-06-29T11:02:52.761235+00:00'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.ponto_marcacoes WHERE id='375c3ae3-8c2b-4eb4-9920-dfebb9d6b416') THEN
    INSERT INTO public.ponto_marcacoes (
      id, tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
      data_marcacao, hora_marcacao, tipo_marcacao, marcacao_original,
      dispositivo, latitude, longitude, endereco_geolocalizacao,
      selfie_nome, selfie_url, hash_marcacao, classificacao_clt,
      comprovante_gerado, created_at
    ) VALUES (
      '375c3ae3-8c2b-4eb4-9920-dfebb9d6b416', v_tenant, v_emp, v_cid, v_nome, v_cpf,
      '2026-06-29', '11:59:20.216185', 'saida', true,
      'mobile_web', -25.9702303, -52.8145178,
      'Rua Presidente Kennedy, Industrial, Itapejara d''Oeste, Paraná',
      'ponto-selfie-1782745159035.jpg',
      'https://diayjpsrcerycycyaxst.supabase.co/storage/v1/object/public/ponto-selfies/externo/865a3f4c-39fe-40a6-be6b-ea076643c05d/1782745160227_saida.jpg',
      '41c7d9dc1d7f71c1edba9828c07d643c763316bf4df8c450553cd51a970e7d8f',
      'verde', false, '2026-06-29T14:59:20.216185+00:00'
    );
  END IF;

  PERFORM public.consolidar_ponto_diario_manual(v_tenant, v_cpf, DATE '2026-06-29');
END $$;

CREATE OR REPLACE FUNCTION public.audit_ponto_marcacoes_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  INSERT INTO public.ponto_audit_log (
    tenant_id, tabela_origem, registro_id, acao, dados_anteriores, usuario_id
  ) VALUES (
    OLD.tenant_id, 'ponto_marcacoes', OLD.id, 'DELETE',
    to_jsonb(OLD), auth.uid()
  );
  RETURN OLD;
END;
$fn$;

DROP TRIGGER IF EXISTS trigger_audit_marcacoes_delete ON public.ponto_marcacoes;
CREATE TRIGGER trigger_audit_marcacoes_delete
AFTER DELETE ON public.ponto_marcacoes
FOR EACH ROW EXECUTE FUNCTION public.audit_ponto_marcacoes_delete();

CREATE OR REPLACE FUNCTION public.processar_ajuste_ponto(p_ajuste_id uuid, p_aprovado boolean, p_observacao text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_ajuste public.ponto_ajustes%ROWTYPE;
  v_has_access boolean := false;
  v_is_gestor boolean := false;
  v_vinculo_role text;
  v_aprovador_nome text;
  v_tipo text;
  v_just_tipo_abono text;
  v_just_nome text;
  v_deve_abonar boolean := false;
  v_colab_uuid uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO v_ajuste FROM public.ponto_ajustes WHERE id = p_ajuste_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ajuste não encontrado'; END IF;
  IF v_ajuste.status <> 'pendente' THEN RAISE EXCEPTION 'Este ajuste já foi processado'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.usuarios_base ub
    WHERE ub.auth_user_id = v_uid AND ub.tenant_id = v_ajuste.tenant_id AND ub.status = 'ativo'
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    SELECT uv.tipo_vinculo::text INTO v_vinculo_role
    FROM public.usuario_vinculos uv
    JOIN public.usuarios_base ub2 ON ub2.id = uv.usuario_id
    WHERE ub2.auth_user_id = v_uid
      AND uv.tenant_id = v_ajuste.tenant_id
      AND uv.status = 'ativo'
      AND (uv.data_fim IS NULL OR uv.data_fim >= CURRENT_DATE)
    LIMIT 1;
    IF v_vinculo_role IS NOT NULL THEN
      v_has_access := true;
      v_is_gestor := v_vinculo_role IN ('gestor','administrador','proprietario','rh');
    END IF;
  END IF;

  IF NOT v_has_access THEN
    SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = v_uid AND p.tenant_id = v_ajuste.tenant_id) INTO v_has_access;
  END IF;
  IF NOT v_has_access THEN RAISE EXCEPTION 'Sem acesso a este tenant'; END IF;

  IF NOT v_is_gestor THEN
    v_is_gestor :=
      public.has_role(v_uid, 'manager'::public.app_role)
      OR public.has_role(v_uid, 'admin'::public.app_role)
      OR public.has_role(v_uid, 'owner'::public.app_role)
      OR public.has_role(v_uid, 'superadmin'::public.app_role);
  END IF;

  IF NOT v_is_gestor THEN
    SELECT EXISTS (
      SELECT 1 FROM public.usuarios_base ub3
      WHERE ub3.auth_user_id = v_uid AND ub3.tipo_usuario IN ('gestor','administrador','proprietario','rh')
    ) INTO v_is_gestor;
  END IF;

  IF NOT v_is_gestor THEN RAISE EXCEPTION 'Apenas gestor/RH pode processar ajustes de ponto'; END IF;

  SELECT nome_completo INTO v_aprovador_nome
  FROM public.usuarios_base
  WHERE auth_user_id = v_uid AND tenant_id = v_ajuste.tenant_id
  LIMIT 1;
  IF v_aprovador_nome IS NULL THEN
    SELECT nome_completo INTO v_aprovador_nome FROM public.profiles WHERE user_id = v_uid LIMIT 1;
  END IF;

  UPDATE public.ponto_ajustes
  SET status = CASE WHEN p_aprovado THEN 'aprovado' ELSE 'rejeitado' END,
      aprovado_por = v_uid,
      aprovado_por_nome = v_aprovador_nome,
      data_aprovacao = now(),
      observacao_aprovador = p_observacao
  WHERE id = p_ajuste_id;

  IF p_aprovado AND v_ajuste.justificativa_id IS NOT NULL THEN
    SELECT tipo_abono, nome INTO v_just_tipo_abono, v_just_nome
    FROM public.ponto_justificativas WHERE id = v_ajuste.justificativa_id;
    v_deve_abonar := (v_just_tipo_abono = 'sim')
      OR (v_just_tipo_abono = 'configuravel' AND COALESCE(v_ajuste.abonar_se_aprovado, false));
    IF v_deve_abonar THEN
      BEGIN v_colab_uuid := v_ajuste.colaborador_id::uuid;
      EXCEPTION WHEN OTHERS THEN v_colab_uuid := NULL;
      END;
    END IF;
  END IF;

  IF NOT p_aprovado OR v_ajuste.tipo_ajuste IN ('justificativa', 'abono') THEN
    IF v_deve_abonar AND v_colab_uuid IS NOT NULL AND COALESCE(v_ajuste.dia_inteiro, false) THEN
      PERFORM public._ponto_gera_batidas_dia_inteiro(
        v_ajuste.tenant_id, v_colab_uuid, v_ajuste.colaborador_nome,
        v_ajuste.colaborador_cpf, v_ajuste.data_referencia, v_ajuste.id, v_uid
      );
    END IF;
    PERFORM public.consolidar_ponto_diario_manual(v_ajuste.tenant_id, v_ajuste.colaborador_cpf, v_ajuste.data_referencia);
    IF v_deve_abonar AND v_colab_uuid IS NOT NULL THEN
      PERFORM public._ponto_grava_abono(
        v_ajuste.tenant_id, v_colab_uuid, v_ajuste.colaborador_nome,
        v_ajuste.colaborador_cpf, v_ajuste.data_referencia,
        COALESCE(v_just_nome, v_ajuste.motivo)
      );
    END IF;
    RETURN jsonb_build_object('success', true, 'abonado', v_deve_abonar);
  END IF;

  v_tipo := COALESCE(v_ajuste.tipo_marcacao, 'batida');
  IF v_tipo = 'saida_almoco' THEN v_tipo := 'saida'; END IF;
  IF v_tipo = 'retorno_almoco' THEN v_tipo := 'entrada'; END IF;

  -- CORREÇÃO SEGURA: só apaga se houver hora_original explícita.
  -- Sem hora_original o comportamento vira "inclusão" (apenas insere),
  -- evitando o sumiço em massa de batidas do mesmo tipo no dia.
  IF v_ajuste.tipo_ajuste = 'correcao' AND v_ajuste.hora_original IS NOT NULL THEN
    PERFORM set_config('app.allow_ponto_delete', 'true', true);
    DELETE FROM public.ponto_marcacoes
    WHERE tenant_id = v_ajuste.tenant_id
      AND colaborador_cpf = v_ajuste.colaborador_cpf
      AND data_marcacao = v_ajuste.data_referencia
      AND to_char(hora_marcacao, 'HH24:MI') = to_char(v_ajuste.hora_original, 'HH24:MI');
    PERFORM set_config('app.allow_ponto_delete', 'false', true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.ponto_marcacoes
    WHERE tenant_id = v_ajuste.tenant_id
      AND colaborador_cpf = v_ajuste.colaborador_cpf
      AND data_marcacao = v_ajuste.data_referencia
      AND tipo_marcacao = v_tipo
      AND to_char(hora_marcacao, 'HH24:MI') = to_char(v_ajuste.hora_solicitada, 'HH24:MI')
  ) THEN
    INSERT INTO public.ponto_marcacoes (
      tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
      data_marcacao, hora_marcacao, tipo_marcacao, marcacao_original, created_by, hash_marcacao
    ) VALUES (
      v_ajuste.tenant_id, v_ajuste.empresa_id, v_ajuste.colaborador_id, v_ajuste.colaborador_nome, v_ajuste.colaborador_cpf,
      v_ajuste.data_referencia, v_ajuste.hora_solicitada, v_tipo, false, v_uid, 'AJUSTE-' || p_ajuste_id
    );
  END IF;

  PERFORM public.consolidar_ponto_diario_manual(v_ajuste.tenant_id, v_ajuste.colaborador_cpf, v_ajuste.data_referencia);

  IF v_deve_abonar AND v_colab_uuid IS NOT NULL THEN
    PERFORM public._ponto_grava_abono(
      v_ajuste.tenant_id, v_colab_uuid, v_ajuste.colaborador_nome,
      v_ajuste.colaborador_cpf, v_ajuste.data_referencia,
      COALESCE(v_just_nome, v_ajuste.motivo)
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'abonado', v_deve_abonar);
END;
$function$;
