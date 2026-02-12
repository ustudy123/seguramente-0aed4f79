
-- ============================================
-- MÓDULO PDI - Plano de Desenvolvimento Individual
-- ============================================

-- Enum para status do PDI
CREATE TYPE public.pdi_status AS ENUM ('rascunho', 'ativo', 'pausado', 'concluido', 'cancelado');

-- Enum para período do PDI
CREATE TYPE public.pdi_periodo AS ENUM ('trimestral', 'semestral', 'anual', 'personalizado');

-- Enum para categoria da meta
CREATE TYPE public.pdi_meta_categoria AS ENUM ('tecnica', 'comportamental', 'processos', 'lideranca', 'cultura', 'saude_bem_estar');

-- Enum para status da meta
CREATE TYPE public.pdi_meta_status AS ENUM ('nao_iniciada', 'em_andamento', 'concluida', 'atrasada', 'cancelada');

-- Enum para tipo de ação
CREATE TYPE public.pdi_acao_tipo AS ENUM ('tarefa', 'habito', 'rotina', 'projeto', 'mentoria', 'treinamento');

-- Enum para status de ação
CREATE TYPE public.pdi_acao_status AS ENUM ('nao_iniciada', 'em_andamento', 'concluida', 'bloqueada');

-- Enum para frequência de check-in
CREATE TYPE public.pdi_checkin_frequencia AS ENUM ('semanal', 'quinzenal', 'mensal');

-- ============================================
-- 1. TABELA PRINCIPAL: PDIs
-- ============================================
CREATE TABLE public.pdis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  colaborador_id TEXT NOT NULL,
  colaborador_nome TEXT NOT NULL,
  colaborador_cargo TEXT,
  colaborador_departamento TEXT,
  titulo TEXT NOT NULL,
  descricao TEXT,
  periodo pdi_periodo NOT NULL DEFAULT 'trimestral',
  status pdi_status NOT NULL DEFAULT 'rascunho',
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  responsavel_id UUID,
  responsavel_nome TEXT,
  co_responsavel_id UUID,
  co_responsavel_nome TEXT,
  progresso INTEGER NOT NULL DEFAULT 0,
  pontuacao INTEGER NOT NULL DEFAULT 0,
  gatilho TEXT, -- admissao, avaliacao, cargo, ergonomia, solicitacao
  ciclo_avaliacao_id UUID,
  observacoes TEXT,
  criado_por UUID,
  criado_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pdis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "PDIs isolados por tenant" ON public.pdis
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

CREATE TRIGGER update_pdis_updated_at
  BEFORE UPDATE ON public.pdis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 2. METAS SMART
