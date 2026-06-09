-- Criar funções wrapper no schema public que chamam o schema externo
CREATE OR REPLACE FUNCTION public.listar_ponto_externo(p_token text, p_dias integer DEFAULT 45)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN externo.listar_ponto_externo(p_token, p_dias);
END;
$$;

CREATE OR REPLACE FUNCTION public.solicitar_ajustes_ponto_externo_batch(
  p_token text,
  p_itens jsonb,
  p_motivo text DEFAULT NULL,
  p_anexos jsonb DEFAULT '[]'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN externo.solicitar_ajustes_ponto_externo_batch(p_token, p_itens, p_motivo, p_anexos);
END;
$$;

GRANT EXECUTE ON FUNCTION public.listar_ponto_externo(text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.solicitar_ajustes_ponto_externo_batch(text, jsonb, text, jsonb) TO anon, authenticated;
