
-- Notifications table for trilha alerts
CREATE TABLE public.trilha_notificacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  colaborador_id UUID NOT NULL,
  colaborador_nome TEXT NOT NULL,
  trilha_id UUID NOT NULL,
  trilha_nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('prazo_proximo', 'prazo_vencido', 'abandono', 'lembrete_retorno')),
  titulo TEXT NOT NULL,
  descricao TEXT,
  lida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for quick lookups
CREATE INDEX idx_trilha_notif_colab ON public.trilha_notificacoes(tenant_id, colaborador_id, lida);
CREATE INDEX idx_trilha_notif_created ON public.trilha_notificacoes(created_at DESC);

-- Enable RLS
ALTER TABLE public.trilha_notificacoes ENABLE ROW LEVEL SECURITY;

-- Users can see their own notifications
CREATE POLICY "Users can view own trilha notifications"
ON public.trilha_notificacoes FOR SELECT
USING (auth.uid() = colaborador_id);

-- Users can mark their own as read
CREATE POLICY "Users can update own trilha notifications"
ON public.trilha_notificacoes FOR UPDATE
USING (auth.uid() = colaborador_id);

-- Service role / edge functions insert (via service key)
CREATE POLICY "Service can insert trilha notifications"
ON public.trilha_notificacoes FOR INSERT
WITH CHECK (tenant_id = public.get_user_tenant_id() OR public.has_minimum_role(auth.uid(), 'manager'));

-- Managers can see all in tenant
CREATE POLICY "Managers can view all trilha notifications"
ON public.trilha_notificacoes FOR SELECT
USING (tenant_id = public.get_user_tenant_id() AND public.has_minimum_role(auth.uid(), 'manager'));
