DELETE FROM public.usuario_vinculos
WHERE empresa_id IN (
  SELECT id FROM public.empresa_cadastro
  WHERE tenant_id = '299779a8-1cd2-4ffe-9462-78181426cd1a'
    AND regexp_replace(coalesce(cnpj,''), '\D', '', 'g') LIKE '0946163900%'
);

DELETE FROM public.empresa_cadastro
WHERE tenant_id = '299779a8-1cd2-4ffe-9462-78181426cd1a'
  AND regexp_replace(coalesce(cnpj,''), '\D', '', 'g') LIKE '0946163900%';