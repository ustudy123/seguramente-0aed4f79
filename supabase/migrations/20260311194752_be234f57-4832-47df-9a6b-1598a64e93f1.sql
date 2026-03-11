
-- =============================================
-- MÓDULO DE FÉRIAS COMPLETO — Persistência Supabase
-- =============================================

-- 1. Tabela principal de solicitações de férias
CREATE TABLE public.ferias_solicitacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  colaborador_id UUID REFERENCES auth.users(id),
  colaborador_nome TEXT NOT NULL,
  colaborador_cpf TEXT,
  departamento TEXT,
  cargo TEXT,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  dias_solicitados INT NOT NULL,
  saldo_dias INT NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','recusado','cancelado','em_gozo','concluido')),
  abono_pecuniario BOOLEAN DEFAULT FALSE,
  dias_abono INT DEFAULT 0,
  salario_base NUMERIC(12,2) DEFAULT 0,
  -- Período aquisitivo vinculado
  periodo_aquisitivo_inicio DATE,
  periodo_aquisitivo_fim DATE,
  -- Aprovação
  aprovado_por UUID,
  aprovado_por_nome TEXT,
  data_aprovacao TIMESTAMPTZ,
  motivo_recusa TEXT,
  -- Financeiro
  valor_ferias NUMERIC(12,2),
  valor_terco NUMERIC(12,2),
  valor_abono NUMERIC(12,2),
  valor_total_bruto NUMERIC(12,2),
  registro_financeiro_id UUID,
  -- Documentos
  aviso_gerado BOOLEAN DEFAULT FALSE,
  recibo_gerado BOOLEAN DEFAULT FALSE,
  assinatura_link_id UUID,
  assinatura_status TEXT DEFAULT 'pendente',
  -- INR™ no momento da solicitação
  inr_score_momento INT,
  inr_nivel_momento TEXT,
  -- Ação preventiva
  acao_preventiva BOOLEAN DEFAULT FALSE,
  acao_preventiva_id UUID,
  -- Cultura
  mensagem_pre_ferias TEXT,
  mensagem_pre_ferias_enviada BOOLEAN DEFAULT FALSE,
  checkin_retorno_enviado BOOLEAN DEFAULT FALSE,
  checkin_retorno_respondido BOOLEAN DEFAULT FALSE,
  checkin_retorno_respostas JSONB,
  -- Governança
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_ferias_sol_tenant ON public.ferias_solicitacoes(tenant_id);
CREATE INDEX idx_ferias_sol_status ON public.ferias_solicitacoes(tenant_id, status);
CREATE INDEX idx_ferias_sol_colab ON public.ferias_solicitacoes(tenant_id, colaborador_cpf);
CREATE INDEX idx_ferias_sol_periodo ON public.ferias_solicitacoes(tenant_id, data_inicio, data_fim);

-- Updated_at trigger
CREATE TRIGGER ferias_solicitacoes_updated_at
  BEFORE UPDATE ON public.ferias_solicitacoes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE public.ferias_solicitacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ferias_sol_tenant_select" ON public.ferias_solicitacoes
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "ferias_sol_tenant_insert" ON public.ferias_solicitacoes
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "ferias_sol_tenant_update" ON public.ferias_solicitacoes
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "ferias_sol_tenant_delete" ON public.ferias_solicitacoes
  FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

-- 2. Tabela de histórico/auditoria de férias
CREATE TABLE public.ferias_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  solicitacao_id UUID NOT NULL REFERENCES public.ferias_solicitacoes(id) ON DELETE CASCADE,
  acao TEXT NOT NULL,
  descricao TEXT,
  usuario_id UUID,
  usuario_nome TEXT,
  dados_anteriores JSONB,
  dados_novos JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ferias_hist_sol ON public.ferias_historico(solicitacao_id);

