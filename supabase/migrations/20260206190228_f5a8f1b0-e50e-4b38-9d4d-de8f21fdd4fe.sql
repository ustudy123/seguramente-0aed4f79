-- Enums para o módulo de atestados
CREATE TYPE public.atestado_tipo AS ENUM ('assistencial', 'ocupacional');

CREATE TYPE public.atestado_subtipo_assistencial AS ENUM (
  'medico',
  'odontologico',
  'psicologico',
  'comparecimento',
  'acompanhante',
  'acidente'
);

CREATE TYPE public.atestado_subtipo_ocupacional AS ENUM (
  'admissional',
  'periodico',
  'retorno_trabalho',
  'mudanca_funcao',
  'demissional'
);

CREATE TYPE public.grupo_clinico AS ENUM (
  'mental',
  'osteomuscular',
  'respiratorio',
  'cardiovascular',
  'digestivo',
  'dermatologico',
  'neurologico',
  'infeccioso',
  'oncologico',
  'endocrino',
  'outro'
);

CREATE TYPE public.nexo_trabalho AS ENUM (
  'nao',
  'em_analise',
  'sim'
);

CREATE TYPE public.aptidao_ocupacional AS ENUM (
  'apto',
  'apto_com_restricoes',
  'inapto_temporario',
  'inapto'
);

CREATE TYPE public.beneficio_inss_especie AS ENUM (
  'b31',
  'b91'
);

CREATE TYPE public.afastamento_status AS ENUM (
  'ativo',
  'encerrado',
  'beneficio_inss'
);

CREATE TYPE public.evento_saude_status AS ENUM (
  'aberto',
  'em_acompanhamento',
  'encerrado'
);

-- Tabela principal de Atestados
CREATE TABLE public.atestados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  colaborador_id UUID REFERENCES public.profiles(user_id),
  colaborador_nome TEXT NOT NULL,
  colaborador_cpf TEXT,
  colaborador_cargo TEXT,
  colaborador_departamento TEXT,
  
  -- Tipo e subtipo
  tipo atestado_tipo NOT NULL,
  subtipo_assistencial atestado_subtipo_assistencial,
  subtipo_ocupacional atestado_subtipo_ocupacional,
  
  -- Dados do documento
  data_emissao DATE NOT NULL,
  profissional_nome TEXT NOT NULL,
  profissional_registro TEXT NOT NULL,
  profissional_tipo TEXT, -- CRM, CRO, CRP etc
  
  -- Afastamento (apenas assistencial)
  data_inicio_afastamento DATE,
  data_fim_afastamento DATE,
  dias_afastamento INTEGER,
  horas_afastamento INTEGER,
  unidade_afastamento TEXT DEFAULT 'dias', -- 'dias' ou 'horas'
  
  -- CID (dados sensíveis)
  contem_cid BOOLEAN DEFAULT false,
  cid_codigo TEXT, -- Acesso restrito
  grupo_clinico grupo_clinico,
  nexo_trabalho nexo_trabalho DEFAULT 'nao',
  
  -- Ocupacional específico
  aptidao aptidao_ocupacional,
  restricoes TEXT,
  observacoes_ocupacionais TEXT,
  
  -- Arquivo
  arquivo_url TEXT,
  arquivo_nome TEXT,
  arquivo_tamanho INTEGER,
  
  -- Vínculos
  evento_saude_id UUID,
  afastamento_id UUID,
  
  -- Metadados
  observacoes TEXT,
  criado_por UUID,
  criado_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de Afastamentos (consolida atestados)
