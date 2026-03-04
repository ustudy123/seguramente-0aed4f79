
-- ==============================================
-- ESCALAS DE TRABALHO
-- ==============================================
CREATE TABLE public.ponto_escalas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES public.empresa_cadastro(id),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'personalizada', -- 5x2, 6x1, 12x36, personalizada
  jornada_diaria_minutos INT NOT NULL DEFAULT 480,
  jornada_semanal_minutos INT NOT NULL DEFAULT 2640,
  intervalo_intrajornada_minutos INT NOT NULL DEFAULT 60,
  tolerancia_minutos INT NOT NULL DEFAULT 5,
  tolerancia_diaria_minutos INT NOT NULL DEFAULT 10,
  hora_entrada_padrao TIME DEFAULT '08:00',
  hora_saida_padrao TIME DEFAULT '17:00',
  sabado_util BOOLEAN DEFAULT false,
  domingo_util BOOLEAN DEFAULT false,
  adicional_noturno_inicio TIME DEFAULT '22:00',
  adicional_noturno_fim TIME DEFAULT '05:00',
  percentual_hora_extra_50 NUMERIC(5,2) DEFAULT 50.00,
  percentual_hora_extra_100 NUMERIC(5,2) DEFAULT 100.00,
  percentual_adicional_noturno NUMERIC(5,2) DEFAULT 20.00,
  usa_hora_ficta_noturna BOOLEAN DEFAULT true,
  ativa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ponto_escalas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ponto_escalas_tenant" ON public.ponto_escalas FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE TRIGGER update_ponto_escalas_updated_at BEFORE UPDATE ON public.ponto_escalas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Atribuição de escala a colaborador
CREATE TABLE public.ponto_escala_atribuicoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  escala_id UUID NOT NULL REFERENCES public.ponto_escalas(id) ON DELETE CASCADE,
  colaborador_id TEXT NOT NULL,
  colaborador_nome TEXT NOT NULL,
  colaborador_cpf TEXT,
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim DATE,
  ativa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ponto_escala_atribuicoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ponto_escala_atrib_tenant" ON public.ponto_escala_atribuicoes FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- ==============================================
-- BANCO DE HORAS
-- ==============================================
CREATE TABLE public.ponto_banco_horas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES public.empresa_cadastro(id),
  colaborador_id TEXT NOT NULL,
  colaborador_nome TEXT NOT NULL,
  colaborador_cpf TEXT,
  tipo TEXT NOT NULL DEFAULT 'mensal', -- mensal, semestral, anual
  competencia TEXT NOT NULL, -- YYYY-MM
  saldo_anterior_minutos INT DEFAULT 0,
  creditos_minutos INT DEFAULT 0,
  debitos_minutos INT DEFAULT 0,
  compensados_minutos INT DEFAULT 0,
  saldo_atual_minutos INT DEFAULT 0,
  convertido_extras BOOLEAN DEFAULT false,
  data_conversao DATE,
  prazo_compensacao DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, colaborador_cpf, competencia)
);

ALTER TABLE public.ponto_banco_horas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ponto_banco_horas_tenant" ON public.ponto_banco_horas FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE TRIGGER update_ponto_banco_horas_updated_at BEFORE UPDATE ON public.ponto_banco_horas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Movimentações do banco de horas
CREATE TABLE public.ponto_banco_horas_movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  banco_horas_id UUID NOT NULL REFERENCES public.ponto_banco_horas(id) ON DELETE CASCADE,
  colaborador_cpf TEXT NOT NULL,
  data_referencia DATE NOT NULL,
  tipo TEXT NOT NULL, -- credito, debito, compensacao, conversao
  minutos INT NOT NULL,
  descricao TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ponto_banco_horas_movimentacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ponto_bh_mov_tenant" ON public.ponto_banco_horas_movimentacoes FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- ==============================================
