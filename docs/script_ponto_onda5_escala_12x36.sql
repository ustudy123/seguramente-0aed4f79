-- ============================================================================
-- ENTREGA — ONDA 5 (parte 6): escala 12x36 por ciclo
-- Alvos: ponto_apurar_ciclo_plantao_do_dia (nova); injecoes guardadas em
--        ponto_jornada_do_dia, ponto_saldo_dias_competencia (monolito) e
--        ponto_feriados_trabalhados.
--
-- ALVO DO MOTOR DE SALDO (drift do ensaio): no repositorio a apuracao foi
--   refatorada em casca + ponto_saldo_dias_competencia_bruto, mas ESSA
--   REFATORACAO NUNCA CHEGOU A PRODUCAO — la (e na homologacao, copia fiel) a
--   apuracao segue num unico corpo monolitico ponto_saldo_dias_competencia.
--   A ancora da injecao e identica nos dois; muda so o nome. Aqui o alvo e o
--   monolito. Verificado contra o corpo real de producao: a ancora casa e e unica.
-- PONTO-150 / PONTO-151
--
-- Os campos de ciclo existem na escala (tipo '12x36', ciclo_horas_trabalho/
-- descanso, ciclo_inicio_data) e nenhuma apuracao os lia: o plantonista 12x36
-- teria 4h de "extra" em todo plantao e "falta" em toda folga, e o feriado
-- trabalhado geraria dobra indevida (a 12x36 ja compensa por lei — art. 59-A e
-- §2º). Passa a: ler o ciclo (plantao/folga), nao gerar HE no plantao nem falta
-- na folga, e pular a dobra de feriado de quem e 12x36.
--
-- SEGURANCA (mesmo padrao da onda 3): as injecoes sao IDEMPOTENTES (so entram se
-- ainda nao estao) e GUARDADAS por ancora. Se o corpo em producao divergir da
-- ancora (remendo proprio), a injecao NAO altera nada e emite um aviso — a
-- conferencia abaixo acusa o que faltou. So muda quem e 12x36; para o resto, a
-- helper devolve eh_ciclo=false e nada muda. Aditivo. Sem backfill.
-- ============================================================================

