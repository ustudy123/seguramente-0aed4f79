
-- =============================================
-- MÓDULO DE METAS - SCHEMA COMPLETO
-- =============================================

-- Enum para nível da meta
DO $$ BEGIN
  CREATE TYPE meta_nivel AS ENUM ('estrategica', 'unidade', 'setor', 'individual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Enum para status de workflow
DO $$ BEGIN
  CREATE TYPE meta_workflow_status AS ENUM ('rascunho', 'em_aprovacao', 'ativa', 'em_revisao', 'suspensa', 'encerrada', 'cancelada');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Enum para tipo de indicador
DO $$ BEGIN
  CREATE TYPE indicador_tipo AS ENUM ('quantitativo', 'qualitativo', 'percentual', 'financeiro', 'marco', 'hibrido');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Enum para direção do indicador
DO $$ BEGIN
  CREATE TYPE indicador_direcao AS ENUM ('maior_melhor', 'menor_melhor', 'igual_melhor', 'faixa');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- 1. Extensão da tabela metas existente
-- =============================================
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS nivel meta_nivel DEFAULT 'individual';
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS workflow_status meta_workflow_status DEFAULT 'rascunho';
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS meta_pai_id UUID REFERENCES public.metas(id) ON DELETE SET NULL;
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS objetivo_estrategico TEXT;
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS indicador_nome TEXT;
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS indicador_tipo indicador_tipo DEFAULT 'quantitativo';
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS indicador_unidade TEXT;
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS indicador_direcao indicador_direcao DEFAULT 'maior_melhor';
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS formula_medicao TEXT;
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS valor_baseline NUMERIC(15,2);
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS valor_alvo NUMERIC(15,2);
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS valor_atual NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS valor_minimo NUMERIC(15,2);
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS valor_maximo NUMERIC(15,2);
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS unidade_id UUID REFERENCES public.empresa_cadastro(id) ON DELETE SET NULL;
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS unidade_nome TEXT;
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS setor_id UUID REFERENCES public.departamentos(id) ON DELETE SET NULL;
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS setor_nome TEXT;
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS responsavel_id TEXT;
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS responsavel_nome TEXT;
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS aprovador_id TEXT;
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS aprovador_nome TEXT;
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS data_aprovacao TIMESTAMPTZ;
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS justificativa_aprovacao TEXT;
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS risco_ia TEXT;
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS risco_nivel TEXT;
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS risco_descricao TEXT;
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS sugestao_ia JSONB;
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS compartilhada BOOLEAN DEFAULT false;
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS ciclo_avaliacao_id UUID REFERENCES public.avaliacao_ciclos(id) ON DELETE SET NULL;
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS swot_id UUID;
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS versao INTEGER DEFAULT 1;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_metas_nivel ON public.metas(nivel);
CREATE INDEX IF NOT EXISTS idx_metas_workflow_status ON public.metas(workflow_status);
CREATE INDEX IF NOT EXISTS idx_metas_meta_pai_id ON public.metas(meta_pai_id);
CREATE INDEX IF NOT EXISTS idx_metas_unidade_id ON public.metas(unidade_id);
CREATE INDEX IF NOT EXISTS idx_metas_setor_id ON public.metas(setor_id);
CREATE INDEX IF NOT EXISTS idx_metas_responsavel_id ON public.metas(responsavel_id);

-- =============================================
-- 2. Tabela de indicadores parametrizáveis
-- =============================================
CREATE TABLE IF NOT EXISTS public.metas_indicadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo indicador_tipo NOT NULL DEFAULT 'quantitativo',
  unidade_medida TEXT,
  formula TEXT,
  direcao indicador_direcao NOT NULL DEFAULT 'maior_melhor',
  origem_dados TEXT DEFAULT 'manual',
  frequencia_atualizacao TEXT DEFAULT 'mensal',
  ativo BOOLEAN DEFAULT true,
  criado_por TEXT,
  criado_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.metas_indicadores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation metas_indicadores" ON public.metas_indicadores
  FOR ALL USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- =============================================
-- 3. Tabela de evidências
-- =============================================
CREATE TABLE IF NOT EXISTS public.metas_evidencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  meta_id UUID NOT NULL REFERENCES public.metas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'arquivo',
  titulo TEXT,
  descricao TEXT,
  arquivo_url TEXT,
  arquivo_nome TEXT,
  arquivo_tamanho INTEGER,
  link_externo TEXT,
  periodo_referencia TEXT,
  criado_por TEXT,
  criado_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.metas_evidencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation metas_evidencias" ON public.metas_evidencias
  FOR ALL USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- =============================================
-- 4. Tabela de workflow/aprovações
-- =============================================
CREATE TABLE IF NOT EXISTS public.metas_workflow_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  meta_id UUID NOT NULL REFERENCES public.metas(id) ON DELETE CASCADE,
  status_anterior meta_workflow_status,
  status_novo meta_workflow_status NOT NULL,
  acao TEXT NOT NULL,
  justificativa TEXT,
  usuario_id TEXT,
  usuario_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.metas_workflow_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation metas_workflow_log" ON public.metas_workflow_log
  FOR ALL USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- =============================================
-- 5. Tabela de check-ins de progresso
-- =============================================
CREATE TABLE IF NOT EXISTS public.metas_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  meta_id UUID NOT NULL REFERENCES public.metas(id) ON DELETE CASCADE,
  valor_anterior NUMERIC(15,2),
  valor_novo NUMERIC(15,2),
  progresso_anterior INTEGER,
  progresso_novo INTEGER,
  observacao TEXT,
  bloqueios TEXT,
  previsao_atingimento DATE,
  realizado_por TEXT,
  realizado_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.metas_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation metas_checkins" ON public.metas_checkins
  FOR ALL USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- =============================================
-- 6. Tabela de compartilhamento (metas colaborativas)
-- =============================================
CREATE TABLE IF NOT EXISTS public.metas_participantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  meta_id UUID NOT NULL REFERENCES public.metas(id) ON DELETE CASCADE,
  participante_id TEXT NOT NULL,
  participante_nome TEXT NOT NULL,
  papel TEXT DEFAULT 'contribuidor',
  peso NUMERIC(5,2) DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(meta_id, participante_id)
);

