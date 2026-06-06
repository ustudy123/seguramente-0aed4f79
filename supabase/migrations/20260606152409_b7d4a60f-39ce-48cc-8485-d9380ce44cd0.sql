CREATE OR REPLACE FUNCTION public.consolidar_ponto_diario()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_total_minutos INT := 0;
  v_pendente BOOLEAN := false;
  v_primeira_entrada TIME;
  v_saida_almoco TIME;
  v_retorno_almoco TIME;
  v_ultima_saida TIME;
  v_status TEXT;
  v_pending_entrada TIME;
  v_count_marcacoes INT := 0;
  r RECORD;
BEGIN
  v_pending_entrada := NULL;
  
  -- Buscar marcações filtrando duplicatas (5 min)
  -- Identificamos especificamente cada tipo de batida para as colunas do ponto_diario
  FOR r IN
    WITH marcacoes_ordenadas AS (
      SELECT 
        tipo_marcacao, 
        hora_marcacao,
        LAG(hora_marcacao) OVER (ORDER BY hora_marcacao) as last_hora
      FROM public.ponto_marcacoes
      WHERE tenant_id = NEW.tenant_id
        AND colaborador_cpf = NEW.colaborador_cpf
        AND data_marcacao = NEW.data_marcacao
    ),
    marcacoes_filtradas AS (
      SELECT tipo_marcacao, hora_marcacao
      FROM marcacoes_ordenadas
      WHERE (last_hora IS NULL OR (hora_marcacao - last_hora > interval '5 minutes'))
    )
    SELECT tipo_marcacao, hora_marcacao FROM marcacoes_filtradas ORDER BY hora_marcacao ASC
  LOOP
    v_count_marcacoes := v_count_marcacoes + 1;
    
    -- Lógica de exibição nas colunas corretas baseada na sequência cronológica
    IF v_count_marcacoes = 1 THEN
      v_primeira_entrada := r.hora_marcacao;
    ELSIF v_count_marcacoes = 2 THEN
      v_saida_almoco := r.hora_marcacao;
    ELSIF v_count_marcacoes = 3 THEN
      v_retorno_almoco := r.hora_marcacao;
    ELSIF v_count_marcacoes = 4 THEN
      v_ultima_saida := r.hora_marcacao;
    END IF;

    -- Lógica de cálculo de horas (pares entrada/saída)
    IF r.tipo_marcacao IN ('entrada', 'retorno_almoco') THEN
      v_pending_entrada := r.hora_marcacao;
    ELSIF r.tipo_marcacao IN ('saida', 'saida_almoco') THEN
      IF v_pending_entrada IS NOT NULL THEN
        v_total_minutos := v_total_minutos + (EXTRACT(EPOCH FROM (r.hora_marcacao - v_pending_entrada)) / 60)::INT;
        v_pending_entrada := NULL;
      END IF;
    END IF;
  END LOOP;

  -- Se houver número ímpar ou entrada sem saída
  IF (v_count_marcacoes % 2 != 0) OR (v_count_marcacoes = 0) THEN
    v_pendente := true;
  END IF;

  -- Determinar status
  IF v_count_marcacoes = 0 THEN
    v_status := 'falta';
  ELSIF v_pendente THEN
    v_status := 'ajuste_pendente';
  ELSE
    IF v_primeira_entrada IS NOT NULL AND v_primeira_entrada > '08:10'::TIME THEN
      v_status := 'atraso';
    ELSE
      v_status := 'regular';
    END IF;
  END IF;

  -- Atualizar ponto_diario
  INSERT INTO public.ponto_diario (
    tenant_id, colaborador_id, colaborador_nome, colaborador_cpf, data,
    entrada, saida_almoco, retorno_almoco, saida, horas_trabalhadas, status
  ) VALUES (
    NEW.tenant_id, NEW.colaborador_id, NEW.colaborador_nome, NEW.colaborador_cpf, NEW.data_marcacao,
    v_primeira_entrada, v_saida_almoco, v_retorno_almoco, v_ultima_saida, make_interval(mins => v_total_minutos), v_status
  )
  ON CONFLICT (tenant_id, colaborador_cpf, data)
  DO UPDATE SET
    entrada = EXCLUDED.entrada,
    saida_almoco = EXCLUDED.saida_almoco,
    retorno_almoco = EXCLUDED.retorno_almoco,
    saida = EXCLUDED.saida,
    horas_trabalhadas = EXCLUDED.horas_trabalhadas,
    status = CASE WHEN public.ponto_diario.status = 'justificado' THEN 'justificado' ELSE EXCLUDED.status END,
    updated_at = now();

  RETURN NEW;
END;
$function$;

-- Recalcular
UPDATE public.ponto_marcacoes 
SET dispositivo = dispositivo
WHERE colaborador_cpf = '44076905261' AND data_marcacao >= '2026-06-01';
