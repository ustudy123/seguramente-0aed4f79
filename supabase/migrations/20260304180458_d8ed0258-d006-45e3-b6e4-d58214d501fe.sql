
-- =============================================
-- 1. CCT (Convenção Coletiva de Trabalho) Config
-- =============================================
CREATE TABLE IF NOT EXISTS public.ponto_cct_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  nome TEXT NOT NULL,
  sindicato TEXT,
  categoria_profissional TEXT,
  empresa_id UUID REFERENCES public.empresa_cadastro(id),
  vigencia_inicio DATE,
  vigencia_fim DATE,
  -- Parâmetros de jornada
  jornada_semanal_horas NUMERIC DEFAULT 44,
  jornada_diaria_horas NUMERIC DEFAULT 8,
  -- Horas extras
  he_percentual_dia_util NUMERIC DEFAULT 50,
  he_percentual_domingos NUMERIC DEFAULT 100,
  he_percentual_feriados NUMERIC DEFAULT 100,
  he_limite_diario_min INT DEFAULT 120,
  -- Adicional noturno
  adicional_noturno_percentual NUMERIC DEFAULT 20,
  hora_noturna_inicio TIME DEFAULT '22:00',
  hora_noturna_fim TIME DEFAULT '05:00',
  usa_hora_ficta BOOLEAN DEFAULT TRUE,
  -- Intervalo
  intervalo_minimo_min INT DEFAULT 60,
  intervalo_maximo_min INT DEFAULT 120,
  -- Banco de horas
  banco_horas_permitido BOOLEAN DEFAULT TRUE,
  banco_horas_prazo_compensacao_meses INT DEFAULT 6,
  -- DSR
  dsr_proporcional BOOLEAN DEFAULT TRUE,
  -- Outros
  observacoes TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ponto_cct_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for ponto_cct_config" ON public.ponto_cct_config
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- =============================================
-- 2. REP-C Importações (relógios físicos)
-- =============================================
CREATE TABLE IF NOT EXISTS public.ponto_repc_importacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  empresa_id UUID REFERENCES public.empresa_cadastro(id),
  arquivo_nome TEXT NOT NULL,
  arquivo_url TEXT,
  tipo_equipamento TEXT DEFAULT 'REP-C',
  fabricante TEXT,
  modelo TEXT,
  numero_serie TEXT,
  total_registros INT DEFAULT 0,
  registros_importados INT DEFAULT 0,
  registros_rejeitados INT DEFAULT 0,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','processando','concluido','erro')),
  erros JSONB,
  importado_por TEXT,
  importado_por_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ponto_repc_importacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for ponto_repc_importacoes" ON public.ponto_repc_importacoes
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- =============================================
-- 3. Exportação Folha de Pagamento
-- =============================================
CREATE TABLE IF NOT EXISTS public.ponto_exportacoes_folha (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  empresa_id UUID REFERENCES public.empresa_cadastro(id),
  competencia TEXT NOT NULL,
  formato TEXT DEFAULT 'csv' CHECK (formato IN ('csv','txt','xlsx','xml')),
  sistema_destino TEXT,
  total_colaboradores INT DEFAULT 0,
  arquivo_nome TEXT,
  arquivo_url TEXT,
  status TEXT DEFAULT 'gerado' CHECK (status IN ('gerado','enviado','processado','erro')),
  gerado_por TEXT,
  gerado_por_id UUID,
  dados_exportados JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ponto_exportacoes_folha ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for ponto_exportacoes_folha" ON public.ponto_exportacoes_folha
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- Updated_at triggers
CREATE TRIGGER update_ponto_cct_config_updated_at BEFORE UPDATE ON public.ponto_cct_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ponto_repc_importacoes_updated_at BEFORE UPDATE ON public.ponto_repc_importacoes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
