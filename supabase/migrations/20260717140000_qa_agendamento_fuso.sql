-- =========================================================
-- QA — correção de fuso horário no agendamento
--
-- DOIS BUGS, mesma raiz (fuso nao tratado). O projeto ja usa
-- America/Sao_Paulo em 5+ funcoes; o agendamento nao seguiu o padrao.
--
-- Maringa/PR = America/Sao_Paulo = UTC-3.
--
-- BUG 1 — display: qa_agendamento_proxima comparava o horario escolhido
--   com now() em UTC. Marcou sabado 11:00 as 09:42 (Brasil) -> no banco
--   eram 12:42 UTC -> "ja passou" -> mostrou proxima = sabado que vem.
--
-- BUG 2 — execucao (o pior): pg_cron dispara em UTC. "11:00" no cron =
--   11:00 UTC = 08:00 no Brasil. O robo rodaria 3h antes do marcado.
--
-- CORRECAO: 
--   - o cron agenda no horario UTC equivalente (hora escolhida + 3).
--     Ex.: usuario quer 11:00 Brasil -> cron dispara 14:00 UTC.
--   - o calculo da proxima execucao usa o relogio de Sao Paulo.
--
-- Nota: UTC-3 fixo. O Brasil nao tem mais horario de verao (extinto em
-- 2019), entao o offset e estavel. Usamos AT TIME ZONE nomeado, que
-- respeita a regra oficial caso volte a mudar.
-- =========================================================

-- ─────────────────────────────────────────────────────────
-- SINCRONIZAR — agenda no cron convertendo Brasil -> UTC
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_cron_sincronizar()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  d record;
  v_utc timestamptz;
  v_hora_utc int;
  v_min_utc int;
  v_dow_utc int;
  v_ligados int := 0;
BEGIN
  IF NOT public.is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas superadmin pode configurar o agendamento.';
  END IF;

  PERFORM cron.unschedule(jobname)
  FROM cron.job
  WHERE jobname = 'qa-bateria-agendada' OR jobname LIKE 'qa-bateria-dia-%';

  FOR d IN SELECT * FROM public.qa_agendamento_dias WHERE ligado ORDER BY dia_semana
  LOOP
    -- Converte o horario/dia escolhido (Brasil) para UTC, que e o que o cron usa.
    -- Ancoramos numa data qualquer que caia no dia da semana desejado.
    -- 2024-01-07 e um domingo (dow=0); somamos d.dia_semana para chegar no dia.
    v_utc := (
      (date '2024-01-07' + d.dia_semana)::timestamp
      + make_interval(hours => d.hora, mins => d.minuto)
    ) AT TIME ZONE 'America/Sao_Paulo';   -- interpreta como horario de SP -> vira timestamptz UTC

    v_hora_utc := extract(hour   from v_utc AT TIME ZONE 'UTC')::int;
    v_min_utc  := extract(minute from v_utc AT TIME ZONE 'UTC')::int;
    v_dow_utc  := extract(dow    from v_utc AT TIME ZONE 'UTC')::int;

    PERFORM cron.schedule(
      'qa-bateria-dia-' || d.dia_semana,
      format('%s %s * * %s', v_min_utc, v_hora_utc, v_dow_utc),
      $cmd$SELECT public.qa_rodar_agendada()$cmd$
    );
    v_ligados := v_ligados + 1;
  END LOOP;

  IF v_ligados = 0 THEN
    RETURN 'Nenhum dia agendado. O robo so roda manualmente.';
  END IF;
  RETURN format('%s dia(s) agendado(s), no seu horario (Brasilia).', v_ligados);
END $$;

REVOKE EXECUTE ON FUNCTION public.qa_cron_sincronizar() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.qa_cron_sincronizar() TO authenticated;

-- ─────────────────────────────────────────────────────────
-- PRÓXIMA EXECUÇÃO — calculada no relógio de São Paulo
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_agendamento_proxima()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_char(min(prox), 'DD/MM (Dy) HH24:MI')
  FROM (
    SELECT
      date_trunc('day', v_now)
        + make_interval(days =>
            ((d.dia_semana - extract(dow from v_now)::int) + 7) % 7
            + CASE
                WHEN ((d.dia_semana - extract(dow from v_now)::int) + 7) % 7 = 0
                     AND make_time(d.hora, d.minuto, 0) <= v_now::time
                THEN 7 ELSE 0 END)
        + make_interval(hours => d.hora, mins => d.minuto) AS prox
    FROM public.qa_agendamento_dias d,
         (SELECT timezone('America/Sao_Paulo', now()) AS v_now) t
    WHERE d.ligado AND public.is_superadmin(auth.uid())
  ) x;
$$;

REVOKE EXECUTE ON FUNCTION public.qa_agendamento_proxima() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.qa_agendamento_proxima() TO authenticated;

-- Reaplica no cron com a conversao correta (roda como postgres aqui).
DO $sync$
DECLARE d record; v_utc timestamptz;
BEGIN
  PERFORM cron.unschedule(jobname) FROM cron.job
  WHERE jobname='qa-bateria-agendada' OR jobname LIKE 'qa-bateria-dia-%';

  FOR d IN SELECT * FROM public.qa_agendamento_dias WHERE ligado LOOP
    v_utc := ((date '2024-01-07' + d.dia_semana)::timestamp
              + make_interval(hours => d.hora, mins => d.minuto))
             AT TIME ZONE 'America/Sao_Paulo';
    PERFORM cron.schedule('qa-bateria-dia-'||d.dia_semana,
      format('%s %s * * %s',
             extract(minute from v_utc AT TIME ZONE 'UTC')::int,
             extract(hour   from v_utc AT TIME ZONE 'UTC')::int,
             extract(dow    from v_utc AT TIME ZONE 'UTC')::int),
      $cmd$SELECT public.qa_rodar_agendada()$cmd$);
  END LOOP;
END $sync$;

-- ─────────────────────────────────────────────────────────
-- Conferência: mostra o horario Brasil E o UTC que foi pro cron
-- ─────────────────────────────────────────────────────────
SELECT
  (ARRAY['Dom','Seg','Ter','Qua','Qui','Sex','Sab'])[d.dia_semana+1] AS dia,
  lpad(d.hora::text,2,'0')||':'||lpad(d.minuto::text,2,'0') AS voce_marcou_brasil,
  j.schedule AS cron_em_utc,
  public.qa_agendamento_proxima() AS proxima
FROM public.qa_agendamento_dias d
LEFT JOIN cron.job j ON j.jobname = 'qa-bateria-dia-'||d.dia_semana
WHERE d.ligado
ORDER BY d.dia_semana;
