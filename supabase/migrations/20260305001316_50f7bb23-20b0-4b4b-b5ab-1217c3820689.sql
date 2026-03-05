
CREATE TABLE IF NOT EXISTS public.programa_validador_documento_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.programa_validador_clientes(id) ON DELETE CASCADE,
  documento_id UUID REFERENCES public.programa_validador_documentos(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL,
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'visualizado', 'aceito', 'recusado')),
  html_documento TEXT NOT NULL,
  aceito_em TIMESTAMP WITH TIME ZONE NULL,
  aceito_por TEXT NULL,
  recusado_em TIMESTAMP WITH TIME ZONE NULL,
  motivo_recusa TEXT NULL,
  expira_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.programa_validador_documento_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin_all_doc_links"
  ON public.programa_validador_documento_links
  FOR ALL
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "public_read_by_token"
  ON public.programa_validador_documento_links
  FOR SELECT
  USING (true);

CREATE POLICY "public_update_by_token"
  ON public.programa_validador_documento_links
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_doc_links_updated_at
  BEFORE UPDATE ON public.programa_validador_documento_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
