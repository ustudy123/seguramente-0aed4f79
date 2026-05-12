UPDATE public.empresa_cadastro SET ativo = true  WHERE id = 'c30c4a64-b82f-47b6-987e-36d6322bd689';
UPDATE public.empresa_cadastro SET ativo = false WHERE id = '9bd43dc5-f992-49f0-b841-f4f165ba92fc';

-- Trigger-based guard (existing duplicates in other tenants are tolerated; only NEW activations are blocked).
CREATE OR REPLACE FUNCTION public.prevent_duplicate_active_cnpj()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cnpj_norm text := regexp_replace(coalesce(NEW.cnpj,''), '[^0-9]', '', 'g');
BEGIN
  IF NEW.ativo IS TRUE AND cnpj_norm <> '' THEN
    IF EXISTS (
      SELECT 1 FROM public.empresa_cadastro
      WHERE id <> NEW.id
        AND tenant_id = NEW.tenant_id
        AND ativo = true
        AND regexp_replace(coalesce(cnpj,''), '[^0-9]', '', 'g') = cnpj_norm
    ) THEN
      RAISE EXCEPTION 'Já existe outra empresa ATIVA com o CNPJ % neste tenant. Desative a duplicata antes de ativar esta.', NEW.cnpj
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_active_cnpj ON public.empresa_cadastro;
CREATE TRIGGER trg_prevent_duplicate_active_cnpj
  BEFORE INSERT OR UPDATE OF cnpj, ativo, tenant_id ON public.empresa_cadastro
  FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_active_cnpj();