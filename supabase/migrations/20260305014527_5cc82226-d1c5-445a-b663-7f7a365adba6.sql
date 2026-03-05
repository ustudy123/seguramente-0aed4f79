
ALTER TABLE public.programa_validador_documento_links
  ADD COLUMN IF NOT EXISTS html_assinado TEXT,
  ADD COLUMN IF NOT EXISTS aceito_por TEXT,
  ADD COLUMN IF NOT EXISTS recusado_em TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS motivo_recusa TEXT;
