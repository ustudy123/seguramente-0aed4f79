-- Fix orphaned documents: link them to their collaborator's folder
UPDATE documentos d
SET pasta_id = dp.id
FROM documento_pastas dp
WHERE d.pasta_id IS NULL
  AND d.colaborador_id IS NOT NULL
  AND dp.colaborador_id = d.colaborador_id
  AND dp.tipo = 'colaborador'
  AND dp.tenant_id = d.tenant_id;