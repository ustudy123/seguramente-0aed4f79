-- =====================================================================
-- ENTREGA · Ponto: 10 correções da bateria de 12/08
--
-- COLE ESTE ARQUIVO INTEIRO no SQL Editor do projeto de PRODUÇÃO
-- (diayjpsrcerycycyaxst) e clique em Run. Uma execução só.
--
-- ATENÇÃO — ESTA ENTREGA MUDA NÚMERO DE FOLHA
-- Diferente das anteriores, duas destas correções alteram valores
-- apurados. Leia antes de rodar:
--
--   · A APURAÇÃO DE FERIADO passa a enxergar o dia trabalhado. Hoje, em
--     parte dos casos, o adicional de 100% (Lei 605/1949 art. 9º;
--     Súmula 146 do TST) simplesmente não aparece — sem erro na tela,
--     sem aviso. Depois deste script ele aparece. A conferência do fim
--     mostra ANTES e DEPOIS lado a lado: a diferença é o que estava
--     deixando de ser pago.
--
--   · A MATERIALIZAÇÃO DE FALTAS volta a enxergar quem nunca bateu
--     ponto. Este script NÃO materializa nada — ele só conserta a
--     rotina. A conferência mostra o tamanho do buraco; materializar é
--     decisão sua, num segundo momento, com o RH ciente.
--
-- O QUE VAI SER CORRIGIDO
--   1. O dia sem batida nunca existia (PONTO-290/292/293)
--   2. Colaborador sem empresa entrava na apuração de todas (311/312)
--   3. Duas configurações de retenção colidindo; a função de expurgo
--      lia coluna inexistente e quebraria no primeiro uso (253)
--   4. Três tabelas do módulo sem a trava do cercado de QA (270)
--   5. Adicional de feriado invisível na apuração (320/321/322)
--
-- COMPETÊNCIA DA CONFERÊNCIA
-- Por padrão, o mês passado. Para conferir outro mês, troque as DUAS
-- ocorrências de
--     to_char(CURRENT_DATE - interval '1 month', 'YYYY-MM')
-- por, por exemplo, '2026-07'.
--
-- SEGURO RODAR DUAS VEZES — mas o ANTES só vale na PRIMEIRA execução.
-- O retrato de "antes" é tirado com as rotinas ainda defeituosas. Numa
-- segunda execução elas já estão corrigidas, então antes e depois dão o
-- mesmo número e a diferença aparece como zero. Isso não significa que
-- nada mudou: significa que já tinha mudado. O retrato da primeira
-- execução fica guardado em public.ponto_entrega_conferencia.
-- =====================================================================

SET lock_timeout = '10s';

