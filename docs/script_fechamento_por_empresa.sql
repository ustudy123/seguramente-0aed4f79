-- =====================================================================
-- Fechamento fecha o tenant inteiro, ignorando a empresa selecionada
--
-- Relato: "fechando o banco de horas, ele fecha pra todas as empresas, e
-- não por filial/empresa que está logado/selecionada na barra do topo".
--
-- É isso mesmo, e em dois lugares:
--
-- 1) NA TELA (corrigido no frontend, nesta mesma entrega): o "Fechar
--    Período" lia ponto_diario só por tenant + intervalo de datas, sem
--    empresa nenhuma. Gerava espelho para TODO colaborador do tenant e
--    ainda carimbava cada um deles com a empresa que estava selecionada
--    na barra do topo — ou seja, além de fechar demais, atribuía gente da
--    empresa A à empresa B. A pré-visualização logo acima do botão já era
--    por empresa: a lista mudava depois de fechar.
--
-- 2) NO BANCO (este arquivo): as funções de apuração filtram assim:
--
--      AND (p_empresa_id IS NULL OR empresa_id = p_empresa_id
--                                OR empresa_id IS NULL)
--
--    Esse "OR empresa_id IS NULL" foi uma válvula de escape para quando
--    ponto_diario não tinha empresa preenchida. O efeito colateral é que
--    todo colaborador sem empresa entra na apuração de TODAS as empresas
--    — e o reapurar ainda o carimbava com a empresa da vez
--    (COALESCE(p_empresa_id, r.empresa_id)), mudando a empresa de quem já
--    tinha a sua.
--
-- Correção, na ordem:
--   a) resolver a empresa pelo cadastro (admissões) quando a linha não
--      tem empresa, em vez de aceitar qualquer uma;
--   b) preencher o que está em branco (ponto_diario, banco de horas,
--      espelhos), para o filtro passar a ter em que se apoiar;
--   c) trocar o "OR IS NULL" pelo empresa resolvida = empresa pedida;
--   d) parar de reatribuir empresa de quem já tem.
--
-- Quem NÃO tem empresa em lugar nenhum passa a aparecer apenas na visão
-- "todas as empresas". Some da apuração de cada empresa individual — o
-- que é o certo: ninguém deve ser fechado por uma empresa a que não
-- pertence. A função de diagnóstico no fim lista essas pessoas.
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


-- b) PREENCHER O QUE ESTÁ EM BRANCO ------------------------------------
-- Só onde está NULL. Linha que já tem empresa não é tocada: se estiver
-- errada, é caso de cadastro, e sobrescrever aqui esconderia o problema.
-- Uma tabela por bloco: se uma falhar, as outras continuam preenchidas.
DO $backfill$
DECLARE
  v_n int := 0;
BEGIN
  BEGIN
    UPDATE public.ponto_diario pd
    SET empresa_id = public.ponto_empresa_do_cpf(pd.tenant_id, pd.colaborador_cpf),
        updated_at = now()
    WHERE pd.empresa_id IS NULL
      AND public.ponto_empresa_do_cpf(pd.tenant_id, pd.colaborador_cpf) IS NOT NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE 'ponto_diario: % dias ganharam empresa.', v_n;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ponto_diario não preenchido: %', SQLERRM;
  END;

  BEGIN
    UPDATE public.ponto_banco_horas bh
    SET empresa_id = public.ponto_empresa_do_cpf(bh.tenant_id, bh.colaborador_cpf),
        updated_at = now()
    WHERE bh.empresa_id IS NULL
      AND public.ponto_empresa_do_cpf(bh.tenant_id, bh.colaborador_cpf) IS NOT NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE 'ponto_banco_horas: % registros ganharam empresa.', v_n;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ponto_banco_horas não preenchido: %', SQLERRM;
  END;

  BEGIN
    UPDATE public.ponto_espelhos e
    SET empresa_id = public.ponto_empresa_do_cpf(e.tenant_id, e.colaborador_cpf)
    WHERE e.empresa_id IS NULL
      AND public.ponto_empresa_do_cpf(e.tenant_id, e.colaborador_cpf) IS NOT NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE 'ponto_espelhos: % espelhos ganharam empresa.', v_n;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ponto_espelhos não preenchido: %', SQLERRM;
  END;
END $backfill$;


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
  SELECT regexp_replace(pd.colaborador_cpf, '[^0-9]', '', 'g'),
         max(pd.colaborador_nome),
         count(*)::int,
         bool_or(EXISTS (
           SELECT 1 FROM public.admissoes a
           WHERE a.tenant_id = pd.tenant_id
             AND regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g')
                 = regexp_replace(pd.colaborador_cpf, '[^0-9]', '', 'g')
         ))
  FROM public.ponto_diario pd, periodo p
  WHERE pd.tenant_id = p_tenant_id
    AND pd.data BETWEEN p.ini AND p.fim
    AND COALESCE(pd.colaborador_cpf, '') <> ''
    AND pd.empresa_id IS NULL
    AND public.ponto_empresa_do_cpf(pd.tenant_id, pd.colaborador_cpf) IS NULL
  GROUP BY 1
  ORDER BY 3 DESC, 2;
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


-- =====================================================================
-- CONFERÊNCIA — rode junto e confira o resultado
-- Todas as colunas devem vir "true". Nada aqui altera dados.
-- =====================================================================
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

-- Quanto ainda está sem empresa depois do preenchimento. Zero é o ideal;
-- o que sobrar é cadastro sem empresa na admissão.
SELECT
  (SELECT count(*) FROM public.ponto_diario      WHERE empresa_id IS NULL) AS dias_sem_empresa,
  (SELECT count(*) FROM public.ponto_banco_horas WHERE empresa_id IS NULL) AS bancos_sem_empresa,
  (SELECT count(*) FROM public.ponto_espelhos    WHERE empresa_id IS NULL) AS espelhos_sem_empresa;

-- Quem tem ponto e não pertence a empresa nenhuma (troque a competência).
-- Essas pessoas só aparecem na visão "todas as empresas".
-- SELECT * FROM public.ponto_colaboradores_sem_empresa(
--   (SELECT tenant_id FROM public.usuarios_base WHERE auth_user_id = auth.uid() LIMIT 1),
--   '2026-07');

-- Mesmo CPF em duas empresas do mesmo tenant. Se voltar alguma linha,
-- avise: o espelho e o banco de horas têm chave única por CPF e
-- competência, sem a empresa, e as duas empresas disputariam a mesma
-- linha ao fechar.
-- SELECT * FROM public.ponto_cpfs_em_mais_de_uma_empresa(
--   (SELECT tenant_id FROM public.usuarios_base WHERE auth_user_id = auth.uid() LIMIT 1));
