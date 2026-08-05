-- =====================================================================
-- A pergunta que decide a correção: as duas empresas são a mesma?
--
-- 192 pessoas em duas empresas do mesmo cliente, 89 delas com ponto.
-- Duas leituras possíveis, e a diferença muda tudo:
--
--   MESMO CNPJ  -> é a mesma empresa cadastrada duas vezes. Conserto:
--                  limpar o cadastro duplicado.
--   CNPJ DIFERENTE -> são empresas de verdade e o vínculo é real.
--                  Conserto: a empresa passa a fazer parte da chave do
--                  espelho e do banco de horas.
--
-- Somente leitura.
-- =====================================================================
WITH v AS (
  SELECT DISTINCT a.tenant_id,
         regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g') AS cpf,
         a.empresa_id
  FROM public.admissoes a
  WHERE a.empresa_id IS NOT NULL
    AND COALESCE(a.inativo, false) = false
    AND COALESCE(a.cpf, '') <> ''
),
duplas AS (
  SELECT x.tenant_id, x.cpf,
         e1.id AS emp_a, e2.id AS emp_b,
         COALESCE(e1.razao_social, e1.nome_fantasia) AS nome_a,
         COALESCE(e2.razao_social, e2.nome_fantasia) AS nome_b,
         nullif(regexp_replace(COALESCE(e1.cnpj, ''), '[^0-9]', '', 'g'), '') AS cnpj_a,
         nullif(regexp_replace(COALESCE(e2.cnpj, ''), '[^0-9]', '', 'g'), '') AS cnpj_b
  FROM v x
  JOIN v y ON y.tenant_id = x.tenant_id AND y.cpf = x.cpf AND y.empresa_id > x.empresa_id
  LEFT JOIN public.empresa_cadastro e1 ON e1.id = x.empresa_id
  LEFT JOIN public.empresa_cadastro e2 ON e2.id = y.empresa_id
)
-- RESUMO: uma linha responde
SELECT count(*) FILTER (WHERE cnpj_a IS NOT NULL AND cnpj_a = cnpj_b)  AS duplas_mesmo_cnpj,
       count(*) FILTER (WHERE cnpj_a IS NOT NULL AND cnpj_b IS NOT NULL
                          AND cnpj_a <> cnpj_b)                        AS duplas_cnpj_diferente,
       count(*) FILTER (WHERE cnpj_a IS NULL OR cnpj_b IS NULL)        AS duplas_sem_cnpj_cadastrado,
       count(DISTINCT tenant_id)                                        AS clientes_envolvidos,
       count(DISTINCT (emp_a::text || emp_b::text))                     AS pares_de_empresas_distintos
FROM duplas;

-- DETALHE: os pares mais frequentes, para olhar os nomes
WITH v AS (
  SELECT DISTINCT a.tenant_id,
         regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g') AS cpf,
         a.empresa_id
  FROM public.admissoes a
  WHERE a.empresa_id IS NOT NULL
    AND COALESCE(a.inativo, false) = false
    AND COALESCE(a.cpf, '') <> ''
)
SELECT COALESCE(e1.razao_social, e1.nome_fantasia) AS empresa_a,
       e1.cnpj AS cnpj_a,
       COALESCE(e2.razao_social, e2.nome_fantasia) AS empresa_b,
       e2.cnpj AS cnpj_b,
       regexp_replace(COALESCE(e1.cnpj, ''), '[^0-9]', '', 'g')
         = regexp_replace(COALESCE(e2.cnpj, ''), '[^0-9]', '', 'g') AS mesmo_cnpj,
       count(*) AS pessoas
FROM v x
JOIN v y ON y.tenant_id = x.tenant_id AND y.cpf = x.cpf AND y.empresa_id > x.empresa_id
LEFT JOIN public.empresa_cadastro e1 ON e1.id = x.empresa_id
LEFT JOIN public.empresa_cadastro e2 ON e2.id = y.empresa_id
GROUP BY 1, 2, 3, 4, 5
ORDER BY 6 DESC
LIMIT 10;
