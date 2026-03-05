
-- Add activation fields to programa_validador_clientes
ALTER TABLE public.programa_validador_clientes
  ADD COLUMN IF NOT EXISTS activation_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS activation_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS conta_ativada BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS conta_ativada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS aceite_ip TEXT,
  ADD COLUMN IF NOT EXISTS aceite_user_agent TEXT,
  ADD COLUMN IF NOT EXISTS aceite_termos_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS aceite_versao_termos TEXT DEFAULT '1.0';

-- Generate activation tokens for existing clients without one
UPDATE public.programa_validador_clientes
SET activation_token = encode(gen_random_bytes(32), 'hex'),
    activation_token_expires_at = NOW() + INTERVAL '30 days'
WHERE activation_token IS NULL;
