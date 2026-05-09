CREATE OR REPLACE FUNCTION public.seed_cbo_batch(payload jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted integer := 0;
BEGIN
  INSERT INTO public.cbo_ocupacoes (codigo, titulo)
  SELECT (item->>'codigo')::text, (item->>'titulo')::text
  FROM jsonb_array_elements(payload) AS item
  ON CONFLICT (codigo) DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_cbo_batch(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_cbo_batch(jsonb) TO authenticated;