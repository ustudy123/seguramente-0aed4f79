-- =====================================================================
-- Divergência de 1 minuto entre o Espelho e a edição do Banco de Horas
--
-- Caso do print (Kailaine, 30/06/2026): espelho "01h 12min",
-- Banco de Horas "1h 13min", mesmo dia, mesma marcação.
--
-- Causa: as duas pontas tratam os SEGUNDOS da marcação de forma
-- diferente. Com entrada 07:38:10 e saída 08:50:50 (01:12:40 reais):
--
--   Espelho   -> exibe o intervalo formatado, truncando: 1h12min
--   Apuração  -> (EXTRACT(EPOCH FROM ...)/60)::int, e o cast ::int no
--                PostgreSQL ARREDONDA: 72,67 -> 73
--
-- Não é um erro de uma tela só: é a mesma grandeza com duas regras. O
-- registro de ponto é em HH:MM (Portaria MTP 671/2021) — o segundo é
-- ruído do app, e arredondar para cima credita minuto não trabalhado.
-- Padroniza-se o truncamento (floor) em toda a apuração.
--
-- Além do cast, a janela do dia era calculada arredondando CADA ponta
-- antes de subtrair, o que erra em até 1 minuto para os dois lados:
--   07:38:00 -> 08:50:40 (72m40s reais): 458 e 531  -> 73  (a mais)
--   07:38:40 -> 08:50:20 (71m40s reais): 459 e 530  -> 71  (bate)
-- Passa a truncar a DIFERENÇA, não cada ponta.
--
-- Aplicado sobre a definição viva da função (pg_get_functiondef), e não
-- reescrevendo o corpo inteiro: a função já recebeu correções por esse
-- mesmo caminho e reescrevê-la a partir do arquivo perderia o que veio
-- depois. Idempotente: se o floor já estiver aplicado, não faz nada.
-- =====================================================================
DO $do$
DECLARE
  d text;
  v_antes int;
BEGIN
  d := pg_get_functiondef('public.ponto_saldo_dias_competencia(uuid,text,text)'::regprocedure);

  IF position('floor(EXTRACT(EPOCH FROM' in d) > 0 THEN
    RAISE NOTICE 'Truncamento já aplicado — nada a fazer.';
    RETURN;
  END IF;

  -- 1) Janela do dia: trunca a DIFERENÇA entre saída e entrada.
  --    O tratamento de virada de meia-noite (soma 1440 quando negativo)
  --    segue logo abaixo na função e continua valendo.
  IF position('v_janela := (EXTRACT(EPOCH FROM r.saida)/60)::int - (EXTRACT(EPOCH FROM r.entrada)/60)::int;' in d) = 0 THEN
    RAISE EXCEPTION 'Trecho da janela do dia não encontrado na definição viva — abortado sem alterar nada.';
  END IF;

  d := replace(
    d,
    'v_janela := (EXTRACT(EPOCH FROM r.saida)/60)::int - (EXTRACT(EPOCH FROM r.entrada)/60)::int;',
    'v_janela := floor(EXTRACT(EPOCH FROM (r.saida - r.entrada))/60)::int;'
  );

  -- 2) Demais conversões de tempo -> minutos: trunca em vez de arredondar.
  v_antes := (length(d) - length(replace(d, ')/60)::int', ''))) / length(')/60)::int');
  d := regexp_replace(
         d,
         '\(EXTRACT\(EPOCH FROM ([a-zA-Z_][a-zA-Z0-9_\.]*)\)/60\)::int',
         'floor(EXTRACT(EPOCH FROM \1)/60)::int',
         'g'
       );

  IF position('floor(EXTRACT(EPOCH FROM' in d) = 0 THEN
    RAISE EXCEPTION 'Nenhuma conversão de tempo foi ajustada — abortado.';
  END IF;

  EXECUTE d;
  RAISE NOTICE 'Apuração passa a truncar segundos (% conversões inspecionadas).', v_antes;
END $do$;
