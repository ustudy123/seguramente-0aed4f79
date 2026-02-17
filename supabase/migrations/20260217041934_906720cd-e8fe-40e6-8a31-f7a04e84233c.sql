
-- Tabela principal de POPs vinculados a atividades
CREATE TABLE public.funcao_pops (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  atividade_id UUID NOT NULL,
  cargo_id UUID NOT NULL,
  codigo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'em_revisao', 'publicado', 'desatualizado')),
  versao_atual TEXT NOT NULL DEFAULT '1.0',
  gerado_por_ia BOOLEAN NOT NULL DEFAULT false,
  criado_por UUID,
  criado_por_nome TEXT,
  aprovado_por UUID,
  aprovado_por_nome TEXT,
  data_aprovacao TIMESTAMPTZ,
  -- Conteúdo estruturado do POP
  objetivo TEXT,
  escopo TEXT,
  responsabilidades JSONB DEFAULT '{}',
  definicoes TEXT,
  pre_requisitos JSONB DEFAULT '[]',
  materiais_ferramentas JSONB DEFAULT '[]',
  epis_sst TEXT,
  procedimento_passos JSONB DEFAULT '[]',
  criterios_qualidade TEXT,
  registros_evidencias TEXT,
  tratamento_nao_conformidades TEXT,
  referencias TEXT,
  -- Metadados
  html_completo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Histórico de versões
CREATE TABLE public.funcao_pop_versoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  pop_id UUID NOT NULL REFERENCES public.funcao_pops(id) ON DELETE CASCADE,
  versao TEXT NOT NULL,
  status TEXT NOT NULL,
  titulo TEXT NOT NULL,
  conteudo_snapshot JSONB NOT NULL,
  html_snapshot TEXT,
  motivo_alteracao TEXT,
  resumo_mudancas TEXT,
  alterado_por UUID,
  alterado_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_funcao_pops_tenant ON public.funcao_pops(tenant_id);
CREATE INDEX idx_funcao_pops_atividade ON public.funcao_pops(atividade_id);
CREATE INDEX idx_funcao_pops_cargo ON public.funcao_pops(cargo_id);
CREATE INDEX idx_funcao_pop_versoes_pop ON public.funcao_pop_versoes(pop_id);

-- RLS
ALTER TABLE public.funcao_pops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funcao_pop_versoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation funcao_pops" ON public.funcao_pops
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Tenant isolation funcao_pop_versoes" ON public.funcao_pop_versoes
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Trigger updated_at
CREATE TRIGGER update_funcao_pops_updated_at
  BEFORE UPDATE ON public.funcao_pops
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sequência para código do POP
CREATE SEQUENCE IF NOT EXISTS public.pop_codigo_seq START 1;
