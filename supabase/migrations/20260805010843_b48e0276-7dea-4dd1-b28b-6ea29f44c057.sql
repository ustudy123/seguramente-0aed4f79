CREATE OR REPLACE FUNCTION public.ponto_saldo_dias_competencia_marca_eq() RETURNS void LANGUAGE sql AS $$ SELECT 1; $$;
DROP FUNCTION public.ponto_saldo_dias_competencia_marca_eq();

DO $$
DECLARE
  v_src text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'ponto_saldo_dias_competencia';

  v_src := replace(
    v_src,
    'v_ja_emitiu := v_ja_emitiu || r.data;',
    'v_ja_emitiu := v_ja_emitiu || r.data;

    IF v_eq_data IS NOT NULL AND r.data = v_eq_data THEN
      v_eq_teve_linha := true;
    END IF;'
  );

  EXECUTE v_src;
END $$;