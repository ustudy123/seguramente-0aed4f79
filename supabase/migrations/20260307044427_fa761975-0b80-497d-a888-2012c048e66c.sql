
-- RPC: Buscar campanha ativa por token_publico (anônimo)
CREATE OR REPLACE FUNCTION public.buscar_campanha_por_token_publico(p_token TEXT)
RETURNS TABLE (
  campanha_id        UUID,
  campanha_nome      TEXT,
  campanha_descricao TEXT,
  campanha_status    TEXT,
  campanha_instrumento TEXT,
  campanha_data_inicio TEXT,
  campanha_data_fim    TEXT,
  campanha_anonimo    BOOLEAN,
  campanha_mensagem_institucional TEXT,
  campanha_politica_uso_dados     TEXT,
  campanha_blocos_dinamicos       JSONB,
  tenant_id          UUID
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.nome,
    c.descricao,
    c.status,
    COALESCE(c.instrumento, 'sipro'),
    c.data_inicio::TEXT,
    c.data_fim::TEXT,
    c.anonimo,
    c.mensagem_institucional,
    c.politica_uso_dados,
    c.blocos_dinamicos,
    c.tenant_id
  FROM public.questionario_psicossocial_campanhas c
  WHERE c.token_publico = p_token
    AND c.status = 'ativa'
  LIMIT 1;
$$;

-- RPC: Salvar resposta anônima via token_publico da campanha
CREATE OR REPLACE FUNCTION public.salvar_resposta_anonima_campanha(
  p_token_publico    TEXT,
  p_respostas        JSONB,
  p_indicadores      JSONB,
  p_tempo_segundos   INTEGER DEFAULT NULL,
  p_user_agent       TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campanha_id  UUID;
  v_tenant_id    UUID;
  v_resposta_id  UUID;
BEGIN
  SELECT id, tenant_id
  INTO v_campanha_id, v_tenant_id
  FROM public.questionario_psicossocial_campanhas
  WHERE token_publico = p_token_publico
    AND status = 'ativa'
  LIMIT 1;

  IF v_campanha_id IS NULL THEN
    RAISE EXCEPTION 'Campanha não encontrada ou inativa';
  END IF;

  INSERT INTO public.psicossocial_respostas (
    tenant_id,
    campanha_id,
    convite_id,
    respostas_json,
    indicadores_json,
    tempo_resposta_segundos,
    user_agent,
    identificacao_voluntaria,
    status
  ) VALUES (
    v_tenant_id,
    v_campanha_id,
    NULL,
    p_respostas,
    p_indicadores,
    p_tempo_segundos,
    p_user_agent,
    FALSE,
    'concluida'
  )
  RETURNING id INTO v_resposta_id;

  RETURN jsonb_build_object('resposta_id', v_resposta_id, 'campanha_id', v_campanha_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.buscar_campanha_por_token_publico(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.salvar_resposta_anonima_campanha(TEXT, JSONB, JSONB, INTEGER, TEXT) TO anon;
