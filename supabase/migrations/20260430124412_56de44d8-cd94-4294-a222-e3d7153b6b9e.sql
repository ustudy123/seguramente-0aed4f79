ALTER TABLE public.admissoes ALTER COLUMN email DROP NOT NULL;

-- Desabilita temporariamente triggers para que o UPDATE de limpeza não dispare
-- a criação automática de contratos de experiência (que exige data_admissao).
ALTER TABLE public.admissoes DISABLE TRIGGER USER;

UPDATE public.admissoes
SET email = NULL
WHERE email LIKE '%@importado.temp'
   OR email LIKE '%@placeholder.com';

ALTER TABLE public.admissoes ENABLE TRIGGER USER;