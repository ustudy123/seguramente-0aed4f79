
REVOKE EXECUTE ON FUNCTION public.gerar_estrutura_padrao_pastas(uuid, uuid, uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.reconciliar_pastas_todas_empresas() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.gerar_estrutura_padrao_pastas(uuid, uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reconciliar_pastas_todas_empresas() TO authenticated, service_role;
