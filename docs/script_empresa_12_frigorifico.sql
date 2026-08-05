-- =====================================================================
-- Depois da limpeza: o que sobrou e o que ela não podia tocar
--
-- A simulação foi o melhor cenário possível:
--   GUERRO & PAGNUSSAT .../0004-91
--     100 a marcar como duplicada, 0 a transferir
-- Ou seja, as 100 pessoas da cópia JÁ EXISTEM na empresa ativa. Nada é
-- movido, nada é criado: só o registro repetido sai de circulação.
--
-- A conferência apontou outra coisa, de natureza diferente:
--   FRIGORIFICO GUERRO & PAGNUSSAT LTDA, CNPJ 57.488.681/0001-04,
--   desativada, com 12 admissões ativas penduradas.
--
-- Repare no CNPJ: 57.488.681 não é 09.461.639. Não é cópia da GUERRO —
-- é OUTRA empresa (um frigorífico), que foi desativada no cadastro com
-- 12 pessoas ainda ativas dentro. O script não mexe nela, e está certo:
-- não existe empresa ativa de mesmo CNPJ para onde levar essa gente.
--
-- Isso não é bug, é decisão de cadastro: ou a empresa continua operando
-- (e deveria estar ativa), ou as 12 pessoas foram desligadas (e falta
-- registrar isso). As consultas abaixo dão o material para decidir.
--
-- Somente leitura.
-- =====================================================================

-- 1) A LIMPEZA JÁ FOI EXECUTADA? ---------------------------------------
-- Se você já rodou o 11b, aparecem as ações registradas. Se ainda não
-- rodou, vem vazio — e a simulação continua valendo.
SELECT acao, count(*) AS linhas, min(executado_em) AS quando
FROM public.admissoes_limpeza_duplicidade
GROUP BY 1
ORDER BY 1;

-- E o estado da cópia da GUERRO: o esperado depois da limpeza é 0.
SELECT COALESCE(e.razao_social, e.nome_fantasia) AS copia,
       e.cnpj,
       count(*) FILTER (WHERE COALESCE(a.inativo, false) = false) AS ainda_ativas,
       count(*) FILTER (WHERE COALESCE(a.inativo, false) = true)  AS ja_inativadas
FROM public.empresa_cadastro e
LEFT JOIN public.admissoes a ON a.empresa_id = e.id
WHERE e.id = '2982611e-64fe-47b9-87bd-89a1a715ff30'
GROUP BY 1, 2;


-- 2) AS 12 PESSOAS DO FRIGORÍFICO --------------------------------------
-- Para cada uma: quando foi admitida, se tem ponto registrado, e se
-- existe cadastro ativo dela em outra empresa do mesmo cliente (o que
-- indicaria que já mudou de empresa e esta admissão ficou para trás).
SELECT a.nome_completo AS colaborador,
       regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g') AS cpf,
       a.cargo,
       a.data_admissao,
       a.data_desligamento,
       (SELECT max(pd.data) FROM public.ponto_diario pd
         WHERE pd.tenant_id = a.tenant_id
           AND regexp_replace(COALESCE(pd.colaborador_cpf, ''), '[^0-9]', '', 'g')
               = regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g')
       ) AS ultimo_ponto,
       (SELECT string_agg(DISTINCT COALESCE(e2.razao_social, e2.nome_fantasia), ' | ')
          FROM public.admissoes b
          JOIN public.empresa_cadastro e2 ON e2.id = b.empresa_id
         WHERE b.tenant_id = a.tenant_id
           AND b.id <> a.id
           AND COALESCE(b.inativo, false) = false
           AND e2.ativo = true
           AND regexp_replace(COALESCE(b.cpf, ''), '[^0-9]', '', 'g')
               = regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g')
       ) AS tambem_ativa_em
FROM public.admissoes a
JOIN public.empresa_cadastro e ON e.id = a.empresa_id
WHERE e.ativo = false
  AND regexp_replace(COALESCE(e.cnpj, ''), '[^0-9]', '', 'g') = '57488681000104'
  AND COALESCE(a.inativo, false) = false
ORDER BY a.nome_completo;


-- 3) O MESMO CASO EM OUTROS CLIENTES -----------------------------------
-- Empresa desativada com gente ativa dentro e SEM gêmea de mesmo CNPJ.
-- Vale saber se o frigorífico é caso isolado ou hábito na base.
SELECT e.tenant_id,
       COALESCE(e.razao_social, e.nome_fantasia) AS empresa_desativada,
       e.cnpj,
       count(*) AS pessoas_ativas_dentro,
       max(a.data_admissao) AS admissao_mais_recente
FROM public.admissoes a
JOIN public.empresa_cadastro e ON e.id = a.empresa_id
WHERE e.ativo = false
  AND COALESCE(a.inativo, false) = false
  AND NOT EXISTS (
    SELECT 1 FROM public.empresa_cadastro v
    WHERE v.tenant_id = e.tenant_id AND v.ativo = true AND v.id <> e.id
      AND regexp_replace(COALESCE(v.cnpj, ''), '[^0-9]', '', 'g')
          = regexp_replace(COALESCE(e.cnpj, ''), '[^0-9]', '', 'g')
  )
GROUP BY 1, 2, 3
ORDER BY 4 DESC;
