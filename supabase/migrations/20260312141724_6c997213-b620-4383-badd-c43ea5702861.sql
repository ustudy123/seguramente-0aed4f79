
-- Criar profile para leiri@sudoclin.com vinculado ao tenant da NUERNBERG & BARROS
INSERT INTO public.profiles (user_id, tenant_id, nome_completo)
VALUES ('47bdf32c-ff41-4762-980b-8f62751b8315', '299779a8-1cd2-4ffe-9462-78181426cd1a', 'Leiri');

-- Atribuir role de user
INSERT INTO public.user_roles (user_id, role)
VALUES ('47bdf32c-ff41-4762-980b-8f62751b8315', 'user');
