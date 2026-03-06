-- RPC for updating client data from onboarding page (by onboarding_token)
CREATE OR REPLACE FUNCTION public.atualizar_cliente_por_onboarding_token(
  p_token uuid,
  p_nome_empresa text DEFAULT NULL,
  p_cnpj text DEFAULT NULL,
  p_segmento text DEFAULT NULL,
  p_quantidade_colaboradores int DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.programa_validador_clientes
  SET nome_empresa = COALESCE(p_nome_empresa, nome_empresa),
      cnpj = COALESCE(p_cnpj, cnpj),
      segmento = COALESCE(p_segmento, segmento),
      quantidade_colaboradores = COALESCE(p_quantidade_colaboradores, quantidade_colaboradores),
      updated_at = now()
  WHERE onboarding_token = p_token;
END; $$;