
-- Contratos de Experiência
CREATE TABLE IF NOT EXISTS public.contratos_experiencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  empresa_id uuid REFERENCES public.empresa_cadastro(id),
  admissao_id uuid REFERENCES public.admissoes(id),
  
  -- Colaborador
  colaborador_nome text NOT NULL,
  colaborador_cpf text NOT NULL,
  cargo text,
  departamento text,
  filial text,
  gestor_imediato text,
  salario numeric(12,2),
  jornada_trabalho text,
  
  -- Período de experiência
  data_admissao date NOT NULL,
  duracao_primeiro_periodo integer NOT NULL DEFAULT 45, -- dias
  data_fim_primeiro_periodo date NOT NULL,
  
  -- Prorrogação
  prorrogado boolean NOT NULL DEFAULT false,
  duracao_prorrogacao integer, -- dias
  data_inicio_prorrogacao date,
  data_fim_prorrogacao date,
  data_prorrogacao_registro timestamptz,
  prorrogado_por text,
  prorrogado_por_nome text,
  
  -- Cláusula assecuratória
  clausula_assecuratoria boolean NOT NULL DEFAULT false,
  
  -- Status
  status text NOT NULL DEFAULT 'em_experiencia',
  -- em_experiencia, em_experiencia_2_periodo, efetivado, encerrado, vencido_automatico
  
  -- Efetivação
  data_efetivacao date,
  efetivado_por text,
  efetivado_por_nome text,
  
  -- Encerramento
  data_encerramento date,
  tipo_encerramento text, -- termino_normal, rescisao_antecipada_empregador, rescisao_antecipada_empregado
  motivo_encerramento text,
  encerrado_por text,
  encerrado_por_nome text,
  
  -- Alertas
  alerta_15_dias_enviado boolean NOT NULL DEFAULT false,
  alerta_7_dias_enviado boolean NOT NULL DEFAULT false,
  alerta_2_dias_enviado boolean NOT NULL DEFAULT false,
  
  -- Documentos gerados
  contrato_documento_id text,
  termo_prorrogacao_documento_id text,
  termo_efetivacao_documento_id text,
  termo_rescisao_documento_id text,
  
  -- Observações
  observacoes text,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.contratos_experiencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.contratos_experiencia
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- Updated_at trigger
CREATE TRIGGER update_contratos_experiencia_updated_at
  BEFORE UPDATE ON public.contratos_experiencia
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Histórico de ações
CREATE TABLE IF NOT EXISTS public.contratos_experiencia_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  contrato_id uuid NOT NULL REFERENCES public.contratos_experiencia(id) ON DELETE CASCADE,
  acao text NOT NULL, -- criacao, prorrogacao, efetivacao, encerramento, alerta
  descricao text,
  dados jsonb,
  usuario_id text,
  usuario_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contratos_experiencia_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.contratos_experiencia_historico
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());
