
-- 1) Tabela principal de assinaturas do Manual da Função
CREATE TABLE IF NOT EXISTS public.manual_funcao_assinaturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  empresa_id UUID,

  cargo_id UUID NOT NULL,
  cargo_nome TEXT NOT NULL,

  colaborador_id UUID NOT NULL,
  colaborador_nome TEXT NOT NULL,
  colaborador_cpf TEXT,

  gestor_id UUID,
  gestor_nome TEXT,
  gestor_cpf TEXT,
  gestor_email TEXT,

  manual_html_snapshot TEXT NOT NULL,
  termo_html TEXT NOT NULL,
  manual_titulo TEXT,

  status TEXT NOT NULL DEFAULT 'aguardando_colaborador'
    CHECK (status IN ('aguardando_colaborador','aguardando_gestor','concluido','cancelado')),

  assinatura_colaborador JSONB,
  assinatura_gestor JSONB,

  data_envio TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_assinatura_colaborador TIMESTAMPTZ,
  data_assinatura_gestor TIMESTAMPTZ,
  data_conclusao TIMESTAMPTZ,

  documento_arquivado_id UUID,
  pdf_storage_path TEXT,

  enviado_por UUID,
  enviado_por_nome TEXT,
  observacoes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mfa_tenant ON public.manual_funcao_assinaturas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mfa_empresa ON public.manual_funcao_assinaturas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_mfa_cargo ON public.manual_funcao_assinaturas(cargo_id);
CREATE INDEX IF NOT EXISTS idx_mfa_colab ON public.manual_funcao_assinaturas(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_mfa_status ON public.manual_funcao_assinaturas(status);

-- 2) Links públicos com tokens
CREATE TABLE IF NOT EXISTS public.manual_funcao_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  assinatura_id UUID NOT NULL REFERENCES public.manual_funcao_assinaturas(id) ON DELETE CASCADE,
  tipo_assinante TEXT NOT NULL CHECK (tipo_assinante IN ('colaborador','gestor')),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mfl_token ON public.manual_funcao_links(token);
CREATE INDEX IF NOT EXISTS idx_mfl_assinatura ON public.manual_funcao_links(assinatura_id);

-- 3) Trigger updated_at
CREATE TRIGGER trg_mfa_updated_at
  BEFORE UPDATE ON public.manual_funcao_assinaturas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) RLS
ALTER TABLE public.manual_funcao_assinaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_funcao_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "MFA select tenant" ON public.manual_funcao_assinaturas
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "MFA insert tenant" ON public.manual_funcao_assinaturas
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "MFA update tenant" ON public.manual_funcao_assinaturas
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "MFA delete tenant" ON public.manual_funcao_assinaturas
  FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "MFL select tenant" ON public.manual_funcao_links
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "MFL insert tenant" ON public.manual_funcao_links
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "MFL update tenant" ON public.manual_funcao_links
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

