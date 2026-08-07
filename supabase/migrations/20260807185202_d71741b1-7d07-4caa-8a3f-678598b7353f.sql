ALTER TABLE public.ponto_links
  ALTER COLUMN data_expiracao SET DEFAULT (now() + interval '180 days');

UPDATE public.ponto_links
SET data_expiracao = GREATEST(created_at + interval '180 days', now() + interval '30 days'),
    updated_at = now()
WHERE data_expiracao IS NULL;

CREATE OR REPLACE FUNCTION public.ponto_links_validade_before()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.data_expiracao IS NULL THEN
      NEW.data_expiracao := now() + interval '180 days';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.token IS DISTINCT FROM OLD.token THEN
      NEW.data_expiracao := now() + interval '180 days';
    END IF;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ponto_links_validade ON public.ponto_links;
CREATE TRIGGER trg_ponto_links_validade
BEFORE INSERT OR UPDATE ON public.ponto_links
FOR EACH ROW EXECUTE FUNCTION public.ponto_links_validade_before();

CREATE OR REPLACE FUNCTION public.ponto_link_renovar(p_link_id uuid, p_dias integer DEFAULT 180)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.ponto_links;
  v_nova timestamptz;
BEGIN
  IF p_dias IS NULL OR p_dias < 1 OR p_dias > 365 THEN
    RAISE EXCEPTION 'Prazo inválido: informe entre 1 e 365 dias.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_link FROM public.ponto_links WHERE id = p_link_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF v_link.tenant_id IS DISTINCT FROM public.current_user_tenant_id() THEN
    RAISE EXCEPTION 'Sem permissão para renovar este link.' USING ERRCODE = '42501';
  END IF;

  v_nova := now() + make_interval(days => p_dias);

  UPDATE public.ponto_links
  SET data_expiracao = v_nova,
      ativo = true,
      updated_at = now()
  WHERE id = p_link_id;

  RETURN v_nova;
END;
$$;

REVOKE ALL ON FUNCTION public.ponto_link_renovar(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ponto_link_renovar(uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.ponto_links_revogar_desligados()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qtd integer := 0;
BEGIN
  UPDATE public.ponto_links l
  SET ativo = false, updated_at = now()
  WHERE l.tipo <> 'compartilhado'
    AND l.ativo = true
    AND length(regexp_replace(COALESCE(l.colaborador_cpf, ''), '\D', '', 'g')) = 11
    AND NOT EXISTS (
      SELECT 1 FROM public.admissoes a
      WHERE a.tenant_id = l.tenant_id
        AND regexp_replace(COALESCE(a.cpf, ''), '\D', '', 'g') = regexp_replace(COALESCE(l.colaborador_cpf, ''), '\D', '', 'g')
        AND a.status = 'concluido'
        AND COALESCE(a.inativo, false) = false
        AND COALESCE(a.bate_ponto, true) = true
    );
  GET DIAGNOSTICS v_qtd = ROW_COUNT;
  RETURN v_qtd;
END;
$$;

REVOKE ALL ON FUNCTION public.ponto_links_revogar_desligados() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ponto_links_revogar_desligados() TO authenticated, service_role;

SELECT public.ponto_links_revogar_desligados();