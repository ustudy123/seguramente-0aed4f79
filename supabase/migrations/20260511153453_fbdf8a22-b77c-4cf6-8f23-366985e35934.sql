-- NR-17 items são dados normativos: tornar tenant-global (empresa_id NULL)
UPDATE public.ergonomia_itens_nr17 SET empresa_id = NULL WHERE empresa_id IS NOT NULL;