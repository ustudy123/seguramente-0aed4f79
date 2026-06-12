-- =========================================================
-- FIX (YOUREYES-160): correção de ajuste não remove a marcação
-- original → espelho fica com originais + ajustadas misturadas
--
-- Causa raiz: o DELETE da correção comparava
--   hora_marcacao = v_ajuste.hora_original
-- O formulário envia hora_original como HH:MM:00, mas a marcação
-- original tem SEGUNDOS reais (ex.: 07:42:33). A igualdade nunca
-- batia e a original sobrava. Sintoma do chamado: Ana com 2
-- registros (07:42 / 17:48) termina com 5 após aprovar o ajuste.
--
-- Correções na processar_ajuste_ponto:
-- 1) Match da original por MINUTO (HH24:MI), não por igualdade exata
-- 2) Tipo normalizado ANTES do delete (saida_almoco→saida,
--    retorno_almoco→entrada), pois o banco só guarda entrada/saida;
--    o delete continua valendo para qualquer tipo quando procura
--    pela hora original (comportamento da migration anterior mantido)
--
-- Ao final: limpeza dos dias afetados — remove marcações originais
-- órfãs quando existe ajuste aprovado de correção no mesmo minuto,
-- e reconsolida.
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

  IF NOT p_aprovado OR v_ajuste.tipo_ajuste IN ('justificativa', 'abono') THEN
    PERFORM public.consolidar_ponto_diario_manual(v_ajuste.tenant_id, v_ajuste.colaborador_cpf, v_ajuste.data_referencia);
    RETURN jsonb_build_object('success', true);
  END IF;

  -- Normaliza tipos legados ANTES do delete e do insert
  v_tipo := COALESCE(v_ajuste.tipo_marcacao, 'batida');
  IF v_tipo = 'saida_almoco' THEN v_tipo := 'saida'; END IF;
  IF v_tipo = 'retorno_almoco' THEN v_tipo := 'entrada'; END IF;

  -- Correção: remove a marcação antiga correspondente.
  -- Match por MINUTO (form envia HH:MM:00; banco tem segundos reais).
  -- Sem hora_original: remove as do tipo normalizado (legado).
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

  -- Idempotência: não insere se já existe marcação no mesmo minuto/tipo
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

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.processar_ajuste_ponto(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.processar_ajuste_ponto(uuid, boolean, text) TO authenticated;

-- =========================================================
-- LIMPEZA RETROATIVA: dias onde a correção foi aprovada mas a
-- original não foi removida (mesmo minuto da hora_original de um
-- ajuste aprovado, marcação anterior à aprovação). Reconsolida.
-- =========================================================
DO $cleanup$
DECLARE
  v RECORD;
  v_removidas INT := 0;
BEGIN
  PERFORM set_config('app.allow_ponto_delete', 'true', true);

  FOR v IN
    SELECT pm.id, pm.tenant_id, pm.colaborador_cpf, pm.data_marcacao
    FROM public.ponto_marcacoes pm
    JOIN public.ponto_ajustes pa
      ON pa.tenant_id = pm.tenant_id
     AND pa.colaborador_cpf = pm.colaborador_cpf
     AND pa.data_referencia = pm.data_marcacao
     AND pa.status = 'aprovado'
     AND pa.tipo_ajuste = 'correcao'
     AND pa.hora_original IS NOT NULL
     AND to_char(pm.hora_marcacao, 'HH24:MI') = to_char(pa.hora_original, 'HH24:MI')
    WHERE pm.created_at < pa.data_aprovacao
      -- não remove a marcação que o próprio ajuste inseriu
      AND (pm.hash_marcacao IS NULL OR pm.hash_marcacao NOT LIKE 'AJUSTE-%')
      AND pm.data_marcacao >= CURRENT_DATE - 90
  LOOP
    BEGIN
      DELETE FROM public.ponto_marcacoes WHERE id = v.id;
      v_removidas := v_removidas + 1;
      PERFORM public.consolidar_ponto_diario_manual(v.tenant_id, v.colaborador_cpf, v.data_marcacao);
    EXCEPTION WHEN OTHERS THEN
      -- Período fechado ou trava: mantém e segue
      NULL;
    END;
  END LOOP;

  PERFORM set_config('app.allow_ponto_delete', 'false', true);
  RAISE NOTICE 'Limpeza YOUREYES-160: % marcações originais órfãs removidas', v_removidas;
END $cleanup$;
