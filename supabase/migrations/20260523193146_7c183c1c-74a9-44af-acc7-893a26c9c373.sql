ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_leads_deleted_at ON public.leads(deleted_at);