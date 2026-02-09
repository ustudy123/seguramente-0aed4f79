-- Tabela para estrutura de pastas personalizáveis
CREATE TABLE public.documento_pastas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  nome VARCHAR(255) NOT NULL,
  tipo VARCHAR(50) NOT NULL DEFAULT 'custom', -- 'root', 'unidade', 'colaborador', 'ano', 'mes', 'categoria', 'custom'
  pasta_pai_id UUID REFERENCES public.documento_pastas(id) ON DELETE CASCADE,
  filial_id UUID REFERENCES public.filiais(id),
  colaborador_id UUID,
  colaborador_cpf VARCHAR(14),
  colaborador_nome VARCHAR(255),
  ano INTEGER,
  mes INTEGER,
  ordem INTEGER DEFAULT 0,
  icone VARCHAR(50),
  cor VARCHAR(20),
  criado_por UUID,
  criado_por_nome VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_documento_pastas_tenant ON public.documento_pastas(tenant_id);
CREATE INDEX idx_documento_pastas_pai ON public.documento_pastas(pasta_pai_id);
CREATE INDEX idx_documento_pastas_filial ON public.documento_pastas(filial_id);
CREATE INDEX idx_documento_pastas_colaborador ON public.documento_pastas(colaborador_id);

-- Trigger para updated_at
CREATE TRIGGER update_documento_pastas_updated_at
  BEFORE UPDATE ON public.documento_pastas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.documento_pastas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver pastas do tenant"
  ON public.documento_pastas FOR SELECT
  USING (tenant_id = get_user_tenant_id() OR is_superadmin(auth.uid()));

CREATE POLICY "Managers podem gerenciar pastas"
  ON public.documento_pastas FOR ALL
  USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'))
  WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'));

-- Adicionar coluna pasta_id na tabela de documentos
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS pasta_id UUID REFERENCES public.documento_pastas(id);

-- Tabela de auditoria para movimentações de documentos
CREATE TABLE public.documento_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  documento_id UUID NOT NULL,
  documento_nome VARCHAR(255) NOT NULL,
  acao VARCHAR(50) NOT NULL, -- 'upload', 'move', 'rename', 'delete', 'restore'
  pasta_origem_id UUID,
  pasta_origem_nome VARCHAR(255),
  pasta_destino_id UUID,
  pasta_destino_nome VARCHAR(255),
  dados_anteriores JSONB,
  dados_novos JSONB,
  usuario_id UUID,
  usuario_nome VARCHAR(255),
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para auditoria
CREATE INDEX idx_documento_audit_tenant ON public.documento_audit_log(tenant_id);
CREATE INDEX idx_documento_audit_documento ON public.documento_audit_log(documento_id);
CREATE INDEX idx_documento_audit_created ON public.documento_audit_log(created_at DESC);

-- RLS para auditoria
ALTER TABLE public.documento_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers podem ver auditoria do tenant"
  ON public.documento_audit_log FOR SELECT
  USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'));

CREATE POLICY "Sistema pode inserir auditoria"
  ON public.documento_audit_log FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Tabela para categorias padrão de documentos da empresa
CREATE TABLE public.documento_categorias_padrao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  grupo VARCHAR(100) NOT NULL, -- 'juridico', 'licencas', 'registros', 'sst_empresa', 'colaborador'
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  icone VARCHAR(50),
  obrigatorio BOOLEAN DEFAULT false,
  ordem INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS para categorias
ALTER TABLE public.documento_categorias_padrao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver categorias do tenant"
  ON public.documento_categorias_padrao FOR SELECT
  USING (tenant_id = get_user_tenant_id() OR is_superadmin(auth.uid()));

CREATE POLICY "Managers podem gerenciar categorias"
  ON public.documento_categorias_padrao FOR ALL
  USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'))
  WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'));