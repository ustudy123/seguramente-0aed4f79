
-- ===== P5: Sistema de Denúncias =====
CREATE TABLE public.marketplace_denuncias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  profissional_id UUID NOT NULL REFERENCES public.marketplace_profissionais(id),
  contratacao_id UUID REFERENCES public.marketplace_contratacoes(id),
  denunciante_id UUID,
  denunciante_nome TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('conduta_inadequada', 'fora_escopo', 'fraude_documental', 'nao_comparecimento', 'qualidade_insuficiente', 'outro')),
  descricao TEXT NOT NULL,
  evidencias TEXT[] DEFAULT '{}',
  gravidade TEXT NOT NULL DEFAULT 'media' CHECK (gravidade IN ('baixa', 'media', 'alta', 'critica')),
  status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'em_analise', 'procedente', 'improcedente', 'resolvida')),
  acao_tomada TEXT,
  analisado_por UUID,
  analisado_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.marketplace_denuncias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view own denuncias"
  ON public.marketplace_denuncias FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Tenant members can create denuncias"
  ON public.marketplace_denuncias FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Admins can update denuncias"
  ON public.marketplace_denuncias FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id() AND public.has_minimum_role(auth.uid(), 'admin'));

CREATE POLICY "Superadmins full access denuncias"
  ON public.marketplace_denuncias FOR ALL
  USING (public.is_superadmin(auth.uid()));

CREATE TRIGGER update_marketplace_denuncias_updated_at
  BEFORE UPDATE ON public.marketplace_denuncias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-suspend professional on critical complaint
CREATE OR REPLACE FUNCTION public.auto_suspender_por_denuncia()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If 3+ open/procedente denuncias or 1 critical, suspend
  IF NEW.gravidade = 'critica' OR (
    SELECT COUNT(*) FROM public.marketplace_denuncias
    WHERE profissional_id = NEW.profissional_id
      AND status IN ('aberta', 'em_analise', 'procedente')
  ) >= 3 THEN
    UPDATE public.marketplace_profissionais
    SET status = 'suspenso'
    WHERE id = NEW.profissional_id AND status = 'ativo';
    
    INSERT INTO public.marketplace_audit_log (tenant_id, profissional_id, acao, descricao, dados)
    VALUES (NEW.tenant_id, NEW.profissional_id, 'suspensao_automatica',
      'Profissional suspenso automaticamente por denúncia(s)',
      jsonb_build_object('denuncia_id', NEW.id, 'gravidade', NEW.gravidade));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_suspender_denuncia
  AFTER INSERT ON public.marketplace_denuncias
  FOR EACH ROW EXECUTE FUNCTION public.auto_suspender_por_denuncia();

-- ===== P6: Auditoria de Escopo (mapeamento conselho -> categorias permitidas) =====
CREATE TABLE public.marketplace_escopo_habilitacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conselho TEXT NOT NULL,
  categoria_id UUID REFERENCES public.marketplace_categorias(id),
  categoria_nome TEXT NOT NULL,
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.marketplace_escopo_habilitacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read escopo"
  ON public.marketplace_escopo_habilitacao FOR SELECT
  USING (true);

CREATE POLICY "Superadmins manage escopo"
  ON public.marketplace_escopo_habilitacao FOR ALL
  USING (public.is_superadmin(auth.uid()));

-- Validation function for service creation
CREATE OR REPLACE FUNCTION public.validar_escopo_servico()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_conselho TEXT;
  v_cat_id UUID;
  v_permitido BOOLEAN;
BEGIN
  -- Get professional's council
  SELECT conselho INTO v_conselho
  FROM public.marketplace_profissionais
  WHERE id = NEW.profissional_id;

  -- If no category, skip validation
  IF NEW.categoria_id IS NULL THEN RETURN NEW; END IF;

  -- Check if mapping exists for this council
  SELECT EXISTS(
    SELECT 1 FROM public.marketplace_escopo_habilitacao
    WHERE conselho = v_conselho
  ) INTO v_permitido;

  -- If no mappings exist for this council, allow (not yet configured)
  IF NOT v_permitido THEN RETURN NEW; END IF;

  -- Check if specific category is allowed
  SELECT EXISTS(
    SELECT 1 FROM public.marketplace_escopo_habilitacao
    WHERE conselho = v_conselho AND categoria_id = NEW.categoria_id
  ) INTO v_permitido;

  IF NOT v_permitido THEN
    RAISE EXCEPTION 'Serviço fora do escopo de habilitação do conselho %', v_conselho;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validar_escopo_servico
  BEFORE INSERT OR UPDATE ON public.marketplace_servicos
  FOR EACH ROW EXECUTE FUNCTION public.validar_escopo_servico();

-- ===== P7: Pacotes de Serviços =====
CREATE TABLE public.marketplace_pacotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id UUID NOT NULL REFERENCES public.marketplace_profissionais(id),
  nome TEXT NOT NULL,
  descricao TEXT,
  servicos_ids UUID[] NOT NULL DEFAULT '{}',
  preco_pacote NUMERIC(10,2) NOT NULL,
  preco_individual_soma NUMERIC(10,2),
  desconto_percentual NUMERIC(5,2),
  duracao_total_minutos INTEGER,
  modalidade TEXT NOT NULL DEFAULT 'presencial' CHECK (modalidade IN ('presencial', 'online', 'hibrido')),
  publico_alvo TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.marketplace_pacotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active pacotes"
  ON public.marketplace_pacotes FOR SELECT
  USING (ativo = true);

CREATE POLICY "Profissionais manage own pacotes"
  ON public.marketplace_pacotes FOR ALL
  USING (profissional_id IN (
    SELECT id FROM public.marketplace_profissionais WHERE user_id = auth.uid()
  ));

CREATE TRIGGER update_marketplace_pacotes_updated_at
  BEFORE UPDATE ON public.marketplace_pacotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== Enable pg_cron and pg_net for P4 =====
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
