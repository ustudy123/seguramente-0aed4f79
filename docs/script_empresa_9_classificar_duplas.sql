-- =====================================================================
-- As duplas não são todas do mesmo tipo — classificando antes de agir
--
-- O detalhe por par mostrou três situações distintas:
--
--   a) GUERRO & PAGNUSSAT LTDA × GUERRO & PAGNUSSAT LTDA, mesmo nome,
--      mesmo CNPJ, 100 pessoas -> cadastro duplicado, clarissimo.
--
--   b) "Luis Enrique Piccinini Ltda" 51.722.892/0001-75 ×
--      "L E PICCININI LTDA"        51.722.892/0011-47
--      -> mesma raiz de CNPJ, filial diferente. É a mesma empresa em
--         dois estabelecimentos, não duas empresas.
--
--   c) pares com CNPJ inteiramente diferente (DEON & PASINI × PASINI &
--      DEON, Construtora Realeza × Construtora e Incorporadora Realeza,
--      JM SERVIÇOS × outras) -> empresas de verdade. Aqui ainda falta
--      saber se o vínculo é CONCOMITANTE (trabalha nas duas ao mesmo
--      tempo) ou SEQUENCIAL (saiu de uma e entrou na outra, e a antiga
--      ficou sem baixa no cadastro).
--
-- A diferença entre concomitante e sequencial é decisiva: sequencial se
-- resolve dando baixa na admissão antiga; concomitante exige que a
-- empresa entre na chave do espelho e do banco de horas.
--
-- Somente leitura.
-- =====================================================================
WITH v AS (
  SELECT a.tenant_id,
         regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g') AS cpf,
         a.empresa_id, a.id AS admissao_id, a.nome_completo,
         a.data_admissao, a.data_desligamento, a.bate_ponto
  FROM public.admissoes a
  WHERE a.empresa_id IS NOT NULL
    AND COALESCE(a.inativo, false) = false
    AND COALESCE(a.cpf, '') <> ''
),
duplas AS (
  SELECT x.tenant_id, x.cpf, x.nome_completo,
         x.empresa_id AS emp_a, y.empresa_id AS emp_b,
         x.data_admissao AS adm_a, y.data_admissao AS adm_b,
         x.data_desligamento AS desl_a, y.data_desligamento AS desl_b,
         regexp_replace(COALESCE(e1.cnpj, ''), '[^0-9]', '', 'g') AS cnpj_a,
         regexp_replace(COALESCE(e2.cnpj, ''), '[^0-9]', '', 'g') AS cnpj_b,
         COALESCE(e1.razao_social, e1.nome_fantasia) AS nome_a,
         COALESCE(e2.razao_social, e2.nome_fantasia) AS nome_b
  FROM v x
  JOIN v y ON y.tenant_id = x.tenant_id AND y.cpf = x.cpf AND y.empresa_id > x.empresa_id
  LEFT JOIN public.empresa_cadastro e1 ON e1.id = x.empresa_id
  LEFT JOIN public.empresa_cadastro e2 ON e2.id = y.empresa_id
),
classificado AS (
  SELECT d.*,
    CASE
      WHEN cnpj_a <> '' AND cnpj_a = cnpj_b
        THEN '1. cadastro duplicado (mesmo CNPJ)'
      WHEN length(cnpj_a) = 14 AND length(cnpj_b) = 14
           AND left(cnpj_a, 8) = left(cnpj_b, 8)
        THEN '2. matriz e filial (mesma raiz de CNPJ)'
      WHEN desl_a IS NOT NULL OR desl_b IS NOT NULL
        THEN '3. sequencial (uma das admissões tem desligamento)'
      ELSE '4. concomitante (duas admissões abertas, CNPJs distintos)'
    END AS tipo
  FROM duplas d
)
SELECT tipo,
       count(*) AS pessoas,
       count(*) FILTER (WHERE EXISTS (
         SELECT 1 FROM public.ponto_diario pd
         WHERE pd.tenant_id = c.tenant_id
           AND regexp_replace(COALESCE(pd.colaborador_cpf, ''), '[^0-9]', '', 'g') = c.cpf
       )) AS com_ponto,
       count(DISTINCT tenant_id) AS clientes
FROM classificado c
GROUP BY tipo
ORDER BY tipo;


-- DETALHE DO CASO 4 (concomitante) — é o único que pode exigir mudança
-- de estrutura. Se vier vazio ou com pouquíssima gente COM PONTO, não
-- há o que mudar.
WITH v AS (
  SELECT a.tenant_id,
         regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g') AS cpf,
         a.empresa_id, a.nome_completo, a.data_admissao, a.data_desligamento
  FROM public.admissoes a
  WHERE a.empresa_id IS NOT NULL
    AND COALESCE(a.inativo, false) = false
    AND COALESCE(a.cpf, '') <> ''
)
SELECT x.nome_completo AS colaborador,
       COALESCE(e1.razao_social, e1.nome_fantasia) AS empresa_a,
       x.data_admissao AS admitido_em_a,
       COALESCE(e2.razao_social, e2.nome_fantasia) AS empresa_b,
       y.data_admissao AS admitido_em_b,
       EXISTS (SELECT 1 FROM public.ponto_diario pd
                WHERE pd.tenant_id = x.tenant_id
                  AND regexp_replace(COALESCE(pd.colaborador_cpf,''), '[^0-9]', '', 'g') = x.cpf
                  AND pd.empresa_id = x.empresa_id) AS bate_ponto_em_a,
       EXISTS (SELECT 1 FROM public.ponto_diario pd
                WHERE pd.tenant_id = y.tenant_id
                  AND regexp_replace(COALESCE(pd.colaborador_cpf,''), '[^0-9]', '', 'g') = y.cpf
                  AND pd.empresa_id = y.empresa_id) AS bate_ponto_em_b
FROM v x
JOIN v y ON y.tenant_id = x.tenant_id AND y.cpf = x.cpf AND y.empresa_id > x.empresa_id
LEFT JOIN public.empresa_cadastro e1 ON e1.id = x.empresa_id
LEFT JOIN public.empresa_cadastro e2 ON e2.id = y.empresa_id
WHERE x.data_desligamento IS NULL AND y.data_desligamento IS NULL
  AND left(regexp_replace(COALESCE(e1.cnpj, ''), '[^0-9]', '', 'g'), 8)
      <> left(regexp_replace(COALESCE(e2.cnpj, ''), '[^0-9]', '', 'g'), 8)
ORDER BY 6 DESC, 7 DESC, 1
LIMIT 40;