ALTER TABLE public.metas_participantes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation metas_participantes" ON public.metas_participantes
  FOR ALL USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- =============================================
-- 7. Tabela de configuração do módulo
-- =============================================
CREATE TABLE IF NOT EXISTS public.metas_configuracao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  niveis_habilitados TEXT[] DEFAULT ARRAY['estrategica', 'unidade', 'setor', 'individual'],
  exigir_objetivo_estrategico BOOLEAN DEFAULT false,
  exigir_indicador BOOLEAN DEFAULT true,
  exigir_aprovacao_estrategica BOOLEAN DEFAULT true,
  exigir_aprovacao_unidade BOOLEAN DEFAULT false,
  exigir_aprovacao_setor BOOLEAN DEFAULT false,
  exigir_aprovacao_individual BOOLEAN DEFAULT false,
  modelo_avaliacao TEXT DEFAULT 'quantitativo',
  escala_min INTEGER DEFAULT 0,
  escala_max INTEGER DEFAULT 100,
  permitir_desdobramento BOOLEAN DEFAULT true,
  permitir_metas_compartilhadas BOOLEAN DEFAULT true,
  frequencia_checkin TEXT DEFAULT 'mensal',
  dias_alerta_prazo INTEGER DEFAULT 7,
  integrar_avaliacao_desempenho BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

ALTER TABLE public.metas_configuracao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation metas_configuracao" ON public.metas_configuracao
  FOR ALL USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- =============================================
-- 8. Indexes adicionais
-- =============================================
CREATE INDEX IF NOT EXISTS idx_metas_evidencias_meta ON public.metas_evidencias(meta_id);
CREATE INDEX IF NOT EXISTS idx_metas_workflow_log_meta ON public.metas_workflow_log(meta_id);
CREATE INDEX IF NOT EXISTS idx_metas_checkins_meta ON public.metas_checkins(meta_id);
CREATE INDEX IF NOT EXISTS idx_metas_participantes_meta ON public.metas_participantes(meta_id);

-- Trigger updated_at
CREATE TRIGGER set_metas_indicadores_updated_at BEFORE UPDATE ON public.metas_indicadores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_metas_configuracao_updated_at BEFORE UPDATE ON public.metas_configuracao FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
