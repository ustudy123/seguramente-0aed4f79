-- =====================================================================
-- O diagnóstico fechou: não há vínculo concomitante, há cadastro aberto
--
-- Em TODAS as duplas listadas, o ponto está numa empresa só — e sempre
-- na de admissão MAIS RECENTE. Isso não é duplo vínculo: é gente que
-- trocou de empresa dentro do mesmo cliente (típico de escritório de
-- contabilidade, que administra dezenas de empresas) e cuja admissão
-- ANTIGA nunca recebeu baixa: sem data de desligamento, sem inativo.
--
-- Consequências:
--
--   1. NÃO é preciso mudar a chave do espelho nem do banco de horas.
--      Ninguém bate ponto em duas empresas, logo ninguém disputa a mesma
--      linha. A estrutura atual está correta.
--
--   2. A resolução de empresa que a correção usa — admissão ativa mais
--      recente — acerta esses casos: é justamente a empresa onde o ponto
--      está. Nada a ajustar ali.
--
--   3. Sobra limpeza de CADASTRO, que é ato de RH e não de banco: dar
--      baixa na admissão antiga exige data de desligamento e tem efeito
--      trabalhista. Este script LISTA os casos; não altera nada.
--
-- Somente leitura, as duas partes.
-- =====================================================================

-- A) ADMISSÕES ABERTAS QUE PARECEM PEDIR BAIXA -------------------------
-- Pessoa com admissão mais recente em outra empresa do mesmo cliente, e
-- sem nenhum ponto na empresa antiga. A coluna "ultimo_ponto_na_antiga"
-- ajuda o RH a definir a data de desligamento quando houver.
WITH aberta AS (
  SELECT a.id, a.tenant_id, a.empresa_id, a.nome_completo,
         regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g') AS cpf,
         a.data_admissao
  FROM public.admissoes a
  WHERE a.empresa_id IS NOT NULL
    AND COALESCE(a.inativo, false) = false
    AND a.data_desligamento IS NULL
    AND COALESCE(a.cpf, '') <> ''
),
mais_nova AS (
  SELECT DISTINCT ON (x.id) x.id, y.empresa_id AS empresa_nova, y.data_admissao AS admissao_nova
  FROM aberta x
  JOIN aberta y ON y.tenant_id = x.tenant_id AND y.cpf = x.cpf
              AND y.empresa_id <> x.empresa_id
              AND y.data_admissao > x.data_admissao
  ORDER BY x.id, y.data_admissao DESC
)
SELECT a.nome_completo AS colaborador,
       a.cpf,
       COALESCE(ea.razao_social, ea.nome_fantasia) AS empresa_antiga,
       a.data_admissao AS admitido_em,
       (SELECT max(pd.data) FROM public.ponto_diario pd
         WHERE pd.tenant_id = a.tenant_id
           AND pd.empresa_id = a.empresa_id
           AND regexp_replace(COALESCE(pd.colaborador_cpf,''), '[^0-9]', '', 'g') = a.cpf
       ) AS ultimo_ponto_na_antiga,
       COALESCE(en.razao_social, en.nome_fantasia) AS empresa_nova,
       m.admissao_nova
FROM aberta a
JOIN mais_nova m ON m.id = a.id
LEFT JOIN public.empresa_cadastro ea ON ea.id = a.empresa_id
LEFT JOIN public.empresa_cadastro en ON en.id = m.empresa_nova
ORDER BY a.nome_completo;


-- B) O CADASTRO DUPLICADO (mesmo CNPJ), LADO A LADO --------------------
-- As duas empresas com CNPJ idêntico dentro do mesmo cliente, com o
-- volume de cada uma. A que tiver o ponto é a que fica; a outra é a
-- cópia. Este é o caso da GUERRO & PAGNUSSAT, com 100 pessoas.
WITH dupli AS (
  SELECT e.tenant_id,
         regexp_replace(COALESCE(e.cnpj, ''), '[^0-9]', '', 'g') AS cnpj
  FROM public.empresa_cadastro e
  WHERE COALESCE(e.cnpj, '') <> ''
  GROUP BY 1, 2
  HAVING count(*) > 1
)
SELECT e.tenant_id,
       e.id AS empresa_id,
       COALESCE(e.razao_social, e.nome_fantasia) AS empresa,
       e.cnpj,
       e.ativo,
       (SELECT count(*) FROM public.admissoes a
         WHERE a.empresa_id = e.id AND COALESCE(a.inativo, false) = false) AS pessoas_ativas,
       (SELECT count(*) FROM public.ponto_diario p  WHERE p.empresa_id = e.id) AS dias_de_ponto,
       (SELECT count(*) FROM public.ponto_espelhos s WHERE s.empresa_id = e.id) AS espelhos,
       (SELECT count(*) FROM public.ponto_banco_horas b WHERE b.empresa_id = e.id) AS bancos_de_horas,
       (SELECT max(p.data) FROM public.ponto_diario p WHERE p.empresa_id = e.id) AS ultimo_ponto
FROM public.empresa_cadastro e
JOIN dupli d ON d.tenant_id = e.tenant_id
            AND d.cnpj = regexp_replace(COALESCE(e.cnpj, ''), '[^0-9]', '', 'g')
ORDER BY e.cnpj, dias_de_ponto DESC;
