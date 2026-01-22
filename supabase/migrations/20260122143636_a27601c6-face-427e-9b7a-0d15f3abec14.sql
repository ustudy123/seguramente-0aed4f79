-- Tabela para registrar o humor do dia dos colaboradores
CREATE TABLE public.humor_diario (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  user_nome TEXT NOT NULL,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  humor TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Constraint para garantir um registro por usuário por dia
  CONSTRAINT unique_user_day UNIQUE (tenant_id, user_id, data)
);

-- Tabela para histórico de mudanças de humor durante o dia
CREATE TABLE public.humor_historico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  user_nome TEXT NOT NULL,
  humor_diario_id UUID NOT NULL REFERENCES public.humor_diario(id) ON DELETE CASCADE,
  humor_anterior TEXT,
  humor_novo TEXT NOT NULL,
  emoji_anterior TEXT,
  emoji_novo TEXT NOT NULL,
  motivo_mudanca TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_humor_diario_tenant_date ON public.humor_diario(tenant_id, data);
CREATE INDEX idx_humor_diario_user_date ON public.humor_diario(user_id, data);
CREATE INDEX idx_humor_historico_humor_diario ON public.humor_historico(humor_diario_id);
CREATE INDEX idx_humor_historico_tenant_date ON public.humor_historico(tenant_id, created_at);

-- Enable RLS
ALTER TABLE public.humor_diario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.humor_historico ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para humor_diario
CREATE POLICY "Usuários podem ver humor do seu tenant"
ON public.humor_diario FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Usuários podem registrar próprio humor"
ON public.humor_diario FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id() AND user_id = auth.uid());

CREATE POLICY "Usuários podem atualizar próprio humor"
ON public.humor_diario FOR UPDATE
USING (tenant_id = get_user_tenant_id() AND user_id = auth.uid())
WITH CHECK (tenant_id = get_user_tenant_id() AND user_id = auth.uid());

-- Políticas RLS para humor_historico
CREATE POLICY "Usuários podem ver histórico do seu tenant"
ON public.humor_historico FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Sistema pode inserir histórico"
ON public.humor_historico FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id() AND user_id = auth.uid());

-- Managers+ podem ver análises completas
CREATE POLICY "Managers podem analisar humor da equipe"
ON public.humor_diario FOR SELECT
USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers podem ver histórico completo"
ON public.humor_historico FOR SELECT
USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role));

-- Trigger para updated_at
CREATE TRIGGER update_humor_diario_updated_at
BEFORE UPDATE ON public.humor_diario
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();