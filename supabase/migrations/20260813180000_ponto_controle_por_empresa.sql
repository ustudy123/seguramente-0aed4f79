-- =====================================================================
-- Materialização de faltas só onde o ponto é realmente usado
--
-- MEDIDO NA PRODUÇÃO em 13/08, depois de consertar a materialização:
--   · 11.842 colaboradores sem linha de espelho na competência;
--   · 11.788 deles (99,5%) NUNCA bateram ponto uma única vez;
--   ·     14 empresas de 1.401 têm alguma batida nos últimos 180 dias.
--
-- Mandar materializar nesse estado criaria ~271 mil faltas para gente que
-- nunca esteve no controle de jornada, em dezenas de clientes ao mesmo
-- tempo. Absenteísmo, descontos e painéis contaminados de uma vez.
--
-- A causa não é a materialização: é que NÃO EXISTE, em lugar nenhum do
-- sistema, uma forma de dizer "esta empresa não usa controle de jornada".
-- admissoes.bate_ponto nasce `true` por padrão, então toda pessoa já
-- cadastrada — em qualquer cliente, tenha ou não o módulo em uso — entra
-- na conta.
--
-- É o que a rotina de QA PONTO-371 já cobra: "empresa que NÃO adota
-- controle é tratada igual às demais; a materialização gera falta em todo
-- dia útil sem marcação e o painel enche de pendências indevidas.
-- Correção: flag por empresa/estabelecimento". O art. 74, §2º da CLT
-- torna o controle obrigatório acima de 20 trabalhadores no
-- ESTABELECIMENTO — abaixo disso é facultativo, e tratar quem não optou
-- como se tivesse optado é inventar falta.
--
-- O QUE ESTE ARQUIVO FAZ
--   1. Cria a chave por empresa (empresa_cadastro.usa_controle_ponto) e
--      a chave-mestra por cliente (ponto_configuracao.controle_ponto_ativo).
--   2. SEMEIA a chave por empresa a partir do que já aconteceu: liga
--      apenas onde existe batida de verdade. Não adivinha nada — quem
--      nunca bateu nasce desligado.
--   3. A materialização e o diagnóstico passam a respeitar as chaves,
--      com uma rede de segurança: quem bate ponto é sempre coberto,
--      mesmo que a chave da empresa esteja desligada por engano.
--
-- A rede de segurança importa. Sem ela, uma empresa que adota o ponto
-- hoje e esquece de ligar a chave ficaria com o espelho vazio e ninguém
-- perceberia. Com ela, a primeira batida já traz aquela pessoa para a
-- apuração, e a chave pode ser ligada depois sem perda.
-- =====================================================================

SET lock_timeout = '10s';

-- ── 1) As chaves ─────────────────────────────────────────────────────
ALTER TABLE public.empresa_cadastro
  ADD COLUMN IF NOT EXISTS usa_controle_ponto boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.empresa_cadastro.usa_controle_ponto IS
  'Esta empresa adota controle de jornada? Desligado, ela não gera falta por dia sem marcação. CLT art. 74, §2º: obrigatório acima de 20 trabalhadores no estabelecimento, facultativo abaixo.';

ALTER TABLE public.ponto_configuracao
  ADD COLUMN IF NOT EXISTS controle_ponto_ativo boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.ponto_configuracao.controle_ponto_ativo IS
  'Chave-mestra do cliente. Desligada, nenhuma empresa dele gera falta por dia sem marcação, independente da chave de cada uma.';

-- ── 2) Semeadura a partir do que já aconteceu ────────────────────────
-- Liga só onde há batida real. Duas origens, porque a marcação nem sempre
-- carrega empresa_id: pela empresa gravada na batida e pela admissão do
-- CPF que bateu.
DO $seed$
DECLARE v_n int;
BEGIN
  WITH ativas AS (
    SELECT DISTINCT m.tenant_id, m.empresa_id
    FROM public.ponto_marcacoes m
    WHERE m.empresa_id IS NOT NULL

    UNION

    SELECT DISTINCT a.tenant_id, a.empresa_id
    FROM public.ponto_marcacoes m
    JOIN public.admissoes a
      ON a.tenant_id = m.tenant_id
     AND regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g')
         = regexp_replace(COALESCE(m.colaborador_cpf, ''), '[^0-9]', '', 'g')
    WHERE a.empresa_id IS NOT NULL
  ), lig AS (
    UPDATE public.empresa_cadastro e
       SET usa_controle_ponto = true
      FROM ativas x
     WHERE e.id = x.empresa_id
       AND e.tenant_id = x.tenant_id
       AND e.usa_controle_ponto = false
    RETURNING e.id
  )
  SELECT count(*) INTO v_n FROM lig;

  RAISE NOTICE 'Controle de ponto ligado em % empresa(s), com base em batida existente.', v_n;
END $seed$;

