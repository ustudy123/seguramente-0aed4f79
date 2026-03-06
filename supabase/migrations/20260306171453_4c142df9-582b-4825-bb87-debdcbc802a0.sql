-- RPCs for fetching contratos and doc links by cliente_id (from onboarding page)
CREATE OR REPLACE FUNCTION public.buscar_contratos_por_cliente(p_cliente_id uuid)
RETURNS TABLE(id uuid, token uuid, status text, assinado_em timestamptz, html_assinado text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, token, status, assinado_em, html_assinado
  FROM public.programa_validador_contratos
  WHERE cliente_id = p_cliente_id
  ORDER BY created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.buscar_doc_links_por_cliente(p_cliente_id uuid)
RETURNS TABLE(id uuid, tipo text, token uuid, status text, aceito_em timestamptz, html_assinado text, html_documento text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, tipo, token, status, aceito_em, html_assinado, html_documento
  FROM public.programa_validador_documento_links
  WHERE cliente_id = p_cliente_id
  ORDER BY created_at DESC;
$$;