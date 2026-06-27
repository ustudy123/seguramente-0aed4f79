-- RPC pública: lista TODAS as justificativas de ponto ATIVAS do tenant do link externo.
-- Usada na tela de Ponto Externo (sem login) para exibir as MESMAS justificativas
-- cadastradas pelo RH (ponto_justificativas), em vez de uma lista fixa no código.
-- SECURITY DEFINER + validação por token (mesmo padrão das demais RPCs externas).
--
-- Decisão de produto: no link externo (compartilhado, vários colaboradores de
-- empresas diferentes) mostramos TODAS as justificativas ativas do tenant,
-- independente de empresa. Justificativas com mesmo nome em empresas diferentes
-- aparecem uma única vez (DISTINCT por nome).

CREATE OR REPLACE FUNCTION public.listar_justificativas_externo(
  p_token TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_link RECORD;
  v_result JSONB;
BEGIN
  -- Validar token (mesma checagem das outras funções externas)
  SELECT * INTO v_link
  FROM public.ponto_links
  WHERE token = p_token
    AND ativo = true
    AND (data_expiracao IS NULL OR data_expiracao > now());

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Link inválido ou expirado.');
  END IF;

  -- TODAS as justificativas ativas do tenant (qualquer empresa), sem duplicar por nome.
  SELECT COALESCE(jsonb_agg(j ORDER BY j.ordem ASC, j.nome ASC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT DISTINCT ON (pj.nome)
           pj.id,
           pj.nome,
           pj.descricao,
           pj.horas_abono,
           pj.requer_anexo,
           pj.ordem
    FROM public.ponto_justificativas pj
    WHERE pj.tenant_id = v_link.tenant_id
      AND pj.ativo = true
    ORDER BY pj.nome, pj.ordem ASC
  ) j;

  RETURN json_build_object('justificativas', v_result);
END;
$$;

GRANT EXECUTE ON FUNCTION public.listar_justificativas_externo(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.listar_justificativas_externo(TEXT) TO authenticated;
