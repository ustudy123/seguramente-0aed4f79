-- Corrigir e-mail do usuário: rh@avanaengenharia.com.br → rh@avanaengenharia.com
-- User ID conhecido: dbbb5774-84f3-462b-9f7f-48c22b21a94c

-- 1. Atualizar e-mail na tabela auth (Supabase Auth)
UPDATE auth.users
SET email = 'rh@avanaengenharia.com',
    email_confirmed_at = NOW()
WHERE id = 'dbbb5774-84f3-462b-9f7f-48c22b21a94c';

-- 2. Atualizar e-mail na tabela usuarios_base (se existir registro)
UPDATE public.usuarios_base
SET email_principal = 'rh@avanaengenharia.com'
WHERE auth_user_id = 'dbbb5774-84f3-462b-9f7f-48c22b21a94c';