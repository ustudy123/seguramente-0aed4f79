CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.cbo_ocupacoes (
  codigo TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cbo_ocupacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "CBO is readable by everyone" ON public.cbo_ocupacoes;
CREATE POLICY "CBO is readable by everyone"
  ON public.cbo_ocupacoes FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_cbo_titulo_trgm ON public.cbo_ocupacoes USING gin (lower(titulo) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_cbo_codigo_prefix ON public.cbo_ocupacoes (codigo text_pattern_ops);

ALTER TABLE public.admissoes ADD COLUMN IF NOT EXISTS cbo TEXT;
CREATE INDEX IF NOT EXISTS idx_admissoes_cbo ON public.admissoes (cbo);