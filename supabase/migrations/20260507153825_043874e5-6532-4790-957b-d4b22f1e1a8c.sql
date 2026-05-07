
-- RPC para solicitação de ajuste de ponto via link externo (anon)
CREATE OR REPLACE FUNCTION public.solicitar_ajuste_ponto_externo(
  p_token TEXT,
  p_tipo_marcacao TEXT,
  p_data_referencia DATE,
  p_hora_solicitada TIME,
  p_motivo TEXT,
  p_anexos JSONB DEFAULT '[]'::jsonb
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_link RECORD;
  v_ajuste_id UUID;
BEGIN
  IF p_motivo IS NULL OR length(trim(p_motivo)) < 5 THEN
    RETURN json_build_object('error', 'Informe uma justificativa com pelo menos 5 caracteres.');
  END IF;

  IF p_tipo_marcacao NOT IN ('entrada','saida','saida_almoco','retorno_almoco') THEN
    RETURN json_build_object('error', 'Tipo de marcação inválido.');
  END IF;

  SELECT * INTO v_link FROM public.ponto_links
  WHERE token = p_token AND ativo = true
    AND (data_expiracao IS NULL OR data_expiracao > now());

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Link inválido ou expirado.');
  END IF;

  INSERT INTO public.ponto_ajustes (
    tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
    data_referencia, tipo_ajuste, tipo_marcacao,
    hora_solicitada, motivo, status, created_by_nome, anexos
  ) VALUES (
    v_link.tenant_id, v_link.colaborador_id::uuid, v_link.colaborador_nome, v_link.colaborador_cpf,
    p_data_referencia, 'inclusao', p_tipo_marcacao,
    p_hora_solicitada, trim(p_motivo), 'pendente',
    v_link.colaborador_nome || ' (link externo)', COALESCE(p_anexos, '[]'::jsonb)
  ) RETURNING id INTO v_ajuste_id;

  RETURN json_build_object(
    'success', true,
    'ajuste_id', v_ajuste_id,
    'colaborador_nome', v_link.colaborador_nome
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.solicitar_ajuste_ponto_externo(TEXT, TEXT, DATE, TIME, TEXT, JSONB) TO anon, authenticated;

-- Storage policy: anon pode fazer upload no bucket ponto-ajustes-anexos sob a pasta /externo/
CREATE POLICY "Anon pode subir anexos de ajuste externo"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'ponto-ajustes-anexos'
  AND (storage.foldername(name))[1] = 'externo'
);

-- Permitir leitura via signed URL apenas para tenant; anon não precisa ler.
CREATE POLICY "Tenant pode ler anexos de ajuste"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'ponto-ajustes-anexos');
