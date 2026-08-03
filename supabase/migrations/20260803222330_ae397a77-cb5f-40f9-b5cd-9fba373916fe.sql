DO $do$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.ponto_saldo_dias_competencia(uuid,text,text)'::regprocedure);
  IF position('v_diff := v_trab_ajust - v_jornada_efetiva;' in d) = 0 THEN
    RAISE EXCEPTION 'trecho alvo nao encontrado';
  END IF;
  d := replace(
    d,
    'v_diff := v_trab_ajust - v_jornada_efetiva;',
    'v_diff := GREATEST(0, v_janela - v_interv_real - v_desc_interv) - v_jornada_efetiva;'
  );
  EXECUTE d;
END $do$;