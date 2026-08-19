-- ============================================================================
-- ONDA 4 (parte 1) — Faixas de intervalo intrajornada
-- PONTO-062
--
-- O mínimo de intervalo intrajornada depende da FAIXA de jornada (CLT art. 71):
--   · até 4 horas ......... nenhum mínimo;
--   · mais de 4 até 6h .... 15 minutos;
--   · acima de 6 horas .... 1 hora (60 minutos).
--
-- Esta é a BASE do cálculo de supressão (parte 2): sem as faixas, aplicar "1
-- hora para todos" criaria supressão fictícia nas jornadas curtas. Função pura
-- (IMMUTABLE), aditiva — nada do fluxo atual muda.
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
