ALTER TABLE public.afastamentos_cat ADD COLUMN IF NOT EXISTS numero_cat text;
COMMENT ON COLUMN public.afastamentos_cat.numero_cat IS 'Número/registro da CAT emitida; se vazio, gera pendência de CAT no RH.';
