
UPDATE admissoes
SET empresa_id = '79781a37-7f16-4828-9696-db63b60aa51e'
WHERE empresa_id IS NULL
  AND tenant_id = (
    SELECT tenant_id FROM empresa_cadastro WHERE id = '79781a37-7f16-4828-9696-db63b60aa51e'
  )
  AND created_at >= '2026-03-06 01:00:00+00'
  AND created_at <= '2026-03-06 02:00:00+00';