-- FECHAMENTO DE PERÍODO
-- ==============================================
CREATE TABLE public.ponto_fechamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES public.empresa_cadastro(id),
  competencia TEXT NOT NULL, -- YYYY-MM
  data_fechamento TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'aberto', -- aberto, em_revisao, fechado
  fechado_por TEXT,
  fechado_por_nome TEXT,
  total_colaboradores INT DEFAULT 0,
  total_horas_normais_minutos INT DEFAULT 0,
  total_horas_extras_minutos INT DEFAULT 0,
  total_adicional_noturno_minutos INT DEFAULT 0,
  total_faltas INT DEFAULT 0,
  total_atrasos INT DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, empresa_id, competencia)
);

ALTER TABLE public.ponto_fechamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ponto_fechamentos_tenant" ON public.ponto_fechamentos FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE TRIGGER update_ponto_fechamentos_updated_at BEFORE UPDATE ON public.ponto_fechamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==============================================
-- ESPELHO DE PONTO
-- ==============================================
CREATE TABLE public.ponto_espelhos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES public.empresa_cadastro(id),
  fechamento_id UUID REFERENCES public.ponto_fechamentos(id),
  colaborador_id TEXT NOT NULL,
  colaborador_nome TEXT NOT NULL,
  colaborador_cpf TEXT NOT NULL,
  competencia TEXT NOT NULL, -- YYYY-MM
  total_horas_normais_minutos INT DEFAULT 0,
  total_horas_extras_50_minutos INT DEFAULT 0,
  total_horas_extras_100_minutos INT DEFAULT 0,
  total_adicional_noturno_minutos INT DEFAULT 0,
  total_faltas INT DEFAULT 0,
  total_atrasos_minutos INT DEFAULT 0,
  total_dsr INT DEFAULT 0,
  banco_horas_saldo_minutos INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'gerado', -- gerado, enviado, confirmado, ressalva
  ressalva_texto TEXT,
  data_confirmacao TIMESTAMPTZ,
  confirmado_por TEXT,
  assinatura_hash TEXT,
  arquivo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, colaborador_cpf, competencia)
);

ALTER TABLE public.ponto_espelhos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ponto_espelhos_tenant" ON public.ponto_espelhos FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE TRIGGER update_ponto_espelhos_updated_at BEFORE UPDATE ON public.ponto_espelhos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==============================================
-- COMPROVANTE DE MARCAÇÃO
-- ==============================================
ALTER TABLE public.ponto_marcacoes ADD COLUMN IF NOT EXISTS comprovante_gerado BOOLEAN DEFAULT true;

-- ==============================================
-- ALERTAS DE PONTO
-- ==============================================
CREATE TABLE public.ponto_alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES public.empresa_cadastro(id),
  colaborador_id TEXT,
  colaborador_nome TEXT,
  colaborador_cpf TEXT,
  tipo TEXT NOT NULL, -- excesso_jornada, intervalo_suprimido, interjornada_insuficiente, banco_vencendo, falta_marcacao, horas_extras_recorrentes
  severidade TEXT NOT NULL DEFAULT 'media', -- baixa, media, alta, critica
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_referencia DATE,
  resolvido BOOLEAN DEFAULT false,
  resolvido_em TIMESTAMPTZ,
  resolvido_por TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ponto_alertas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ponto_alertas_tenant" ON public.ponto_alertas FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- Adicionar campos de cálculo avançado na ponto_diario
ALTER TABLE public.ponto_diario ADD COLUMN IF NOT EXISTS horas_extras_50_minutos INT DEFAULT 0;
ALTER TABLE public.ponto_diario ADD COLUMN IF NOT EXISTS horas_extras_100_minutos INT DEFAULT 0;
ALTER TABLE public.ponto_diario ADD COLUMN IF NOT EXISTS adicional_noturno_minutos INT DEFAULT 0;
ALTER TABLE public.ponto_diario ADD COLUMN IF NOT EXISTS atraso_minutos INT DEFAULT 0;
ALTER TABLE public.ponto_diario ADD COLUMN IF NOT EXISTS intervalo_intrajornada_minutos INT DEFAULT 0;
ALTER TABLE public.ponto_diario ADD COLUMN IF NOT EXISTS tolerancia_aplicada BOOLEAN DEFAULT false;
ALTER TABLE public.ponto_diario ADD COLUMN IF NOT EXISTS escala_id UUID REFERENCES public.ponto_escalas(id);
