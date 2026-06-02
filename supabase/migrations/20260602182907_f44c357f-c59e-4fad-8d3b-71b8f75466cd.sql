INSERT INTO public.usuario_vinculos (tenant_id, usuario_id, empresa_id, tipo_vinculo, status, data_inicio, observacoes)
SELECT '299779a8-1cd2-4ffe-9462-78181426cd1a', '35dba579-5cc8-4255-bb38-1fc2b42438c3', e.empresa_id, 'gestor', 'ativo', CURRENT_DATE,
       'Vínculo criado via suporte - solicitação WhatsApp'
FROM (VALUES
  ('6c93bac2-2b22-4a40-a3ee-f2b7e214ae83'::uuid),
  ('c7af79a2-7755-4620-ad1d-c2eb02cfcb73'::uuid),
  ('fc7adbfd-5e58-4d7e-8ace-af1dbc61d3b1'::uuid),
  ('bf9f6cfe-fc71-4a87-9db1-b9fd93209c93'::uuid)
) AS e(empresa_id)
WHERE NOT EXISTS (
  SELECT 1 FROM public.usuario_vinculos v
  WHERE v.usuario_id = '35dba579-5cc8-4255-bb38-1fc2b42438c3'
    AND v.empresa_id = e.empresa_id
    AND v.status = 'ativo'
);