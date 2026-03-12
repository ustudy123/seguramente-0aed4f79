
-- Tabela ponto_links
CREATE TABLE public.ponto_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  colaborador_id TEXT NOT NULL,
  colaborador_nome TEXT NOT NULL,
  colaborador_cpf TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  data_expiracao TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ponto_links_token ON public.ponto_links(token);
CREATE INDEX idx_ponto_links_tenant ON public.ponto_links(tenant_id);

ALTER TABLE public.ponto_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view own ponto_links"
  ON public.ponto_links FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Tenant users can insert ponto_links"
  ON public.ponto_links FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Tenant users can update ponto_links"
  ON public.ponto_links FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

-- Trigger updated_at
CREATE TRIGGER update_ponto_links_updated_at
  BEFORE UPDATE ON public.ponto_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RPC: buscar dados do colaborador por token (SECURITY DEFINER para acesso anon)
CREATE OR REPLACE FUNCTION public.buscar_ponto_link_por_token(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link RECORD;
  v_result JSON;
BEGIN
  SELECT * INTO v_link
  FROM public.ponto_links
  WHERE token = p_token
    AND ativo = true
    AND (data_expiracao IS NULL OR data_expiracao > now());

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Link inválido ou expirado');
  END IF;

  -- Retornar dados parciais (sem expor CPF completo)
  RETURN json_build_object(
    'colaborador_nome', v_link.colaborador_nome,
    'colaborador_cpf_parcial', '***.' || substring(v_link.colaborador_cpf from 5 for 3) || '.' || substring(v_link.colaborador_cpf from 8 for 3) || '-**',
    'tenant_id', v_link.tenant_id,
    'colaborador_id', v_link.colaborador_id,
    'colaborador_cpf', v_link.colaborador_cpf
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.buscar_ponto_link_por_token(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.buscar_ponto_link_por_token(TEXT) TO authenticated;

-- RPC: registrar ponto via link externo (SECURITY DEFINER para acesso anon)
CREATE OR REPLACE FUNCTION public.registrar_ponto_externo(
  p_token TEXT,
  p_tipo_marcacao TEXT,
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_endereco TEXT DEFAULT NULL,
  p_selfie_base64 TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link RECORD;
  v_marcacao_id UUID;
  v_hora TIME;
  v_data DATE;
  v_selfie_url TEXT;
BEGIN
  -- Validar token
  SELECT * INTO v_link
  FROM public.ponto_links
  WHERE token = p_token
    AND ativo = true
    AND (data_expiracao IS NULL OR data_expiracao > now());

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Link inválido ou expirado');
  END IF;

  -- Validar tipo de marcação
  IF p_tipo_marcacao NOT IN ('entrada', 'saida_almoco', 'retorno_almoco', 'saida') THEN
    RETURN json_build_object('error', 'Tipo de marcação inválido');
  END IF;

  v_hora := LOCALTIME;
  v_data := CURRENT_DATE;

  -- Verificar duplicidade (mesmo tipo no mesmo dia)
  IF EXISTS (
    SELECT 1 FROM public.ponto_marcacoes
    WHERE tenant_id = v_link.tenant_id
      AND colaborador_cpf = v_link.colaborador_cpf
      AND data_marcacao = v_data
      AND tipo_marcacao = p_tipo_marcacao
  ) THEN
    RETURN json_build_object('error', 'Marcação de ' || p_tipo_marcacao || ' já registrada hoje');
  END IF;

  -- Inserir marcação
  INSERT INTO public.ponto_marcacoes (
    tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
    data_marcacao, hora_marcacao, tipo_marcacao,
    latitude, longitude, endereco_geolocalizacao,
    origem, dispositivo
  ) VALUES (
    v_link.tenant_id, v_link.colaborador_id, v_link.colaborador_nome, v_link.colaborador_cpf,
    v_data, v_hora, p_tipo_marcacao,
    p_latitude, p_longitude, p_endereco,
    'link_externo', 'mobile_web'
  ) RETURNING id INTO v_marcacao_id;

  RETURN json_build_object(
    'success', true,
    'marcacao_id', v_marcacao_id,
    'colaborador_nome', v_link.colaborador_nome,
    'tipo_marcacao', p_tipo_marcacao,
    'hora', to_char(v_hora, 'HH24:MI:SS'),
    'data', to_char(v_data, 'DD/MM/YYYY')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_ponto_externo(TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.registrar_ponto_externo(TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT) TO authenticated;
