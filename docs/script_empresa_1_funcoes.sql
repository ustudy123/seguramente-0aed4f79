-- =====================================================================
-- Fechamento por empresa: funções e rotinas de apuração
-- Parte 1 de 4 — rode UMA parte por vez, na ordem.
--
-- Por que em partes: o editor do Supabase roda o arquivo inteiro numa
-- transação só e tem tempo limite. Se uma parte estourar, tudo o que
-- veio antes é descartado. Em quatro execuções curtas, cada uma se
-- garante sozinha.
-- =====================================================================
-- a) EMPRESA DO COLABORADOR, PELO CPF ---------------------------------
-- Já existe ponto_empresa_do_colaborador(colaborador_id), mas boa parte
-- do ponto é localizada por CPF (colaborador_id nem sempre vem
-- preenchido). Prefere admissão ativa; entre várias, a mais recente.
CREATE OR REPLACE FUNCTION public.ponto_empresa_do_cpf(
  p_tenant_id uuid,
  p_cpf text
)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT a.empresa_id
  FROM public.admissoes a
  WHERE a.tenant_id = p_tenant_id
    AND a.empresa_id IS NOT NULL
    AND regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g')
        = regexp_replace(COALESCE(p_cpf, ''), '[^0-9]', '', 'g')
  ORDER BY COALESCE(a.inativo, false), a.data_admissao DESC NULLS LAST
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.ponto_empresa_do_cpf(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ponto_empresa_do_cpf(uuid, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.ponto_empresa_do_cpf(uuid, text) IS
  'Empresa do colaborador segundo o cadastro de admissões, localizada por CPF. Usada para atribuir o ponto à empresa certa quando a linha do dia não tem empresa preenchida.';


-- c) APURAÇÃO POR EMPRESA ----------------------------------------------
-- Patch sobre a definição viva: apurar_banco_horas já recebeu correções
-- por esse caminho e reescrevê-la a partir do arquivo perderia o que veio
-- depois. Idempotente e sem RAISE EXCEPTION — este arquivo roda inteiro
-- numa transação só, e abortar aqui descartaria as outras partes.
DO $apurar$
DECLARE
  d text;
  v_alvo text := '(p_empresa_id IS NULL OR empresa_id = p_empresa_id OR empresa_id IS NULL)';
  v_novo text := '(p_empresa_id IS NULL OR COALESCE(empresa_id, public.ponto_empresa_do_cpf(p_tenant_id, colaborador_cpf)) = p_empresa_id)';
BEGIN
  d := pg_get_functiondef('public.apurar_banco_horas(uuid,text,uuid)'::regprocedure);

  IF position('ponto_empresa_do_cpf' in d) > 0 THEN
    RAISE NOTICE 'apurar_banco_horas já filtra por empresa resolvida — nada a fazer.';
  ELSIF position(v_alvo in d) = 0 THEN
    RAISE NOTICE 'apurar_banco_horas: filtro esperado não encontrado — não alterada.';
  ELSE
    EXECUTE replace(d, v_alvo, v_novo);
    RAISE NOTICE 'apurar_banco_horas passa a apurar só a empresa pedida.';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'apurar_banco_horas não alterada: %', SQLERRM;
END $apurar$;


-- Reapuração: mesmo filtro, e para de reatribuir empresa.
DO $reapurar$
DECLARE
  d text;
  v_filtro text := '(p_empresa_id IS NULL OR bh.empresa_id = p_empresa_id OR bh.empresa_id IS NULL)';
  v_filtro_novo text := '(p_empresa_id IS NULL OR COALESCE(bh.empresa_id, public.ponto_empresa_do_cpf(p_tenant_id, bh.colaborador_cpf)) = p_empresa_id)';
  -- A empresa da linha manda; a selecionada na tela só preenche o vazio.
  v_carimbo text := 'COALESCE(p_empresa_id, r.empresa_id)';
  v_carimbo_novo text := 'COALESCE(r.empresa_id, public.ponto_empresa_do_cpf(p_tenant_id, r.colaborador_cpf), p_empresa_id)';
BEGIN
  d := pg_get_functiondef('public.reapurar_banco_horas_competencias(uuid,uuid,text,text)'::regprocedure);

  IF position('ponto_empresa_do_cpf' in d) > 0 THEN
    RAISE NOTICE 'reapurar_banco_horas_competencias já corrigida — nada a fazer.';
  ELSIF position(v_filtro in d) = 0 OR position(v_carimbo in d) = 0 THEN
    RAISE NOTICE 'reapurar_banco_horas_competencias: trecho esperado não encontrado — não alterada.';
  ELSE
    d := replace(d, v_filtro, v_filtro_novo);
    d := replace(d, v_carimbo, v_carimbo_novo);
    EXECUTE d;
    RAISE NOTICE 'reapurar_banco_horas_competencias passa a respeitar a empresa da linha.';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'reapurar_banco_horas_competencias não alterada: %', SQLERRM;
END $reapurar$;


-- d) NÃO MUDAR A EMPRESA DE QUEM JÁ TEM --------------------------------
-- apurar_banco_horas_colaborador lia a empresa do ponto do colaborador e
-- em seguida a substituía pela empresa selecionada. Apurar pela empresa B
-- movia para B quem era da A.
DO $colab$
DECLARE
  d text;
  v_alvo text := 'IF p_empresa_id IS NOT NULL THEN
    v_empresa_id := p_empresa_id;
  END IF;';
  v_novo text := 'IF v_empresa_id IS NULL THEN
    v_empresa_id := COALESCE(public.ponto_empresa_do_cpf(p_tenant_id, p_colaborador_cpf), p_empresa_id);
  END IF;';
