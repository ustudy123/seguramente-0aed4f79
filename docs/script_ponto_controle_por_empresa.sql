-- =====================================================================
-- ENTREGA · Falta só onde o controle de jornada está em uso
--
-- COLE ESTE ARQUIVO INTEIRO no SQL Editor do projeto de PRODUÇÃO
-- (diayjpsrcerycycyaxst) e clique em Run. Uma execução só.
--
-- PRÉ-REQUISITO: o script script_ponto_correcoes_bateria_12ago.sql já
-- deve ter sido aplicado (foi, em 13/08). Este é a sequência dele.
--
-- POR QUE ESTE SCRIPT EXISTE
-- Depois de consertar a materialização de faltas, o diagnóstico na
-- produção acusou 11.842 colaboradores e 271.951 dias sem linha de
-- espelho. A investigação mostrou que 11.788 deles (99,5%) NUNCA bateram
-- ponto uma única vez, e que apenas 14 das 1.401 empresas têm alguma
-- batida.
--
-- Mandar materializar naquele estado criaria ~271 mil faltas para gente
-- que nunca esteve no controle de jornada, em dezenas de clientes ao
-- mesmo tempo. A causa: não existia forma de dizer "esta empresa não usa
-- controle de jornada" — admissoes.bate_ponto nasce marcado por padrão.
--
-- O QUE ESTE SCRIPT FAZ
--   1. Cria a chave por empresa e a chave-mestra por cliente.
--   2. SEMEIA as chaves a partir do que já aconteceu: liga apenas onde
--      existe batida real. Não adivinha nada.
--   3. Materialização e diagnóstico passam a respeitar as chaves, com
--      rede de segurança: quem bate ponto é sempre apurado.
--   4. Protege a tabela ponto_entrega_conferencia, criada na entrega
--      anterior sem controle de acesso (descuido acusado pela rotina
--      PONTO-250). Ela guarda agregados de vários clientes.
--   5. Ajusta as rotinas de QA para o critério novo.
--
-- O QUE ELE NÃO FAZ
-- Continua NÃO materializando nada. Ele só muda QUEM entraria na conta.
-- A conferência mostra o antes e o depois desse número — é essa queda
-- que autoriza, depois, conversar sobre materializar o que sobrou.
--
-- Nenhuma marcação, nenhum espelho e nenhuma folha são alterados aqui.
--
-- SEGURO RODAR DUAS VEZES — mas, como no anterior, o retrato de "antes"
-- só é fiel na primeira execução.
-- =====================================================================

SET lock_timeout = '10s';

-- A tabela de conferência pode ainda não existir se a entrega anterior
-- não tiver sido aplicada. Garantida aqui antes do primeiro retrato.
CREATE TABLE IF NOT EXISTS public.ponto_entrega_conferencia (
  competencia                 text NOT NULL,
  momento                     text NOT NULL,
  tenant_id                   uuid,
  minutos_adicional_feriado   bigint,
  colaboradores_sem_linha     bigint,
  dias_sem_linha              bigint,
  linhas_de_ponto_sem_empresa bigint,
  observacao                  text,
  registrado_em               timestamptz NOT NULL DEFAULT now()
);

-- ── RETRATO DE ANTES ─────────────────────────────────────────────────
-- Roda com o critério largo ainda em vigor, de propósito.
DO $antes$
DECLARE
  v_comp text := to_char(CURRENT_DATE - interval '1 month', 'YYYY-MM');
  t RECORD; v_colab bigint; v_dias bigint;
BEGIN
  DELETE FROM public.ponto_entrega_conferencia
   WHERE competencia = v_comp AND momento = 'antes-regime';

  FOR t IN SELECT id FROM public.tenants LOOP
    BEGIN
      SELECT count(*), COALESCE(sum(d.dias_sem_linha), 0) INTO v_colab, v_dias
      FROM public.ponto_dias_nao_materializados(t.id, v_comp) d;
    EXCEPTION WHEN OTHERS THEN
      v_colab := NULL; v_dias := NULL;
    END;

    INSERT INTO public.ponto_entrega_conferencia
      (competencia, momento, tenant_id, colaboradores_sem_linha, dias_sem_linha)
    VALUES (v_comp, 'antes-regime', t.id, v_colab, v_dias);
  END LOOP;
END $antes$;


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

