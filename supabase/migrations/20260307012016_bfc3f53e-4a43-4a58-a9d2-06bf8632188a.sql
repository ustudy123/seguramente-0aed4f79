
-- =========================================================
-- MÓDULO: PERFIS E NÍVEIS DE ACESSO
-- =========================================================

-- Enum para tipos de escopo de dados
CREATE TYPE public.perfil_escopo_tipo AS ENUM (
  'proprio_usuario',
  'subordinados_diretos',
  'equipe_direta_indireta',
  'setor',
  'unidade',
  'empresa_inteira',
  'grupo_economico',
  'multiplas_empresas',
  'carteira_clientes',
  'customizado'
);

-- Enum para ações de permissão
CREATE TYPE public.perfil_acao AS ENUM (
  'visualizar',
  'criar',
  'editar',
  'excluir',
  'inativar',
  'exportar',
  'importar',
  'aprovar',
  'assinar',
  'compartilhar',
  'parametrizar',
  'administrar',
  'acessar_sensivel',
  'acessar_anonimizado',
  'ver_indicadores',
  'ver_individual'
);

-- =========================================================
-- TABELA: perfil_templates
-- =========================================================
CREATE TABLE public.perfil_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  icone TEXT,
  cor TEXT,
  tipo_usuario_sugerido TEXT,
  modulos_padrao JSONB DEFAULT '[]'::jsonb,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =========================================================
-- TABELA: perfis_acesso
-- =========================================================
CREATE TABLE public.perfis_acesso (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  icone TEXT,
  cor TEXT DEFAULT '#6366f1',
  template_origem_id UUID REFERENCES public.perfil_templates(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL DEFAULT 'personalizado',
  ativo BOOLEAN NOT NULL DEFAULT true,
  permite_acumulo BOOLEAN NOT NULL DEFAULT false,
  expira_em TIMESTAMP WITH TIME ZONE,
  total_usuarios INTEGER NOT NULL DEFAULT 0,
  criado_por UUID,
  criado_por_nome TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, nome)
);

