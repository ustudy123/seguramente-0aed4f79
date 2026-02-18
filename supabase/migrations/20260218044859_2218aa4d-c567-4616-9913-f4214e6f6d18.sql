
-- Add columns to trilhas for public third-party access
ALTER TABLE public.trilhas
ADD COLUMN IF NOT EXISTS publico_terceiros BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS token_publico TEXT UNIQUE DEFAULT NULL;

-- Create table for third-party progress (no auth required)
CREATE TABLE public.trilha_terceiro_progresso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  trilha_id UUID NOT NULL REFERENCES public.trilhas(id) ON DELETE CASCADE,
  modulo_id UUID NOT NULL REFERENCES public.trilha_modulos(id) ON DELETE CASCADE,
  terceiro_nome TEXT NOT NULL,
  terceiro_cpf TEXT NOT NULL,
  terceiro_empresa TEXT,
  status TEXT NOT NULL DEFAULT 'nao_iniciado' CHECK (status IN ('nao_iniciado', 'em_andamento', 'concluido')),
  nota NUMERIC,
  evidencia_url TEXT,
  evidencia_texto TEXT,
  data_inicio TIMESTAMPTZ,
  data_conclusao TIMESTAMPTZ,
  pontos_obtidos INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, trilha_id, modulo_id, terceiro_cpf)
);

-- Enable RLS
ALTER TABLE public.trilha_terceiro_progresso ENABLE ROW LEVEL SECURITY;

-- Policy: anon can insert/update/select on public trilhas (via token validation in app)
CREATE POLICY "Public read for terceiro progresso"
  ON public.trilha_terceiro_progresso FOR SELECT
  USING (true);

CREATE POLICY "Public insert for terceiro progresso"
  ON public.trilha_terceiro_progresso FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public update for terceiro progresso"
  ON public.trilha_terceiro_progresso FOR UPDATE
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_trilha_terceiro_progresso_updated_at
  BEFORE UPDATE ON public.trilha_terceiro_progresso
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Policy: anon can read trilhas that are public for terceiros (via token)
CREATE POLICY "Public read trilhas with token"
  ON public.trilhas FOR SELECT
  USING (publico_terceiros = true AND token_publico IS NOT NULL);

-- Policy: anon can read modules of public trilhas
CREATE POLICY "Public read modulos of public trilhas"
  ON public.trilha_modulos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trilhas t
      WHERE t.id = trilha_id
      AND t.publico_terceiros = true
      AND t.token_publico IS NOT NULL
    )
  );
