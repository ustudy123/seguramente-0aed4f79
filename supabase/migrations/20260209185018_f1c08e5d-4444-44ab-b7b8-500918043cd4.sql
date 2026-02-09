
-- Add CA certificate expiry date to epi_tipos
ALTER TABLE public.epi_tipos ADD COLUMN IF NOT EXISTS ca_validade date;

-- Add comment for documentation
COMMENT ON COLUMN public.epi_tipos.ca_validade IS 'Data de validade do Certificado de Aprovação (CA) do MTE';
