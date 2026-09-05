-- =====================================================================
-- COBRANCA RECORRENTE (Mercado Pago) · FASE 3
--
-- Transforma a cobranca de "avulsa" (pagamento unico) em ASSINATURA
-- recorrente de verdade:
--   - PLANO   -> uma assinatura no MP no ciclo escolhido (1/3/6/12 meses),
--                cobrando o total do ciclo e renovando sozinha.
--   - ADD-ON  -> uma assinatura MENSAL separada no MP por add-on. Ao
--                contratar no meio do mes, cobra proporcional aos dias que
--                faltam ate o fim do mes; a partir do mes seguinte, mensal
--                cheio. O modulo/vidas so libera quando o pagamento e
--                confirmado (webhook).
--
-- So schema + funcoes. A conversa com o Mercado Pago vive nas Edge
-- Functions (que tem o token). Aditivo e idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. assinaturas: marca o tipo e guarda o id da assinatura no MP (plano)
-- ---------------------------------------------------------------------
alter table public.assinaturas
  add column if not exists mp_preapproval_id text,
  add column if not exists subscription_type text not null default 'one_time';

do $ck_assin$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'assinaturas_subscription_type_chk'
  ) then
    alter table public.assinaturas
      add constraint assinaturas_subscription_type_chk
      check (subscription_type in ('one_time', 'recurring'));
  end if;
exception when others then
  raise notice 'constraint assinaturas_subscription_type_chk: %', sqlerrm;
end $ck_assin$;

create index if not exists idx_assinaturas_mp_preapproval
  on public.assinaturas (mp_preapproval_id) where mp_preapproval_id is not null;

-- ---------------------------------------------------------------------
-- 2. subscription_addons: cada add-on vira uma assinatura mensal no MP
-- ---------------------------------------------------------------------
-- Semantica de 'ativo' passa a ser: cobranca confirmada e efeito liberado.
-- Uma contratacao nasce PENDENTE (ativo=false, mp_status='pending') e so
-- vira ativa quando o webhook confirma o pagamento proporcional.
alter table public.subscription_addons
  add column if not exists mp_preapproval_id      text,
  add column if not exists mp_status              text not null default 'interno',
  add column if not exists proporcional_cents     integer,
  add column if not exists proporcional_payment_id text,
  add column if not exists recorrencia_inicio     date,
  add column if not exists confirmado_em          timestamptz;

comment on column public.subscription_addons.mp_status is
  'interno (sem cobranca MP, conciliado pelo financeiro) | pending | authorized | paused | cancelled';

create index if not exists idx_sub_addons_mp_preapproval
  on public.subscription_addons (mp_preapproval_id) where mp_preapproval_id is not null;
create index if not exists idx_sub_addons_pendentes
  on public.subscription_addons (tenant_id, feature_key) where mp_status = 'pending';

-- ---------------------------------------------------------------------
-- 3. pagamentos_recorrentes: historico de cada cobranca (plano ou add-on)
-- ---------------------------------------------------------------------
create table if not exists public.pagamentos_recorrentes (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid,
  origem              text not null check (origem in ('plano','addon')),
  mp_preapproval_id   text,
  assinatura_id       uuid references public.assinaturas(id),
  subscription_addon_id uuid references public.subscription_addons(id),
  payment_id          text not null unique,
  status              text not null,
  valor               numeric(12,2) not null default 0,
  competencia         date,                 -- mes de referencia (YYYY-MM-01)
  raw_payload         jsonb,
  created_at          timestamptz not null default now()
);
create index if not exists idx_pag_rec_tenant on public.pagamentos_recorrentes (tenant_id);
create index if not exists idx_pag_rec_preapproval on public.pagamentos_recorrentes (mp_preapproval_id);

alter table public.pagamentos_recorrentes enable row level security;
grant all on public.pagamentos_recorrentes to service_role;

-- Leitura pelo proprio tenant (para uma futura tela de historico).
do $pol_pag$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'pagamentos_recorrentes'
      and policyname = 'pag_rec_leitura_proprio_tenant'
  ) then
    create policy pag_rec_leitura_proprio_tenant
      on public.pagamentos_recorrentes for select
      using (tenant_id = public.current_user_tenant_id());
  end if;
