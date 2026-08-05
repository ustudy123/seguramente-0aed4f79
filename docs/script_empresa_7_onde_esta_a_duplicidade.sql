-- =====================================================================
-- Os 192 CPFs em duas empresas do mesmo cliente: onde estão
--
-- 192 em 11.189 pessoas (1,7%), e nenhum deles com espelho emitido —
-- não há estrago feito. Falta separar dois casos que se parecem:
--
--   CONCENTRADO — um cliente só, um par de empresas só, muita gente:
--     é cadastro duplicado (a mesma empresa cadastrada duas vezes, ou
--     uma migração que copiou o quadro inteiro).
--
--   ESPALHADO — poucos por cliente, pares variados:
--     é vínculo real, gente que trabalha em duas empresas do grupo.
--     Nesse caso o certo é a estrutura passar a comportar isso, não
--     "consertar" o cadastro.
--
-- Somente leitura. Não altera nada.
-- =====================================================================

-- 1) QUANTOS POR CLIENTE ------------------------------------------------
-- Se uma linha concentrar quase os 192, é ali que está o problema.
WITH multi AS (
  SELECT a.tenant_id,
         regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g') AS cpf,
         count(DISTINCT a.empresa_id) AS empresas
  FROM public.admissoes a
  WHERE a.empresa_id IS NOT NULL
    AND COALESCE(a.inativo, false) = false
    AND COALESCE(a.cpf, '') <> ''
  GROUP BY 1, 2
  HAVING count(DISTINCT a.empresa_id) > 1
)
SELECT m.tenant_id,
       count(*) AS pessoas_em_2_ou_mais,
       max(m.empresas) AS maximo_de_empresas,
       (SELECT count(DISTINCT e.id) FROM public.empresa_cadastro e
         WHERE e.tenant_id = m.tenant_id) AS empresas_do_cliente,
       (SELECT count(DISTINCT regexp_replace(COALESCE(a2.cpf,''), '[^0-9]', '', 'g'))
          FROM public.admissoes a2
         WHERE a2.tenant_id = m.tenant_id
           AND COALESCE(a2.inativo, false) = false) AS pessoas_do_cliente
FROM multi m
GROUP BY m.tenant_id
ORDER BY 2 DESC;


-- 2) QUAL PAR DE EMPRESAS, COM NOME E CNPJ ------------------------------
-- CNPJ igual nas duas colunas = a mesma empresa cadastrada duas vezes.
-- CNPJs diferentes = empresas de verdade, e aí é vínculo duplo mesmo.
WITH v AS (
  SELECT DISTINCT a.tenant_id,
         regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g') AS cpf,
         a.empresa_id
  FROM public.admissoes a
  WHERE a.empresa_id IS NOT NULL
    AND COALESCE(a.inativo, false) = false
    AND COALESCE(a.cpf, '') <> ''
)
SELECT x.tenant_id,
       COALESCE(e1.razao_social, e1.nome_fantasia) AS empresa_a,
       e1.cnpj AS cnpj_a,
       COALESCE(e2.razao_social, e2.nome_fantasia) AS empresa_b,
       e2.cnpj AS cnpj_b,
       (e1.cnpj IS NOT DISTINCT FROM e2.cnpj) AS mesmo_cnpj,
       count(*) AS pessoas
FROM v x
JOIN v y ON y.tenant_id = x.tenant_id AND y.cpf = x.cpf AND y.empresa_id > x.empresa_id
LEFT JOIN public.empresa_cadastro e1 ON e1.id = x.empresa_id
LEFT JOIN public.empresa_cadastro e2 ON e2.id = y.empresa_id
GROUP BY 1, 2, 3, 4, 5, 6
ORDER BY 7 DESC
LIMIT 20;


-- 3) DESSES, QUANTOS BATEM PONTO ---------------------------------------
-- Só quem tem ponto afeta fechamento, espelho e banco de horas. Quem não
-- bate ponto é questão de cadastro e nada mais.
WITH multi AS (
  SELECT a.tenant_id,
         regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g') AS cpf
  FROM public.admissoes a
  WHERE a.empresa_id IS NOT NULL
    AND COALESCE(a.inativo, false) = false
    AND COALESCE(a.cpf, '') <> ''
  GROUP BY 1, 2
  HAVING count(DISTINCT a.empresa_id) > 1
)
SELECT
  (SELECT count(*) FROM multi) AS pessoas_em_2_empresas,
  count(DISTINCT m.cpf) FILTER (WHERE p.cpf IS NOT NULL) AS com_ponto_registrado,
  count(DISTINCT m.cpf) FILTER (WHERE p.cpf IS NULL)     AS sem_ponto_nenhum
FROM multi m
LEFT JOIN LATERAL (
  SELECT 1 AS cpf
  FROM public.ponto_diario pd
  WHERE pd.tenant_id = m.tenant_id
    AND regexp_replace(COALESCE(pd.colaborador_cpf, ''), '[^0-9]', '', 'g') = m.cpf
  LIMIT 1
) p ON true;
