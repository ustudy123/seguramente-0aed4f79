
-- Drop overly permissive policies
DROP POLICY IF EXISTS "Public insert for terceiro progresso" ON public.trilha_terceiro_progresso;
DROP POLICY IF EXISTS "Public update for terceiro progresso" ON public.trilha_terceiro_progresso;
DROP POLICY IF EXISTS "Public read for terceiro progresso" ON public.trilha_terceiro_progresso;

-- Tighter policies: only allow operations on progresso linked to public trilhas
CREATE POLICY "Terceiro can read own progresso"
  ON public.trilha_terceiro_progresso FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trilhas t
      WHERE t.id = trilha_id
      AND t.publico_terceiros = true
      AND t.token_publico IS NOT NULL
    )
  );

CREATE POLICY "Terceiro can insert progresso on public trilhas"
  ON public.trilha_terceiro_progresso FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trilhas t
      WHERE t.id = trilha_id
      AND t.publico_terceiros = true
      AND t.token_publico IS NOT NULL
    )
  );

CREATE POLICY "Terceiro can update own progresso on public trilhas"
  ON public.trilha_terceiro_progresso FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.trilhas t
      WHERE t.id = trilha_id
      AND t.publico_terceiros = true
      AND t.token_publico IS NOT NULL
    )
  );

-- Authenticated users (admins) can also read all terceiro progresso for their tenant
CREATE POLICY "Admins read terceiro progresso"
  ON public.trilha_terceiro_progresso FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id());
