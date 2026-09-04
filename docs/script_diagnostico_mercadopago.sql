-- =====================================================================
-- DIAGNOSTICO · COMO A COBRANCA DO MERCADO PAGO ACONTECE HOJE
--
-- SOMENTE LEITURA. Nao cria, nao altera e nao apaga nada. Pode rodar na
-- PRODUCAO com seguranca, quantas vezes quiser.
--
-- Objetivo: responder de forma objetiva "existe cobranca recorrente
-- (assinatura) hoje, ou toda cobranca e avulsa?". A resposta esta no
-- proprio banco: a tabela assinaturas guarda o payload completo de cada
-- pagamento devolvido pelo Mercado Pago em raw_payload, e o MP marca cada
-- pagamento com operation_type:
--     regular_payment    = cobranca avulsa (checkout comum)
--     recurring_payment  = cobranca gerada por uma ASSINATURA (preapproval)
--
-- Termina com UMA conferencia SELECT (o editor so mostra o ultimo
-- resultado). Leia a coluna "leitura" para interpretar cada linha.
-- =====================================================================

with base as materialized (
  select
    a.status,
    a.payer_email,
    a.approved_at,
    a.created_at,
    a.plano_id,
    a.ciclo,
    a.meses,
    a.valor_total,
    a.tenant_id,
    a.payment_method,
    a.raw_payload ->> 'operation_type'                as operation_type,
    coalesce(
      a.raw_payload ->> 'preapproval_id',
      a.raw_payload -> 'metadata' ->> 'preapproval_id'
    )                                                 as preapproval_id
  from public.assinaturas a
),
aprovadas as materialized (
  select * from base where status = 'approved'
),
por_pagador as materialized (
  select payer_email,
         count(*)                                                  as pagamentos,
         count(distinct date_trunc('month', coalesce(approved_at, created_at))) as meses_distintos
  from aprovadas
  where payer_email is not null
  group by payer_email
),
diag(ordem, secao, item, valor, leitura) as (

  -- ---------------- 1. Panorama ----------------
  select 1, '1. Panorama', 'Registros de pagamento na tabela assinaturas',
         (select count(*)::text from base),
         'Total de tentativas de pagamento ja registradas.'
  union all
  select 2, '1. Panorama', 'Pagamentos APROVADOS',
         (select count(*)::text from aprovadas),
         'Quantos viraram dinheiro de fato.'
  union all
  select 3, '1. Panorama', 'Situacoes encontradas',
         coalesce((select string_agg(s.status || '=' || s.qtd, ', ' order by s.qtd desc)
                   from (select status, count(*) qtd from base group by status) s), 'nenhuma'),
         'Distribuicao por situacao (approved, pending, rejected...).'

  -- ---------------- 2. A PERGUNTA PRINCIPAL ----------------
  union all
  select 10, '2. Existe recorrencia?', 'Pagamentos marcados como recurring_payment',
         (select count(*)::text from base where operation_type = 'recurring_payment'),
         'MAIOR QUE ZERO = existe assinatura recorrente ativa no Mercado Pago.'
  union all
  select 11, '2. Existe recorrencia?', 'Pagamentos marcados como regular_payment',
         (select count(*)::text from base where operation_type = 'regular_payment'),
         'Cobrancas avulsas (o checkout do site). O esperado hoje.'
  union all
  select 12, '2. Existe recorrencia?', 'Pagamentos com preapproval_id (id de assinatura)',
         (select count(*)::text from base where preapproval_id is not null),
         'MAIOR QUE ZERO = veio de uma assinatura criada no MP.'
  union all
  select 13, '2. Existe recorrencia?', '>>> VEREDITO <<<',
         (select case
            when count(*) filter (where operation_type = 'recurring_payment'
                                     or preapproval_id is not null) > 0
              then 'HA RECORRENCIA'
            when count(*) = 0 then 'SEM DADOS (nenhum pagamento registrado)'
            else 'TUDO AVULSO (nenhuma assinatura recorrente)'
          end from base),
         'Resposta direta: o sistema ja cobra sozinho todo mes, ou nao.'

  -- ---------------- 3. Indicio indireto de recorrencia ----------------
  union all
  select 20, '3. Indicio indireto', 'Pagadores com mais de 1 pagamento aprovado',
         (select count(*)::text from por_pagador where pagamentos > 1),
         'Mesmo sem marca de assinatura, pagar varias vezes sugere renovacao.'
  union all
  select 21, '3. Indicio indireto', 'Pagadores que pagaram em meses diferentes',
         (select count(*)::text from por_pagador where meses_distintos > 1),
         'MAIOR QUE ZERO = ha cobranca se repetindo mes a mes (manual ou nao).'
  union all
  select 22, '3. Indicio indireto', 'Periodo coberto pelos pagamentos aprovados',
         coalesce((select to_char(min(coalesce(approved_at, created_at)), 'DD/MM/YYYY') || ' ate ' ||
                          to_char(max(coalesce(approved_at, created_at)), 'DD/MM/YYYY')
                   from aprovadas), 'nenhum'),
         'Do primeiro ao ultimo pagamento aprovado.'

  -- ---------------- 4. O que foi vendido ----------------
  union all
  select 30, '4. O que foi vendido', 'Planos vendidos (aprovados)',
         coalesce((select string_agg(x.plano_id || '=' || x.qtd, ', ' order by x.qtd desc)
                   from (select plano_id, count(*) qtd from aprovadas group by plano_id) x), 'nenhum'),
         'Quais planos ja foram pagos pelo site.'
  union all
  select 31, '4. O que foi vendido', 'Ciclos vendidos (aprovados)',
         coalesce((select string_agg(x.ciclo || '=' || x.qtd, ', ' order by x.qtd desc)
                   from (select ciclo, count(*) qtd from aprovadas group by ciclo) x), 'nenhum'),
         'mensal/trimestral/semestral/anual. Ciclo longo = pago adiantado.'
  union all
  select 32, '4. O que foi vendido', 'Meios de pagamento usados',
         coalesce((select string_agg(x.pm || '=' || x.qtd, ', ' order by x.qtd desc)
                   from (select coalesce(payment_method,'?') pm, count(*) qtd
                         from aprovadas group by 1) x), 'nenhum'),
         'Cartao (credit_card) permite assinatura; pix/boleto nao.'
  union all
  select 33, '4. O que foi vendido', 'Total ja aprovado (R$)',
         -- formatado a mao para nao depender do idioma do servidor
         coalesce((select replace(to_char(sum(valor_total), 'FM9999999990.00'), '.', ',')
                   from aprovadas), '0,00'),
         'Soma dos pagamentos aprovados.'

  -- ---------------- 5. Ligacao com as empresas ----------------
  union all
  select 40, '5. Ligacao com o sistema', 'Pagamentos aprovados COM empresa vinculada',
         (select count(*)::text from aprovadas where tenant_id is not null),
         'Pagamentos que viraram empresa dentro do sistema.'
  union all
  select 41, '5. Ligacao com o sistema', 'Pagamentos aprovados SEM empresa vinculada',
         (select count(*)::text from aprovadas where tenant_id is null),
         'MAIOR QUE ZERO = alguem pagou e a conta nao foi provisionada.'
  union all
  select 42, '5. Ligacao com o sistema', 'Empresas pagantes SEM plano no motor',
         (select count(*)::text
          from aprovadas a
          where a.tenant_id is not null
            and not exists (select 1 from public.subscriptions s where s.tenant_id = a.tenant_id)),
         'MAIOR QUE ZERO = cliente pagante entrou sem plano (abre tudo).'
  union all
  select 43, '5. Ligacao com o sistema', 'Total de empresas sem plano no motor',
         (select count(*)::text from public.tenants t
          where not exists (select 1 from public.subscriptions s where s.tenant_id = t.id)),
         'Empresas criadas depois do motor nao ganham plano sozinhas.'
)
select secao, item, valor, leitura
from diag
order by ordem;
