-- Adicionar coluna para foto da entrega
ALTER TABLE public.epi_entregas ADD COLUMN IF NOT EXISTS foto_entrega_url TEXT;

-- Criar bucket para fotos de EPIs (público para facilitar visualização)
INSERT INTO storage.buckets (id, name, public)
VALUES ('epi-fotos', 'epi-fotos', true)
ON CONFLICT (id) DO NOTHING;

-- Política para permitir upload de fotos de EPI por usuários autenticados
CREATE POLICY "Usuários autenticados podem fazer upload de fotos EPI"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'epi-fotos');

-- Política para permitir visualização pública das fotos
CREATE POLICY "Fotos de EPI são públicas"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'epi-fotos');

-- Política para permitir atualização de fotos pelo próprio usuário
CREATE POLICY "Usuários podem atualizar suas fotos EPI"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'epi-fotos');

-- Política para permitir exclusão de fotos
CREATE POLICY "Usuários podem excluir fotos EPI"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'epi-fotos');