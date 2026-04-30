-- Backfill: mark onboarding as concluded for users in tenants that already have empresa_cadastro
UPDATE public.profiles
SET onboarding_concluido = true
WHERE onboarding_concluido = false
  AND tenant_id IN (SELECT DISTINCT tenant_id FROM public.empresa_cadastro WHERE tenant_id IS NOT NULL);