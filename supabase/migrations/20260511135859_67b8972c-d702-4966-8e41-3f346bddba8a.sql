-- 1) Colunas para inativação
ALTER TABLE public.admissoes
ADD COLUMN IF NOT EXISTS inativo boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS inativado_em timestamptz,
ADD COLUMN IF NOT EXISTS inativado_por text,
ADD COLUMN IF NOT EXISTS motivo_inativacao text;

CREATE INDEX IF NOT EXISTS idx_admissoes_inativo ON public.admissoes(inativo);

-- 2) Função: verifica vínculos do colaborador
CREATE OR REPLACE FUNCTION public.colaborador_tem_vinculos(_admissao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cpf text;
  v_total int := 0;
  v_detalhes jsonb := '{}'::jsonb;
  v_count int;
BEGIN
  SELECT cpf INTO v_cpf FROM public.admissoes WHERE id = _admissao_id;

  -- Tabelas com colaborador_id (= admissoes.id)
  PERFORM 1;
  -- macro inline: para cada tabela contar e somar
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

  -- Tabelas indexadas apenas por CPF
  IF v_cpf IS NOT NULL AND length(regexp_replace(v_cpf, '\D', '', 'g')) > 0 THEN
    SELECT count(*) INTO v_count FROM public.epi_entregas WHERE regexp_replace(coalesce(colaborador_cpf,''), '\D', '', 'g') = regexp_replace(v_cpf, '\D', '', 'g');
    IF v_count > 0 THEN v_total := v_total + v_count; v_detalhes := v_detalhes || jsonb_build_object('epi_entregas', v_count); END IF;

    SELECT count(*) INTO v_count FROM public.funcao_treinamento_evidencias WHERE regexp_replace(coalesce(colaborador_cpf,''), '\D', '', 'g') = regexp_replace(v_cpf, '\D', '', 'g');
    IF v_count > 0 THEN v_total := v_total + v_count; v_detalhes := v_detalhes || jsonb_build_object('treinamentos', v_count); END IF;
  END IF;

  RETURN jsonb_build_object(
    'tem_vinculos', v_total > 0,
    'total', v_total,
    'detalhes', v_detalhes
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.colaborador_tem_vinculos(uuid) FROM anon;

-- 3) Função: inativar
CREATE OR REPLACE FUNCTION public.inativar_colaborador(_admissao_id uuid, _motivo text DEFAULT NULL, _reverter boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_email text;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.admissoes WHERE id = _admissao_id;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Colaborador não encontrado';
  END IF;
  IF NOT public.has_tenant_access(v_tenant) THEN
    RAISE EXCEPTION 'Sem permissão para este tenant';
  END IF;

  v_email := public.get_auth_user_email();

  IF _reverter THEN
    UPDATE public.admissoes
    SET inativo = false, inativado_em = NULL, inativado_por = NULL, motivo_inativacao = NULL
    WHERE id = _admissao_id;
  ELSE
    UPDATE public.admissoes
    SET inativo = true, inativado_em = now(), inativado_por = v_email, motivo_inativacao = _motivo
    WHERE id = _admissao_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.inativar_colaborador(uuid, text, boolean) FROM anon;

-- 4) Função: excluir colaborador (apenas se sem vínculos)
CREATE OR REPLACE FUNCTION public.excluir_colaborador_seguro(_admissao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_check jsonb;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.admissoes WHERE id = _admissao_id;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Colaborador não encontrado';
  END IF;
  IF NOT public.has_tenant_access(v_tenant) THEN
    RAISE EXCEPTION 'Sem permissão para este tenant';
  END IF;

  v_check := public.colaborador_tem_vinculos(_admissao_id);
  IF (v_check->>'tem_vinculos')::boolean THEN
    RAISE EXCEPTION 'Colaborador possui vínculos no sistema (%). Use Inativar.', v_check->>'detalhes';
  END IF;

  -- Remove dependentes do próprio fluxo de admissão
  DELETE FROM public.admissao_documentos WHERE admissao_id = _admissao_id;
  DELETE FROM public.admissao_workflow WHERE admissao_id = _admissao_id;
  DELETE FROM public.admissao_historico WHERE admissao_id = _admissao_id;
  DELETE FROM public.contratos_experiencia WHERE admissao_id = _admissao_id;
  DELETE FROM public.onboarding_processos WHERE admissao_id = _admissao_id;

  DELETE FROM public.admissoes WHERE id = _admissao_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.excluir_colaborador_seguro(uuid) FROM anon;