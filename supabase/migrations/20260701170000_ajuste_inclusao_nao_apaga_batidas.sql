-- =====================================================================
-- Aprovar ajuste de INCLUSÃO não pode apagar as batidas reais do dia
-- =====================================================================
-- BUG: ao aprovar uma solicitação de INCLUSÃO de horário, o
-- processar_ajuste_ponto apagava TODAS as marcações reais do dia
-- (marcacao_original = true e hash sem 'AJUSTE-%'), deixando só a marcação
-- incluída. Resultado: as horas batidas do colaborador desapareciam do
-- espelho de ponto.
--
-- A regra "inclusão substitui avulsas" (20260616140000) era agressiva demais:
-- apagava todas as batidas, não só a que duplicaria.
--
-- CORREÇÃO: a inclusão passa a ser ADIÇÃO PURA e idempotente — não apaga mais
-- nenhuma batida real. O INSERT logo abaixo já tem guarda contra duplicata
-- (IF NOT EXISTS mesma hora HH:MM + mesmo tipo), então não duplica. Para trocar
-- um horário errado usa-se CORREÇÃO (que troca só aquela marcação) ou a
-- exclusão explícita.
--
-- Esta migration recria processar_ajuste_ponto idêntica à versão viva
-- (20260724190000), apenas REMOVENDO o bloco de DELETE do ramo de inclusão.
-- O helper _ponto_gera_batidas_dia_inteiro NÃO muda. Correção, justificativa,
-- abono e Dia Inteiro seguem inalterados.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.processar_ajuste_ponto(p_ajuste_id uuid, p_aprovado boolean, p_observacao text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

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
    SELECT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = v_uid AND p.tenant_id = v_ajuste.tenant_id
    ) INTO v_has_access;
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
      WHERE ub3.auth_user_id = v_uid
        AND ub3.tipo_usuario IN ('gestor','administrador','proprietario','rh')
    ) INTO v_is_gestor;
  END IF;

  IF NOT v_is_gestor THEN
    RAISE EXCEPTION 'Apenas gestor/RH pode processar ajustes de ponto';
  END IF;

  SELECT nome_completo INTO v_aprovador_nome
  FROM public.usuarios_base
  WHERE auth_user_id = v_uid AND tenant_id = v_ajuste.tenant_id
  LIMIT 1;
  IF v_aprovador_nome IS NULL THEN
    SELECT nome_completo INTO v_aprovador_nome
    FROM public.profiles WHERE user_id = v_uid LIMIT 1;
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
    FROM public.ponto_justificativas
    WHERE id = v_ajuste.justificativa_id;

    v_deve_abonar := (v_just_tipo_abono = 'sim')
      OR (v_just_tipo_abono = 'configuravel' AND COALESCE(v_ajuste.abonar_se_aprovado, false));

    IF v_deve_abonar THEN
      BEGIN
        v_colab_uuid := v_ajuste.colaborador_id::uuid;
      EXCEPTION WHEN OTHERS THEN
        v_colab_uuid := NULL;
      END;
    END IF;
  END IF;

  -- Rejeição ou ajustes sem marcação (justificativa/abono/dia inteiro).
  IF NOT p_aprovado OR v_ajuste.tipo_ajuste IN ('justificativa', 'abono') THEN
    -- "Dia Inteiro" com justificativa que abona: gera as batidas da escala.
    IF v_deve_abonar AND v_colab_uuid IS NOT NULL AND COALESCE(v_ajuste.dia_inteiro, false) THEN
      PERFORM public._ponto_gera_batidas_dia_inteiro(
        v_ajuste.tenant_id, v_colab_uuid, v_ajuste.colaborador_nome,
        v_ajuste.colaborador_cpf, v_ajuste.data_referencia, v_ajuste.id, v_uid
      );
    END IF;

    PERFORM public.consolidar_ponto_diario_manual(v_ajuste.tenant_id, v_ajuste.colaborador_cpf, v_ajuste.data_referencia);

    -- Abona o dia (justificado) após a reconsolidação, se a justificativa abona.
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

  IF v_ajuste.tipo_ajuste = 'correcao' THEN
    PERFORM set_config('app.allow_ponto_delete', 'true', true);
    DELETE FROM public.ponto_marcacoes
    WHERE tenant_id = v_ajuste.tenant_id
      AND colaborador_cpf = v_ajuste.colaborador_cpf
      AND data_marcacao = v_ajuste.data_referencia
      AND (
        (v_ajuste.hora_original IS NOT NULL
          AND to_char(hora_marcacao, 'HH24:MI') = to_char(v_ajuste.hora_original, 'HH24:MI'))
        OR
        (v_ajuste.hora_original IS NULL AND tipo_marcacao = v_tipo)
      );
    PERFORM set_config('app.allow_ponto_delete', 'false', true);
  END IF;

  -- INCLUSÃO: apenas ADICIONA a marcação faltante — NÃO apaga as batidas reais
  -- do dia (correção do sumiço de horas). O INSERT abaixo é idempotente
  -- (guarda IF NOT EXISTS por hora + tipo), então não duplica.

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
$$;

REVOKE EXECUTE ON FUNCTION public.processar_ajuste_ponto(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.processar_ajuste_ponto(uuid, boolean, text) TO authenticated;
