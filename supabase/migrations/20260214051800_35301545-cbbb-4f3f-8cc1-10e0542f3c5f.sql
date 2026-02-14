
-- =============================================
-- MÓDULO: Gestão de Terceiros & SST
-- =============================================

-- Enum for terceiro status
CREATE TYPE public.terceiro_status AS ENUM ('liberado', 'restrito', 'bloqueado');
CREATE TYPE public.terceiro_acesso AS ENUM ('eventual', 'recorrente', 'continuo');
CREATE TYPE public.terceiro_doc_status AS ENUM ('valido', 'a_vencer', 'vencido', 'pendente');

-- =============================================
-- 1. TERCEIROS (Empresas Contratadas)
-- =============================================
CREATE TABLE public.terceiros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT NOT NULL,
  atividade_principal TEXT,
  cnae TEXT,
  responsavel_nome TEXT,
  responsavel_cargo TEXT,
  email TEXT,
  telefone TEXT,
  tipo_servico TEXT[], -- manutenção, elétrica, etc.
  unidades TEXT[],
  setores TEXT[],
  tipo_acesso terceiro_acesso DEFAULT 'eventual',
  contrato_inicio DATE,
  contrato_fim DATE,
  atividade_risco BOOLEAN DEFAULT false,
  status terceiro_status DEFAULT 'liberado',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.terceiros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for terceiros" ON public.terceiros
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

CREATE TRIGGER update_terceiros_updated_at
  BEFORE UPDATE ON public.terceiros
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 2. TRABALHADORES DO TERCEIRO
-- =============================================
CREATE TABLE public.terceiro_trabalhadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  terceiro_id UUID NOT NULL REFERENCES public.terceiros(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cpf TEXT,
  funcao TEXT,
  atividades TEXT[],
  unidade TEXT,
  setor TEXT,
  atividades_risco TEXT[], -- altura, confinado, eletricidade, etc.
  status terceiro_status DEFAULT 'liberado',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.terceiro_trabalhadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for terceiro_trabalhadores" ON public.terceiro_trabalhadores
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

CREATE TRIGGER update_terceiro_trabalhadores_updated_at
  BEFORE UPDATE ON public.terceiro_trabalhadores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 3. DOCUMENTOS (empresa ou trabalhador)
-- =============================================
CREATE TABLE public.terceiro_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  terceiro_id UUID NOT NULL REFERENCES public.terceiros(id) ON DELETE CASCADE,
  trabalhador_id UUID REFERENCES public.terceiro_trabalhadores(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- PGR, PCMSO, LTCAT, ASO, Contrato, Certificado, etc.
  nome TEXT NOT NULL,
  arquivo_url TEXT,
  arquivo_nome TEXT,
  arquivo_tamanho BIGINT,
  data_emissao DATE,
  data_validade DATE,
  status terceiro_doc_status DEFAULT 'pendente',
  observacoes TEXT,
  criado_por UUID,
  criado_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.terceiro_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for terceiro_documentos" ON public.terceiro_documentos
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

CREATE TRIGGER update_terceiro_documentos_updated_at
  BEFORE UPDATE ON public.terceiro_documentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 4. TREINAMENTOS DO TRABALHADOR
-- =============================================
CREATE TABLE public.terceiro_treinamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  terceiro_id UUID NOT NULL REFERENCES public.terceiros(id) ON DELETE CASCADE,
  trabalhador_id UUID NOT NULL REFERENCES public.terceiro_trabalhadores(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- NR-10, NR-12, NR-18, NR-33, NR-35, etc.
  descricao TEXT,
  data_realizacao DATE,
  carga_horaria INTEGER,
  data_validade DATE,
  certificado_url TEXT,
  certificado_nome TEXT,
  status terceiro_doc_status DEFAULT 'pendente',
  criado_por UUID,
  criado_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.terceiro_treinamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for terceiro_treinamentos" ON public.terceiro_treinamentos
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

CREATE TRIGGER update_terceiro_treinamentos_updated_at
  BEFORE UPDATE ON public.terceiro_treinamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 5. FUNCTION: Auto-calculate doc/training status
-- =============================================
CREATE OR REPLACE FUNCTION public.atualizar_status_terceiro_doc()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.data_validade IS NULL THEN
    NEW.status := 'pendente';
  ELSIF NEW.data_validade < CURRENT_DATE THEN
    NEW.status := 'vencido';
  ELSIF NEW.data_validade <= CURRENT_DATE + INTERVAL '30 days' THEN
    NEW.status := 'a_vencer';
  ELSE
    NEW.status := 'valido';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_status_terceiro_documentos
  BEFORE INSERT OR UPDATE ON public.terceiro_documentos
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_status_terceiro_doc();

CREATE TRIGGER auto_status_terceiro_treinamentos
  BEFORE INSERT OR UPDATE ON public.terceiro_treinamentos
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_status_terceiro_doc();
