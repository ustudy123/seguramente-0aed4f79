
-- ─── Enums ────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.usuario_status AS ENUM (
    'rascunho','pendente_convite','convite_enviado','aguardando_ativacao',
    'ativo','bloqueado','suspenso','inativo','arquivado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.vinculo_status AS ENUM (
    'ativo','pendente','suspenso','revogado','encerrado','expirado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.usuario_tipo AS ENUM (
    'administrador','rh_dp','gestor','lideranca','tecnico_seguranca',
    'saude_ocupacional','clinica_parceira','consultor_externo',
    'prestador_terceiro','auditor','implantador','suporte_autorizado','corporativo_multiempresa'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.qualidade_score AS ENUM ('completo','suficiente','incompleto','inconsistente');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Tabela principal de usuários ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.usuarios_base (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  auth_user_id          UUID UNIQUE,
  nome_completo         TEXT NOT NULL,
  nome_social           TEXT,
  cpf                   TEXT,
  email_principal       TEXT NOT NULL,
  telefone_principal    TEXT,
  foto_url              TEXT,
  data_nascimento       DATE,
  cargo_funcao          TEXT,
  matricula             TEXT,
  idioma                TEXT DEFAULT 'pt-BR',
  observacoes           TEXT,
  origem_cadastro       TEXT DEFAULT 'manual',
  tipo_usuario          public.usuario_tipo DEFAULT 'gestor',
  status                public.usuario_status NOT NULL DEFAULT 'pendente_convite',
  convite_token         TEXT UNIQUE,
  convite_enviado_em    TIMESTAMPTZ,
  convite_expira_em     TIMESTAMPTZ,
  convite_aceito_em     TIMESTAMPTZ,
  email_validado        BOOLEAN DEFAULT FALSE,
  telefone_validado     BOOLEAN DEFAULT FALSE,
  primeiro_acesso_em    TIMESTAMPTZ,
  ultimo_acesso_em      TIMESTAMPTZ,
  autenticacao_2fa      BOOLEAN DEFAULT FALSE,
  qualidade_score       public.qualidade_score DEFAULT 'incompleto',
  qualidade_pct         SMALLINT DEFAULT 0,
  sugestao_tipo_ia      public.usuario_tipo,
  alerta_duplicidade    BOOLEAN DEFAULT FALSE,
  duplicidade_nivel     TEXT,
  criado_por_user_id    UUID,
  criado_por_nome       TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS usuarios_base_cpf_tenant_uidx 
  ON public.usuarios_base(tenant_id, cpf) WHERE cpf IS NOT NULL;

-- ─── Vínculos usuário–empresa ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.usuario_vinculos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  usuario_id            UUID NOT NULL REFERENCES public.usuarios_base(id) ON DELETE CASCADE,
  empresa_id            UUID NOT NULL REFERENCES public.empresa_cadastro(id) ON DELETE RESTRICT,
  tipo_vinculo          public.usuario_tipo NOT NULL DEFAULT 'gestor',
  contexto_operacional  TEXT,
  unidade_filial        TEXT,
  data_inicio           DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim              DATE,
  status                public.vinculo_status NOT NULL DEFAULT 'ativo',
  aprovado_por_user_id  UUID,
  aprovado_por_nome     TEXT,
  observacoes           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS usuario_vinculos_usuario_idx ON public.usuario_vinculos(usuario_id);
CREATE INDEX IF NOT EXISTS usuario_vinculos_empresa_idx ON public.usuario_vinculos(empresa_id);
CREATE INDEX IF NOT EXISTS usuario_vinculos_tenant_idx  ON public.usuario_vinculos(tenant_id);

-- ─── Audit log ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.usuario_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  usuario_id      UUID,
  vinculo_id      UUID,
  acao            TEXT NOT NULL,
  objeto          TEXT NOT NULL,
  valor_anterior  JSONB,
  valor_novo      JSONB,
  justificativa   TEXT,
  executor_id     UUID,
  executor_nome   TEXT,
  origem          TEXT DEFAULT 'manual',
  ip_address      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS usuario_audit_usuario_idx  ON public.usuario_audit_log(usuario_id);
CREATE INDEX IF NOT EXISTS usuario_audit_tenant_idx   ON public.usuario_audit_log(tenant_id);

-- ─── Triggers updated_at ─────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE OR REPLACE TRIGGER usuarios_base_updated_at
    BEFORE UPDATE ON public.usuarios_base
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  CREATE OR REPLACE TRIGGER usuario_vinculos_updated_at
    BEFORE UPDATE ON public.usuario_vinculos
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.usuarios_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_vinculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_audit_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_usuarios_select" ON public.usuarios_base;
  DROP POLICY IF EXISTS "tenant_usuarios_insert" ON public.usuarios_base;
  DROP POLICY IF EXISTS "tenant_usuarios_update" ON public.usuarios_base;
  DROP POLICY IF EXISTS "tenant_vinculos_select" ON public.usuario_vinculos;
  DROP POLICY IF EXISTS "tenant_vinculos_insert" ON public.usuario_vinculos;
  DROP POLICY IF EXISTS "tenant_vinculos_update" ON public.usuario_vinculos;
  DROP POLICY IF EXISTS "tenant_audit_select" ON public.usuario_audit_log;
  DROP POLICY IF EXISTS "tenant_audit_insert" ON public.usuario_audit_log;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE POLICY "tenant_usuarios_select" ON public.usuarios_base
  FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "tenant_usuarios_insert" ON public.usuarios_base
  FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "tenant_usuarios_update" ON public.usuarios_base
  FOR UPDATE TO authenticated USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "tenant_vinculos_select" ON public.usuario_vinculos
  FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "tenant_vinculos_insert" ON public.usuario_vinculos
  FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "tenant_vinculos_update" ON public.usuario_vinculos
  FOR UPDATE TO authenticated USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "tenant_audit_select" ON public.usuario_audit_log
  FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "tenant_audit_insert" ON public.usuario_audit_log
  FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant_id());
