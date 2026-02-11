
-- Enums
CREATE TYPE frequencia_atividade AS ENUM ('diaria', 'semanal', 'mensal', 'eventual');
CREATE TYPE complexidade_atividade AS ENUM ('baixa', 'media', 'alta');
CREATE TYPE classificacao_atividade AS ENUM ('rotineira', 'critica', 'excepcional');
CREATE TYPE tipo_conteudo_funcao AS ENUM ('manual', 'pop', 'instrucao', 'video', 'apresentacao', 'documento', 'link');
CREATE TYPE tipo_ferramenta AS ENUM ('sistema', 'software', 'planilha', 'equipamento');
CREATE TYPE tipo_competencia AS ENUM ('tecnica', 'comportamental', 'cognitiva');
CREATE TYPE obrigatoriedade_epi AS ENUM ('obrigatorio', 'recomendado', 'condicional');

-- 1. Atividades da Função
CREATE TABLE public.funcao_atividades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  cargo_id UUID NOT NULL REFERENCES public.cargos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  frequencia frequencia_atividade NOT NULL DEFAULT 'diaria',
  complexidade complexidade_atividade NOT NULL DEFAULT 'media',
  classificacao classificacao_atividade NOT NULL DEFAULT 'rotineira',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.funcao_atividades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.funcao_atividades FOR ALL USING (tenant_id = public.get_user_tenant_id());

CREATE TRIGGER update_funcao_atividades_updated_at BEFORE UPDATE ON public.funcao_atividades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Responsabilidades por Atividade
CREATE TABLE public.funcao_responsabilidades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  atividade_id UUID NOT NULL REFERENCES public.funcao_atividades(id) ON DELETE CASCADE,
  responsavel_direto TEXT,
  interfaces TEXT,
  consequencia_erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.funcao_responsabilidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.funcao_responsabilidades FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- 3. Conteúdos por Atividade (manuais, POPs, links)
CREATE TABLE public.funcao_conteudos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  atividade_id UUID NOT NULL REFERENCES public.funcao_atividades(id) ON DELETE CASCADE,
  tipo tipo_conteudo_funcao NOT NULL DEFAULT 'link',
  titulo TEXT NOT NULL,
  url TEXT NOT NULL,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.funcao_conteudos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.funcao_conteudos FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- 4. Ferramentas por Atividade
CREATE TABLE public.funcao_ferramentas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  atividade_id UUID NOT NULL REFERENCES public.funcao_atividades(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo tipo_ferramenta NOT NULL DEFAULT 'sistema',
  url_manual TEXT,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.funcao_ferramentas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.funcao_ferramentas FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- 5. Competências por Função
CREATE TABLE public.funcao_competencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  cargo_id UUID NOT NULL REFERENCES public.cargos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo tipo_competencia NOT NULL DEFAULT 'tecnica',
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.funcao_competencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.funcao_competencias FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- 6. Recursos de Aprendizado por Competência
CREATE TABLE public.funcao_competencia_recursos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  competencia_id UUID NOT NULL REFERENCES public.funcao_competencias(id) ON DELETE CASCADE,
  tipo tipo_conteudo_funcao NOT NULL DEFAULT 'link',
  titulo TEXT NOT NULL,
  url TEXT NOT NULL,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.funcao_competencia_recursos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.funcao_competencia_recursos FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- 7. Vinculação EPI ↔ Função
CREATE TABLE public.funcao_epi_vinculacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  cargo_id UUID NOT NULL REFERENCES public.cargos(id) ON DELETE CASCADE,
  epi_tipo_id UUID NOT NULL REFERENCES public.epi_tipos(id) ON DELETE CASCADE,
  obrigatoriedade obrigatoriedade_epi NOT NULL DEFAULT 'obrigatorio',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, cargo_id, epi_tipo_id)
);

ALTER TABLE public.funcao_epi_vinculacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.funcao_epi_vinculacoes FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- 8. Conteúdos de Treinamento por EPI vinculado
CREATE TABLE public.funcao_epi_conteudos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  vinculacao_id UUID NOT NULL REFERENCES public.funcao_epi_vinculacoes(id) ON DELETE CASCADE,
  tipo tipo_conteudo_funcao NOT NULL DEFAULT 'video',
  titulo TEXT NOT NULL,
  url TEXT NOT NULL,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.funcao_epi_conteudos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.funcao_epi_conteudos FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- 9. Questionário de EPI
CREATE TABLE public.funcao_epi_questionarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  vinculacao_id UUID NOT NULL REFERENCES public.funcao_epi_vinculacoes(id) ON DELETE CASCADE,
  pergunta TEXT NOT NULL,
  opcoes JSONB NOT NULL DEFAULT '[]',
  resposta_correta INTEGER NOT NULL DEFAULT 0,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.funcao_epi_questionarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.funcao_epi_questionarios FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- 10. Evidências de Treinamento
CREATE TABLE public.funcao_treinamento_evidencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  colaborador_id UUID,
  colaborador_nome TEXT NOT NULL,
  colaborador_cpf TEXT,
  cargo_id UUID NOT NULL REFERENCES public.cargos(id),
  vinculacao_id UUID REFERENCES public.funcao_epi_vinculacoes(id),
  tipo_treinamento TEXT NOT NULL DEFAULT 'epi',
  data_acesso TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_conclusao TIMESTAMPTZ,
  nota NUMERIC(5,2),
  nota_minima NUMERIC(5,2) DEFAULT 70,
  aprovado BOOLEAN DEFAULT false,
  aceite_eletronico BOOLEAN DEFAULT false,
  tentativa INTEGER DEFAULT 1,
  detalhes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.funcao_treinamento_evidencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.funcao_treinamento_evidencias FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- 11. Configurações do módulo por tenant
CREATE TABLE public.funcao_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) UNIQUE,
  treinamento_epi_obrigatorio BOOLEAN DEFAULT true,
  nota_minima_padrao NUMERIC(5,2) DEFAULT 70,
  reaplicacao_meses INTEGER DEFAULT 12,
  ativar_onboarding BOOLEAN DEFAULT true,
  ativar_mudanca_funcao BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.funcao_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.funcao_config FOR ALL USING (tenant_id = public.get_user_tenant_id());

CREATE TRIGGER update_funcao_config_updated_at BEFORE UPDATE ON public.funcao_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_funcao_atividades_cargo ON public.funcao_atividades(cargo_id);
CREATE INDEX idx_funcao_competencias_cargo ON public.funcao_competencias(cargo_id);
CREATE INDEX idx_funcao_epi_vinculacoes_cargo ON public.funcao_epi_vinculacoes(cargo_id);
CREATE INDEX idx_funcao_treinamento_evidencias_colaborador ON public.funcao_treinamento_evidencias(colaborador_id);
CREATE INDEX idx_funcao_treinamento_evidencias_cargo ON public.funcao_treinamento_evidencias(cargo_id);
