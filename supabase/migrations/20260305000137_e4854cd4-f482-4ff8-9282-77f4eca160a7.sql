CREATE TABLE IF NOT EXISTS public.programa_validador_contratos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.programa_validador_clientes(id) ON DELETE CASCADE,
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'enviado', 'assinado', 'recusado')),
  html_contrato TEXT NOT NULL,
  html_assinado TEXT,
  assinatura_img TEXT,
  assinado_em TIMESTAMP WITH TIME ZONE,
  assinado_por TEXT,
  ip_assinatura TEXT,
  expira_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  enviado_em TIMESTAMP WITH TIME ZONE,
  storage_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.programa_validador_contratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SuperAdmins full access contratos" ON public.programa_validador_contratos
  FOR ALL USING (public.is_superadmin(auth.uid()));

CREATE POLICY "Public token select contratos" ON public.programa_validador_contratos
  FOR SELECT USING (true);

CREATE POLICY "Public token update contratos" ON public.programa_validador_contratos
  FOR UPDATE USING (true);

CREATE TRIGGER update_programa_validador_contratos_updated_at
  BEFORE UPDATE ON public.programa_validador_contratos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.programa_validador_clientes 
  ADD COLUMN IF NOT EXISTS endereco TEXT,
  ADD COLUMN IF NOT EXISTS representante TEXT,
  ADD COLUMN IF NOT EXISTS cidade_foro TEXT DEFAULT 'São Paulo';