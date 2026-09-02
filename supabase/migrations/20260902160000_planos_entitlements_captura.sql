-- ============================================================================
-- CAPTURA do subsistema de PLANOS / ASSINATURAS / ENTITLEMENTS
--
-- Este subsistema foi construido direto na producao (pelo Lovable) e nunca
-- entrou no repositorio: nao ha migration nem script de entrega dele. Por isso
-- ele existe na producao e NAO na homologacao/desenvolvimento — impossivel
-- testar planos fora da producao. Esta migration traz a estrutura para o
-- repositorio (regra da casa: objeto criado fora das migrations em producao
-- entra com IF NOT EXISTS; precedentes: feriados, ponto_diario.tipo_dia), para
-- a esteira aplicar no staging/homologacao e os planos poderem ser testados la.
--
-- Estrutura reconstruida a partir do catalogo REAL da producao (extrator
-- somente-leitura docs/script_extrair_ddl_planos.sql). Totalmente idempotente:
-- em banco que ja tem (producao) e um no-op; em banco vazio (staging) cria tudo.
-- Nao insere NENHUM dado — so estrutura.
--
-- Dependencias externas ja presentes no repo: tabela tenants
-- (20260118212400) e funcao current_user_tenant_id (20260514155147).
-- ============================================================================

-- ─────────────────────────────────────────────────────────
-- 1) TABELAS (so colunas; chaves e indices vem depois)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.features (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  key text NOT NULL,
  name text NOT NULL,
  description text,
  kind text NOT NULL,
  unit text,
  category text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.plans (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  tier integer DEFAULT 0 NOT NULL,
  is_public boolean DEFAULT true NOT NULL,
  status text DEFAULT 'active'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.plan_prices (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  plan_id uuid NOT NULL,
  currency text DEFAULT 'BRL'::text NOT NULL,
  amount_cents integer,
  period text DEFAULT 'monthly'::text NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.plan_entitlements (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  plan_id uuid NOT NULL,
  feature_key text NOT NULL,
  is_enabled boolean DEFAULT true NOT NULL,
  limit_value bigint,
  is_unlimited boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  status text DEFAULT 'trialing'::text NOT NULL,
  trial_ends_at timestamp with time zone,
  current_period_start timestamp with time zone DEFAULT date_trunc('month'::text, now()) NOT NULL,
  current_period_end timestamp with time zone DEFAULT (date_trunc('month'::text, now()) + '1 mon'::interval) NOT NULL,
  payment_confirmed boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.subscription_overrides (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL,
  feature_key text NOT NULL,
  is_enabled boolean,
  limit_value bigint,
  is_unlimited boolean,
  reason text,
  expires_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.usage_counters (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL,
  feature_key text NOT NULL,
  period_start date DEFAULT (date_trunc('month'::text, now()))::date NOT NULL,
  used_value bigint DEFAULT 0 NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.entitlement_gated_tables (
  feature_key text NOT NULL,
  table_name text NOT NULL,
  mode text DEFAULT 'full'::text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.entitlement_audit_log (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  actor uuid,
  action text NOT NULL,
  entity text,
  entity_id uuid,
  tenant_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.entitlement_denials_log (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL,
  feature_key text NOT NULL,
  reason text,
  context text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ─────────────────────────────────────────────────────────
-- 2) CHAVES (PK/UNIQUE/FK) — idempotente por lista
-- ─────────────────────────────────────────────────────────
DO $chaves$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      -- PKs e UNIQUEs primeiro (as FKs dependem delas)
      ('features','features_pkey','PRIMARY KEY (id)'),
      ('features','features_key_key','UNIQUE (key)'),
      ('plans','plans_pkey','PRIMARY KEY (id)'),
      ('plans','plans_code_key','UNIQUE (code)'),
      ('plan_prices','plan_prices_pkey','PRIMARY KEY (id)'),
      ('plan_entitlements','plan_entitlements_pkey','PRIMARY KEY (id)'),
      ('plan_entitlements','plan_entitlements_plan_id_feature_key_key','UNIQUE (plan_id, feature_key)'),
      ('subscriptions','subscriptions_pkey','PRIMARY KEY (id)'),
      ('subscriptions','subscriptions_tenant_id_key','UNIQUE (tenant_id)'),
      ('subscription_overrides','subscription_overrides_pkey','PRIMARY KEY (id)'),
      ('usage_counters','usage_counters_pkey','PRIMARY KEY (id)'),
      ('usage_counters','usage_counters_tenant_id_feature_key_period_start_key','UNIQUE (tenant_id, feature_key, period_start)'),
      ('entitlement_gated_tables','entitlement_gated_tables_pkey','PRIMARY KEY (feature_key, table_name)'),
      ('entitlement_audit_log','entitlement_audit_log_pkey','PRIMARY KEY (id)'),
      ('entitlement_denials_log','entitlement_denials_log_pkey','PRIMARY KEY (id)'),
      -- FKs depois
      ('entitlement_gated_tables','entitlement_gated_tables_feature_key_fkey','FOREIGN KEY (feature_key) REFERENCES public.features(key) ON DELETE CASCADE'),
      ('plan_entitlements','plan_entitlements_feature_key_fkey','FOREIGN KEY (feature_key) REFERENCES public.features(key) ON DELETE CASCADE'),
      ('plan_entitlements','plan_entitlements_plan_id_fkey','FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE CASCADE'),
      ('plan_prices','plan_prices_plan_id_fkey','FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE CASCADE'),
      ('subscription_overrides','subscription_overrides_feature_key_fkey','FOREIGN KEY (feature_key) REFERENCES public.features(key) ON DELETE CASCADE'),
      ('subscriptions','fk_subscriptions_tenant','FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE'),
      ('subscriptions','subscriptions_plan_id_fkey','FOREIGN KEY (plan_id) REFERENCES public.plans(id)'),
      ('usage_counters','usage_counters_feature_key_fkey','FOREIGN KEY (feature_key) REFERENCES public.features(key) ON DELETE CASCADE')
    ) AS x(tbl, con, def)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = r.con AND conrelid = ('public.' || r.tbl)::regclass
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I %s', r.tbl, r.con, r.def);
    END IF;
  END LOOP;
END $chaves$;

-- CHECKs (expressoes com aspas: escritas direto, sem string, para nao escapar)
DO $c1$ BEGIN
  ALTER TABLE public.entitlement_gated_tables ADD CONSTRAINT entitlement_gated_tables_mode_check
    CHECK ((mode = ANY (ARRAY['full'::text, 'write_only'::text])));
EXCEPTION WHEN duplicate_object THEN NULL; END $c1$;

DO $c2$ BEGIN
  ALTER TABLE public.features ADD CONSTRAINT features_kind_check
    CHECK ((kind = ANY (ARRAY['boolean'::text, 'limit'::text, 'metered'::text])));
EXCEPTION WHEN duplicate_object THEN NULL; END $c2$;

DO $c3$ BEGIN
  ALTER TABLE public.plan_prices ADD CONSTRAINT plan_prices_period_check
    CHECK ((period = ANY (ARRAY['monthly'::text, 'semiannual'::text, 'yearly'::text, 'custom'::text])));
EXCEPTION WHEN duplicate_object THEN NULL; END $c3$;

DO $c4$ BEGIN
  ALTER TABLE public.plans ADD CONSTRAINT plans_status_check
    CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])));
EXCEPTION WHEN duplicate_object THEN NULL; END $c4$;

DO $c5$ BEGIN
  ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_status_check
    CHECK ((status = ANY (ARRAY['trialing'::text, 'active'::text, 'past_due'::text, 'paused'::text, 'canceled'::text])));
EXCEPTION WHEN duplicate_object THEN NULL; END $c5$;

-- ─────────────────────────────────────────────────────────
-- 3) INDICES
-- ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_denials_tenant   ON public.entitlement_denials_log USING btree (tenant_id, feature_key);
CREATE INDEX IF NOT EXISTS idx_overrides_lookup ON public.subscription_overrides  USING btree (tenant_id, feature_key);
CREATE INDEX IF NOT EXISTS idx_plan_ent_feature ON public.plan_entitlements       USING btree (feature_key);
CREATE INDEX IF NOT EXISTS idx_plan_ent_plan    ON public.plan_entitlements       USING btree (plan_id);
CREATE INDEX IF NOT EXISTS idx_usage_lookup     ON public.usage_counters          USING btree (tenant_id, feature_key, period_start);

-- ─────────────────────────────────────────────────────────
-- 4) RLS (ligar em todas; idempotente)
-- ─────────────────────────────────────────────────────────
ALTER TABLE public.features                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_prices              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_entitlements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_overrides   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_counters           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlement_gated_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlement_audit_log    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlement_denials_log  ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────
-- 5) POLITICAS (as 4 de leitura publica do catalogo de planos)
--    Tabelas sem policy (subscriptions, usage_counters, overrides, gated,
--    audit, denials) ficam com RLS ligada e SEM policy: acesso so via
--    funcoes SECURITY DEFINER — exatamente como na producao.
-- ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS p_features_read  ON public.features;
CREATE POLICY p_features_read  ON public.features          AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS p_plans_read     ON public.plans;
CREATE POLICY p_plans_read     ON public.plans             AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS p_prices_read    ON public.plan_prices;
CREATE POLICY p_prices_read    ON public.plan_prices       AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS p_plan_ent_read  ON public.plan_entitlements;
CREATE POLICY p_plan_ent_read  ON public.plan_entitlements AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);

