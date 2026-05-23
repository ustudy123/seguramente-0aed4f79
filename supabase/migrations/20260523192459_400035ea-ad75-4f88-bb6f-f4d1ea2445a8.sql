
INSERT INTO public.perfil_permissoes (perfil_id, tenant_id, modulo, acao, escopo, ativo)
SELECT p.id, p.tenant_id, m.modulo, m.acao::perfil_acao, 'subordinados_diretos'::perfil_escopo_tipo, true
FROM public.perfis_acesso p
CROSS JOIN (VALUES
  ('ponto','aprovar'),
  ('ponto','visualizar'),
  ('colaboradores','visualizar'),
  ('ferias','aprovar'),
  ('ferias','visualizar'),
  ('feedback','visualizar'),
  ('feedback','criar')
) AS m(modulo, acao)
WHERE p.nome = 'Gestor de Departamento'
  AND NOT EXISTS (
    SELECT 1 FROM public.perfil_permissoes pp
    WHERE pp.perfil_id = p.id AND pp.modulo = m.modulo AND pp.acao::text = m.acao
  );
