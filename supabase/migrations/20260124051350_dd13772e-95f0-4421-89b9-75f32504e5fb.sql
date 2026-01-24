-- Criar tabela de ouvidoria
CREATE TABLE public.ouvidoria (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('sugestao', 'reclamacao', 'denuncia', 'elogio', 'duvida')),
  assunto TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  anonimo BOOLEAN NOT NULL DEFAULT false,
  autor_id UUID,
  autor_nome TEXT,
  autor_email TEXT,
  autor_departamento TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_analise', 'respondido', 'arquivado')),
  prioridade TEXT DEFAULT 'normal' CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente')),
  resposta TEXT,
  respondido_por UUID,
  respondido_por_nome TEXT,
  respondido_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.ouvidoria ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso

-- Usuários podem criar manifestações (anônimas ou não)
CREATE POLICY "Usuários podem criar manifestações"
ON public.ouvidoria
FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant_id() AND
  (
    (anonimo = true AND autor_id IS NULL) OR
    (anonimo = false AND autor_id = auth.uid())
  )
);

-- Usuários podem ver suas próprias manifestações não-anônimas
CREATE POLICY "Usuários podem ver próprias manifestações"
ON public.ouvidoria
FOR SELECT
USING (
  tenant_id = get_user_tenant_id() AND
  anonimo = false AND
  autor_id = auth.uid()
);

-- Managers+ podem ver todas as manifestações do tenant
CREATE POLICY "Managers+ podem ver todas manifestações"
ON public.ouvidoria
FOR SELECT
USING (
  tenant_id = get_user_tenant_id() AND
  has_minimum_role(auth.uid(), 'manager'::app_role)
);

-- Managers+ podem atualizar manifestações (responder, mudar status)
CREATE POLICY "Managers+ podem atualizar manifestações"
ON public.ouvidoria
FOR UPDATE
USING (
  tenant_id = get_user_tenant_id() AND
  has_minimum_role(auth.uid(), 'manager'::app_role)
)
WITH CHECK (
  tenant_id = get_user_tenant_id() AND
  has_minimum_role(auth.uid(), 'manager'::app_role)
);

-- Admins+ podem deletar manifestações
CREATE POLICY "Admins+ podem deletar manifestações"
ON public.ouvidoria
FOR DELETE
USING (
  tenant_id = get_user_tenant_id() AND
  has_minimum_role(auth.uid(), 'admin'::app_role)
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_ouvidoria_updated_at
BEFORE UPDATE ON public.ouvidoria
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();