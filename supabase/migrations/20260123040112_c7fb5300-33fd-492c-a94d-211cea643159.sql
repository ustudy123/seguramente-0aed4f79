-- Adicionar novos campos na tabela epi_tipos
ALTER TABLE public.epi_tipos 
ADD COLUMN IF NOT EXISTS categoria text,
ADD COLUMN IF NOT EXISTS ca_numero text,
ADD COLUMN IF NOT EXISTS marca text,
ADD COLUMN IF NOT EXISTS fabricante text,
ADD COLUMN IF NOT EXISTS estoque_minimo integer DEFAULT 5,
ADD COLUMN IF NOT EXISTS quantidade_estoque integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Adicionar novos campos na tabela epi_entregas para assinatura digital e liveness
ALTER TABLE public.epi_entregas
ADD COLUMN IF NOT EXISTS assinatura_url text,
ADD COLUMN IF NOT EXISTS ip_address text,
ADD COLUMN IF NOT EXISTS user_agent text,
ADD COLUMN IF NOT EXISTS signed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS liveness_detected boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS liveness_data jsonb DEFAULT '{"actions": [], "timestamps": []}'::jsonb,
ADD COLUMN IF NOT EXISTS data_validade date,
ADD COLUMN IF NOT EXISTS employee_id uuid;

-- Criar bucket para assinaturas se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('epi-signatures', 'epi-signatures', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para epi-signatures
CREATE POLICY "Usuários podem fazer upload de assinaturas"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'epi-signatures' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Assinaturas são publicamente acessíveis"
ON storage.objects FOR SELECT
USING (bucket_id = 'epi-signatures');

CREATE POLICY "Managers podem deletar assinaturas"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'epi-signatures' 
  AND public.has_minimum_role(auth.uid(), 'manager'::app_role)
);