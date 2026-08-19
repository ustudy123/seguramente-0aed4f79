-- ============================================================================
-- YourEyes · PRODUÇÃO · Os 3 pedidos de férias acima do saldo
--
-- SOMENTE LEITURA. Não altera nada.
--
-- O diagnóstico das regras de férias apontou 3 solicitações (de 19) pedindo
-- mais dias do que o saldo registrado. É a única das travas planejadas que
-- não pôde ser aplicada: travar antes de entender impediria justamente a
-- correção desses casos.
--
-- Esta consulta mostra os três, lado a lado com o período aquisitivo
-- correspondente, para responder à pergunta que decide o que fazer:
--
--   O saldo estava DESATUALIZADO na hora do pedido (e a trava seria injusta),
--   ou o pedido foi indevido mesmo (e a trava resolve)?
--
-- A coluna `leitura` já adianta a hipótese mais provável de cada caso.
--
-- COMO RODAR: cole no SQL Editor do projeto de PRODUÇÃO.
-- ============================================================================

WITH casos AS MATERIALIZED (
  SELECT
    s.id,
    s.colaborador_nome,
    s.colaborador_cpf,
    s.status,
    s.data_inicio,
    s.data_fim,
    s.dias_solicitados,
    s.saldo_dias                       AS saldo_gravado_na_solicitacao,
    s.periodo_aquisitivo_inicio,
    s.periodo_aquisitivo_fim,
    s.created_at,
    p.dias_direito                     AS direito_hoje,
    p.dias_gozados                     AS gozados_hoje,
    p.dias_saldo                       AS saldo_hoje,
    p.faltas_consideradas,
    p.fonte_faltas,
    p.calculado_em
  FROM public.ferias_solicitacoes s
  LEFT JOIN public.ferias_periodos_aquisitivos p
    ON p.tenant_id = s.tenant_id
   AND regexp_replace(COALESCE(p.colaborador_cpf, ''), '[^0-9]', '', 'g')
     = regexp_replace(COALESCE(s.colaborador_cpf, ''), '[^0-9]', '', 'g')
   AND (s.periodo_aquisitivo_inicio IS NULL
        OR p.aquisitivo_inicio = s.periodo_aquisitivo_inicio)
  WHERE s.dias_solicitados IS NOT NULL
    AND s.saldo_dias IS NOT NULL
    AND s.dias_solicitados > s.saldo_dias
)
SELECT
  colaborador_nome,
  status,
  data_inicio,
  dias_solicitados,
  saldo_gravado_na_solicitacao,
  saldo_hoje,
  direito_hoje,
  faltas_consideradas,
  fonte_faltas,
  created_at::date AS pedido_em,
  calculado_em::date AS periodo_recalculado_em,
  CASE
    WHEN saldo_hoje IS NULL
      THEN 'Não achei o período aquisitivo deste CPF: a solicitação está solta, '
        || 'sem período de origem. Trava por saldo não teria referência.'
    WHEN dias_solicitados <= saldo_hoje
      THEN 'Saldo ESTAVA desatualizado: hoje o período comporta o pedido. '
        || 'A trava seria injusta com este caso.'
    WHEN calculado_em > created_at
      THEN 'O período foi recalculado DEPOIS do pedido — o saldo mudou no meio '
        || 'do caminho. Conferir se o recálculo está certo antes de decidir.'
    ELSE 'Pedido acima do saldo de verdade, e continua acima hoje. '
      || 'Este é o caso que a trava evitaria.'
  END AS leitura
FROM casos
ORDER BY colaborador_nome;
