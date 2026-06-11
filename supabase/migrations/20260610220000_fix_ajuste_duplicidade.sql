-- =========================================================
-- FIX: aprovação de ajustes duplicando batidas
--
-- Dois defeitos corrigidos na processar_ajuste_ponto:
-- 1) INCLUSÃO inseria sem verificar marcação idêntica existente
--    (mesma hora+tipo) → batidas duplicadas (ex.: 2x saída 18:00)
-- 2) CORREÇÃO apagava a original procurando pelo tipo NOVO; quando
--    o ajuste trocava o tipo (saída 13:26 → entrada 13:26), a
--    original sobrava órfã. Agora apaga pela HORA original,
--    independente do tipo.
--
-- Também corrige excluir_marcacao_ponto (lixeira do espelho) com a
-- mesma validação de acesso robusta (profiles/usuario_vinculos), para
-- gestoras vinculadas conseguirem limpar marcações manualmente.
--
-- Ao final: limpeza automática de duplicatas exatas já existentes
-- (mesma hora+tipo+dia+colaborador) com reconsolidação dos dias.
-- =========================================================

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
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO v_ajuste FROM public.ponto_ajustes WHERE id = p_ajuste_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ajuste não encontrado'; END IF;
  IF v_ajuste.status <> 'pendente' THEN RAISE EXCEPTION 'Este ajuste já foi processado'; END IF;

  -- Acesso: tenant principal OU vínculo multi-tenant
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios_base ub
    WHERE ub.auth_user_id = v_uid AND ub.tenant_id = v_ajuste.tenant_id AND ub.status = 'ativo'
  ) INTO v_has_access;

  -- Vínculo multi-empresa real do sistema (usuario_vinculos)
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

  -- Perfil no tenant (mesma base que o RLS usa para exibir os ajustes)
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

  IF NOT p_aprovado OR v_ajuste.tipo_ajuste IN ('justificativa', 'abono') THEN
    PERFORM public.consolidar_ponto_diario_manual(v_ajuste.tenant_id, v_ajuste.colaborador_cpf, v_ajuste.data_referencia);
    RETURN jsonb_build_object('success', true);
  END IF;

  -- Normaliza tipos legados antes de qualquer operação
  v_tipo := COALESCE(v_ajuste.tipo_marcacao, 'batida');
  IF v_tipo = 'saida_almoco' THEN v_tipo := 'saida'; END IF;
  IF v_tipo = 'retorno_almoco' THEN v_tipo := 'entrada'; END IF;

  PERFORM set_config('app.allow_ponto_delete', 'true', true);

  -- Correção: remove a marcação original sendo corrigida —
  -- por HORÁRIO, independente do tipo (o ajuste pode ter trocado
  -- o tipo, ex.: saída 13:26 corrigida para entrada 13:26)
  IF v_ajuste.tipo_ajuste = 'correcao' AND v_ajuste.hora_original IS NOT NULL THEN
    DELETE FROM public.ponto_marcacoes
    WHERE tenant_id = v_ajuste.tenant_id
      AND colaborador_cpf = v_ajuste.colaborador_cpf
      AND data_marcacao = v_ajuste.data_referencia
      AND hora_marcacao = v_ajuste.hora_original;
  END IF;

  -- Anti-duplicidade (correção E inclusão): se já existe marcação
  -- idêntica no destino (mesma hora + tipo), remove antes de inserir
  DELETE FROM public.ponto_marcacoes
  WHERE tenant_id = v_ajuste.tenant_id
    AND colaborador_cpf = v_ajuste.colaborador_cpf
    AND data_marcacao = v_ajuste.data_referencia
    AND hora_marcacao = v_ajuste.hora_solicitada
    AND tipo_marcacao = v_tipo;

  PERFORM set_config('app.allow_ponto_delete', 'false', true);

  INSERT INTO public.ponto_marcacoes (
    tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
    data_marcacao, hora_marcacao, tipo_marcacao, marcacao_original, created_by, hash_marcacao
  ) VALUES (
    v_ajuste.tenant_id, v_ajuste.empresa_id, v_ajuste.colaborador_id, v_ajuste.colaborador_nome, v_ajuste.colaborador_cpf,
    v_ajuste.data_referencia, v_ajuste.hora_solicitada, v_tipo, false, v_uid, 'AJUSTE-' || p_ajuste_id
  );

  PERFORM public.consolidar_ponto_diario_manual(v_ajuste.tenant_id, v_ajuste.colaborador_cpf, v_ajuste.data_referencia);

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.processar_ajuste_ponto(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.processar_ajuste_ponto(uuid, boolean, text) TO authenticated;


-- ---------------------------------------------------------
-- excluir_marcacao_ponto: mesmo acesso robusto
-- ---------------------------------------------------------
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
      v_is_gestor := v_vinculo_role IN ('gestor','administrador','proprietario','rh');
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
    v_marc.tenant_id, v_marc.colaborador_cpf, v_marc.data_marcacao
  );

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- ---------------------------------------------------------
-- LIMPEZA: remove duplicatas exatas (mesma hora+tipo+dia+CPF),
-- mantendo a mais recente, e reconsolida os dias afetados
-- ---------------------------------------------------------
DO $do$
DECLARE
  v_dup RECORD;
BEGIN
  PERFORM set_config('app.allow_ponto_delete', 'true', true);

  FOR v_dup IN
    SELECT tenant_id, colaborador_cpf, data_marcacao
    FROM (
      SELECT tenant_id, colaborador_cpf, data_marcacao,
             ROW_NUMBER() OVER (
               PARTITION BY tenant_id, colaborador_cpf, data_marcacao, hora_marcacao, tipo_marcacao
               ORDER BY created_at DESC
             ) AS rn,
             id
      FROM public.ponto_marcacoes
    ) t
    WHERE t.rn > 1
    GROUP BY tenant_id, colaborador_cpf, data_marcacao
  LOOP
    DELETE FROM public.ponto_marcacoes pm
    USING (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
          PARTITION BY tenant_id, colaborador_cpf, data_marcacao, hora_marcacao, tipo_marcacao
          ORDER BY created_at DESC
        ) AS rn
        FROM public.ponto_marcacoes
        WHERE tenant_id = v_dup.tenant_id
          AND colaborador_cpf = v_dup.colaborador_cpf
          AND data_marcacao = v_dup.data_marcacao
      ) d WHERE d.rn > 1
    ) dups
    WHERE pm.id = dups.id;

    PERFORM public.consolidar_ponto_diario_manual(v_dup.tenant_id, v_dup.colaborador_cpf, v_dup.data_marcacao);
  END LOOP;

  PERFORM set_config('app.allow_ponto_delete', 'false', true);
END $do$;
