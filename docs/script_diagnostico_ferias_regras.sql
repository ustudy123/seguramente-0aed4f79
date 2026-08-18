-- ============================================================================
-- YourEyes · PRODUÇÃO · Diagnóstico ANTES de travar as regras de férias
--
-- SOMENTE LEITURA. Não altera nada. Nenhuma linha é gravada, nenhuma
-- política ou trava é criada. Pode rodar quantas vezes quiser.
--
-- POR QUE ISTO VEM ANTES
--
-- O item 2 da conferência do módulo Férias é levar as regras legais para o
-- banco — hoje elas vivem só na tela, e a importação em massa passa por
-- cima de todas. Só que trava criada às cegas em base com histórico
-- costuma fazer uma de duas coisas ruins: recusa de nascer (porque o dado
-- antigo já a viola) ou, pior, trava a operação do dia seguinte por causa
-- de registro velho que ninguém pode mais corrigir.
--
-- Então primeiro se mede. Cada linha do resultado diz quantos registros
-- HOJE violariam a regra correspondente. Com esses números decidimos, item
-- a item, o que vira bloqueio duro e o que precisa de limpeza antes.
--
-- COMO LER O RESULTADO
--   quantidade = 0  → a regra pode virar bloqueio duro com segurança
--   quantidade > 0  → decidir: corrigir o histórico, ou aplicar a trava só
--                     para registros novos (NOT VALID), ou deixar como
--                     alerta até a limpeza
--
-- COMO RODAR: cole o arquivo inteiro no SQL Editor do projeto de PRODUÇÃO.
-- O editor mostra apenas o último resultado, que é a tabela final.
-- ============================================================================

WITH
-- ── Método de cálculo vigente por período ───────────────────────────────
-- A escala do art. 130 só vale onde o método é 'clt_faltas'. Empresa
-- configurada em 'proporcional_avos' calcula por avos, e ali uma diferença
-- não é erro.
metodo AS MATERIALIZED (
  SELECT p.id,
         COALESCE(
           (SELECT c.metodo_calculo FROM public.ferias_config c
             WHERE c.tenant_id = p.tenant_id
               AND c.empresa_id IS NOT DISTINCT FROM p.empresa_id LIMIT 1),
           (SELECT c.metodo_calculo FROM public.ferias_config c
             WHERE c.tenant_id = p.tenant_id AND c.empresa_id IS NULL LIMIT 1),
           'clt_faltas') AS metodo,
         p.dias_direito,
         p.faltas_consideradas,
         p.colaborador_cpf,
         p.tenant_id,
         p.empresa_id
  FROM public.ferias_periodos_aquisitivos p
),

-- ── Fracionamento: quantos subperíodos e o menor/maior deles ────────────
prog AS MATERIALIZED (
  SELECT id,
         COALESCE(p1_dias, 0) AS d1,
         COALESCE(p2_dias, 0) AS d2,
         COALESCE(p3_dias, 0) AS d3,
         COALESCE(abono_vender, false) AS vende_abono,
         COALESCE(abono_dias, 0) AS abono,
         (CASE WHEN COALESCE(p1_dias,0) > 0 THEN 1 ELSE 0 END
        + CASE WHEN COALESCE(p2_dias,0) > 0 THEN 1 ELSE 0 END
        + CASE WHEN COALESCE(p3_dias,0) > 0 THEN 1 ELSE 0 END) AS qtd_periodos
  FROM public.ferias_programacao
)

-- ════════════════════════════════════════════════════════════════════════
SELECT 1 AS ordem,
       'Art. 130 — dias de direito não batem com as faltas' AS regra,
       count(*) AS quantidade,
       'a escala 30/24/18/12 existe como função, mas nada obriga o dado gravado a passar por ela' AS observacao
FROM metodo
WHERE metodo = 'clt_faltas'
  AND dias_direito IS DISTINCT FROM
      public.ferias_dias_por_faltas_clt(COALESCE(faltas_consideradas, 0))::numeric

UNION ALL
SELECT 2,
       'Solicitação de mais dias do que o saldo',
       count(*),
       'o direito do art. 130 é teto duro; hoje a comparação vive só na tela'
FROM public.ferias_solicitacoes
WHERE dias_solicitados IS NOT NULL AND saldo_dias IS NOT NULL
  AND dias_solicitados > saldo_dias

UNION ALL
SELECT 3,
       'Art. 134 §1º — fracionamento inválido',
       count(*),
       'fracionou: um período precisa ter 14 dias ou mais, e nenhum pode ter menos de 5'
FROM prog
WHERE qtd_periodos > 1
  AND (GREATEST(d1, d2, d3) < 14
       OR LEAST(NULLIF(d1,0), NULLIF(d2,0), NULLIF(d3,0)) < 5)

UNION ALL
SELECT 4,
       'Art. 143 — abono acima do teto de 10 dias',
       count(*),
       'o abono pecuniário é limitado a 1/3 do período, no máximo 10 dias'
FROM prog
WHERE vende_abono AND abono > 10

UNION ALL
SELECT 5,
       'Aprovação sem registro de QUEM aprovou',
       count(*),
       'ACHADO: a tela grava só o NOME de quem aprovou (aprovado_por_nome). '
       || 'A coluna aprovado_por, que guardaria o usuário, fica vazia — não há '
       || 'trilha de aprovação auditável, e a trava de autoaprovação sugerida '
       || 'pela FERIAS-056 não teria efeito nenhum sobre este dado'
FROM public.ferias_solicitacoes
WHERE status IN ('aprovado', 'em_gozo', 'concluido')
  AND aprovado_por IS NULL

UNION ALL
SELECT 6,
       'Solicitações sem vínculo com o usuário (colaborador_id vazio)',
       count(*),
       'ACHADO: colaborador_id aponta para auth.users e a tela o deixa nulo de '
       || 'propósito (a lista vem de admissoes, cujo id não existe em auth.users). '
       || 'A pessoa é identificada por nome + CPF. Enquanto for assim, qualquer '
       || 'regra baseada em colaborador_id é decorativa'
FROM public.ferias_solicitacoes
WHERE colaborador_id IS NULL

UNION ALL
SELECT 7,
       'Períodos aquisitivos sem empresa preenchida',
       count(*),
       'a chave única do período ignora a empresa; sem empresa_id preenchido, '
       || 'dois contratos do mesmo CPF colidem'
FROM public.ferias_periodos_aquisitivos
WHERE empresa_id IS NULL

UNION ALL
SELECT 8,
       'CPFs com períodos em mais de uma empresa (múltiplos vínculos)',
       count(*),
       'cada um deles é um caso em que a chave atual (tenant + CPF + início) '
       || 'pode colidir: o segundo vínculo não abre período'
FROM (
  SELECT tenant_id, colaborador_cpf
  FROM public.ferias_periodos_aquisitivos
  WHERE empresa_id IS NOT NULL
  GROUP BY tenant_id, colaborador_cpf
  HAVING count(DISTINCT empresa_id) > 1
) AS multiplos

UNION ALL
SELECT 9,
       'TOTAL de períodos aquisitivos na base',
       count(*),
       'referência para dimensionar os números acima'
FROM public.ferias_periodos_aquisitivos

UNION ALL
SELECT 10,
       'TOTAL de solicitações de férias na base',
       count(*),
       'referência para dimensionar os números acima'
FROM public.ferias_solicitacoes

ORDER BY ordem;
