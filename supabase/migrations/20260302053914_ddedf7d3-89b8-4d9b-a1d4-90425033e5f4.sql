
-- Tabela: Importações de jornada (tracking de uploads)
CREATE TABLE public.jornada_importacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  nome_arquivo TEXT NOT NULL,
  tipo_arquivo TEXT NOT NULL DEFAULT 'csv', -- csv, xlsx, pdf
  total_registros INTEGER DEFAULT 0,
  registros_importados INTEGER DEFAULT 0,
  registros_erros INTEGER DEFAULT 0,
  periodo_inicio DATE,
  periodo_fim DATE,
  status TEXT NOT NULL DEFAULT 'processando', -- processando, concluido, erro, parcial
  erros JSONB DEFAULT '[]'::jsonb,
  mapeamento_colunas JSONB DEFAULT '{}'::jsonb,
  importado_por TEXT,
  importado_por_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela: Parâmetros de conformidade legal
CREATE TABLE public.jornada_parametros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  nome TEXT NOT NULL DEFAULT 'Padrão CLT',
  jornada_diaria_max NUMERIC NOT NULL DEFAULT 8,
  jornada_semanal_max NUMERIC NOT NULL DEFAULT 44,
  horas_extras_diaria_max NUMERIC NOT NULL DEFAULT 2,
  intervalo_intrajornada_min NUMERIC NOT NULL DEFAULT 60, -- minutos
  descanso_interjornada_min NUMERIC NOT NULL DEFAULT 11, -- horas
  descanso_semanal_min NUMERIC NOT NULL DEFAULT 24, -- horas
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, nome)
);

-- Tabela: Análises de jornada (resultados calculados)
CREATE TABLE public.jornada_analises (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  colaborador_cpf TEXT NOT NULL,
  colaborador_nome TEXT NOT NULL,
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  -- Métricas calculadas
  dias_trabalhados INTEGER DEFAULT 0,
  total_horas_trabalhadas NUMERIC DEFAULT 0,
  total_horas_extras NUMERIC DEFAULT 0,
  media_diaria_horas NUMERIC DEFAULT 0,
  media_semanal_horas NUMERIC DEFAULT 0,
  total_atrasos INTEGER DEFAULT 0,
  total_ajustes_manuais INTEGER DEFAULT 0,
  violacoes_intervalo INTEGER DEFAULT 0,
  violacoes_interjornada INTEGER DEFAULT 0,
  violacoes_jornada_diaria INTEGER DEFAULT 0,
  violacoes_horas_extras INTEGER DEFAULT 0,
  -- Classificação
  nivel_risco TEXT NOT NULL DEFAULT 'baixo', -- baixo, moderado, alto
  score_risco NUMERIC DEFAULT 0,
  -- Conformidade
  status_conformidade TEXT NOT NULL DEFAULT 'conforme', -- conforme, atencao, nao_conforme
  detalhes_conformidade JSONB DEFAULT '{}'::jsonb,
  -- Departamento/cargo para análise coletiva
  departamento TEXT,
  cargo TEXT,
  setor TEXT,
  unidade TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela: Alertas de jornada
CREATE TABLE public.jornada_alertas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  analise_id UUID REFERENCES public.jornada_analises(id),
  colaborador_cpf TEXT,
  colaborador_nome TEXT,
  tipo TEXT NOT NULL, -- excesso_horas_extras, falta_intervalo, descanso_insuficiente, ajustes_excessivos, atraso_recorrente, jornada_excessiva
  severidade TEXT NOT NULL DEFAULT 'media', -- baixa, media, alta, critica
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_referencia DATE,
  lido BOOLEAN DEFAULT false,
  resolvido BOOLEAN DEFAULT false,
  resolvido_em TIMESTAMPTZ,
  resolvido_por TEXT,
  acao_sugerida TEXT,
  departamento TEXT,
  setor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela: Documentos de apoio (PDFs)
CREATE TABLE public.jornada_documentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  nome TEXT NOT NULL,
  arquivo_url TEXT,
  arquivo_nome TEXT,
  arquivo_tamanho INTEGER,
  tipo TEXT NOT NULL DEFAULT 'evidencia', -- evidencia, relatorio, auditoria
  vinculo_tipo TEXT, -- empresa, unidade, setor, periodo
  vinculo_valor TEXT,
  periodo_inicio DATE,
  periodo_fim DATE,
  observacoes TEXT,
  enviado_por TEXT,
  enviado_por_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_jornada_importacoes_tenant ON public.jornada_importacoes(tenant_id);
CREATE INDEX idx_jornada_analises_tenant ON public.jornada_analises(tenant_id);
CREATE INDEX idx_jornada_analises_cpf ON public.jornada_analises(colaborador_cpf);
CREATE INDEX idx_jornada_analises_periodo ON public.jornada_analises(periodo_inicio, periodo_fim);
CREATE INDEX idx_jornada_alertas_tenant ON public.jornada_alertas(tenant_id);
CREATE INDEX idx_jornada_alertas_resolvido ON public.jornada_alertas(tenant_id, resolvido);
CREATE INDEX idx_jornada_documentos_tenant ON public.jornada_documentos(tenant_id);

-- Triggers updated_at
CREATE TRIGGER update_jornada_importacoes_updated_at BEFORE UPDATE ON public.jornada_importacoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_jornada_parametros_updated_at BEFORE UPDATE ON public.jornada_parametros FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_jornada_analises_updated_at BEFORE UPDATE ON public.jornada_analises FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.jornada_importacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jornada_parametros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jornada_analises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jornada_alertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jornada_documentos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Tenant isolation" ON public.jornada_importacoes FOR ALL USING (tenant_id = public.get_user_tenant_id()) WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant isolation" ON public.jornada_parametros FOR ALL USING (tenant_id = public.get_user_tenant_id()) WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant isolation" ON public.jornada_analises FOR ALL USING (tenant_id = public.get_user_tenant_id()) WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant isolation" ON public.jornada_alertas FOR ALL USING (tenant_id = public.get_user_tenant_id()) WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant isolation" ON public.jornada_documentos FOR ALL USING (tenant_id = public.get_user_tenant_id()) WITH CHECK (tenant_id = public.get_user_tenant_id());
