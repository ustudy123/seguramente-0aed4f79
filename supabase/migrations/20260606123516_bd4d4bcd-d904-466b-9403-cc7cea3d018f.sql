-- Grant execute permissions for anonymous users on onboarding functions
GRANT EXECUTE ON FUNCTION public.get_admissao_by_token(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_admissao_documentos_by_token(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.ensure_admissao_documentos_by_token(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.update_admissao_foto_by_token(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.update_admissao_documento_by_token(uuid, uuid, text, text, bigint, text, timestamp with time zone) TO anon;
GRANT EXECUTE ON FUNCTION public.finalizar_admissao_by_token(uuid) TO anon;

-- Fix update_admissao_documento_by_token signature if it's mismatching
-- Based on the error reported, let's make sure the status parameter is handled correctly
CREATE OR REPLACE FUNCTION public.update_admissao_documento_by_token(
  _token uuid, 
  _documento_id uuid, 
  _arquivo_url text, 
  _arquivo_nome text, 
  _arquivo_tamanho bigint, 
  _status text, 
  _data_envio timestamp with time zone
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admissao_id uuid;
BEGIN
  SELECT a.id INTO v_admissao_id
  FROM public.admissoes a
  JOIN public.admissao_documentos d ON d.admissao_id = a.id
  WHERE a.onboarding_token = _token AND d.id = _documento_id
  LIMIT 1;

  IF v_admissao_id IS NULL THEN
    RAISE EXCEPTION 'Token ou documento inválido' USING ERRCODE = '42501';
  END IF;

  UPDATE public.admissao_documentos
  SET arquivo_url = _arquivo_url,
      arquivo_nome = _arquivo_nome,
      arquivo_tamanho = _arquivo_tamanho,
      status = _status::public.documento_status,
      data_envio = _data_envio,
      updated_at = now()
  WHERE id = _documento_id;
END;
$function$;

-- Update Storage Policies for the 'documentos' bucket to allow anonymous uploads for onboarding
-- 1. Allow public upload to colaboradores/fotos (for onboarding profile picture)
CREATE POLICY "Allow public upload for onboarding photos"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (
  bucket_id = 'documentos' AND
  (storage.foldername(name))[1] = 'colaboradores' AND
  (storage.foldername(name))[2] = 'fotos'
);

-- 2. Allow public upload to tenant-specific admissions folders
-- This is a bit more permissive but scoped to 'admissoes' subfolder
CREATE POLICY "Allow public upload for onboarding docs"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (
  bucket_id = 'documentos' AND
  (storage.foldername(name))[2] = 'admissoes'
);

-- 3. Allow public read for onboarding (needed for previewing uploaded files)
CREATE POLICY "Allow public read for documentos"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'documentos');

-- 4. Allow public update/upsert (for retrying uploads)
CREATE POLICY "Allow public update for onboarding docs"
ON storage.objects FOR UPDATE
TO anon
USING (bucket_id = 'documentos');

-- 5. Allow public delete (for removing documents before finishing)
CREATE POLICY "Allow public delete for onboarding docs"
ON storage.objects FOR DELETE
TO anon
USING (bucket_id = 'documentos');