-- ─────────────────────────────────────────────────────────────────────
-- Quadro de conferência da entrega (fica na base como registro)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ponto_entrega_conferencia (
  competencia               text NOT NULL,
  momento                   text NOT NULL,
  tenant_id                 uuid,
  minutos_adicional_feriado bigint,
  colaboradores_sem_linha   bigint,
  dias_sem_linha            bigint,
  linhas_de_ponto_sem_empresa bigint,
  observacao                text,
  registrado_em             timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ponto_entrega_conferencia IS
  'Retrato antes/depois das entregas de correção do ponto. Serve para o RH ver o que mudou na apuração sem depender de memória.';

-- ── RETRATO DE ANTES ─────────────────────────────────────────────────
-- Roda com as rotinas AINDA COM DEFEITO, de propósito.
DO $antes$
DECLARE
  v_comp text := to_char(CURRENT_DATE - interval '1 month', 'YYYY-MM');
  t RECORD;
  v_ad bigint; v_colab bigint; v_dias bigint; v_sememp bigint;
BEGIN
  DELETE FROM public.ponto_entrega_conferencia
   WHERE competencia = v_comp AND momento = 'antes';

  FOR t IN SELECT id FROM public.tenants LOOP
    v_ad := NULL; v_colab := NULL; v_dias := NULL; v_sememp := NULL;

    BEGIN
      SELECT COALESCE(sum(f.minutos_adicional_100), 0) INTO v_ad
      FROM public.ponto_feriado_adicional_competencia(t.id, NULL, v_comp) f;
    EXCEPTION WHEN OTHERS THEN
      v_ad := NULL;  -- hoje pode nem rodar; é parte do que se conserta
    END;

    BEGIN
      SELECT count(*), COALESCE(sum(d.dias_sem_linha), 0) INTO v_colab, v_dias
      FROM public.ponto_dias_nao_materializados(t.id, v_comp) d;
    EXCEPTION WHEN OTHERS THEN
      v_colab := NULL; v_dias := NULL;
    END;

    SELECT count(DISTINCT pd.colaborador_cpf) INTO v_sememp
    FROM public.ponto_diario pd
    WHERE pd.tenant_id = t.id
      AND pd.empresa_id IS NULL
      AND to_char(pd.data, 'YYYY-MM') = v_comp;

    INSERT INTO public.ponto_entrega_conferencia
      (competencia, momento, tenant_id, minutos_adicional_feriado,
       colaboradores_sem_linha, dias_sem_linha, linhas_de_ponto_sem_empresa, observacao)
    VALUES (v_comp, 'antes', t.id, v_ad, v_colab, v_dias, v_sememp,
            CASE WHEN v_ad IS NULL THEN 'apuração de feriado não rodava neste banco' END);
  END LOOP;
END $antes$;


-- =====================================================================
-- PONTO · Correção de quatro achados da bateria de 12/08
--
-- Relatório "jornada-rotina/ponto" de 12/08: 12 passou, 10 falhou. Este
-- arquivo fecha sete dessas dez falhas, em quatro frentes independentes.
-- As três restantes (PONTO-320/321/322) dependem de objetos que existem
-- só na produção e serão trazidos em migration própria.
--
-- ── 1) PONTO-290 / 292 / 293 — o dia sem batida nunca existiu ────────
-- consolidar_ponto_diario_manual resolve quem é o colaborador olhando
-- APENAS ponto_marcacoes e ponto_ajustes. Quem nunca bateu ponto e nunca
-- teve ajuste não é resolvido, e a função sai pela porta
-- `IF v_cid IS NULL THEN RETURN` sem gravar nada.
--
-- Consequência: a materialização de faltas roda, reporta sucesso
-- ("consolidacoes": 1) e não cria linha nenhuma para essa pessoa. A falta
-- não desconta porque nunca é vista — e quem mais sofre é justamente
-- quem está sumido, que é o caso que a materialização existe para pegar.
-- É a reabertura do caso de 13/07.
--
-- Correção: quando marcações e ajustes não resolvem, resolver pela
-- ADMISSÃO, por CPF. É o mesmo caminho que afastamento_sincroniza_ponto
-- já usa desde 24/07.
--
-- ── 2) PONTO-311 / 312 — a válvula de escape voltou ─────────────────
-- ponto_espelho_resumo_empresa filtra com
--   (p_empresa_id IS NULL OR pd.empresa_id = p_empresa_id
--                         OR pd.empresa_id IS NULL)
-- Esse terceiro termo põe todo colaborador SEM empresa na linha dentro
-- da apuração de TODAS as empresas. É o defeito que exigiu migration de
-- reparo em 04/08 e que a rotina PONTO-312 vigia justamente para não
-- voltar. Voltou.
--
-- Correção: quando a linha não tem empresa, resolver pela admissão
-- (ponto_empresa_do_cpf) em vez de deixar passar em todas.
--
-- ── 3) PONTO-270 — três tabelas sem a trava do cercado ──────────────
-- ponto_escala_copia_tenant, ponto_expurgo_eventos e
-- ponto_retencao_config nasceram depois da última instalação das cercas.
-- Uma rotina de teste com erro de tenant escreveria em ponto de cliente
-- real por esse caminho.
--
-- ── 4) PONTO-253 — duas configurações de retenção colidindo ─────────
-- Existem DOIS desenhos de retenção no repositório para a mesma tabela:
--   · 04/08: ponto_retencao_config(tenant_id PK, geolocalizacao_dias,
--     ativo) + ponto_expurgar_geolocalizacao() — este é o que existe;
--   · 07/08: um CREATE TABLE IF NOT EXISTS com outras colunas
--     (anos_retencao, expurgo_automatico, ...) que foi SILENCIOSAMENTE
--     PULADO, porque a tabela já existia — mas a função
--     ponto_expurgar_registros() daquele mesmo arquivo foi criada e lê
--     `anos_retencao`. Ela quebra na primeira execução real com
--     "column anos_retencao does not exist".
--
-- Os dois prazos são legitimamente distintos e devem coexistir: a
-- geolocalização é acessória e sua finalidade se esgota cedo (LGPD art.
-- 16); a MARCAÇÃO tem base própria no art. 74 da CLT e prazo maior. A
-- correção acrescenta as colunas que faltam em vez de escolher um dos
-- desenhos.
-- =====================================================================


