-- =========================================================
-- Fix: reconsolidar o ponto quando muda a UNIDADE/QUANTIDADE do atestado
--
-- O gatilho trigger_consolida_atestado só disparava em
--   AFTER INSERT OR UPDATE OF data_inicio_afastamento, data_fim_afastamento
-- Logo, alterar o atestado de "Dias" (abona dia cheio) para "Horas" (parcial,
-- não abona) — sem mexer nas datas — NÃO reconsolidava o ponto_diario. O dia
-- ficava "preso" na consolidação anterior, exibindo "Justificado" (dia inteiro)
-- no espelho mesmo o atestado sendo de poucas horas.
--
-- Correção: o gatilho passa a disparar também quando mudam
--   unidade_afastamento, horas_afastamento, minutos_afastamento, dias_afastamento.
-- Além disso, reconsolida retroativamente os dias de atestados de HORAS
-- vigentes na janela -60/+60 dias, para corrigir registros já gravados como
-- dia cheio antes desta correção.
-- =========================================================

DROP TRIGGER IF EXISTS trigger_consolida_atestado ON public.atestados;
CREATE TRIGGER trigger_consolida_atestado
  AFTER INSERT OR UPDATE OF
    data_inicio_afastamento, data_fim_afastamento,
    unidade_afastamento, horas_afastamento, minutos_afastamento, dias_afastamento
  ON public.atestados
  FOR EACH ROW EXECUTE FUNCTION public.trg_consolida_atestado();

-- ── Reconsolidação retroativa: atestados de HORAS (parciais) que ainda
--    podem estar gravados como dia cheio no ponto_diario ──
DO $rec$
DECLARE
  v RECORD;
  v_d DATE;
BEGIN
  FOR v IN
    SELECT tenant_id, colaborador_cpf, data_inicio_afastamento AS di,
           COALESCE(data_fim_afastamento, data_inicio_afastamento) AS df
    FROM public.atestados
    WHERE data_inicio_afastamento IS NOT NULL
      AND COALESCE(unidade_afastamento, 'dias') = 'horas'
      AND COALESCE(data_fim_afastamento, data_inicio_afastamento) >= CURRENT_DATE - 60
      AND data_inicio_afastamento <= CURRENT_DATE + 60
      AND colaborador_cpf IS NOT NULL
  LOOP
    v_d := GREATEST(v.di, CURRENT_DATE - 60);
    WHILE v_d <= LEAST(v.df, CURRENT_DATE + 60) LOOP
      BEGIN
        PERFORM public.consolidar_ponto_diario_manual(v.tenant_id, v.colaborador_cpf, v_d);
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
      v_d := v_d + 1;
    END LOOP;
  END LOOP;
  RAISE NOTICE 'Reconsolidação de atestados de horas concluída';
END $rec$;
