
-- Tabela de leads da landing page
CREATE TABLE public.landing_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT,
  empresa TEXT,
  diagnostico_resultado JSONB,
  pontuacao_diagnostico INTEGER,
  convertido BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de controle de vagas
CREATE TABLE public.landing_vagas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_vagas INTEGER NOT NULL DEFAULT 10,
  vagas_preenchidas INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.landing_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_vagas ENABLE ROW LEVEL SECURITY;

-- Leads: insert público (anon), select para superadmins
CREATE POLICY "Anyone can insert leads" ON public.landing_leads
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Superadmins can view leads" ON public.landing_leads
  FOR SELECT TO authenticated USING (public.is_superadmin(auth.uid()));

CREATE POLICY "Superadmins can update leads" ON public.landing_leads
  FOR UPDATE TO authenticated USING (public.is_superadmin(auth.uid()));

-- Vagas: leitura pública, update para superadmins
CREATE POLICY "Anyone can read vagas" ON public.landing_vagas
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Superadmins can update vagas" ON public.landing_vagas
  FOR UPDATE TO authenticated USING (public.is_superadmin(auth.uid()));

-- Inserir registro inicial de vagas
INSERT INTO public.landing_vagas (total_vagas, vagas_preenchidas) VALUES (10, 0);

-- Trigger para updated_at
CREATE TRIGGER update_landing_leads_updated_at
  BEFORE UPDATE ON public.landing_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_landing_vagas_updated_at
  BEFORE UPDATE ON public.landing_vagas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
