ALTER TABLE public.assinaturas
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.programa_validador_clientes(id),
  ADD COLUMN IF NOT EXISTS tenant_id uuid,
  ADD COLUMN IF NOT EXISTS activation_email_sent_at timestamptz;