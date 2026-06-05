-- 1. Criar Perfis GAF se não existirem
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gaf_perfil') THEN
        CREATE TYPE public.gaf_perfil AS ENUM (
            'admin', 'rh', 'dp', 'sst', 'medicina', 'juridico', 'gestor', 'executivo'
        );
    END IF;
END $$;

-- 2. Tabela de mapeamento de perfis por usuário
CREATE TABLE IF NOT EXISTS public.gaf_usuarios_perfis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    perfil public.gaf_perfil NOT NULL,
    pode_ver_cid BOOLEAN DEFAULT FALSE,
    pode_ver_anexos_medicos BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id, tenant_id, perfil)
);

-- 3. Tabela de Auditoria MOD-GAF
CREATE TABLE IF NOT EXISTS public.gaf_auditoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    acao TEXT NOT NULL, -- 'criacao', 'alteracao', 'visualizacao', 'exclusao'
    entidade_tipo TEXT NOT NULL, -- 'afastamento', 'cid', 'anexo', 'restricao'
    entidade_id UUID,
    valor_anterior JSONB,
    valor_novo JSONB,
    metadados JSONB, -- IP, Browser, etc
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Função helper para verificar acesso a dados sensíveis (CID/Anexos)
CREATE OR REPLACE FUNCTION public.gaf_tem_acesso_sensivel(p_user_id UUID, p_tenant_id UUID, p_tipo_dado TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_has_access BOOLEAN;
BEGIN
    -- Superadmin ou Admin do sistema tem acesso total
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = p_user_id 
        AND role IN ('admin', 'owner', 'superadmin')
    ) INTO v_is_admin;

    IF v_is_admin THEN
        RETURN TRUE;
    END IF;

    -- Verificar perfis específicos GAF e permissões granulares
    SELECT 
        CASE 
            WHEN perfil = 'medicina' THEN TRUE
            WHEN p_tipo_dado = 'cid' THEN pode_ver_cid 
            WHEN p_tipo_dado = 'anexo' THEN pode_ver_anexos_medicos 
            ELSE FALSE 
        END
    INTO v_has_access
    FROM public.gaf_usuarios_perfis 
    WHERE user_id = p_user_id AND tenant_id = p_tenant_id
    LIMIT 1;

    RETURN COALESCE(v_has_access, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger de Auditoria Automática para Afastamentos
CREATE OR REPLACE FUNCTION public.trg_gaf_auditoria_afastamentos()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.gaf_auditoria (tenant_id, user_id, acao, entidade_tipo, entidade_id, valor_novo)
        VALUES (NEW.tenant_id, auth.uid(), 'criacao', 'afastamento', NEW.id, to_jsonb(NEW));
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO public.gaf_auditoria (tenant_id, user_id, acao, entidade_tipo, entidade_id, valor_anterior, valor_novo)
        VALUES (NEW.tenant_id, auth.uid(), 'alteracao', 'afastamento', NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO public.gaf_auditoria (tenant_id, user_id, acao, entidade_tipo, entidade_id, valor_anterior)
        VALUES (OLD.tenant_id, auth.uid(), 'exclusao', 'afastamento', OLD.id, to_jsonb(OLD));
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_gaf_auditoria_afastamentos ON public.afastamentos;
CREATE TRIGGER trg_gaf_auditoria_afastamentos
AFTER INSERT OR UPDATE OR DELETE ON public.afastamentos
FOR EACH ROW EXECUTE FUNCTION public.trg_gaf_auditoria_afastamentos();

-- 6. Habilitar RLS e criar políticas
ALTER TABLE public.gaf_usuarios_perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gaf_auditoria ENABLE ROW LEVEL SECURITY;

-- Políticas
DROP POLICY IF EXISTS "Tenant access profiles" ON public.gaf_usuarios_perfis;
CREATE POLICY "Tenant access profiles" ON public.gaf_usuarios_perfis 
FOR ALL USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant access audit" ON public.gaf_auditoria;
CREATE POLICY "Tenant access audit" ON public.gaf_auditoria 
FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

-- 7. Grants
GRANT ALL ON public.gaf_usuarios_perfis TO authenticated, service_role;
GRANT SELECT, INSERT ON public.gaf_auditoria TO authenticated, service_role;