-- (1) Helper do ciclo ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ponto_apurar_ciclo_plantao_do_dia(
  p_tenant_id      uuid,
  p_cpf            text,
  p_colaborador_id text,
  p_data           date
)
RETURNS TABLE(eh_ciclo boolean, eh_plantao boolean, jornada_min integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cpf   text := regexp_replace(COALESCE(p_cpf, ''), '[^0-9]', '', 'g');
  v_esc   public.ponto_escalas;
  v_trab  int;
  v_desc  int;
  v_cycle_days int;
  v_dias_trab  int;
  v_off   int;
BEGIN
  eh_ciclo := false; eh_plantao := NULL; jornada_min := NULL;

  SELECT e.* INTO v_esc
  FROM public.ponto_escala_atribuicoes a
  JOIN public.ponto_escalas e ON e.id = a.escala_id
  WHERE a.tenant_id = p_tenant_id
    AND (regexp_replace(COALESCE(a.colaborador_cpf, ''), '[^0-9]', '', 'g') = v_cpf
         OR a.colaborador_id::text = p_colaborador_id)
    AND COALESCE(a.ativa, true) = true
    AND a.data_inicio <= p_data
    AND (a.data_fim IS NULL OR a.data_fim >= p_data)
  ORDER BY a.data_inicio DESC
  LIMIT 1;

  IF v_esc.id IS NULL THEN
    RETURN NEXT; RETURN;
  END IF;

  v_esc := public.ponto_escala_com_versao(v_esc, p_data);
  v_trab := COALESCE(v_esc.ciclo_horas_trabalho, 0);
  v_desc := COALESCE(v_esc.ciclo_horas_descanso, 0);

  -- Escala de plantao por ciclo: tipo 12x36 (ou campos de ciclo preenchidos).
  IF COALESCE(v_esc.tipo, '') = '12x36' OR (v_trab > 0 AND v_desc > 0) THEN
    IF v_trab = 0 THEN v_trab := 12; END IF;   -- defaults do 12x36
    IF v_desc = 0 THEN v_desc := 36; END IF;
    eh_ciclo := true;

    -- Sem ancora nao da para localizar a posicao no ciclo.
    IF v_esc.ciclo_inicio_data IS NULL THEN
      RETURN NEXT; RETURN;
    END IF;

    v_cycle_days := GREATEST(1, ceil((v_trab + v_desc)::numeric / 24)::int);  -- 12x36 -> 2
    v_dias_trab  := GREATEST(1, ceil(v_trab::numeric / 24)::int);             -- 12x36 -> 1
    v_off := ((p_data - v_esc.ciclo_inicio_data) % v_cycle_days + v_cycle_days) % v_cycle_days;
    eh_plantao := (v_off < v_dias_trab);
    jornada_min := CASE WHEN eh_plantao THEN LEAST(v_trab, 24) * 60 ELSE 0 END;
  END IF;

  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.ponto_apurar_ciclo_plantao_do_dia(uuid, text, text, date) IS
  'Diz se o dia e plantao ou folga na escala de ciclo 12x36 (le ciclo_horas_trabalho/descanso a partir de ciclo_inicio_data) e a jornada do plantao. Base da apuracao por ciclo (CLT art. 59-A). eh_ciclo=false quando o vinculo nao e de plantao.';

-- (2) ponto_jornada_do_dia: jornada do ciclo no plantao, 0 na folga -----------
DO $inj$
DECLARE
  v_def text;
  v_anchor text := 'v_escala := public.ponto_escala_com_versao(v_escala, p_data);';
  v_add text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def FROM pg_proc
   WHERE proname = 'ponto_jornada_do_dia' AND pronamespace = 'public'::regnamespace LIMIT 1;
  IF v_def IS NULL THEN RETURN; END IF;

  IF position('ponto_apurar_ciclo_plantao_do_dia' IN v_def) > 0 THEN
    RETURN;  -- ja injetado
  ELSIF position(v_anchor IN v_def) = 0 THEN
    RAISE NOTICE 'ponto_jornada_do_dia: ancora do ciclo nao encontrada — NADA alterado (corpo divergente).';
    RETURN;
  END IF;

  v_add := v_anchor || E'\n\n  -- (150) 12x36 por ciclo (art. 59-A): plantao usa a jornada do ciclo; folga = 0.\n'
    || E'  DECLARE v_ciclo record;\n'
    || E'  BEGIN\n'
    || E'    SELECT * INTO v_ciclo FROM public.ponto_apurar_ciclo_plantao_do_dia(p_tenant_id, p_cpf, p_colaborador_id, p_data);\n'
    || E'    IF v_ciclo.eh_ciclo AND v_ciclo.eh_plantao IS NOT NULL THEN\n'
    || E'      jornada_min := v_ciclo.jornada_min;\n'
    || E'      tol_min := COALESCE(v_escala.tolerancia_diaria_minutos, 0);\n'
    || E'      RETURN NEXT; RETURN;\n'
    || E'    END IF;\n'
    || E'  END;';

  v_def := replace(v_def, v_anchor, v_add);
  EXECUTE v_def;
END $inj$;

-- (3) ponto_saldo_dias_competencia (monolito): folga do ciclo nao gera falta --
DO $inj$
DECLARE
  v_def text;
  v_anchor text := E'IF v_jornada IS NULL OR v_jornada = 0 THEN\n      IF EXTRACT(DOW FROM r.data)::int IN (0, 6) THEN\n        v_esperado := 0;\n      ELSE\n        v_esperado := COALESCE(v_fb_jornada, 0);\n      END IF;\n    ELSE\n      v_esperado := v_jornada;\n    END IF;';
  v_add text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def FROM pg_proc
   WHERE proname = 'ponto_saldo_dias_competencia' AND pronamespace = 'public'::regnamespace LIMIT 1;
  IF v_def IS NULL THEN RETURN; END IF;

  IF position('ponto_apurar_ciclo_plantao_do_dia' IN v_def) > 0 THEN
    RETURN;
  ELSIF position(v_anchor IN v_def) = 0 THEN
    RAISE NOTICE 'ponto_saldo_dias_competencia: ancora do ciclo nao encontrada — NADA alterado (corpo divergente; envie o pg_get_functiondef para reconciliar).';
    RETURN;
  END IF;

  v_add := v_anchor || E'\n\n    -- (150) 12x36 por ciclo (art. 59-A): plantao usa a jornada do ciclo; a FOLGA\n'
    || E'    -- do ciclo NAO gera falta (sobrepoe o fallback de 8h dos dias uteis).\n'
    || E'    DECLARE v_ciclo record;\n'
    || E'    BEGIN\n'
    || E'      SELECT * INTO v_ciclo FROM public.ponto_apurar_ciclo_plantao_do_dia(p_tenant_id, v_cpf, r.colaborador_id::text, r.data);\n'
    || E'      IF v_ciclo.eh_ciclo AND v_ciclo.eh_plantao IS NOT NULL THEN\n'
    || E'        IF v_ciclo.eh_plantao THEN v_esperado := COALESCE(v_ciclo.jornada_min, v_esperado);\n'
    || E'        ELSE v_esperado := 0; END IF;\n'
    || E'      END IF;\n'
    || E'    END;';

  v_def := replace(v_def, v_anchor, v_add);
  EXECUTE v_def;
END $inj$;

-- (4) ponto_feriados_trabalhados: pula a dobra de feriado na 12x36 ------------
DO $inj$
DECLARE
  v_def text;
  v_anchor text := 'CASE WHEN fc.data_folga IS NULL THEN t.trab_min ELSE 0 END';
  v_add text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def FROM pg_proc
   WHERE proname = 'ponto_feriados_trabalhados' AND pronamespace = 'public'::regnamespace LIMIT 1;
  IF v_def IS NULL THEN RETURN; END IF;

  IF position('ponto_apurar_ciclo_plantao_do_dia' IN v_def) > 0 THEN
    RETURN;
  ELSIF position(v_anchor IN v_def) = 0 THEN
    RAISE NOTICE 'ponto_feriados_trabalhados: ancora nao encontrada — NADA alterado (corpo divergente).';
    RETURN;
  END IF;

  -- (151) Na 12x36 (art. 59-A, §2º) o feriado ja e compensado pela escala de
  -- plantao — sem dobra. Zera o adicional quando o vinculo e de ciclo.
  v_add := 'CASE WHEN fc.data_folga IS NULL AND NOT COALESCE((SELECT c.eh_ciclo FROM public.ponto_apurar_ciclo_plantao_do_dia(p_tenant_id, p_colaborador_cpf, v_cid::text, h.data) c LIMIT 1), false) THEN t.trab_min ELSE 0 END';

  v_def := replace(v_def, v_anchor, v_add);
  EXECUTE v_def;
END $inj$;

-- ---------------------------------------------------------------------------
-- CONFERENCIA — o SQL Editor mostra apenas o ultimo resultado.
-- Esperado: t | t | t | t | OK
--   helper_existe : t  (ponto_apurar_ciclo_plantao_do_dia)
--   jornada_ciclo : t  (ponto_jornada_do_dia le o ciclo)
--   saldo_ciclo   : t  (o motor de saldo le o ciclo — se f, o corpo de producao
--                       divergiu: me envie pg_get_functiondef(ponto_saldo_dias_
--                       competencia) para reconciliar)
--   feriado_ciclo : t  (a apuracao de feriado distingue a 12x36)
-- ---------------------------------------------------------------------------
SELECT
  (to_regprocedure('public.ponto_apurar_ciclo_plantao_do_dia(uuid,text,text,date)') IS NOT NULL) AS helper_existe,
  (EXISTS (SELECT 1 FROM pg_proc WHERE proname='ponto_jornada_do_dia'
     AND prosrc ILIKE '%ponto_apurar_ciclo_plantao_do_dia%'))                                    AS jornada_ciclo,
  (EXISTS (SELECT 1 FROM pg_proc WHERE proname='ponto_saldo_dias_competencia'
     AND prosrc ILIKE '%ponto_apurar_ciclo_plantao_do_dia%'))                                    AS saldo_ciclo,
  (EXISTS (SELECT 1 FROM pg_proc WHERE proname='ponto_feriados_trabalhados'
     AND prosrc ILIKE '%ponto_apurar_ciclo_plantao_do_dia%'))                                    AS feriado_ciclo,
  CASE WHEN to_regprocedure('public.ponto_apurar_ciclo_plantao_do_dia(uuid,text,text,date)') IS NOT NULL
        AND EXISTS (SELECT 1 FROM pg_proc WHERE proname='ponto_jornada_do_dia' AND prosrc ILIKE '%ponto_apurar_ciclo_plantao_do_dia%')
        AND EXISTS (SELECT 1 FROM pg_proc WHERE proname='ponto_saldo_dias_competencia' AND prosrc ILIKE '%ponto_apurar_ciclo_plantao_do_dia%')
        AND EXISTS (SELECT 1 FROM pg_proc WHERE proname='ponto_feriados_trabalhados' AND prosrc ILIKE '%ponto_apurar_ciclo_plantao_do_dia%')
       THEN 'OK' ELSE 'CONFERIR (corpo divergente — ver aviso)' END AS erro_tecnico;
