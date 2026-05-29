-- Adicionar colunas de requisitos na tabela de templates de contrato
ALTER TABLE public.contratos_aceite 
ADD COLUMN requer_cnpj BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN requer_razao_social BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN requer_representante BOOLEAN NOT NULL DEFAULT false;

-- Adicionar colunas de dados na tabela de assinaturas
ALTER TABLE public.contratos_assinaturas 
ADD COLUMN signatario_cnpj TEXT,
ADD COLUMN signatario_razao_social TEXT,
ADD COLUMN signatario_representante TEXT;

-- Atualizar a função obter_contrato_publico para retornar os novos campos
CREATE OR REPLACE FUNCTION public.obter_contrato_publico(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
      'requer_geolocalizacao', v_contrato.requer_geolocalizacao,
      'requer_cnpj', v_contrato.requer_cnpj,
      'requer_razao_social', v_contrato.requer_razao_social,
      'requer_representante', v_contrato.requer_representante
    ),
    'assinatura', jsonb_build_object(
      'id', v_assinatura.id,
      'signatario_email', v_assinatura.signatario_email,
      'signatario_nome', v_assinatura.signatario_nome,
      'expira_em', v_assinatura.expira_em
    )
  );
END;
$function$;

-- Atualizar a função registrar_assinatura_contrato para salvar os novos campos
CREATE OR REPLACE FUNCTION public.registrar_assinatura_contrato(
    _token text, 
    _nome text, 
    _cpf text DEFAULT NULL::text, 
    _email text DEFAULT NULL::text, 
    _telefone text DEFAULT NULL::text, 
    _rg text DEFAULT NULL::text, 
    _endereco text DEFAULT NULL::text, 
    _assinatura_imagem text DEFAULT NULL::text, 
    _selfie_imagem text DEFAULT NULL::text, 
    _ip text DEFAULT NULL::text, 
    _user_agent text DEFAULT NULL::text, 
    _geo_lat numeric DEFAULT NULL::numeric, 
    _geo_lng numeric DEFAULT NULL::numeric, 
    _hash text DEFAULT NULL::text,
    _cnpj text DEFAULT NULL::text,
    _razao_social text DEFAULT NULL::text,
    _representante text DEFAULT NULL::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
    signatario_nome = _nome, 
    signatario_cpf = _cpf,
    signatario_email = COALESCE(_email, signatario_email),
    signatario_telefone = _telefone, 
    signatario_rg = _rg, 
    signatario_endereco = _endereco,
    signatario_cnpj = _cnpj,
    signatario_razao_social = _razao_social,
    signatario_representante = _representante,
    assinatura_imagem = _assinatura_imagem, 
    selfie_imagem = _selfie_imagem,
    ip_address = _ip, 
    user_agent = _user_agent, 
    geo_lat = _geo_lat, 
    geo_lng = _geo_lng,
    hash_documento = _hash, 
    assinado_em = now(), 
    status = 'assinado'
  WHERE id = v_assinatura.id;

  RETURN jsonb_build_object('ok',true,'assinatura_id',v_assinatura.id);
END;
$function$;
