-- =========================================================
-- FIX: "Falha ao provisionar gestor: Edge Function returned a
-- non-2xx status code" ao definir gestor de departamento.
--
-- Causa raiz: a Edge Function provisionar-gestor chama
--   supabase.rpc('gerar_login_youreyes', { p_nome_completo })
-- para gerar o login interno quando o colaborador ainda não tem
-- login_interno. Essa função NUNCA foi criada no banco — a
-- chamada lançava "function ... does not exist", caía no catch e
-- retornava HTTP 500. Como o departamento já havia sido salvo
-- antes do provisionamento, o registro era criado, mas o gestor
-- não, e o usuário via o toast de erro.
--
-- Esta migration cria a função. Ela gera um login no formato
-- "<primeiro>.<ultimo>@youreyes.local" (e-mail-shaped, pois o
-- login é usado como e-mail no auth.admin.createUser), sem
-- acentos, e garante unicidade contra usuarios_base.email_principal,
-- adicionando sufixo numérico em caso de conflito. Retorna NULL apenas
-- se não conseguir um login único após várias tentativas (a Edge
-- Function trata como 409).
-- =========================================================

CREATE OR REPLACE FUNCTION public.gerar_login_youreyes(p_nome_completo text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_dominio   constant text := '@youreyes.local';
  v_base      text;
  v_primeiro  text;
  v_ultimo    text;
  v_partes    text[];
  v_candidato text;
  v_sufixo    int := 0;
  v_existe    boolean;
BEGIN
  IF p_nome_completo IS NULL OR btrim(p_nome_completo) = '' THEN
    RETURN NULL;
  END IF;

  -- Normaliza: minúsculas, remove acentos (sem depender de unaccent),
  -- mantém apenas letras/números/espaço.
  v_base := lower(btrim(p_nome_completo));
  v_base := translate(
    v_base,
    'áàâãäéèêëíìîïóòôõöúùûüçñ',
    'aaaaaeeeeiiiiooooouuuucn'
  );
  v_base := regexp_replace(v_base, '[^a-z0-9 ]', '', 'g');
  v_base := btrim(regexp_replace(v_base, '\s+', ' ', 'g'));

  IF v_base = '' THEN
    RETURN NULL;
  END IF;

  v_partes := string_to_array(v_base, ' ');
  v_primeiro := v_partes[1];
  v_ultimo := v_partes[array_length(v_partes, 1)];

  -- "joao.silva" (se só houver um nome, usa apenas ele)
  IF array_length(v_partes, 1) = 1 THEN
    v_base := v_primeiro;
  ELSE
    v_base := v_primeiro || '.' || v_ultimo;
  END IF;

  -- Tenta até 50 variações com sufixo numérico
  LOOP
    IF v_sufixo = 0 THEN
      v_candidato := v_base || v_dominio;
    ELSE
      v_candidato := v_base || v_sufixo::text || v_dominio;
    END IF;

    SELECT
      EXISTS (SELECT 1 FROM public.usuarios_base ub WHERE lower(ub.email_principal) = v_candidato)
    INTO v_existe;

    IF NOT v_existe THEN
      RETURN v_candidato;
    END IF;

    v_sufixo := v_sufixo + 1;
    IF v_sufixo > 50 THEN
      RETURN NULL; -- desiste; Edge Function pede login manual (409)
    END IF;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.gerar_login_youreyes(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gerar_login_youreyes(text) TO authenticated, service_role;
