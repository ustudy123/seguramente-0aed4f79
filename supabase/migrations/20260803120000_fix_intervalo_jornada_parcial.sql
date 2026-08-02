-- =====================================================================
-- FIX: intervalo de almoço descontado de dias parciais
--
-- Casos reais de produção:
--   * Kailaine (30/06/2026): atestado de horas 7h26 + trabalho 07:38–08:50.
--     Saiu ANTES do almoço, mas o motor descontou o intervalo integral da
--     escala (72min) do tempo trabalhado (72min) => trabalhado = 0h00 e a
--     jornada remanescente inteira (1h12) virou débito no banco de horas.
--   * Jaqueline (08/06/2026): 07:52–12:00 e 13:22–20:07. O intervalo REAL
--     foi 82min, mas o motor descontou os 90min nominais da escala => o
--     Banco mostrava 10h45 enquanto o Espelho mostrava 10h53 (RN18).
--
-- Causa única: em ponto_saldo_dias_competencia o tempo trabalhado era
--   GREATEST(0, saida_consolidada - entrada_consolidada - intervalo_escala)
-- ou seja, o intervalo previsto era subtraído SEMPRE, sem verificar se ele
-- de fato ocorreu (marcado nas batidas) ou se a janela trabalhada sequer
-- alcançou o horário do intervalo.
--
-- Correção (mesma regra do Espelho, preservando a tolerância de batida):
--   1. Se o colaborador REGISTROU o intervalo (há batidas intermediárias),
--      usa o intervalo real — que já está descontado no pareamento.
--   2. Se NÃO registrou, desconta o intervalo previsto apenas na parte que
--      a janela trabalhada realmente atravessa (quem sai antes do almoço
--      não almoçou). Isso preserva a proteção contra quem "esquece" de
--      bater o almoço e trabalha o dia inteiro.
--   3. Sem janela de intervalo conhecida, desconta no máximo o excedente
--      sobre a jornada — nunca zera um dia curto legitimamente trabalhado.
--   4. Turno que cruza a meia-noite deixa de zerar o trabalhado.
--
-- IMPORTANTE: esta versão parte de 20260801120000_fix_equalizacao_sabado_
-- trabalhado.sql e PRESERVA integralmente a equalização mensal (RN05/RN06/
-- RN11), as colunas equalizacao/excedente_retido_min e a retenção do
-- excedente. A única alteração no corpo é o cálculo do intervalo.
--
-- Escopo deliberadamente restrito, para que o comparativo antes/depois
-- isole uma única variável. A precedência de horas_extras/horas_faltantes
-- sobre o atestado (bug latente no mesmo arquivo) NÃO é tocada aqui.
-- =====================================================================

-- 1) JANELA DO INTERVALO PREVISTO NA ESCALA ---------------------------
-- Resolve a escala do dia igual a ponto_escala_do_dia e devolve o horário
-- de início/fim do almoço. Fontes, em ordem:
--   a) dias_config[dia].inicio_almoco / fim_almoco (modelo atual)
--   b) ponto_escala_periodos: intervalo = vão entre o fim de um bloco e o
--      início do bloco seguinte (mesma fonte usada pelo Espelho)
CREATE OR REPLACE FUNCTION public.ponto_intervalo_janela_do_dia(
  p_tenant_id uuid,
  p_cpf text,
  p_colaborador_id text,
  p_data date
)
RETURNS TABLE(inicio time without time zone, fim time without time zone)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_escala public.ponto_escalas;
  v_dia_key text;
  v_dia_cfg jsonb;
  v_cpf text := regexp_replace(COALESCE(p_cpf, ''), '[^0-9]', '', 'g');
