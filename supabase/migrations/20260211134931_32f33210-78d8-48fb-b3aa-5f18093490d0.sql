
-- =============================================
-- MÓDULO DE FEEDBACK E OCORRÊNCIAS
-- =============================================

-- Enum para categoria de feedback
CREATE TYPE public.feedback_categoria AS ENUM ('reconhecimento', 'alinhamento', 'desenvolvimento');

-- Enum para tipo de ocorrência
CREATE TYPE public.ocorrencia_tipo AS ENUM ('positiva', 'neutra', 'negativa');

-- Enum para status de advertência
CREATE TYPE public.advertencia_status AS ENUM ('pendente', 'enviada', 'formalizada', 'arquivada');

-- =============================================
-- TABELA: feedbacks
-- =============================================
CREATE TABLE public.feedbacks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  colaborador_id TEXT NOT NULL,
  colaborador_nome TEXT NOT NULL,
  colaborador_cargo TEXT,
  colaborador_departamento TEXT,
  colaborador_filial TEXT,
  categoria feedback_categoria NOT NULL,
  descricao TEXT NOT NULL,
  descricao_ia TEXT,
  ia_utilizada BOOLEAN DEFAULT false,
  registrado_por UUID NOT NULL,
  registrado_por_nome TEXT NOT NULL,
  enviado_email BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedbacks_select" ON public.feedbacks FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "feedbacks_insert" ON public.feedbacks FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id() AND public.has_minimum_role(auth.uid(), 'manager'));

CREATE POLICY "feedbacks_update" ON public.feedbacks FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id() AND public.has_minimum_role(auth.uid(), 'manager'));

CREATE POLICY "feedbacks_delete" ON public.feedbacks FOR DELETE
  USING (tenant_id = public.get_user_tenant_id() AND public.has_minimum_role(auth.uid(), 'admin'));

CREATE TRIGGER update_feedbacks_updated_at
  BEFORE UPDATE ON public.feedbacks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- TABELA: ocorrencias
-- =============================================
CREATE TABLE public.ocorrencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  colaborador_id TEXT NOT NULL,
  colaborador_nome TEXT NOT NULL,
  colaborador_cargo TEXT,
  colaborador_departamento TEXT,
  colaborador_filial TEXT,
  tipo ocorrencia_tipo NOT NULL,
  descricao TEXT NOT NULL,
  is_advertencia BOOLEAN DEFAULT false,
  registrado_por UUID NOT NULL,
  registrado_por_nome TEXT NOT NULL,
  data_ocorrencia TIMESTAMPTZ NOT NULL DEFAULT now(),
  bloqueado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ocorrencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ocorrencias_select" ON public.ocorrencias FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "ocorrencias_insert" ON public.ocorrencias FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id() AND public.has_minimum_role(auth.uid(), 'manager'));

CREATE POLICY "ocorrencias_update" ON public.ocorrencias FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id() AND public.has_minimum_role(auth.uid(), 'manager') AND bloqueado = false);

CREATE POLICY "ocorrencias_delete" ON public.ocorrencias FOR DELETE
  USING (tenant_id = public.get_user_tenant_id() AND public.has_minimum_role(auth.uid(), 'admin'));

CREATE TRIGGER update_ocorrencias_updated_at
  BEFORE UPDATE ON public.ocorrencias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- TABELA: advertencia_links
-- =============================================
CREATE TABLE public.advertencia_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  ocorrencia_id UUID NOT NULL REFERENCES public.ocorrencias(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  destinatario_email TEXT NOT NULL,
  destinatario_nome TEXT,
  status advertencia_status NOT NULL DEFAULT 'pendente',
  documento_url TEXT,
  documento_nome TEXT,
  enviado_em TIMESTAMPTZ,
  formalizado_em TIMESTAMPTZ,
  expira_em TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.advertencia_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "advertencia_links_select" ON public.advertencia_links FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "advertencia_links_insert" ON public.advertencia_links FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id() AND public.has_minimum_role(auth.uid(), 'manager'));

CREATE POLICY "advertencia_links_update" ON public.advertencia_links FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id());

-- Política pública para acesso via token (sem auth)
CREATE POLICY "advertencia_links_public_select" ON public.advertencia_links FOR SELECT
  USING (token IS NOT NULL);

CREATE POLICY "advertencia_links_public_update" ON public.advertencia_links FOR UPDATE
  USING (token IS NOT NULL AND status != 'arquivada');

CREATE TRIGGER update_advertencia_links_updated_at
  BEFORE UPDATE ON public.advertencia_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Índices
CREATE INDEX idx_feedbacks_tenant ON public.feedbacks(tenant_id);
CREATE INDEX idx_feedbacks_colaborador ON public.feedbacks(colaborador_id);
CREATE INDEX idx_ocorrencias_tenant ON public.ocorrencias(tenant_id);
CREATE INDEX idx_ocorrencias_colaborador ON public.ocorrencias(colaborador_id);
CREATE INDEX idx_advertencia_links_token ON public.advertencia_links(token);
CREATE INDEX idx_advertencia_links_ocorrencia ON public.advertencia_links(ocorrencia_id);
