INSERT INTO public.profiles (user_id, tenant_id, nome_completo, onboarding_concluido)
VALUES ('5f9e7327-5147-4127-a83e-7d14052ff603', '902bd0ab-f89a-4a9f-b829-c1fa552b03c0', 'Wallas Monteiro', false)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
VALUES ('5f9e7327-5147-4127-a83e-7d14052ff603', 'owner')
ON CONFLICT (user_id, role) DO NOTHING;