-- ── 3) Quem está no regime de ponto ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.ponto_empresas_em_regime(p_tenant_id uuid)
RETURNS TABLE(empresa_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT e.id
  FROM public.empresa_cadastro e
  WHERE e.tenant_id = p_tenant_id
    AND e.usa_controle_ponto
    AND COALESCE((SELECT c.controle_ponto_ativo FROM public.ponto_configuracao c
                   WHERE c.tenant_id = p_tenant_id), true);
$$;

COMMENT ON FUNCTION public.ponto_empresas_em_regime(uuid) IS
  'Empresas do cliente que adotam controle de jornada. Só elas geram falta por dia sem marcação.';

-- Rede de segurança: quem bateu ponto no último ano é sempre apurado,
-- mesmo que a chave da empresa esteja desligada.
CREATE OR REPLACE FUNCTION public.ponto_cpfs_em_regime(p_tenant_id uuid, p_ref date)
RETURNS TABLE(cpf text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT regexp_replace(COALESCE(m.colaborador_cpf, ''), '[^0-9]', '', 'g')
  FROM public.ponto_marcacoes m
  WHERE m.tenant_id = p_tenant_id
    AND m.data_marcacao >= p_ref - 365
    AND COALESCE(m.colaborador_cpf, '') <> '';
$$;

-- ── 4) A materialização passa a respeitar as chaves ──────────────────
CREATE OR REPLACE FUNCTION public.consolidar_ponto_dia_todos(p_tenant_id UUID, p_data DATE)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $todos$
DECLARE
  v_colab RECORD;
  v_n INT := 0;
BEGIN
  FOR v_colab IN
    SELECT DISTINCT regexp_replace(a.cpf, '[^0-9]', '', 'g') AS cpf
    FROM public.admissoes a
    WHERE a.tenant_id = p_tenant_id AND a.cpf IS NOT NULL
      AND COALESCE(a.inativo, false) = false
      AND COALESCE(a.bate_ponto, true) = true
      AND a.data_admissao <= p_data
      AND (
        a.empresa_id IN (SELECT r.empresa_id FROM public.ponto_empresas_em_regime(p_tenant_id) r)
        OR regexp_replace(a.cpf, '[^0-9]', '', 'g')
           IN (SELECT c.cpf FROM public.ponto_cpfs_em_regime(p_tenant_id, p_data) c)
      )
  LOOP
    PERFORM public.consolidar_ponto_diario_manual(p_tenant_id, v_colab.cpf, p_data);
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$todos$;

REVOKE EXECUTE ON FUNCTION public.consolidar_ponto_dia_todos(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consolidar_ponto_dia_todos(uuid, date) TO authenticated;

-- ── 5) O diagnóstico usa exatamente o mesmo critério ─────────────────
-- Se ele apontasse um buraco que a materialização não preenche, o RH
-- ficaria perseguindo um número que nunca zera.
CREATE OR REPLACE FUNCTION public.ponto_dias_nao_materializados(
  p_tenant_id uuid,
  p_competencia text
)
RETURNS TABLE(
  colaborador_cpf text,
  colaborador_nome text,
  dias_sem_linha integer,
  primeiro date,
  ultimo date
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH periodo AS (
    SELECT to_date(p_competencia || '-01', 'YYYY-MM-DD') AS ini,
           LEAST((to_date(p_competencia || '-01', 'YYYY-MM-DD')
                  + interval '1 month - 1 day')::date, CURRENT_DATE - 1) AS fim
  ),
  dias AS (
    SELECT g::date AS d FROM periodo p, generate_series(p.ini, p.fim, interval '1 day') g
    WHERE EXTRACT(ISODOW FROM g) BETWEEN 1 AND 5
  ),
  regime AS (
    SELECT r.empresa_id FROM public.ponto_empresas_em_regime(p_tenant_id) r
  ),
  batedores AS (
    SELECT c.cpf FROM periodo p,
         LATERAL public.ponto_cpfs_em_regime(p_tenant_id, p.fim) c
  ),
  pessoas AS (
    SELECT DISTINCT regexp_replace(a.cpf, '[^0-9]', '', 'g') AS cpf,
           max(a.nome_completo) AS nome,
           min(a.data_admissao) AS admissao
    FROM public.admissoes a
    WHERE a.tenant_id = p_tenant_id
      AND COALESCE(a.inativo, false) = false
      AND COALESCE(a.bate_ponto, true) = true
      AND a.cpf IS NOT NULL
      AND (a.empresa_id IN (SELECT empresa_id FROM regime)
           OR regexp_replace(a.cpf, '[^0-9]', '', 'g') IN (SELECT cpf FROM batedores))
    GROUP BY 1
  )
  SELECT p.cpf, p.nome, count(*)::int, min(d.d), max(d.d)
  FROM pessoas p
  CROSS JOIN dias d
  WHERE d.d >= COALESCE(p.admissao, d.d)
    AND NOT EXISTS (
      SELECT 1 FROM public.ponto_diario pd
      WHERE pd.tenant_id = p_tenant_id
        AND regexp_replace(pd.colaborador_cpf, '[^0-9]', '', 'g') = p.cpf
        AND pd.data = d.d
    )
  GROUP BY p.cpf, p.nome
  HAVING count(*) > 0
  ORDER BY count(*) DESC, p.nome;
$$;

REVOKE EXECUTE ON FUNCTION public.ponto_dias_nao_materializados(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ponto_dias_nao_materializados(uuid, text) TO authenticated;

-- ── Conferência ──────────────────────────────────────────────────────
DO $verifica$
DECLARE v_falta text := '';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'empresa_cadastro' AND column_name = 'usa_controle_ponto') THEN
    v_falta := v_falta || ' empresa_cadastro.usa_controle_ponto';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'ponto_configuracao' AND column_name = 'controle_ponto_ativo') THEN
    v_falta := v_falta || ' ponto_configuracao.controle_ponto_ativo';
  END IF;
  IF to_regprocedure('public.ponto_empresas_em_regime(uuid)') IS NULL THEN
    v_falta := v_falta || ' ponto_empresas_em_regime';
  END IF;
  IF v_falta <> '' THEN
    RAISE EXCEPTION 'Instalação incompleta:%', v_falta;
  END IF;
  RAISE NOTICE 'OK: falta só é gerada onde o controle de jornada está em uso.';
END $verifica$;
