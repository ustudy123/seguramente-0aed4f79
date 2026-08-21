-- ============================================================================
-- ENTREGA — ONDA 11 (parte 2): atestados sobrepostos detectados, nao abonados
--                              em dobro (ESC-011)
--
-- Dois atestados que cobrem o mesmo periodo (um documento reenviado, ou dois
-- medicos para os mesmos dias) nao podem abonar em dobro nem confundir a
-- contagem dos 15 dias. Hoje eles entram como registros independentes — sem
-- deteccao —, e tudo que SOMA por atestado dobra: dias acumulados, a regua dos
-- 15 dias (o 16o dia do INSS calculado sobre dias somados em dobro) e os
-- indicadores de absenteismo. O mesmo documento reenviado passa como novo.
--
-- O QUE FAZ (aditivo, NAO bloqueia): um gatilho BEFORE INSERT em atestados que
-- detecta a SOBREPOSICAO de periodo (mesmo CPF/tenant) na entrada e SINALIZA —
-- um alerta ao DP decidir qual vale, mantendo o tratamento mais favoravel e a
-- contagem de dias unica (cada dia doente conta uma vez). Nao recusa o registro
-- (pode ser dois atendimentos legitimos); so evita a duplicidade silenciosa.
--
-- GARANTIAS: nao altera o motor de saldo, a apuracao, o espelho nem o
-- fechamento. So detecta e alerta. Aditivo e idempotente. Defensivo (o alerta
-- nunca quebra o registro do atestado). Roda inteiro em UMA transacao.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ponto_atestado_detectar_sobreposicao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_prev RECORD;
  v_ini  date;
  v_fim  date;
BEGIN
  -- Deteccao de sobreposicao de periodos de atestado por CPF (nao bloqueia).
  IF NEW.data_inicio_afastamento IS NULL OR NEW.colaborador_cpf IS NULL THEN
    RETURN NEW;
  END IF;

  v_ini := NEW.data_inicio_afastamento;
  v_fim := COALESCE(NEW.data_fim_afastamento, NEW.data_inicio_afastamento);

  -- Procura um atestado JA registrado do mesmo colaborador cujo periodo se
  -- sobrepoe ao novo (intervalos se cruzam: inicio_a <= fim_b E fim_a >= inicio_b).
  SELECT a.id, a.data_inicio_afastamento AS di, a.data_fim_afastamento AS df
    INTO v_prev
  FROM public.atestados a
  WHERE a.tenant_id = NEW.tenant_id
    AND a.colaborador_cpf = NEW.colaborador_cpf
    AND (NEW.id IS NULL OR a.id <> NEW.id)
    AND a.data_inicio_afastamento IS NOT NULL
    AND a.data_inicio_afastamento <= v_fim
    AND COALESCE(a.data_fim_afastamento, a.data_inicio_afastamento) >= v_ini
  ORDER BY a.data_inicio_afastamento DESC
  LIMIT 1;

  IF FOUND THEN
    BEGIN
      INSERT INTO public.ponto_alertas
        (tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
         tipo, severidade, titulo, descricao, data_referencia)
      VALUES
        (NEW.tenant_id, NEW.empresa_id, NEW.colaborador_id, NEW.colaborador_nome, NEW.colaborador_cpf,
         'atestado_sobreposto', 'media',
         'Atestados com periodos sobrepostos',
         format('O atestado novo (%s a %s) se sobrepoe a um atestado ja registrado (%s a %s) do mesmo '
             || 'colaborador. Confira se e reenvio/duplicidade ou dois atendimentos: o DP decide qual '
             || 'vale, mantendo o tratamento mais favoravel, e os dias em comum contam UMA vez (nao '
             || 'abona em dobro nem infla a contagem dos 15 dias).',
             v_ini, v_fim, v_prev.di, COALESCE(v_prev.df, v_prev.di)),
         v_ini);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Nao foi possivel registrar o alerta de atestado sobreposto (%). O atestado foi registrado.', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.ponto_atestado_detectar_sobreposicao() IS
  'Detecta sobreposicao de periodos de atestado por CPF na entrada e sinaliza (alerta ao DP), sem bloquear — contagem de dias unica, nao abona em dobro. ESC-011.';

DO $trg$
BEGIN
  SET LOCAL lock_timeout = '10s';
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
                 WHERE tgname = 'trg_ponto_atestado_sobreposicao'
                   AND tgrelid = 'public.atestados'::regclass AND NOT tgisinternal) THEN
    CREATE TRIGGER trg_ponto_atestado_sobreposicao
      BEFORE INSERT ON public.atestados
      FOR EACH ROW EXECUTE FUNCTION public.ponto_atestado_detectar_sobreposicao();
  END IF;
END $trg$;

-- ---------------------------------------------------------------------------
-- CONFERENCIA — o SQL Editor mostra apenas o ultimo resultado.
-- Esperado: t | t | OK — a funcao de deteccao existe e o gatilho esta em atestados.
-- ---------------------------------------------------------------------------
SELECT
  (to_regprocedure('public.ponto_atestado_detectar_sobreposicao()') IS NOT NULL) AS funcao_ok,
  EXISTS (SELECT 1 FROM pg_trigger
          WHERE tgname='trg_ponto_atestado_sobreposicao'
            AND tgrelid='public.atestados'::regclass AND NOT tgisinternal)         AS gatilho_ok,
  CASE WHEN to_regprocedure('public.ponto_atestado_detectar_sobreposicao()') IS NOT NULL
        AND EXISTS (SELECT 1 FROM pg_trigger
                    WHERE tgname='trg_ponto_atestado_sobreposicao'
                      AND tgrelid='public.atestados'::regclass AND NOT tgisinternal)
       THEN 'OK' ELSE 'CONFERIR' END AS erro_tecnico;
