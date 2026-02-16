
-- =============================================
-- MÓDULO TRILHAS DE DESENVOLVIMENTO
-- =============================================

-- Enum para tipo de trilha
CREATE TYPE trilha_tipo AS ENUM ('tecnica', 'comportamental', 'lideranca', 'cultura', 'ergonomia_saude', 'processos');

-- Enum para prioridade
CREATE TYPE trilha_prioridade AS ENUM ('obrigatoria', 'recomendada', 'opcional');

-- Enum para visibilidade
CREATE TYPE trilha_visibilidade AS ENUM ('publica', 'restrita');

-- Enum para status da trilha
CREATE TYPE trilha_status AS ENUM ('rascunho', 'ativa', 'arquivada');

-- Enum para tipo de módulo
CREATE TYPE trilha_modulo_tipo AS ENUM ('video', 'pdf', 'link', 'apresentacao', 'conteudo_interno', 'quiz', 'atividade_pratica', 'checklist', 'reflexao', 'estudo_caso', 'microdesafio');

-- Enum para ordem do módulo
CREATE TYPE trilha_modulo_ordem_tipo AS ENUM ('sequencial', 'livre');

-- Enum para status do módulo (progresso do colaborador)
CREATE TYPE trilha_progresso_status AS ENUM ('nao_iniciado', 'em_andamento', 'concluido');

-- =============================================
-- TABELA: trilhas
-- =============================================
CREATE TABLE public.trilhas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  nome TEXT NOT NULL,
  descricao TEXT,
  objetivo TEXT,
  tipo trilha_tipo NOT NULL DEFAULT 'tecnica',
  prioridade trilha_prioridade NOT NULL DEFAULT 'recomendada',
  visibilidade trilha_visibilidade NOT NULL DEFAULT 'publica',
  status trilha_status NOT NULL DEFAULT 'rascunho',
  pontuacao_minima INTEGER DEFAULT 0,
  prazo_dias INTEGER,
  imagem_url TEXT,
  conexao_pdi BOOLEAN DEFAULT false,
  conexao_indicadores TEXT[],
  criado_por TEXT,
  criado_por_nome TEXT,
  total_modulos INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.trilhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trilhas_select" ON public.trilhas FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "trilhas_insert" ON public.trilhas FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "trilhas_update" ON public.trilhas FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "trilhas_delete" ON public.trilhas FOR DELETE
  USING (tenant_id = public.get_user_tenant_id());

CREATE TRIGGER update_trilhas_updated_at
  BEFORE UPDATE ON public.trilhas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- TABELA: trilha_modulos
-- =============================================
CREATE TABLE public.trilha_modulos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  trilha_id UUID NOT NULL REFERENCES public.trilhas(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  objetivo TEXT,
  tipo trilha_modulo_tipo NOT NULL DEFAULT 'video',
  conteudo_url TEXT,
  conteudo_texto TEXT,
  tempo_estimado_min INTEGER DEFAULT 10,
  pontuacao INTEGER DEFAULT 10,
  ordem INTEGER NOT NULL DEFAULT 0,
  ordem_tipo trilha_modulo_ordem_tipo NOT NULL DEFAULT 'sequencial',
  evidencia_obrigatoria BOOLEAN DEFAULT false,
  competencia_relacionada TEXT,
  acao_pdi_id UUID,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.trilha_modulos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trilha_modulos_select" ON public.trilha_modulos FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "trilha_modulos_insert" ON public.trilha_modulos FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "trilha_modulos_update" ON public.trilha_modulos FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "trilha_modulos_delete" ON public.trilha_modulos FOR DELETE
  USING (tenant_id = public.get_user_tenant_id());

CREATE TRIGGER update_trilha_modulos_updated_at
  BEFORE UPDATE ON public.trilha_modulos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- TABELA: trilha_atribuicoes (quem deve fazer)
-- =============================================
CREATE TABLE public.trilha_atribuicoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  trilha_id UUID NOT NULL REFERENCES public.trilhas(id) ON DELETE CASCADE,
  tipo_alvo TEXT NOT NULL DEFAULT 'todos', -- 'todos', 'funcao', 'setor', 'unidade', 'individual'
  alvo_id TEXT, -- cargo_id, departamento_id, filial_id ou user_id
  alvo_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.trilha_atribuicoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trilha_atribuicoes_select" ON public.trilha_atribuicoes FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "trilha_atribuicoes_insert" ON public.trilha_atribuicoes FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "trilha_atribuicoes_delete" ON public.trilha_atribuicoes FOR DELETE
  USING (tenant_id = public.get_user_tenant_id());

-- =============================================
-- TABELA: trilha_progresso (execução do colaborador)
-- =============================================
CREATE TABLE public.trilha_progresso (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  trilha_id UUID NOT NULL REFERENCES public.trilhas(id) ON DELETE CASCADE,
  modulo_id UUID NOT NULL REFERENCES public.trilha_modulos(id) ON DELETE CASCADE,
  colaborador_id TEXT NOT NULL,
  colaborador_nome TEXT NOT NULL,
  status trilha_progresso_status NOT NULL DEFAULT 'nao_iniciado',
  nota NUMERIC,
  evidencia_url TEXT,
  evidencia_texto TEXT,
  data_inicio TIMESTAMPTZ,
  data_conclusao TIMESTAMPTZ,
  pontos_obtidos INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, trilha_id, modulo_id, colaborador_id)
);

ALTER TABLE public.trilha_progresso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trilha_progresso_select" ON public.trilha_progresso FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "trilha_progresso_insert" ON public.trilha_progresso FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "trilha_progresso_update" ON public.trilha_progresso FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id());

CREATE TRIGGER update_trilha_progresso_updated_at
  BEFORE UPDATE ON public.trilha_progresso
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- TABELA: trilha_quiz_perguntas
-- =============================================
CREATE TABLE public.trilha_quiz_perguntas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  modulo_id UUID NOT NULL REFERENCES public.trilha_modulos(id) ON DELETE CASCADE,
  pergunta TEXT NOT NULL,
  opcoes TEXT[] NOT NULL,
  resposta_correta INTEGER NOT NULL DEFAULT 0,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.trilha_quiz_perguntas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trilha_quiz_select" ON public.trilha_quiz_perguntas FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "trilha_quiz_insert" ON public.trilha_quiz_perguntas FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "trilha_quiz_update" ON public.trilha_quiz_perguntas FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "trilha_quiz_delete" ON public.trilha_quiz_perguntas FOR DELETE
  USING (tenant_id = public.get_user_tenant_id());

-- Função para atualizar total_modulos na trilha
CREATE OR REPLACE FUNCTION public.atualizar_total_modulos_trilha()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.trilhas
  SET total_modulos = (
    SELECT COUNT(*) FROM public.trilha_modulos
    WHERE trilha_id = COALESCE(NEW.trilha_id, OLD.trilha_id)
    AND ativo = true
  )
  WHERE id = COALESCE(NEW.trilha_id, OLD.trilha_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_atualizar_total_modulos
  AFTER INSERT OR UPDATE OR DELETE ON public.trilha_modulos
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_total_modulos_trilha();