-- =====================================================================
-- QA · PONTO-290/292/293 passam a montar o cenário dentro do regime
--
-- Com a chave de controle por empresa (20260813180000), a materialização
-- só cobre quem está no regime de ponto. As rotinas 290, 292 e 293
-- criavam o colaborador SEM empresa e sem nenhuma batida — que é
-- exatamente o perfil que o novo critério exclui de propósito, e por
-- bom motivo: na produção esse perfil são 11.788 pessoas que nunca
-- bateram ponto.
--
-- O requisito NÃO está sendo afrouxado. Ele continua o mesmo, agora com
-- o recorte correto: numa empresa que ADOTA controle de jornada, o dia
-- sem batida tem de existir no espelho. O que deixou de ser exigido é
-- gerar falta para empresa que nunca usou o módulo — isso era o defeito,
-- não o requisito.
--
-- Cada rotina passa a criar a empresa com a chave ligada, e a 293 ganha
-- um segundo passo que fecha a outra metade da regra: colaborador de
-- empresa FORA do regime não pode aparecer no diagnóstico. Sem esse
-- passo, a rotina aprovaria um sistema que voltasse a materializar tudo.
-- =====================================================================


-- Helper: empresa de teste já dentro do regime de ponto.
CREATE OR REPLACE FUNCTION public.qa_empresa_com_ponto(p_nome text, p_cnpj text)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE v_id uuid;
BEGIN
  v_id := public.qa_nova_empresa(p_nome, p_cnpj);
  UPDATE public.empresa_cadastro SET usa_controle_ponto = true WHERE id = v_id;
  RETURN v_id;
END $$;

COMMENT ON FUNCTION public.qa_empresa_com_ponto(text, text) IS
  'Empresa de teste que adota controle de jornada. Cenário de ponto tem de nascer no regime, senão testa outra coisa.';

