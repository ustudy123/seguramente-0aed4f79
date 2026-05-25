
CREATE OR REPLACE FUNCTION public.empresa_existe_por_documento(
  p_doc text,
  p_tipo text
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
    FROM public.empresa_cadastro
   WHERE CASE
           WHEN p_tipo = 'pf' THEN regexp_replace(coalesce(cpf,''),'[^0-9]','','g') = p_doc
           ELSE regexp_replace(coalesce(cnpj,''),'[^0-9]','','g') = p_doc
         END
     AND coalesce(
           CASE WHEN p_tipo = 'pf' THEN cpf ELSE cnpj END,
           ''
         ) <> ''
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.empresa_existe_por_documento(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.empresa_existe_por_documento(text, text) TO anon, authenticated, service_role;
