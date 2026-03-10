-- Add onboarding_token column to profiles for quick lookup
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_token UUID DEFAULT NULL;

-- Allow authenticated users to read their own onboarding_token
-- (already have policy "Usuários podem ver próprio profile" for SELECT)