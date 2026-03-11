INSERT INTO public.superadmins (user_id, email, nome, ativo)
VALUES ('b961e27b-932f-4483-b619-6d6230b74d08', 'lucassaro07@gmail.com', 'Lucas Saro', true)
ON CONFLICT DO NOTHING;