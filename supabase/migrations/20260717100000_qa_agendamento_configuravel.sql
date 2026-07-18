-- =========================================================
-- QA — agendamento configurável do robô
--
-- O usuário controla pela tela: liga/desliga e escolhe o horário. Sem
-- horário chumbado no código.
--
-- pg_cron ja esta em uso no projeto (bloquear-profissionais-expirados,
-- gerar-alertas-estabilidade). Seguimos o mesmo padrao: cron.schedule com
-- nome fixo chamando uma funcao SQL.
--
-- DESENHO:
--   qa_agendamento (tabela)  -> guarda: ligado?, horario, qual modulo
--   qa_cron_sincronizar()    -> le a tabela e (re)agenda ou remove o job
--   qa_rodar_agendada()      -> o que o cron chama; roda a bateria como
--                               'agendado' e marca disparada_por = NULL
--
-- Assim a tela nunca mexe no cron direto (que exige privilegio). Ela
-- escreve na tabela, chama qa_cron_sincronizar(), e o resto acontece.
-- =========================================================

-- ─────────────────────────────────────────────────────────
-- 1) A CONFIGURAÇÃO (uma linha só — singleton)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.qa_agendamento (
  id           int PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- so pode existir 1 linha
  ligado       boolean NOT NULL DEFAULT false,
  hora         int NOT NULL DEFAULT 3 CHECK (hora BETWEEN 0 AND 23),
  minuto       int NOT NULL DEFAULT 0 CHECK (minuto BETWEEN 0 AND 59),
  modulo_path  text,                          -- NULL = todos os modulos
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid
);

INSERT INTO public.qa_agendamento (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.qa_agendamento ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "QA agendamento: apenas superadmin" ON public.qa_agendamento;
CREATE POLICY "QA agendamento: apenas superadmin"
  ON public.qa_agendamento FOR ALL
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

-- ─────────────────────────────────────────────────────────
-- 2) O QUE O CRON CHAMA
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_rodar_agendada()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_modulo text;
BEGIN
  SELECT modulo_path INTO v_modulo FROM public.qa_agendamento WHERE id = 1;
  -- disparo 'agendado', sem disparada_por (nao foi ninguem, foi o relogio)
  PERFORM public.qa_rodar_bateria('agendado', v_modulo);
END $$;

COMMENT ON FUNCTION public.qa_rodar_agendada() IS
  'Chamada pelo pg_cron. Roda a bateria no horario configurado, marcada como agendado.';

-- ─────────────────────────────────────────────────────────
-- 3) SINCRONIZAR O CRON COM A TABELA
--    A tela chama isto depois de salvar a config.
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_cron_sincronizar()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  v public.qa_agendamento;
  v_cron text;
BEGIN
  IF NOT public.is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas superadmin pode configurar o agendamento.';
  END IF;

  SELECT * INTO v FROM public.qa_agendamento WHERE id = 1;

  -- Remove o job antigo, se existir (idempotente).
  PERFORM cron.unschedule('qa-bateria-agendada')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'qa-bateria-agendada');

  IF NOT v.ligado THEN
    RETURN 'Agendamento desligado. Nenhuma bateria automatica.';
  END IF;

  -- Monta o cron: 'minuto hora * * *' (todo dia no horario escolhido).
  v_cron := format('%s %s * * *', v.minuto, v.hora);

  PERFORM cron.schedule(
    'qa-bateria-agendada',
    v_cron,
    $cmd$SELECT public.qa_rodar_agendada()$cmd$
  );

  RETURN format('Agendado: todo dia as %s:%s.',
                lpad(v.hora::text, 2, '0'), lpad(v.minuto::text, 2, '0'));
END $$;

REVOKE EXECUTE ON FUNCTION public.qa_cron_sincronizar() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.qa_cron_sincronizar() TO authenticated;

-- ─────────────────────────────────────────────────────────
-- 4) A TELA LÊ E SALVA POR AQUI
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_agendamento_ler()
RETURNS TABLE(ligado boolean, hora int, minuto int, modulo_path text,
              proxima_execucao text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, cron
AS $$
  SELECT a.ligado, a.hora, a.minuto, a.modulo_path,
         (SELECT to_char(
            (CURRENT_DATE + CASE WHEN make_time(a.hora,a.minuto,0) > CURRENT_TIME
                                 THEN 0 ELSE 1 END)::timestamp
            + make_interval(hours => a.hora, mins => a.minuto),
            'DD/MM HH24:MI')
          WHERE a.ligado)
  FROM public.qa_agendamento a
  WHERE a.id = 1 AND public.is_superadmin(auth.uid());
$$;

REVOKE EXECUTE ON FUNCTION public.qa_agendamento_ler() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.qa_agendamento_ler() TO authenticated;

CREATE OR REPLACE FUNCTION public.qa_agendamento_salvar(
  p_ligado boolean,
  p_hora   int,
  p_minuto int,
  p_modulo text DEFAULT NULL
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
  IF p_hora NOT BETWEEN 0 AND 23 OR p_minuto NOT BETWEEN 0 AND 59 THEN
    RAISE EXCEPTION 'Horario invalido: %:%.', p_hora, p_minuto;
  END IF;

  UPDATE public.qa_agendamento
  SET ligado = p_ligado, hora = p_hora, minuto = p_minuto,
      modulo_path = p_modulo, atualizado_em = now(),
      atualizado_por = (SELECT id FROM public.usuarios_base WHERE auth_user_id = auth.uid() LIMIT 1)
  WHERE id = 1;

  -- aplica no cron imediatamente
  RETURN public.qa_cron_sincronizar();
END $$;

REVOKE EXECUTE ON FUNCTION public.qa_agendamento_salvar(boolean, int, int, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.qa_agendamento_salvar(boolean, int, int, text) TO authenticated;

-- ─────────────────────────────────────────────────────────
-- Conferência
-- ─────────────────────────────────────────────────────────
SELECT 'tabela de config'  AS item, COALESCE(to_regclass('public.qa_agendamento')::text,'FALHOU') AS valor
UNION ALL SELECT 'funcao do cron',   COALESCE(to_regprocedure('public.qa_rodar_agendada()')::text,'FALHOU')
UNION ALL SELECT 'sincronizar',      COALESCE(to_regprocedure('public.qa_cron_sincronizar()')::text,'FALHOU')
UNION ALL SELECT 'ler (tela)',       COALESCE(to_regprocedure('public.qa_agendamento_ler()')::text,'FALHOU')
UNION ALL SELECT 'salvar (tela)',    COALESCE(to_regprocedure('public.qa_agendamento_salvar(boolean,int,int,text)')::text,'FALHOU')
UNION ALL SELECT 'estado atual',     (SELECT CASE WHEN ligado THEN 'ligado' ELSE 'desligado (padrao)' END FROM public.qa_agendamento WHERE id=1);
