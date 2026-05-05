-- Permitir que usuários autenticados façam upload de fotos de colaboradores
CREATE POLICY "Permitir upload de fotos por usuários autenticados" 
ON storage.objects 
FOR INSERT 
TO authenticated
WITH CHECK (
  bucket_id = 'documentos' AND 
  (storage.foldername(name))[1] = 'colaboradores' AND 
  (storage.foldername(name))[2] = 'fotos'
);

-- Permitir que usuários autenticados visualizem as fotos (necessário se o balde for privado)
CREATE POLICY "Permitir leitura de fotos por usuários autenticados" 
ON storage.objects 
FOR SELECT 
TO authenticated
USING (
  bucket_id = 'documentos' AND 
  (storage.foldername(name))[1] = 'colaboradores' AND 
  (storage.foldername(name))[2] = 'fotos'
);

-- Garantir que ADMs/Managers possam atualizar fotos existentes (upsert)
CREATE POLICY "Permitir update de fotos por usuários autenticados" 
ON storage.objects 
FOR UPDATE 
TO authenticated
USING (
  bucket_id = 'documentos' AND 
  (storage.foldername(name))[1] = 'colaboradores' AND 
  (storage.foldername(name))[2] = 'fotos'
);
