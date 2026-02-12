
-- Delete child pastas of duplicate colaborador folders
DELETE FROM documento_pastas WHERE pasta_pai_id IN ('574b5701-3412-4940-a9b5-7a4a2407c2e3', '5ec92659-2605-43e9-a26d-f39966cffc40', '58bcc602-a969-4594-a7ef-d8f31fc93d6a');

-- Delete duplicate colaborador folders (keep oldest per colaborador_id)
DELETE FROM documento_pastas WHERE id IN ('574b5701-3412-4940-a9b5-7a4a2407c2e3', '5ec92659-2605-43e9-a26d-f39966cffc40', '58bcc602-a969-4594-a7ef-d8f31fc93d6a');

-- Rename "Prontuários de Colaboradores" to "Documentos de Colaboradores"
UPDATE documento_pastas SET nome = 'Documentos de Colaboradores' WHERE id = '0d3795a2-1f2c-40c4-b9f4-07ad60f91192';

-- Add unique constraint to prevent duplicate colaborador folders
CREATE UNIQUE INDEX IF NOT EXISTS idx_documento_pastas_unique_colaborador 
ON documento_pastas (tenant_id, colaborador_id) 
WHERE tipo = 'colaborador' AND colaborador_id IS NOT NULL;
