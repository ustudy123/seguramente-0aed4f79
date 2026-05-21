-- Tornar profissionais visíveis a todas as empresas por padrão
ALTER TABLE public.marketplace_profissionais
  ALTER COLUMN status SET DEFAULT 'ativo'::marketplace_profissional_status;

UPDATE public.marketplace_profissionais
  SET status = 'ativo'
  WHERE status = 'pendente';