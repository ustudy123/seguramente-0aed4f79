-- Migração Parte 2: Criar estrutura de superadmins

-- 1. Criar tabela para superadmins globais (sem tenant)
CREATE TABLE IF NOT EXISTS public.superadmins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nome TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- 2. Enable RLS
ALTER TABLE public.superadmins ENABLE ROW LEVEL SECURITY;

-- 3. Função para verificar se é superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.superadmins
    WHERE user_id = _user_id
      AND ativo = true
  )
$$;

-- 4. Policies para superadmins - apenas superadmins podem gerenciar outros superadmins
CREATE POLICY "Superadmins podem ver superadmins"
ON public.superadmins FOR SELECT
USING (public.is_superadmin(auth.uid()));

CREATE POLICY "Superadmins podem gerenciar superadmins"
ON public.superadmins FOR ALL
USING (public.is_superadmin(auth.uid()))
WITH CHECK (public.is_superadmin(auth.uid()));

-- 5. Policy especial para tenants - superadmins podem ver e gerenciar todos os tenants
DROP POLICY IF EXISTS "Superadmins podem ver todos tenants" ON public.tenants;
CREATE POLICY "Superadmins podem ver todos tenants"
ON public.tenants FOR SELECT
USING (public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "Superadmins podem gerenciar todos tenants" ON public.tenants;
CREATE POLICY "Superadmins podem gerenciar todos tenants"
ON public.tenants FOR ALL
USING (public.is_superadmin(auth.uid()))
WITH CHECK (public.is_superadmin(auth.uid()));

-- 6. Superadmins podem ver todos os profiles (para gestão)
DROP POLICY IF EXISTS "Superadmins podem ver todos profiles" ON public.profiles;
CREATE POLICY "Superadmins podem ver todos profiles"
ON public.profiles FOR SELECT
USING (public.is_superadmin(auth.uid()));

-- 7. Superadmins podem gerenciar user_roles
DROP POLICY IF EXISTS "Superadmins podem gerenciar roles" ON public.user_roles;
CREATE POLICY "Superadmins podem gerenciar roles"
ON public.user_roles FOR ALL
USING (public.is_superadmin(auth.uid()))
WITH CHECK (public.is_superadmin(auth.uid()));

-- 8. Inserir o primeiro superadmin
INSERT INTO public.superadmins (user_id, email, nome)
VALUES ('88e87842-d0e8-4443-93c6-77dcdc2d29f5', 'wallasmonteiro019@gmail.com', 'Wallas Monteiro')
ON CONFLICT (user_id) DO NOTHING;

-- 9. Adicionar role superadmin na tabela user_roles também
INSERT INTO public.user_roles (user_id, role)
VALUES ('88e87842-d0e8-4443-93c6-77dcdc2d29f5', 'superadmin')
ON CONFLICT (user_id, role) DO NOTHING;

-- 10. Trigger para updated_at
DROP TRIGGER IF EXISTS update_superadmins_updated_at ON public.superadmins;
CREATE TRIGGER update_superadmins_updated_at
BEFORE UPDATE ON public.superadmins
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 11. Índices para performance
CREATE INDEX IF NOT EXISTS idx_superadmins_user_id ON public.superadmins(user_id);
CREATE INDEX IF NOT EXISTS idx_superadmins_email ON public.superadmins(email);