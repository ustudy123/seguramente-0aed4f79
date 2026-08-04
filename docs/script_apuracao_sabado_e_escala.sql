-- ============================================================
-- Correções da apuração — 04/08/2026
-- 1) sábado fora do dia de equalização não cobra jornada
-- 2) escala não resolvida deixa de derrubar a apuração inteira
-- Idempotente: rodar de novo não faz nada.
-- ============================================================

-- =====================================================================
-- Escala não resolvida derruba a apuração inteira
--
-- Como apareceu: uma consulta que percorria os colaboradores da base parou
-- com
--   ERROR: Escala não encontrada no tenant
--   CONTEXT: ponto_equalizacao_competencia(...) line 32
--            ponto_saldo_dias_competencia(...)  line 357
--
-- O que isso significa na prática é pior do que uma consulta que falha.
-- ponto_saldo_dias_competencia é a fonte do Espelho e do Banco de Horas, e
-- o Espelho a chama para TODOS os colaboradores da empresa no dia
-- (ponto_saldo_dia_empresa faz um laço). Um único colaborador com escala
-- não resolvida — atribuição apontando para escala apagada, escala de
-- outro tenant, importação incompleta — levanta exceção e a tela inteira
-- para de carregar, para todo mundo.
--
-- ponto_equalizacao_competencia levanta exceção de propósito: quem a chama
-- direto, para configurar a equalização, precisa saber que a escala não
-- existe. O problema é a apuração tratar isso como erro fatal em vez de
-- "esta pessoa não tem equalização calculável".
--
-- Correção: os dois pontos onde a apuração consulta a equalização passam a
-- tolerar a falha e seguir sem equalização. O colaborador com cadastro
-- quebrado aparece com o saldo que dá para calcular, em vez de derrubar a
-- apuração dos demais.
--
-- Não altera nenhum cálculo de quem tem escala válida.
-- =====================================================================
DO $do$
DECLARE
  d text;
  v_alvo text := 'v_eq_m := public.ponto_equalizacao_competencia(p_tenant_id, v_fb_escala_id, p_competencia);';
  v_novo text;
  v_qtd int;
BEGIN
  d := pg_get_functiondef('public.ponto_saldo_dias_competencia(uuid,text,text)'::regprocedure);

  IF position('escala nao resolvida: segue sem equalizacao' in d) > 0 THEN
    RAISE NOTICE 'Tolerância à escala ausente já aplicada — nada a fazer.';
    RETURN;
  END IF;

  v_qtd := (length(d) - length(replace(d, v_alvo, ''))) / length(v_alvo);
  IF v_qtd = 0 THEN
    RAISE EXCEPTION 'Trecho alvo não encontrado — abortado sem alterar nada.';
  END IF;

  -- BEGIN/EXCEPTION em volta da chamada: escala inexistente, de outro
  -- tenant ou apagada deixa de ser erro fatal.
  v_novo :=
    'BEGIN' || E'\n' ||
    '        -- escala nao resolvida: segue sem equalizacao em vez de derrubar' || E'\n' ||
    '        -- a apuracao de todos os colaboradores da tela.' || E'\n' ||
    '        v_eq_m := public.ponto_equalizacao_competencia(p_tenant_id, v_fb_escala_id, p_competencia);' || E'\n' ||
    '      EXCEPTION WHEN OTHERS THEN' || E'\n' ||
    '        v_eq_m := NULL;' || E'\n' ||
    '      END;';

  d := replace(d, v_alvo, v_novo);
  EXECUTE d;
  RAISE NOTICE 'Apuração passa a tolerar escala não resolvida (% ponto(s) protegido(s)).', v_qtd;
END $do$;

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
