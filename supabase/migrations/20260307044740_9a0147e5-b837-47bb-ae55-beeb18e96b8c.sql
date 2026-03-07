
-- Tornar convite_id nullable para suportar respostas anônimas via link geral
ALTER TABLE public.questionario_psicossocial_respostas
  ALTER COLUMN convite_id DROP NOT NULL;

-- Recriar a RPC com os nomes corretos das colunas
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

  INSERT INTO public.questionario_psicossocial_respostas (
    tenant_id,
    campanha_id,
    convite_id,
    respostas,
    indicadores,
    tempo_resposta_segundos,
    user_agent,
    identificacao_voluntaria
  ) VALUES (
    v_tenant_id,
    v_campanha_id,
    NULL,
    p_respostas,
    p_indicadores,
    p_tempo_segundos,
    p_user_agent,
    FALSE
  )
  RETURNING id INTO v_resposta_id;

  RETURN jsonb_build_object('resposta_id', v_resposta_id, 'campanha_id', v_campanha_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.salvar_resposta_anonima_campanha(TEXT, JSONB, JSONB, INTEGER, TEXT) TO anon;
