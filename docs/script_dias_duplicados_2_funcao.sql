-- =====================================================================
-- Sábado duplicado: não é o dado, é a função
--
-- A varredura anterior deu zero: não existem duas linhas de ponto_diario
-- para o mesmo dia. Então a segunda aparição é criada na leitura, por
-- ponto_saldo_dias_competencia — que, além de percorrer os dias, ainda
-- ACRESCENTA uma linha de equalização no fim quando entende que o dia da
-- equalização não apareceu.
--
-- Se essa linha extra cair num sábado que JÁ apareceu, o dia duplica: uma
-- vez com as marcações reais, outra vez zerada com o rótulo Equalização.
-- É exatamente o desenho dos prints.
--
-- Falta saber QUAL dos dois ramos está disparando, e por quê. As
-- consultas abaixo respondem. Somente leitura.
-- =====================================================================

-- 1) A FUNÇÃO REALMENTE DEVOLVE O DIA DUAS VEZES? ---------------------
-- Mostra o que a apuração devolve para a Luiza no fim de junho.
WITH p AS (
  SELECT DISTINCT ON (1) tenant_id,
         regexp_replace(colaborador_cpf, '[^0-9]', '', 'g') AS cpf,
         colaborador_nome
  FROM public.ponto_diario
  WHERE colaborador_nome ILIKE '%luiza%'
  ORDER BY 1, 3
)
SELECT p.colaborador_nome, s.*
FROM p, LATERAL public.ponto_saldo_dias_competencia(p.tenant_id, p.cpf, '2026-06') s
WHERE s.dia BETWEEN '2026-06-20' AND '2026-06-30'
ORDER BY s.dia, s.equalizacao;


-- 2) O QUE EXISTE DE FATO NESSES DIAS ---------------------------------
SELECT d.colaborador_nome, d.data, d.entrada, d.saida, d.horas_trabalhadas,
       d.status, d.tipo_dia, d.observacao
FROM public.ponto_diario d
WHERE d.colaborador_nome ILIKE '%luiza%'
  AND d.data BETWEEN '2026-06-20' AND '2026-06-30'
ORDER BY d.data;


-- 3) O REGISTRO DE EQUALIZAÇÃO DA COMPETÊNCIA -------------------------
-- data_equalizacao é o dia em que a carga do mês se fecha. Se estiver
-- nula, a função escolhe sozinha o último sábado trabalhado — e é aí que
-- costuma nascer a linha extra.
SELECT pem.colaborador_cpf, pem.competencia, pem.data_equalizacao,
       pem.total_equalizacao_min, pem.art61_liberado_em
FROM public.ponto_equalizacao_mensal pem
WHERE pem.competencia = '2026-06'
  AND pem.colaborador_cpf IN (
    SELECT DISTINCT regexp_replace(colaborador_cpf, '[^0-9]', '', 'g')
    FROM public.ponto_diario
    WHERE colaborador_nome ILIKE ANY (ARRAY['%luiza%', '%adriana%'])
  );


-- 4) A ESCALA DESSAS PESSOAS ------------------------------------------
-- A escolha do dia de equalização depende da escala atribuída.
SELECT DISTINCT a.colaborador_cpf, a.colaborador_id, e.id AS escala_id,
       COALESCE(e.descricao_contratual, e.descricao_original) AS escala,
       e.jornada_diaria_minutos, e.carga_semanal_contratada_min,
       a.data_inicio, a.data_fim, a.ativa
FROM public.ponto_escala_atribuicoes a
JOIN public.ponto_escalas e ON e.id = a.escala_id
WHERE regexp_replace(COALESCE(a.colaborador_cpf,''), '[^0-9]', '', 'g') IN (
  SELECT DISTINCT regexp_replace(colaborador_cpf, '[^0-9]', '', 'g')
  FROM public.ponto_diario
  WHERE colaborador_nome ILIKE ANY (ARRAY['%luiza%', '%adriana%'])
)
ORDER BY 1;


-- 5) COMO ESTÁ A FUNÇÃO VIVA ------------------------------------------
-- Diz quais trechos existem na versão que está rodando agora, para eu
-- corrigir o ramo certo sem adivinhar.
SELECT length(d)                                   AS tamanho,
       position('v_qtd_sab' in d)                  AS tem_contagem_de_sabado,
       position('NOT v_eq_teve_linha' in d)        AS tem_bloco_eq_sem_linha,
       position('v_ult_sab' in d)                  AS tem_ultimo_sabado,
       position('v_esperado := 0' in d)            AS tem_sabado_fora_da_equalizacao,
       (SELECT count(*) FROM regexp_matches(d, 'RETURN NEXT', 'g')) AS qtd_return_next
FROM (SELECT pg_get_functiondef(
        'public.ponto_saldo_dias_competencia(uuid,text,text)'::regprocedure) AS d) x;
