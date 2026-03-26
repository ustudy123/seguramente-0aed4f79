-- CT-47: Função de atualização otimista de estoque (compare-and-swap)
-- Previne race conditions ao atualizar saldo
CREATE OR REPLACE FUNCTION public.epi_atualizar_estoque_otimista(
  p_epi_id UUID,
  p_quantidade_esperada INTEGER,
  p_nova_quantidade INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_affected INTEGER;
BEGIN
  UPDATE epis
  SET quantidade_estoque = p_nova_quantidade,
      updated_at = now()
  WHERE id = p_epi_id
    AND quantidade_estoque = p_quantidade_esperada;
  
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$$;

-- CT-47: Função de atualização otimista para estoque local
CREATE OR REPLACE FUNCTION public.epi_atualizar_estoque_local_otimista(
  p_estoque_local_id UUID,
  p_quantidade_esperada INTEGER,
  p_nova_quantidade INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_affected INTEGER;
BEGIN
  UPDATE epi_estoque_local
  SET quantidade = p_nova_quantidade
  WHERE id = p_estoque_local_id
    AND quantidade = p_quantidade_esperada;
  
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$$;