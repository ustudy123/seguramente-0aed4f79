-- =============================================
-- MÓDULO DE AVALIAÇÕES DE DESEMPENHO
-- =============================================

-- 1. Enums para tipos
CREATE TYPE avaliacao_tipo AS ENUM ('simples', '360');
CREATE TYPE avaliacao_ciclo_status AS ENUM ('rascunho', 'ativo', 'encerrado', 'analisando');
CREATE TYPE resposta_status AS ENUM ('pendente', 'em_andamento', 'concluida');
CREATE TYPE tipo_avaliador AS ENUM ('auto', 'gestor', 'par', 'subordinado');
CREATE TYPE meta_periodo AS ENUM ('mensal', 'trimestral', 'semestral', 'anual');
CREATE TYPE meta_status AS ENUM ('nao_iniciada', 'em_andamento', 'concluida', 'cancelada', 'atrasada');
CREATE TYPE okr_tipo AS ENUM ('percentual', 'quantidade', 'binario', 'monetario');

-- 2. Templates de Avaliação
CREATE TABLE public.avaliacao_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo avaliacao_tipo NOT NULL DEFAULT 'simples',
  categorias JSONB NOT NULL DEFAULT '[]',
  criterios JSONB NOT NULL DEFAULT '[]',
  escala_min INTEGER NOT NULL DEFAULT 1,
  escala_max INTEGER NOT NULL DEFAULT 5,
  escala_labels JSONB,
  permite_comentarios BOOLEAN NOT NULL DEFAULT true,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_por UUID,
  criado_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Ciclos de Avaliação
CREATE TABLE public.avaliacao_ciclos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.avaliacao_templates(id) ON DELETE RESTRICT,
  nome TEXT NOT NULL,
  descricao TEXT,
  status avaliacao_ciclo_status NOT NULL DEFAULT 'rascunho',
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  config_360 JSONB DEFAULT '{"auto": true, "gestor": true, "pares": 0, "subordinados": false}',
  departamentos_ids UUID[],
  notificacoes_enviadas BOOLEAN DEFAULT false,
  criado_por UUID,
  criado_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Respostas de Avaliação
CREATE TABLE public.avaliacao_respostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ciclo_id UUID NOT NULL REFERENCES public.avaliacao_ciclos(id) ON DELETE CASCADE,
  avaliado_id TEXT NOT NULL,
  avaliado_nome TEXT NOT NULL,
  avaliador_id UUID,
  avaliador_nome TEXT,
  tipo_avaliador tipo_avaliador NOT NULL,
  status resposta_status NOT NULL DEFAULT 'pendente',
  notas_criterios JSONB DEFAULT '{}',
  nota_geral NUMERIC(3,1),
  comentario_geral TEXT,
  pontos_fortes TEXT,
  areas_desenvolvimento TEXT,
  data_inicio TIMESTAMPTZ,
  data_conclusao TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Feedbacks por Competência
CREATE TABLE public.avaliacao_feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  resposta_id UUID NOT NULL REFERENCES public.avaliacao_respostas(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL,
  criterio TEXT NOT NULL,
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Metas
CREATE TABLE public.metas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  colaborador_id TEXT,
  colaborador_nome TEXT,
  departamento_id UUID REFERENCES public.departamentos(id) ON DELETE SET NULL,
  departamento_nome TEXT,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'individual',
  periodo meta_periodo NOT NULL DEFAULT 'trimestral',
  ano INTEGER NOT NULL,
  trimestre INTEGER,
  data_inicio DATE,
  data_fim DATE,
  peso NUMERIC(5,2) DEFAULT 1,
  status meta_status NOT NULL DEFAULT 'nao_iniciada',
  progresso INTEGER NOT NULL DEFAULT 0,
  vinculo_ciclo_id UUID REFERENCES public.avaliacao_ciclos(id) ON DELETE SET NULL,
  criado_por UUID,
  criado_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Key Results (OKRs)
CREATE TABLE public.meta_okrs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  meta_id UUID NOT NULL REFERENCES public.metas(id) ON DELETE CASCADE,
  key_result TEXT NOT NULL,
  descricao TEXT,
  tipo okr_tipo NOT NULL DEFAULT 'percentual',
  valor_inicial NUMERIC(15,2) DEFAULT 0,
  valor_atual NUMERIC(15,2) DEFAULT 0,
  valor_alvo NUMERIC(15,2) NOT NULL,
  unidade TEXT,
  progresso INTEGER NOT NULL DEFAULT 0,
  status meta_status NOT NULL DEFAULT 'nao_iniciada',
  responsavel_id UUID,
  responsavel_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Check-ins de OKR
CREATE TABLE public.okr_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  okr_id UUID NOT NULL REFERENCES public.meta_okrs(id) ON DELETE CASCADE,
  valor_anterior NUMERIC(15,2),
  valor_novo NUMERIC(15,2) NOT NULL,
  observacao TEXT,
  realizado_por UUID,
  realizado_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Matriz 9-Box
CREATE TABLE public.avaliacao_9box (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ciclo_id UUID REFERENCES public.avaliacao_ciclos(id) ON DELETE SET NULL,
  colaborador_id TEXT NOT NULL,
  colaborador_nome TEXT NOT NULL,
  desempenho INTEGER NOT NULL,
  potencial INTEGER NOT NULL,
  quadrante TEXT NOT NULL,
  justificativa TEXT,
  avaliador_id UUID,
  avaliador_nome TEXT,
  data_avaliacao DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT check_desempenho CHECK (desempenho BETWEEN 1 AND 3),
  CONSTRAINT check_potencial CHECK (potencial BETWEEN 1 AND 3)
);

-- =============================================
-- ENABLE RLS
-- =============================================

ALTER TABLE public.avaliacao_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avaliacao_ciclos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avaliacao_respostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avaliacao_feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_okrs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.okr_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avaliacao_9box ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES - TEMPLATES
-- =============================================

CREATE POLICY "Usuários podem ver templates do seu tenant"
ON public.avaliacao_templates FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Managers+ podem gerenciar templates"
ON public.avaliacao_templates FOR ALL
USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'))
WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'));

-- =============================================
-- RLS POLICIES - CICLOS
-- =============================================

CREATE POLICY "Usuários podem ver ciclos do seu tenant"
ON public.avaliacao_ciclos FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Managers+ podem gerenciar ciclos"
ON public.avaliacao_ciclos FOR ALL
USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'))
WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'));

-- =============================================
-- RLS POLICIES - RESPOSTAS
-- =============================================

CREATE POLICY "Usuários podem ver respostas do seu tenant"
ON public.avaliacao_respostas FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Avaliadores podem criar respostas"
ON public.avaliacao_respostas FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id() AND avaliador_id = auth.uid());

