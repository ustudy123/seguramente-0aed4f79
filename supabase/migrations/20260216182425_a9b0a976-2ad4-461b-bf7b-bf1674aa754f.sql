
CREATE TABLE public.lembretes_dispensados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  usuario_id UUID NOT NULL,
  chave TEXT NOT NULL, -- ex: "aniv-<admissao_id>-2026" ou "tempo-<admissao_id>-2026"
  dispensado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lembretes_dispensados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dismissals"
  ON public.lembretes_dispensados FOR SELECT
  USING (auth.uid() = usuario_id);

CREATE POLICY "Users can dismiss reminders"
  ON public.lembretes_dispensados FOR INSERT
  WITH CHECK (auth.uid() = usuario_id);

CREATE UNIQUE INDEX idx_lembretes_dispensados_unique
  ON public.lembretes_dispensados (tenant_id, usuario_id, chave);
