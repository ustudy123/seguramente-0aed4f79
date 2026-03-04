
-- Tabela de versões de documentos
CREATE TABLE public.documento_versoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  documento_id UUID NOT NULL,
  versao INTEGER NOT NULL DEFAULT 1,
  nome_original TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  tamanho INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT NOT NULL DEFAULT '',
  data_validade DATE NULL,
  observacoes TEXT NULL,
  criado_por UUID NULL,
  criado_por_nome TEXT NULL,
  motivo_revisao TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_documento_versoes_documento ON public.documento_versoes(documento_id);
CREATE INDEX idx_documento_versoes_tenant ON public.documento_versoes(tenant_id);

-- Adicionar coluna versao_atual e versao_numero na tabela documentos (se não existir)
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS versao_atual INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS total_versoes INTEGER NOT NULL DEFAULT 1;

-- RLS
ALTER TABLE public.documento_versoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view versions"
  ON public.documento_versoes FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Tenant members can insert versions"
  ON public.documento_versoes FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Tenant members can delete versions"
  ON public.documento_versoes FOR DELETE
  USING (tenant_id = public.get_user_tenant_id());
