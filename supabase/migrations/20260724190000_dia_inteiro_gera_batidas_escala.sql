-- =====================================================================
-- "Dia Inteiro": gera as batidas da ESCALA ao aprovar (Opção A)
-- =====================================================================
-- Documento "Folha de Ponto – Ajustes": ao marcar "Dia Inteiro", o sistema
-- deve preencher os horários do dia a partir da ESCALA do colaborador.
-- Opção A (escolhida): gerar as batidas APENAS quando a justificativa ABONA
-- (presença/justificado — HOME OFFICE, HORA IN ITINERE, FOLGA, etc.).
-- Justificativas que NÃO abonam (FALTA...) não geram batidas.
--
-- Fonte da escala: ponto_escalas.dias_config (JSONB, por dia da semana) com
-- fallback para hora_entrada_padrao/hora_saida_padrao + intervalo (almoço no
-- meio da jornada). As batidas ficam visíveis no espelho; o dia é abonado
-- (status='justificado') logo após, via _ponto_grava_abono.
-- =====================================================================

-- Helper: gera as batidas do dia a partir da escala vigente do colaborador.
CREATE OR REPLACE FUNCTION public._ponto_gera_batidas_dia_inteiro(
  p_tenant_id uuid,
  p_colaborador_id uuid,
  p_colaborador_nome text,
  p_colaborador_cpf text,
  p_data date,
  p_ajuste_id uuid,
  p_created_by uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_esc RECORD;
  v_empresa_id uuid;
  v_chave text;
  v_dia jsonb;
  v_entrada time; v_ini_almoco time; v_fim_almoco time; v_saida time;
  v_tem_almoco boolean := false;
  v_interv int;
  v_ent_min int; v_sai_min int; v_meio int; v_fimalm int;
BEGIN
  IF p_colaborador_id IS NULL THEN RETURN; END IF;

  -- Escala vigente do colaborador na data (mesma resolução de ponto_escala_do_dia)
  SELECT e.dias_config AS dias_config,
         e.hora_entrada_padrao AS hora_entrada_padrao,
         e.hora_saida_padrao AS hora_saida_padrao,
         COALESCE(e.intervalo_intrajornada_minutos, 0) AS interv
  INTO v_esc
  FROM public.ponto_escala_atribuicoes a
  JOIN public.ponto_escalas e ON e.id = a.escala_id
  WHERE a.tenant_id = p_tenant_id
    AND (a.colaborador_cpf = p_colaborador_cpf OR a.colaborador_id = p_colaborador_id::text)
    AND COALESCE(a.ativa, true) = true
    AND a.data_inicio <= p_data
    AND (a.data_fim IS NULL OR a.data_fim >= p_data)
  ORDER BY a.data_inicio DESC
  LIMIT 1;

  IF NOT FOUND THEN RETURN; END IF;  -- sem escala: não gera batidas (só abona)

  -- Chave do dia da semana no dias_config (sem acento).
  v_chave := CASE EXTRACT(DOW FROM p_data)::int
    WHEN 0 THEN 'domingo' WHEN 1 THEN 'segunda' WHEN 2 THEN 'terca'
    WHEN 3 THEN 'quarta'  WHEN 4 THEN 'quinta'  WHEN 5 THEN 'sexta'
    WHEN 6 THEN 'sabado' END;

  v_dia := CASE WHEN v_esc.dias_config IS NOT NULL THEN v_esc.dias_config -> v_chave ELSE NULL END;

  IF v_dia IS NOT NULL AND (v_dia ->> 'entrada') IS NOT NULL AND (v_dia ->> 'saida') IS NOT NULL THEN
    v_entrada := (v_dia ->> 'entrada')::time;
    v_saida   := (v_dia ->> 'saida')::time;
    v_tem_almoco := COALESCE((v_dia ->> 'tem_almoco')::boolean, false);
    IF v_tem_almoco THEN
      v_ini_almoco := NULLIF(v_dia ->> 'inicio_almoco','')::time;
      v_fim_almoco := NULLIF(v_dia ->> 'fim_almoco','')::time;
      IF v_ini_almoco IS NULL OR v_fim_almoco IS NULL THEN v_tem_almoco := false; END IF;
    END IF;
  ELSE
    -- Fallback: horário padrão da escala; almoço no meio da jornada.
    v_entrada := v_esc.hora_entrada_padrao;
    v_saida   := v_esc.hora_saida_padrao;
    v_interv  := v_esc.interv;
    IF v_entrada IS NULL OR v_saida IS NULL THEN RETURN; END IF;
    IF v_interv > 0 THEN
      v_ent_min := EXTRACT(HOUR FROM v_entrada)::int * 60 + EXTRACT(MINUTE FROM v_entrada)::int;
      v_sai_min := EXTRACT(HOUR FROM v_saida)::int * 60 + EXTRACT(MINUTE FROM v_saida)::int;
      v_meio := v_ent_min + ((v_sai_min - v_ent_min - v_interv) / 2);
      IF v_meio > v_ent_min AND v_meio < v_sai_min THEN
        v_fimalm := v_meio + v_interv;
        v_ini_almoco := make_time(v_meio / 60, v_meio % 60, 0);
        v_fim_almoco := make_time(v_fimalm / 60, v_fimalm % 60, 0);
        v_tem_almoco := true;
      END IF;
    END IF;
  END IF;

  IF v_entrada IS NULL OR v_saida IS NULL THEN RETURN; END IF;

  v_empresa_id := public.ponto_empresa_do_colaborador(p_colaborador_id);

  -- Remove batidas avulsas do dia e eventuais batidas deste mesmo ajuste
  -- (idempotência), preservando marcações de OUTROS ajustes aprovados.
  PERFORM set_config('app.allow_ponto_delete', 'true', true);
  DELETE FROM public.ponto_marcacoes
  WHERE tenant_id = p_tenant_id
    AND colaborador_cpf = p_colaborador_cpf
    AND data_marcacao = p_data
    AND (
      (marcacao_original = true AND (hash_marcacao IS NULL OR hash_marcacao NOT LIKE 'AJUSTE-%'))
      OR hash_marcacao LIKE 'AJUSTE-' || p_ajuste_id || '%'
    );
  PERFORM set_config('app.allow_ponto_delete', 'false', true);

  -- Insere as batidas da escala. Meal-out = 'saida', meal-in = 'entrada'
  -- (mesma normalização usada no processar_ajuste_ponto).
  INSERT INTO public.ponto_marcacoes (
    tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
    data_marcacao, hora_marcacao, tipo_marcacao, marcacao_original, created_by, hash_marcacao
  ) VALUES (
    p_tenant_id, v_empresa_id, p_colaborador_id, p_colaborador_nome, p_colaborador_cpf,
    p_data, v_entrada, 'entrada', false, p_created_by, 'AJUSTE-' || p_ajuste_id || '-E'
  );

  IF v_tem_almoco THEN
    INSERT INTO public.ponto_marcacoes (
      tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
      data_marcacao, hora_marcacao, tipo_marcacao, marcacao_original, created_by, hash_marcacao
    ) VALUES (
      p_tenant_id, v_empresa_id, p_colaborador_id, p_colaborador_nome, p_colaborador_cpf,
      p_data, v_ini_almoco, 'saida', false, p_created_by, 'AJUSTE-' || p_ajuste_id || '-SA'
    );
    INSERT INTO public.ponto_marcacoes (
      tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
      data_marcacao, hora_marcacao, tipo_marcacao, marcacao_original, created_by, hash_marcacao
    ) VALUES (
      p_tenant_id, v_empresa_id, p_colaborador_id, p_colaborador_nome, p_colaborador_cpf,
      p_data, v_fim_almoco, 'entrada', false, p_created_by, 'AJUSTE-' || p_ajuste_id || '-RA'
    );
  END IF;

  INSERT INTO public.ponto_marcacoes (
    tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
    data_marcacao, hora_marcacao, tipo_marcacao, marcacao_original, created_by, hash_marcacao
  ) VALUES (
    p_tenant_id, v_empresa_id, p_colaborador_id, p_colaborador_nome, p_colaborador_cpf,
    p_data, v_saida, 'saida', false, p_created_by, 'AJUSTE-' || p_ajuste_id || '-S'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public._ponto_gera_batidas_dia_inteiro(uuid, uuid, text, text, date, uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Recria processar_ajuste_ponto (base 20260724170000) chamando o gerador de
-- batidas quando o ajuste é "Dia Inteiro" e a justificativa abona.
DROP FUNCTION IF EXISTS public.processar_ajuste_ponto(uuid, boolean, text);

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

  IF v_ajuste.tipo_ajuste = 'inclusao' THEN
    PERFORM set_config('app.allow_ponto_delete', 'true', true);
    DELETE FROM public.ponto_marcacoes
    WHERE tenant_id = v_ajuste.tenant_id
      AND colaborador_cpf = v_ajuste.colaborador_cpf
      AND data_marcacao = v_ajuste.data_referencia
      AND marcacao_original = true
      AND (hash_marcacao IS NULL OR hash_marcacao NOT LIKE 'AJUSTE-%');
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
$$;

REVOKE EXECUTE ON FUNCTION public.processar_ajuste_ponto(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.processar_ajuste_ponto(uuid, boolean, text) TO authenticated;
