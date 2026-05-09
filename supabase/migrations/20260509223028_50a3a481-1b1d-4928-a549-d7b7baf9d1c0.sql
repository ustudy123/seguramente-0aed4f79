
ALTER TABLE public.landing_leads
  ADD COLUMN IF NOT EXISTS landing_page_origem text,
  ADD COLUMN IF NOT EXISTS num_funcionarios text,
  ADD COLUMN IF NOT EXISTS cargo text,
  ADD COLUMN IF NOT EXISTS setor text,
  ADD COLUMN IF NOT EXISTS urgencia text,
  ADD COLUMN IF NOT EXISTS perfil_diagnostico text;

CREATE INDEX IF NOT EXISTS idx_landing_leads_origem ON public.landing_leads(landing_page_origem);
CREATE INDEX IF NOT EXISTS idx_landing_leads_perfil ON public.landing_leads(perfil_diagnostico);
