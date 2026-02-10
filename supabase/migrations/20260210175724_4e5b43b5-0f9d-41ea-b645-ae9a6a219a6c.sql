
-- Tabela de documentos SST (PGR, PCMSO, LTCAT, etc.)
CREATE TABLE public.sst_documentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  tipo TEXT NOT NULL, -- PGR, PCMSO, LTCAT, AEP, PPRA, etc.
  arquivo_url TEXT,
  arquivo_nome TEXT,
  arquivo_tamanho BIGINT,
  data_emissao DATE,
  data_vigencia DATE,
  profissional_responsavel TEXT,
  empresa_emissora TEXT,
  unidade TEXT,
  cnpj_relacionado TEXT,
  status TEXT NOT NULL DEFAULT 'vigente', -- vigente, vencido, substituido
  analise_ia JSONB, -- resultado da análise IA
  analise_ia_status TEXT DEFAULT 'pendente', -- pendente, processando, concluida, erro
  criado_por UUID,
  criado_por_nome TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sst_documentos ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Tenant isolation for sst_documentos" ON public.sst_documentos
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- Trigger updated_at
CREATE TRIGGER update_sst_documentos_updated_at
  BEFORE UPDATE ON public.sst_documentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('sst-documentos', 'sst-documentos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Tenant users can upload SST docs" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'sst-documentos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Tenant users can read SST docs" ON storage.objects
  FOR SELECT USING (bucket_id = 'sst-documentos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Tenant users can delete SST docs" ON storage.objects
  FOR DELETE USING (bucket_id = 'sst-documentos' AND auth.uid() IS NOT NULL);
