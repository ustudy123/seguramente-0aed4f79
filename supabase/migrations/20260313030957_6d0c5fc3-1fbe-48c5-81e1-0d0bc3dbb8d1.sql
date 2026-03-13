
CREATE TABLE public.empresa_experiencia_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresa_cadastro(id) ON DELETE CASCADE,
  
  -- Modelo de períodos
  modelo_periodos TEXT NOT NULL DEFAULT '2_periodos' CHECK (modelo_periodos IN ('1_periodo', '2_periodos')),
  duracao_primeiro_periodo INT NOT NULL DEFAULT 45,
  duracao_segundo_periodo INT DEFAULT 45,
  
  -- Cláusula assecuratória
  clausula_assecuratoria_padrao BOOLEAN NOT NULL DEFAULT false,
  
  -- Política de antecedência para ação
  dias_antecedencia_acao INT NOT NULL DEFAULT 5,
  
  -- Alertas
  alerta_15_dias BOOLEAN NOT NULL DEFAULT true,
  alerta_7_dias BOOLEAN NOT NULL DEFAULT true,
  alerta_2_dias BOOLEAN NOT NULL DEFAULT true,
  
  -- Observações / política interna
  politica_interna TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(tenant_id, empresa_id)
);

ALTER TABLE public.empresa_experiencia_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.empresa_experiencia_config
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE TRIGGER update_empresa_experiencia_config_updated_at
  BEFORE UPDATE ON public.empresa_experiencia_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
