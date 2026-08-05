-- =====================================================================
-- GUERRO & PAGNUSSAT: quatro cadastros, duas filiais, duas cópias
--
-- O que a consulta mostrou:
--
--   CNPJ .../0004-91   07cf2f4f…  ativo=true   105 pessoas   0 ponto
--                      2982611e…  ativo=FALSE  100 pessoas   0 ponto
--   CNPJ .../0041-36   c30c4a64…  ativo=true   196 pessoas   0 ponto
--                      9bd43dc5…  ativo=FALSE    0 pessoas   0 ponto
--
-- Não são duas empresas: são duas FILIAIS (0004 e 0041), cada uma
-- cadastrada duas vezes. A cópia de cada par já está DESATIVADA — só que
-- as admissões continuaram penduradas nela. Por isso as 100 pessoas
-- apareciam "em duas empresas": uma ativa e uma desativada.
--
-- E o mais importante: NENHUMA das quatro tem um único dia de ponto.
-- Este cliente não usa o módulo de ponto, então nada disso afetou
-- fechamento, espelho ou banco de horas em momento nenhum.
--
-- A limpeza é, portanto, de baixo risco: passar as admissões da cópia
-- desativada para a ativa de mesmo CNPJ.
-- =====================================================================

-- >>> ESTE ARQUIVO NÃO ALTERA NADA. É só a simulação. <<<
-- Rode este primeiro, confira os números, e só então rode o
-- script_empresa_11b_executar.sql.

-- ===================== PARTE 1 — SIMULAÇÃO (leitura) =================
-- Rode primeiro. Mostra o que a Parte 2 faria, sem fazer.
WITH par AS (
  SELECT morta.tenant_id,
         morta.id  AS empresa_morta,
         viva.id   AS empresa_viva,
         COALESCE(viva.razao_social, viva.nome_fantasia) AS empresa,
         viva.cnpj
  FROM public.empresa_cadastro morta
  JOIN public.empresa_cadastro viva
    ON viva.tenant_id = morta.tenant_id
   AND viva.ativo = true
   AND regexp_replace(COALESCE(viva.cnpj, ''), '[^0-9]', '', 'g')
       = regexp_replace(COALESCE(morta.cnpj, ''), '[^0-9]', '', 'g')
   AND viva.id <> morta.id
  WHERE morta.ativo = false
    AND COALESCE(morta.cnpj, '') <> ''
    AND (SELECT count(*) FROM public.empresa_cadastro v2
          WHERE v2.tenant_id = morta.tenant_id
            AND v2.ativo = true
            AND v2.id <> morta.id
            AND regexp_replace(COALESCE(v2.cnpj, ''), '[^0-9]', '', 'g')
                = regexp_replace(COALESCE(morta.cnpj, ''), '[^0-9]', '', 'g')) = 1
)
SELECT p.empresa, p.cnpj, p.empresa_morta, p.empresa_viva,
       count(*) FILTER (WHERE ja_tem_na_viva)     AS marcar_como_duplicada,
       count(*) FILTER (WHERE NOT ja_tem_na_viva) AS transferir_para_a_ativa
FROM par p
JOIN LATERAL (
  SELECT EXISTS (
           SELECT 1 FROM public.admissoes b
           WHERE b.tenant_id = a.tenant_id
             AND b.empresa_id = p.empresa_viva
             AND regexp_replace(COALESCE(b.cpf, ''), '[^0-9]', '', 'g')
                 = regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g')
         ) AS ja_tem_na_viva
  FROM public.admissoes a
  WHERE a.tenant_id = p.tenant_id
    AND a.empresa_id = p.empresa_morta
    -- Mesmo filtro da execução: admissão já inativa não é tocada, e
    -- contá-la aqui faria a simulação prometer mais do que ela faz.
    AND COALESCE(a.inativo, false) = false
) x ON true
GROUP BY 1, 2, 3, 4
ORDER BY 1, 2;


