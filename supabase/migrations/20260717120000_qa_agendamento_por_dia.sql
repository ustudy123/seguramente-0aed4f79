-- =========================================================
-- QA — agendamento por dia da semana
--
-- SUBSTITUI o agendamento de horario unico. Rode DEPOIS de
-- 20260717100000_qa_agendamento_configuravel.sql.
--
-- ANTES: um horario, todo dia.
-- AGORA: cada dia da semana pode ter (ou nao) seu proprio horario.
--        Ex.: segunda 03:00, quarta 06:00, sexta 22:00, resto desligado.
--
-- COMO: no cron, o 5o campo e o dia da semana (0=domingo..6=sabado).
-- Criamos UM job por dia ligado — 'qa-bateria-dia-1', 'qa-bateria-dia-3'...
-- Cada cron.schedule e um job independente, entao isso e natural.
-- =========================================================

-- ─────────────────────────────────────────────────────────
-- 1) A GRADE — uma linha por dia da semana (7 linhas fixas)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.qa_agendamento_dias (
  dia_semana   int PRIMARY KEY CHECK (dia_semana BETWEEN 0 AND 6),  -- 0=dom..6=sab
  ligado       boolean NOT NULL DEFAULT false,
  hora         int NOT NULL DEFAULT 3 CHECK (hora BETWEEN 0 AND 23),
  minuto       int NOT NULL DEFAULT 0 CHECK (minuto BETWEEN 0 AND 59)
);

-- Semeia os 7 dias (todos desligados por padrao).
INSERT INTO public.qa_agendamento_dias (dia_semana, ligado, hora, minuto)
SELECT d, false, 3, 0 FROM generate_series(0,6) d
ON CONFLICT (dia_semana) DO NOTHING;

ALTER TABLE public.qa_agendamento_dias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "QA agendamento dias: apenas superadmin" ON public.qa_agendamento_dias;
CREATE POLICY "QA agendamento dias: apenas superadmin"
  ON public.qa_agendamento_dias FOR ALL
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

-- ─────────────────────────────────────────────────────────
-- 2) SINCRONIZAR — remove todos os jobs antigos, recria os dias ligados
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_cron_sincronizar()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  d record;
  v_nome text;
  v_ligados int := 0;
BEGIN
  IF NOT public.is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas superadmin pode configurar o agendamento.';
  END IF;

  -- Remove TODOS os jobs de QA (o antigo horario-unico e os por-dia).
  PERFORM cron.unschedule(jobname)
  FROM cron.job
  WHERE jobname = 'qa-bateria-agendada'
     OR jobname LIKE 'qa-bateria-dia-%';

  -- Recria um job para cada dia ligado.
  FOR d IN SELECT * FROM public.qa_agendamento_dias WHERE ligado ORDER BY dia_semana
  LOOP
    v_nome := 'qa-bateria-dia-' || d.dia_semana;
    -- 'minuto hora * * dia_semana'
    PERFORM cron.schedule(
      v_nome,
      format('%s %s * * %s', d.minuto, d.hora, d.dia_semana),
      $cmd$SELECT public.qa_rodar_agendada()$cmd$
    );
    v_ligados := v_ligados + 1;
  END LOOP;

  IF v_ligados = 0 THEN
    RETURN 'Nenhum dia agendado. O robo so roda manualmente.';
  END IF;
  RETURN format('%s dia(s) agendado(s).', v_ligados);
END $$;

REVOKE EXECUTE ON FUNCTION public.qa_cron_sincronizar() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.qa_cron_sincronizar() TO authenticated;

-- ─────────────────────────────────────────────────────────
-- 3) A TELA LÊ a grade inteira (7 dias) + a proxima execucao
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_agendamento_ler_dias()
RETURNS TABLE(dia_semana int, dia_nome text, ligado boolean, hora int, minuto int)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.dia_semana,
         (ARRAY['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'])[d.dia_semana + 1],
         d.ligado, d.hora, d.minuto
  FROM public.qa_agendamento_dias d
  WHERE public.is_superadmin(auth.uid())
  ORDER BY d.dia_semana;
$$;

REVOKE EXECUTE ON FUNCTION public.qa_agendamento_ler_dias() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.qa_agendamento_ler_dias() TO authenticated;

