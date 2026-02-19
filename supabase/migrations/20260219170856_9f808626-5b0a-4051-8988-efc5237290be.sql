
-- ============================================================
-- HUB CONTÁBIL INTELIGENTE - Schema Completo
-- ============================================================

-- 1. COMPETÊNCIAS MENSAIS
CREATE TABLE public.hub_competencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  competencia TEXT NOT NULL, -- formato: "2026-02"
  status TEXT NOT NULL DEFAULT 'em_preparacao'
    CHECK (status IN ('em_preparacao','enviado','em_processamento','em_conferencia','aprovado','finalizado','reaberto')),
  data_envio TIMESTAMPTZ,
  data_aprovacao TIMESTAMPTZ,
  data_finalizacao TIMESTAMPTZ,
  enviado_por TEXT,
  aprovado_por TEXT,
  observacoes TEXT,
  checklist JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, competencia)
);
ALTER TABLE public.hub_competencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hub_competencias_select" ON public.hub_competencias FOR SELECT USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "hub_competencias_insert" ON public.hub_competencias FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "hub_competencias_update" ON public.hub_competencias FOR UPDATE USING (tenant_id = public.get_user_tenant_id()) WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "hub_competencias_delete" ON public.hub_competencias FOR DELETE USING (tenant_id = public.get_user_tenant_id());

CREATE TRIGGER update_hub_competencias_updated_at BEFORE UPDATE ON public.hub_competencias FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. DOCUMENTOS CONTÁBEIS
CREATE TABLE public.hub_documentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  competencia_id UUID REFERENCES public.hub_competencias(id),
  competencia TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('holerite','relatorio_folha','darf','fgts','grrf','comprovante','calculo_rescisorio','recibo_ferias','declaracao_acessoria','outro')),
  descricao TEXT,
  colaborador_nome TEXT,
  colaborador_cpf TEXT,
  arquivo_url TEXT,
  arquivo_nome TEXT,
  arquivo_tamanho BIGINT,
  versao INT NOT NULL DEFAULT 1,
  versao_anterior_id UUID REFERENCES public.hub_documentos(id),
  direcao TEXT NOT NULL DEFAULT 'enviado' CHECK (direcao IN ('enviado','recebido')),
  enviado_por TEXT,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','substituido','rejeitado')),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.hub_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hub_documentos_select" ON public.hub_documentos FOR SELECT USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "hub_documentos_insert" ON public.hub_documentos FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "hub_documentos_update" ON public.hub_documentos FOR UPDATE USING (tenant_id = public.get_user_tenant_id()) WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "hub_documentos_delete" ON public.hub_documentos FOR DELETE USING (tenant_id = public.get_user_tenant_id());

CREATE TRIGGER update_hub_documentos_updated_at BEFORE UPDATE ON public.hub_documentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. GUIAS E IMPOSTOS
CREATE TABLE public.hub_guias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  competencia_id UUID REFERENCES public.hub_competencias(id),
  competencia TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('inss','fgts','irrf','darf','grrf','contribuicao_sindical','pis','cofins','csll','iss','outro')),
  descricao TEXT,
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','paga','vencida','cancelada')),
  comprovante_url TEXT,
  comprovante_nome TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.hub_guias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hub_guias_select" ON public.hub_guias FOR SELECT USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "hub_guias_insert" ON public.hub_guias FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "hub_guias_update" ON public.hub_guias FOR UPDATE USING (tenant_id = public.get_user_tenant_id()) WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "hub_guias_delete" ON public.hub_guias FOR DELETE USING (tenant_id = public.get_user_tenant_id());

CREATE TRIGGER update_hub_guias_updated_at BEFORE UPDATE ON public.hub_guias FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. CERTIDÕES (CNDs)
CREATE TABLE public.hub_certidoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('receita_federal','fgts','cndt','estadual','municipal','previdenciaria','outro')),
  orgao_emissor TEXT NOT NULL,
  numero TEXT,
  data_emissao DATE NOT NULL,
  data_validade DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'valida' CHECK (status IN ('valida','a_vencer','vencida','irregular')),
  arquivo_url TEXT,
  arquivo_nome TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.hub_certidoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hub_certidoes_select" ON public.hub_certidoes FOR SELECT USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "hub_certidoes_insert" ON public.hub_certidoes FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "hub_certidoes_update" ON public.hub_certidoes FOR UPDATE USING (tenant_id = public.get_user_tenant_id()) WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "hub_certidoes_delete" ON public.hub_certidoes FOR DELETE USING (tenant_id = public.get_user_tenant_id());

