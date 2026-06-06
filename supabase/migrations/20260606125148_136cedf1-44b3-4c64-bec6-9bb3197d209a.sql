-- Remover políticas antigas que podem estar conflitando
DROP POLICY IF EXISTS "Allow public upload for onboarding docs" ON storage.objects;
DROP POLICY IF EXISTS "Allow public upload for onboarding photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read for documentos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public update for onboarding docs" ON storage.objects;
DROP POLICY IF EXISTS "Allow public delete for onboarding docs" ON storage.objects;

-- Política para permitir Upload (INSERT)
CREATE POLICY "Allow public upload for onboarding docs" ON storage.objects
FOR INSERT TO anon
WITH CHECK (
    bucket_id = 'documentos' AND (
        (storage.foldername(name))[1] = 'admissoes' OR 
        ((storage.foldername(name))[1] = 'colaboradores' AND (storage.foldername(name))[2] = 'fotos')
    )
);

-- Política para permitir Leitura (SELECT)
-- Necessário para que o useStorageImageUrl consiga gerar URLs assinadas ou para o componente ver o arquivo
CREATE POLICY "Allow public read for documentos" ON storage.objects
FOR SELECT TO anon
USING (
    bucket_id = 'documentos' AND (
        (storage.foldername(name))[1] = 'admissoes' OR 
        ((storage.foldername(name))[1] = 'colaboradores' AND (storage.foldername(name))[2] = 'fotos')
    )
);

-- Política para permitir Atualização (UPDATE)
-- Necessário para o 'upsert: true' do upload do Supabase
CREATE POLICY "Allow public update for onboarding docs" ON storage.objects
FOR UPDATE TO anon
USING (
    bucket_id = 'documentos' AND (
        (storage.foldername(name))[1] = 'admissoes' OR 
        ((storage.foldername(name))[1] = 'colaboradores' AND (storage.foldername(name))[2] = 'fotos')
    )
);

-- Política para permitir Deleção (DELETE)
-- Necessário para que o colaborador possa remover um documento enviado por engano
CREATE POLICY "Allow public delete for onboarding docs" ON storage.objects
FOR DELETE TO anon
USING (
    bucket_id = 'documentos' AND (
        (storage.foldername(name))[1] = 'admissoes' OR 
        ((storage.foldername(name))[1] = 'colaboradores' AND (storage.foldername(name))[2] = 'fotos')
    )
);

-- Garantir que as funções RPC tenham permissão de execução para PUBLIC (anon)
GRANT EXECUTE ON FUNCTION public.get_admissao_by_token(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_admissao_documentos_by_token(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.ensure_admissao_documentos_by_token(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.update_admissao_foto_by_token(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.update_admissao_documento_by_token(uuid, uuid, text, text, bigint, text, timestamp with time zone) TO anon;
GRANT EXECUTE ON FUNCTION public.finalizar_admissao_by_token(uuid) TO anon;
