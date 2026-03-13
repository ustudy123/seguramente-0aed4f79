
-- Add SST condition fields to cargos table
ALTER TABLE public.cargos
  ADD COLUMN IF NOT EXISTS insalubridade boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS insalubridade_grau text, -- minimo, medio, maximo
  ADD COLUMN IF NOT EXISTS insalubridade_agente_nocivo text,
  ADD COLUMN IF NOT EXISTS periculosidade boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS periculosidade_tipo text, -- inflamaveis, eletricidade, explosivos, outros
  ADD COLUMN IF NOT EXISTS aposentadoria_especial boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS aposentadoria_especial_anos integer; -- 15, 20, 25

-- Create table for per-collaborator special conditions with history
CREATE TABLE IF NOT EXISTS public.colaborador_condicoes_especiais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  colaborador_id text NOT NULL, -- CPF or admissao_id
  colaborador_nome text NOT NULL,
  cargo_id uuid REFERENCES public.cargos(id),
  
  -- Insalubridade
  insalubridade boolean NOT NULL DEFAULT false,
  insalubridade_grau text, -- minimo (10%), medio (20%), maximo (40%)
  insalubridade_agente_nocivo text,
  insalubridade_base_calculo text DEFAULT 'salario_minimo', -- salario_minimo, piso_convencional
  insalubridade_valor_calculado numeric(12,2) DEFAULT 0,
  
  -- Periculosidade
  periculosidade boolean NOT NULL DEFAULT false,
  periculosidade_tipo text,
  periculosidade_valor_calculado numeric(12,2) DEFAULT 0,
  
  -- Prevalência (art. 193 §2º CLT)
  adicional_aplicado text, -- insalubridade, periculosidade, nenhum
  adicional_valor_aplicado numeric(12,2) DEFAULT 0,
  fundamentacao_legal text,
  
  -- Aposentadoria Especial
  aposentadoria_especial boolean NOT NULL DEFAULT false,
  aposentadoria_especial_anos integer,
  data_inicio_exposicao date,
  
  -- Controle
  origem text DEFAULT 'manual', -- manual, importacao_sst, heranca_cargo
  documento_referencia text, -- referência ao documento SST de origem
  ativo boolean NOT NULL DEFAULT true,
  data_inicio date NOT NULL DEFAULT CURRENT_DATE,
  data_fim date,
  justificativa_alteracao text,
  alterado_por text,
  alterado_por_nome text,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.colaborador_condicoes_especiais ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Tenant isolation" ON public.colaborador_condicoes_especiais
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- Trigger for updated_at
CREATE TRIGGER update_colaborador_condicoes_especiais_updated_at
  BEFORE UPDATE ON public.colaborador_condicoes_especiais
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- History table for audit trail (immutable log)
CREATE TABLE IF NOT EXISTS public.condicoes_especiais_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  condicao_id uuid REFERENCES public.colaborador_condicoes_especiais(id),
  colaborador_id text NOT NULL,
  colaborador_nome text NOT NULL,
  acao text NOT NULL, -- criacao, alteracao, desativacao
  dados_anteriores jsonb,
  dados_novos jsonb,
  justificativa text,
  usuario_id text,
  usuario_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.condicoes_especiais_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.condicoes_especiais_historico
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());
