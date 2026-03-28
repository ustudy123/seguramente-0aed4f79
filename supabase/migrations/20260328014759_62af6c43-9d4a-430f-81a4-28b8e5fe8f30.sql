ALTER TABLE public.ponto_configuracao 
  ADD COLUMN IF NOT EXISTS modo_registro TEXT NOT NULL DEFAULT 'ambos' 
    CHECK (modo_registro IN ('interno', 'link_externo', 'ambos')),
  ADD COLUMN IF NOT EXISTS exigir_selfie_link BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS exigir_selfie_interno BOOLEAN NOT NULL DEFAULT false;