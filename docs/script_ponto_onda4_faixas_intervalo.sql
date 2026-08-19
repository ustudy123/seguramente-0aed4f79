-- ============================================================================
-- ENTREGA — ONDA 4 (parte 1): faixas de intervalo intrajornada
-- Alvo: função public.ponto_intervalo_minimo_faixa
-- PONTO-062
--
-- O mínimo de intervalo intrajornada por FAIXA de jornada (CLT art. 71):
-- até 4h nenhum; 4-6h 15 min; acima de 6h 60 min. É a base do cálculo de
-- supressão (parte 2). Função pura (IMMUTABLE), aditiva, idempotente. Sem backfill.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ponto_intervalo_minimo_faixa(p_jornada_min integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  -- Faixa de jornada -> minimo de intervalo intrajornada (CLT art. 71):
  -- ate 4h (240 min) nenhum; 4-6h (ate 360) 15 min; acima de 6h 60 min.
  SELECT CASE
           WHEN COALESCE(p_jornada_min, 0) <= 240 THEN 0
           WHEN p_jornada_min <= 360         THEN 15
           ELSE 60
         END;
$$;

COMMENT ON FUNCTION public.ponto_intervalo_minimo_faixa(integer) IS
  'Minimo legal de intervalo intrajornada por FAIXA de jornada (CLT art. 71): ate 4h nenhum; 4-6h 15 min; acima de 6h 60 min. Base do calculo de supressao.';

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA — o SQL Editor mostra apenas o último resultado.
-- Esperado: t | 0 | 15 | 15 | 60 | OK  (as faixas do art. 71)
-- ---------------------------------------------------------------------------
SELECT
  (to_regprocedure('public.ponto_intervalo_minimo_faixa(integer)') IS NOT NULL) AS funcao_existe,
  public.ponto_intervalo_minimo_faixa(240) AS ate_4h,
  public.ponto_intervalo_minimo_faixa(300) AS de_4a6h,
  public.ponto_intervalo_minimo_faixa(360) AS ate_6h,
  public.ponto_intervalo_minimo_faixa(480) AS acima_6h,
  CASE
    WHEN to_regprocedure('public.ponto_intervalo_minimo_faixa(integer)') IS NOT NULL
     AND public.ponto_intervalo_minimo_faixa(240) = 0
     AND public.ponto_intervalo_minimo_faixa(300) = 15
     AND public.ponto_intervalo_minimo_faixa(360) = 15
     AND public.ponto_intervalo_minimo_faixa(480) = 60
      THEN 'OK' ELSE 'CONFERIR'
  END AS erro_tecnico;
