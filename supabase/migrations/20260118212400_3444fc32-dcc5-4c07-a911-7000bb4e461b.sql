-- =============================================
-- FASE 1: ESTRUTURA BASE MULTI-TENANT
-- =============================================

-- 1. Enum para tipos de plano
CREATE TYPE public.tenant_plan AS ENUM ('free', 'starter', 'professional', 'enterprise');

-- 2. Enum para roles de usuário
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'manager', 'user');

-- 3. Enum para status de admissão
CREATE TYPE public.admissao_status AS ENUM (
  'rascunho', 
  'aguardando_documentos', 
  'em_analise', 
  'aprovado', 
  'reprovado', 
  'concluido'
);

-- 4. Enum para status de documento
CREATE TYPE public.documento_status AS ENUM ('pendente', 'enviado', 'aprovado', 'rejeitado');

-- 5. Enum para status de workflow
CREATE TYPE public.workflow_status AS ENUM ('pendente', 'aprovado', 'rejeitado');

-- =============================================
-- TABELA DE TENANTS (EMPRESAS)
-- =============================================
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  plano tenant_plan NOT NULL DEFAULT 'free',
  ativo BOOLEAN NOT NULL DEFAULT true,
  configuracoes JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- TABELA DE PROFILES
-- =============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  nome_completo TEXT NOT NULL,
  avatar_url TEXT,
  cargo TEXT,
  telefone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- TABELA DE USER ROLES
-- =============================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- =============================================
-- TABELA DE ADMISSÕES
-- =============================================
CREATE TABLE public.admissoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  status admissao_status NOT NULL DEFAULT 'rascunho',
  
  -- Dados Pessoais
  nome_completo TEXT NOT NULL,
  cpf TEXT NOT NULL,
  rg TEXT,
  data_nascimento DATE,
  estado_civil TEXT,
  genero TEXT,
  nacionalidade TEXT,
  naturalidade TEXT,
  nome_mae TEXT,
  nome_pai TEXT,
  
  -- Dados de Contato
  email TEXT NOT NULL,
  telefone TEXT,
  celular TEXT,
  endereco TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  
  -- Dados Profissionais
  cargo TEXT NOT NULL,
  departamento TEXT,
  filial TEXT,
  data_admissao DATE,
  tipo_contrato TEXT,
  jornada_trabalho TEXT,
  salario DECIMAL(10,2),
  gestor_imediato TEXT,
  centro_custo TEXT,
  
  -- Dados Bancários
  banco TEXT,
  agencia TEXT,
  conta TEXT,
  tipo_conta TEXT,
  chave_pix TEXT,
  
  -- Metadados
  criado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- TABELA DE DOCUMENTOS DE ADMISSÃO
-- =============================================
CREATE TABLE public.admissao_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admissao_id UUID REFERENCES public.admissoes(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL,
  obrigatorio BOOLEAN NOT NULL DEFAULT false,
  status documento_status NOT NULL DEFAULT 'pendente',
  arquivo_url TEXT,
  arquivo_nome TEXT,
  arquivo_tamanho INTEGER,
  data_envio TIMESTAMPTZ,
  observacao TEXT,
  aprovado_por UUID REFERENCES auth.users(id),
  data_aprovacao TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- TABELA DE WORKFLOW DE ADMISSÃO
-- =============================================
CREATE TABLE public.admissao_workflow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admissao_id UUID REFERENCES public.admissoes(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  etapa TEXT NOT NULL,
  ordem INTEGER NOT NULL,
  status workflow_status NOT NULL DEFAULT 'pendente',
  responsavel_id UUID REFERENCES auth.users(id),
  responsavel_nome TEXT,
  observacao TEXT,
  data_acao TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- TABELA DE HISTÓRICO DE ADMISSÃO
-- =============================================
CREATE TABLE public.admissao_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admissao_id UUID REFERENCES public.admissoes(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  acao TEXT NOT NULL,
  descricao TEXT,
  dados_anteriores JSONB,
  dados_novos JSONB,
  usuario_id UUID REFERENCES auth.users(id),
  usuario_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- FUNÇÕES AUXILIARES
-- =============================================

-- Função para obter tenant_id do usuário atual
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
$$;

-- Função para verificar role do usuário
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Função para verificar se usuário tem role mínimo
CREATE OR REPLACE FUNCTION public.has_minimum_role(_user_id UUID, _minimum_role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND (
        role = 'owner' OR
        role = 'admin' OR
        (role = 'manager' AND _minimum_role IN ('manager', 'user')) OR
        (role = 'user' AND _minimum_role = 'user')
      )
  )
$$;

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =============================================
-- TRIGGERS DE UPDATED_AT
-- =============================================
CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_admissoes_updated_at
  BEFORE UPDATE ON public.admissoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_admissao_documentos_updated_at
  BEFORE UPDATE ON public.admissao_documentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_admissao_workflow_updated_at
  BEFORE UPDATE ON public.admissao_workflow
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- HABILITAR RLS EM TODAS AS TABELAS
-- =============================================
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admissao_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admissao_workflow ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admissao_historico ENABLE ROW LEVEL SECURITY;

-- =============================================
-- POLÍTICAS RLS - TENANTS
-- =============================================
CREATE POLICY "Usuários podem ver seu próprio tenant"
  ON public.tenants FOR SELECT
  TO authenticated
  USING (id = public.get_user_tenant_id());

CREATE POLICY "Owners podem atualizar seu tenant"
  ON public.tenants FOR UPDATE
  TO authenticated
  USING (id = public.get_user_tenant_id() AND public.has_role(auth.uid(), 'owner'))
  WITH CHECK (id = public.get_user_tenant_id() AND public.has_role(auth.uid(), 'owner'));

-- =============================================
-- POLÍTICAS RLS - PROFILES
-- =============================================
CREATE POLICY "Usuários podem ver profiles do seu tenant"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Usuários podem atualizar próprio profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins podem inserir profiles no seu tenant"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id() 
    AND public.has_minimum_role(auth.uid(), 'admin')
  );

-- Política especial para primeiro usuário (owner) criar profile
CREATE POLICY "Novos usuários podem criar próprio profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- =============================================
-- POLÍTICAS RLS - USER_ROLES
-- =============================================
CREATE POLICY "Usuários podem ver próprios roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Owners/Admins podem gerenciar roles do tenant"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = public.user_roles.user_id
        AND p.tenant_id = public.get_user_tenant_id()
    )
    AND public.has_minimum_role(auth.uid(), 'admin')
  );

