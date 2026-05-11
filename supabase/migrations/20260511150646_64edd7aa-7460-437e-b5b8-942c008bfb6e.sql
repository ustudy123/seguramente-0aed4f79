UPDATE public.terceiros
SET cnpj = regexp_replace(cnpj, '\D', '', 'g')
WHERE cnpj IS NOT NULL AND cnpj ~ '\D';