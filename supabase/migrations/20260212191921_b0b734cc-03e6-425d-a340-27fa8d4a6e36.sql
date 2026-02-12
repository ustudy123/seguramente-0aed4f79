
-- Schedule cron job for P4: revalidation of expired professional licenses
-- Runs daily at 3 AM UTC
SELECT cron.schedule(
  'bloquear-profissionais-expirados',
  '0 3 * * *',
  $$SELECT public.bloquear_profissionais_expirados()$$
);