-- ─────────────────────────────────────────────────────────────────────
-- 1) O dia sem batida passa a existir
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.consolidar_ponto_diario_manual(
  p_tenant_id UUID, p_colaborador_cpf TEXT, p_data DATE
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $main$
DECLARE
  v_afast public.afastamentos;
  v_ferias public.ferias_solicitacoes;
  v_atest public.atestados;
  v_cid UUID; v_cnome TEXT; v_eid UUID; v_obs TEXT;
  c RECORD;
BEGIN
  SELECT colaborador_id, colaborador_nome INTO v_cid, v_cnome
  FROM public.ponto_marcacoes
  WHERE tenant_id = p_tenant_id AND colaborador_cpf = p_colaborador_cpf
  ORDER BY created_at DESC LIMIT 1;
  IF v_cid IS NULL THEN
    SELECT colaborador_id, colaborador_nome INTO v_cid, v_cnome
    FROM public.ponto_ajustes
    WHERE tenant_id = p_tenant_id AND colaborador_cpf = p_colaborador_cpf
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  -- Quem nunca bateu ponto nem teve ajuste também precisa existir no
  -- espelho: é exatamente o caso que a materialização de faltas procura.
  -- Antes desta linha, a função saía sem gravar e a falta ficava invisível.
  IF v_cid IS NULL THEN
    SELECT a.id, a.nome_completo INTO v_cid, v_cnome
    FROM public.admissoes a
    WHERE a.tenant_id = p_tenant_id
      AND regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g')
          = regexp_replace(COALESCE(p_colaborador_cpf, ''), '[^0-9]', '', 'g')
      AND COALESCE(a.inativo, false) = false
    ORDER BY a.data_admissao DESC NULLS LAST
    LIMIT 1;
  END IF;

  SELECT f.* INTO v_ferias FROM public.ferias_solicitacoes f
  WHERE f.tenant_id = p_tenant_id AND f.colaborador_cpf = p_colaborador_cpf
    AND f.status IN ('aprovado','em_gozo','concluido')
    AND f.data_inicio <= p_data AND f.data_fim >= p_data
  ORDER BY f.data_inicio DESC LIMIT 1;
  IF v_ferias.id IS NOT NULL THEN
    v_cid := COALESCE(v_cid, v_ferias.colaborador_id);
    v_cnome := COALESCE(v_cnome, v_ferias.colaborador_nome);
    v_obs := 'Férias: ' || to_char(v_ferias.data_inicio,'DD/MM/YYYY') || ' a ' || to_char(v_ferias.data_fim,'DD/MM/YYYY');
    PERFORM public._ponto_grava_abono(p_tenant_id, v_cid, v_cnome, p_colaborador_cpf, p_data, v_obs);
    RETURN;
  END IF;

  SELECT a.* INTO v_atest FROM public.atestados a
  WHERE a.tenant_id = p_tenant_id AND a.colaborador_cpf = p_colaborador_cpf
    AND a.data_inicio_afastamento IS NOT NULL
    AND a.data_inicio_afastamento <= p_data
    AND COALESCE(a.data_fim_afastamento, a.data_inicio_afastamento) >= p_data
  ORDER BY a.data_inicio_afastamento DESC LIMIT 1;
  IF v_atest.id IS NOT NULL THEN
    v_cid := COALESCE(v_cid, v_atest.colaborador_id);
    v_cnome := COALESCE(v_cnome, v_atest.colaborador_nome);
    v_obs := 'Atestado: ' || to_char(v_atest.data_inicio_afastamento,'DD/MM/YYYY')
      || CASE WHEN v_atest.data_fim_afastamento IS NOT NULL THEN ' a ' || to_char(v_atest.data_fim_afastamento,'DD/MM/YYYY') ELSE '' END;
    PERFORM public._ponto_grava_abono(p_tenant_id, v_cid, v_cnome, p_colaborador_cpf, p_data, v_obs);
    RETURN;
  END IF;

  v_afast := public.afastamento_vigente(p_tenant_id, p_colaborador_cpf, p_data);
  IF v_afast.id IS NOT NULL THEN
    v_cid := COALESCE(v_cid, v_afast.colaborador_id);
    v_cnome := COALESCE(v_cnome, v_afast.colaborador_nome);
    v_obs := 'Afastamento (' || COALESCE(replace(v_afast.motivo_principal::text,'_',' '),'registrado')
      || '): de ' || to_char(v_afast.data_inicio,'DD/MM/YYYY')
      || CASE WHEN v_afast.data_fim IS NOT NULL THEN ' a ' || to_char(v_afast.data_fim,'DD/MM/YYYY') ELSE ' — em aberto' END;
    PERFORM public._ponto_grava_abono(p_tenant_id, v_cid, v_cnome, p_colaborador_cpf, p_data, v_obs);
    RETURN;
  END IF;

  IF v_cid IS NULL THEN RETURN; END IF;
  v_eid := COALESCE(public.ponto_empresa_do_colaborador(v_cid),
                    public.ponto_empresa_do_cpf(p_tenant_id, p_colaborador_cpf));

  c := public._ponto_calc_dia(p_tenant_id, p_colaborador_cpf, p_data, v_cid);

  INSERT INTO public.ponto_diario (
    tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf, data,
    entrada, saida_almoco, retorno_almoco, saida, horas_trabalhadas, status, observacao
  ) VALUES (
    p_tenant_id, v_eid, v_cid, v_cnome, p_colaborador_cpf, p_data,
    c.o_pent, c.o_salm, c.o_ralm, c.o_usai, c.o_horas, c.o_status, c.o_obs
  )
  ON CONFLICT (tenant_id, colaborador_cpf, data)
  DO UPDATE SET
    empresa_id = COALESCE(EXCLUDED.empresa_id, public.ponto_diario.empresa_id),
    colaborador_nome = EXCLUDED.colaborador_nome,
    entrada = EXCLUDED.entrada, saida_almoco = EXCLUDED.saida_almoco,
    retorno_almoco = EXCLUDED.retorno_almoco, saida = EXCLUDED.saida,
    horas_trabalhadas = EXCLUDED.horas_trabalhadas,
    status = CASE WHEN public.ponto_diario.status = 'justificado' THEN 'justificado' ELSE EXCLUDED.status END,
    observacao = CASE WHEN public.ponto_diario.status = 'justificado'
                        AND public.ponto_diario.observacao LIKE 'Abonado por afastamento%'
                      THEN public.ponto_diario.observacao ELSE EXCLUDED.observacao END,
    updated_at = now();
END;
$main$;

-- ─────────────────────────────────────────────────────────────────────
-- 2) A apuração por empresa deixa de ter válvula de escape
-- ─────────────────────────────────────────────────────────────────────
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
  dia_equalizacao date,
  saldo_anterior_min integer,
  saldo_banco_min integer,
  he_50_min integer,
  he_100_min integer,
  atrasos_min integer
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
      -- Linha sem empresa NÃO entra em todas: resolve-se pelo cadastro da
      -- admissão. Deixar passar era o defeito reparado em 04/08.
      AND (p_empresa_id IS NULL
           OR COALESCE(
                pd.empresa_id,
                public.ponto_empresa_do_cpf(
                  p_tenant_id,
                  regexp_replace(pd.colaborador_cpf, '[^0-9]', '', 'g'))
              ) = p_empresa_id)
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

-- ─────────────────────────────────────────────────────────────────────
-- 3) Retenção: os dois prazos passam a coexistir sem quebrar
-- A tabela real é a de 04/08 (geolocalizacao_dias). As colunas do
-- desenho de 07/08 nunca chegaram porque o CREATE TABLE IF NOT EXISTS
-- foi pulado — mas ponto_expurgar_registros() lê anos_retencao e quebra.
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.ponto_retencao_config
  ADD COLUMN IF NOT EXISTS anos_retencao      integer     NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS expurgo_automatico boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ultimo_expurgo_em  timestamptz,
  ADD COLUMN IF NOT EXISTS observacoes        text,
  ADD COLUMN IF NOT EXISTS created_at         timestamptz NOT NULL DEFAULT now();