exception when others then
  raise notice 'policy pag_rec_leitura_proprio_tenant: %', sqlerrm;
end $pol_pag$;

-- ---------------------------------------------------------------------
-- 4. Helper: valor proporcional dos dias restantes do mes
--    (do dia SEGUINTE a _ref ate o ultimo dia do mes, inclusive)
-- ---------------------------------------------------------------------
create or replace function public.addon_proporcional_cents(
  _unit_price_cents integer,
  _quantity integer default 1,
  _ref date default current_date
)
returns integer
language plpgsql
immutable
as $fn_prop$
declare
  v_fim_mes    date := (date_trunc('month', _ref) + interval '1 month - 1 day')::date;
  v_dias_mes   integer := extract(day from (date_trunc('month', _ref) + interval '1 month - 1 day'))::int;
  v_dias_rest  integer := (v_fim_mes - _ref);   -- dias a partir do dia seguinte ate o fim do mes
begin
  if _unit_price_cents is null or _unit_price_cents <= 0 then
    return 0;
  end if;
  if v_dias_rest <= 0 then
    return 0;   -- contratou no ultimo dia do mes: proporcional zero, cobra so no mes seguinte
  end if;
  return round(_unit_price_cents::numeric * coalesce(_quantity, 1) * v_dias_rest / v_dias_mes)::int;
end $fn_prop$;

-- ---------------------------------------------------------------------
-- 5. my_contratar_addon: agora REGISTRA a contratacao como PENDENTE
--    (sem liberar o efeito) e devolve o id da linha, para a Edge Function
--    montar a cobranca no MP. O efeito e liberado no webhook.
--    (assinatura mudou de void -> uuid: precisa DROP antes)
-- ---------------------------------------------------------------------
drop function if exists public.my_contratar_addon(text, integer);
create or replace function public.my_contratar_addon(_feature_key text, _quantity integer default 1)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn_contratar$
declare
  v_tenant     uuid := public.current_user_tenant_id();
  v_price      integer;
  v_kind       text;
  v_base_limit bigint;
  v_base_unl   boolean;
  v_prop       integer;
  v_qtd        integer := coalesce(_quantity, 1);
  v_id         uuid;
begin
  if v_tenant is null then
    raise exception 'Empresa nao identificada';
  end if;

  select unit_price_cents into v_price
  from public.addon_prices where feature_key = _feature_key and is_active;
  if v_price is null or v_price <= 0 then
    raise exception 'Item nao disponivel para contratacao';
  end if;

  v_kind := case when _feature_key = 'limit.vidas' then 'life' else 'module' end;

  -- uma so contratacao por item: bloqueia se ja houver uma ativa ou aguardando
  -- pagamento (para trocar a quantidade de vidas, cancele a atual antes).
  if exists (
    select 1 from public.subscription_addons
    where tenant_id = v_tenant and feature_key = _feature_key
      and (mp_status = 'pending' or (ativo and mp_status = 'authorized'))
  ) then
    raise exception 'Ja existe uma contratacao deste item (ativa ou aguardando pagamento). Cancele antes de contratar novamente.';
  end if;

  if v_kind = 'module' then
    if public.tenant_has_feature(v_tenant, _feature_key) then
      raise exception 'Modulo ja disponivel no seu plano';
    end if;
    v_qtd := 1;
  else
    if v_qtd < 1 then
      raise exception 'Informe quantas vidas extras deseja';
    end if;
    select pe.limit_value, coalesce(pe.is_unlimited, false) into v_base_limit, v_base_unl
    from public.subscriptions s
    join public.plan_entitlements pe on pe.plan_id = s.plan_id and pe.feature_key = 'limit.vidas'
    where s.tenant_id = v_tenant;
    if coalesce(v_base_unl, false) then
      raise exception 'Seu plano ja tem vidas ilimitadas';
    end if;
  end if;

  v_prop := public.addon_proporcional_cents(v_price, v_qtd, current_date);

  insert into public.subscription_addons
    (tenant_id, feature_key, kind, quantity, unit_price_cents,
     ativo, mp_status, proporcional_cents, recorrencia_inicio, created_by)
  values
    (v_tenant, _feature_key, v_kind, v_qtd, v_price,
     false, 'pending', v_prop,
     (date_trunc('month', current_date) + interval '1 month')::date,
     auth.uid())
  returning id into v_id;

  return v_id;
