CREATE OR REPLACE FUNCTION public.verificar_hash_ja_respondeu(p_campanha_id uuid, p_hash text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.psicossocial_telefone_usado
    WHERE campanha_id = p_campanha_id AND telefone_hash = p_hash
  );
$$;

GRANT EXECUTE ON FUNCTION public.verificar_hash_ja_respondeu(uuid, text) TO anon, authenticated;