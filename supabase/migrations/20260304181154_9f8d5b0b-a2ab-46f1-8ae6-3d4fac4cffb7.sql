
-- Add pdi_id to feedbacks table to link feedback from PDI module
ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS pdi_id UUID REFERENCES public.pdis(id) ON DELETE SET NULL;
ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS pdi_titulo TEXT;