CREATE TABLE public.afastamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  colaborador_id UUID REFERENCES public.profiles(user_id),
  colaborador_nome TEXT NOT NULL,
  colaborador_cpf TEXT,
  
  -- Período
  data_inicio DATE NOT NULL,
  data_fim DATE,
  dias_totais INTEGER DEFAULT 0,
  
  -- Status e controle
  status afastamento_status NOT NULL DEFAULT 'ativo',
  motivo_principal grupo_clinico,
  nexo_trabalho nexo_trabalho DEFAULT 'nao',
  
  -- Regra 15/30 dias
  alerta_15_dias BOOLEAN DEFAULT false,
  alerta_30_dias BOOLEAN DEFAULT false,
  aso_retorno_pendente BOOLEAN DEFAULT false,
  aso_retorno_id UUID, -- Referência ao ASO de retorno
  
  -- Vínculo
  evento_saude_id UUID,
  beneficio_inss_id UUID,
  
  -- Metadados
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de Eventos de Saúde (agrupa documentos relacionados)
CREATE TABLE public.eventos_saude (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  colaborador_id UUID REFERENCES public.profiles(user_id),
  colaborador_nome TEXT NOT NULL,
  colaborador_cpf TEXT,
  
  -- Identificação
  codigo TEXT NOT NULL, -- EVS-00001
  titulo TEXT NOT NULL,
  descricao TEXT,
  
  -- Classificação
  grupo_clinico_principal grupo_clinico,
  nexo_trabalho nexo_trabalho DEFAULT 'nao',
  status evento_saude_status NOT NULL DEFAULT 'aberto',
  
  -- Período
  data_inicio DATE NOT NULL,
  data_fim DATE,
  
  -- Contadores
  total_atestados INTEGER DEFAULT 0,
  total_dias_afastamento INTEGER DEFAULT 0,
  
  -- Metadados
  observacoes TEXT,
  criado_por UUID,
  criado_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de Benefícios INSS
CREATE TABLE public.beneficios_inss (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  colaborador_id UUID REFERENCES public.profiles(user_id),
  colaborador_nome TEXT NOT NULL,
  colaborador_cpf TEXT,
  
  -- Benefício
  numero_beneficio TEXT,
  especie beneficio_inss_especie NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE,
  data_alta DATE,
  
  -- Estabilidade (B91)
  gera_estabilidade BOOLEAN DEFAULT false,
  data_fim_estabilidade DATE,
  
  -- Vínculos
  evento_saude_id UUID,
  afastamento_id UUID,
  
  -- Documentos
  arquivo_url TEXT,
  arquivo_nome TEXT,
  
  -- Metadados
  observacoes TEXT,
  criado_por UUID,
  criado_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de Alertas de Saúde
CREATE TABLE public.alertas_saude (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Tipo e referência
  tipo TEXT NOT NULL, -- '15_dias', '30_dias', 'aso_retorno', 'b91_estabilidade', 'recorrencia', etc
  referencia_tipo TEXT NOT NULL, -- 'atestado', 'afastamento', 'evento_saude', 'colaborador'
  referencia_id UUID NOT NULL,
  
  -- Colaborador
  colaborador_id UUID,
  colaborador_nome TEXT NOT NULL,
  
  -- Conteúdo
  titulo TEXT NOT NULL,
  descricao TEXT,
  prioridade TEXT DEFAULT 'media', -- 'baixa', 'media', 'alta', 'critica'
  
  -- Status
  lido BOOLEAN DEFAULT false,
  resolvido BOOLEAN DEFAULT false,
  resolvido_por UUID,
  resolvido_em TIMESTAMPTZ,
  
  -- Ação gerada
  acao_gerada_id UUID, -- Referência a plano_acoes
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Adicionar foreign keys
ALTER TABLE public.atestados 
  ADD CONSTRAINT atestados_evento_saude_fkey 
  FOREIGN KEY (evento_saude_id) REFERENCES public.eventos_saude(id) ON DELETE SET NULL;

ALTER TABLE public.atestados 
  ADD CONSTRAINT atestados_afastamento_fkey 
  FOREIGN KEY (afastamento_id) REFERENCES public.afastamentos(id) ON DELETE SET NULL;

ALTER TABLE public.afastamentos 
  ADD CONSTRAINT afastamentos_evento_saude_fkey 
  FOREIGN KEY (evento_saude_id) REFERENCES public.eventos_saude(id) ON DELETE SET NULL;

ALTER TABLE public.afastamentos 
  ADD CONSTRAINT afastamentos_beneficio_inss_fkey 
  FOREIGN KEY (beneficio_inss_id) REFERENCES public.beneficios_inss(id) ON DELETE SET NULL;

ALTER TABLE public.afastamentos 
  ADD CONSTRAINT afastamentos_aso_retorno_fkey 
  FOREIGN KEY (aso_retorno_id) REFERENCES public.atestados(id) ON DELETE SET NULL;

ALTER TABLE public.beneficios_inss 
  ADD CONSTRAINT beneficios_inss_evento_saude_fkey 
  FOREIGN KEY (evento_saude_id) REFERENCES public.eventos_saude(id) ON DELETE SET NULL;

ALTER TABLE public.beneficios_inss 
  ADD CONSTRAINT beneficios_inss_afastamento_fkey 
  FOREIGN KEY (afastamento_id) REFERENCES public.afastamentos(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.atestados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afastamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos_saude ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beneficios_inss ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas_saude ENABLE ROW LEVEL SECURITY;

-- RLS Policies para Atestados (dados sensíveis - apenas managers+)
CREATE POLICY "Managers+ podem gerenciar atestados"
  ON public.atestados FOR ALL
  USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role));

-- RLS Policies para Afastamentos
CREATE POLICY "Managers+ podem gerenciar afastamentos"
  ON public.afastamentos FOR ALL
  USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role));

