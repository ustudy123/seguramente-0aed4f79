
-- Allow public read by activation_token (for the activation page - unauthenticated users)
CREATE POLICY "public_read_by_activation_token"
ON public.programa_validador_clientes
FOR SELECT
USING (activation_token IS NOT NULL);