BEGIN
  SELECT e.* INTO v_escala
  FROM public.ponto_escala_atribuicoes a
  JOIN public.ponto_escalas e ON e.id = a.escala_id
  WHERE a.tenant_id = p_tenant_id
    AND (regexp_replace(COALESCE(a.colaborador_cpf,''), '[^0-9]', '', 'g') = v_cpf
         OR a.colaborador_id = p_colaborador_id)
    AND COALESCE(a.ativa, true) = true
    AND a.data_inicio <= p_data
    AND (a.data_fim IS NULL OR a.data_fim >= p_data)
  ORDER BY a.data_inicio DESC
  LIMIT 1;

  IF v_escala.id IS NULL THEN
    RETURN;
  END IF;

  v_dia_key := CASE EXTRACT(DOW FROM p_data)::int
    WHEN 0 THEN 'domingo' WHEN 1 THEN 'segunda' WHEN 2 THEN 'terca'
    WHEN 3 THEN 'quarta' WHEN 4 THEN 'quinta' WHEN 5 THEN 'sexta'
    WHEN 6 THEN 'sabado'
  END;

  -- (a) dias_config
  IF v_escala.dias_config IS NOT NULL AND jsonb_typeof(v_escala.dias_config) = 'object' THEN
    v_dia_cfg := v_escala.dias_config -> v_dia_key;
    IF v_dia_cfg IS NOT NULL
       AND COALESCE((v_dia_cfg->>'trabalha')::boolean, false)
       AND COALESCE((v_dia_cfg->>'tem_almoco')::boolean, false)
       AND (v_dia_cfg->>'inicio_almoco') IS NOT NULL
       AND (v_dia_cfg->>'fim_almoco') IS NOT NULL THEN
      BEGIN
        inicio := (v_dia_cfg->>'inicio_almoco')::time;
        fim := (v_dia_cfg->>'fim_almoco')::time;
        IF inicio IS NOT NULL AND fim IS NOT NULL AND fim > inicio THEN
          RETURN NEXT;
          RETURN;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        NULL; -- config malformada: cai para a fonte (b)
      END;
    END IF;
  END IF;

  -- (b) vão entre blocos consecutivos da escala
  SELECT p1.hora_fim, p2.hora_inicio
    INTO inicio, fim
  FROM public.ponto_escala_periodos p1
  JOIN public.ponto_escala_periodos p2
    ON p2.escala_id = p1.escala_id
   AND p2.dia_semana = p1.dia_semana
   AND p2.ordem_bloco = p1.ordem_bloco + 1
  WHERE p1.escala_id = v_escala.id
    AND p1.dia_semana = v_dia_key
    AND p2.hora_inicio > p1.hora_fim
  ORDER BY p1.ordem_bloco ASC
  LIMIT 1;

  IF inicio IS NOT NULL AND fim IS NOT NULL THEN
    RETURN NEXT;
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.ponto_intervalo_janela_do_dia(uuid, text, text, date)
  TO authenticated, service_role;

