
-- 1. Adicionar campos faltantes em perfis_acesso
ALTER TABLE public.perfis_acesso
  ADD COLUMN IF NOT EXISTS nivel_risco TEXT DEFAULT 'normal' CHECK (nivel_risco IN ('normal', 'elevado', 'critico')),
  ADD COLUMN IF NOT EXISTS is_perfil_assistido BOOLEAN DEFAULT false;

-- 2. Adicionar campos faltantes em perfil_permissoes
ALTER TABLE public.perfil_permissoes
  ADD COLUMN IF NOT EXISTS is_sensivel BOOLEAN DEFAULT false;

-- 3. Adicionar is_perfil_principal em usuario_perfil_vinculos
ALTER TABLE public.usuario_perfil_vinculos
  ADD COLUMN IF NOT EXISTS is_perfil_principal BOOLEAN DEFAULT true;

-- 4. Trigger para manter total_usuarios atualizado em perfis_acesso
CREATE OR REPLACE FUNCTION public.atualizar_total_usuarios_perfil()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.perfis_acesso
    SET total_usuarios = total_usuarios + 1
    WHERE id = NEW.perfil_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.ativo = true AND NEW.ativo = false THEN
    UPDATE public.perfis_acesso
    SET total_usuarios = GREATEST(0, total_usuarios - 1)
    WHERE id = NEW.perfil_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.ativo = false AND NEW.ativo = true THEN
    UPDATE public.perfis_acesso
    SET total_usuarios = total_usuarios + 1
    WHERE id = NEW.perfil_id;
  ELSIF TG_OP = 'DELETE' AND OLD.ativo = true THEN
    UPDATE public.perfis_acesso
    SET total_usuarios = GREATEST(0, total_usuarios - 1)
    WHERE id = OLD.perfil_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_atualizar_total_usuarios_perfil ON public.usuario_perfil_vinculos;
CREATE TRIGGER trg_atualizar_total_usuarios_perfil
AFTER INSERT OR UPDATE OR DELETE ON public.usuario_perfil_vinculos
FOR EACH ROW EXECUTE FUNCTION public.atualizar_total_usuarios_perfil();

-- 5. Tabela de logs de acesso a dados sensíveis
CREATE TABLE IF NOT EXISTS public.perfil_acesso_sensivel_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  usuario_id UUID,
  usuario_nome TEXT,
  modulo TEXT NOT NULL,
  recurso TEXT,
  acao TEXT NOT NULL,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.perfil_acesso_sensivel_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins veem log sensivel do tenant"
ON public.perfil_acesso_sensivel_log FOR SELECT
USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Sistema insere log sensivel"
ON public.perfil_acesso_sensivel_log FOR INSERT
WITH CHECK (tenant_id = public.get_user_tenant_id());
