ALTER TABLE public.programa_validador_clientes ADD COLUMN IF NOT EXISTS onboarding_token UUID DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS idx_pvclientes_onboarding_token ON public.programa_validador_clientes(onboarding_token);
UPDATE public.programa_validador_clientes SET onboarding_token = gen_random_uuid() WHERE onboarding_token IS NULL;