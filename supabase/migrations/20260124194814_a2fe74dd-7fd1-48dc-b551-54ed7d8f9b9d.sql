-- Criar enums para ergonomia
CREATE TYPE ergonomia_status AS ENUM ('atendido', 'parcial', 'nao_atendido', 'nao_aplicavel');
CREATE TYPE ergonomia_categoria AS ENUM ('organizacao_trabalho', 'mobiliario', 'equipamentos', 'condicoes_ambientais', 'levantamento_cargas', 'aet');
CREATE TYPE ergonomia_eixo AS ENUM ('fisico', 'cognitivo', 'organizacional');
CREATE TYPE risco_severidade AS ENUM ('baixo', 'medio', 'alto', 'critico');
CREATE TYPE acao_prioridade AS ENUM ('baixa', 'media', 'alta', 'urgente');
CREATE TYPE acao_status AS ENUM ('pendente', 'em_andamento', 'concluida', 'cancelada');

-- Tabela principal de itens de conformidade NR-17
CREATE TABLE public.ergonomia_itens_nr17 (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  categoria ergonomia_categoria NOT NULL,
  codigo TEXT NOT NULL, -- Ex: "17.1.1", "17.2.1.a"
  titulo TEXT NOT NULL,
  descricao TEXT,
  status ergonomia_status NOT NULL DEFAULT 'nao_atendido',
  responsavel_id UUID,
  responsavel_nome TEXT,
  data_avaliacao TIMESTAMP WITH TIME ZONE,
  proxima_reavaliacao DATE,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, codigo)
);

-- Tabela de evidências vinculadas aos itens NR-17
CREATE TABLE public.ergonomia_evidencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  item_nr17_id UUID NOT NULL REFERENCES public.ergonomia_itens_nr17(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- 'documento', 'foto', 'video', 'audio', 'relatorio'
  titulo TEXT NOT NULL,
  descricao TEXT,
  arquivo_url TEXT,
  arquivo_nome TEXT,
  arquivo_tamanho INTEGER,
  enviado_por UUID,
  enviado_por_nome TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de riscos ergonômicos
CREATE TABLE public.ergonomia_riscos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  item_nr17_id UUID REFERENCES public.ergonomia_itens_nr17(id) ON DELETE SET NULL,
  eixo ergonomia_eixo NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  fonte TEXT, -- Origem do risco (posto, tarefa, ambiente)
  impactos_potenciais TEXT[],
  severidade risco_severidade NOT NULL DEFAULT 'medio',
  probabilidade risco_severidade NOT NULL DEFAULT 'medio',
  medidas_existentes TEXT[],
  medidas_recomendadas TEXT[],
  departamento TEXT,
  setor TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de ações corretivas/preventivas
CREATE TABLE public.ergonomia_acoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  risco_id UUID REFERENCES public.ergonomia_riscos(id) ON DELETE SET NULL,
  item_nr17_id UUID REFERENCES public.ergonomia_itens_nr17(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'corretiva', -- 'corretiva', 'preventiva', 'melhoria'
  prioridade acao_prioridade NOT NULL DEFAULT 'media',
  status acao_status NOT NULL DEFAULT 'pendente',
  responsavel_id UUID,
  responsavel_nome TEXT,
  prazo DATE,
  data_inicio DATE,
  data_conclusao DATE,
  evidencia_conclusao TEXT,
  custo_estimado NUMERIC,
  custo_real NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice de Maturidade Ergonômica (histórico)
CREATE TABLE public.ergonomia_maturidade (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  data_avaliacao DATE NOT NULL DEFAULT CURRENT_DATE,
  nivel TEXT NOT NULL, -- 'reativo', 'corretivo', 'preventivo', 'estrategico', 'cultura_saudavel'
  pontuacao INTEGER NOT NULL DEFAULT 0, -- 0-100
  itens_atendidos INTEGER NOT NULL DEFAULT 0,
  itens_parciais INTEGER NOT NULL DEFAULT 0,
  itens_nao_atendidos INTEGER NOT NULL DEFAULT 0,
  riscos_criticos INTEGER NOT NULL DEFAULT 0,
  acoes_concluidas INTEGER NOT NULL DEFAULT 0,
  acoes_pendentes INTEGER NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, data_avaliacao)
);

-- Enable RLS
ALTER TABLE public.ergonomia_itens_nr17 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ergonomia_evidencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ergonomia_riscos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ergonomia_acoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ergonomia_maturidade ENABLE ROW LEVEL SECURITY;

-- Policies para ergonomia_itens_nr17
CREATE POLICY "Usuários podem ver itens NR-17 do seu tenant"
ON public.ergonomia_itens_nr17 FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Managers+ podem gerenciar itens NR-17"
ON public.ergonomia_itens_nr17 FOR ALL
USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'))
WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'));

-- Policies para ergonomia_evidencias
CREATE POLICY "Usuários podem ver evidências do seu tenant"
ON public.ergonomia_evidencias FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Managers+ podem gerenciar evidências"
ON public.ergonomia_evidencias FOR ALL
USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'))
WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'));

-- Policies para ergonomia_riscos
CREATE POLICY "Usuários podem ver riscos do seu tenant"
ON public.ergonomia_riscos FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Managers+ podem gerenciar riscos"
ON public.ergonomia_riscos FOR ALL
USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'))
WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'));

-- Policies para ergonomia_acoes
CREATE POLICY "Usuários podem ver ações do seu tenant"
ON public.ergonomia_acoes FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Managers+ podem gerenciar ações"
ON public.ergonomia_acoes FOR ALL
USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'))
WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'));

-- Policies para ergonomia_maturidade
CREATE POLICY "Usuários podem ver maturidade do seu tenant"
ON public.ergonomia_maturidade FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Managers+ podem inserir maturidade"
ON public.ergonomia_maturidade FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'));

-- Triggers para updated_at
CREATE TRIGGER update_ergonomia_itens_nr17_updated_at
BEFORE UPDATE ON public.ergonomia_itens_nr17
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ergonomia_riscos_updated_at
BEFORE UPDATE ON public.ergonomia_riscos
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ergonomia_acoes_updated_at
BEFORE UPDATE ON public.ergonomia_acoes
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Storage bucket para evidências ergonômicas
INSERT INTO storage.buckets (id, name, public) VALUES ('ergonomia-evidencias', 'ergonomia-evidencias', false);

CREATE POLICY "Usuários podem ver evidências ergonômicas do tenant"
ON storage.objects FOR SELECT
USING (bucket_id = 'ergonomia-evidencias');

CREATE POLICY "Managers podem fazer upload de evidências ergonômicas"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'ergonomia-evidencias');

CREATE POLICY "Managers podem deletar evidências ergonômicas"
ON storage.objects FOR DELETE
USING (bucket_id = 'ergonomia-evidencias');