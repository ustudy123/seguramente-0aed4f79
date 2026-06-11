-- =========================================================
-- FIX: batidas duplicadas ao aprovar ajustes repetidos
--
-- Ao remover a trava de 1 marcação por tipo/dia (modelo de
-- alternância), ficou sem proteção contra DUPLICATA EXATA
-- (mesmo tipo + mesma hora). Solicitações de ajuste repetidas,
-- aprovadas em lote, inseriam marcações idênticas.
--
-- Três camadas:
-- 1) Limpa duplicatas exatas existentes (mantém a mais antiga)
-- 2) Índice único impede duplicata exata no nível do banco
-- 3) processar_ajuste_ponto idempotente: ajuste cujo horário já
--    existe é aprovado sem inserir de novo
-- =========================================================

-- 1) Remove duplicatas exatas existentes (mantém a primeira criada)
DO $cleanup$
BEGIN
  PERFORM set_config('app.allow_ponto_delete', 'true', true);
  DELETE FROM public.ponto_marcacoes pm
  USING public.ponto_marcacoes dup
  WHERE pm.tenant_id = dup.tenant_id
    AND pm.colaborador_cpf = dup.colaborador_cpf
    AND pm.data_marcacao = dup.data_marcacao
    AND pm.tipo_marcacao = dup.tipo_marcacao
    AND pm.hora_marcacao = dup.hora_marcacao
    AND pm.id <> dup.id
    AND pm.created_at > dup.created_at;
  PERFORM set_config('app.allow_ponto_delete', 'false', true);
END $cleanup$;

-- Reconsolida os dias que tinham duplicata (últimos 60 dias)
DO $reconsolida$
DECLARE v RECORD;
BEGIN
  FOR v IN
    SELECT DISTINCT tenant_id, colaborador_cpf, data_marcacao
    FROM public.ponto_marcacoes
    WHERE data_marcacao >= CURRENT_DATE - 60
  LOOP
    PERFORM public.consolidar_ponto_diario_manual(v.tenant_id, v.colaborador_cpf, v.data_marcacao);
  END LOOP;
END $reconsolida$;

-- 2) Garante no banco: nunca duas marcações idênticas
CREATE UNIQUE INDEX IF NOT EXISTS uq_ponto_marcacao_exata
ON public.ponto_marcacoes (tenant_id, colaborador_cpf, data_marcacao, tipo_marcacao, hora_marcacao);

-- 3) processar_ajuste_ponto idempotente
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

  -- Correção: remove a marcação antiga correspondente
  IF v_ajuste.tipo_ajuste = 'correcao' THEN
    PERFORM set_config('app.allow_ponto_delete', 'true', true);
    DELETE FROM public.ponto_marcacoes
    WHERE tenant_id = v_ajuste.tenant_id
      AND colaborador_cpf = v_ajuste.colaborador_cpf
      AND data_marcacao = v_ajuste.data_referencia
      AND tipo_marcacao = v_ajuste.tipo_marcacao
      AND (hora_marcacao = v_ajuste.hora_original OR v_ajuste.hora_original IS NULL);
    PERFORM set_config('app.allow_ponto_delete', 'false', true);
  END IF;

  -- Normaliza tipos legados na inserção
  v_tipo := COALESCE(v_ajuste.tipo_marcacao, 'batida');
  IF v_tipo = 'saida_almoco' THEN v_tipo := 'saida'; END IF;
  IF v_tipo = 'retorno_almoco' THEN v_tipo := 'entrada'; END IF;

  -- Idempotência: se já existe marcação idêntica (mesma data, tipo e
  -- hora), não insere de novo — cobre solicitações de ajuste duplicadas
  -- aprovadas em sequência
  IF NOT EXISTS (
    SELECT 1 FROM public.ponto_marcacoes
    WHERE tenant_id = v_ajuste.tenant_id
      AND colaborador_cpf = v_ajuste.colaborador_cpf
      AND data_marcacao = v_ajuste.data_referencia
      AND tipo_marcacao = v_tipo
      AND hora_marcacao = v_ajuste.hora_solicitada
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

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.processar_ajuste_ponto(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.processar_ajuste_ponto(uuid, boolean, text) TO authenticated;
