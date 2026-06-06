CREATE OR REPLACE FUNCTION public.colaborador_tem_vinculos(_admissao_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total int := 0;
  v_detalhes jsonb := '{}'::jsonb;
  v_count int;
BEGIN
  -- We now use direct UUID comparison instead of text casting for better performance and to avoid type errors
  
  SELECT count(*) INTO v_count FROM public.ponto_marcacoes WHERE colaborador_id = _admissao_id;
  IF v_count > 0 THEN v_total := v_total + v_count; v_detalhes := v_detalhes || jsonb_build_object('ponto_marcacoes', v_count); END IF;

  SELECT count(*) INTO v_count FROM public.ponto_diario WHERE colaborador_id = _admissao_id;
  IF v_count > 0 THEN v_total := v_total + v_count; v_detalhes := v_detalhes || jsonb_build_object('ponto_diario', v_count); END IF;

  SELECT count(*) INTO v_count FROM public.ferias_solicitacoes WHERE colaborador_id = _admissao_id;
  IF v_count > 0 THEN v_total := v_total + v_count; v_detalhes := v_detalhes || jsonb_build_object('ferias', v_count); END IF;

  SELECT count(*) INTO v_count FROM public.atestados WHERE colaborador_id = _admissao_id;
  IF v_count > 0 THEN v_total := v_total + v_count; v_detalhes := v_detalhes || jsonb_build_object('atestados', v_count); END IF;

  SELECT count(*) INTO v_count FROM public.afastamentos WHERE colaborador_id = _admissao_id;
  IF v_count > 0 THEN v_total := v_total + v_count; v_detalhes := v_detalhes || jsonb_build_object('afastamentos', v_count); END IF;

  SELECT count(*) INTO v_count FROM public.folha_itens WHERE colaborador_id = _admissao_id;
  IF v_count > 0 THEN v_total := v_total + v_count; v_detalhes := v_detalhes || jsonb_build_object('folha', v_count); END IF;

  SELECT count(*) INTO v_count FROM public.folha_rescisoes WHERE colaborador_id = _admissao_id OR admissao_id = _admissao_id;
  IF v_count > 0 THEN v_total := v_total + v_count; v_detalhes := v_detalhes || jsonb_build_object('rescisoes', v_count); END IF;

  SELECT count(*) INTO v_count FROM public.ordens_servico WHERE colaborador_id = _admissao_id;
  IF v_count > 0 THEN v_total := v_total + v_count; v_detalhes := v_detalhes || jsonb_build_object('ordens_servico', v_count); END IF;

  SELECT count(*) INTO v_count FROM public.eventos_sst WHERE colaborador_id = _admissao_id;
  IF v_count > 0 THEN v_total := v_total + v_count; v_detalhes := v_detalhes || jsonb_build_object('eventos_sst', v_count); END IF;

  SELECT count(*) INTO v_count FROM public.pdis WHERE colaborador_id = _admissao_id;
  IF v_count > 0 THEN v_total := v_total + v_count; v_detalhes := v_detalhes || jsonb_build_object('pdis', v_count); END IF;

  SELECT count(*) INTO v_count FROM public.metas WHERE colaborador_id = _admissao_id;
  IF v_count > 0 THEN v_total := v_total + v_count; v_detalhes := v_detalhes || jsonb_build_object('metas', v_count); END IF;

  SELECT count(*) INTO v_count FROM public.feedbacks WHERE colaborador_id = _admissao_id;
  IF v_count > 0 THEN v_total := v_total + v_count; v_detalhes := v_detalhes || jsonb_build_object('feedbacks', v_count); END IF;

  SELECT count(*) INTO v_count FROM public.ocorrencias WHERE colaborador_id = _admissao_id;
  IF v_count > 0 THEN v_total := v_total + v_count; v_detalhes := v_detalhes || jsonb_build_object('ocorrencias', v_count); END IF;

  SELECT count(*) INTO v_count FROM public.avaliacao_9box WHERE colaborador_id = _admissao_id;
  IF v_count > 0 THEN v_total := v_total + v_count; v_detalhes := v_detalhes || jsonb_build_object('avaliacoes', v_count); END IF;

  SELECT count(*) INTO v_count FROM public.holerite_assinaturas WHERE colaborador_id = _admissao_id;
  IF v_count > 0 THEN v_total := v_total + v_count; v_detalhes := v_detalhes || jsonb_build_object('holerites', v_count); END IF;

  SELECT count(*) INTO v_count FROM public.ponto_ajustes WHERE colaborador_id = _admissao_id;
  IF v_count > 0 THEN v_total := v_total + v_count; v_detalhes := v_detalhes || jsonb_build_object('ponto_ajustes', v_count); END IF;

  SELECT count(*) INTO v_count FROM public.beneficios_colaboradores WHERE colaborador_id = _admissao_id;
  IF v_count > 0 THEN v_total := v_total + v_count; v_detalhes := v_detalhes || jsonb_build_object('beneficios', v_count); END IF;

  RETURN jsonb_build_object('tem_vinculos', v_total > 0, 'total', v_total, 'detalhes', v_detalhes);
END;
$function$