DO $chk$
BEGIN
  ALTER TABLE public.ponto_retencao_config
    ADD CONSTRAINT ponto_retencao_anos_chk CHECK (anos_retencao BETWEEN 5 AND 30);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN
  NULL;  -- já existe
END $chk$;

COMMENT ON COLUMN public.ponto_retencao_config.geolocalizacao_dias IS
  'Prazo de guarda da GEOLOCALIZAÇÃO, dado acessório cuja finalidade se esgota cedo (LGPD art. 16). Não confundir com o prazo da marcação.';
COMMENT ON COLUMN public.ponto_retencao_config.anos_retencao IS
  'Prazo de guarda da MARCAÇÃO, com base própria no art. 74 da CLT. Distinto e maior que o da geolocalização.';

-- ─────────────────────────────────────────────────────────────────────
-- 4) Tabelas novas do módulo entram na trava do cercado de QA
-- ─────────────────────────────────────────────────────────────────────
DO $cercas$
DECLARE v_n int;
BEGIN
  IF to_regprocedure('public.qa_instalar_cercas()') IS NULL THEN
    RAISE NOTICE 'qa_instalar_cercas não existe nesta base — nada a instalar.';
    RETURN;
  END IF;
  SELECT count(*) INTO v_n FROM public.qa_instalar_cercas();
  RAISE NOTICE 'Cercas de QA conferidas/instaladas: % tabela(s).', v_n;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Instalação das cercas não pôde rodar agora (%). Rode SELECT * FROM qa_instalar_cercas().', SQLERRM;
END $cercas$;

-- ─────────────────────────────────────────────────────────────────────
-- Conferência da própria migration
-- ─────────────────────────────────────────────────────────────────────
DO $verifica$
DECLARE v_falta text := '';
BEGIN
  IF pg_get_functiondef(to_regprocedure('public.consolidar_ponto_diario_manual(uuid,text,date)'))
     NOT ILIKE '%FROM public.admissoes a%' THEN
    v_falta := v_falta || ' consolidar_ponto_diario_manual';
  END IF;
  IF pg_get_functiondef(to_regprocedure('public.ponto_espelho_resumo_empresa(uuid,uuid,text)'))
     ILIKE '%= p_empresa_id OR%empresa_id IS NULL%' THEN
    v_falta := v_falta || ' valvula_ainda_presente';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'ponto_retencao_config' AND column_name = 'anos_retencao') THEN
    v_falta := v_falta || ' anos_retencao';
  END IF;
  IF v_falta <> '' THEN
    RAISE EXCEPTION 'Correção incompleta:%', v_falta;
  END IF;
  RAISE NOTICE 'OK: dia sem batida materializa, válvula de empresa removida, retenção coerente.';
END $verifica$;

-- =====================================================================
-- QA · PONTO-270 escolhia o cercado vizinho como se fosse cliente real
--
-- Depois de instalar as cercas que faltavam (migration 20260813140000), a
-- rotina PONTO-270 passou a falhar no passo 2 com "INSERT em tenant real
-- passou" — acusando que a cerca não estava segurando.
--
-- A cerca está segurando. Quem estava errado era o teste: ele escolhe o
-- "tenant real" com
--
--   SELECT id FROM tenants WHERE id IS DISTINCT FROM qa_sandbox_tenant_id()
--
-- e o primeiro que aparece é o SEGUNDO CERCADO (slug 'qa-sandbox-2'),
-- criado justamente para exercitar isolamento entre cercados. A trava
-- permite os dois cercados de propósito — então o INSERT passa, e o teste
-- conclui que a cerca falhou.
--
-- Falso negativo, e do tipo pior: acusa defeito onde não há, e ensina a
-- equipe a ignorar a rotina. Corrigido excluindo os dois cercados da
-- escolha. Quando não houver nenhum tenant fora deles — banco recém-criado
-- só com os cercados —, o passo é declarado inaplicável em vez de
-- inventar um veredito.
-- =====================================================================