-- RLS Policies para Eventos de Saúde
CREATE POLICY "Managers+ podem gerenciar eventos de saúde"
  ON public.eventos_saude FOR ALL
  USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role));

-- RLS Policies para Benefícios INSS
CREATE POLICY "Managers+ podem gerenciar benefícios INSS"
  ON public.beneficios_inss FOR ALL
  USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role));

-- RLS Policies para Alertas
CREATE POLICY "Managers+ podem gerenciar alertas de saúde"
  ON public.alertas_saude FOR ALL
  USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role));

-- Função para gerar código do evento de saúde
CREATE OR REPLACE FUNCTION public.gerar_codigo_evento_saude()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    next_num INTEGER;
BEGIN
    SELECT COALESCE(MAX(CAST(SUBSTRING(codigo FROM 'EVS-(\d+)') AS INTEGER)), 0) + 1
    INTO next_num
    FROM public.eventos_saude
    WHERE tenant_id = NEW.tenant_id;
    
    NEW.codigo := 'EVS-' || LPAD(next_num::TEXT, 5, '0');
    RETURN NEW;
END;
$$;

-- Trigger para código automático
CREATE TRIGGER trigger_gerar_codigo_evento_saude
  BEFORE INSERT ON public.eventos_saude
  FOR EACH ROW
  EXECUTE FUNCTION public.gerar_codigo_evento_saude();

-- Triggers para updated_at
CREATE TRIGGER update_atestados_updated_at
  BEFORE UPDATE ON public.atestados
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_afastamentos_updated_at
  BEFORE UPDATE ON public.afastamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_eventos_saude_updated_at
  BEFORE UPDATE ON public.eventos_saude
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_beneficios_inss_updated_at
  BEFORE UPDATE ON public.beneficios_inss
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Função para calcular dias de afastamento e gerar alertas
CREATE OR REPLACE FUNCTION public.atualizar_afastamento_dias()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    total_dias INTEGER;
BEGIN
    -- Calcular total de dias
    IF NEW.data_fim IS NOT NULL THEN
        NEW.dias_totais := NEW.data_fim - NEW.data_inicio + 1;
    ELSE
        NEW.dias_totais := CURRENT_DATE - NEW.data_inicio + 1;
    END IF;
    
    -- Alertas 15 e 30 dias
    NEW.alerta_15_dias := NEW.dias_totais >= 13; -- Alerta 2 dias antes
    NEW.alerta_30_dias := NEW.dias_totais >= 28;
    
    -- ASO retorno pendente se >= 30 dias e não tem ASO vinculado
    IF NEW.dias_totais >= 30 AND NEW.aso_retorno_id IS NULL AND NEW.status != 'beneficio_inss' THEN
        NEW.aso_retorno_pendente := true;
    ELSE
        NEW.aso_retorno_pendente := false;
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_atualizar_afastamento_dias
  BEFORE INSERT OR UPDATE ON public.afastamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.atualizar_afastamento_dias();

-- Função para calcular estabilidade B91
CREATE OR REPLACE FUNCTION public.calcular_estabilidade_b91()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.especie = 'b91' THEN
        NEW.gera_estabilidade := true;
        IF NEW.data_alta IS NOT NULL THEN
            NEW.data_fim_estabilidade := NEW.data_alta + INTERVAL '12 months';
        END IF;
    ELSE
        NEW.gera_estabilidade := false;
        NEW.data_fim_estabilidade := NULL;
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_calcular_estabilidade_b91
  BEFORE INSERT OR UPDATE ON public.beneficios_inss
  FOR EACH ROW
  EXECUTE FUNCTION public.calcular_estabilidade_b91();

-- Bucket para armazenamento de atestados
INSERT INTO storage.buckets (id, name, public)
VALUES ('atestados', 'atestados', false)
ON CONFLICT (id) DO NOTHING;

-- Policies de storage
CREATE POLICY "Managers podem fazer upload de atestados"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'atestados' 
  AND has_minimum_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Managers podem ver atestados"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'atestados' 
  AND has_minimum_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Managers podem deletar atestados"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'atestados' 
  AND has_minimum_role(auth.uid(), 'manager'::app_role)
);