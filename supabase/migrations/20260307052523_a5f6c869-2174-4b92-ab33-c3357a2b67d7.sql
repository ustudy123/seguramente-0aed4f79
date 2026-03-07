
-- Tabela principal para armazenar registros ergonômicos (análises IA + manuais)
CREATE TABLE IF NOT EXISTS public.ergonomia_analises (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES public.empresa_cadastro(id),
  
  -- Identificação do posto
  setor TEXT NOT NULL,
  cargo TEXT NOT NULL,
  atividade TEXT,
  unidade TEXT,
  num_trabalhadores INTEGER DEFAULT 1,
  
  -- Metadados da análise
  tipo_analise TEXT NOT NULL DEFAULT 'ia', -- 'ia' | 'manual' | 'checklist'
  data_analise TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  realizado_por TEXT,
  realizado_por_id UUID,
  
  -- Resultados da análise (estruturado como JSONB)
  riscos_identificados JSONB DEFAULT '[]'::jsonb,
  recomendacoes JSONB DEFAULT '[]'::jsonb,
  lacunas_normativas JSONB DEFAULT '[]'::jsonb,
  conformidade_estimada INTEGER DEFAULT 0,
  resumo_geral TEXT,
  
  -- Classificação geral
  classificacao_risco TEXT DEFAULT 'baixo', -- 'baixo' | 'moderado' | 'alto'
  
  -- Evidências vinculadas
  evidencias_urls JSONB DEFAULT '[]'::jsonb,
  contexto_adicional TEXT,
  
  -- Transcrição de áudio (se houver)
  transcricao_audio TEXT,
  
  -- Status
  status TEXT DEFAULT 'ativo', -- 'ativo' | 'arquivado'
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.ergonomia_analises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can manage ergonomia_analises"
  ON public.ergonomia_analises
  FOR ALL
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- Trigger updated_at
CREATE TRIGGER update_ergonomia_analises_updated_at
  BEFORE UPDATE ON public.ergonomia_analises
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_ergonomia_analises_tenant ON public.ergonomia_analises(tenant_id);
CREATE INDEX idx_ergonomia_analises_setor_cargo ON public.ergonomia_analises(tenant_id, setor, cargo);
CREATE INDEX idx_ergonomia_analises_data ON public.ergonomia_analises(tenant_id, data_analise DESC);

-- Adicionar coluna cargo/setor nos riscos para suportar mapa de riscos
ALTER TABLE public.ergonomia_riscos ADD COLUMN IF NOT EXISTS cargo TEXT;
ALTER TABLE public.ergonomia_riscos ADD COLUMN IF NOT EXISTS unidade TEXT;
ALTER TABLE public.ergonomia_riscos ADD COLUMN IF NOT EXISTS analise_id UUID REFERENCES public.ergonomia_analises(id);
