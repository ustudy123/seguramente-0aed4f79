-- =====================================================================
-- YOUREYES · ENTITLEMENTS · SCRIPT COMPLETO (motor + P1 + P3)
--
-- Traz UM ambiente para o estado atual do repositorio, de uma vez:
--   1) MOTOR: catalogo (planos/features/precos/matriz), contrato por tenant,
--      consumo/auditoria, funcoes de resolucao, RLS do catalogo, FK e
--      atribuicao de assinatura 'tester' a todos os tenants, gerador.
--   2) P1: superadmin_set_tenant_plan + superadmin_tenants_list (plano_atual).
--   3) P3 (visual): entitlement_my_features().
--
-- IDEMPOTENTE: pode rodar num ambiente vazio, parcial ou ja completo, sem
-- duplicar nem quebrar. NAO liga bloqueio de dado; NAO mexe no enum
-- tenant_plan. Use este arquivo para colocar HOMOLOGACAO (e PRODUCAO) em dia.
--
-- Roda numa unica transacao (comportamento do SQL Editor). Conferencia unica
-- ao final.
-- =====================================================================

-- =====================================================================
-- YOUREYES · SCRIPT DE ENTREGA · MOTOR DE ENTITLEMENTS
-- Cole ESTE arquivo inteiro no SQL Editor do projeto de PRODUCAO.
--
-- O que faz: instala o motor de planos/entitlements (catalogo + contrato
-- por tenant + consumo/auditoria + funcoes de resolucao + RLS do catalogo
-- + seed dos 7 planos e 26 features + FK + atribuicao de assinatura
-- 'tester' a TODOS os tenants + infraestrutura do gerador de enforcement).
--
-- Seguro por construcao:
--   * Idempotente: rodar duas vezes nao quebra nem duplica.
--   * So CRIA objeto novo e SEED do proprio motor; nao ALTERA nem APAGA
--     nenhum dado de cliente existente (por isso nao ha tabela de backup).
--   * NAO liga NENHUMA policy de bloqueio (enforcement) e NAO toca no enum
--     public.tenant_plan nem em tenants.plano.
--   * O unico efeito sobre linhas existentes: cria uma assinatura 'tester'
--     (acesso total) para cada tenant que ainda nao tenha uma -> nao bloqueia
--     ninguem (todos os clientes atuais sao testers sob contrato).
--
-- Roda numa unica transacao (comportamento do SQL Editor). Sem RAISE
-- EXCEPTION solto, sem tabelas temporarias entre statements.
-- Conferencia final ao fim (o editor mostra so o ultimo resultado).
-- =====================================================================

set lock_timeout = '10s';

-- ---------------------------------------------------------------------
-- 02 · CATALOGO
-- ---------------------------------------------------------------------
create table if not exists public.plans (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  description text,
  tier        int  not null default 0,
  is_public   boolean not null default true,
  status      text not null default 'active' check (status in ('active','inactive')),
  created_at  timestamptz not null default now()
);

