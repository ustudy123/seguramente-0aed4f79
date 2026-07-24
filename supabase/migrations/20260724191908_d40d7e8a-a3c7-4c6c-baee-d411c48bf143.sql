
CREATE TABLE public.assinaturas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plano_id TEXT NOT NULL,
  plano_nome TEXT NOT NULL,
  ciclo TEXT NOT NULL,
  preco_mensal NUMERIC(12,2) NOT NULL,
  valor_total NUMERIC(12,2) NOT NULL,
  meses INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payer_email TEXT,
  preference_id TEXT,
  payment_id TEXT UNIQUE,
  external_reference TEXT,
  payment_method TEXT,
  raw_payload JSONB,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assinaturas_payment_id ON public.assinaturas(payment_id);
CREATE INDEX idx_assinaturas_preference_id ON public.assinaturas(preference_id);
CREATE INDEX idx_assinaturas_external_ref ON public.assinaturas(external_reference);
CREATE INDEX idx_assinaturas_status ON public.assinaturas(status);

GRANT ALL ON public.assinaturas TO service_role;

ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assinaturas service role only"
  ON public.assinaturas FOR ALL
  USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.tg_assinaturas_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER assinaturas_updated_at
  BEFORE UPDATE ON public.assinaturas
  FOR EACH ROW EXECUTE FUNCTION public.tg_assinaturas_updated_at();
