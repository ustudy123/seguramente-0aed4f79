
-- ================================================
-- MÓDULO PSICOSSOCIAL - REFORMULAÇÃO COMPLETA
-- Baseado em: NR-01, NR-17, ISO 45001, ISO 45003
-- Instrumentos: COPSOQ, HSE Management Standards, PROART
-- ================================================

-- 1. Adicionar coluna instrumento nas campanhas existentes
ALTER TABLE questionario_psicossocial_campanhas 
  ADD COLUMN IF NOT EXISTS instrumento TEXT DEFAULT 'copsoq' CHECK (instrumento IN ('copsoq', 'hse', 'proart', 'customizado')),
  ADD COLUMN IF NOT EXISTS escopo TEXT DEFAULT 'empresa' CHECK (escopo IN ('empresa', 'unidade', 'setor', 'funcao', 'grupo')),
  ADD COLUMN IF NOT EXISTS escopo_valores TEXT[],
  ADD COLUMN IF NOT EXISTS ips_score NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS ips_classificacao TEXT CHECK (ips_classificacao IN ('saudavel', 'estavel', 'atencao', 'risco', 'critico')),
  ADD COLUMN IF NOT EXISTS total_respostas INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS radar_data JSONB;

-- 2. Criar tabela de dimensões psicossociais (base normativa)
CREATE TABLE IF NOT EXISTS public.psicossocial_dimensoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  descricao TEXT,
  instrumento TEXT NOT NULL DEFAULT 'copsoq',
  categoria TEXT NOT NULL, -- demanda, controle, relacoes, justica, seguranca, sentido, monotonia, conflito, assedio
  ativo BOOLEAN DEFAULT true,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Criar tabela de alertas psicossociais inteligentes
CREATE TABLE IF NOT EXISTS public.psicossocial_alertas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  campanha_id UUID REFERENCES questionario_psicossocial_campanhas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- burnout_risco, boreout_risco, jornada_excessiva, lideranca_baixa, afastamentos_aumento, etc
  titulo TEXT NOT NULL,
  descricao TEXT,
  severidade TEXT NOT NULL DEFAULT 'media' CHECK (severidade IN ('baixa', 'media', 'alta', 'critica')),
  setor TEXT,
  funcao TEXT,
  metadados JSONB,
  resolvido BOOLEAN DEFAULT false,
  resolvido_em TIMESTAMP WITH TIME ZONE,
  acao_criada_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Criar tabela de evidências organizacionais para contraprova
CREATE TABLE IF NOT EXISTS public.psicossocial_evidencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  campanha_id UUID REFERENCES questionario_psicossocial_campanhas(id) ON DELETE SET NULL,
  tipo_modulo TEXT NOT NULL, -- jornada, atestados, bem_estar, ouvidoria, feedbacks, etc
  indicador TEXT NOT NULL,
  valor NUMERIC,
  valor_texto TEXT,
  referencia_id TEXT,
  periodo_inicio DATE,
  periodo_fim DATE,
  peso NUMERIC DEFAULT 1.0, -- peso na contraprova
  metadados JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Criar tabela de inventário de riscos psicossociais (para PGR)
CREATE TABLE IF NOT EXISTS public.psicossocial_inventario_riscos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  campanha_id UUID REFERENCES questionario_psicossocial_campanhas(id) ON DELETE CASCADE,
  setor TEXT,
  funcao TEXT,
  fator_psicossocial TEXT NOT NULL,
  evidencias JSONB,
  probabilidade TEXT NOT NULL DEFAULT 'media' CHECK (probabilidade IN ('muito_baixa', 'baixa', 'media', 'alta', 'muito_alta')),
  severidade TEXT NOT NULL DEFAULT 'media' CHECK (severidade IN ('muito_baixa', 'baixa', 'media', 'alta', 'muito_alta')),
  exposicao TEXT NOT NULL DEFAULT 'ocasional' CHECK (exposicao IN ('rara', 'ocasional', 'frequente', 'continua')),
  classificacao TEXT NOT NULL DEFAULT 'toleravel' CHECK (classificacao IN ('aceitavel', 'toleravel', 'moderado', 'substancial', 'intoleravel')),
  acao_recomendada TEXT,
  plano_acao_id UUID,
  status TEXT DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_tratamento', 'monitoramento', 'encerrado')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. Habilitar RLS nas novas tabelas
ALTER TABLE public.psicossocial_dimensoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.psicossocial_alertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.psicossocial_evidencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.psicossocial_inventario_riscos ENABLE ROW LEVEL SECURITY;

-- 7. Políticas RLS
-- Dimensões (leitura pública para todos autenticados)
CREATE POLICY "psicossocial_dimensoes_select" ON public.psicossocial_dimensoes
  FOR SELECT TO authenticated USING (true);

-- Alertas por tenant
CREATE POLICY "psicossocial_alertas_tenant_select" ON public.psicossocial_alertas
  FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "psicossocial_alertas_tenant_insert" ON public.psicossocial_alertas
  FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "psicossocial_alertas_tenant_update" ON public.psicossocial_alertas
  FOR UPDATE TO authenticated USING (tenant_id = public.get_user_tenant_id());

