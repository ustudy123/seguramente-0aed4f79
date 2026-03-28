-- Fix: Atualizar role do usuário tecnico.capanema para 'manager' conforme seu tipo_usuario 'gestor'
UPDATE public.user_roles 
SET role = 'manager' 
WHERE user_id = '0ac509f9-d0a5-4d1d-8df9-afa5aedcadb8' AND role = 'user';

-- Se não existir, inserir
INSERT INTO public.user_roles (user_id, role)
VALUES ('0ac509f9-d0a5-4d1d-8df9-afa5aedcadb8', 'manager')
ON CONFLICT (user_id, role) DO NOTHING;