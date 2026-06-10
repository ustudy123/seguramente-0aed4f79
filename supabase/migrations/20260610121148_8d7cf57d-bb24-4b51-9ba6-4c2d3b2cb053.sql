-- 1. Remover constraint de tipos fixos para permitir maior flexibilidade (mantendo compatibilidade legada)
ALTER TABLE public.ponto_marcacoes DROP CONSTRAINT IF EXISTS ponto_marcacoes_tipo_marcacao_check;
ALTER TABLE public.ponto_marcacoes ADD CONSTRAINT ponto_marcacoes_tipo_marcacao_check 
  CHECK (tipo_marcacao IN ('entrada', 'saida_almoco', 'retorno_almoco', 'saida', 'batida'));

-- 2. Atualizar a função de processamento de ajustes para ser mais robusta com múltiplos registros
CREATE OR REPLACE FUNCTION public.processar_ajuste_ponto(p_ajuste_id uuid, p_aprovado boolean, p_observacao text DEFAULT NULL::text)
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
  v_empresa_id uuid;
  v_deleted int := 0;
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

  IF NOT v_has_access THEN RAISE EXCEPTION 'Sem acesso'; END IF;

  UPDATE public.ponto_ajustes
  SET status = CASE WHEN p_aprovado THEN 'aprovado' ELSE 'rejeitado' END,
      aprovado_por = v_uid,
      data_aprovacao = now(),
      observacao_aprovador = p_observacao
  WHERE id = p_ajuste_id;

  IF NOT p_aprovado OR v_ajuste.tipo_ajuste IN ('justificativa', 'abono') THEN
    RETURN jsonb_build_object('success', true);
  END IF;

  -- Correção: Remove a marcação antiga baseada em múltiplos critérios se não tiver ID direto
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

  -- Insere a nova batida (tipo 'batida' como padrão flexível)
  INSERT INTO public.ponto_marcacoes (
    tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
    data_marcacao, hora_marcacao, tipo_marcacao, marcacao_original, created_by, hash_marcacao
  ) VALUES (
    v_ajuste.tenant_id, v_ajuste.empresa_id, v_ajuste.colaborador_id, v_ajuste.colaborador_nome, v_ajuste.colaborador_cpf,
    v_ajuste.data_referencia, v_ajuste.hora_solicitada, COALESCE(v_ajuste.tipo_marcacao, 'batida'), false, v_uid, 'AJUSTE-' || p_ajuste_id
  );

  -- Reconsolida o dia
  PERFORM public.consolidar_ponto_diario_manual(v_ajuste.tenant_id, v_ajuste.colaborador_cpf, v_ajuste.data_referencia);

  RETURN jsonb_build_object('success', true);
END;
$function$;