-- =====================================================================
-- listar_justificativas_externo: NÃO exibir as justificativas do SISTEMA
-- =====================================================================
-- As 12 justificativas padrão (sistema=true) são voltadas ao gestor/RH na
-- Folha de Ponto interna, onde disparam o abono automático via justificativa_id.
-- No link externo (colaborador, sem login) o fluxo grava apenas o motivo em
-- texto (sem justificativa_id), então essas justificativas de abono não teriam
-- efeito e só confundiriam o colaborador. Logo, o link externo passa a listar
-- somente as justificativas cadastradas pelo RH (sistema=false).
-- =====================================================================

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
  SELECT * INTO v_link
  FROM public.ponto_links
  WHERE token = p_token
    AND ativo = true
    AND (data_expiracao IS NULL OR data_expiracao > now());

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Link inválido ou expirado.');
  END IF;

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
      AND COALESCE(pj.sistema, false) = false
    ORDER BY pj.nome, pj.ordem ASC
  ) j;

  RETURN json_build_object('justificativas', v_result);
END;
$$;

GRANT EXECUTE ON FUNCTION public.listar_justificativas_externo(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.listar_justificativas_externo(TEXT) TO authenticated;
