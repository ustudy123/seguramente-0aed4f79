
-- Audit log for terceiros document operations
CREATE TABLE public.terceiro_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  entidade_tipo TEXT NOT NULL, -- 'documento' | 'treinamento' | 'trabalhador' | 'terceiro'
  entidade_id UUID NOT NULL,
  acao TEXT NOT NULL, -- 'criado' | 'atualizado' | 'removido' | 'download'
  descricao TEXT,
  dados_anteriores JSONB,
  dados_novos JSONB,
  usuario_id UUID,
  usuario_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.terceiro_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view audit logs"
  ON public.terceiro_audit_log FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Tenant users can insert audit logs"
  ON public.terceiro_audit_log FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE INDEX idx_terceiro_audit_tenant ON public.terceiro_audit_log(tenant_id);
CREATE INDEX idx_terceiro_audit_entidade ON public.terceiro_audit_log(entidade_tipo, entidade_id);