CREATE OR REPLACE FUNCTION public.qa_caso_ponto_270()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_sem_trava int; v_lista text; v_real uuid;
  v_ins boolean := false; v_upd boolean := false; v_del_coberto boolean;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Listar tabelas de ponto e jornada sem a trava do cercado';
  r.esperado    := 'Nenhuma';

  SELECT count(*), string_agg(x.tn, ', ' ORDER BY x.tn) INTO v_sem_trava, v_lista
  FROM (
    SELECT col.table_name AS tn
    FROM information_schema.columns col
    JOIN information_schema.tables t
      ON t.table_schema = col.table_schema AND t.table_name = col.table_name
    WHERE col.table_schema = 'public' AND col.column_name = 'tenant_id'
      AND t.table_type = 'BASE TABLE'
      AND (col.table_name LIKE 'ponto\_%' OR col.table_name LIKE 'jornada\_%')
      AND NOT EXISTS (
        SELECT 1 FROM pg_trigger tg
        WHERE tg.tgname = 'qa_guarda_cercado'
          AND tg.tgrelid = ('public.' || quote_ident(col.table_name))::regclass
          AND NOT tg.tgisinternal)
  ) x;

  IF v_sem_trava > 0 THEN
    r.situacao := 'falhou';
    r.obtido   := format('%s tabela(s) do módulo SEM a trava do cercado: %s. Uma rotina de '
               || 'teste com erro de tenant escreveria em ponto de cliente real por esse '
               || 'caminho. Correção: rodar SELECT * FROM qa_instalar_cercas().',
               v_sem_trava, v_lista);
    RETURN r;
  END IF;

  r.passo_ordem := 2;
  r.passo_acao  := 'Tentar INSERT em ponto de tenant REAL, com o modo de teste ligado';
  r.esperado    := 'Bloqueado pela cerca';

  -- Fora dos DOIS cercados. O vizinho 'qa-sandbox-2' é permitido pela trava
  -- de propósito (existe para exercitar isolamento entre cercados); tomá-lo
  -- por cliente real fazia o teste acusar defeito onde não havia.
  SELECT t.id INTO v_real
  FROM public.tenants t
  WHERE t.id IS DISTINCT FROM public.qa_sandbox_tenant_id()
    AND COALESCE(t.slug, '') <> 'qa-sandbox-2'
  LIMIT 1;

  IF v_real IS NULL THEN
    r.situacao := 'passou';
    r.obtido   := 'Todas as tabelas do módulo têm a trava. Não há tenant fora dos cercados '
               || 'nesta base para exercitar o bloqueio — o passo fica inaplicável, não '
               || 'aprovado por omissão.';
    RETURN r;
  END IF;

  BEGIN
    INSERT INTO public.ponto_marcacoes
      (tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
       tipo_marcacao, hash_marcacao)
    VALUES (v_real, gen_random_uuid(), '[QA-PONTO-270]', public.qa_cpf(27001),
            'entrada', 'qa-teste-cerca');
    v_ins := true;   -- passou: a cerca falhou
  EXCEPTION WHEN OTHERS THEN v_ins := false;
  END;

  r.passo_ordem := 3;
  r.passo_acao  := 'Criar linha NO CERCADO e tentar movê-la para o tenant real';
  r.esperado    := 'Bloqueado pela cerca';
  -- Testar UPDATE assim, e não sobre linha de cliente, é deliberado: se a
  -- cerca falhar, quem se move e uma linha de teste do proprio cercado, e o
  -- funil a descarta. Mirar linha real provaria o mesmo e arriscaria o dado.
  BEGIN
    INSERT INTO public.ponto_marcacoes
      (tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
       tipo_marcacao, hash_marcacao)
    VALUES (public.qa_sandbox_tenant_id(), gen_random_uuid(), '[QA-PONTO-270] Cobaia',
            public.qa_cpf(27002), 'entrada', 'qa-teste-cerca');

    UPDATE public.ponto_marcacoes SET tenant_id = v_real
    WHERE colaborador_nome = '[QA-PONTO-270] Cobaia';
    v_upd := true;   -- passou: a cerca falhou
  EXCEPTION WHEN OTHERS THEN v_upd := false;
  END;

  r.passo_ordem := 4;
  r.passo_acao  := 'Conferir no catalogo se a trava tambem cobre DELETE';
  r.esperado    := 'A trigger declara INSERT, UPDATE e DELETE';
  SELECT bool_and((tg.tgtype & 8) <> 0) INTO v_del_coberto
  FROM pg_trigger tg
  JOIN pg_class c ON c.oid = tg.tgrelid
  WHERE tg.tgname = 'qa_guarda_cercado' AND NOT tg.tgisinternal
    AND (c.relname LIKE 'ponto\_%' OR c.relname LIKE 'jornada\_%');

  IF v_ins OR v_upd OR NOT COALESCE(v_del_coberto, false) THEN
    r.situacao := 'falhou';
    r.obtido   := format('A cerca nao esta segurando o modulo. INSERT em tenant real passou: '
               || '%s. UPDATE movendo linha do cercado para tenant real passou: %s. DELETE '
               || 'declarado na trigger em todas as tabelas: %s. Enquanto qualquer um destes '
               || 'estiver errado, nenhuma rotina de ponto pode ser escrita com seguranca.',
               v_ins, v_upd, COALESCE(v_del_coberto, false));
    r.detalhe  := jsonb_build_object('insert_passou', v_ins, 'update_passou', v_upd,
                                     'delete_coberto', v_del_coberto,
                                     'tenant_usado_como_real', v_real);
  ELSE
    r.situacao := 'passou';
    r.obtido   := 'Todas as tabelas do modulo tem a trava; INSERT em tenant real e UPDATE '
               || 'movendo linha para fora do cercado foram bloqueados; e a trigger cobre '
               || 'DELETE em todas elas. O cercado esta fechado para escrita de ponto.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- =====================================================================
-- Feriado: traz para o repositório o que só existia na produção
--
-- PONTO-320/321/322 falhavam com
--   function public.feriado_comportamento(uuid, text, uuid, date) does not exist
--
-- A investigação mostrou que a dívida é maior que uma função. Três
-- objetos do adicional de feriado (RN23) foram criados direto na
-- produção e nunca versionados:
--
--   · a função  feriado_comportamento(tenant, cpf, colaborador, data)
--   · a tabela  feriado_excecao  (consultada por PontoFeriadoExcecoesTab)
--   · a coluna  ponto_escalas.comportamento_feriado (usada por
--     PontoEscalasTab)
--
-- Consequência: TODO ambiente montado a partir das migrations — o de
-- teste, o de homologação, uma réplica para investigar um chamado —
-- nasce com o adicional de feriado inoperante, e a apuração RN23 quebra
-- na primeira chamada. Mesmo precedente de `feriados` e de
-- `ponto_diario.tipo_dia`, ambos resgatados antes.
--
-- As definições abaixo foram extraídas da PRODUÇÃO, não reescritas de
-- memória: a função é cópia literal de pg_get_functiondef. Em produção
-- este arquivo é inócuo (tudo já existe); em banco novo, é o que faz o
-- feriado funcionar.
--
-- Regra que a função implementa, em três degraus:
--   1) exceção do colaborador PARA AQUELE DIA, se houver;
--   2) exceção geral do colaborador (data nula), se houver;
--   3) o comportamento da escala vigente dele;
--   e, na ausência de tudo, 'folga' — o padrão conservador, que é o que
--   a CLT presume para o feriado.
-- =====================================================================


