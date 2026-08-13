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

SET lock_timeout = '10s';

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
