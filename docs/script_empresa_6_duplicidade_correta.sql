-- A) DUPLICIDADE DENTRO DO MESMO TENANT — é esta que importa
SELECT a.tenant_id,
       regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g') AS cpf,
       max(a.nome_completo) AS colaborador,
       count(DISTINCT a.empresa_id) AS empresas
FROM public.admissoes a
WHERE a.empresa_id IS NOT NULL
  AND COALESCE(a.inativo, false) = false
  AND COALESCE(a.cpf, '') <> ''
GROUP BY 1, 2
HAVING count(DISTINCT a.empresa_id) > 1
ORDER BY 4 DESC, 3;

-- B) RESUMO: quantos são de cada tipo
WITH base AS (
  SELECT a.tenant_id,
         regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g') AS cpf,
         a.empresa_id
  FROM public.admissoes a
  WHERE a.empresa_id IS NOT NULL
    AND COALESCE(a.inativo, false) = false
    AND COALESCE(a.cpf, '') <> ''
),
por_tenant AS (
  SELECT tenant_id, cpf, count(DISTINCT empresa_id) AS empresas
  FROM base GROUP BY 1, 2
),
por_cpf AS (
  SELECT cpf, count(DISTINCT tenant_id) AS tenants
  FROM base GROUP BY 1
)
SELECT
  (SELECT count(*) FROM por_tenant WHERE empresas > 1) AS cpfs_em_2_empresas_do_mesmo_cliente,
  (SELECT count(*) FROM por_cpf   WHERE tenants  > 1)  AS cpfs_em_mais_de_um_cliente,
  (SELECT count(DISTINCT tenant_id) FROM base)         AS clientes_na_base,
  (SELECT count(DISTINCT cpf) FROM base)               AS pessoas_distintas;
