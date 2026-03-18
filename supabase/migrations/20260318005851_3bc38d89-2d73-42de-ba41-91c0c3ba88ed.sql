
-- Garante que usuários anônimos (sem autenticação) possam executar as RPCs públicas do questionário psicossocial
GRANT EXECUTE ON FUNCTION public.buscar_campanha_por_token_publico(text) TO anon;
GRANT EXECUTE ON FUNCTION public.validar_token_participacao(text) TO anon;

-- Garantir também para authenticated
GRANT EXECUTE ON FUNCTION public.buscar_campanha_por_token_publico(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validar_token_participacao(text) TO authenticated;