BEGIN
  d := pg_get_functiondef('public.apurar_banco_horas_colaborador(uuid,text,text,uuid)'::regprocedure);

  IF position('IF v_empresa_id IS NULL THEN' in d) > 0 THEN
    RAISE NOTICE 'apurar_banco_horas_colaborador já preserva a empresa — nada a fazer.';
  ELSIF position(v_alvo in d) = 0 THEN
    RAISE NOTICE 'apurar_banco_horas_colaborador: trecho esperado não encontrado — não alterada.';
  ELSE
    EXECUTE replace(d, v_alvo, v_novo);
    RAISE NOTICE 'apurar_banco_horas_colaborador preserva a empresa do colaborador.';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'apurar_banco_horas_colaborador não alterada: %', SQLERRM;
END $colab$;


-- e) RESUMO DO ESPELHO POR EMPRESA -------------------------------------
-- Mesma troca do "OR empresa_id IS NULL". É esta função que alimenta a
-- pré-visualização do fechamento e, agora, o próprio fechamento.
CREATE OR REPLACE FUNCTION public.ponto_espelho_resumo_empresa(
  p_tenant_id uuid,
  p_empresa_id uuid,
  p_competencia text
)
RETURNS TABLE(
  colaborador_cpf text,
  colaborador_nome text,
  colaborador_id uuid,
  dias_com_registro integer,
  dias_trabalhados integer,
  total_trabalhado_min integer,
  total_jornada_prevista_min integer,
  total_creditos_min integer,
  total_debitos_min integer,
  saldo_min integer,
  total_faltas integer,
  dias_protegidos integer,
  excedente_retido_min integer,
  dia_equalizacao date
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ini date := to_date(p_competencia || '-01', 'YYYY-MM-DD');
  v_fim date := (to_date(p_competencia || '-01', 'YYYY-MM-DD') + interval '1 month - 1 day')::date;
  r RECORD;
BEGIN
  FOR r IN
    SELECT regexp_replace(pd.colaborador_cpf, '[^0-9]', '', 'g') AS cpf,
           max(pd.colaborador_nome) AS nome,
           max(pd.colaborador_id::text)::uuid AS cid
    FROM public.ponto_diario pd
    WHERE pd.tenant_id = p_tenant_id
      AND pd.data BETWEEN v_ini AND v_fim
      AND COALESCE(pd.colaborador_cpf, '') <> ''
      AND (
        p_empresa_id IS NULL
        OR COALESCE(pd.empresa_id,
                    public.ponto_empresa_do_cpf(p_tenant_id, pd.colaborador_cpf)) = p_empresa_id
      )
    GROUP BY 1
    ORDER BY 2
  LOOP
    RETURN QUERY
    SELECT r.cpf, r.nome, r.cid, s.*
    FROM public.ponto_espelho_resumo(p_tenant_id, r.cpf, p_competencia) s;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ponto_espelho_resumo_empresa(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ponto_espelho_resumo_empresa(uuid, uuid, text) TO authenticated;


-- f) DIAGNÓSTICO -------------------------------------------------------
-- Quem tem ponto na competência e não consegue ser atribuído a nenhuma
-- empresa. Essas pessoas só aparecem na visão "todas as empresas" — o
-- conserto é no cadastro (admissão sem empresa), não aqui.
CREATE OR REPLACE FUNCTION public.ponto_colaboradores_sem_empresa(
  p_tenant_id uuid,
  p_competencia text
)
RETURNS TABLE(
  colaborador_cpf text,
  colaborador_nome text,
  dias_no_periodo integer,
  tem_admissao boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH periodo AS (
    SELECT to_date(p_competencia || '-01', 'YYYY-MM-DD') AS ini,
           (to_date(p_competencia || '-01', 'YYYY-MM-DD') + interval '1 month - 1 day')::date AS fim
  )
  , cadastro AS (
    -- Um passe pelas admissões do tenant, em vez de uma consulta por dia
    -- de ponto: com a função por linha isto ficava lento em base grande.
    SELECT regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g') AS cpf,
           bool_or(a.empresa_id IS NOT NULL) AS tem_empresa
    FROM public.admissoes a
    WHERE a.tenant_id = p_tenant_id
      AND COALESCE(a.cpf, '') <> ''
    GROUP BY 1
  ),
  dias AS (
    SELECT regexp_replace(pd.colaborador_cpf, '[^0-9]', '', 'g') AS cpf,
           max(pd.colaborador_nome) AS nome,
           count(*)::int AS dias
    FROM public.ponto_diario pd, periodo p
    WHERE pd.tenant_id = p_tenant_id
      AND pd.data BETWEEN p.ini AND p.fim
      AND COALESCE(pd.colaborador_cpf, '') <> ''
      AND pd.empresa_id IS NULL
    GROUP BY 1
  )
  SELECT d.cpf, d.nome, d.dias, (c.cpf IS NOT NULL)
  FROM dias d
  LEFT JOIN cadastro c ON c.cpf = d.cpf
  -- Sem admissão nenhuma, ou com admissão que não diz a empresa.
  WHERE c.cpf IS NULL OR NOT c.tem_empresa
  ORDER BY d.dias DESC, d.nome;
$$;

REVOKE EXECUTE ON FUNCTION public.ponto_colaboradores_sem_empresa(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ponto_colaboradores_sem_empresa(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.ponto_colaboradores_sem_empresa(uuid, text) IS
  'Colaboradores com ponto na competência que não podem ser atribuídos a nenhuma empresa. Aparecem só na visão "todas as empresas" até o cadastro ser corrigido.';


-- Mesmo CPF em mais de uma empresa do mesmo tenant: caso legítimo (dois
-- vínculos), mas ponto_espelhos e ponto_banco_horas têm chave única
-- (tenant, cpf, competência), SEM a empresa — as duas empresas
-- disputariam a mesma linha e a última a fechar venceria. Não mexemos na
-- chave às cegas; esta consulta diz se o caso existe nesta base.
CREATE OR REPLACE FUNCTION public.ponto_cpfs_em_mais_de_uma_empresa(p_tenant_id uuid)
RETURNS TABLE(colaborador_cpf text, colaborador_nome text, empresas integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g'),
         max(a.nome_completo),
         count(DISTINCT a.empresa_id)::int
  FROM public.admissoes a
  WHERE a.tenant_id = p_tenant_id
    AND a.empresa_id IS NOT NULL
    AND COALESCE(a.inativo, false) = false
    AND COALESCE(a.cpf, '') <> ''
  GROUP BY 1
  HAVING count(DISTINCT a.empresa_id) > 1
  ORDER BY 3 DESC, 2;
$$;

REVOKE EXECUTE ON FUNCTION public.ponto_cpfs_em_mais_de_uma_empresa(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ponto_cpfs_em_mais_de_uma_empresa(uuid) TO authenticated;
