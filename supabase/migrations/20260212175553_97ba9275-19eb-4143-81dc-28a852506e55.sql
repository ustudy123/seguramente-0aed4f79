
-- Auto-block professionals with expired registration
CREATE OR REPLACE FUNCTION public.verificar_registro_profissional()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Block if registration expired
  IF NEW.registro_validade IS NOT NULL AND NEW.registro_validade < CURRENT_DATE THEN
    NEW.status := 'bloqueado';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_verificar_registro_profissional
  BEFORE INSERT OR UPDATE ON public.marketplace_profissionais
  FOR EACH ROW
  EXECUTE FUNCTION public.verificar_registro_profissional();

-- Scheduled check: block all expired professionals (to be called periodically)
CREATE OR REPLACE FUNCTION public.bloquear_profissionais_expirados()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.marketplace_profissionais
  SET status = 'bloqueado'
  WHERE registro_validade < CURRENT_DATE
    AND status = 'ativo';
END;
$$;

-- Log table for marketplace audit
CREATE TABLE public.marketplace_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id),
  contratacao_id UUID REFERENCES public.marketplace_contratacoes(id),
  profissional_id UUID REFERENCES public.marketplace_profissionais(id),
  acao TEXT NOT NULL,
  descricao TEXT,
  dados Json,
  usuario_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.marketplace_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members view own audit" ON public.marketplace_audit_log FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "System can insert audit" ON public.marketplace_audit_log FOR INSERT TO authenticated WITH CHECK (true);
