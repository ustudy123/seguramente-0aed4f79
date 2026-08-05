-- =====================================================================
-- Não é o sábado: é o mês inteiro, e a partir de uma data
--
-- A conferência mostrou TODOS os dias duplicados, não só os sábados:
--   Adriana  a partir de 04/06
--   Luciani  a partir de 05/06
--   Luiza    a partir de 05/06
--
-- Um dia repetido seria a linha extra da equalização. O mês inteiro
-- repetido, começando numa data específica e diferente para cada
-- pessoa, tem outra assinatura: a apuração está encontrando DUAS
-- atribuições de escala válidas para a mesma pessoa, e a data em que a
-- duplicação começa é a data em que a segunda atribuição passa a valer.
--
-- Isto conversa com um problema já visto nesta base: atribuições de
-- escala apontando para escalas de outro tenant, corrigidas em agosto.
-- A correção de lá copiou escalas; se a atribuição antiga não foi
-- encerrada, a pessoa ficou com duas.
--
-- Somente leitura.
-- =====================================================================

-- 1) AS ATRIBUIÇÕES DAS TRÊS PESSOAS -----------------------------------
-- Duas linhas ativas com períodos que se sobrepõem = causa confirmada.
SELECT a.colaborador_cpf,
       a.colaborador_id,
       max(pd.colaborador_nome) AS colaborador,
       a.escala_id,
       COALESCE(e.descricao_contratual, e.descricao_original) AS escala,
       e.jornada_diaria_minutos,
       e.tenant_id AS tenant_da_escala,
       a.tenant_id AS tenant_da_atribuicao,
       a.data_inicio, a.data_fim, a.ativa, a.created_at
FROM public.ponto_escala_atribuicoes a
LEFT JOIN public.ponto_escalas e ON e.id = a.escala_id
LEFT JOIN public.ponto_diario pd
       ON regexp_replace(COALESCE(pd.colaborador_cpf,''), '[^0-9]', '', 'g')
          = regexp_replace(COALESCE(a.colaborador_cpf,''), '[^0-9]', '', 'g')
WHERE regexp_replace(COALESCE(a.colaborador_cpf,''), '[^0-9]', '', 'g') IN (
  SELECT DISTINCT regexp_replace(colaborador_cpf, '[^0-9]', '', 'g')
  FROM public.ponto_diario
  WHERE colaborador_nome ILIKE ANY (ARRAY['%luiza gabrieli%', '%adriana medeiros%', '%luciani marinho%'])
)
GROUP BY 1,2,4,5,6,7,8,9,10,11,12
ORDER BY 3, a.data_inicio;


-- 2) O TAMANHO DO PROBLEMA --------------------------------------------
-- Quantas pessoas têm mais de uma atribuição ativa valendo hoje.
WITH ativas AS (
  SELECT a.tenant_id,
         regexp_replace(COALESCE(a.colaborador_cpf,''), '[^0-9]', '', 'g') AS cpf,
         a.escala_id, a.data_inicio, a.data_fim
  FROM public.ponto_escala_atribuicoes a
  WHERE COALESCE(a.ativa, true) = true
    AND COALESCE(a.colaborador_cpf, '') <> ''
    AND (a.data_fim IS NULL OR a.data_fim >= CURRENT_DATE - 90)
)
SELECT count(*) AS pessoas_com_mais_de_uma_escala,
       sum(escalas) AS atribuicoes_envolvidas,
       count(*) FILTER (WHERE escalas > 2) AS pessoas_com_tres_ou_mais
FROM (
  SELECT tenant_id, cpf, count(DISTINCT escala_id) AS escalas
  FROM ativas
  GROUP BY 1, 2
  HAVING count(DISTINCT escala_id) > 1
) x;


-- 3) A LISTA, PARA DECIDIR QUAL FICA -----------------------------------
-- Para cada pessoa com duas escalas ativas: as duas atribuições, em
-- ordem de criação. Em geral a mais recente é a boa e a antiga é a que
-- ficou sem encerramento.
WITH multi AS (
  SELECT a.tenant_id,
         regexp_replace(COALESCE(a.colaborador_cpf,''), '[^0-9]', '', 'g') AS cpf
  FROM public.ponto_escala_atribuicoes a
  WHERE COALESCE(a.ativa, true) = true
    AND COALESCE(a.colaborador_cpf, '') <> ''
  GROUP BY 1, 2
  HAVING count(DISTINCT a.escala_id) > 1
)
SELECT m.cpf,
       (SELECT max(pd.colaborador_nome) FROM public.ponto_diario pd
         WHERE pd.tenant_id = m.tenant_id
           AND regexp_replace(COALESCE(pd.colaborador_cpf,''), '[^0-9]', '', 'g') = m.cpf) AS colaborador,
       a.escala_id,
       COALESCE(e.descricao_contratual, e.descricao_original) AS escala,
       e.jornada_diaria_minutos,
       a.data_inicio, a.data_fim, a.created_at
FROM multi m
JOIN public.ponto_escala_atribuicoes a
  ON a.tenant_id = m.tenant_id
 AND regexp_replace(COALESCE(a.colaborador_cpf,''), '[^0-9]', '', 'g') = m.cpf
 AND COALESCE(a.ativa, true) = true
LEFT JOIN public.ponto_escalas e ON e.id = a.escala_id
ORDER BY 2, a.created_at
LIMIT 60;
