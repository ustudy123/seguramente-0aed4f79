
-- Tabela centralizada de logs de auditoria
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID,
  user_name TEXT,
  user_email TEXT,
  action TEXT NOT NULL, -- ex: 'user.created', 'user.role_updated', 'user.removed'
  module TEXT NOT NULL, -- ex: 'equipe', 'admissoes', 'atestados', 'configuracoes'
  description TEXT,
  target_type TEXT, -- ex: 'user', 'admissao', 'atestado'
  target_id TEXT,
  target_name TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_audit_logs_tenant_created ON public.audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_module ON public.audit_logs(tenant_id, module);
CREATE INDEX idx_audit_logs_user ON public.audit_logs(tenant_id, user_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(tenant_id, action);

-- RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins e owners podem visualizar logs do tenant
CREATE POLICY "Admins can view audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  tenant_id = public.get_user_tenant_id()
  AND public.has_minimum_role(auth.uid(), 'admin')
);

-- Insert via service_role (edge functions) - sem policy de insert para anon/authenticated
-- Logs são inseridos apenas por edge functions com service_role
CREATE POLICY "Service role can insert audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (tenant_id = public.get_user_tenant_id());