-- 5) RPC pública: obter manual + termo via token
CREATE OR REPLACE FUNCTION public.obter_assinatura_manual_publica(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link RECORD;
  v_a RECORD;
  v_ja_assinou BOOLEAN := false;
BEGIN
  SELECT * INTO v_link FROM public.manual_funcao_links WHERE token = p_token LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('erro','token_invalido');
  END IF;
  IF v_link.expires_at < now() THEN
    RETURN jsonb_build_object('erro','token_expirado');
  END IF;

  SELECT * INTO v_a FROM public.manual_funcao_assinaturas WHERE id = v_link.assinatura_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('erro','registro_nao_encontrado');
  END IF;

  -- Já assinado neste tipo?
  IF v_link.tipo_assinante = 'colaborador' AND v_a.assinatura_colaborador IS NOT NULL THEN
    v_ja_assinou := true;
  ELSIF v_link.tipo_assinante = 'gestor' AND v_a.assinatura_gestor IS NOT NULL THEN
    v_ja_assinou := true;
  END IF;

  -- Gestor só pode assinar depois do colaborador
  IF v_link.tipo_assinante = 'gestor' AND v_a.assinatura_colaborador IS NULL THEN
    RETURN jsonb_build_object(
      'erro','aguardando_colaborador',
      'cargo', v_a.cargo_nome,
      'colaborador', v_a.colaborador_nome
    );
  END IF;

  RETURN jsonb_build_object(
    'assinatura_id', v_a.id,
    'tipo_assinante', v_link.tipo_assinante,
    'cargo', v_a.cargo_nome,
    'colaborador_nome', v_a.colaborador_nome,
    'colaborador_cpf_mask', CASE WHEN v_a.colaborador_cpf IS NOT NULL
       THEN '***.' || substring(regexp_replace(v_a.colaborador_cpf,'\D','','g') from 4 for 3) || '.***-**'
       ELSE NULL END,
    'gestor_nome', v_a.gestor_nome,
    'manual_titulo', v_a.manual_titulo,
    'manual_html', v_a.manual_html_snapshot,
    'termo_html', v_a.termo_html,
    'status', v_a.status,
    'ja_assinou', v_ja_assinou,
    'assinatura_colaborador', v_a.assinatura_colaborador,
    'assinatura_gestor', v_a.assinatura_gestor
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.obter_assinatura_manual_publica(TEXT) TO anon, authenticated;

-- 6) RPC pública: registrar assinatura
CREATE OR REPLACE FUNCTION public.assinar_manual_funcao_publica(
  p_token TEXT,
  p_nome TEXT,
  p_cpf TEXT,
  p_selfie_url TEXT,
  p_geo JSONB,
  p_ip TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link RECORD;
  v_a RECORD;
  v_hash TEXT;
  v_payload JSONB;
  v_cpf_clean TEXT;
  v_cpf_esperado TEXT;
  v_novo_status TEXT;
BEGIN
  SELECT * INTO v_link FROM public.manual_funcao_links WHERE token = p_token LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso',false,'erro','token_invalido');
  END IF;
  IF v_link.expires_at < now() THEN
    RETURN jsonb_build_object('sucesso',false,'erro','token_expirado');
  END IF;
  IF v_link.used_at IS NOT NULL THEN
    RETURN jsonb_build_object('sucesso',false,'erro','ja_assinada');
  END IF;

  SELECT * INTO v_a FROM public.manual_funcao_assinaturas WHERE id = v_link.assinatura_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso',false,'erro','registro_nao_encontrado');
  END IF;

  IF v_link.tipo_assinante = 'gestor' AND v_a.assinatura_colaborador IS NULL THEN
    RETURN jsonb_build_object('sucesso',false,'erro','aguardando_colaborador');
  END IF;

  v_cpf_clean := regexp_replace(COALESCE(p_cpf,''), '\D', '', 'g');
  v_cpf_esperado := regexp_replace(COALESCE(
    CASE WHEN v_link.tipo_assinante='colaborador' THEN v_a.colaborador_cpf ELSE v_a.gestor_cpf END
  , ''), '\D', '', 'g');

  IF v_cpf_esperado <> '' AND v_cpf_clean <> v_cpf_esperado THEN
    RETURN jsonb_build_object('sucesso',false,'erro','cpf_divergente');
  END IF;

  v_hash := encode(digest(v_a.id::text || v_link.tipo_assinante || COALESCE(p_selfie_url,'') || COALESCE(p_ip,'') || now()::text, 'sha256'), 'hex');

  v_payload := jsonb_build_object(
    'nome', p_nome,
    'cpf', v_cpf_clean,
    'data', now(),
    'ip', p_ip,
    'geo', p_geo,
    'selfie_url', p_selfie_url,
    'hash', v_hash
  );

  IF v_link.tipo_assinante = 'colaborador' THEN
    v_novo_status := CASE WHEN v_a.gestor_id IS NOT NULL THEN 'aguardando_gestor' ELSE 'concluido' END;
    UPDATE public.manual_funcao_assinaturas
       SET assinatura_colaborador = v_payload,
           data_assinatura_colaborador = now(),
           status = v_novo_status,
           data_conclusao = CASE WHEN v_novo_status='concluido' THEN now() ELSE data_conclusao END,
           updated_at = now()
     WHERE id = v_a.id;
  ELSE
    UPDATE public.manual_funcao_assinaturas
       SET assinatura_gestor = v_payload,
           data_assinatura_gestor = now(),
           status = 'concluido',
           data_conclusao = now(),
           updated_at = now()
     WHERE id = v_a.id;
  END IF;

  UPDATE public.manual_funcao_links SET used_at = now() WHERE id = v_link.id;

  RETURN jsonb_build_object(
    'sucesso', true,
    'hash', v_hash,
    'concluido', (SELECT status='concluido' FROM public.manual_funcao_assinaturas WHERE id = v_a.id),
    'assinatura_id', v_a.id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.assinar_manual_funcao_publica(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT) TO anon, authenticated;
