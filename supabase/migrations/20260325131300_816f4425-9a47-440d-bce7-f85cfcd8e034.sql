
-- ========================================
-- eSocial: Certificados Digitais
-- ========================================
CREATE TABLE IF NOT EXISTS public.esocial_certificados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES public.empresa_cadastro(id) ON DELETE SET NULL,
  cnpj TEXT NOT NULL,
  nome_empresa TEXT NOT NULL,
  -- Tipo de acesso
  tipo TEXT NOT NULL DEFAULT 'propria' CHECK (tipo IN ('propria', 'procuracao')),
  -- Para procuração eletrônica
  cnpj_procurador TEXT,
  nome_procurador TEXT,
  -- Arquivo do certificado no storage (privado, criptografado)
  certificado_path TEXT NOT NULL,
  certificado_nome TEXT NOT NULL,
  -- Metadados do certificado
  validade DATE,
  senha_hash TEXT, -- hash da senha para validação (nunca armazenar em texto)
  -- Configuração
  ambiente TEXT NOT NULL DEFAULT 'producao' CHECK (ambiente IN ('producao', 'homologacao')),
  ativo BOOLEAN DEFAULT true,
  -- Auditoria
  criado_por UUID,
  criado_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================================
-- eSocial: Log de Transmissões
-- ========================================
CREATE TABLE IF NOT EXISTS public.esocial_transmissoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES public.empresa_cadastro(id) ON DELETE SET NULL,
  certificado_id UUID REFERENCES public.esocial_certificados(id) ON DELETE SET NULL,
  -- Referência ao evento SST
  evento_sst_id UUID REFERENCES public.eventos_sst(id) ON DELETE SET NULL,
  tipo_evento TEXT NOT NULL, -- S-2210, S-2220, S-2240
  -- Dados transmitidos
  xml_enviado TEXT,
  xml_retorno TEXT,
  protocolo TEXT,
  numero_recibo TEXT,
  -- Status: pendente, enviado, processado, rejeitado, erro
  status TEXT NOT NULL DEFAULT 'pendente',
  mensagem_retorno TEXT,
  codigo_retorno TEXT,
  -- Tentativas
  tentativas INTEGER DEFAULT 0,
  ultima_tentativa TIMESTAMPTZ,
  -- Auditoria
  criado_por UUID,
  criado_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================================
-- Indexes
-- ========================================
CREATE INDEX IF NOT EXISTS idx_esocial_certificados_tenant ON public.esocial_certificados(tenant_id);
CREATE INDEX IF NOT EXISTS idx_esocial_certificados_empresa ON public.esocial_certificados(empresa_id);
CREATE INDEX IF NOT EXISTS idx_esocial_transmissoes_tenant ON public.esocial_transmissoes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_esocial_transmissoes_evento ON public.esocial_transmissoes(evento_sst_id);
CREATE INDEX IF NOT EXISTS idx_esocial_transmissoes_status ON public.esocial_transmissoes(status);

-- ========================================
-- RLS
-- ========================================
ALTER TABLE public.esocial_certificados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esocial_transmissoes ENABLE ROW LEVEL SECURITY;

-- Certificados: apenas membros do tenant
CREATE POLICY "tenant_members_esocial_certs_select"
  ON public.esocial_certificados FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "tenant_admins_esocial_certs_insert"
  ON public.esocial_certificados FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "tenant_admins_esocial_certs_update"
  ON public.esocial_certificados FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "tenant_admins_esocial_certs_delete"
  ON public.esocial_certificados FOR DELETE
  USING (tenant_id = public.get_user_tenant_id());

-- Transmissões: apenas membros do tenant
CREATE POLICY "tenant_members_esocial_trans_select"
  ON public.esocial_transmissoes FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "tenant_members_esocial_trans_insert"
  ON public.esocial_transmissoes FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "tenant_members_esocial_trans_update"
  ON public.esocial_transmissoes FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id());

-- ========================================
-- Triggers updated_at
-- ========================================
CREATE TRIGGER update_esocial_certificados_updated_at
  BEFORE UPDATE ON public.esocial_certificados
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_esocial_transmissoes_updated_at
  BEFORE UPDATE ON public.esocial_transmissoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========================================
-- Storage bucket privado para certificados
-- ========================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'esocial-certificados',
  'esocial-certificados',
  false,
  5242880, -- 5MB
  ARRAY['application/x-pkcs12', 'application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage: apenas membros autenticados do tenant
CREATE POLICY "esocial_cert_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'esocial-certificados'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "esocial_cert_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'esocial-certificados'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "esocial_cert_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'esocial-certificados'
    AND auth.role() = 'authenticated'
  );