-- Evidências por tenant
CREATE POLICY "psicossocial_evidencias_tenant_select" ON public.psicossocial_evidencias
  FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "psicossocial_evidencias_tenant_insert" ON public.psicossocial_evidencias
  FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant_id());

-- Inventário de riscos por tenant
CREATE POLICY "psicossocial_inventario_tenant_select" ON public.psicossocial_inventario_riscos
  FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "psicossocial_inventario_tenant_insert" ON public.psicossocial_inventario_riscos
  FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "psicossocial_inventario_tenant_update" ON public.psicossocial_inventario_riscos
  FOR UPDATE TO authenticated USING (tenant_id = public.get_user_tenant_id());

-- 8. Triggers de updated_at
CREATE TRIGGER psicossocial_alertas_updated_at
  BEFORE UPDATE ON public.psicossocial_alertas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER psicossocial_inventario_updated_at
  BEFORE UPDATE ON public.psicossocial_inventario_riscos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Inserir dimensões base (COPSOQ + HSE)
INSERT INTO public.psicossocial_dimensoes (codigo, nome, descricao, instrumento, categoria, ordem) VALUES
  -- COPSOQ
  ('copsoq_demanda_carga', 'Carga de Trabalho', 'Volume e intensidade das tarefas exigidas', 'copsoq', 'demanda', 1),
  ('copsoq_demanda_tempo', 'Pressão por Tempo', 'Urgência e ritmo acelerado no trabalho', 'copsoq', 'demanda', 2),
  ('copsoq_demanda_ritmo', 'Ritmo de Trabalho', 'Velocidade e cadência das atividades', 'copsoq', 'demanda', 3),
  ('copsoq_controle_autonomia', 'Autonomia', 'Liberdade para tomar decisões no trabalho', 'copsoq', 'controle', 4),
  ('copsoq_controle_participacao', 'Participação em Decisões', 'Envolvimento nas escolhas organizacionais', 'copsoq', 'controle', 5),
  ('copsoq_relacoes_lideranca', 'Suporte da Liderança', 'Qualidade da relação com gestores', 'copsoq', 'relacoes', 6),
  ('copsoq_relacoes_equipe', 'Suporte da Equipe', 'Coesão e apoio entre colegas', 'copsoq', 'relacoes', 7),
  ('copsoq_justica_reconhecimento', 'Reconhecimento', 'Valorização do esforço e resultados', 'copsoq', 'justica', 8),
  ('copsoq_justica_tratamento', 'Tratamento Justo', 'Equidade e imparcialidade organizacional', 'copsoq', 'justica', 9),
  ('copsoq_seguranca_expressao', 'Liberdade de Expressão', 'Segurança para opinar sem medo', 'copsoq', 'seguranca', 10),
  ('copsoq_sentido_proposito', 'Propósito no Trabalho', 'Significado e relevância das atividades', 'copsoq', 'sentido', 11),
  ('copsoq_monotonia_repetitividade', 'Repetitividade', 'Grau de monotonia e repetição das tarefas', 'copsoq', 'monotonia', 12),
  ('copsoq_conflito_vida', 'Conflito Trabalho-Vida', 'Equilíbrio entre vida pessoal e trabalho', 'copsoq', 'conflito', 13),
  -- HSE Management Standards
  ('hse_demanda', 'Demanda (HSE)', 'Carga, ritmo e ambiente de trabalho', 'hse', 'demanda', 14),
  ('hse_controle', 'Controle (HSE)', 'Autonomia e participação nas decisões', 'hse', 'controle', 15),
  ('hse_suporte_gestor', 'Suporte do Gestor (HSE)', 'Suporte e incentivo da liderança', 'hse', 'relacoes', 16),
  ('hse_suporte_pares', 'Suporte dos Pares (HSE)', 'Suporte e incentivo dos colegas', 'hse', 'relacoes', 17),
  ('hse_relacionamentos', 'Relacionamentos (HSE)', 'Comportamentos positivos para evitar conflitos', 'hse', 'relacoes', 18),
  ('hse_funcao', 'Função (HSE)', 'Clareza de papéis e responsabilidades', 'hse', 'sentido', 19),
  ('hse_mudanca', 'Gestão de Mudanças (HSE)', 'Como mudanças organizacionais são gerenciadas', 'hse', 'controle', 20)
ON CONFLICT (codigo) DO NOTHING;

-- 10. Índices para performance
CREATE INDEX IF NOT EXISTS idx_psicossocial_alertas_tenant ON public.psicossocial_alertas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_psicossocial_alertas_campanha ON public.psicossocial_alertas(campanha_id);
CREATE INDEX IF NOT EXISTS idx_psicossocial_evidencias_tenant ON public.psicossocial_evidencias(tenant_id);
CREATE INDEX IF NOT EXISTS idx_psicossocial_inventario_tenant ON public.psicossocial_inventario_riscos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_psicossocial_inventario_campanha ON public.psicossocial_inventario_riscos(campanha_id);
