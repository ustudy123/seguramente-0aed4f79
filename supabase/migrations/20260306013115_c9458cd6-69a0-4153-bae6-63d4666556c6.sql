
-- Vincular departamentos órfãos criados durante a importação à empresa BARROS & NUERNBERG (CNPJ: 26114701000145)
UPDATE departamentos
SET empresa_id = '79781a37-7f16-4828-9696-db63b60aa51e'
WHERE empresa_id IS NULL
  AND id IN (
    '7f2b5964-7a75-4c6f-8e87-86dbd182b529',
    '6de8ff1f-5322-493a-8ff1-2daf28527f19',
    '816e766f-986d-44b1-8ca4-eda733136a36'
  );

-- Vincular cargos órfãos criados durante a importação à empresa BARROS & NUERNBERG (CNPJ: 26114701000145)
UPDATE cargos
SET empresa_id = '79781a37-7f16-4828-9696-db63b60aa51e'
WHERE empresa_id IS NULL
  AND id IN (
    '442717a4-4f48-4338-84b5-25326b0975a4',
    'b6a316d8-904e-4336-86fb-bc1e1f66ae25',
    'aaef85cb-bf17-40a0-9967-34d0464da29d',
    'eea45065-45b8-46e7-86fd-0f66ad0cb6a8',
    'd05758ef-eb17-4894-906a-b4fce6c35e9d'
  );