-- ============================================
CREATE TABLE public.pdi_metas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  pdi_id UUID NOT NULL REFERENCES public.pdis(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  categoria pdi_meta_categoria NOT NULL DEFAULT 'tecnica',
  status pdi_meta_status NOT NULL DEFAULT 'nao_iniciada',
  -- SMART fields
  especifica TEXT, -- S
  mensuravel TEXT, -- M
  atingivel TEXT,  -- A
  relevante TEXT,  -- R
  temporal TEXT,   -- T
  -- Indicadores
  indicador_sucesso TEXT,
  valor_base NUMERIC,
  valor_alvo NUMERIC,
  valor_atual NUMERIC DEFAULT 0,
  unidade TEXT,
  -- Datas e config
  data_inicio DATE,
  data_fim DATE,
  frequencia_checkin pdi_checkin_frequencia DEFAULT 'quinzenal',
  peso INTEGER DEFAULT 3 CHECK (peso BETWEEN 1 AND 5),
  progresso INTEGER NOT NULL DEFAULT 0,
  dependencias TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pdi_metas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "PDI metas isoladas por tenant" ON public.pdi_metas
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

CREATE TRIGGER update_pdi_metas_updated_at
  BEFORE UPDATE ON public.pdi_metas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 3. AÇÕES
-- ============================================
CREATE TABLE public.pdi_acoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  meta_id UUID NOT NULL REFERENCES public.pdi_metas(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo pdi_acao_tipo NOT NULL DEFAULT 'tarefa',
  status pdi_acao_status NOT NULL DEFAULT 'nao_iniciada',
  data_vencimento DATE,
  frequencia TEXT,
  duracao_estimada TEXT,
  evidencia_obrigatoria BOOLEAN DEFAULT false,
  material_vinculado TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pdi_acoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "PDI ações isoladas por tenant" ON public.pdi_acoes
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

CREATE TRIGGER update_pdi_acoes_updated_at
  BEFORE UPDATE ON public.pdi_acoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 4. CHECK-INS
-- ============================================
CREATE TABLE public.pdi_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  meta_id UUID NOT NULL REFERENCES public.pdi_metas(id) ON DELETE CASCADE,
  avancos TEXT,
  bloqueios TEXT,
  proximo_passo TEXT,
  valor_atualizado NUMERIC,
  realizado_por UUID,
  realizado_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pdi_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "PDI checkins isolados por tenant" ON public.pdi_checkins
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- ============================================
-- 5. EVIDÊNCIAS
-- ============================================
CREATE TABLE public.pdi_evidencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  meta_id UUID REFERENCES public.pdi_metas(id) ON DELETE CASCADE,
  acao_id UUID REFERENCES public.pdi_acoes(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL DEFAULT 'arquivo', -- arquivo, link, comentario, certificado
  titulo TEXT NOT NULL,
  descricao TEXT,
  arquivo_url TEXT,
  arquivo_nome TEXT,
  link_url TEXT,
  validado_por UUID,
  validado_por_nome TEXT,
  validado_em TIMESTAMPTZ,
  criado_por UUID,
  criado_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pdi_evidencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "PDI evidências isoladas por tenant" ON public.pdi_evidencias
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- ============================================
-- 6. FEEDBACKS
-- ============================================
CREATE TABLE public.pdi_feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  pdi_id UUID NOT NULL REFERENCES public.pdis(id) ON DELETE CASCADE,
  meta_id UUID REFERENCES public.pdi_metas(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL DEFAULT 'lider', -- autoavaliacao, lider, par
  ponto_forte TEXT,
  ponto_melhorar TEXT,
  recomendacao TEXT,
  comentario TEXT,
  autor_id UUID,
  autor_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pdi_feedbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "PDI feedbacks isolados por tenant" ON public.pdi_feedbacks
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- ============================================
-- STORAGE BUCKET para evidências PDI
-- ============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('pdi-evidencias', 'pdi-evidencias', false);

CREATE POLICY "PDI evidencias upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'pdi-evidencias' AND auth.uid() IS NOT NULL);

CREATE POLICY "PDI evidencias select" ON storage.objects
  FOR SELECT USING (bucket_id = 'pdi-evidencias' AND auth.uid() IS NOT NULL);

CREATE POLICY "PDI evidencias delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'pdi-evidencias' AND auth.uid() IS NOT NULL);

-- ============================================
-- FUNÇÃO: Recalcular progresso do PDI
-- ============================================
CREATE OR REPLACE FUNCTION public.recalcular_progresso_pdi()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pdi_id UUID;
  v_avg_progresso INTEGER;
BEGIN
  -- Buscar pdi_id da meta
  SELECT pdi_id INTO v_pdi_id FROM public.pdi_metas WHERE id = COALESCE(NEW.id, OLD.id);
  
  IF v_pdi_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  
  -- Média ponderada de progresso das metas
  SELECT COALESCE(
    ROUND(SUM(progresso * peso)::numeric / NULLIF(SUM(peso), 0)),
    0
  )::INTEGER INTO v_avg_progresso
  FROM public.pdi_metas
  WHERE pdi_id = v_pdi_id;
  
  -- Atualizar PDI
  UPDATE public.pdis
  SET progresso = v_avg_progresso,
      status = CASE
        WHEN v_avg_progresso >= 100 THEN 'concluido'::pdi_status
        WHEN v_avg_progresso > 0 THEN 'ativo'::pdi_status
        ELSE status
      END
  WHERE id = v_pdi_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_recalcular_progresso_pdi
  AFTER INSERT OR UPDATE OR DELETE ON public.pdi_metas
  FOR EACH ROW EXECUTE FUNCTION public.recalcular_progresso_pdi();
