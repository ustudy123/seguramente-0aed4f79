
-- Tabela de roteamento: define qual setor/pessoa recebe cada tipo de manifestação
CREATE TABLE public.ouvidoria_roteamento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tipo_manifestacao TEXT NOT NULL, -- sugestao, reclamacao, denuncia, elogio, duvida
  departamento_responsavel TEXT,
  responsavel_id UUID,
  responsavel_nome TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, tipo_manifestacao)
);

-- Enable RLS
ALTER TABLE public.ouvidoria_roteamento ENABLE ROW LEVEL SECURITY;

-- Admins podem ver e gerenciar roteamento do seu tenant
CREATE POLICY "Admins can manage routing"
ON public.ouvidoria_roteamento
FOR ALL
USING (tenant_id = public.get_user_tenant_id() AND public.has_minimum_role(auth.uid(), 'admin'))
WITH CHECK (tenant_id = public.get_user_tenant_id() AND public.has_minimum_role(auth.uid(), 'admin'));

-- Managers podem ver o roteamento (para saber quem é responsável)
CREATE POLICY "Managers can view routing"
ON public.ouvidoria_roteamento
FOR SELECT
USING (tenant_id = public.get_user_tenant_id() AND public.has_minimum_role(auth.uid(), 'manager'));

-- Adicionar coluna de responsável na tabela ouvidoria
ALTER TABLE public.ouvidoria
ADD COLUMN IF NOT EXISTS responsavel_id UUID,
ADD COLUMN IF NOT EXISTS responsavel_nome TEXT,
ADD COLUMN IF NOT EXISTS departamento_destino TEXT;

-- Trigger para updated_at
CREATE TRIGGER update_ouvidoria_roteamento_updated_at
BEFORE UPDATE ON public.ouvidoria_roteamento
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