CREATE TRIGGER update_hub_certidoes_updated_at BEFORE UPDATE ON public.hub_certidoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. HISTÓRICO / TRILHA DE AUDITORIA
CREATE TABLE public.hub_historico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  competencia TEXT,
  tipo_documento TEXT,
  documento_id UUID,
  acao TEXT NOT NULL CHECK (acao IN ('enviado','recebido','substituido','aprovado','rejeitado','reaberto','criado','atualizado','pago','vencido')),
  usuario_id UUID,
  usuario_nome TEXT,
  perfil TEXT CHECK (perfil IN ('rh','contador','financeiro','admin','sistema')),
  descricao TEXT,
  dados_anteriores JSONB,
  dados_novos JSONB,
  ip_acesso TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.hub_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hub_historico_select" ON public.hub_historico FOR SELECT USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "hub_historico_insert" ON public.hub_historico FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id());

-- Index for fast lookups
CREATE INDEX idx_hub_historico_tenant_competencia ON public.hub_historico(tenant_id, competencia);
CREATE INDEX idx_hub_historico_created_at ON public.hub_historico(created_at DESC);
CREATE INDEX idx_hub_guias_vencimento ON public.hub_guias(tenant_id, data_vencimento);
CREATE INDEX idx_hub_certidoes_validade ON public.hub_certidoes(tenant_id, data_validade);
CREATE INDEX idx_hub_documentos_competencia ON public.hub_documentos(tenant_id, competencia);

-- 6. CONFIGURAÇÃO DE NOTIFICAÇÕES
CREATE TABLE public.hub_notificacao_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  user_id UUID,
  tipo TEXT NOT NULL DEFAULT 'global' CHECK (tipo IN ('global','usuario')),
  modo TEXT NOT NULL DEFAULT 'imediata' CHECK (modo IN ('desativado','imediata','resumo_diario')),
  alertas_envio BOOLEAN DEFAULT true,
  alertas_recebimento BOOLEAN DEFAULT true,
  alertas_guias BOOLEAN DEFAULT true,
  alertas_cnd BOOLEAN DEFAULT true,
  alertas_competencia BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id, tipo)
);
ALTER TABLE public.hub_notificacao_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hub_notificacao_config_select" ON public.hub_notificacao_config FOR SELECT USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "hub_notificacao_config_insert" ON public.hub_notificacao_config FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "hub_notificacao_config_update" ON public.hub_notificacao_config FOR UPDATE USING (tenant_id = public.get_user_tenant_id()) WITH CHECK (tenant_id = public.get_user_tenant_id());

-- Trigger: auto-update certidão status
CREATE OR REPLACE FUNCTION public.atualizar_status_certidao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.data_validade < CURRENT_DATE THEN
    NEW.status := 'vencida';
  ELSIF NEW.data_validade <= CURRENT_DATE + INTERVAL '30 days' THEN
    NEW.status := 'a_vencer';
  ELSE
    NEW.status := 'valida';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_atualizar_status_certidao
BEFORE INSERT OR UPDATE ON public.hub_certidoes
FOR EACH ROW EXECUTE FUNCTION public.atualizar_status_certidao();

-- Trigger: auto-update guia status on vencimento
CREATE OR REPLACE FUNCTION public.atualizar_status_guia()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.data_pagamento IS NOT NULL THEN
    NEW.status := 'paga';
  ELSIF NEW.data_vencimento < CURRENT_DATE AND NEW.status != 'cancelada' THEN
    NEW.status := 'vencida';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_atualizar_status_guia
BEFORE INSERT OR UPDATE ON public.hub_guias
FOR EACH ROW EXECUTE FUNCTION public.atualizar_status_guia();
