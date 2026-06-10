-- =========================================================
-- FIX: Selfie no registro de ponto externo (link do colaborador)
--
-- Problema: a tela externa capturava a selfie mas enviava
-- p_selfie_base64 = null fixo, e a função registrar_ponto_externo
-- ignorava o parâmetro. A selfie era simplesmente descartada.
--
-- Solução:
-- 1) Policy de storage permitindo upload anônimo no bucket
--    ponto-selfies, restrito ao prefixo externo/
-- 2) registrar_ponto_externo passa a receber selfie_url e
--    selfie_nome e gravá-los na marcação (mesmo padrão do
--    kiosk interno)
-- =========================================================

-- 1) Permite que a página pública (anon) suba a selfie no bucket,
--    apenas dentro do prefixo externo/
DROP POLICY IF EXISTS "Anon can upload external ponto selfies" ON storage.objects;
CREATE POLICY "Anon can upload external ponto selfies"
ON storage.objects FOR INSERT TO anon
WITH CHECK (bucket_id = 'ponto-selfies' AND name LIKE 'externo/%');

-- 2) Recria registrar_ponto_externo com os parâmetros de selfie
--    (precisa de DROP porque a assinatura muda)
DROP FUNCTION IF EXISTS public.registrar_ponto_externo(text, text, double precision, double precision, text, text);

CREATE OR REPLACE FUNCTION public.registrar_ponto_externo(
  p_token text,
  p_tipo_marcacao text DEFAULT NULL,
  p_latitude double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL,
  p_endereco text DEFAULT NULL,
  p_selfie_url text DEFAULT NULL,
  p_selfie_nome text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_link RECORD; v_marcacao_id UUID; v_hora TIME; v_data DATE;
  v_now TIMESTAMP; v_err TEXT; v_ultimo TEXT; v_tipo TEXT;
BEGIN
  v_now := timezone('America/Sao_Paulo', now());
  v_hora := v_now::TIME;
  v_data := v_now::DATE;

  SELECT * INTO v_link FROM public.ponto_links
  WHERE token = p_token AND ativo = true
    AND (data_expiracao IS NULL OR data_expiracao > now());
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Link inválido ou expirado.');
  END IF;

  -- Determina o próximo tipo automaticamente com base no último evento do dia
  SELECT tipo_marcacao INTO v_ultimo
  FROM public.ponto_marcacoes
  WHERE tenant_id = v_link.tenant_id
    AND colaborador_cpf = v_link.colaborador_cpf
    AND data_marcacao = v_data
  ORDER BY hora_marcacao DESC, created_at DESC
  LIMIT 1;

  IF v_ultimo IS NULL THEN
    v_tipo := 'entrada';
  ELSIF v_ultimo IN ('entrada', 'retorno_almoco') THEN
    v_tipo := 'saida';
  ELSE
    v_tipo := 'entrada';
  END IF;

  BEGIN
    INSERT INTO public.ponto_marcacoes (
      tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
      data_marcacao, hora_marcacao, tipo_marcacao,
      latitude, longitude, dispositivo, hash_marcacao, marcacao_original,
      endereco_geolocalizacao, selfie_url, selfie_nome
    ) VALUES (
      v_link.tenant_id, v_link.colaborador_id::uuid, v_link.colaborador_nome, v_link.colaborador_cpf,
      v_data, v_hora, v_tipo, p_latitude, p_longitude, 'mobile_web',
      encode(sha256((v_link.colaborador_cpf || v_data::text || v_hora::text || v_tipo || clock_timestamp()::text)::bytea), 'hex'),
      true, p_endereco, p_selfie_url, p_selfie_nome
    ) RETURNING id INTO v_marcacao_id;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    RETURN json_build_object('error', COALESCE(v_err, 'Não foi possível registrar agora.'));
  END;

  RETURN json_build_object(
    'success', true,
    'marcacao_id', v_marcacao_id,
    'colaborador_nome', v_link.colaborador_nome,
    'tipo_marcacao', v_tipo,
    'hora', to_char(v_hora, 'HH24:MI:SS'),
    'data', to_char(v_data, 'DD/MM/YYYY')
  );
END;
$$;

-- Regrants (a migration de hardening revogou os defaults)
REVOKE EXECUTE ON FUNCTION public.registrar_ponto_externo(text, text, double precision, double precision, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_ponto_externo(text, text, double precision, double precision, text, text, text) TO anon, authenticated;