-- Calcula a proxima execucao olhando os 7 dias.
CREATE OR REPLACE FUNCTION public.qa_agendamento_proxima()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_char(min(prox), 'DD/MM (Dy) HH24:MI')
  FROM (
    SELECT
      -- para cada dia ligado, acha a proxima ocorrencia a partir de agora
      date_trunc('day', now())
        + make_interval(days =>
            ((d.dia_semana - extract(dow from now())::int) + 7) % 7
            + CASE
                WHEN ((d.dia_semana - extract(dow from now())::int) + 7) % 7 = 0
                     AND make_time(d.hora, d.minuto, 0) <= now()::time
                THEN 7 ELSE 0 END)
        + make_interval(hours => d.hora, mins => d.minuto) AS prox
    FROM public.qa_agendamento_dias d
    WHERE d.ligado AND public.is_superadmin(auth.uid())
  ) x;
$$;

REVOKE EXECUTE ON FUNCTION public.qa_agendamento_proxima() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.qa_agendamento_proxima() TO authenticated;

-- ─────────────────────────────────────────────────────────
-- 4) A TELA SALVA um dia (liga/desliga + horario) e re-sincroniza
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_agendamento_salvar_dia(
  p_dia    int,
  p_ligado boolean,
  p_hora   int,
  p_minuto int
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
BEGIN
  IF NOT public.is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas superadmin pode configurar o agendamento.';
  END IF;
  IF p_dia NOT BETWEEN 0 AND 6 THEN
    RAISE EXCEPTION 'Dia invalido: %.', p_dia;
  END IF;
  IF p_hora NOT BETWEEN 0 AND 23 OR p_minuto NOT BETWEEN 0 AND 59 THEN
    RAISE EXCEPTION 'Horario invalido: %:%.', p_hora, p_minuto;
  END IF;

  UPDATE public.qa_agendamento_dias
  SET ligado = p_ligado, hora = p_hora, minuto = p_minuto
  WHERE dia_semana = p_dia;

  RETURN public.qa_cron_sincronizar();
END $$;

REVOKE EXECUTE ON FUNCTION public.qa_agendamento_salvar_dia(int, boolean, int, int) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.qa_agendamento_salvar_dia(int, boolean, int, int) TO authenticated;

-- ─────────────────────────────────────────────────────────
-- 5) Migra a config antiga (horario unico) para a grade, se existia
-- ─────────────────────────────────────────────────────────
DO $migra$
DECLARE v_old public.qa_agendamento;
BEGIN
  SELECT * INTO v_old FROM public.qa_agendamento WHERE id = 1;
  -- Se o agendamento antigo estava ligado, liga esse mesmo horario em TODOS
  -- os dias (equivale ao "todo dia" anterior). O usuario ajusta depois.
  IF v_old.ligado THEN
    UPDATE public.qa_agendamento_dias
    SET ligado = true, hora = v_old.hora, minuto = v_old.minuto;
    RAISE NOTICE 'Config antiga (todo dia %:%) migrada para os 7 dias.',
      lpad(v_old.hora::text,2,'0'), lpad(v_old.minuto::text,2,'0');
  END IF;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Sem config antiga para migrar.';
END $migra$;

-- Aplica no cron o estado atual da grade.
DO $sync$ BEGIN
  PERFORM cron.unschedule(jobname) FROM cron.job
  WHERE jobname='qa-bateria-agendada' OR jobname LIKE 'qa-bateria-dia-%';
  -- re-cria direto (sem passar pela checagem de superadmin, pois roda como postgres)
  DECLARE d record; BEGIN
    FOR d IN SELECT * FROM public.qa_agendamento_dias WHERE ligado LOOP
      PERFORM cron.schedule('qa-bateria-dia-'||d.dia_semana,
        format('%s %s * * %s', d.minuto, d.hora, d.dia_semana),
        $cmd$SELECT public.qa_rodar_agendada()$cmd$);
    END LOOP;
  END;
END $sync$;

-- ─────────────────────────────────────────────────────────
-- Conferência
-- ─────────────────────────────────────────────────────────
SELECT 'grade de 7 dias criada' AS item,
       (SELECT count(*)::text FROM public.qa_agendamento_dias) || ' dias' AS valor
UNION ALL SELECT 'dias ligados agora',
       (SELECT count(*)::text FROM public.qa_agendamento_dias WHERE ligado)
UNION ALL SELECT 'jobs de cron ativos',
       (SELECT count(*)::text FROM cron.job WHERE jobname LIKE 'qa-bateria-dia-%')
UNION ALL SELECT 'ler_dias', COALESCE(to_regprocedure('public.qa_agendamento_ler_dias()')::text,'FALHOU')
UNION ALL SELECT 'salvar_dia', COALESCE(to_regprocedure('public.qa_agendamento_salvar_dia(int,boolean,int,int)')::text,'FALHOU')
UNION ALL SELECT 'proxima', COALESCE(to_regprocedure('public.qa_agendamento_proxima()')::text,'FALHOU');
