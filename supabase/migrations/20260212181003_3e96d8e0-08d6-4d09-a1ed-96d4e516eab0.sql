
-- Bucket for professional verification documents
INSERT INTO storage.buckets (id, name, public) VALUES ('marketplace-docs', 'marketplace-docs', false);

-- RLS policies for the bucket
CREATE POLICY "Users can upload their own docs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'marketplace-docs' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can view their own docs" ON storage.objects FOR SELECT USING (bucket_id = 'marketplace-docs' AND auth.uid() IS NOT NULL);
CREATE POLICY "Admins can view all docs" ON storage.objects FOR SELECT USING (bucket_id = 'marketplace-docs' AND public.has_minimum_role(auth.uid(), 'admin'));

-- Table for professional verification documents
CREATE TABLE public.marketplace_profissional_documentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profissional_id UUID NOT NULL REFERENCES public.marketplace_profissionais(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL, -- 'documento_pessoal', 'registro_conselho', 'formacao', 'certificacao', 'selfie_verificacao'
  nome_arquivo TEXT NOT NULL,
  arquivo_url TEXT NOT NULL,
  tamanho_bytes INTEGER,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketplace_profissional_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own docs" ON public.marketplace_profissional_documentos FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.marketplace_profissionais p WHERE p.id = profissional_id AND p.user_id = auth.uid())
);

CREATE POLICY "Users can view own docs" ON public.marketplace_profissional_documentos FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.marketplace_profissionais p WHERE p.id = profissional_id AND p.user_id = auth.uid())
  OR public.has_minimum_role(auth.uid(), 'admin')
);