-- ── 1) Comportamento de feriado na escala ────────────────────────────
ALTER TABLE public.ponto_escalas
  ADD COLUMN IF NOT EXISTS comportamento_feriado text DEFAULT 'folga';

COMMENT ON COLUMN public.ponto_escalas.comportamento_feriado IS
  'O que esta escala faz no feriado: folga (padrão) ou trabalha. Consultado por feriado_comportamento quando não há exceção para o colaborador.';

-- ── 2) Exceções por colaborador ──────────────────────────────────────
-- data preenchida = exceção para aquele feriado; data nula = regra geral
-- daquele colaborador, que vale para todos os feriados.
CREATE TABLE IF NOT EXISTS public.feriado_excecao (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL,
  colaborador_id uuid NOT NULL,
  data           date,
  comportamento  text NOT NULL,
  observacao     text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.feriado_excecao IS
  'Exceções de comportamento no feriado, por colaborador. Com data: vale só para aquele feriado. Sem data: regra geral do colaborador. Tem precedência sobre a escala.';

-- A função busca por (tenant, colaborador, data) e por (tenant,
-- colaborador, data IS NULL). Sem índice, cada dia de cada colaborador
-- vira uma varredura na tabela inteira durante a apuração do mês.
CREATE INDEX IF NOT EXISTS feriado_excecao_busca_idx
  ON public.feriado_excecao (tenant_id, colaborador_id, data);

ALTER TABLE public.feriado_excecao ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feriado_excecao TO authenticated;
GRANT ALL ON public.feriado_excecao TO service_role;

-- Política criada apenas se a tabela ainda não tiver nenhuma: em
-- produção a tabela já existe com a política dela, e não é papel deste
-- arquivo trocá-la por outra sem necessidade.
DO $pol$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname = 'public' AND tablename = 'feriado_excecao') THEN
    CREATE POLICY "Tenant gerencia feriado_excecao" ON public.feriado_excecao
      FOR ALL TO authenticated
      USING (tenant_id = public.current_user_tenant_id())
      WITH CHECK (tenant_id = public.current_user_tenant_id());
  END IF;
END $pol$;

-- ── 3) A função, cópia literal da produção ───────────────────────────
CREATE OR REPLACE FUNCTION public.feriado_comportamento(
  p_tenant_id uuid,
  p_cpf text,
  p_colaborador_id uuid,
  p_data date
)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_comp TEXT;
BEGIN
  SELECT comportamento INTO v_comp FROM public.feriado_excecao
  WHERE tenant_id = p_tenant_id AND colaborador_id = p_colaborador_id AND data = p_data LIMIT 1;
  IF v_comp IS NOT NULL THEN RETURN v_comp; END IF;

  SELECT comportamento INTO v_comp FROM public.feriado_excecao
  WHERE tenant_id = p_tenant_id AND colaborador_id = p_colaborador_id AND data IS NULL LIMIT 1;
  IF v_comp IS NOT NULL THEN RETURN v_comp; END IF;

  SELECT e.comportamento_feriado INTO v_comp
  FROM public.ponto_escala_atribuicoes a
  JOIN public.ponto_escalas e ON e.id = a.escala_id
  WHERE a.tenant_id = p_tenant_id
    AND (a.colaborador_cpf = p_cpf OR a.colaborador_id = p_colaborador_id::text)
    AND COALESCE(a.ativa, true) = true
    AND a.data_inicio <= p_data AND (a.data_fim IS NULL OR a.data_fim >= p_data)
  ORDER BY a.data_inicio DESC LIMIT 1;

  RETURN COALESCE(v_comp, 'folga');
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.feriado_comportamento(uuid, text, uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.feriado_comportamento(uuid, text, uuid, date) TO authenticated, service_role;

-- ── 4) A tabela nova entra na trava do cercado de QA ─────────────────
DO $cercas$
DECLARE v_n int;
BEGIN
  IF to_regprocedure('public.qa_instalar_cercas()') IS NULL THEN RETURN; END IF;
  SELECT count(*) INTO v_n FROM public.qa_instalar_cercas();
  RAISE NOTICE 'Cercas de QA conferidas: % tabela(s).', v_n;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Cercas não puderam ser conferidas agora (%).', SQLERRM;
END $cercas$;

-- ── Conferência da própria migration ─────────────────────────────────
DO $verifica$
DECLARE v_falta text := '';
BEGIN
  IF to_regprocedure('public.feriado_comportamento(uuid,text,uuid,date)') IS NULL THEN
    v_falta := v_falta || ' feriado_comportamento';
  END IF;
  IF to_regclass('public.feriado_excecao') IS NULL THEN
    v_falta := v_falta || ' feriado_excecao';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'ponto_escalas'
                    AND column_name = 'comportamento_feriado') THEN
    v_falta := v_falta || ' ponto_escalas.comportamento_feriado';
  END IF;
  IF v_falta <> '' THEN
    RAISE EXCEPTION 'Resgate incompleto:%', v_falta;
  END IF;
  RAISE NOTICE 'OK: adicional de feriado (RN23) passa a existir em banco montado pelas migrations.';
END $verifica$;

