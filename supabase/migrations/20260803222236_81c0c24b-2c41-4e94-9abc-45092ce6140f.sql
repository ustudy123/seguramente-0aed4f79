DO $do$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.ponto_saldo_dias_competencia(uuid,text,text)'::regprocedure);
  IF position('v_trab := v_trab_ajust;' in d) = 0 THEN
    RAISE EXCEPTION 'trecho alvo nao encontrado';
  END IF;
  d := replace(
    d,
    'v_trab := v_trab_ajust;',
    'v_trab := GREATEST(0, v_janela - v_interv_real - v_desc_interv);'
  );
  EXECUTE d;
END $do$;