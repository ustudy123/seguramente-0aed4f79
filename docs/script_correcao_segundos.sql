-- ============================================================
-- CORREÇÃO DOS SEGUNDOS — rodar de uma vez no SQL Editor
-- Equivale às migrations 20260804140000, 20260804160000 e
-- 20260804170000. Idempotente: rodar de novo não faz mal.
-- ============================================================

-- PARTE 1 — apuração do saldo passa a truncar os segundos
DO $do$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.ponto_saldo_dias_competencia(uuid,text,text)'::regprocedure);
  IF position('floor(EXTRACT(EPOCH FROM' in d) > 0 THEN
    RAISE NOTICE 'PARTE 1: ja aplicada.'; RETURN;
  END IF;
  IF position('v_janela := (EXTRACT(EPOCH FROM r.saida)/60)::int - (EXTRACT(EPOCH FROM r.entrada)/60)::int;' in d) = 0 THEN
    RAISE EXCEPTION 'PARTE 1: trecho alvo nao encontrado — abortado.';
  END IF;
  d := replace(d,
    'v_janela := (EXTRACT(EPOCH FROM r.saida)/60)::int - (EXTRACT(EPOCH FROM r.entrada)/60)::int;',
    'v_janela := floor(EXTRACT(EPOCH FROM (r.saida - r.entrada))/60)::int;');
  d := regexp_replace(d,
    '\(EXTRACT\(EPOCH FROM ([a-zA-Z_][a-zA-Z0-9_\.]*)\)/60\)::int',
    'floor(EXTRACT(EPOCH FROM \1)/60)::int', 'g');
  EXECUTE d;
  RAISE NOTICE 'PARTE 1: aplicada.';
END $do$;

-- PARTE 2 — consolidação diária passa a truncar os segundos
DO $do$
DECLARE d text; v_alvo text := '(EXTRACT(EPOCH FROM (v_marc.hora_marcacao - v_abr)) / 60)::INT';
BEGIN
  d := pg_get_functiondef('public._ponto_calc_dia(uuid,text,date,uuid)'::regprocedure);
  IF position('floor(EXTRACT(EPOCH FROM (v_marc.hora_marcacao' in d) > 0 THEN
    RAISE NOTICE 'PARTE 2: ja aplicada.'; RETURN;
  END IF;
  IF position(v_alvo in d) = 0 THEN
    RAISE EXCEPTION 'PARTE 2: trecho alvo nao encontrado — abortado.';
  END IF;
  d := replace(d, v_alvo, 'floor(EXTRACT(EPOCH FROM (v_marc.hora_marcacao - v_abr)) / 60)::INT');
  EXECUTE d;
  RAISE NOTICE 'PARTE 2: aplicada.';
END $do$;

-- PARTE 3 — recalcula os dias já gravados (inclui os com atestado)
CREATE OR REPLACE FUNCTION public.ponto_minutos_das_marcacoes(
  p_tenant_id uuid, p_colaborador_cpf text, p_data date)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  m RECORD; v_abr time; v_esp text := 'in'; v_classe text;
  v_dif int; v_min int := 0; v_pares int := 0;
BEGIN
  FOR m IN SELECT hora_marcacao, tipo_marcacao FROM public.ponto_marcacoes
           WHERE tenant_id = p_tenant_id AND colaborador_cpf = p_colaborador_cpf
             AND data_marcacao = p_data ORDER BY hora_marcacao
  LOOP
    v_classe := COALESCE(public.ponto_classifica_tipo(m.tipo_marcacao), v_esp);
    IF v_classe = 'in' THEN
      v_abr := m.hora_marcacao; v_esp := 'out';
    ELSE
      IF v_abr IS NOT NULL THEN
        v_dif := floor(EXTRACT(EPOCH FROM (m.hora_marcacao - v_abr)) / 60)::int;
        IF v_dif < 0 THEN v_dif := v_dif + 1440; END IF;
        v_min := v_min + GREATEST(0, v_dif);
        v_pares := v_pares + 1; v_abr := NULL;
      END IF;
      v_esp := 'in';
    END IF;
  END LOOP;
  IF v_pares = 0 THEN RETURN NULL; END IF;
  RETURN v_min;
END; $$;

CREATE OR REPLACE FUNCTION public.ponto_corrigir_horas_arredondadas(
  p_tenant_id uuid DEFAULT NULL, p_desde date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r RECORD; v_min int; v_atual int; v_n int := 0; v_minutos int := 0;
BEGIN
  FOR r IN
    SELECT d.tenant_id, d.colaborador_cpf, d.data, d.horas_trabalhadas
    FROM public.ponto_diario d
    WHERE (p_tenant_id IS NULL OR d.tenant_id = p_tenant_id)
      AND (p_desde IS NULL OR d.data >= p_desde)
  LOOP
    v_min := public.ponto_minutos_das_marcacoes(r.tenant_id, r.colaborador_cpf, r.data);
    IF v_min IS NULL THEN CONTINUE; END IF;
    v_atual := COALESCE((EXTRACT(EPOCH FROM r.horas_trabalhadas) / 60)::int, 0);
    IF v_atual = v_min THEN CONTINUE; END IF;
    UPDATE public.ponto_diario
       SET horas_trabalhadas = make_interval(mins => v_min), updated_at = now()
     WHERE tenant_id = r.tenant_id AND colaborador_cpf = r.colaborador_cpf AND data = r.data;
    v_n := v_n + 1; v_minutos := v_minutos + (v_atual - v_min);
  END LOOP;
  RETURN jsonb_build_object('success', true, 'dias_corrigidos', v_n, 'minutos_devolvidos', v_minutos);
END; $$;

REVOKE EXECUTE ON FUNCTION public.ponto_minutos_das_marcacoes(uuid, text, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ponto_corrigir_horas_arredondadas(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ponto_minutos_das_marcacoes(uuid, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ponto_corrigir_horas_arredondadas(uuid, date) TO authenticated;

SELECT public.ponto_corrigir_horas_arredondadas(NULL, NULL) AS reparo;

-- CONFERÊNCIA
SELECT
  position('floor(EXTRACT(EPOCH FROM' in
    pg_get_functiondef('public.ponto_saldo_dias_competencia(uuid,text,text)'::regprocedure)) > 0 AS saldo_ok,
  position('floor(EXTRACT(EPOCH FROM (v_marc.hora_marcacao' in
    pg_get_functiondef('public._ponto_calc_dia(uuid,text,date,uuid)'::regprocedure)) > 0 AS consolidacao_ok,
  (SELECT horas_trabalhadas::text FROM public.ponto_diario
    WHERE colaborador_cpf = '11869993900' AND data = '2026-06-30') AS kailaine_30_06;
