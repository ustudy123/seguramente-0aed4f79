
-- Create security definer function to get current user email safely
CREATE OR REPLACE FUNCTION public.get_auth_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid()
$$;

-- Drop the problematic policy
DROP POLICY IF EXISTS "Colaboradores podem atualizar seus documentos" ON admissao_documentos;

-- Recreate using the security definer function
CREATE POLICY "Colaboradores podem atualizar seus documentos"
ON admissao_documentos
FOR UPDATE
TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  AND EXISTS (
    SELECT 1 FROM admissoes a
    WHERE a.id = admissao_documentos.admissao_id
      AND a.email = public.get_auth_user_email()
  )
)
WITH CHECK (
  tenant_id = get_user_tenant_id()
  AND EXISTS (
    SELECT 1 FROM admissoes a
    WHERE a.id = admissao_documentos.admissao_id
      AND a.email = public.get_auth_user_email()
  )
);
