-- =====================================================================
-- Sábado fora do dia de equalização não pode cobrar jornada
--
-- Caso relatado (Aylin e demais da BARROS & NUERNBERG, competência 07/2026):
--   18/07 SAB  05:52–15:00  8h07min  [Equalização]  saldo +4h17min
--   25/07 SAB  sem marcação   0h00min                saldo −4h10min
--
-- A pessoa trabalhou o sábado do mês, foi creditada corretamente, e mesmo
-- assim levou débito no sábado seguinte. Como acontece com a empresa
-- inteira, não é lançamento errado: é a regra.
--
-- Por que acontece: a escala da empresa define jornada aos sábados (aqui,
-- 4h10). A apuração lê essa jornada em ponto_jornada_do_dia e, num sábado
-- sem marcação, cobra a diferença — mesmo quando a competência já tem dia
-- de equalização definido. Ou seja, os dois modelos convivem: a carga
-- mensal é fechada por UM sábado e, ao mesmo tempo, TODOS os sábados
-- continuam sendo cobrados.
--
-- A especificação já dizia o contrário (RN14, adendo à Equalização Mensal):
--   "Só o sábado definido como dia de equalização (RN05/RN06) tem jornada
--    real esperada naquele mês. Os demais sábados são estruturalmente dias
--    sem obrigação de trabalho."
-- A rotulagem seguiu a regra; o cálculo ficou para trás.
--
-- Correção: havendo dia de equalização na competência, os demais sábados
-- têm jornada prevista ZERO. Não trabalhou, não deve nada. Trabalhou, é
-- crédito integral — que é o tratamento correto de trabalho em dia sem
-- obrigação de jornada.
--
-- Nada muda para quem não usa equalização: sem dia de equalização na
-- competência, a jornada do sábado continua vindo da escala, como hoje.
--
-- Aplicado sobre a definição viva da função. Idempotente.
-- =====================================================================
DO $do$
DECLARE
  d text;
  v_alvo text;
  v_novo text;
BEGIN
  d := pg_get_functiondef('public.ponto_saldo_dias_competencia(uuid,text,text)'::regprocedure);

  IF position('RN14: sabado fora do dia de equalizacao' in d) > 0 THEN
    RAISE NOTICE 'Regra do sábado já aplicada — nada a fazer.';
    RETURN;
  END IF;

  -- Âncora: o fim da derivação da jornada prevista do dia.
  v_alvo := 'v_tol := CASE WHEN COALESCE(v_tol, 0) <> 0 THEN v_tol ELSE COALESCE(v_fb_tol, 0) END;';

  IF position(v_alvo in d) = 0 THEN
    RAISE EXCEPTION 'Trecho alvo não encontrado — abortado sem alterar nada.';
  END IF;

  v_novo :=
    '-- RN14: sabado fora do dia de equalizacao nao tem obrigacao de jornada.' || E'\n' ||
    '    -- Com dia de equalizacao na competencia, a carga do mes se fecha nele;' || E'\n' ||
    '    -- cobrar os demais sabados seria cobrar a mesma obrigacao duas vezes.' || E'\n' ||
    '    IF v_eq_data IS NOT NULL' || E'\n' ||
    '       AND EXTRACT(ISODOW FROM r.data) = 6' || E'\n' ||
    '       AND r.data <> v_eq_data THEN' || E'\n' ||
    '      v_esperado := 0;' || E'\n' ||
    '    END IF;' || E'\n' ||
    '    ' || v_alvo;

  d := replace(d, v_alvo, v_novo);
  EXECUTE d;
  RAISE NOTICE 'Sábado fora da equalização passa a não cobrar jornada.';
END $do$;
