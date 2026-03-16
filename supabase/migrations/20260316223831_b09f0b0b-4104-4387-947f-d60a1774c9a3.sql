
-- Enum for ticket type
CREATE TYPE public.ticket_tipo AS ENUM ('bug', 'falha', 'reclamacao', 'sugestao', 'duvida');

-- Enum for ticket status
CREATE TYPE public.ticket_status AS ENUM ('aberto', 'em_analise', 'em_andamento', 'resolvido', 'fechado', 'cancelado');

-- Enum for ticket priority
CREATE TYPE public.ticket_prioridade AS ENUM ('baixa', 'media', 'alta', 'critica');

-- Main tickets table
CREATE TABLE public.suporte_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  tipo public.ticket_tipo NOT NULL DEFAULT 'bug',
  status public.ticket_status NOT NULL DEFAULT 'aberto',
  prioridade public.ticket_prioridade NOT NULL DEFAULT 'media',
  modulo TEXT,
  screenshot_url TEXT,
  criado_por UUID REFERENCES auth.users(id),
  criado_por_nome TEXT,
  atribuido_a_nome TEXT,
  atribuido_a_id UUID,
  resolucao TEXT,
  resolvido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Comments on tickets
CREATE TABLE public.suporte_ticket_comentarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  ticket_id UUID NOT NULL REFERENCES public.suporte_tickets(id) ON DELETE CASCADE,
  autor_id UUID REFERENCES auth.users(id),
  autor_nome TEXT,
  conteudo TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.suporte_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suporte_ticket_comentarios ENABLE ROW LEVEL SECURITY;

-- RLS policies for tickets
CREATE POLICY "Tenant members can view tickets"
  ON public.suporte_tickets FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Tenant members can create tickets"
  ON public.suporte_tickets FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Admins can update tickets"
  ON public.suporte_tickets FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

-- RLS policies for comments
CREATE POLICY "Tenant members can view comments"
  ON public.suporte_ticket_comentarios FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Tenant members can create comments"
  ON public.suporte_ticket_comentarios FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- Updated_at trigger
CREATE TRIGGER update_suporte_tickets_updated_at
  BEFORE UPDATE ON public.suporte_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
