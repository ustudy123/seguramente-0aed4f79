ALTER TABLE public.cargos 
ADD COLUMN IF NOT EXISTS requisitos_formacao TEXT,
ADD COLUMN IF NOT EXISTS requisitos_experiencia TEXT;

COMMENT ON COLUMN public.cargos.requisitos_formacao IS 'Escolaridade e formação acadêmica exigida para o cargo';
COMMENT ON COLUMN public.cargos.requisitos_experiencia IS 'Tempo e tipo de experiência profissional desejada';
