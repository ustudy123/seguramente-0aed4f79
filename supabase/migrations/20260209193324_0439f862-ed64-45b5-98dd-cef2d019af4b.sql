
-- ============================================================
-- CADASTRO DE EMPRESA — Tabela principal de perfil da empresa
-- ============================================================

CREATE TABLE public.empresa_cadastro (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Dados Básicos
  razao_social TEXT,
  nome_fantasia TEXT,
  cnpj TEXT,
  inscricao_estadual TEXT,
  inscricao_municipal TEXT,
  endereco TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  telefone TEXT,
  email TEXT,
  website TEXT,
  
  -- CNAE e Grau de Risco (NR-04)
  cnae_principal TEXT,
  cnae_descricao TEXT,
  cnaes_secundarios JSONB DEFAULT '[]'::jsonb,
  grau_risco INTEGER CHECK (grau_risco BETWEEN 1 AND 4),
  grau_risco_ajustado INTEGER CHECK (grau_risco_ajustado BETWEEN 1 AND 4),
  grau_risco_justificativa TEXT,
  
  -- SESMT (NR-04)
  sesmt_obrigatorio BOOLEAN DEFAULT false,
  sesmt_situacao TEXT DEFAULT 'inexistente' CHECK (sesmt_situacao IN ('proprio', 'terceirizado', 'inexistente')),
  sesmt_profissionais JSONB DEFAULT '[]'::jsonb,
  
  -- CIPA (NR-05)
  cipa_obrigatoria BOOLEAN DEFAULT false,
  cipa_situacao TEXT DEFAULT 'nao_constituida' CHECK (cipa_situacao IN ('nao_constituida', 'em_implantacao', 'ativa')),
  cipa_data_mandato_inicio DATE,
  cipa_data_mandato_fim DATE,
  cipa_membros JSONB DEFAULT '[]'::jsonb,
  
  -- Cota PCD
  pcd_obrigatoria BOOLEAN DEFAULT false,
  pcd_quantidade_exigida INTEGER DEFAULT 0,
  pcd_quantidade_atual INTEGER DEFAULT 0,
  pcd_percentual_exigido NUMERIC(5,2),
  
  -- Jovem Aprendiz
  aprendiz_quantidade_minima INTEGER DEFAULT 0,
  aprendiz_quantidade_maxima INTEGER DEFAULT 0,
  aprendiz_quantidade_atual INTEGER DEFAULT 0,
  
  -- FAP (Fator Acidentário de Prevenção)
  fap_atual NUMERIC(5,4),
  fap_historico JSONB DEFAULT '[]'::jsonb,
  fap_classificacao TEXT,
  
  -- TAC (Termo de Ajustamento de Conduta)
  tac_possui BOOLEAN DEFAULT false,
  tac_detalhes JSONB DEFAULT '[]'::jsonb,
  
  -- Jornada e Turnos
  jornada_padrao TEXT,
  turnos JSONB DEFAULT '[]'::jsonb,
  possui_terceiro_turno BOOLEAN DEFAULT false,
  possui_escalas_especiais BOOLEAN DEFAULT false,
  
  -- Condições Especiais de Trabalho
  trabalho_altura BOOLEAN DEFAULT false,
  espaco_confinado BOOLEAN DEFAULT false,
  insalubridade BOOLEAN DEFAULT false,
  periculosidade BOOLEAN DEFAULT false,
  aposentadoria_especial BOOLEAN DEFAULT false,
  condicoes_especiais_detalhes JSONB DEFAULT '{}'::jsonb,
  
  -- Quantidade de colaboradores (para cálculos)
  total_colaboradores INTEGER DEFAULT 0,
  
  -- Metadata
  atualizado_por TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(tenant_id)
);

-- Enable RLS
ALTER TABLE public.empresa_cadastro ENABLE ROW LEVEL SECURITY;

-- Policies: tenant users can view/edit their own company
CREATE POLICY "empresa_cadastro_select_own"
  ON public.empresa_cadastro FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    OR public.is_superadmin(auth.uid())
  );

CREATE POLICY "empresa_cadastro_insert_own"
  ON public.empresa_cadastro FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    OR public.is_superadmin(auth.uid())
  );

CREATE POLICY "empresa_cadastro_update_own"
  ON public.empresa_cadastro FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    OR public.is_superadmin(auth.uid())
  );

CREATE POLICY "empresa_cadastro_delete_own"
  ON public.empresa_cadastro FOR DELETE
  TO authenticated
  USING (
    public.is_superadmin(auth.uid())
  );

-- Trigger for updated_at
CREATE TRIGGER update_empresa_cadastro_updated_at
  BEFORE UPDATE ON public.empresa_cadastro
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- OBRIGAÇÕES DA EMPRESA — Tabela para tracking de obrigações legais
-- ============================================================

CREATE TABLE public.empresa_obrigacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  categoria TEXT NOT NULL, -- 'legal', 'sst', 'estrategica', 'financeira'
  subcategoria TEXT, -- 'cipa', 'sesmt', 'pcd', 'fap', 'tac', etc.
  titulo TEXT NOT NULL,
  descricao TEXT,
  base_legal TEXT, -- NR, Lei, etc.
  
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'conforme', 'nao_conforme', 'em_adequacao', 'nao_aplicavel')),
  criticidade TEXT DEFAULT 'media' CHECK (criticidade IN ('baixa', 'media', 'alta', 'critica')),
  
  prazo_sugerido DATE,
  responsavel_sugerido TEXT,
  
  acao_gerada_id UUID REFERENCES public.plano_acoes(id),
  
  origem TEXT DEFAULT 'cadastro_empresa',
  origem_campo TEXT, -- campo do cadastro que gerou
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.empresa_obrigacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "empresa_obrigacoes_select_own"
  ON public.empresa_obrigacoes FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    OR public.is_superadmin(auth.uid())
  );

CREATE POLICY "empresa_obrigacoes_insert_own"
  ON public.empresa_obrigacoes FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    OR public.is_superadmin(auth.uid())
  );

CREATE POLICY "empresa_obrigacoes_update_own"
  ON public.empresa_obrigacoes FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    OR public.is_superadmin(auth.uid())
  );

CREATE POLICY "empresa_obrigacoes_delete_own"
  ON public.empresa_obrigacoes FOR DELETE
  TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    OR public.is_superadmin(auth.uid())
  );

-- Trigger for updated_at
CREATE TRIGGER update_empresa_obrigacoes_updated_at
  BEFORE UPDATE ON public.empresa_obrigacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index
CREATE INDEX idx_empresa_obrigacoes_tenant ON public.empresa_obrigacoes(tenant_id);
CREATE INDEX idx_empresa_obrigacoes_status ON public.empresa_obrigacoes(tenant_id, status);
CREATE INDEX idx_empresa_cadastro_tenant ON public.empresa_cadastro(tenant_id);
