ALTER TABLE public.psicossocial_ghe
  ADD COLUMN IF NOT EXISTS ausencias_justificadas INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS percentual_minimo NUMERIC(5,2) NOT NULL DEFAULT 0;

ALTER TABLE public.psicossocial_ghe
  ADD CONSTRAINT psicossocial_ghe_ausencias_nonneg CHECK (ausencias_justificadas >= 0),
  ADD CONSTRAINT psicossocial_ghe_pct_range CHECK (percentual_minimo >= 0 AND percentual_minimo <= 100);