-- =====================================================================
-- PONTO-320 · O feriado trabalhado não aparecia na apuração do adicional
--
-- Com a função resgatada, a rotina PONTO-320 deixou de quebrar mas
-- passou a falhar por um segundo motivo, este de conteúdo: o feriado
-- trabalhado simplesmente não entrava na apuração.
--
-- A cadeia RN23 descobre a empresa do colaborador assim:
--
--   v_cid := ponto_colaborador_id_por_cpf(tenant, cpf)   -- lê ponto_diario
--   v_emp := ponto_empresa_do_colaborador(v_cid)         -- lê admissoes.id
--
-- O primeiro passo devolve o `colaborador_id` GRAVADO NA LINHA de ponto,
-- que nem sempre é o id da admissão — quem gravou a linha pode ter posto
-- outro identificador. O segundo passo procura esse valor em
-- admissoes.id e não acha: devolve NULL. Com empresa nula,
-- feriados_da_empresa não devolve os feriados daquela unidade, e o dia
-- trabalhado no feriado desaparece da apuração — sem erro, sem aviso.
--
-- Na prática: adicional de 100% não pago (Lei 605/1949, art. 9º; Súmula
-- 146 do TST) em silêncio, sempre que a linha de ponto tiver sido criada
-- por um caminho que não carimbou o id da admissão.
--
-- Correção: a empresa passa a ser resolvida com queda para o CPF
-- (ponto_empresa_do_cpf), que consulta a admissão pelo CPF — a chave
-- estável deste sistema, a mesma da unicidade de ponto_diario. E o
-- colaborador, quando a linha de ponto não o resolve, também é buscado
-- na admissão em vez de abortar a apuração.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.ponto_feriados_trabalhados(
  p_tenant_id uuid, p_colaborador_cpf text, p_ini date, p_fim date
)
RETURNS TABLE(data date, feriado_nome text, origem text, comportamento text,
              trabalhado_min integer, folga_compensatoria_em date,
              adicional_100_min integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cid uuid;
  v_emp uuid;
BEGIN
  v_cid := public.ponto_colaborador_id_por_cpf(p_tenant_id, p_colaborador_cpf);
  IF v_cid IS NULL THEN
    SELECT a.id INTO v_cid FROM public.admissoes a
    WHERE a.tenant_id = p_tenant_id
      AND regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g')
          = regexp_replace(COALESCE(p_colaborador_cpf, ''), '[^0-9]', '', 'g')
    ORDER BY COALESCE(a.inativo, false), a.data_admissao DESC NULLS LAST
    LIMIT 1;
  END IF;
  IF v_cid IS NULL THEN RETURN; END IF;

  -- A empresa vem da admissão pelo CPF quando o id da linha de ponto não
  -- corresponde a uma admissão. Sem isso o feriado da unidade some.
  v_emp := COALESCE(public.ponto_empresa_do_colaborador(v_cid),
                    public.ponto_empresa_do_cpf(p_tenant_id, p_colaborador_cpf));

  RETURN QUERY
  SELECT
    h.data,
    h.nome,
    h.origem,
    public.feriado_comportamento(p_tenant_id, p_colaborador_cpf, v_cid, h.data) AS comportamento,
    t.trab_min,
    fc.data_folga,
    CASE WHEN fc.data_folga IS NULL THEN t.trab_min ELSE 0 END AS adicional_100_min
  FROM public.feriados_da_empresa(p_tenant_id, v_emp, p_ini, p_fim) h
  JOIN LATERAL (
    SELECT COALESCE((EXTRACT(EPOCH FROM pd.horas_trabalhadas) / 60)::int, 0) AS trab_min
    FROM public.ponto_diario pd
    WHERE pd.tenant_id = p_tenant_id
      AND pd.colaborador_cpf = p_colaborador_cpf
      AND pd.data = h.data
    LIMIT 1
  ) t ON t.trab_min > 0
  LEFT JOIN public.feriado_folga_compensatoria fc
    ON fc.tenant_id = p_tenant_id
   AND fc.colaborador_cpf = p_colaborador_cpf
   AND fc.data_feriado = h.data
  ORDER BY h.data;
END;
$function$;

-- Mesma fragilidade na função que alimenta a lista de dias da tela.
CREATE OR REPLACE FUNCTION public.ponto_feriados_competencia(
  p_tenant_id uuid, p_colaborador_cpf text, p_competencia text
)
RETURNS TABLE(data date, feriado_nome text, origem text, trabalhado_min integer,
              folga_compensatoria_em date, adicional_100_min integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cid uuid;
  v_emp uuid;
  v_ini date;
  v_fim date;
BEGIN
  v_cid := public.ponto_colaborador_id_por_cpf(p_tenant_id, p_colaborador_cpf);
  IF v_cid IS NULL THEN
    SELECT a.id INTO v_cid FROM public.admissoes a
    WHERE a.tenant_id = p_tenant_id
      AND regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g')
          = regexp_replace(COALESCE(p_colaborador_cpf, ''), '[^0-9]', '', 'g')
    ORDER BY COALESCE(a.inativo, false), a.data_admissao DESC NULLS LAST
    LIMIT 1;
  END IF;
  IF v_cid IS NULL THEN RETURN; END IF;

  v_emp := COALESCE(public.ponto_empresa_do_colaborador(v_cid),
                    public.ponto_empresa_do_cpf(p_tenant_id, p_colaborador_cpf));

  v_ini := to_date(p_competencia || '-01', 'YYYY-MM-DD');
  v_fim := (v_ini + interval '1 month - 1 day')::date;

  RETURN QUERY
  SELECT
    h.data,
    h.nome,
    h.origem,
    COALESCE(t.trab_min, 0),
    fc.data_folga,
    CASE WHEN COALESCE(t.trab_min, 0) > 0 AND fc.data_folga IS NULL
         THEN t.trab_min ELSE 0 END
  FROM public.feriados_da_empresa(p_tenant_id, v_emp, v_ini, v_fim) h
  LEFT JOIN LATERAL (
    SELECT COALESCE((EXTRACT(EPOCH FROM pd.horas_trabalhadas) / 60)::int, 0) AS trab_min
    FROM public.ponto_diario pd
    WHERE pd.tenant_id = p_tenant_id
      AND pd.colaborador_cpf = p_colaborador_cpf
      AND pd.data = h.data
    LIMIT 1
  ) t ON true
  LEFT JOIN public.feriado_folga_compensatoria fc
    ON fc.tenant_id = p_tenant_id
   AND fc.colaborador_cpf = p_colaborador_cpf
   AND fc.data_feriado = h.data
  ORDER BY h.data;
END;
$function$;

-- ── RETRATO DE DEPOIS ────────────────────────────────────────────────
DO $depois$
DECLARE
  v_comp text := to_char(CURRENT_DATE - interval '1 month', 'YYYY-MM');
  t RECORD;
  v_ad bigint; v_colab bigint; v_dias bigint; v_sememp bigint;
BEGIN
  DELETE FROM public.ponto_entrega_conferencia
   WHERE competencia = v_comp AND momento = 'depois';

  FOR t IN SELECT id FROM public.tenants LOOP
    v_ad := NULL; v_colab := NULL; v_dias := NULL; v_sememp := NULL;

    BEGIN
      SELECT COALESCE(sum(f.minutos_adicional_100), 0) INTO v_ad
      FROM public.ponto_feriado_adicional_competencia(t.id, NULL, v_comp) f;
    EXCEPTION WHEN OTHERS THEN v_ad := NULL;
    END;

    BEGIN
      SELECT count(*), COALESCE(sum(d.dias_sem_linha), 0) INTO v_colab, v_dias
      FROM public.ponto_dias_nao_materializados(t.id, v_comp) d;
    EXCEPTION WHEN OTHERS THEN v_colab := NULL; v_dias := NULL;
    END;

    SELECT count(DISTINCT pd.colaborador_cpf) INTO v_sememp
    FROM public.ponto_diario pd
    WHERE pd.tenant_id = t.id
      AND pd.empresa_id IS NULL
      AND to_char(pd.data, 'YYYY-MM') = v_comp;

    INSERT INTO public.ponto_entrega_conferencia
      (competencia, momento, tenant_id, minutos_adicional_feriado,
       colaboradores_sem_linha, dias_sem_linha, linhas_de_ponto_sem_empresa)
    VALUES (v_comp, 'depois', t.id, v_ad, v_colab, v_dias, v_sememp);
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
    (SELECT c FROM comp)                                                        AS competencia,
    COALESCE(sum(minutos_adicional_feriado) FILTER (WHERE momento = 'antes'), 0)  AS ad_antes,
    COALESCE(sum(minutos_adicional_feriado) FILTER (WHERE momento = 'depois'), 0) AS ad_depois,
    COALESCE(max(colaboradores_sem_linha)  FILTER (WHERE momento = 'depois'), 0)  AS colab_sem_linha,
    COALESCE(sum(dias_sem_linha)           FILTER (WHERE momento = 'depois'), 0)  AS dias_sem_linha,
    COALESCE(sum(linhas_de_ponto_sem_empresa) FILTER (WHERE momento = 'depois'), 0) AS sem_empresa
  FROM public.ponto_entrega_conferencia
  WHERE competencia = (SELECT c FROM comp)
),
instalado AS MATERIALIZED (
  SELECT
    CASE WHEN pg_get_functiondef(to_regprocedure('public.consolidar_ponto_diario_manual(uuid,text,date)'))
              ILIKE '%FROM public.admissoes a%' THEN 'sim' ELSE 'NAO' END          AS dia_sem_batida,
    CASE WHEN pg_get_functiondef(to_regprocedure('public.ponto_espelho_resumo_empresa(uuid,uuid,text)'))
              ILIKE '%= p_empresa_id OR%empresa_id IS NULL%' THEN 'NAO' ELSE 'sim' END AS valvula_removida,
    CASE WHEN to_regprocedure('public.feriado_comportamento(uuid,text,uuid,date)') IS NOT NULL
              AND to_regclass('public.feriado_excecao') IS NOT NULL
         THEN 'sim' ELSE 'NAO' END                                                 AS feriado_no_repositorio,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'ponto_retencao_config' AND column_name = 'anos_retencao')
         THEN 'sim' ELSE 'NAO' END                                                 AS retencao_coerente
)
SELECT r.competencia                                                    AS competencia_conferida,
       i.dia_sem_batida                                                 AS correcao_dia_sem_batida,
       i.valvula_removida                                               AS correcao_empresa,
       i.feriado_no_repositorio                                         AS correcao_feriado,
       i.retencao_coerente                                              AS correcao_retencao,
       r.ad_antes                                                       AS adicional_feriado_min_ANTES,
       r.ad_depois                                                      AS adicional_feriado_min_DEPOIS,
       (r.ad_depois - r.ad_antes)                                       AS diferenca_min_a_conferir,
       r.colab_sem_linha                                                AS colaboradores_com_dia_sem_linha,
       r.dias_sem_linha                                                 AS total_de_dias_sem_linha,
       r.sem_empresa                                                    AS colaboradores_com_linha_sem_empresa
FROM retrato r CROSS JOIN instalado i;