-- =============================================
-- POLÍTICAS RLS - ADMISSÕES
-- =============================================
CREATE POLICY "Usuários podem ver admissões do seu tenant"
  ON public.admissoes FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Managers+ podem criar admissões"
  ON public.admissoes FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND public.has_minimum_role(auth.uid(), 'manager')
  );

CREATE POLICY "Managers+ podem atualizar admissões"
  ON public.admissoes FOR UPDATE
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id() AND public.has_minimum_role(auth.uid(), 'manager'))
  WITH CHECK (tenant_id = public.get_user_tenant_id() AND public.has_minimum_role(auth.uid(), 'manager'));

CREATE POLICY "Admins+ podem deletar admissões"
  ON public.admissoes FOR DELETE
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id() AND public.has_minimum_role(auth.uid(), 'admin'));

-- =============================================
-- POLÍTICAS RLS - DOCUMENTOS
-- =============================================
CREATE POLICY "Usuários podem ver documentos do seu tenant"
  ON public.admissao_documentos FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Managers+ podem gerenciar documentos"
  ON public.admissao_documentos FOR ALL
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id() AND public.has_minimum_role(auth.uid(), 'manager'))
  WITH CHECK (tenant_id = public.get_user_tenant_id() AND public.has_minimum_role(auth.uid(), 'manager'));

-- =============================================
-- POLÍTICAS RLS - WORKFLOW
-- =============================================
CREATE POLICY "Usuários podem ver workflow do seu tenant"
  ON public.admissao_workflow FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Managers+ podem gerenciar workflow"
  ON public.admissao_workflow FOR ALL
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id() AND public.has_minimum_role(auth.uid(), 'manager'))
  WITH CHECK (tenant_id = public.get_user_tenant_id() AND public.has_minimum_role(auth.uid(), 'manager'));

-- =============================================
-- POLÍTICAS RLS - HISTÓRICO
-- =============================================
CREATE POLICY "Usuários podem ver histórico do seu tenant"
  ON public.admissao_historico FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Sistema pode inserir histórico"
  ON public.admissao_historico FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- =============================================
-- ÍNDICES PARA PERFORMANCE
-- =============================================
CREATE INDEX idx_profiles_tenant_id ON public.profiles(tenant_id);
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_admissoes_tenant_id ON public.admissoes(tenant_id);
CREATE INDEX idx_admissoes_status ON public.admissoes(status);
CREATE INDEX idx_admissao_documentos_admissao_id ON public.admissao_documentos(admissao_id);
CREATE INDEX idx_admissao_documentos_tenant_id ON public.admissao_documentos(tenant_id);
CREATE INDEX idx_admissao_workflow_admissao_id ON public.admissao_workflow(admissao_id);
CREATE INDEX idx_admissao_historico_admissao_id ON public.admissao_historico(admissao_id);

-- =============================================
-- STORAGE BUCKET PARA DOCUMENTOS
-- =============================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documentos', 'documentos', false);

-- Políticas de Storage
CREATE POLICY "Usuários autenticados podem ver documentos do seu tenant"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documentos' 
    AND (storage.foldername(name))[1] = public.get_user_tenant_id()::text
  );

CREATE POLICY "Managers+ podem fazer upload de documentos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documentos'
    AND (storage.foldername(name))[1] = public.get_user_tenant_id()::text
    AND public.has_minimum_role(auth.uid(), 'manager')
  );

CREATE POLICY "Managers+ podem atualizar documentos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documentos'
    AND (storage.foldername(name))[1] = public.get_user_tenant_id()::text
    AND public.has_minimum_role(auth.uid(), 'manager')
  );

CREATE POLICY "Admins+ podem deletar documentos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documentos'
    AND (storage.foldername(name))[1] = public.get_user_tenant_id()::text
    AND public.has_minimum_role(auth.uid(), 'admin')
  );