-- ─────────────────────────────────────────────────────────
-- 6) FUNCOES (verbatim da producao; ordem respeita a dependencia SQL)
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $fn$
begin new.updated_at = now(); return new; end
$fn$;

CREATE OR REPLACE FUNCTION public.entitlement_resolve(p_tenant uuid, p_feature text)
 RETURNS TABLE(available boolean, limit_value bigint, is_unlimited boolean, source text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
declare
  v_plan   uuid;
  v_status text;
  v_base   record;
  v_ov     record;
  v_avail  boolean := false;
  v_limit  bigint  := null;
  v_unl    boolean := false;
  v_src    text    := 'no_subscription';
begin
  select plan_id, status into v_plan, v_status
  from subscriptions where tenant_id = p_tenant;

  if v_plan is null then
    return query select false, null::bigint, false, 'no_subscription';
    return;
  end if;

  select pe.is_enabled, pe.limit_value, pe.is_unlimited into v_base
  from plan_entitlements pe
  where pe.plan_id = v_plan and pe.feature_key = p_feature;

  if found then
    v_avail := coalesce(v_base.is_enabled, false);
    v_limit := v_base.limit_value;
    v_unl   := coalesce(v_base.is_unlimited, false);
    v_src   := 'plan';
  end if;

  select so.is_enabled, so.limit_value, so.is_unlimited into v_ov
  from subscription_overrides so
  where so.tenant_id = p_tenant and so.feature_key = p_feature
    and (so.expires_at is null or so.expires_at > now())
  order by so.created_at desc
  limit 1;

  if found then
    if v_ov.is_enabled   is not null then v_avail := v_ov.is_enabled;   end if;
    if v_ov.limit_value  is not null then v_limit := v_ov.limit_value;  end if;
    if v_ov.is_unlimited is not null then v_unl   := v_ov.is_unlimited; end if;
    v_src := 'override';
  end if;

  if v_status in ('paused','canceled') then
    v_avail := false;
    v_src   := 'subscription_' || v_status;
  end if;

  return query select v_avail, v_limit, v_unl, v_src;
end
$fn$;

CREATE OR REPLACE FUNCTION public.entitlement_can_use(p_tenant uuid, p_feature text, p_current_usage bigint DEFAULT NULL::bigint)
 RETURNS TABLE(allowed boolean, reason text, limit_value bigint, used bigint, remaining bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
declare r record; v_used bigint;
begin
  select * into r from entitlement_resolve(p_tenant, p_feature);

  if not r.available then
    return query select false, r.source, r.limit_value, null::bigint, null::bigint;
    return;
  end if;

  v_used := coalesce(
    p_current_usage,
    (select used_value from usage_counters
      where tenant_id = p_tenant and feature_key = p_feature
        and period_start = date_trunc('month', now())::date),
    0);

  if r.is_unlimited or r.limit_value is null then
    return query select true, 'allowed', r.limit_value, v_used, null::bigint;
    return;
  end if;

  if v_used >= r.limit_value then
    return query select false, 'limit_reached', r.limit_value, v_used, 0::bigint;
    return;
  end if;

  return query select true, 'allowed', r.limit_value, v_used, (r.limit_value - v_used);
end
$fn$;

CREATE OR REPLACE FUNCTION public.tenant_has_feature(p_tenant uuid, p_feature text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
  select coalesce((select available from entitlement_resolve(p_tenant, p_feature)), false);
$fn$;

CREATE OR REPLACE FUNCTION public.log_entitlement_denial(p_tenant uuid, p_feature text, p_context text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
declare r record;
begin
  select * into r from entitlement_can_use(p_tenant, p_feature);
  if not r.allowed then
    insert into entitlement_denials_log(tenant_id, feature_key, reason, context)
    values (p_tenant, p_feature, r.reason, p_context);
  end if;
end
$fn$;

CREATE OR REPLACE FUNCTION public.entitlement_build_statements()
 RETURNS TABLE(table_name text, stmt text)
 LANGUAGE plpgsql
 STABLE
AS $fn$
declare
  r record; v_pol text; v_rls boolean; v_perm int;
begin
  for r in
    select g.feature_key, g.table_name, g.mode
    from public.entitlement_gated_tables g
    order by g.table_name, g.feature_key
  loop
    if not exists (select 1 from information_schema.tables
                   where table_schema='public' and table_name = r.table_name) then
      table_name := r.table_name;
      stmt := format('-- IGNORADO (%s): tabela public.%s nao existe', r.feature_key, r.table_name);
      return next; continue;
    end if;

    select c.relrowsecurity into v_rls
    from pg_class c where c.oid = ('public.'||r.table_name)::regclass;

    select count(*) into v_perm
    from pg_policies
    where schemaname='public' and tablename=r.table_name and permissive='PERMISSIVE';

    if not coalesce(v_rls,false) or v_perm = 0 then
      table_name := r.table_name;
      stmt := format('-- ATENCAO (%s): public.%s esta com RLS desligada ou SEM policy permissiva de isolamento por tenant. NAO gerei restrictive (bloquearia tudo). Garanta o isolamento por tenant primeiro.', r.feature_key, r.table_name);
      return next; continue;
    end if;

    if r.mode = 'full' then
      v_pol := 'ent_' || r.table_name;
      table_name := r.table_name;
      stmt := format('drop policy if exists %I on public.%I;', v_pol, r.table_name);
      return next;
      table_name := r.table_name;
      stmt := format(
        'create policy %I on public.%I as restrictive for all to authenticated '
        || 'using (public.tenant_has_feature(public.current_user_tenant_id(), %L)) '
        || 'with check (public.tenant_has_feature(public.current_user_tenant_id(), %L));',
        v_pol, r.table_name, r.feature_key, r.feature_key);
      return next;
    else
      v_pol := 'ent_ins_' || r.table_name;
      table_name := r.table_name;
      stmt := format('drop policy if exists %I on public.%I;', v_pol, r.table_name); return next;
      table_name := r.table_name;
      stmt := format('create policy %I on public.%I as restrictive for insert to authenticated with check (public.tenant_has_feature(public.current_user_tenant_id(), %L));', v_pol, r.table_name, r.feature_key); return next;
      v_pol := 'ent_upd_' || r.table_name;
      table_name := r.table_name;
      stmt := format('drop policy if exists %I on public.%I;', v_pol, r.table_name); return next;
      table_name := r.table_name;
      stmt := format('create policy %I on public.%I as restrictive for update to authenticated using (public.tenant_has_feature(public.current_user_tenant_id(), %L)) with check (public.tenant_has_feature(public.current_user_tenant_id(), %L));', v_pol, r.table_name, r.feature_key, r.feature_key); return next;
      v_pol := 'ent_del_' || r.table_name;
      table_name := r.table_name;
      stmt := format('drop policy if exists %I on public.%I;', v_pol, r.table_name); return next;
      table_name := r.table_name;
      stmt := format('create policy %I on public.%I as restrictive for delete to authenticated using (public.tenant_has_feature(public.current_user_tenant_id(), %L));', v_pol, r.table_name, r.feature_key); return next;
    end if;
  end loop;
end
$fn$;

CREATE OR REPLACE FUNCTION public.entitlement_apply_policies()
 RETURNS TABLE(table_name text, stmt text, status text)
 LANGUAGE plpgsql
AS $fn$
declare r record;
begin
  for r in select * from public.entitlement_build_statements() loop
    if left(r.stmt,2) = '--' then
      table_name := r.table_name; stmt := r.stmt; status := 'pulado'; return next; continue;
    end if;
    begin
      execute r.stmt;
      table_name := r.table_name; stmt := r.stmt; status := 'ok'; return next;
    exception when others then
      table_name := r.table_name; stmt := r.stmt; status := 'ERRO: '||sqlerrm; return next;
    end;
  end loop;
end
$fn$;

-- ─────────────────────────────────────────────────────────
-- 7) GATILHO (updated_at nas assinaturas)
-- ─────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_subscriptions_updated ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_updated
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
