-- =====================================================================
-- Mesmo CPF em duas (ou três) empresas — o que é isso, afinal
--
-- ATENÇÃO à leitura: só conta como duplicidade quando as duas empresas
-- são DO MESMO cliente (mesmo tenant). A primeira versão desta consulta
-- agrupava só por CPF e devolvia o quadro inteiro — eram pessoas
-- cadastradas em clientes diferentes da base, o que não é duplicidade
-- nenhuma: a chave única do espelho já inclui o tenant.
--
-- Duplo vínculo real, dentro do mesmo cliente, é raro e pontual. Se
-- aparecer em escala, aí sim é o CADASTRO que está duplicado.
--
-- Antes de propor conserto é preciso saber QUAL das empresas é a boa. As
-- cinco consultas abaixo respondem isso. TODAS são somente leitura: não
-- alteram nada, podem ser rodadas à vontade.
-- =====================================================================

-- 1) AS EMPRESAS, LADO A LADO ------------------------------------------
-- Se duas linhas tiverem o mesmo CNPJ (ou nomes quase iguais), é
-- empresa cadastrada em duplicidade. Repare em qual delas está o ponto:
-- empresa sem nenhum dia de ponto é a cópia.
SELECT e.tenant_id,
       e.id,
       COALESCE(e.razao_social, e.nome_fantasia) AS empresa,
       e.cnpj,
       e.ativo,
       (SELECT count(*) FROM public.admissoes a
         WHERE a.empresa_id = e.id AND COALESCE(a.inativo, false) = false) AS pessoas_ativas,
       (SELECT count(*) FROM public.admissoes a
         WHERE a.empresa_id = e.id AND COALESCE(a.inativo, false) = true)  AS pessoas_inativas,
       (SELECT count(*) FROM public.ponto_diario p WHERE p.empresa_id = e.id)   AS dias_de_ponto,
       (SELECT count(*) FROM public.ponto_espelhos s WHERE s.empresa_id = e.id) AS espelhos,
       (SELECT count(*) FROM public.ponto_banco_horas b WHERE b.empresa_id = e.id) AS bancos_de_horas
FROM public.empresa_cadastro e
ORDER BY dias_de_ponto DESC, pessoas_ativas DESC;


-- 2) QUAL É O PAR QUE SE REPETE ----------------------------------------
-- Duplicidade de cadastro aparece como UM par de empresas concentrando
-- quase todo mundo. Vínculo real aparece pulverizado.
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
       COALESCE(e2.razao_social, e2.nome_fantasia) AS empresa_b,
       count(*) AS pessoas_nas_duas
FROM v x
JOIN v y ON y.tenant_id = x.tenant_id AND y.cpf = x.cpf AND y.empresa_id > x.empresa_id
LEFT JOIN public.empresa_cadastro e1 ON e1.id = x.empresa_id
LEFT JOIN public.empresa_cadastro e2 ON e2.id = y.empresa_id
GROUP BY 1, 2
ORDER BY 3 DESC;


-- 3) UM CASO INTEIRO, PARA OLHAR DE PERTO ------------------------------
-- As admissões de quem aparece em três empresas. Compare data de
-- admissão, cargo, situação e quando o registro foi criado: cópia
-- costuma ter a mesma data de admissão e criação em lote.
WITH tres AS (
  -- Agrupado por tenant: duas empresas de CLIENTES diferentes não são
  -- duplicidade, e sem o tenant a lista viria cheia de falso positivo.
  SELECT a.tenant_id,
         regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g') AS cpf
  FROM public.admissoes a
  WHERE a.empresa_id IS NOT NULL
    AND COALESCE(a.inativo, false) = false
    AND COALESCE(a.cpf, '') <> ''
  GROUP BY 1, 2
  HAVING count(DISTINCT a.empresa_id) > 1
  LIMIT 3
)
SELECT a.nome_completo,
       regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g') AS cpf,
       COALESCE(e.razao_social, e.nome_fantasia) AS empresa,
       a.cargo, a.data_admissao, a.data_desligamento,
       a.inativo, a.bate_ponto, a.created_at
FROM public.admissoes a
LEFT JOIN public.empresa_cadastro e ON e.id = a.empresa_id
WHERE EXISTS (
  SELECT 1 FROM tres t
  WHERE t.tenant_id = a.tenant_id
    AND t.cpf = regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g')
)
ORDER BY 2, a.created_at;


-- 4) ONDE ESTÁ O PONTO DE QUEM TEM MAIS DE UMA EMPRESA -----------------
-- Se o ponto de todos eles está numa empresa só, essa é a de verdade —
-- as outras são cadastro sobrando. Se estiver dividido, aí sim há
-- movimentação real entre empresas para entender.
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
SELECT COALESCE(e.razao_social, e.nome_fantasia, '(sem empresa)') AS empresa_do_ponto,
       count(*) AS dias_de_ponto,
       count(DISTINCT regexp_replace(COALESCE(pd.colaborador_cpf, ''), '[^0-9]', '', 'g')) AS pessoas,
       min(pd.data) AS primeiro,
       max(pd.data) AS ultimo
FROM public.ponto_diario pd
JOIN multi m ON m.tenant_id = pd.tenant_id
            AND m.cpf = regexp_replace(COALESCE(pd.colaborador_cpf, ''), '[^0-9]', '', 'g')
LEFT JOIN public.empresa_cadastro e ON e.id = pd.empresa_id
GROUP BY 1
ORDER BY 2 DESC;


-- 5) O RISCO CONCRETO, HOJE --------------------------------------------
-- Espelho e banco de horas têm chave única por CPF e competência, SEM a
-- empresa. Se as duas empresas fecharem a mesma competência, a segunda
-- sobrescreve a primeira. Isto mostra quantas pessoas estão nessa
-- situação por competência já fechada.
SELECT s.competencia,
       count(*) AS espelhos,
       count(*) FILTER (
         WHERE EXISTS (
           SELECT 1 FROM public.admissoes a
           WHERE a.tenant_id = s.tenant_id
             AND COALESCE(a.inativo, false) = false
             AND a.empresa_id IS NOT NULL
             AND regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g')
                 = regexp_replace(COALESCE(s.colaborador_cpf, ''), '[^0-9]', '', 'g')
           GROUP BY a.tenant_id
           HAVING count(DISTINCT a.empresa_id) > 1
         )
       ) AS espelhos_disputados
FROM public.ponto_espelhos s
GROUP BY 1
ORDER BY 1 DESC;
