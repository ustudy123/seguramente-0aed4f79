-- Criar tabela de documentos
CREATE TABLE public.documentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  colaborador_id UUID NULL,
  colaborador_nome TEXT NOT NULL,
  colaborador_cpf TEXT NULL,
  nome_arquivo TEXT NOT NULL,
  nome_original TEXT NOT NULL,
  tipo TEXT NOT NULL,
  tamanho INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  data_validade DATE NULL,
  status TEXT NOT NULL DEFAULT 'valido',
  observacoes TEXT NULL,
  criado_por UUID NULL,
  criado_por_nome TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários podem ver documentos do seu tenant"
ON public.documentos
FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Managers+ podem criar documentos"
ON public.documentos
FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers+ podem atualizar documentos"
ON public.documentos
FOR UPDATE
USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role))
WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers+ podem deletar documentos"
ON public.documentos
FOR DELETE
USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role));

-- Trigger para updated_at
CREATE TRIGGER update_documentos_updated_at
BEFORE UPDATE ON public.documentos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_documentos_tenant_id ON public.documentos(tenant_id);
CREATE INDEX idx_documentos_colaborador_id ON public.documentos(colaborador_id);
CREATE INDEX idx_documentos_tipo ON public.documentos(tipo);
CREATE INDEX idx_documentos_status ON public.documentos(status);