create table if not exists public.plan_prices (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null references public.plans(id) on delete cascade,
  currency     text not null default 'BRL',
  amount_cents integer,
  period       text not null default 'monthly'
               check (period in ('monthly','semiannual','yearly','custom')),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists public.features (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  name        text not null,
  description text,
  kind        text not null check (kind in ('boolean','limit','metered')),
  unit        text,
  category    text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.plan_entitlements (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null references public.plans(id) on delete cascade,
  feature_key  text not null references public.features(key) on delete cascade,
  is_enabled   boolean not null default true,
  limit_value  bigint,
  is_unlimited boolean not null default false,
  unique (plan_id, feature_key)
);

-- ---------------------------------------------------------------------
-- 03 · CONTRATO POR TENANT
-- ---------------------------------------------------------------------
create table if not exists public.subscriptions (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null unique,
  plan_id              uuid not null references public.plans(id),
  status               text not null default 'trialing'
                       check (status in ('trialing','active','past_due','paused','canceled')),
  trial_ends_at        timestamptz,
  current_period_start timestamptz not null default date_trunc('month', now()),
  current_period_end   timestamptz not null default (date_trunc('month', now()) + interval '1 month'),
  payment_confirmed    boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists public.subscription_overrides (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null,
  feature_key  text not null references public.features(key) on delete cascade,
  is_enabled   boolean,
  limit_value  bigint,
  is_unlimited boolean,
  reason       text,
  expires_at   timestamptz,
  created_by   uuid,
  created_at   timestamptz not null default now()
);
create index if not exists idx_overrides_lookup
  on public.subscription_overrides (tenant_id, feature_key);

-- ---------------------------------------------------------------------
-- 04 · CONSUMO / AUDITORIA
-- ---------------------------------------------------------------------
create table if not exists public.usage_counters (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null,
  feature_key  text not null references public.features(key) on delete cascade,
  period_start date not null default date_trunc('month', now())::date,
  used_value   bigint not null default 0,
  updated_at   timestamptz not null default now(),
  unique (tenant_id, feature_key, period_start)
);

create table if not exists public.entitlement_audit_log (
  id         uuid primary key default gen_random_uuid(),
  actor      uuid,
  action     text not null,
  entity     text,
  entity_id  uuid,
  tenant_id  uuid,
  before     jsonb,
  after      jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.entitlement_denials_log (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null,
  feature_key text not null,
  reason      text,
  context     text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 05 · INDICES + updated_at
-- ---------------------------------------------------------------------
create index if not exists idx_plan_ent_plan   on public.plan_entitlements (plan_id);
create index if not exists idx_plan_ent_feature on public.plan_entitlements (feature_key);
create index if not exists idx_usage_lookup     on public.usage_counters (tenant_id, feature_key, period_start);
create index if not exists idx_denials_tenant   on public.entitlement_denials_log (tenant_id, feature_key);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $set_updated_at$
begin new.updated_at = now(); return new; end $set_updated_at$;

drop trigger if exists trg_subscriptions_updated on public.subscriptions;
create trigger trg_subscriptions_updated
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 06 · FUNCOES DE RESOLUCAO (fonte unica da verdade)
--   Nota: dentro de entitlement_resolve as colunas de plan_entitlements /
--   subscription_overrides sao qualificadas por alias (pe. / so.) porque os
--   nomes limit_value/is_unlimited coincidem com colunas de saida da funcao;
--   sem o alias o Postgres acusa ambiguidade e a funcao quebra em execucao.
-- ---------------------------------------------------------------------
create or replace function public.entitlement_resolve(p_tenant uuid, p_feature text)
returns table(available boolean, limit_value bigint, is_unlimited boolean, source text)
language plpgsql stable security definer set search_path = public as $entitlement_resolve$
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
end $entitlement_resolve$;

create or replace function public.tenant_has_feature(p_tenant uuid, p_feature text)
returns boolean language sql stable security definer set search_path = public as $tenant_has_feature$
  select coalesce((select available from entitlement_resolve(p_tenant, p_feature)), false);
$tenant_has_feature$;

create or replace function public.entitlement_can_use(
  p_tenant uuid, p_feature text, p_current_usage bigint default null)
returns table(allowed boolean, reason text, limit_value bigint, used bigint, remaining bigint)
language plpgsql stable security definer set search_path = public as $entitlement_can_use$
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
end $entitlement_can_use$;

create or replace function public.log_entitlement_denial(
  p_tenant uuid, p_feature text, p_context text default null)
returns void language plpgsql security definer set search_path = public as $log_entitlement_denial$
declare r record;
begin
  select * into r from entitlement_can_use(p_tenant, p_feature);
  if not r.allowed then
    insert into entitlement_denials_log(tenant_id, feature_key, reason, context)
    values (p_tenant, p_feature, r.reason, p_context);
  end if;
end $log_entitlement_denial$;

-- ---------------------------------------------------------------------
-- 07 · RLS (catalogo publico; contrato/consumo sem policy permissiva)
-- ---------------------------------------------------------------------
alter table public.plans                   enable row level security;
alter table public.plan_prices             enable row level security;
alter table public.features                enable row level security;
alter table public.plan_entitlements       enable row level security;
alter table public.subscriptions           enable row level security;
alter table public.subscription_overrides  enable row level security;
alter table public.usage_counters          enable row level security;
alter table public.entitlement_audit_log   enable row level security;
alter table public.entitlement_denials_log enable row level security;

drop policy if exists p_plans_read on public.plans;
create policy p_plans_read on public.plans for select to anon, authenticated using (true);

drop policy if exists p_prices_read on public.plan_prices;
create policy p_prices_read on public.plan_prices for select to anon, authenticated using (true);

drop policy if exists p_features_read on public.features;
create policy p_features_read on public.features for select to anon, authenticated using (true);

drop policy if exists p_plan_ent_read on public.plan_entitlements;
create policy p_plan_ent_read on public.plan_entitlements for select to anon, authenticated using (true);

grant execute on function public.entitlement_resolve(uuid,text)        to anon, authenticated;
grant execute on function public.tenant_has_feature(uuid,text)         to anon, authenticated;
grant execute on function public.entitlement_can_use(uuid,text,bigint) to anon, authenticated;
grant execute on function public.log_entitlement_denial(uuid,text,text) to authenticated;

-- ---------------------------------------------------------------------
-- 08 · SEED (7 planos + 26 features + matriz + limite de vidas)
-- ---------------------------------------------------------------------
insert into public.plans (code, name, description, tier, is_public) values
  ('starter',      'Starter',      'Para quem esta comecando a organizar a operacao.',        1, true),
  ('essential',    'Essential',    'Para quem ja tem processo e precisa colocar no ar.',       2, true),
  ('performance',  'Performance',  'Para quem ja tem processo e precisa medir.',               3, true),
  ('governanca',   'Governanca',   'Para quem opera em multiplas unidades e precisa integrar.',4, true),
  ('enterprise',   'Enterprise',   'Para grandes operacoes com exigencia maxima de seguranca.',5, true),
  ('early_adopter','Early Adopter','Plano interno gratuito (acesso total).',                  99, false),
  ('tester',       'Tester',       'Plano interno de teste (acesso total).',                  99, false)
on conflict (code) do nothing;

insert into public.plan_prices (plan_id, amount_cents, period)
select p.id, v.cents, 'monthly'
from (values
  ('starter',      19700),
  ('essential',    39700),
  ('performance',  79700),
  ('governanca',  179700),
  ('enterprise',    null::int)
) as v(code, cents)
join public.plans p on p.code = v.code
where not exists (
  select 1 from public.plan_prices pp
  where pp.plan_id = p.id and pp.period = 'monthly'
);

insert into public.features (key, name, kind, unit, category) values
  ('mod.estrutura',        'Estrutura organizacional',                 'boolean', null, 'base'),
  ('mod.nr1',              'NR-1 & visao psicossocial',                'boolean', null, 'sst'),
  ('mod.ponto',            'Ponto & Jornada',                          'boolean', null, 'jornada'),
  ('mod.ferias',           'Ferias + Atestados',                       'boolean', null, 'jornada'),
  ('mod.onboarding',       'Onboarding',                               'boolean', null, 'pessoas'),
  ('mod.gro_pgr',          'GRO + Inventario PGR',                     'boolean', null, 'sst'),
  ('mod.psicossocial',     'Campanhas psicossociais + resultados',     'boolean', null, 'sst'),
  ('mod.epi_ergo',         'EPIs + Ergonomia',                         'boolean', null, 'sst'),
  ('mod.analise_jornada',  'Analise de Jornada',                       'boolean', null, 'jornada'),
  ('mod.beneficios',       'Beneficios + Documentos + Hub Contabil',   'boolean', null, 'gestao'),
  ('mod.metas',            'Metas + Plano de Acao (5W2H)',             'boolean', null, 'gestao'),
  ('mod.trilhas',          'Trilhas + Aprendizado & Competencias',     'boolean', null, 'pessoas'),
  ('mod.cultura',          'Feedback, Ouvidoria & Cultura',            'boolean', null, 'pessoas'),
  ('mod.contratos_exp',    'Contratos de Experiencia',                 'boolean', null, 'pessoas'),
  ('mod.sso',              'SSO + auditoria de acessos',               'boolean', null, 'integracao'),
  ('mod.kpis',             'KPIs operacionais avancados',              'boolean', null, 'gestao'),
  ('mod.integracao',       'Integracao ERP (TOTVS/SAP/Senior/Gupy)',   'boolean', null, 'integracao'),
  ('attr.sla',             'SLA 99,5% garantido',                      'boolean', null, 'servico'),
  ('serv.csm',             'CSM dedicado',                             'boolean', null, 'servico'),
  ('infra.banco_dedicado', 'Banco de dados dedicado',                  'boolean', null, 'infra'),
  ('mod.ia_custom',        'IA customizada por setor',                 'boolean', null, 'ia'),
  ('mod.api_webhooks',     'API dedicada + webhooks',                  'boolean', null, 'integracao'),
  ('serv.juridico',        'Assessoria juridico-trabalhista',          'boolean', null, 'servico'),
  ('serv.dpo',             'DPO + LGPD avancado',                      'boolean', null, 'servico'),
  ('serv.workshop_nr1',    'Workshop mensal NR-1',                     'boolean', null, 'servico'),
  ('limit.vidas',          'Colaboradores / vidas ativas',            'limit',   'vidas', 'limite')
on conflict (key) do nothing;

with feat(key, min_tier) as (values
  ('mod.estrutura',1),('mod.nr1',1),('mod.ponto',1),('mod.ferias',1),('mod.onboarding',1),
  ('mod.gro_pgr',2),('mod.psicossocial',2),('mod.epi_ergo',2),('mod.analise_jornada',2),
  ('mod.beneficios',3),('mod.metas',3),('mod.trilhas',3),('mod.cultura',3),('mod.contratos_exp',3),
  ('mod.sso',4),('mod.kpis',4),('mod.integracao',4),('attr.sla',4),('serv.csm',4),
  ('infra.banco_dedicado',5),('mod.ia_custom',5),('mod.api_webhooks',5),
  ('serv.juridico',5),('serv.dpo',5),('serv.workshop_nr1',5)
)
insert into public.plan_entitlements (plan_id, feature_key, is_enabled)
select p.id, f.key, true
from public.plans p
join feat f on p.tier >= f.min_tier
on conflict (plan_id, feature_key) do nothing;

insert into public.plan_entitlements (plan_id, feature_key, limit_value, is_unlimited)
select p.id, 'limit.vidas',
  case p.code
    when 'starter'     then 20
    when 'essential'   then 80
    when 'performance' then 200
    when 'governanca'  then 500
    else null
  end,
  (p.code in ('enterprise','early_adopter','tester'))
from public.plans p
on conflict (plan_id, feature_key)
do update set limit_value = excluded.limit_value,
              is_unlimited = excluded.is_unlimited;

-- ---------------------------------------------------------------------
-- 09 · FK + atribuicao de assinatura 'tester' a todos os tenants
-- ---------------------------------------------------------------------
alter table public.subscriptions
  drop constraint if exists fk_subscriptions_tenant;
alter table public.subscriptions
  add constraint fk_subscriptions_tenant
  foreign key (tenant_id) references public.tenants(id) on delete cascade;

insert into public.subscriptions
  (tenant_id, plan_id, status, trial_ends_at, current_period_start, current_period_end)
select t.id,
       (select id from public.plans where code = 'tester'),
       'trialing',
       now() + interval '30 days',
       date_trunc('month', now()),
       date_trunc('month', now()) + interval '1 month'
from public.tenants t
where not exists (
  select 1 from public.subscriptions s where s.tenant_id = t.id
);

-- ---------------------------------------------------------------------
-- 10 · INFRAESTRUTURA DO GERADOR DE ENFORCEMENT (mapa nasce vazio)
--   NAO aplica nenhuma policy de bloqueio. Enforcement e ligado depois,
--   modulo a modulo, em fail-open (P3).
-- ---------------------------------------------------------------------
create table if not exists public.entitlement_gated_tables (
  feature_key text not null references public.features(key) on delete cascade,
  table_name  text not null,
  mode        text not null default 'full' check (mode in ('full','write_only')),
  primary key (feature_key, table_name)
);

create or replace function public.entitlement_build_statements()
returns table(table_name text, stmt text)
language plpgsql stable as $entitlement_build_statements$
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
end $entitlement_build_statements$;

create or replace function public.entitlement_apply_policies()
returns table(table_name text, stmt text, status text)
language plpgsql as $entitlement_apply_policies$
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
end $entitlement_apply_policies$;


-- =====================================================================
-- P1 · SCRIPT DE ENTREGA · PLANO DA EMPRESA VIA MOTOR
-- Cole no SQL Editor de cada ambiente (Desenvolvimento -> Homologacao ->
-- Producao), nesta ordem, so avancando apos o anterior dar tudo OK.
--
-- O que faz: painel Super Admin passa a gravar o plano da empresa no motor
-- (public.subscriptions) e a listagem passa a mostrar o plano vigente.
-- NAO mexe no enum tenant_plan; NAO liga bloqueio nenhum. Idempotente.
-- =====================================================================

create or replace function public.superadmin_set_tenant_plan(
  _tenant_id uuid, _plan_code text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $superadmin_set_tenant_plan$
declare v_plan_id uuid;
begin
  if not public.is_superadmin(auth.uid()) then
    raise exception 'Acesso negado';
  end if;

  select id into v_plan_id from public.plans where code = _plan_code;
  if v_plan_id is null then
    raise exception 'Plano inexistente: %', _plan_code;
  end if;

  insert into public.subscriptions (tenant_id, plan_id)
  values (_tenant_id, v_plan_id)
  on conflict (tenant_id) do update set plan_id = excluded.plan_id;

  return _plan_code;
end $superadmin_set_tenant_plan$;

grant execute on function public.superadmin_set_tenant_plan(uuid, text) to authenticated;

create or replace function public.superadmin_tenants_list()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $superadmin_tenants_list$
declare result jsonb;
begin
  if not public.is_superadmin(auth.uid()) then
    raise exception 'Acesso negado';
  end if;

  select jsonb_agg(row_to_json(x) order by x.created_at desc) into result
  from (
    select
      t.*,
      ec.email,
      ec.telefone,
      ec.cnpj,
      (select p.code
         from subscriptions s
         join plans p on p.id = s.plan_id
        where s.tenant_id = t.id) as plano_atual,
      (select count(*) from profiles where tenant_id = t.id) as total_usuarios,
      (select count(*) from admissoes where tenant_id = t.id and status = 'concluido') as total_colaboradores
    from tenants t
    left join lateral (
      select email, telefone, cnpj
      from empresa_cadastro
      where tenant_id = t.id and tipo_unidade = 'matriz'
      order by created_at desc
      limit 1
    ) ec on true
  ) x;

  return coalesce(result, '[]'::jsonb);
end $superadmin_tenants_list$;


-- =====================================================================
-- P3 (camada visual) · SCRIPT DE ENTREGA · entitlement_my_features()
-- Cole no SQL Editor de cada ambiente (Desenvolvimento -> Homologação ->
-- Produção), avançando só após o anterior dar OK.
--
-- Cria a função somente-leitura que o menu usa para saber quais módulos o
-- plano da empresa logada libera. NÃO liga bloqueio no banco. Idempotente.
-- =====================================================================

create or replace function public.entitlement_my_features()
returns setof text
language sql
stable
security definer
set search_path = public
as $entitlement_my_features$
  select f.key
  from public.features f
  where f.is_active
    and f.kind = 'boolean'
    and public.tenant_has_feature(public.current_user_tenant_id(), f.key);
$entitlement_my_features$;

grant execute on function public.entitlement_my_features() to authenticated;

-- =====================================================================
-- CONFERENCIA FINAL (o editor mostra so este ultimo resultado)
--   Esperado: todas as linhas OK.
-- =====================================================================
with chk(ordem, item, esperado, obtido) as (
  select 1, 'motor: planos', '7', (select count(*)::text from public.plans)
  union all
  select 2, 'motor: features', '26', (select count(*)::text from public.features)
  union all
  select 3, 'motor: matriz starter/essential/performance/governanca/enterprise',
         '6/10/15/20/26',
         (select string_agg(fl::text, '/' order by tier)
          from (
            select min(p.tier) tier, count(*) filter (where pe.is_enabled) fl
            from public.plans p left join public.plan_entitlements pe on pe.plan_id=p.id
            where p.code in ('starter','essential','performance','governanca','enterprise')
            group by p.code
          ) z)
  union all
  select 4, 'motor: tenants sem assinatura (deve ser 0)', '0',
         (select count(*)::text from public.tenants t
          where not exists (select 1 from public.subscriptions s where s.tenant_id=t.id))
  union all
  select 5, 'P1: funcao superadmin_set_tenant_plan', '1',
         (select count(*)::text from pg_proc where proname='superadmin_set_tenant_plan')
  union all
  select 6, 'P1: superadmin_tenants_list expoe plano_atual', 'sim',
         (select case when exists (select 1 from pg_proc
            where proname='superadmin_tenants_list'
              and pg_get_functiondef(oid) like '%plano_atual%') then 'sim' else 'nao' end)
  union all
  select 7, 'P3: funcao entitlement_my_features', '1',
         (select count(*)::text from pg_proc where proname='entitlement_my_features')
  union all
  select 8, 'enforcement ligado (deve ser 0 agora)', '0',
         (select count(*)::text from public.entitlement_gated_tables)
)
select item, esperado, obtido,
       case when esperado = obtido then 'OK' else 'CONFERIR' end as status
from chk order by ordem;
