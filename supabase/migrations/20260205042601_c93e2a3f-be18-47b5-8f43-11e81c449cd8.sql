-- Adicionar leiri@sudoclin.com como superadmin global
INSERT INTO public.superadmins (user_id, email, nome, ativo)
SELECT id, 'leiri@sudoclin.com', 'Leiri Sudoclin', true
FROM auth.users
WHERE email = 'leiri@sudoclin.com'
ON CONFLICT (user_id) DO NOTHING;