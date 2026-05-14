
-- ============================================================
-- MIGRATION 1: Fechar vazamento PUBLIC em admissoes/admissao_documentos
-- Substitui policies "USING (onboarding_token IS NOT NULL)" por
-- RPCs SECURITY DEFINER que validam o token recebido como parâmetro.
-- ============================================================

-- 1) DROP das policies vulneráveis
DROP POLICY IF EXISTS "Allow public read via onboarding_token" ON public.admissoes;
DROP POLICY IF EXISTS "Allow public update via onboarding_token" ON public.admissoes;
DROP POLICY IF EXISTS "Allow public read documents via onboarding_token" ON public.admissao_documentos;
DROP POLICY IF EXISTS "Allow public update documents via onboarding_token" ON public.admissao_documentos;
DROP POLICY IF EXISTS "Allow public insert documents via onboarding_token" ON public.admissao_documentos;

-- 2) RPC: buscar admissão pelo token (público)
CREATE OR REPLACE FUNCTION public.get_admissao_by_token(_token uuid)
RETURNS public.admissoes
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.admissoes
  WHERE onboarding_token = _token
  LIMIT 1;
$$;

-- 3) RPC: buscar documentos da admissão pelo token (público)
CREATE OR REPLACE FUNCTION public.get_admissao_documentos_by_token(_token uuid)
RETURNS SETOF public.admissao_documentos
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.*
  FROM public.admissao_documentos d
  JOIN public.admissoes a ON a.id = d.admissao_id
  WHERE a.onboarding_token = _token;
$$;

-- 4) RPC: atualizar foto_url da admissão pelo token
CREATE OR REPLACE FUNCTION public.update_admissao_foto_by_token(
  _token uuid,
  _foto_url text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.admissoes
  SET foto_url = _foto_url, updated_at = now()
  WHERE onboarding_token = _token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Token inválido' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- 5) RPC: atualizar/limpar um documento de admissão pelo token
CREATE OR REPLACE FUNCTION public.update_admissao_documento_by_token(
  _token uuid,
  _documento_id uuid,
  _arquivo_url text,
  _arquivo_nome text,
  _arquivo_tamanho bigint,
  _status text,
  _data_envio timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admissao_id uuid;
BEGIN
  SELECT a.id INTO v_admissao_id
  FROM public.admissoes a
  JOIN public.admissao_documentos d ON d.admissao_id = a.id
  WHERE a.onboarding_token = _token AND d.id = _documento_id
  LIMIT 1;

  IF v_admissao_id IS NULL THEN
    RAISE EXCEPTION 'Token ou documento inválido' USING ERRCODE = '42501';
  END IF;

  UPDATE public.admissao_documentos
  SET arquivo_url = _arquivo_url,
      arquivo_nome = _arquivo_nome,
      arquivo_tamanho = _arquivo_tamanho,
      status = _status,
      data_envio = _data_envio,
      updated_at = now()
  WHERE id = _documento_id;
END;
$$;

-- 6) RPC: finalizar admissão (envia para análise)
CREATE OR REPLACE FUNCTION public.finalizar_admissao_by_token(_token uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.admissoes
  SET onboarding_status = 'em_analise',
      status = 'em_analise',
      updated_at = now()
  WHERE onboarding_token = _token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Token inválido' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- 7) Permissões: anon e authenticated podem executar (token é o segredo)
GRANT EXECUTE ON FUNCTION public.get_admissao_by_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admissao_documentos_by_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_admissao_foto_by_token(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_admissao_documento_by_token(uuid, uuid, text, text, bigint, text, timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalizar_admissao_by_token(uuid) TO anon, authenticated;
