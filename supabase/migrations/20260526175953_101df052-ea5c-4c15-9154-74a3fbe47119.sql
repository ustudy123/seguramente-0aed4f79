DELETE FROM public.usuario_vinculos
WHERE empresa_id IN (
  SELECT id FROM public.empresa_cadastro
  WHERE tipo_pessoa = 'pf'
    AND tenant_id = '299779a8-1cd2-4ffe-9462-78181426cd1a'
    AND created_at >= '2026-05-26 17:51:00+00'
    AND created_at <  '2026-05-26 17:53:00+00'
);

DELETE FROM public.empresa_cadastro
WHERE tipo_pessoa = 'pf'
  AND tenant_id = '299779a8-1cd2-4ffe-9462-78181426cd1a'
  AND created_at >= '2026-05-26 17:51:00+00'
  AND created_at <  '2026-05-26 17:53:00+00';