-- =========================================================
-- FIX: Aprovação de ajuste de ponto transacional
--
-- Problema: o front-end fazia 3 operações separadas
-- (update status -> delete original -> insert marcação).
-- O DELETE era bloqueado pelo trigger bloquear_delete_ponto
-- e o INSERT podia ser rejeitado pela regra dos 10 minutos
-- (validar_sequencia_marcacao). Resultado: ajuste ficava
-- "aprovado" sem a marcação existir -> espelho desatualizado.
--
-- Solução:
-- 1) validar_sequencia_marcacao passa a ignorar marcações
--    de ajuste (marcacao_original = false) — as regras de
--    sequência/intervalo valem só para batida ao vivo.
-- 2) Nova RPC processar_ajuste_ponto faz tudo numa única
--    transação: valida papel, atualiza status, remove a
--    marcação original (correção), insere a nova marcação,
--    grava auditoria e reconsolida o dia no espelho.
--    Se qualquer passo falhar, NADA é gravado.
-- =========================================================

-- 1) Bypass das validações de batida ao vivo para marcações de ajuste
CREATE OR REPLACE FUNCTION public.validar_sequencia_marcacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tem_saida_almoco BOOLEAN;
  v_ultima_marcacao TIME;
  v_diff_segundos NUMERIC;
BEGIN
  -- Marcações criadas por ajuste aprovado (retroativas) não passam
  -- pelas regras de batida ao vivo (sequência de almoço / 10 minutos)
  IF NEW.marcacao_original = false THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM ponto_marcacoes
    WHERE tenant_id = NEW.tenant_id
      AND colaborador_cpf = NEW.colaborador_cpf
      AND data_marcacao = NEW.data_marcacao
      AND tipo_marcacao = 'saida_almoco'
  ) INTO v_tem_saida_almoco;

  IF NEW.tipo_marcacao = 'retorno_almoco' AND NOT v_tem_saida_almoco THEN
    RAISE EXCEPTION 'Não é possível registrar Retorno Almoço sem Saída Almoço prévia.';
  END IF;

  SELECT MAX(hora_marcacao)
  INTO v_ultima_marcacao
  FROM ponto_marcacoes
  WHERE tenant_id = NEW.tenant_id
    AND colaborador_cpf = NEW.colaborador_cpf
    AND data_marcacao = NEW.data_marcacao;

  IF v_ultima_marcacao IS NOT NULL THEN
    v_diff_segundos := EXTRACT(EPOCH FROM (NEW.hora_marcacao - v_ultima_marcacao));
    IF v_diff_segundos < 600 AND v_diff_segundos >= 0 THEN
      RAISE EXCEPTION 'Aguarde pelo menos 10 minutos entre registros de ponto. Último registro há % segundos.', ROUND(v_diff_segundos);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) RPC transacional de processamento de ajuste
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
  v_has_access boolean;
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

  -- Valida acesso ao tenant
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios_base ub
    WHERE ub.auth_user_id = v_uid
      AND ub.tenant_id = v_ajuste.tenant_id
      AND ub.status = 'ativo'
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Sem acesso a este tenant';
  END IF;

  -- Valida papel mínimo (gestor/RH)
  IF NOT (
    public.has_role(v_uid, 'manager'::public.app_role)
    OR public.has_role(v_uid, 'admin'::public.app_role)
    OR public.has_role(v_uid, 'owner'::public.app_role)
    OR public.has_role(v_uid, 'superadmin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Apenas gestor/RH pode processar ajustes de ponto';
  END IF;

  SELECT nome_completo INTO v_aprovador_nome
  FROM public.usuarios_base
  WHERE auth_user_id = v_uid AND tenant_id = v_ajuste.tenant_id
  LIMIT 1;

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

REVOKE EXECUTE ON FUNCTION public.processar_ajuste_ponto(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.processar_ajuste_ponto(uuid, boolean, text) TO authenticated;