CREATE POLICY "Avaliadores podem atualizar suas respostas"
ON public.avaliacao_respostas FOR UPDATE
USING (tenant_id = get_user_tenant_id() AND avaliador_id = auth.uid())
WITH CHECK (tenant_id = get_user_tenant_id() AND avaliador_id = auth.uid());

CREATE POLICY "Managers+ podem gerenciar respostas"
ON public.avaliacao_respostas FOR ALL
USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'))
WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'));

-- =============================================
-- RLS POLICIES - FEEDBACKS
-- =============================================

CREATE POLICY "Usuários podem ver feedbacks do seu tenant"
ON public.avaliacao_feedbacks FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Usuários podem criar feedbacks"
ON public.avaliacao_feedbacks FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Managers+ podem gerenciar feedbacks"
ON public.avaliacao_feedbacks FOR ALL
USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'))
WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'));

-- =============================================
-- RLS POLICIES - METAS
-- =============================================

CREATE POLICY "Usuários podem ver metas do seu tenant"
ON public.metas FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Managers+ podem gerenciar metas"
ON public.metas FOR ALL
USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'))
WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'));

-- =============================================
-- RLS POLICIES - META OKRS
-- =============================================

CREATE POLICY "Usuários podem ver OKRs do seu tenant"
ON public.meta_okrs FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Managers+ podem gerenciar OKRs"
ON public.meta_okrs FOR ALL
USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'))
WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'));

CREATE POLICY "Responsáveis podem atualizar seus OKRs"
ON public.meta_okrs FOR UPDATE
USING (tenant_id = get_user_tenant_id() AND responsavel_id = auth.uid())
WITH CHECK (tenant_id = get_user_tenant_id() AND responsavel_id = auth.uid());

-- =============================================
-- RLS POLICIES - OKR CHECKINS
-- =============================================

CREATE POLICY "Usuários podem ver check-ins do seu tenant"
ON public.okr_checkins FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Usuários podem criar check-ins"
ON public.okr_checkins FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id() AND realizado_por = auth.uid());

CREATE POLICY "Managers+ podem gerenciar check-ins"
ON public.okr_checkins FOR ALL
USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'))
WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'));

-- =============================================
-- RLS POLICIES - 9-BOX
-- =============================================

CREATE POLICY "Usuários podem ver 9-box do seu tenant"
ON public.avaliacao_9box FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Managers+ podem gerenciar 9-box"
ON public.avaliacao_9box FOR ALL
USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'))
WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'));

-- =============================================
-- TRIGGERS FOR updated_at
-- =============================================

CREATE TRIGGER update_avaliacao_templates_updated_at
BEFORE UPDATE ON public.avaliacao_templates
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_avaliacao_ciclos_updated_at
BEFORE UPDATE ON public.avaliacao_ciclos
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_avaliacao_respostas_updated_at
BEFORE UPDATE ON public.avaliacao_respostas
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_metas_updated_at
BEFORE UPDATE ON public.metas
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meta_okrs_updated_at
BEFORE UPDATE ON public.meta_okrs
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_avaliacao_9box_updated_at
BEFORE UPDATE ON public.avaliacao_9box
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX idx_avaliacao_templates_tenant ON public.avaliacao_templates(tenant_id);
CREATE INDEX idx_avaliacao_ciclos_tenant ON public.avaliacao_ciclos(tenant_id);
CREATE INDEX idx_avaliacao_ciclos_template ON public.avaliacao_ciclos(template_id);
CREATE INDEX idx_avaliacao_respostas_tenant ON public.avaliacao_respostas(tenant_id);
CREATE INDEX idx_avaliacao_respostas_ciclo ON public.avaliacao_respostas(ciclo_id);
CREATE INDEX idx_avaliacao_respostas_avaliador ON public.avaliacao_respostas(avaliador_id);
CREATE INDEX idx_avaliacao_feedbacks_resposta ON public.avaliacao_feedbacks(resposta_id);
CREATE INDEX idx_metas_tenant ON public.metas(tenant_id);
CREATE INDEX idx_metas_colaborador ON public.metas(colaborador_id);
CREATE INDEX idx_meta_okrs_meta ON public.meta_okrs(meta_id);
CREATE INDEX idx_okr_checkins_okr ON public.okr_checkins(okr_id);
CREATE INDEX idx_avaliacao_9box_tenant ON public.avaliacao_9box(tenant_id);
CREATE INDEX idx_avaliacao_9box_ciclo ON public.avaliacao_9box(ciclo_id);