-- ══ PONTO-290: o dia sem batida existe ══
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_290()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_emp uuid; v_cpf text; v_dia date := public.qa_dia_util_passado();
        v_n int; v_res jsonb;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_emp := public.qa_empresa_com_ponto('[QA-PONTO] Unidade Com Ponto', '11222333029001');
  v_cpf := public.qa_ponto_admissao('[QA-PONTO] Faltante Materializado', 29001, v_emp);

  r.passo_ordem := 1;
  r.passo_acao := format('Materializar o dia útil %s numa empresa que adota controle, sem nenhuma marcação do colaborador', v_dia);
  r.esperado := 'Linha criada em ponto_diario — o dia sem batida passa a existir';
  v_res := public.ponto_materializar_faltas(v_dia, v_dia, v_t);

  SELECT count(*) INTO v_n FROM public.ponto_diario
  WHERE tenant_id = v_t AND colaborador_cpf = v_cpf AND data = v_dia;
  IF v_n = 0 THEN
    r.situacao := 'falhou';
    r.obtido := format('O DIA SEM BATIDA CONTINUA SEM EXISTIR: a materialização não criou linha para %s (retorno: %s). '
      'É a reabertura do caso de 13/07 — a falta que não desconta porque nunca é vista.', v_dia, v_res::text);
    RETURN r;
  END IF;

  r.passo_ordem := 2;
  r.passo_acao := 'Materializar um período inteiramente no futuro';
  r.esperado := 'Ignorado — não existe falta em dia que não aconteceu';
  v_res := public.ponto_materializar_faltas(CURRENT_DATE + 1, CURRENT_DATE + 5, v_t);
  SELECT count(*) INTO v_n FROM public.ponto_diario
  WHERE tenant_id = v_t AND colaborador_cpf = v_cpf AND data > CURRENT_DATE;
  IF v_n = 0 THEN
    r.situacao := 'passou';
    r.obtido := 'O dia sem batida foi materializado e o futuro ficou de fora.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('%s linha(s) criadas em datas futuras — falta antecipada não existe.', v_n);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ PONTO-292: materializar duas vezes não duplica ══
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_292()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_emp uuid; v_cpf text; v_dia date := public.qa_dia_util_passado(); v_n int;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_emp := public.qa_empresa_com_ponto('[QA-PONTO] Unidade Idempotente', '11222333029201');
  v_cpf := public.qa_ponto_admissao('[QA-PONTO] Idempotente', 29201, v_emp);
  PERFORM public.ponto_materializar_faltas(v_dia, v_dia, v_t);

  r.passo_ordem := 1;
  r.passo_acao := 'Rodar a materialização de novo sobre o mesmo dia';
  r.esperado := 'Nenhuma linha nova — rodar N vezes produz o estado de rodar uma';
  PERFORM public.ponto_materializar_faltas(v_dia, v_dia, v_t);
  PERFORM public.ponto_materializar_faltas(v_dia, v_dia, v_t);

  SELECT count(*) INTO v_n FROM public.ponto_diario
  WHERE tenant_id = v_t AND colaborador_cpf = v_cpf AND data = v_dia;
  IF v_n = 1 THEN
    r.situacao := 'passou'; r.obtido := 'Três execuções, uma linha — a rotina diária é segura de repetir.';
  ELSIF v_n = 0 THEN
    r.situacao := 'falhou'; r.obtido := 'A materialização não criou linha nenhuma (ver PONTO-290).';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('%s linhas para o mesmo dia — a rotina duplica quando repetida.', v_n);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ PONTO-293: o diagnóstico acusa o buraco — e só o buraco de verdade ══
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_293()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_emp uuid; v_emp_fora uuid; v_cpf text; v_cpf_fora text;
        v_comp text := to_char(CURRENT_DATE, 'YYYY-MM'); v_antes int; v_depois int; v_fora int;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_emp := public.qa_empresa_com_ponto('[QA-PONTO] Unidade Diagnosticada', '11222333029301');
  v_cpf := public.qa_ponto_admissao('[QA-PONTO] Diagnosticado', 29301,
                                    v_emp, date_trunc('month', CURRENT_DATE)::date);

  -- Empresa que NÃO adota controle: não pode aparecer no diagnóstico.
  v_emp_fora := public.qa_nova_empresa('[QA-PONTO] Unidade Sem Ponto', '11222333029302');
  v_cpf_fora := public.qa_ponto_admissao('[QA-PONTO] Fora do Regime', 29302,
                                         v_emp_fora, date_trunc('month', CURRENT_DATE)::date);

  r.passo_ordem := 1; r.passo_acao := 'Rodar o diagnóstico com os dias sem linha';
  r.esperado := 'O colaborador da empresa que adota controle aparece na lista';
  SELECT count(*) INTO v_antes
  FROM public.ponto_dias_nao_materializados(v_t, v_comp) d
  WHERE regexp_replace(d.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf;

  IF v_antes = 0 THEN
    IF date_trunc('month', CURRENT_DATE)::date > CURRENT_DATE - 1 THEN
      r.situacao := 'passou';
      r.obtido := 'Competência sem dia útil vivido — nada a materializar, diagnóstico vazio é o correto.';
      RETURN r;
    END IF;
    r.situacao := 'falhou';
    r.obtido := 'O DIAGNÓSTICO NÃO ENXERGA O BURACO: colaborador de empresa que adota controle, com dias úteis sem linha, não aparece em ponto_dias_nao_materializados.';
    RETURN r;
  END IF;

  r.passo_ordem := 2;
  r.passo_acao := 'Conferir que a empresa SEM controle de jornada ficou de fora';
  r.esperado := 'Não aparece — quem não adota controle não gera falta';
  SELECT count(*) INTO v_fora
  FROM public.ponto_dias_nao_materializados(v_t, v_comp) d
  WHERE regexp_replace(d.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf_fora;

  IF v_fora > 0 THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: colaborador de empresa que NÃO adota controle de jornada aparece no '
             || 'diagnóstico. Materializar isso criaria falta para quem nunca esteve no controle '
             || '— na produção de 13/08 eram 11.788 pessoas nessa situação, em 1.387 empresas '
             || 'sem uma única batida.';
    RETURN r;
  END IF;

  r.passo_ordem := 3; r.passo_acao := 'Materializar o mês e rodar o diagnóstico de novo';
  r.esperado := 'O colaborador do regime sai da lista';
  PERFORM public.ponto_materializar_faltas(date_trunc('month', CURRENT_DATE)::date, CURRENT_DATE - 1, v_t);
  SELECT count(*) INTO v_depois
  FROM public.ponto_dias_nao_materializados(v_t, v_comp) d
  WHERE regexp_replace(d.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf;

  IF v_depois = 0 THEN
    r.situacao := 'passou';
    r.obtido := 'Diagnóstico acusou o buraco de quem está no regime, ignorou quem não está, e '
             || 'silenciou depois da materialização.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Após materializar, o colaborador continua na lista com %s dia(s) — ou a '
                    || 'materialização não cobriu, ou o diagnóstico não bate com ela.', v_depois);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- =====================================================================
-- Duas correções que a bateria acusou depois da mudança de regime
--
-- ── 1) ponto_entrega_conferencia sem RLS — descuido meu, já em produção
-- Criei essa tabela dentro do script de entrega de 13/08 para guardar o
-- retrato antes/depois da apuração, e esqueci de protegê-la. A rotina
-- PONTO-250 acusou na varredura seguinte: "1 tabela SEM RLS ativa e 1 SEM
-- nenhuma política".
--
-- Ela guarda contagens agregadas por cliente — não tem dado pessoal —,
-- mas são números de negócio de um cliente visíveis para qualquer sessão
-- autenticada de outro. É vazamento, ainda que de agregado, e o script
-- já rodou na produção. Passa a ser exclusiva de superadmin, como as
-- demais ferramentas internas.
--
-- ── 2) PONTO-023 monta o cenário fora do regime de ponto
-- Mesma situação de 290/292/293: a rotina cria o colaborador sem empresa
-- e sem batida, perfil que a chave de controle por empresa passou a
-- excluir de propósito. O requisito continua o mesmo — dia útil sem
-- marcação vira FALTA, não dia neutro, porque a falta repercute no DSR —,
-- agora dentro de uma empresa que adota controle de jornada.
-- =====================================================================


