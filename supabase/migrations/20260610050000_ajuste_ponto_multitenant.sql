-- =========================================================
-- FIX URGENTE: processar_ajuste_ponto bloqueava gestores
-- vinculados (multi-tenant)
--
-- A validação considerava apenas usuarios_base (tenant
-- principal). Gestores com acesso por VÍNCULO (usuario_tenants
-- — ex.: Cacilda em BARROS & NUERNBERG) recebiam "Sem acesso
-- a este tenant" ao aprovar/rejeitar ajustes.
--
-- Correção: acesso via usuarios_base OU usuario_tenants (mesmo
-- padrão da excluir_marcacao_ponto); papel do vínculo vale como
-- gestor; nome do aprovador com fallback em profiles. O corpo
-- transacional permanece idêntico ao da migration anterior.
-- =========================================================

CREATE OR REPLACE FUNCTION public.processar_ajuste_ponto(
  p_ajuste_id uuid,
  p_aprovado boolean,
  p_observacao text DEFAULT NULL
)
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
  v_marcacao_id uuid;
  v_empresa_id uuid;
  v_deleted int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Trava o ajuste para evitar processamento duplo simultâneo
  SELECT * INTO v_ajuste
  FROM public.ponto_ajustes
  WHERE id = p_ajuste_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ajuste não encontrado';
  END IF;

  IF v_ajuste.status <> 'pendente' THEN
    RAISE EXCEPTION 'Este ajuste já foi processado (status atual: %)', v_ajuste.status;
  END IF;

  -- Valida acesso ao tenant: tenant principal (usuarios_base)
  -- OU vínculo multi-tenant (usuario_tenants) — ex.: gestores vinculados
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios_base ub
    WHERE ub.auth_user_id = v_uid
      AND ub.tenant_id = v_ajuste.tenant_id
      AND ub.status = 'ativo'
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    SELECT ut.role::text INTO v_vinculo_role
    FROM public.usuario_tenants ut
    WHERE ut.user_id = v_uid
      AND ut.tenant_id = v_ajuste.tenant_id
      AND ut.ativo = true
    LIMIT 1;

    IF v_vinculo_role IS NOT NULL THEN
      v_has_access := true;
      v_is_gestor := v_vinculo_role IN ('manager','admin','super_admin','superadmin','owner','rh');
    END IF;
  END IF;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Sem acesso a este tenant';
  END IF;

  -- Valida papel mínimo (gestor/RH): papel global OU papel do vínculo
  IF NOT v_is_gestor THEN
    v_is_gestor :=
      public.has_role(v_uid, 'manager'::public.app_role)
      OR public.has_role(v_uid, 'admin'::public.app_role)
      OR public.has_role(v_uid, 'owner'::public.app_role)
      OR public.has_role(v_uid, 'superadmin'::public.app_role);
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
    FROM public.profiles
    WHERE user_id = v_uid
    LIMIT 1;
  END IF;

  -- Atualiza o status do ajuste
  UPDATE public.ponto_ajustes
  SET status = CASE WHEN p_aprovado THEN 'aprovado' ELSE 'rejeitado' END,
      aprovado_por = v_uid,
      aprovado_por_nome = v_aprovador_nome,
      data_aprovacao = now(),
      observacao_aprovador = p_observacao
  WHERE id = p_ajuste_id;

  -- Rejeição ou ajustes sem marcação (justificativa/abono): encerra aqui
  IF NOT p_aprovado
     OR v_ajuste.tipo_ajuste IN ('justificativa', 'abono')
     OR v_ajuste.tipo_marcacao IS NULL
     OR v_ajuste.hora_solicitada IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', CASE WHEN p_aprovado THEN 'aprovado' ELSE 'rejeitado' END,
      'marcacao_criada', false
    );
  END IF;

  -- Correção: remove a marcação original (com auditoria e flag de liberação)
  IF v_ajuste.tipo_ajuste = 'correcao' AND v_ajuste.hora_original IS NOT NULL THEN
    INSERT INTO public.ponto_audit_log (
      tenant_id, tabela_origem, registro_id, acao,
      dados_anteriores, dados_novos, usuario_id
    )
    SELECT
      pm.tenant_id, 'ponto_marcacoes', pm.id, 'AJUSTE',
      to_jsonb(pm),
      jsonb_build_object(
        'operacao', 'SUBSTITUIDA_POR_AJUSTE',
        'ajuste_id', v_ajuste.id,
        'hora_nova', v_ajuste.hora_solicitada
      ),
      v_uid
    FROM public.ponto_marcacoes pm
    WHERE pm.tenant_id = v_ajuste.tenant_id
      AND pm.colaborador_cpf = v_ajuste.colaborador_cpf
      AND pm.data_marcacao = v_ajuste.data_referencia
      AND pm.tipo_marcacao = v_ajuste.tipo_marcacao
      AND pm.hora_marcacao = v_ajuste.hora_original;

    PERFORM set_config('app.allow_ponto_delete', 'true', true);
    DELETE FROM public.ponto_marcacoes
    WHERE tenant_id = v_ajuste.tenant_id
      AND colaborador_cpf = v_ajuste.colaborador_cpf
      AND data_marcacao = v_ajuste.data_referencia
      AND tipo_marcacao = v_ajuste.tipo_marcacao
      AND hora_marcacao = v_ajuste.hora_original;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    PERFORM set_config('app.allow_ponto_delete', 'false', true);
  END IF;

  -- Herda empresa_id de outra marcação do dia (mantém escopo de empresa)
  SELECT empresa_id INTO v_empresa_id
  FROM public.ponto_marcacoes
  WHERE tenant_id = v_ajuste.tenant_id
    AND colaborador_cpf = v_ajuste.colaborador_cpf
    AND empresa_id IS NOT NULL
  ORDER BY data_marcacao DESC, created_at DESC
  LIMIT 1;

  -- Insere a nova marcação (hash gerado pelo trigger trigger_gerar_hash_marcacao)
  INSERT INTO public.ponto_marcacoes (
    tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
    data_marcacao, hora_marcacao, tipo_marcacao,
    marcacao_original, dispositivo, created_by
  ) VALUES (
    v_ajuste.tenant_id, v_empresa_id, v_ajuste.colaborador_id,
    v_ajuste.colaborador_nome, v_ajuste.colaborador_cpf,
    v_ajuste.data_referencia, v_ajuste.hora_solicitada, v_ajuste.tipo_marcacao,
    false, 'ajuste_aprovado', v_uid
  ) RETURNING id INTO v_marcacao_id;

  -- Auditoria da criação vinculada ao ajuste
  INSERT INTO public.ponto_audit_log (
    tenant_id, tabela_origem, registro_id, acao, dados_novos, usuario_id
  ) VALUES (
    v_ajuste.tenant_id, 'ponto_marcacoes', v_marcacao_id, 'AJUSTE',
    jsonb_build_object(
      'operacao', 'CRIADA_POR_AJUSTE',
      'ajuste_id', v_ajuste.id,
      'tipo_ajuste', v_ajuste.tipo_ajuste,
      'originais_removidas', v_deleted
    ),
    v_uid
  );

  -- Reconsolida o dia para o espelho refletir imediatamente
  PERFORM public.consolidar_ponto_diario_manual(
    v_ajuste.tenant_id,
    v_ajuste.colaborador_cpf,
    v_ajuste.data_referencia
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'aprovado',
    'marcacao_criada', true,
    'marcacao_id', v_marcacao_id,
    'originais_removidas', v_deleted
  );
END;
$function$;
