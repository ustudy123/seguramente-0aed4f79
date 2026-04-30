DELETE FROM public.perfil_permissoes pp
USING public.perfis_acesso pa
WHERE pp.perfil_id = pa.id
  AND pa.nome = 'Colaborador com Acesso'
  AND pp.modulo = 'colaboradores';

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id, tenant_id FROM public.perfis_acesso WHERE nome = 'Colaborador com Acesso'
  LOOP
    INSERT INTO public.perfil_permissoes (perfil_id, tenant_id, modulo, acao, escopo, ativo)
    VALUES
      (r.id, r.tenant_id, 'trilhas', 'visualizar', 'proprio_usuario', true),
      (r.id, r.tenant_id, 'bem_estar', 'visualizar', 'proprio_usuario', true),
      (r.id, r.tenant_id, 'bem_estar', 'criar', 'proprio_usuario', true),
      (r.id, r.tenant_id, 'pdi', 'visualizar', 'proprio_usuario', true),
      (r.id, r.tenant_id, 'pdi', 'editar', 'proprio_usuario', true),
      (r.id, r.tenant_id, 'ouvidoria', 'criar', 'proprio_usuario', true)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;