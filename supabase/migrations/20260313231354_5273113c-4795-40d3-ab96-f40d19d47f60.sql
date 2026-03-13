
-- Insert usuarios_base records for existing auth users in tenant 299779a8 that don't have one yet
INSERT INTO public.usuarios_base (tenant_id, auth_user_id, nome_completo, email_principal, status, email_validado, tipo_usuario, origem_cadastro)
SELECT 
  p.tenant_id,
  p.user_id,
  p.nome_completo,
  au.email,
  'ativo'::public.usuario_status,
  true,
  CASE 
    WHEN ur.role IN ('owner', 'admin') THEN 'administrador'::public.usuario_tipo
    ELSE 'gestor'::public.usuario_tipo
  END,
  'sincronizacao'
FROM public.profiles p
JOIN auth.users au ON au.id = p.user_id
LEFT JOIN public.user_roles ur ON ur.user_id = p.user_id
WHERE p.tenant_id = '299779a8-1cd2-4ffe-9462-78181426cd1a'
  AND NOT EXISTS (
    SELECT 1 FROM public.usuarios_base ub WHERE ub.auth_user_id = p.user_id
  );
