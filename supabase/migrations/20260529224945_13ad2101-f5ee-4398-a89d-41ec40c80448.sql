DELETE FROM public.usuario_vinculos 
WHERE (usuario_id = '299779a8-1cd2-4ffe-9462-78181426cd1a' OR usuario_id = '0ac509f9-d0a5-4d1d-8df9-afa5aedcadb8')
AND empresa_id = '377bfeec-673f-4658-bceb-21b5167f8105';

INSERT INTO public.usuario_vinculos (
  tenant_id,
  usuario_id, 
  empresa_id, 
  tipo_vinculo, 
  status, 
  created_at
) VALUES (
  '299779a8-1cd2-4ffe-9462-78181426cd1a',
  '35dba579-5cc8-4255-bb38-1fc2b42438c3', 
  '377bfeec-673f-4658-bceb-21b5167f8105', 
  'gestor', 
  'ativo', 
  now()
);