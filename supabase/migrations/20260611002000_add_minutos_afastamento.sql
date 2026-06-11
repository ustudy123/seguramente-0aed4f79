-- Adiciona coluna de minutos ao atestado (campo de horas só aceitava inteiro)
ALTER TABLE public.atestados
ADD COLUMN IF NOT EXISTS minutos_afastamento INTEGER DEFAULT 0;

COMMENT ON COLUMN public.atestados.minutos_afastamento IS 'Minutos complementares ao campo horas_afastamento (0-59)';
