
-- =====================================================
-- MÓDULO FINANCEIRO DE PESSOAS — SCHEMA COMPLETO
-- =====================================================

-- 1. ENUM de tipos de vínculo
DO $$ BEGIN
  CREATE TYPE public.tipo_vinculo AS ENUM (
    'CLT_PRAZO_INDETERMINADO',
    'CLT_EXPERIENCIA',
    'CLT_INTERMITENTE',
    'CLT_TEMPO_PARCIAL',
    'APRENDIZ',
    'ESTAGIO',
    'TEMPORARIO_LEI6019',
    'PJ'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.classificacao_interna AS ENUM (
    'TRAINEE', 'PCD', 'TELETRABALHO', 'EFETIVO', 'OUTROS'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.rubrica_tipo AS ENUM ('PROVENTO', 'DESCONTO', 'INFORMATIVA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.rubrica_natureza AS ENUM ('REMUNERATORIA', 'INDENIZATORIA', 'OUTRA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.forma_calculo AS ENUM (
    'VALOR_FIXO', 'PERCENTUAL_SALARIO', 'PERCENTUAL_BASE_ESPECIFICA',
    'QUANTIDADE_X_VALOR', 'IMPORTADA_EXTERNA'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.rescisao_tipo AS ENUM (
    'PEDIDO_DEMISSAO', 'DISPENSA_SEM_JUSTA_CAUSA', 'DISPENSA_COM_JUSTA_CAUSA',
    'TERMINO_EXPERIENCIA', 'RESCISAO_INDIRETA', 'ACORDO_484A',
    'FALECIMENTO', 'TERMINO_TEMPORARIO', 'TERMINO_APRENDIZ', 'ENCERRAMENTO_ESTAGIO'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.rescisao_status AS ENUM (
    'em_calculo', 'em_conferencia', 'aprovada', 'paga', 'reaberta'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. TABELA DE RUBRICAS
CREATE TABLE IF NOT EXISTS public.folha_rubricas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  codigo_interno TEXT NOT NULL,
  descricao TEXT NOT NULL,
  tipo public.rubrica_tipo NOT NULL DEFAULT 'PROVENTO',
  natureza public.rubrica_natureza NOT NULL DEFAULT 'REMUNERATORIA',
  incide_inss BOOLEAN NOT NULL DEFAULT FALSE,
  incide_irrf BOOLEAN NOT NULL DEFAULT FALSE,
  incide_fgts BOOLEAN NOT NULL DEFAULT FALSE,
  incide_ferias BOOLEAN NOT NULL DEFAULT FALSE,
  incide_13 BOOLEAN NOT NULL DEFAULT FALSE,
  incide_rescisao BOOLEAN NOT NULL DEFAULT FALSE,
  forma_calculo public.forma_calculo NOT NULL DEFAULT 'VALOR_FIXO',
  prioridade_calculo INT NOT NULL DEFAULT 100,
  permitido_para_vinculos TEXT[] DEFAULT '{}',
  classificacao_esocial TEXT,
  natureza_contabil TEXT,
  protegida BOOLEAN NOT NULL DEFAULT FALSE,
  ativa BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, codigo_interno)
);

ALTER TABLE public.folha_rubricas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "folha_rubricas_tenant" ON public.folha_rubricas
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- 3. TABELAS LEGAIS — INSS
CREATE TABLE IF NOT EXISTS public.folha_tabelas_inss (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  vigencia_inicio DATE NOT NULL,
  vigencia_fim DATE,
  faixas JSONB NOT NULL DEFAULT '[]',
  teto NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.folha_tabelas_inss ENABLE ROW LEVEL SECURITY;
CREATE POLICY "folha_tabelas_inss_tenant" ON public.folha_tabelas_inss
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- 4. TABELAS LEGAIS — IRRF
CREATE TABLE IF NOT EXISTS public.folha_tabelas_irrf (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  vigencia_inicio DATE NOT NULL,
  vigencia_fim DATE,
  faixas JSONB NOT NULL DEFAULT '[]',
  deducao_por_dependente NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.folha_tabelas_irrf ENABLE ROW LEVEL SECURITY;
CREATE POLICY "folha_tabelas_irrf_tenant" ON public.folha_tabelas_irrf
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- 5. MATRIZ DE ENCARGOS POR VÍNCULO
CREATE TABLE IF NOT EXISTS public.folha_vinculos_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tipo_vinculo TEXT NOT NULL,
  inss_empregado BOOLEAN NOT NULL DEFAULT TRUE,
  fgts BOOLEAN NOT NULL DEFAULT TRUE,
  aliquota_fgts NUMERIC(5,2) NOT NULL DEFAULT 8.00,
  multa_fgts_dispensa NUMERIC(5,2) NOT NULL DEFAULT 40.00,
  direito_13 BOOLEAN NOT NULL DEFAULT TRUE,
  direito_ferias BOOLEAN NOT NULL DEFAULT TRUE,
  direito_aviso_previo BOOLEAN NOT NULL DEFAULT TRUE,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, tipo_vinculo)
);

ALTER TABLE public.folha_vinculos_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "folha_vinculos_config_tenant" ON public.folha_vinculos_config
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- 6. LANÇAMENTOS DA FOLHA
CREATE TABLE IF NOT EXISTS public.folha_lancamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  periodo_id UUID NOT NULL REFERENCES public.folha_periodos(id) ON DELETE CASCADE,
  colaborador_id TEXT NOT NULL,
  colaborador_nome TEXT NOT NULL,
  colaborador_cpf TEXT,
  rubrica_id UUID REFERENCES public.folha_rubricas(id),
  rubrica_codigo TEXT,
  rubrica_descricao TEXT NOT NULL,
  tipo public.rubrica_tipo NOT NULL DEFAULT 'PROVENTO',
  referencia TEXT,
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  origem TEXT NOT NULL DEFAULT 'manual',
  lote_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.folha_lancamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "folha_lancamentos_tenant" ON public.folha_lancamentos
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- 7. MEMÓRIA DE CÁLCULO
CREATE TABLE IF NOT EXISTS public.folha_memoria_calculo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  periodo_id UUID NOT NULL REFERENCES public.folha_periodos(id) ON DELETE CASCADE,
  colaborador_id TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'folha_mensal',
  base_inss NUMERIC(12,2) DEFAULT 0,
  valor_inss NUMERIC(12,2) DEFAULT 0,
  base_irrf NUMERIC(12,2) DEFAULT 0,
  valor_irrf NUMERIC(12,2) DEFAULT 0,
  base_fgts NUMERIC(12,2) DEFAULT 0,
  valor_fgts NUMERIC(12,2) DEFAULT 0,
  teto_inss_aplicado NUMERIC(12,2) DEFAULT 0,
  tabela_inss_id UUID,
  tabela_irrf_id UUID,
  tipo_vinculo TEXT,
  dependentes_irrf INT DEFAULT 0,
  deducao_dependentes NUMERIC(12,2) DEFAULT 0,
  detalhes JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.folha_memoria_calculo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "folha_memoria_calculo_tenant" ON public.folha_memoria_calculo
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- 8. PROVISÕES
CREATE TABLE IF NOT EXISTS public.folha_provisoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  competencia TEXT NOT NULL,
  colaborador_id TEXT NOT NULL,
  colaborador_nome TEXT NOT NULL,
  tipo TEXT NOT NULL,
  valor_provisao NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_terco NUMERIC(12,2) DEFAULT 0,
  encargos_inss NUMERIC(12,2) DEFAULT 0,
  encargos_fgts NUMERIC(12,2) DEFAULT 0,
  valor_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  revertida BOOLEAN DEFAULT FALSE,
  data_reversao DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.folha_provisoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "folha_provisoes_tenant" ON public.folha_provisoes
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- 9. CÁLCULO DE FÉRIAS
CREATE TABLE IF NOT EXISTS public.folha_ferias_calculo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  colaborador_id TEXT NOT NULL,
  colaborador_nome TEXT NOT NULL,
  colaborador_cpf TEXT,
  tipo_vinculo TEXT,
  periodo_aquisitivo_inicio DATE NOT NULL,
  periodo_aquisitivo_fim DATE NOT NULL,
  data_inicio_gozo DATE NOT NULL,
  data_fim_gozo DATE NOT NULL,
  dias_gozo INT NOT NULL DEFAULT 30,
  dias_abono INT DEFAULT 0,
  remuneracao_base NUMERIC(12,2) NOT NULL DEFAULT 0,
  media_variaveis NUMERIC(12,2) DEFAULT 0,
  valor_ferias NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_terco NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_abono NUMERIC(12,2) DEFAULT 0,
  valor_abono_terco NUMERIC(12,2) DEFAULT 0,
  base_inss NUMERIC(12,2) DEFAULT 0,
  valor_inss NUMERIC(12,2) DEFAULT 0,
  base_irrf NUMERIC(12,2) DEFAULT 0,
  valor_irrf NUMERIC(12,2) DEFAULT 0,
  base_fgts NUMERIC(12,2) DEFAULT 0,
  valor_fgts NUMERIC(12,2) DEFAULT 0,
  total_bruto NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_descontos NUMERIC(12,2) DEFAULT 0,
  total_liquido NUMERIC(12,2) NOT NULL DEFAULT 0,
  em_dobro BOOLEAN DEFAULT FALSE,
  data_pagamento DATE,
  prazo_legal DATE,
  status TEXT NOT NULL DEFAULT 'calculado',
  memoria_calculo JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.folha_ferias_calculo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "folha_ferias_calculo_tenant" ON public.folha_ferias_calculo
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- 10. CÁLCULO DE 13º SALÁRIO
CREATE TABLE IF NOT EXISTS public.folha_13_calculo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ano INT NOT NULL,
  colaborador_id TEXT NOT NULL,
  colaborador_nome TEXT NOT NULL,
  colaborador_cpf TEXT,
  tipo_vinculo TEXT,
  parcela INT NOT NULL DEFAULT 1,
  meses_trabalhados INT NOT NULL DEFAULT 12,
  remuneracao_base NUMERIC(12,2) NOT NULL DEFAULT 0,
  media_variaveis NUMERIC(12,2) DEFAULT 0,
  valor_bruto NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_primeira_parcela NUMERIC(12,2) DEFAULT 0,
  base_inss NUMERIC(12,2) DEFAULT 0,
  valor_inss NUMERIC(12,2) DEFAULT 0,
  base_irrf NUMERIC(12,2) DEFAULT 0,
  valor_irrf NUMERIC(12,2) DEFAULT 0,
  base_fgts NUMERIC(12,2) DEFAULT 0,
  valor_fgts NUMERIC(12,2) DEFAULT 0,
  total_descontos NUMERIC(12,2) DEFAULT 0,
  total_liquido NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'calculado',
  memoria_calculo JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.folha_13_calculo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "folha_13_calculo_tenant" ON public.folha_13_calculo
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- 11. RESCISÕES
CREATE TABLE IF NOT EXISTS public.folha_rescisoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  colaborador_id TEXT NOT NULL,
  colaborador_nome TEXT NOT NULL,
  colaborador_cpf TEXT,
  admissao_id UUID,
  tipo_vinculo TEXT,
  tipo_rescisao public.rescisao_tipo NOT NULL,
  data_desligamento DATE NOT NULL,
  data_aviso DATE,
  aviso_tipo TEXT,
  dias_aviso INT DEFAULT 0,
  motivo TEXT,
  saldo_salario NUMERIC(12,2) DEFAULT 0,
  dias_saldo INT DEFAULT 0,
  aviso_previo_valor NUMERIC(12,2) DEFAULT 0,
  ferias_vencidas NUMERIC(12,2) DEFAULT 0,
  ferias_proporcionais NUMERIC(12,2) DEFAULT 0,
  terco_ferias NUMERIC(12,2) DEFAULT 0,
  decimo_terceiro_proporcional NUMERIC(12,2) DEFAULT 0,
  media_variaveis NUMERIC(12,2) DEFAULT 0,
  indenizacao_art479 NUMERIC(12,2) DEFAULT 0,
  base_inss NUMERIC(12,2) DEFAULT 0,
  valor_inss NUMERIC(12,2) DEFAULT 0,
  base_irrf NUMERIC(12,2) DEFAULT 0,
  valor_irrf NUMERIC(12,2) DEFAULT 0,
  base_fgts NUMERIC(12,2) DEFAULT 0,
  valor_fgts NUMERIC(12,2) DEFAULT 0,
  multa_fgts NUMERIC(12,2) DEFAULT 0,
  aliquota_multa_fgts NUMERIC(5,2) DEFAULT 40,
  outros_descontos NUMERIC(12,2) DEFAULT 0,
  descricao_outros_descontos TEXT,
  total_bruto NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_descontos NUMERIC(12,2) DEFAULT 0,
  total_liquido NUMERIC(12,2) NOT NULL DEFAULT 0,
  status public.rescisao_status NOT NULL DEFAULT 'em_calculo',
  data_pagamento DATE,
  prazo_legal DATE,
  memoria_calculo JSONB DEFAULT '{}',
  aprovado_por TEXT,
  aprovado_por_nome TEXT,
  aprovado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.folha_rescisoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "folha_rescisoes_tenant" ON public.folha_rescisoes
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- 12. LANÇAMENTOS EM LOTE
CREATE TABLE IF NOT EXISTS public.folha_lotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  periodo_id UUID REFERENCES public.folha_periodos(id),
  descricao TEXT NOT NULL,
  rubrica_id UUID REFERENCES public.folha_rubricas(id),
  tipo_aplicacao TEXT NOT NULL DEFAULT 'valor_fixo',
  valor NUMERIC(12,2) DEFAULT 0,
  percentual NUMERIC(8,4) DEFAULT 0,
  filtros JSONB DEFAULT '{}',
  vigencia_tipo TEXT DEFAULT 'competencia_atual',
  vigencia_inicio TEXT,
  vigencia_fim TEXT,
  total_colaboradores INT DEFAULT 0,
  total_valor NUMERIC(14,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente',
  criado_por TEXT,
  criado_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.folha_lotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "folha_lotes_tenant" ON public.folha_lotes
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- 13. HISTÓRICO/AUDITORIA DA FOLHA
CREATE TABLE IF NOT EXISTS public.folha_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  periodo_id UUID REFERENCES public.folha_periodos(id),
  acao TEXT NOT NULL,
  entidade TEXT,
  entidade_id UUID,
  descricao TEXT,
  dados_anteriores JSONB,
  dados_novos JSONB,
  usuario_id TEXT,
  usuario_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.folha_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "folha_historico_tenant" ON public.folha_historico
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- 14. Adicionar campos à tabela admissoes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'admissoes' AND column_name = 'tipo_vinculo'
  ) THEN
    ALTER TABLE public.admissoes ADD COLUMN tipo_vinculo TEXT DEFAULT 'CLT_PRAZO_INDETERMINADO';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'admissoes' AND column_name = 'classificacao_interna'
  ) THEN
    ALTER TABLE public.admissoes ADD COLUMN classificacao_interna TEXT DEFAULT 'EFETIVO';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'admissoes' AND column_name = 'dependentes_irrf'
  ) THEN
    ALTER TABLE public.admissoes ADD COLUMN dependentes_irrf INT DEFAULT 0;
  END IF;
END $$;

-- 15. Adicionar empresa_id em folha_periodos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'folha_periodos' AND column_name = 'empresa_id'
  ) THEN
    ALTER TABLE public.folha_periodos ADD COLUMN empresa_id UUID REFERENCES public.empresa_cadastro(id);
  END IF;
END $$;

-- 16. TRIGGERS de updated_at
CREATE OR REPLACE TRIGGER folha_rubricas_updated_at BEFORE UPDATE ON public.folha_rubricas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER folha_ferias_calculo_updated_at BEFORE UPDATE ON public.folha_ferias_calculo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER folha_13_calculo_updated_at BEFORE UPDATE ON public.folha_13_calculo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER folha_rescisoes_updated_at BEFORE UPDATE ON public.folha_rescisoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 17. Índices
CREATE INDEX IF NOT EXISTS idx_folha_rubricas_tenant ON public.folha_rubricas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_folha_lancamentos_periodo ON public.folha_lancamentos(periodo_id);
CREATE INDEX IF NOT EXISTS idx_folha_lancamentos_colaborador ON public.folha_lancamentos(tenant_id, colaborador_id);
CREATE INDEX IF NOT EXISTS idx_folha_provisoes_competencia ON public.folha_provisoes(tenant_id, competencia);
CREATE INDEX IF NOT EXISTS idx_folha_rescisoes_tenant ON public.folha_rescisoes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_folha_ferias_calculo_tenant ON public.folha_ferias_calculo(tenant_id);
CREATE INDEX IF NOT EXISTS idx_folha_13_calculo_tenant ON public.folha_13_calculo(tenant_id, ano);
CREATE INDEX IF NOT EXISTS idx_folha_memoria_calculo_periodo ON public.folha_memoria_calculo(periodo_id, colaborador_id);
