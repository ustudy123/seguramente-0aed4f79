-- Gap 3: Tabelas fiscais dinâmicas (INSS/IRRF) sem necessidade de deploy
CREATE TABLE IF NOT EXISTS public.tabelas_fiscais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('inss', 'irrf')),
  vigencia_inicio DATE NOT NULL,
  vigencia_fim DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  faixas JSONB NOT NULL DEFAULT '[]',
  teto NUMERIC(12,2),
  deducao_por_dependente NUMERIC(10,2),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, tipo, vigencia_inicio)
);

ALTER TABLE public.tabelas_fiscais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation tabelas_fiscais"
  ON public.tabelas_fiscais FOR ALL
  TO authenticated
  USING (tenant_id IN (SELECT id FROM tenants WHERE id = tenant_id))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE id = tenant_id));

-- Gap 2: Alerta prazo rescisão - add columns
ALTER TABLE public.folha_alertas_prazo 
  ADD COLUMN IF NOT EXISTS colaborador_id TEXT,
  ADD COLUMN IF NOT EXISTS colaborador_nome TEXT,
  ADD COLUMN IF NOT EXISTS valor_referencia NUMERIC(12,2);

ALTER TABLE public.folha_alertas_prazo DROP CONSTRAINT IF EXISTS folha_alertas_prazo_tipo_check;
ALTER TABLE public.folha_alertas_prazo ADD CONSTRAINT folha_alertas_prazo_tipo_check 
  CHECK (tipo IN ('fechamento_folha', 'pagamento', 'fgts', 'esocial_s1200', 'esocial_s1210', 'dctfweb', 'inss_patronal', 'rescisao_pagamento'));