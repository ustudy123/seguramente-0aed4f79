
CREATE OR REPLACE FUNCTION public.salvar_resposta_anonima_campanha(
  p_token_publico text,
  p_respostas jsonb,
  p_indicadores jsonb,
  p_tempo_segundos integer DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_cpf_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_campanha_id  UUID;
  v_tenant_id    UUID;
  v_resposta_id  UUID;
  v_ja_respondeu boolean;
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

  -- Trava de duplicidade por CPF dentro da mesma campanha
  IF p_cpf_hash IS NOT NULL AND length(p_cpf_hash) > 0 THEN
    SELECT EXISTS (
      SELECT 1 FROM public.questionario_psicossocial_respostas
      WHERE campanha_id = v_campanha_id
        AND cpf_hash = p_cpf_hash
    ) INTO v_ja_respondeu;

    IF v_ja_respondeu THEN
      RAISE EXCEPTION 'Este CPF já respondeu esta campanha.'
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  INSERT INTO public.questionario_psicossocial_respostas (
    tenant_id,
    campanha_id,
    convite_id,
    respostas,
    indicadores,
    tempo_resposta_segundos,
    user_agent,
    identificacao_voluntaria,
    cpf_hash
  ) VALUES (
    v_tenant_id,
    v_campanha_id,
    NULL,
    p_respostas,
    p_indicadores,
    p_tempo_segundos,
    p_user_agent,
    FALSE,
    p_cpf_hash
  )
  RETURNING id INTO v_resposta_id;

  RETURN jsonb_build_object('resposta_id', v_resposta_id, 'campanha_id', v_campanha_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.salvar_resposta_anonima_campanha(text, jsonb, jsonb, integer, text, text) TO anon, authenticated;
