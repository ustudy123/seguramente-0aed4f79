-- Drop the existing insert policy if it exists to recreate it correctly
DROP POLICY IF EXISTS "Usuários podem solicitar ajustes" ON public.ponto_ajustes;

-- Create a more robust policy for inserting adjustments
-- This policy ensures the user can only insert records for their own tenant
CREATE POLICY "Usuários podem solicitar ajustes" ON public.ponto_ajustes
FOR INSERT 
TO authenticated 
WITH CHECK (
    tenant_id = (
        SELECT p.tenant_id 
        FROM public.profiles p 
        WHERE p.id = auth.uid()
    )
);

-- Ensure RLS is enabled
ALTER TABLE public.ponto_ajustes ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT INSERT ON public.ponto_ajustes TO authenticated;
GRANT ALL ON public.ponto_ajustes TO service_role;
