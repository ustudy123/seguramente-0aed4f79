
CREATE TYPE public.contrato_categoria AS ENUM ('live','aula','uso_sistema','parceria','nda','evento','outro');
CREATE TYPE public.contrato_assinatura_status AS ENUM ('pendente','assinado','expirado','revogado');

CREATE TABLE public.contratos_aceite (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  categoria public.contrato_categoria NOT NULL DEFAULT 'outro',
  descricao_publica TEXT,
  corpo_html TEXT NOT NULL,
  requer_cpf BOOLEAN NOT NULL DEFAULT true,
  requer_rg BOOLEAN NOT NULL DEFAULT false,
  requer_endereco BOOLEAN NOT NULL DEFAULT false,
  requer_telefone BOOLEAN NOT NULL DEFAULT false,
  requer_selfie BOOLEAN NOT NULL DEFAULT false,
  requer_geolocalizacao BOOLEAN NOT NULL DEFAULT false,
  validade_dias INTEGER,
  limite_assinaturas INTEGER,
  versao INTEGER NOT NULL DEFAULT 1,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.contratos_assinaturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id UUID NOT NULL REFERENCES public.contratos_aceite(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text,'-',''),
  signatario_nome TEXT,
  signatario_cpf TEXT,
  signatario_email TEXT,
  signatario_telefone TEXT,
  signatario_rg TEXT,
  signatario_endereco TEXT,
  assinatura_imagem TEXT,
  selfie_imagem TEXT,
  ip_address TEXT,
  user_agent TEXT,
  geo_lat NUMERIC,
  geo_lng NUMERIC,
  hash_documento TEXT,
  link_enviado_em TIMESTAMPTZ DEFAULT now(),
  link_enviado_para TEXT,
  expira_em TIMESTAMPTZ,
  assinado_em TIMESTAMPTZ,
  status public.contrato_assinatura_status NOT NULL DEFAULT 'pendente',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contratos_assinaturas_contrato ON public.contratos_assinaturas(contrato_id);
CREATE INDEX idx_contratos_assinaturas_status ON public.contratos_assinaturas(status);

CREATE TRIGGER trg_contratos_aceite_updated
BEFORE UPDATE ON public.contratos_aceite
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_contratos_assinaturas_updated
BEFORE UPDATE ON public.contratos_assinaturas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.contratos_aceite ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratos_assinaturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin manage contratos_aceite"
ON public.contratos_aceite FOR ALL
USING (public.is_superadmin(auth.uid()))
WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Super admin manage contratos_assinaturas"
ON public.contratos_assinaturas FOR ALL
USING (public.is_superadmin(auth.uid()))
WITH CHECK (public.is_superadmin(auth.uid()));

CREATE OR REPLACE FUNCTION public.obter_contrato_publico(_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assinatura public.contratos_assinaturas%ROWTYPE;
  v_contrato public.contratos_aceite%ROWTYPE;
  v_total_assinados INTEGER;
BEGIN
  SELECT * INTO v_assinatura FROM public.contratos_assinaturas WHERE token = _token;
  IF NOT FOUND THEN RETURN jsonb_build_object('erro','token_invalido'); END IF;
  IF v_assinatura.status = 'assinado' THEN
    RETURN jsonb_build_object('erro','ja_assinado','assinado_em',v_assinatura.assinado_em);
  END IF;
  IF v_assinatura.status = 'revogado' THEN RETURN jsonb_build_object('erro','revogado'); END IF;
  IF v_assinatura.expira_em IS NOT NULL AND v_assinatura.expira_em < now() THEN
    UPDATE public.contratos_assinaturas SET status='expirado' WHERE id = v_assinatura.id;
    RETURN jsonb_build_object('erro','expirado');
  END IF;

  SELECT * INTO v_contrato FROM public.contratos_aceite WHERE id = v_assinatura.contrato_id;
  IF NOT v_contrato.ativo THEN RETURN jsonb_build_object('erro','contrato_inativo'); END IF;

  IF v_contrato.limite_assinaturas IS NOT NULL THEN
    SELECT COUNT(*) INTO v_total_assinados FROM public.contratos_assinaturas
      WHERE contrato_id = v_contrato.id AND status='assinado';
    IF v_total_assinados >= v_contrato.limite_assinaturas THEN
      RETURN jsonb_build_object('erro','limite_atingido');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'contrato', jsonb_build_object(
      'id', v_contrato.id,
      'titulo', v_contrato.titulo,
      'categoria', v_contrato.categoria,
      'descricao_publica', v_contrato.descricao_publica,
      'corpo_html', v_contrato.corpo_html,
      'versao', v_contrato.versao,
      'requer_cpf', v_contrato.requer_cpf,
      'requer_rg', v_contrato.requer_rg,
      'requer_endereco', v_contrato.requer_endereco,
      'requer_telefone', v_contrato.requer_telefone,
      'requer_selfie', v_contrato.requer_selfie,
      'requer_geolocalizacao', v_contrato.requer_geolocalizacao
    ),
    'assinatura', jsonb_build_object(
      'id', v_assinatura.id,
      'signatario_email', v_assinatura.signatario_email,
      'signatario_nome', v_assinatura.signatario_nome,
      'expira_em', v_assinatura.expira_em
    )
  );
END; $$;

CREATE OR REPLACE FUNCTION public.registrar_assinatura_contrato(
  _token TEXT, _nome TEXT, _cpf TEXT, _email TEXT, _telefone TEXT, _rg TEXT, _endereco TEXT,
  _assinatura_imagem TEXT, _selfie_imagem TEXT, _ip TEXT, _user_agent TEXT,
  _geo_lat NUMERIC, _geo_lng NUMERIC, _hash TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_assinatura public.contratos_assinaturas%ROWTYPE;
BEGIN
  SELECT * INTO v_assinatura FROM public.contratos_assinaturas WHERE token = _token FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','token_invalido'); END IF;
  IF v_assinatura.status = 'assinado' THEN RETURN jsonb_build_object('ok',false,'erro','ja_assinado'); END IF;
  IF v_assinatura.expira_em IS NOT NULL AND v_assinatura.expira_em < now() THEN
    UPDATE public.contratos_assinaturas SET status='expirado' WHERE id=v_assinatura.id;
    RETURN jsonb_build_object('ok',false,'erro','expirado');
  END IF;

  UPDATE public.contratos_assinaturas SET
    signatario_nome = _nome, signatario_cpf = _cpf,
    signatario_email = COALESCE(_email, signatario_email),
    signatario_telefone = _telefone, signatario_rg = _rg, signatario_endereco = _endereco,
    assinatura_imagem = _assinatura_imagem, selfie_imagem = _selfie_imagem,
    ip_address = _ip, user_agent = _user_agent, geo_lat = _geo_lat, geo_lng = _geo_lng,
    hash_documento = _hash, assinado_em = now(), status = 'assinado'
  WHERE id = v_assinatura.id;

  RETURN jsonb_build_object('ok',true,'assinatura_id',v_assinatura.id);
END; $$;

GRANT EXECUTE ON FUNCTION public.obter_contrato_publico(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_assinatura_contrato(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,TEXT) TO anon, authenticated;