-- 2) SNAPSHOT "ANTES" (roda com a função AINDA na versão antiga) -------
CREATE TABLE IF NOT EXISTS public.ponto_saldo_fix_intervalo_snapshot (
  id bigserial PRIMARY KEY,
  fase text NOT NULL CHECK (fase IN ('antes', 'depois')),
  tenant_id uuid NOT NULL,
  colaborador_cpf text NOT NULL,
  competencia text NOT NULL,
  dia date NOT NULL,
  trabalhado_min int,
  jornada_min int,
  saldo_min int,
  protegido boolean,
  capturado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saldo_fix_snapshot_chave
  ON public.ponto_saldo_fix_intervalo_snapshot (tenant_id, colaborador_cpf, competencia, dia, fase);

ALTER TABLE public.ponto_saldo_fix_intervalo_snapshot ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "saldo_fix_snapshot_select" ON public.ponto_saldo_fix_intervalo_snapshot
    FOR SELECT USING (tenant_id = public.get_user_tenant_id() OR public.is_superadmin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- O snapshot percorre todos os colaboradores com banco nos últimos 3 meses:
-- sem isto o statement_timeout padrão pode abortar a migration em bases grandes.
SET statement_timeout = 0;

-- Idempotente: só captura o "antes" se ainda não existir. Numa reexecução
-- (a primeira tentativa desta migration falhava por mudança de tipo de
-- retorno) o "antes" original é preservado.
DO $capt$
DECLARE
  r RECORD;
  v_total int := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM public.ponto_saldo_fix_intervalo_snapshot WHERE fase = 'antes') THEN
    RAISE NOTICE 'Snapshot ANTES já existe — preservado.';
    RETURN;
  END IF;

  FOR r IN
    SELECT DISTINCT b.tenant_id, b.colaborador_cpf, b.competencia
    FROM public.ponto_banco_horas b
    WHERE b.competencia >= to_char(CURRENT_DATE - INTERVAL '3 months', 'YYYY-MM')
  LOOP
    BEGIN
      INSERT INTO public.ponto_saldo_fix_intervalo_snapshot
        (fase, tenant_id, colaborador_cpf, competencia, dia, trabalhado_min, jornada_min, saldo_min, protegido)
      SELECT 'antes', r.tenant_id, r.colaborador_cpf, r.competencia,
             s.dia, s.trabalhado_min, s.jornada_min, s.saldo_min, s.protegido
      FROM public.ponto_saldo_dias_competencia(r.tenant_id, r.colaborador_cpf, r.competencia) s;
      v_total := v_total + 1;
    EXCEPTION WHEN OTHERS THEN
      NULL; -- um colaborador com dado inconsistente não aborta o snapshot
    END;
  END LOOP;
  RAISE NOTICE 'Snapshot ANTES: % colaborador(es)/competência(s) capturado(s)', v_total;
END $capt$;

-- 3) FUNÇÃO CORRIGIDA (base: 20260801120000 + correção do intervalo) ----
CREATE OR REPLACE FUNCTION public.ponto_saldo_dias_competencia(p_tenant_id uuid, p_colaborador_cpf text, p_competencia text)
 RETURNS TABLE(dia date, entrada time without time zone, saida time without time zone, trabalhado_min integer, jornada_min integer, saldo_min integer, protegido boolean, equalizacao boolean, excedente_retido_min integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_ini date := to_date(p_competencia || '-01', 'YYYY-MM-DD');
  v_fim date := (to_date(p_competencia || '-01', 'YYYY-MM-DD') + INTERVAL '1 month - 1 day')::date;
  v_cpf text := regexp_replace(COALESCE(p_colaborador_cpf, ''), '[^0-9]', '', 'g');
  v_colaborador_id text;
  v_fb_jornada int;
  v_fb_tol int := 0;
  v_fb_escala_id uuid;
  v_jornada int;
  v_tol int;
  v_esperado int;
  v_atest_min int;
  v_jornada_efetiva int;
  v_extras int;
  v_faltantes int;
  v_trab int;
  v_diff int;
  v_ent_esc time; v_sai_esc time; v_interv int; v_tol_bat int;
  v_ent_cons int; v_sai_cons int; v_trab_ajust int; v_usou_batida boolean;
  v_protegido boolean;
  -- desconto de intervalo (correcao 03/08/2026)
  v_trab_marc int;      -- minutos pareados nas marcacoes (ja sem intervalos reais)
  v_janela int;         -- permanencia real: ultima saida - primeira entrada
  v_janela_cons int;    -- permanencia com as bordas ajustadas pela tolerancia
  v_interv_real int;    -- intervalo efetivamente registrado nas batidas
  v_desc_interv int;    -- intervalo previsto a descontar quando nao houve registro
  v_int_ini time; v_int_fim time;
  v_eq_data date;
  v_eq_total int;
  v_eq_liberado boolean := false;
  v_eq_teve_linha boolean := false;
  v_eq_m jsonb;
  v_eq_auto boolean := false;
  v_qtd_sab int := 0;
  r RECORD;
BEGIN
  SELECT colaborador_id INTO v_colaborador_id
  FROM public.ponto_diario
  WHERE tenant_id = p_tenant_id
    AND regexp_replace(colaborador_cpf, '[^0-9]', '', 'g') = v_cpf
    AND data BETWEEN v_ini AND v_fim
  ORDER BY data DESC
  LIMIT 1;

  SELECT e.jornada_diaria_minutos, COALESCE(e.tolerancia_diaria_minutos, 0), e.id
    INTO v_fb_jornada, v_fb_tol, v_fb_escala_id
  FROM public.ponto_escala_atribuicoes a
  JOIN public.ponto_escalas e ON e.id = a.escala_id
  WHERE a.tenant_id = p_tenant_id
    AND (regexp_replace(COALESCE(a.colaborador_cpf,''), '[^0-9]', '', 'g') = v_cpf OR a.colaborador_id = v_colaborador_id)
    AND COALESCE(a.ativa, true) = true
  ORDER BY a.data_inicio ASC
  LIMIT 1;

  SELECT pem.data_equalizacao, pem.total_equalizacao_min, (pem.art61_liberado_em IS NOT NULL)
    INTO v_eq_data, v_eq_total, v_eq_liberado
  FROM public.ponto_equalizacao_mensal pem
  WHERE pem.tenant_id = p_tenant_id
    AND pem.colaborador_cpf = v_cpf
    AND pem.competencia = p_competencia;

  -- FIX (chamado Kailaine) — Detecção automática do dia de equalização (RN05):
  -- se NÃO há marcação manual mas existe sábado com ponto no mês, esse sábado é
  -- o dia de equalização. Havendo vários, usa o último. Isso evita creditar o
  -- sábado cheio e ainda lançar débito-fantasma de fechamento num dia sem ponto.
  IF v_eq_data IS NULL AND v_fb_escala_id IS NOT NULL THEN
    SELECT count(*) INTO v_qtd_sab
    FROM public.ponto_diario d
    WHERE d.tenant_id = p_tenant_id
      AND regexp_replace(d.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf
      AND d.data BETWEEN v_ini AND v_fim
      AND EXTRACT(ISODOW FROM d.data) = 6
      AND (d.entrada IS NOT NULL OR COALESCE((EXTRACT(EPOCH FROM d.horas_trabalhadas)/60)::int,0) > 0);

    IF v_qtd_sab >= 1 THEN
      SELECT d.data INTO v_eq_data
      FROM public.ponto_diario d
      WHERE d.tenant_id = p_tenant_id
        AND regexp_replace(d.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf
        AND d.data BETWEEN v_ini AND v_fim
        AND EXTRACT(ISODOW FROM d.data) = 6
        AND (d.entrada IS NOT NULL OR COALESCE((EXTRACT(EPOCH FROM d.horas_trabalhadas)/60)::int,0) > 0)
      ORDER BY d.data DESC
      LIMIT 1;

      v_eq_m := public.ponto_equalizacao_competencia(p_tenant_id, v_fb_escala_id, p_competencia);
      v_eq_total := COALESCE((v_eq_m->>'total_equalizacao_min')::int, 0);
      v_eq_auto := (v_eq_total > 0);
      IF NOT v_eq_auto THEN
        v_eq_data := NULL;
      END IF;
    END IF;
  END IF;

  FOR r IN
    SELECT d.data, d.status, d.tipo_dia, d.observacao, d.horas_trabalhadas,
           d.horas_extras, d.horas_faltantes, d.colaborador_id, d.entrada, d.saida
    FROM public.ponto_diario d
    WHERE d.tenant_id = p_tenant_id
      AND regexp_replace(d.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf
      AND d.data BETWEEN v_ini AND v_fim
    ORDER BY d.data
  LOOP
    v_protegido := (
      r.status = 'justificado'
      OR COALESCE(r.tipo_dia, 'normal') IN ('ferias', 'atestado', 'afastamento', 'feriado')
      OR COALESCE(r.observacao, '') ILIKE '%atestado%'
      OR EXISTS (
        SELECT 1 FROM public.atestados a
        WHERE a.tenant_id = p_tenant_id
          AND regexp_replace(a.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf
          AND COALESCE(a.unidade_afastamento, 'dias') = 'dias'
          AND a.data_inicio_afastamento IS NOT NULL
          AND a.data_inicio_afastamento <= r.data
          AND COALESCE(a.data_fim_afastamento, a.data_inicio_afastamento) >= r.data
      )
    );

    IF v_protegido THEN
      IF v_eq_data IS NOT NULL AND r.data = v_eq_data THEN
        v_eq_teve_linha := true;
      END IF;
      dia := r.data; entrada := r.entrada; saida := r.saida;
      trabalhado_min := COALESCE((EXTRACT(EPOCH FROM r.horas_trabalhadas)/60)::int, 0);
      jornada_min := 0; saldo_min := 0; protegido := true;
      equalizacao := false; excedente_retido_min := 0;
      RETURN NEXT;
      CONTINUE;
    END IF;

    IF v_eq_data IS NOT NULL AND r.data = v_eq_data THEN
      v_eq_teve_linha := true;
      v_trab := COALESCE((EXTRACT(EPOCH FROM r.horas_trabalhadas)/60)::int, 0);
      v_diff := v_trab - COALESCE(v_eq_total, 0);
      excedente_retido_min := 0;
      IF v_diff > 120 AND NOT v_eq_liberado THEN
        excedente_retido_min := v_diff - 120;
        v_diff := 120;
      END IF;
      IF abs(v_diff) <= 10 THEN v_diff := 0; END IF;
      dia := r.data; entrada := r.entrada; saida := r.saida;
      trabalhado_min := v_trab;
      jornada_min := COALESCE(v_eq_total, 0);
      saldo_min := v_diff;
      protegido := false;
      equalizacao := true;
      RETURN NEXT;
      CONTINUE;
    END IF;

    SELECT j.jornada_min, j.tol_min INTO v_jornada, v_tol
    FROM public.ponto_jornada_do_dia(p_tenant_id, v_cpf, r.colaborador_id::text, r.data) j;

    IF v_jornada IS NULL OR v_jornada = 0 THEN
      IF EXTRACT(DOW FROM r.data)::int IN (0, 6) THEN
        v_esperado := 0;
      ELSE
        v_esperado := COALESCE(v_fb_jornada, 0);
      END IF;
    ELSE
      v_esperado := v_jornada;
    END IF;
    v_tol := CASE WHEN COALESCE(v_tol, 0) <> 0 THEN v_tol ELSE COALESCE(v_fb_tol, 0) END;

    SELECT COALESCE(SUM(COALESCE(a.horas_afastamento, 0) * 60 + COALESCE(a.minutos_afastamento, 0)), 0)
      INTO v_atest_min
    FROM public.atestados a
    WHERE a.tenant_id = p_tenant_id
      AND regexp_replace(a.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf
      AND COALESCE(a.unidade_afastamento, 'dias') = 'horas'
      AND a.data_inicio_afastamento IS NOT NULL
      AND a.data_inicio_afastamento <= r.data
      AND COALESCE(a.data_fim_afastamento, a.data_inicio_afastamento) >= r.data;

    v_jornada_efetiva := GREATEST(0, v_esperado - COALESCE(v_atest_min, 0));

    v_ent_esc := NULL; v_sai_esc := NULL; v_interv := 0; v_tol_bat := 10;
    BEGIN
      SELECT e.entrada, e.saida, COALESCE(e.intervalo_min, 0), COALESCE(e.tolerancia_batida_min, 10)
        INTO v_ent_esc, v_sai_esc, v_interv, v_tol_bat
      FROM public.ponto_escala_do_dia(p_tenant_id, v_cpf, r.colaborador_id::text, r.data) e;
    EXCEPTION WHEN OTHERS THEN
      v_ent_esc := NULL; v_sai_esc := NULL;
    END;

    v_trab := COALESCE((EXTRACT(EPOCH FROM r.horas_trabalhadas)/60)::int, 0);
    v_usou_batida := false;
    v_diff := 0;

    IF v_ent_esc IS NOT NULL AND v_sai_esc IS NOT NULL
       AND r.entrada IS NOT NULL AND r.saida IS NOT NULL
       AND v_jornada_efetiva > 0 THEN

      v_ent_cons := CASE
        WHEN abs((EXTRACT(EPOCH FROM r.entrada)/60)::int - (EXTRACT(EPOCH FROM v_ent_esc)/60)::int) <= COALESCE(v_tol_bat, 10)
          THEN (EXTRACT(EPOCH FROM v_ent_esc)/60)::int
        ELSE (EXTRACT(EPOCH FROM r.entrada)/60)::int
      END;

      v_sai_cons := CASE
        WHEN abs((EXTRACT(EPOCH FROM r.saida)/60)::int - (EXTRACT(EPOCH FROM v_sai_esc)/60)::int) <= COALESCE(v_tol_bat, 10)
          THEN (EXTRACT(EPOCH FROM v_sai_esc)/60)::int
        ELSE (EXTRACT(EPOCH FROM r.saida)/60)::int
      END;

      -- Intervalo REAL: o que a permanencia tem a mais do que o tempo pareado
      -- nas marcacoes. Se o colaborador bateu o almoco, aparece aqui.
      v_trab_marc := COALESCE((EXTRACT(EPOCH FROM r.horas_trabalhadas)/60)::int, 0);
      v_janela := (EXTRACT(EPOCH FROM r.saida)/60)::int - (EXTRACT(EPOCH FROM r.entrada)/60)::int;
      IF v_janela < 0 THEN
        v_janela := v_janela + 1440;  -- turno que vira o dia
      END IF;
      v_interv_real := GREATEST(0, v_janela - v_trab_marc);

      -- Janela consolidada (bordas na tolerancia). Turno que vira o dia:
      -- saida < entrada, soma 24h -- sem isto o trabalhado zerava.
      v_janela_cons := v_sai_cons - v_ent_cons;
      IF v_janela_cons < 0 THEN
        v_janela_cons := v_janela_cons + 1440;
      END IF;

      IF v_interv_real > 0 THEN
        -- Intervalo registrado: ja descontado no pareamento, nao desconta de novo.
        v_desc_interv := 0;
      ELSE
        -- Intervalo NAO registrado: desconta o previsto apenas na parte que a
        -- janela trabalhada realmente atravessa.
        v_int_ini := NULL; v_int_fim := NULL;
        IF v_sai_cons >= v_ent_cons THEN
          BEGIN
            SELECT w.inicio, w.fim INTO v_int_ini, v_int_fim
            FROM public.ponto_intervalo_janela_do_dia(p_tenant_id, v_cpf, r.colaborador_id::text, r.data) w;
          EXCEPTION WHEN OTHERS THEN
            v_int_ini := NULL; v_int_fim := NULL;
          END;
        END IF;

        IF v_int_ini IS NOT NULL AND v_int_fim IS NOT NULL THEN
          v_desc_interv := GREATEST(0,
            LEAST(v_sai_cons, (EXTRACT(EPOCH FROM v_int_fim)/60)::int)
            - GREATEST(v_ent_cons, (EXTRACT(EPOCH FROM v_int_ini)/60)::int)
          );
        ELSE
          -- Sem janela conhecida: desconta no maximo o excedente sobre a
          -- jornada -- nunca zera um dia curto legitimamente trabalhado.
          v_desc_interv := LEAST(COALESCE(v_interv, 0), GREATEST(0, v_janela - v_jornada_efetiva));
        END IF;
      END IF;

      v_trab_ajust := GREATEST(0, v_janela_cons - v_interv_real - v_desc_interv);
      v_diff := v_trab_ajust - v_jornada_efetiva;
      v_trab := v_trab_ajust;
      v_usou_batida := true;
    END IF;

    IF NOT v_usou_batida THEN
      v_extras    := COALESCE((EXTRACT(EPOCH FROM r.horas_extras)/60)::int, 0);
      v_faltantes := COALESCE((EXTRACT(EPOCH FROM r.horas_faltantes)/60)::int, 0);

      IF v_extras > 0 OR v_faltantes > 0 THEN
        v_diff := v_extras - v_faltantes;
      ELSIF v_jornada_efetiva = 0 THEN
        v_diff := GREATEST(0, v_trab);
      ELSIF r.status = 'falta' THEN
        v_diff := -v_jornada_efetiva;
      ELSE
        v_diff := v_trab - v_jornada_efetiva;
        IF abs(v_diff) <= COALESCE(v_tol, 0) THEN
          v_diff := 0;
        END IF;
      END IF;
    END IF;

    IF abs(v_diff) <= 10 THEN
      v_diff := 0;
    END IF;

    dia := r.data;
    entrada := r.entrada;
    saida := r.saida;
    trabalhado_min := v_trab;
    jornada_min := v_jornada_efetiva;
    saldo_min := v_diff;
    protegido := false;
    equalizacao := false;
    excedente_retido_min := 0;
    RETURN NEXT;
  END LOOP;

  IF v_eq_data IS NOT NULL AND NOT v_eq_teve_linha AND v_eq_data < CURRENT_DATE THEN
    dia := v_eq_data; entrada := NULL; saida := NULL;
    trabalhado_min := 0;
    jornada_min := COALESCE(v_eq_total, 0);
    saldo_min := -COALESCE(v_eq_total, 0);
    protegido := false; equalizacao := true; excedente_retido_min := 0;
    IF saldo_min <> 0 THEN RETURN NEXT; END IF;
  END IF;

  -- FIX (chamado Kailaine): fallback só dispara se NÃO houve sábado trabalhado.
  IF v_eq_data IS NULL AND v_fim < CURRENT_DATE AND v_fb_escala_id IS NOT NULL
     AND v_qtd_sab = 0 THEN
    v_eq_m := public.ponto_equalizacao_competencia(p_tenant_id, v_fb_escala_id, p_competencia);
    v_eq_total := COALESCE((v_eq_m->>'total_equalizacao_min')::int, 0);
    IF v_eq_total > 0 THEN
      dia := v_fim; entrada := NULL; saida := NULL;
      trabalhado_min := 0;
      jornada_min := v_eq_total;
      saldo_min := -v_eq_total;
      protegido := false; equalizacao := true; excedente_retido_min := 0;
      RETURN NEXT;
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ponto_saldo_dias_competencia(uuid, text, text) TO authenticated, service_role;

-- 4) SNAPSHOT "DEPOIS" + REAPURAÇÃO RETROATIVA -------------------------
DO $reap$
DECLARE
  r RECORD;
  v_reap int := 0;
BEGIN
  DELETE FROM public.ponto_saldo_fix_intervalo_snapshot WHERE fase = 'depois';

  FOR r IN
    SELECT DISTINCT b.tenant_id, b.colaborador_cpf, b.competencia
    FROM public.ponto_banco_horas b
    WHERE b.competencia >= to_char(CURRENT_DATE - INTERVAL '3 months', 'YYYY-MM')
  LOOP
    BEGIN
      INSERT INTO public.ponto_saldo_fix_intervalo_snapshot
        (fase, tenant_id, colaborador_cpf, competencia, dia, trabalhado_min, jornada_min, saldo_min, protegido)
      SELECT 'depois', r.tenant_id, r.colaborador_cpf, r.competencia,
             s.dia, s.trabalhado_min, s.jornada_min, s.saldo_min, s.protegido
      FROM public.ponto_saldo_dias_competencia(r.tenant_id, r.colaborador_cpf, r.competencia) s;

      -- Regrava as movimentações apuradas do banco (preserva lançamentos manuais)
      PERFORM public.apurar_banco_horas_colaborador(r.tenant_id, r.colaborador_cpf, r.competencia);
      v_reap := v_reap + 1;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
  RAISE NOTICE 'Snapshot DEPOIS + reapuração: % colaborador(es)/competência(s)', v_reap;
END $reap$;

RESET statement_timeout;

COMMENT ON TABLE public.ponto_saldo_fix_intervalo_snapshot IS
  'Comparativo antes/depois da correção do desconto de intervalo (03/08/2026). Evidência de auditoria; pode ser removida após a conferência do RH.';