-- ── 1) A tabela de conferência vira ferramenta interna ───────────────
CREATE TABLE IF NOT EXISTS public.ponto_entrega_conferencia (
  competencia                 text NOT NULL,
  momento                     text NOT NULL,
  tenant_id                   uuid,
  minutos_adicional_feriado   bigint,
  colaboradores_sem_linha     bigint,
  dias_sem_linha              bigint,
  linhas_de_ponto_sem_empresa bigint,
  observacao                  text,
  registrado_em               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ponto_entrega_conferencia ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ponto_entrega_conferencia FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ponto_entrega_conferencia TO service_role;

DROP POLICY IF EXISTS "Conferencia de entrega e ferramenta interna" ON public.ponto_entrega_conferencia;
CREATE POLICY "Conferencia de entrega e ferramenta interna"
  ON public.ponto_entrega_conferencia
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

COMMENT ON TABLE public.ponto_entrega_conferencia IS
  'Retrato antes/depois das entregas de correção do ponto. Ferramenta interna: só superadmin lê. Guarda agregados de vários clientes na mesma tabela.';

-- ── 2) PONTO-023 dentro do regime ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_023()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_emp uuid; v_cpf text;
        v_dia date := public.qa_dia_util_passado();
        v_status text;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_emp := public.qa_empresa_com_ponto('[QA-PONTO] Unidade Falta Real', '11222333050231');
  v_cpf := public.qa_ponto_admissao('QA Falta Real', 5023, v_emp);

  r.passo_ordem := 1;
  r.passo_acao := format('Materializar o dia útil %s sem nenhuma marcação, em empresa que adota controle', v_dia);
  r.esperado := 'O dia vira FALTA — não dia neutro (a falta repercute no DSR)';
  PERFORM public.ponto_materializar_faltas(v_dia, v_dia, public.qa_sandbox_tenant_id());
  SELECT status INTO v_status FROM public.ponto_diario
  WHERE tenant_id = public.qa_sandbox_tenant_id() AND colaborador_cpf = v_cpf AND data = v_dia;

  IF v_status = 'falta' THEN
    r.situacao := 'passou';
    r.obtido := 'Dia útil sem batida materializado como falta.';
  ELSIF v_status IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o dia útil sem marcação de um colaborador que NUNCA bateu ponto ficou '
             || 'INEXISTENTE, mesmo em empresa que adota controle de jornada. Quem nunca bateu '
             || '(admitido que não compareceu, colaborador sem onboarding do app) nunca vira '
             || 'falta: é o funcionário invisível.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('O dia sem marcação ficou como %s — ausência tratada como neutra esconde '
             || 'o efeito legal sobre o DSR.', v_status);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ── Conferência ──────────────────────────────────────────────────────
