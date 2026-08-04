-- =====================================================================
-- Segundos arredondados na CONSOLIDAÇÃO diária (_ponto_calc_dia)
--
-- Complemento do 20260804140000, que corrigiu o mesmo critério na
-- apuração do saldo. São dois pontos diferentes do mesmo caminho:
--
--   _ponto_calc_dia            -> grava ponto_diario.horas_trabalhadas
--   ponto_saldo_dias_competencia -> calcula o saldo e o total do dia
--
-- Corrigir só o segundo deixaria ponto_diario com o valor arredondado, e
-- ele alimenta o fechamento, os relatórios e o espelho quando a apuração
-- não está disponível. O número nasce errado no primeiro.
--
-- Caso da Kailaine, 30/06/2026: entrada 07:38:10, saída 08:50:44, ou seja
-- 1h12min34s reais.
--   v_dif := (EXTRACT(EPOCH FROM (saida - entrada)) / 60)::INT
--   72,57 -> ::INT arredonda -> 73  -> horas_trabalhadas = 01:13:00
--
-- O registro de ponto é em HH:MM (Portaria MTP 671/2021): o segundo é
-- ruído do aplicativo e arredondar para cima credita minuto não
-- trabalhado. Trunca, igual ao que o espelho já faz na leitura do par.
--
-- Aplicado sobre a definição viva da função, não reescrevendo o corpo a
-- partir do arquivo: _ponto_calc_dia já recebeu correções por esse
-- caminho e reescrevê-la perderia o que veio depois. Idempotente.
-- =====================================================================
DO $do$
DECLARE
  d text;
  v_alvo text := '(EXTRACT(EPOCH FROM (v_marc.hora_marcacao - v_abr)) / 60)::INT';
BEGIN
  d := pg_get_functiondef(
         'public._ponto_calc_dia(uuid,text,date,uuid)'::regprocedure);

  IF position('floor(EXTRACT(EPOCH FROM (v_marc.hora_marcacao' in d) > 0 THEN
    RAISE NOTICE 'Consolidação já trunca os segundos — nada a fazer.';
    RETURN;
  END IF;

  IF position(v_alvo in d) = 0 THEN
    RAISE EXCEPTION 'Trecho alvo não encontrado em _ponto_calc_dia — abortado sem alterar nada.';
  END IF;

  d := replace(
    d,
    v_alvo,
    'floor(EXTRACT(EPOCH FROM (v_marc.hora_marcacao - v_abr)) / 60)::INT'
  );

  EXECUTE d;
  RAISE NOTICE 'Consolidação diária passa a truncar os segundos.';
END $do$;


-- RECONSOLIDAÇÃO DOS DIAS AFETADOS ------------------------------------
-- Só os dias em que existe marcação com segundo diferente de zero: são os
-- únicos em que o valor gravado pode mudar. Reconsolidar a base inteira
-- levaria horas e mexeria em dias que não têm nada de errado.
DO $recons$
DECLARE
  r RECORD;
  v_n int := 0;
BEGIN
  FOR r IN
    SELECT DISTINCT m.tenant_id, m.colaborador_cpf, m.data_marcacao
    FROM public.ponto_marcacoes m
    WHERE EXTRACT(SECOND FROM m.hora_marcacao) <> 0
  LOOP
    BEGIN
      PERFORM public.consolidar_ponto_diario_manual(
        r.tenant_id, r.colaborador_cpf, r.data_marcacao);
      v_n := v_n + 1;
    EXCEPTION WHEN OTHERS THEN
      -- Um dia problemático não pode impedir a correção dos demais.
      RAISE NOTICE 'Falha ao reconsolidar % / % : %', r.colaborador_cpf, r.data_marcacao, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Dias com segundos nas marcações reconsolidados: %', v_n;
END $recons$;
