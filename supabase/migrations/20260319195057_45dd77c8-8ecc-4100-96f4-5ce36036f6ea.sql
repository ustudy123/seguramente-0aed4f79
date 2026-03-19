-- Add tipo_usuario_sugerido column to perfis_acesso
ALTER TABLE public.perfis_acesso ADD COLUMN IF NOT EXISTS tipo_usuario_sugerido text;

-- Seed default perfis for all tenants that don't have any
INSERT INTO public.perfis_acesso (tenant_id, nome, descricao, cor, tipo, ativo, permite_acumulo, total_usuarios, tipo_usuario_sugerido)
SELECT t.id, p.nome, p.descricao, p.cor, 'padrao_sistema', true, false, 0, p.tipo_usuario_sugerido
FROM public.tenants t
CROSS JOIN (VALUES
  ('Administrador Master', 'Acesso total à plataforma, incluindo configurações e gestão de usuários.', '#dc2626', 'admin'),
  ('Gestor / Líder', 'Acesso aos módulos de gestão de equipe, SST e indicadores.', '#059669', 'gestor'),
  ('RH / Gestão de Pessoas', 'Acesso aos módulos de RH, admissões, folha e benefícios.', '#7c3aed', 'rh_dp'),
  ('Financeiro / Administrativo', 'Acesso ao hub contábil, guias e relatórios financeiros.', '#0891b2', 'financeiro'),
  ('Profissional SST / Clínica', 'Acesso aos módulos de SST, atestados, ergonomia e saúde.', '#b45309', 'sst'),
  ('Colaborador com Acesso', 'Acesso básico: perfil, trilhas, bem-estar e academia.', '#d97706', 'colaborador'),
  ('Consultor Externo', 'Acesso restrito para consultores e auditores externos.', '#475569', 'consultor')
) AS p(nome, descricao, cor, tipo_usuario_sugerido)
WHERE NOT EXISTS (
  SELECT 1 FROM public.perfis_acesso pa WHERE pa.tenant_id = t.id
);