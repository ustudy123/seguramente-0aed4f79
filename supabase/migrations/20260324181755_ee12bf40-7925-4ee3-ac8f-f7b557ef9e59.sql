-- Allow collaboradores to update documents on their own admissão
CREATE POLICY "Colaboradores podem atualizar seus documentos"
ON public.admissao_documentos
FOR UPDATE
TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  AND EXISTS (
    SELECT 1 FROM admissoes a
    WHERE a.id = admissao_documentos.admissao_id
    AND a.email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
)
WITH CHECK (
  tenant_id = get_user_tenant_id()
  AND EXISTS (
    SELECT 1 FROM admissoes a
    WHERE a.id = admissao_documentos.admissao_id
    AND a.email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);