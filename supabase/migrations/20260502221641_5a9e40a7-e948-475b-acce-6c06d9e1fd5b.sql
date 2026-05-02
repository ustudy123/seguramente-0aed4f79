INSERT INTO public.superadmins (user_id, email, nome, ativo)
VALUES ('13512aea-1bed-43e6-aa86-4d6cf3a38e2c', 'contato@ustudy.com.br', 'Alexandre Bento', true)
ON CONFLICT (user_id) DO UPDATE SET ativo = true;