-- =========================================================
-- TABELA: perfil_permissoes
-- =========================================================
CREATE TABLE public.perfil_permissoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  perfil_id UUID NOT NULL REFERENCES public.perfis_acesso(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  modulo TEXT NOT NULL,
  recurso TEXT,
  acao perfil_acao NOT NULL,
  escopo perfil_escopo_tipo NOT NULL DEFAULT 'empresa_inteira',
  ativo BOOLEAN NOT NULL DEFAULT true,
  requer_2fa BOOLEAN NOT NULL DEFAULT false,
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =========================================================
-- TABELA: usuario_perfil_vinculos
-- =========================================================
CREATE TABLE public.usuario_perfil_vinculos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL,
  empresa_id UUID REFERENCES public.empresa_cadastro(id) ON DELETE CASCADE,
  perfil_id UUID NOT NULL REFERENCES public.perfis_acesso(id) ON DELETE RESTRICT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  atribuido_por UUID,
  atribuido_por_nome TEXT,
  expira_em TIMESTAMP WITH TIME ZONE,
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =========================================================
-- TABELA: perfil_excecoes
-- =========================================================
CREATE TABLE public.perfil_excecoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL,
  empresa_id UUID REFERENCES public.empresa_cadastro(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'adicional',
  modulo TEXT NOT NULL,
  recurso TEXT,
  acao perfil_acao NOT NULL,
  escopo perfil_escopo_tipo NOT NULL DEFAULT 'empresa_inteira',
  ativo BOOLEAN NOT NULL DEFAULT true,
  justificativa TEXT,
  expira_em TIMESTAMP WITH TIME ZONE,
  criado_por UUID,
  criado_por_nome TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =========================================================
-- TABELA: perfil_audit_log
-- =========================================================
CREATE TABLE public.perfil_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  perfil_id UUID REFERENCES public.perfis_acesso(id) ON DELETE SET NULL,
  usuario_alvo_id UUID,
  acao TEXT NOT NULL,
  descricao TEXT,
  dados_anteriores JSONB,
  dados_novos JSONB,
  realizado_por UUID,
  realizado_por_nome TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =========================================================
-- INDEXES
-- =========================================================
CREATE INDEX idx_perfis_acesso_tenant ON public.perfis_acesso(tenant_id);
CREATE INDEX idx_perfil_permissoes_perfil ON public.perfil_permissoes(perfil_id);
CREATE INDEX idx_perfil_permissoes_tenant ON public.perfil_permissoes(tenant_id);
CREATE INDEX idx_usuario_perfil_vinculos_tenant ON public.usuario_perfil_vinculos(tenant_id);
CREATE INDEX idx_usuario_perfil_vinculos_usuario ON public.usuario_perfil_vinculos(usuario_id);
CREATE INDEX idx_perfil_excecoes_usuario ON public.perfil_excecoes(usuario_id, tenant_id);
CREATE INDEX idx_perfil_audit_tenant ON public.perfil_audit_log(tenant_id);

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================
ALTER TABLE public.perfil_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfis_acesso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfil_permissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_perfil_vinculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfil_excecoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfil_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados podem ver templates" ON public.perfil_templates
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Usuarios veem perfis do seu tenant" ON public.perfis_acesso
  FOR SELECT USING (tenant_id = public.get_user_tenant_id() OR public.is_superadmin(auth.uid()));

CREATE POLICY "Admins gerenciam perfis do tenant" ON public.perfis_acesso
  FOR ALL USING (
    (public.has_minimum_role(auth.uid(), 'admin') AND tenant_id = public.get_user_tenant_id())
    OR public.is_superadmin(auth.uid())
  );

CREATE POLICY "Usuarios veem permissoes do seu tenant" ON public.perfil_permissoes
  FOR SELECT USING (tenant_id = public.get_user_tenant_id() OR public.is_superadmin(auth.uid()));

CREATE POLICY "Admins gerenciam permissoes do tenant" ON public.perfil_permissoes
  FOR ALL USING (
    (public.has_minimum_role(auth.uid(), 'admin') AND tenant_id = public.get_user_tenant_id())
    OR public.is_superadmin(auth.uid())
  );

CREATE POLICY "Usuarios veem vinculos do seu tenant" ON public.usuario_perfil_vinculos
  FOR SELECT USING (tenant_id = public.get_user_tenant_id() OR public.is_superadmin(auth.uid()));

CREATE POLICY "Admins gerenciam vinculos do tenant" ON public.usuario_perfil_vinculos
  FOR ALL USING (
    (public.has_minimum_role(auth.uid(), 'admin') AND tenant_id = public.get_user_tenant_id())
    OR public.is_superadmin(auth.uid())
  );

CREATE POLICY "Usuarios veem excecoes do seu tenant" ON public.perfil_excecoes
  FOR SELECT USING (tenant_id = public.get_user_tenant_id() OR public.is_superadmin(auth.uid()));

CREATE POLICY "Admins gerenciam excecoes do tenant" ON public.perfil_excecoes
  FOR ALL USING (
    (public.has_minimum_role(auth.uid(), 'admin') AND tenant_id = public.get_user_tenant_id())
    OR public.is_superadmin(auth.uid())
  );

CREATE POLICY "Admins veem audit log do tenant" ON public.perfil_audit_log
  FOR SELECT USING (
    (public.has_minimum_role(auth.uid(), 'admin') AND tenant_id = public.get_user_tenant_id())
    OR public.is_superadmin(auth.uid())
  );

CREATE POLICY "Sistema insere no audit log" ON public.perfil_audit_log
  FOR INSERT WITH CHECK (
    tenant_id = public.get_user_tenant_id() OR public.is_superadmin(auth.uid())
  );

-- =========================================================
-- TRIGGERS
-- =========================================================
CREATE TRIGGER update_perfis_acesso_updated_at
  BEFORE UPDATE ON public.perfis_acesso
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_usuario_perfil_vinculos_updated_at
  BEFORE UPDATE ON public.usuario_perfil_vinculos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.atualizar_total_usuarios_perfil()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.perfis_acesso
  SET total_usuarios = (
    SELECT COUNT(*) FROM public.usuario_perfil_vinculos
    WHERE perfil_id = COALESCE(NEW.perfil_id, OLD.perfil_id) AND ativo = true
  )
  WHERE id = COALESCE(NEW.perfil_id, OLD.perfil_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trigger_atualizar_total_usuarios_perfil
  AFTER INSERT OR UPDATE OR DELETE ON public.usuario_perfil_vinculos
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_total_usuarios_perfil();

-- =========================================================
-- SEED: Templates do sistema
-- =========================================================
INSERT INTO public.perfil_templates (nome, descricao, icone, cor, tipo_usuario_sugerido, modulos_padrao) VALUES
(
  'Administrador Master',
  'Acesso completo a todos os módulos contratados. Ideal para sócios, diretores e responsáveis legais.',
  'ShieldCheck',
  '#dc2626',
  'administrador',
  '[{"modulo":"colaboradores","acoes":["visualizar","criar","editar","excluir","exportar","importar"],"escopo":"empresa_inteira"},{"modulo":"usuarios","acoes":["visualizar","criar","editar","excluir","administrar"],"escopo":"empresa_inteira"},{"modulo":"perfis_acesso","acoes":["visualizar","criar","editar","excluir","administrar"],"escopo":"empresa_inteira"},{"modulo":"financeiro","acoes":["visualizar","criar","editar","exportar"],"escopo":"empresa_inteira"},{"modulo":"psicossocial","acoes":["visualizar","criar","editar","exportar","acessar_sensivel"],"escopo":"empresa_inteira"},{"modulo":"sst","acoes":["visualizar","criar","editar","excluir","exportar"],"escopo":"empresa_inteira"},{"modulo":"configuracoes","acoes":["visualizar","editar","administrar"],"escopo":"empresa_inteira"}]'::jsonb
),
(
  'RH / Gestão de Pessoas',
  'Gestão completa de pessoas, admissões, PDI, trilhas e indicadores organizacionais.',
  'Users',
  '#7c3aed',
  'rh_dp',
  '[{"modulo":"colaboradores","acoes":["visualizar","criar","editar","exportar","importar"],"escopo":"empresa_inteira"},{"modulo":"admissoes","acoes":["visualizar","criar","editar","exportar"],"escopo":"empresa_inteira"},{"modulo":"pdi","acoes":["visualizar","criar","editar","exportar"],"escopo":"empresa_inteira"},{"modulo":"trilhas","acoes":["visualizar","criar","editar","exportar"],"escopo":"empresa_inteira"},{"modulo":"avaliacoes","acoes":["visualizar","criar","editar","exportar"],"escopo":"empresa_inteira"},{"modulo":"psicossocial","acoes":["visualizar","ver_indicadores","acessar_anonimizado"],"escopo":"empresa_inteira"},{"modulo":"ouvidoria","acoes":["visualizar","ver_indicadores"],"escopo":"empresa_inteira"}]'::jsonb
),
(
  'Gestor / Líder',
  'Acesso à equipe direta: metas, ações, feedback e indicadores da equipe.',
  'UserCheck',
  '#059669',
  'gestor',
  '[{"modulo":"colaboradores","acoes":["visualizar"],"escopo":"subordinados_diretos"},{"modulo":"plano_acao","acoes":["visualizar","criar","editar"],"escopo":"subordinados_diretos"},{"modulo":"avaliacoes","acoes":["visualizar","criar","editar"],"escopo":"subordinados_diretos"},{"modulo":"pdi","acoes":["visualizar","criar","editar"],"escopo":"subordinados_diretos"},{"modulo":"feedback","acoes":["visualizar","criar","editar"],"escopo":"subordinados_diretos"}]'::jsonb
),
(
  'Financeiro / Administrativo',
  'Acesso ao módulo financeiro, benefícios e relatórios financeiros autorizados.',
  'DollarSign',
  '#0891b2',
  'administrador',
  '[{"modulo":"financeiro","acoes":["visualizar","criar","editar","exportar"],"escopo":"empresa_inteira"},{"modulo":"beneficios","acoes":["visualizar","criar","editar","exportar"],"escopo":"empresa_inteira"},{"modulo":"hub_contabil","acoes":["visualizar","exportar"],"escopo":"empresa_inteira"}]'::jsonb
),
(
  'Colaborador com Acesso',
  'Acesso ao próprio perfil, PDI pessoal, trilhas, metas e documentos autorizados.',
  'User',
  '#d97706',
  'gestor',
  '[{"modulo":"colaboradores","acoes":["visualizar"],"escopo":"proprio_usuario"},{"modulo":"pdi","acoes":["visualizar","editar"],"escopo":"proprio_usuario"},{"modulo":"trilhas","acoes":["visualizar"],"escopo":"proprio_usuario"},{"modulo":"bem_estar","acoes":["visualizar","criar"],"escopo":"proprio_usuario"},{"modulo":"ouvidoria","acoes":["criar"],"escopo":"proprio_usuario"}]'::jsonb
),
(
  'Profissional SST / Clínica',
  'Acesso a documentos SST, programas, exames, dashboards técnicos e compliance.',
  'HardHat',
  '#b45309',
  'tecnico_seguranca',
  '[{"modulo":"sst","acoes":["visualizar","criar","editar","exportar"],"escopo":"empresa_inteira"},{"modulo":"epi","acoes":["visualizar","criar","editar"],"escopo":"empresa_inteira"},{"modulo":"ergonomia","acoes":["visualizar","criar","editar","exportar"],"escopo":"empresa_inteira"},{"modulo":"atestados","acoes":["visualizar","criar","editar"],"escopo":"empresa_inteira"},{"modulo":"incidentes","acoes":["visualizar","criar","editar","exportar"],"escopo":"empresa_inteira"}]'::jsonb
),
(
  'Consultor Externo',
  'Acesso limitado a empresas autorizadas: dashboards, PDI, cultura e análises agregadas.',
  'Briefcase',
  '#475569',
  'consultor_externo',
  '[{"modulo":"colaboradores","acoes":["visualizar"],"escopo":"empresa_inteira"},{"modulo":"pdi","acoes":["visualizar","editar"],"escopo":"empresa_inteira"},{"modulo":"avaliacoes","acoes":["visualizar","ver_indicadores"],"escopo":"empresa_inteira"},{"modulo":"plano_acao","acoes":["visualizar","editar"],"escopo":"empresa_inteira"}]'::jsonb
),
(
  'Auditor',
  'Leitura controlada: relatórios, trilha de auditoria e documentos específicos. Sem edição.',
  'ClipboardList',
  '#64748b',
  'auditor',
  '[{"modulo":"colaboradores","acoes":["visualizar","exportar"],"escopo":"empresa_inteira"},{"modulo":"documentos","acoes":["visualizar","exportar"],"escopo":"empresa_inteira"},{"modulo":"financeiro","acoes":["visualizar","exportar"],"escopo":"empresa_inteira"}]'::jsonb
);