DO $verifica$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE n.nspname = 'public' AND c.relname = 'ponto_entrega_conferencia'
                    AND c.relrowsecurity) THEN
    RAISE EXCEPTION 'ponto_entrega_conferencia continua sem RLS.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname = 'public' AND tablename = 'ponto_entrega_conferencia') THEN
    RAISE EXCEPTION 'ponto_entrega_conferencia continua sem política.';
  END IF;
  RAISE NOTICE 'OK: conferência de entrega protegida e PONTO-023 no regime.';
END $verifica$;

-- ── RETRATO DE DEPOIS ────────────────────────────────────────────────
DO $depois$
DECLARE
  v_comp text := to_char(CURRENT_DATE - interval '1 month', 'YYYY-MM');
  t RECORD; v_colab bigint; v_dias bigint;
BEGIN
  DELETE FROM public.ponto_entrega_conferencia
   WHERE competencia = v_comp AND momento = 'depois-regime';

  FOR t IN SELECT id FROM public.tenants LOOP
    BEGIN
      SELECT count(*), COALESCE(sum(d.dias_sem_linha), 0) INTO v_colab, v_dias
      FROM public.ponto_dias_nao_materializados(t.id, v_comp) d;
    EXCEPTION WHEN OTHERS THEN
      v_colab := NULL; v_dias := NULL;
    END;

    INSERT INTO public.ponto_entrega_conferencia
      (competencia, momento, tenant_id, colaboradores_sem_linha, dias_sem_linha)
    VALUES (v_comp, 'depois-regime', t.id, v_colab, v_dias);
  END LOOP;
END $depois$;

-- =====================================================================
-- CONFERÊNCIA (o editor mostra só este último resultado)
-- =====================================================================
WITH comp AS MATERIALIZED (
  SELECT to_char(CURRENT_DATE - interval '1 month', 'YYYY-MM') AS c
),
retrato AS MATERIALIZED (
  SELECT
    COALESCE(sum(colaboradores_sem_linha) FILTER (WHERE momento = 'antes-regime'), 0)  AS colab_antes,
    COALESCE(sum(dias_sem_linha)          FILTER (WHERE momento = 'antes-regime'), 0)  AS dias_antes,
    COALESCE(sum(colaboradores_sem_linha) FILTER (WHERE momento = 'depois-regime'), 0) AS colab_depois,
    COALESCE(sum(dias_sem_linha)          FILTER (WHERE momento = 'depois-regime'), 0) AS dias_depois
  FROM public.ponto_entrega_conferencia
  WHERE competencia = (SELECT c FROM comp)
),
chaves AS MATERIALIZED (
  SELECT count(*) FILTER (WHERE usa_controle_ponto)       AS empresas_com_ponto,
         count(*) FILTER (WHERE NOT usa_controle_ponto)   AS empresas_sem_ponto,
         count(*)                                          AS total_empresas
  FROM public.empresa_cadastro
),
protecao AS MATERIALIZED (
  SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                            WHERE n.nspname = 'public'
                              AND c.relname = 'ponto_entrega_conferencia'
                              AND c.relrowsecurity)
              AND EXISTS (SELECT 1 FROM pg_policies
                           WHERE schemaname = 'public'
                             AND tablename = 'ponto_entrega_conferencia')
              THEN 'sim' ELSE 'NAO — verificar' END AS conferencia_protegida
)
SELECT (SELECT c FROM comp)                                   AS competencia_conferida,
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_name = 'empresa_cadastro'
                            AND column_name = 'usa_controle_ponto')
            THEN 'sim' ELSE 'NAO — verificar' END             AS chave_por_empresa,
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_name = 'ponto_configuracao'
                            AND column_name = 'controle_ponto_ativo')
            THEN 'sim' ELSE 'NAO — verificar' END             AS chave_mestra,
       p.conferencia_protegida,
       k.empresas_com_ponto                                    AS empresas_que_usam_ponto,
       k.empresas_sem_ponto                                    AS empresas_fora_do_controle,
       k.total_empresas,
       r.colab_antes                                           AS colaboradores_na_conta_ANTES,
       r.colab_depois                                          AS colaboradores_na_conta_DEPOIS,
       r.dias_antes                                            AS dias_na_conta_ANTES,
       r.dias_depois                                           AS dias_na_conta_DEPOIS
FROM retrato r CROSS JOIN chaves k CROSS JOIN protecao p;