ALTER TABLE public.ferias_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ferias_hist_tenant_select" ON public.ferias_historico
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "ferias_hist_tenant_insert" ON public.ferias_historico
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- 3. Trigger para registrar histórico automaticamente
CREATE OR REPLACE FUNCTION public.registrar_historico_ferias()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.ferias_historico (tenant_id, solicitacao_id, acao, descricao, usuario_id)
    VALUES (NEW.tenant_id, NEW.id, 'criacao', 'Solicitação de férias criada', auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    -- Status change
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.ferias_historico (tenant_id, solicitacao_id, acao, descricao, usuario_id, usuario_nome, dados_anteriores, dados_novos)
      VALUES (
        NEW.tenant_id, NEW.id,
        'status_' || NEW.status,
        CASE NEW.status
          WHEN 'aprovado' THEN 'Férias aprovadas por ' || COALESCE(NEW.aprovado_por_nome, 'gestor')
          WHEN 'recusado' THEN 'Férias recusadas: ' || COALESCE(NEW.motivo_recusa, 'sem motivo')
          WHEN 'em_gozo' THEN 'Colaborador em gozo de férias'
          WHEN 'concluido' THEN 'Férias concluídas — colaborador retornou'
          WHEN 'cancelado' THEN 'Solicitação cancelada'
          ELSE 'Status alterado para ' || NEW.status
        END,
        auth.uid(),
        NEW.aprovado_por_nome,
        jsonb_build_object('status', OLD.status),
        jsonb_build_object('status', NEW.status)
      );
    END IF;
    -- Aviso gerado
    IF NOT OLD.aviso_gerado AND NEW.aviso_gerado THEN
      INSERT INTO public.ferias_historico (tenant_id, solicitacao_id, acao, descricao, usuario_id)
      VALUES (NEW.tenant_id, NEW.id, 'aviso_gerado', 'Aviso de férias gerado (PDF)', auth.uid());
    END IF;
    -- Recibo gerado
    IF NOT OLD.recibo_gerado AND NEW.recibo_gerado THEN
      INSERT INTO public.ferias_historico (tenant_id, solicitacao_id, acao, descricao, usuario_id)
      VALUES (NEW.tenant_id, NEW.id, 'recibo_gerado', 'Recibo de férias gerado (PDF)', auth.uid());
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER ferias_historico_trigger
  AFTER INSERT OR UPDATE ON public.ferias_solicitacoes
  FOR EACH ROW EXECUTE FUNCTION public.registrar_historico_ferias();

-- 4. Trigger para mudar status automaticamente para 'em_gozo' e 'concluido'
CREATE OR REPLACE FUNCTION public.atualizar_status_ferias_automatico()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Férias aprovadas que já iniciaram → em_gozo
  UPDATE public.ferias_solicitacoes
  SET status = 'em_gozo'
  WHERE status = 'aprovado'
    AND data_inicio <= CURRENT_DATE
    AND data_fim >= CURRENT_DATE;

  -- Férias em gozo que já terminaram → concluido
  UPDATE public.ferias_solicitacoes
  SET status = 'concluido'
  WHERE status = 'em_gozo'
    AND data_fim < CURRENT_DATE;
END;
$$;

-- 5. View de relatório estratégico de férias por setor
CREATE OR REPLACE VIEW public.ferias_relatorio_setor AS
SELECT
  fs.tenant_id,
  fs.departamento AS setor,
  COUNT(*) AS total_solicitacoes,
  COUNT(*) FILTER (WHERE fs.status = 'aprovado') AS aprovadas,
  COUNT(*) FILTER (WHERE fs.status = 'pendente') AS pendentes,
  COUNT(*) FILTER (WHERE fs.status = 'em_gozo') AS em_gozo,
  COUNT(*) FILTER (WHERE fs.status = 'concluido') AS concluidas,
  SUM(fs.dias_solicitados) FILTER (WHERE fs.status IN ('aprovado','em_gozo','concluido')) AS total_dias_concedidos,
  SUM(fs.valor_total_bruto) FILTER (WHERE fs.status IN ('aprovado','em_gozo','concluido')) AS custo_total,
  COUNT(*) FILTER (WHERE fs.acao_preventiva = TRUE) AS acoes_preventivas,
  ROUND(AVG(fs.inr_score_momento) FILTER (WHERE fs.inr_score_momento IS NOT NULL)) AS media_inr
FROM public.ferias_solicitacoes fs
GROUP BY fs.tenant_id, fs.departamento;
