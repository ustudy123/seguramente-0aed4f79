
-- Storage bucket for jornada documents
INSERT INTO storage.buckets (id, name, public) VALUES ('jornada-documentos', 'jornada-documentos', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for the bucket
CREATE POLICY "Authenticated users can upload jornada docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'jornada-documentos');

CREATE POLICY "Authenticated users can read jornada docs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'jornada-documentos');

CREATE POLICY "Authenticated users can delete jornada docs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'jornada-documentos');

-- Templates de mapeamento
CREATE TABLE IF NOT EXISTS public.jornada_templates_mapeamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  nome TEXT NOT NULL,
  descricao TEXT,
  mapeamento JSONB NOT NULL DEFAULT '{}',
  headers_originais TEXT[] DEFAULT '{}',
  criado_por TEXT,
  criado_por_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.jornada_templates_mapeamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation on jornada_templates_mapeamento"
ON public.jornada_templates_mapeamento
FOR ALL TO authenticated
USING (tenant_id = public.get_user_tenant_id())
WITH CHECK (tenant_id = public.get_user_tenant_id());

-- Add departamento column to jornada_analises if missing
ALTER TABLE public.jornada_analises ADD COLUMN IF NOT EXISTS departamento TEXT;
ALTER TABLE public.jornada_analises ADD COLUMN IF NOT EXISTS cargo TEXT;
ALTER TABLE public.jornada_analises ADD COLUMN IF NOT EXISTS unidade TEXT;
ALTER TABLE public.jornada_analises ADD COLUMN IF NOT EXISTS gestor TEXT;
ALTER TABLE public.jornada_analises ADD COLUMN IF NOT EXISTS violacoes_dsr INTEGER DEFAULT 0;
