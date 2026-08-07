ALTER TABLE public.ponto_ajustes
  ADD COLUMN IF NOT EXISTS auto_lancado boolean NOT NULL DEFAULT false;

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
  v_aprovador_cpf text;
  v_auto_lancado boolean := false;
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

  SELECT nome_completo, regexp_replace(COALESCE(cpf,''), '\D', '', 'g')
    INTO v_aprovador_nome, v_aprovador_cpf
  FROM public.usuarios_base
  WHERE auth_user_id = v_uid AND tenant_id = v_ajuste.tenant_id
  LIMIT 1;
  IF v_aprovador_nome IS NULL THEN
    SELECT nome_completo INTO v_aprovador_nome FROM public.profiles WHERE user_id = v_uid LIMIT 1;
  END IF;

  -- =========================================================
  -- Bloco 3 — Segregação de funções (MTP 671 / auditoria)
  -- 1) Ninguém aprova ajuste do PRÓPRIO ponto.
  -- 2) Quem lançou o ajuste e aprova o mesmo ajuste precisa
  --    justificar (observação >= 10 caracteres) e o registro
  --    fica marcado como auto-lançamento.
  -- =========================================================
  IF COALESCE(v_aprovador_cpf, '') <> ''
     AND regexp_replace(COALESCE(v_ajuste.colaborador_cpf,''), '\D', '', 'g') = v_aprovador_cpf THEN
    RAISE EXCEPTION 'Segregação de funções: não é permitido aprovar ou rejeitar ajuste do próprio ponto. Outro gestor/RH deve analisar.';
  END IF;

  v_auto_lancado := (v_ajuste.created_by IS NOT NULL AND v_ajuste.created_by = v_uid);

  IF v_auto_lancado AND p_aprovado AND length(COALESCE(btrim(p_observacao), '')) < 10 THEN
    RAISE EXCEPTION 'Você foi quem solicitou este ajuste. Informe uma observação de aprovação com no mínimo 10 caracteres justificando o auto-lançamento.';
  END IF;

  UPDATE public.ponto_ajustes
  SET status = CASE WHEN p_aprovado THEN 'aprovado' ELSE 'rejeitado' END,
      aprovado_por = v_uid,
      aprovado_por_nome = v_aprovador_nome,
      data_aprovacao = now(),
      observacao_aprovador = p_observacao,
      auto_lancado = v_auto_lancado
  WHERE id = p_ajuste_id;

  IF v_auto_lancado THEN
    BEGIN
      INSERT INTO public.audit_logs (tenant_id, user_id, acao, entidade, entidade_id, detalhes)
      VALUES (
        v_ajuste.tenant_id, v_uid,
        CASE WHEN p_aprovado THEN 'ajuste_ponto_auto_aprovado' ELSE 'ajuste_ponto_auto_rejeitado' END,
        'ponto_ajustes', p_ajuste_id,
        jsonb_build_object(
          'colaborador_cpf', v_ajuste.colaborador_cpf,
          'data_referencia', v_ajuste.data_referencia,
          'observacao', p_observacao,
          'aprovador_nome', v_aprovador_nome
        )
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

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
        COALESCE(v_ajuste.horas_abonadas, 0), COALESCE(v_just_nome, v_ajuste.motivo), v_ajuste.id, v_uid
      );
    END IF;
    BEGIN
      PERFORM public.apurar_banco_horas_colaborador(
        v_ajuste.tenant_id, v_ajuste.colaborador_cpf, to_char(v_ajuste.data_referencia, 'YYYY-MM')
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    RETURN jsonb_build_object('success', true, 'auto_lancado', v_auto_lancado);
  END IF;

  -- Ajustes de marcação (inclusão/correção/exclusão)
  IF v_ajuste.hora_original IS NOT NULL THEN
    DELETE FROM public.ponto_marcacoes
    WHERE tenant_id = v_ajuste.tenant_id
      AND colaborador_cpf = v_ajuste.colaborador_cpf
      AND data_hora::date = v_ajuste.data_referencia
      AND data_hora::time = v_ajuste.hora_original;
  END IF;

  IF v_ajuste.hora_solicitada IS NOT NULL THEN
    INSERT INTO public.ponto_marcacoes (
      tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
      data_hora, tipo, origem, observacao, ajuste_id, criado_por
    ) VALUES (
      v_ajuste.tenant_id, v_ajuste.empresa_id, v_ajuste.colaborador_id, v_ajuste.colaborador_nome,
      v_ajuste.colaborador_cpf,
      (v_ajuste.data_referencia + v_ajuste.hora_solicitada)::timestamptz,
      COALESCE(v_ajuste.tipo_marcacao, 'entrada'), 'ajuste',
      COALESCE(v_ajuste.motivo, 'Ajuste aprovado'), v_ajuste.id, v_uid
    );
  END IF;

  PERFORM public.consolidar_ponto_diario_manual(v_ajuste.tenant_id, v_ajuste.colaborador_cpf, v_ajuste.data_referencia);
  BEGIN
    PERFORM public.apurar_banco_horas_colaborador(
      v_ajuste.tenant_id, v_ajuste.colaborador_cpf, to_char(v_ajuste.data_referencia, 'YYYY-MM')
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true, 'auto_lancado', v_auto_lancado);
END;
$function$;