
-- E) Mover pg_trgm
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- F) landing_leads hardening
ALTER TABLE public.landing_leads
  DROP CONSTRAINT IF EXISTS landing_leads_nome_len,
  DROP CONSTRAINT IF EXISTS landing_leads_email_len,
  DROP CONSTRAINT IF EXISTS landing_leads_empresa_len,
  DROP CONSTRAINT IF EXISTS landing_leads_telefone_len,
  DROP CONSTRAINT IF EXISTS landing_leads_cargo_len,
  DROP CONSTRAINT IF EXISTS landing_leads_setor_len,
  DROP CONSTRAINT IF EXISTS landing_leads_origem_len;

ALTER TABLE public.landing_leads
  ADD CONSTRAINT landing_leads_nome_len CHECK (nome IS NULL OR char_length(nome) <= 200),
  ADD CONSTRAINT landing_leads_email_len CHECK (email IS NULL OR char_length(email) <= 320),
  ADD CONSTRAINT landing_leads_empresa_len CHECK (empresa IS NULL OR char_length(empresa) <= 200),
  ADD CONSTRAINT landing_leads_telefone_len CHECK (telefone IS NULL OR char_length(telefone) <= 40),
  ADD CONSTRAINT landing_leads_cargo_len CHECK (cargo IS NULL OR char_length(cargo) <= 200),
  ADD CONSTRAINT landing_leads_setor_len CHECK (setor IS NULL OR char_length(setor) <= 200),
  ADD CONSTRAINT landing_leads_origem_len CHECK (landing_page_origem IS NULL OR char_length(landing_page_origem) <= 300);

ALTER TABLE public.landing_leads ADD COLUMN IF NOT EXISTS ip_address text;

CREATE OR REPLACE FUNCTION public.landing_leads_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ip text;
  v_count int;
BEGIN
  BEGIN
    v_ip := COALESCE(
      current_setting('request.headers', true)::json->>'x-forwarded-for',
      current_setting('request.headers', true)::json->>'cf-connecting-ip'
    );
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
  END;

  IF v_ip IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM public.landing_leads
    WHERE created_at > now() - interval '10 minutes'
      AND ip_address = v_ip;

    IF v_count >= 5 THEN
      RAISE EXCEPTION 'Rate limit exceeded. Tente novamente em alguns minutos.'
        USING ERRCODE = 'check_violation';
    END IF;

    NEW.ip_address := v_ip;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_landing_leads_rate_limit ON public.landing_leads;
CREATE TRIGGER trg_landing_leads_rate_limit
  BEFORE INSERT ON public.landing_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.landing_leads_rate_limit();
