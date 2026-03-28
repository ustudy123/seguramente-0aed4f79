-- Tabela de Convenções Coletivas de Trabalho
CREATE TABLE IF NOT EXISTS public.folha_cct (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sindicato TEXT NOT NULL,
  numero_registro TEXT,
  vigencia_inicio DATE NOT NULL,
  vigencia_fim DATE NOT NULL,
  piso_salarial NUMERIC(12,2),
  adicional_he_50 NUMERIC(5,2) DEFAULT 50,
  adicional_he_100 NUMERIC(5,2) DEFAULT 100,
  adicional_noturno NUMERIC(5,2) DEFAULT 20,
  beneficios_obrigatorios JSONB DEFAULT '[]',
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.folha_cct ENABLE ROW LEVEL SECURITY;

CREATE POLICY "folha_cct_tenant_select" ON public.folha_cct
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tp.tenant_id FROM profiles tp WHERE tp.user_id = auth.uid()));

CREATE POLICY "folha_cct_tenant_insert" ON public.folha_cct
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tp.tenant_id FROM profiles tp WHERE tp.user_id = auth.uid()));

CREATE POLICY "folha_cct_tenant_update" ON public.folha_cct
  FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT tp.tenant_id FROM profiles tp WHERE tp.user_id = auth.uid()));

CREATE POLICY "folha_cct_tenant_delete" ON public.folha_cct
  FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT tp.tenant_id FROM profiles tp WHERE tp.user_id = auth.uid()));

-- Tabela de Alertas de Prazo da Folha
CREATE TABLE IF NOT EXISTS public.folha_alertas_prazo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  competencia TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('fechamento_folha', 'pagamento', 'fgts', 'esocial_s1200', 'esocial_s1210', 'dctfweb', 'inss_patronal')),
  descricao TEXT NOT NULL,
  data_limite DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'concluido', 'atrasado')),
  concluido_em TIMESTAMPTZ,
  concluido_por TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.folha_alertas_prazo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "folha_alertas_tenant_select" ON public.folha_alertas_prazo
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tp.tenant_id FROM profiles tp WHERE tp.user_id = auth.uid()));

CREATE POLICY "folha_alertas_tenant_insert" ON public.folha_alertas_prazo
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tp.tenant_id FROM profiles tp WHERE tp.user_id = auth.uid()));

CREATE POLICY "folha_alertas_tenant_update" ON public.folha_alertas_prazo
  FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT tp.tenant_id FROM profiles tp WHERE tp.user_id = auth.uid()));