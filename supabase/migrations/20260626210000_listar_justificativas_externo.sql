-- RPC pública: lista as justificativas de ponto ATIVAS do tenant do link externo.
-- Usada na tela de Ponto Externo (sem login) para exibir as MESMAS justificativas
-- cadastradas pelo RH (ponto_justificativas), em vez de uma lista fixa no código.
-- SECURITY DEFINER + validação por token (mesmo padrão das demais RPCs externas).
--
-- Observação: ponto_links NÃO possui empresa_id (só tenant_id + colaborador_cpf).
-- A empresa do colaborador é resolvida via admissões pelo CPF, para incluir também
-- justificativas específicas da empresa dele (além das globais do tenant).

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
  v_empresa_id UUID;
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

  -- Tentar resolver a empresa do colaborador (pelo CPF) dentro do tenant do link.
  SELECT a.empresa_id
  INTO v_empresa_id
  FROM public.admissoes a
  WHERE a.tenant_id = v_link.tenant_id
    AND regexp_replace(a.cpf, '\D', '', 'g') = regexp_replace(v_link.colaborador_cpf, '\D', '', 'g')
    AND COALESCE(a.inativo, false) = false
  ORDER BY a.data_admissao DESC NULLS LAST
  LIMIT 1;

  -- Justificativas ativas do tenant: globais (empresa_id IS NULL) +
  -- as especificas da empresa do colaborador (se resolvida). Sem duplicar por nome.
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
      AND (
        pj.empresa_id IS NULL
        OR (v_empresa_id IS NOT NULL AND pj.empresa_id = v_empresa_id)
      )
    ORDER BY pj.nome, pj.empresa_id NULLS LAST
  ) j;

  RETURN json_build_object('justificativas', v_result);
END;
$$;

GRANT EXECUTE ON FUNCTION public.listar_justificativas_externo(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.listar_justificativas_externo(TEXT) TO authenticated;
