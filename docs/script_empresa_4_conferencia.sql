-- =====================================================================
-- Fechamento por empresa: conferência
-- Parte 4 de 4 — só leitura, não altera nada. Pode rodar quantas vezes
-- quiser, e a qualquer momento depois.
--
-- Devolve cinco resultados, um abaixo do outro no painel de resultados.
-- =====================================================================

-- 1) AS ROTINAS ESTÃO CORRIGIDAS? --------------------------------------
-- Todas as colunas devem vir "true".
SELECT
  to_regprocedure('public.ponto_empresa_do_cpf(uuid,text)') IS NOT NULL
    AS ferramenta_empresa_ok,
  position('ponto_empresa_do_cpf' in
    COALESCE(pg_get_functiondef(to_regprocedure('public.apurar_banco_horas(uuid,text,uuid)')), '')) > 0
    AS apuracao_por_empresa_ok,
  position('ponto_empresa_do_cpf' in
    COALESCE(pg_get_functiondef(to_regprocedure('public.reapurar_banco_horas_competencias(uuid,uuid,text,text)')), '')) > 0
    AS reapuracao_por_empresa_ok,
  position('IF v_empresa_id IS NULL THEN' in
    COALESCE(pg_get_functiondef(to_regprocedure('public.apurar_banco_horas_colaborador(uuid,text,text,uuid)')), '')) > 0
    AS preserva_empresa_ok,
  position('ponto_empresa_do_cpf' in
    COALESCE(pg_get_functiondef(to_regprocedure('public.ponto_espelho_resumo_empresa(uuid,uuid,text)')), '')) > 0
    AS espelho_por_empresa_ok;


-- 2) AINDA HÁ REGISTRO SEM EMPRESA? ------------------------------------
-- O ideal é zero nas três colunas. O que sobrar é colaborador cuja
-- admissão não diz a empresa — veja quem é na consulta 3.
SELECT
  (SELECT count(*) FROM public.ponto_diario      WHERE empresa_id IS NULL) AS dias_sem_empresa,
  (SELECT count(*) FROM public.ponto_banco_horas WHERE empresa_id IS NULL) AS bancos_sem_empresa,
  (SELECT count(*) FROM public.ponto_espelhos    WHERE empresa_id IS NULL) AS espelhos_sem_empresa;


-- 3) QUEM TEM PONTO E NÃO PERTENCE A EMPRESA NENHUMA -------------------
-- Essas pessoas só aparecem na visão "todas as empresas" até a empresa
-- ser preenchida na admissão delas.
--
-- Sem parâmetro de tenant de propósito: no editor do Supabase você entra
-- como "postgres", sem sessão de usuário, então auth.uid() é nulo e
-- qualquer consulta que dependa dele voltaria vazia sem motivo.
WITH cadastro AS (
  SELECT a.tenant_id,
         regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g') AS cpf,
         bool_or(a.empresa_id IS NOT NULL) AS tem_empresa
  FROM public.admissoes a
  WHERE COALESCE(a.cpf, '') <> ''
  GROUP BY 1, 2
),
dias AS (
  SELECT pd.tenant_id,
         regexp_replace(COALESCE(pd.colaborador_cpf, ''), '[^0-9]', '', 'g') AS cpf,
         max(pd.colaborador_nome) AS nome,
         count(*)::int AS dias_sem_empresa,
         min(pd.data) AS primeiro,
         max(pd.data) AS ultimo
  FROM public.ponto_diario pd
  WHERE pd.empresa_id IS NULL
    AND COALESCE(pd.colaborador_cpf, '') <> ''
  GROUP BY 1, 2
)
SELECT d.nome, d.cpf, d.dias_sem_empresa, d.primeiro, d.ultimo,
       CASE WHEN c.cpf IS NULL THEN 'sem admissão cadastrada'
            ELSE 'admissão sem empresa preenchida' END AS situacao
FROM dias d
LEFT JOIN cadastro c ON c.tenant_id = d.tenant_id AND c.cpf = d.cpf
WHERE c.cpf IS NULL OR NOT c.tem_empresa
ORDER BY d.dias_sem_empresa DESC, d.nome;


-- 4) AINDA HÁ REGISTRO NA EMPRESA ERRADA? ------------------------------
-- Atribuído a uma empresa em que o colaborador não tem admissão. Depois
-- da parte 3 deve vir vazio (nenhuma linha).
WITH vinculos AS (
  SELECT DISTINCT a.tenant_id,
         regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g') AS cpf,
         a.empresa_id
  FROM public.admissoes a
  WHERE a.empresa_id IS NOT NULL AND COALESCE(a.cpf, '') <> ''
),
suspeitos AS (
  SELECT 'ponto_espelhos' AS tabela, e.tenant_id,
         regexp_replace(COALESCE(e.colaborador_cpf, ''), '[^0-9]', '', 'g') AS cpf,
         e.empresa_id
  FROM public.ponto_espelhos e WHERE e.empresa_id IS NOT NULL
  UNION ALL
  SELECT 'ponto_banco_horas', b.tenant_id,
         regexp_replace(COALESCE(b.colaborador_cpf, ''), '[^0-9]', '', 'g'),
         b.empresa_id
  FROM public.ponto_banco_horas b WHERE b.empresa_id IS NOT NULL
  UNION ALL
  SELECT 'ponto_diario', d.tenant_id,
         regexp_replace(COALESCE(d.colaborador_cpf, ''), '[^0-9]', '', 'g'),
         d.empresa_id
  FROM public.ponto_diario d WHERE d.empresa_id IS NOT NULL
)
SELECT s.tabela, count(*) AS registros_na_empresa_errada
FROM suspeitos s
WHERE EXISTS (SELECT 1 FROM vinculos v WHERE v.tenant_id = s.tenant_id AND v.cpf = s.cpf)
  AND NOT EXISTS (
    SELECT 1 FROM vinculos v
    WHERE v.tenant_id = s.tenant_id AND v.cpf = s.cpf AND v.empresa_id = s.empresa_id
  )
GROUP BY 1
ORDER BY 1;


-- 5) MESMO CPF EM MAIS DE UMA EMPRESA DO MESMO CLIENTE ----------------
-- O agrupamento inclui o tenant DE PROPÓSITO. Sem ele, quem está
-- cadastrado em dois clientes diferentes da base aparece como se
-- tivesse duas empresas, e a lista sai enorme sem significar nada: a
-- chave única do espelho e do banco de horas já inclui o tenant, então
-- clientes distintos nunca disputam a mesma linha.
--
-- Se voltar alguma linha aqui, aí sim avise: são duas empresas DO MESMO
-- cliente disputando o espelho da mesma pessoa. É correção à parte.
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