end $fn_contratar$;

grant execute on function public.my_contratar_addon(text, integer) to authenticated;

-- ---------------------------------------------------------------------
-- 6. addon_confirmar_pagamento: chamada pelo webhook (service_role) quando
--    o pagamento proporcional e aprovado. Libera o efeito (override) e
--    ativa a linha. Idempotente.
-- ---------------------------------------------------------------------
create or replace function public.addon_confirmar_pagamento(
  _addon_id uuid,
  _mp_preapproval_id text default null,
  _proporcional_payment_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $fn_confirmar$
declare
  v public.subscription_addons%rowtype;
  v_base_limit bigint;
begin
  select * into v from public.subscription_addons where id = _addon_id;
  if v.id is null then
    raise notice 'addon % nao encontrado', _addon_id;
    return;
  end if;
  if v.ativo and v.mp_status = 'authorized' then
    return;  -- ja confirmado
  end if;

  update public.subscription_addons
  set ativo = true,
      mp_status = 'authorized',
      mp_preapproval_id = coalesce(_mp_preapproval_id, mp_preapproval_id),
      proporcional_payment_id = coalesce(_proporcional_payment_id, proporcional_payment_id),
      confirmado_em = now()
  where id = _addon_id;

  -- aplica o efeito no motor (override de add-on em autosservico)
  if v.kind = 'module' then
    delete from public.subscription_overrides
      where tenant_id = v.tenant_id and feature_key = v.feature_key and reason = 'add-on self-service';
    insert into public.subscription_overrides (tenant_id, feature_key, is_enabled, reason, created_by)
    values (v.tenant_id, v.feature_key, true, 'add-on self-service', v.created_by);
  else
    select pe.limit_value into v_base_limit
    from public.subscriptions s
    join public.plan_entitlements pe on pe.plan_id = s.plan_id and pe.feature_key = 'limit.vidas'
    where s.tenant_id = v.tenant_id;
    delete from public.subscription_overrides
      where tenant_id = v.tenant_id and feature_key = 'limit.vidas' and reason = 'add-on self-service';
    insert into public.subscription_overrides
      (tenant_id, feature_key, limit_value, is_unlimited, reason, created_by)
    values (v.tenant_id, 'limit.vidas', coalesce(v_base_limit, 0) + v.quantity, false,
            'add-on self-service', v.created_by);
  end if;
end $fn_confirmar$;

-- so o service_role (webhook) chama; nao concede a authenticated.
revoke all on function public.addon_confirmar_pagamento(uuid, text, text) from public;
grant execute on function public.addon_confirmar_pagamento(uuid, text, text) to service_role;

-- ---------------------------------------------------------------------
-- 7. my_cancelar_addon: mantem o comportamento (remove efeito + inativa),
--    e agora marca mp_status='cancelled' para a Edge Function encerrar a
--    assinatura mensal no MP.
-- ---------------------------------------------------------------------
create or replace function public.my_cancelar_addon(_feature_key text)
returns void
language plpgsql
security definer
set search_path = public
as $fn_cancelar$
declare v_tenant uuid := public.current_user_tenant_id();
begin
  if v_tenant is null then
    raise exception 'Empresa nao identificada';
  end if;
  update public.subscription_addons
    set ativo = false, mp_status = 'cancelled'
    where tenant_id = v_tenant and feature_key = _feature_key
      and mp_status in ('authorized','pending','interno');
  delete from public.subscription_overrides
    where tenant_id = v_tenant and feature_key = _feature_key and reason = 'add-on self-service';
end $fn_cancelar$;

grant execute on function public.my_cancelar_addon(text) to authenticated;

-- ---------------------------------------------------------------------
-- 8. entitlement_my_plan ESTENDIDA: alem do que ja devolvia, inclui
--    'addons_pendentes' (contratacoes aguardando pagamento) para a tela
--    mostrar o estado "pagamento pendente". Os 'addons' ativos e o
--    'valores' seguem contando SO os add-ons confirmados (ativo).
-- ---------------------------------------------------------------------
create or replace function public.entitlement_my_plan()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn_myplan$
declare
  v_tenant uuid := public.current_user_tenant_id();
  v_plan   record;
  v_vidas  record;
  v_used   bigint;
  v_limit  bigint;
  v_unl    boolean;
  v_base_cents   integer;
  v_addons_cents integer;
begin
  if v_tenant is null then
    return null;
  end if;

  select p.id as plan_id, p.code, p.name, p.is_public into v_plan
  from subscriptions s join plans p on p.id = s.plan_id
  where s.tenant_id = v_tenant;

  v_used := (select count(*) from admissoes where tenant_id = v_tenant and status = 'concluido');

  select limit_value, is_unlimited into v_vidas
  from entitlement_resolve(v_tenant, 'limit.vidas');
  v_limit := v_vidas.limit_value;
  v_unl   := coalesce(v_vidas.is_unlimited, false);

  v_base_cents := (select pp.amount_cents from plan_prices pp
                   where pp.plan_id = v_plan.plan_id and pp.period = 'monthly' and pp.is_active
                   limit 1);
  v_addons_cents := coalesce((
    select sum(case when sa.kind = 'life' then sa.quantity * sa.unit_price_cents
                    else sa.unit_price_cents end)
    from subscription_addons sa
    where sa.tenant_id = v_tenant and sa.ativo
  ), 0);

  return jsonb_build_object(
    'plano',
      case when v_plan.code is null then null
      else jsonb_build_object('code', v_plan.code, 'name', v_plan.name, 'is_public', v_plan.is_public)
      end,
    'vidas', jsonb_build_object(
      'used', v_used,
      'limit', v_limit,
      'is_unlimited', v_unl,
      'remaining', case when v_unl or v_limit is null then null else greatest(v_limit - v_used, 0) end,
      'percent',   case when v_unl or v_limit is null or v_limit = 0 then null
                        else least(round(v_used::numeric * 100 / v_limit)::int, 100) end
    ),
    'modulos', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'key', f.key, 'name', f.name, 'category', f.category,
               'disponivel', public.tenant_has_feature(v_tenant, f.key)
             ) order by f.category nulls last, f.name), '[]'::jsonb)
      from features f where f.is_active and f.kind = 'boolean'
    ),
    'precos', coalesce((
      select jsonb_object_agg(ap.feature_key, ap.unit_price_cents)
      from addon_prices ap where ap.is_active and ap.unit_price_cents > 0
    ), '{}'::jsonb),
    'addons', coalesce((
      select jsonb_agg(jsonb_build_object(
               'feature_key', sa.feature_key, 'name', f.name, 'kind', sa.kind,
               'quantity', sa.quantity, 'unit_price_cents', sa.unit_price_cents,
               'mp_status', sa.mp_status
             ) order by sa.kind, f.name)
      from subscription_addons sa join features f on f.key = sa.feature_key
      where sa.tenant_id = v_tenant and sa.ativo
    ), '[]'::jsonb),
    'addons_pendentes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', sa.id, 'feature_key', sa.feature_key, 'name', f.name, 'kind', sa.kind,
               'quantity', sa.quantity, 'unit_price_cents', sa.unit_price_cents,
               'proporcional_cents', sa.proporcional_cents
             ) order by sa.kind, f.name)
      from subscription_addons sa join features f on f.key = sa.feature_key
      where sa.tenant_id = v_tenant and sa.mp_status = 'pending'
    ), '[]'::jsonb),
    'valores', jsonb_build_object(
      'base_cents', v_base_cents,
      'addons_cents', v_addons_cents,
      'total_cents', case when v_base_cents is null then null else v_base_cents + v_addons_cents end
    )
  );
end $fn_myplan$;

grant execute on function public.entitlement_my_plan() to authenticated;
