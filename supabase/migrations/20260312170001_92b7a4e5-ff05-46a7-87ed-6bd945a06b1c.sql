-- Atualizar role do usuário leiri para 'admin'
UPDATE public.user_roles
SET role = 'admin'
WHERE user_id = '47bdf32c-ff41-4762-980b-8f62751b8315' AND role = 'user';

-- Se não existir, inserir
INSERT INTO public.user_roles (user_id, role)
VALUES ('47bdf32c-ff41-4762-980b-8f62751b8315', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;