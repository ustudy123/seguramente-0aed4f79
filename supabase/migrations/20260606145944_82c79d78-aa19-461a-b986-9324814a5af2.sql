CREATE OR REPLACE FUNCTION public.consolidar_ponto_diario()
 RETURNS trigger
 LANGUAGE plpgsql
 AS $function$
DECLARE
  v_total_minutos INT := 0;
  v_pendente BOOLEAN := false;
  v_primeira_entrada TIME;
  v_ultima_saida TIME;
  v_status TEXT;
  v_pending_entrada TIME;
  v_count_marcacoes INT := 0;
  r RECORD;
BEGIN
  v_pending_entrada := NULL;
  
  -- Lógica robusta: 
  -- 1. Agrupamos marcações do mesmo tipo que ocorrem num intervalo curto (15 min) e pegamos a mais relevante.
  -- 2. Processamos a paridade apenas sobre esses registros "limpos".
  
  FOR r IN
    WITH marcacoes_brutas AS (
      SELECT 
        tipo_marcacao, 
        hora_marcacao,
        -- Marcar grupos de registros do mesmo tipo muito próximos (intervalo de 15 min)
        -- Usamos um segredo: se a diferença para a anterior do mesmo tipo é pequena, é o mesmo "evento"
        CASE 
          WHEN LAG(hora_marcacao) OVER (PARTITION BY tipo_marcacao ORDER BY hora_marcacao) IS NULL 
               OR (hora_marcacao - LAG(hora_marcacao) OVER (PARTITION BY tipo_marcacao ORDER BY hora_marcacao)) > interval '15 minutes'
          THEN 1 ELSE 0 
        END as novo_evento
      FROM public.ponto_marcacoes
      WHERE tenant_id = NEW.tenant_id
        AND colaborador_cpf = NEW.colaborador_cpf
        AND data_marcacao = NEW.data_marcacao
    ),
    eventos_marcados AS (
      SELECT 
        tipo_marcacao, 
        hora_marcacao,
        SUM(novo_evento) OVER (PARTITION BY tipo_marcacao ORDER BY hora_marcacao) as evento_id
      FROM marcacoes_brutas
    ),
    marcacoes_unicas AS (
      -- Para cada evento (grupo de marcações próximas), pegamos apenas uma.
      -- Se houver várias, pegamos a primeira ou a que não for automática (simplificando: a primeira do grupo)
      SELECT tipo_marcacao, MIN(hora_marcacao) as hora_marcacao
      FROM eventos_marcados
      GROUP BY tipo_marcacao, evento_id
    )
    SELECT tipo_marcacao, hora_marcacao FROM marcacoes_unicas ORDER BY hora_marcacao ASC
  LOOP
    v_count_marcacoes := v_count_marcacoes + 1;
    
    IF r.tipo_marcacao IN ('entrada', 'retorno_almoco') THEN
      v_pending_entrada := r.hora_marcacao;
      IF v_primeira_entrada IS NULL THEN
        v_primeira_entrada := r.hora_marcacao;
      END IF;
    ELSIF r.tipo_marcacao IN ('saida', 'saida_almoco') THEN
      IF v_pending_entrada IS NOT NULL THEN
        v_total_minutos := v_total_minutos
          + (EXTRACT(EPOCH FROM (r.hora_marcacao - v_pending_entrada)) / 60)::INT;
        v_pending_entrada := NULL;
      END IF;
      v_ultima_saida := r.hora_marcacao;
    END IF;
  END LOOP;

  -- Status de pendência
  IF v_pending_entrada IS NOT NULL OR (v_count_marcacoes % 2 != 0) THEN
    v_pendente := true;
  END IF;

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

  INSERT INTO public.ponto_diario (
    tenant_id, colaborador_id, colaborador_nome, colaborador_cpf, data,
    entrada, saida, horas_trabalhadas, status
  ) VALUES (
    NEW.tenant_id, NEW.colaborador_id, NEW.colaborador_nome, NEW.colaborador_cpf, NEW.data_marcacao,
    v_primeira_entrada, v_ultima_saida, make_interval(mins => v_total_minutos), v_status
  )
  ON CONFLICT (tenant_id, colaborador_cpf, data)
  DO UPDATE SET
    entrada = v_primeira_entrada,
    saida = v_ultima_saida,
    horas_trabalhadas = make_interval(mins => v_total_minutos),
    status = CASE WHEN public.ponto_diario.status = 'justificado' THEN 'justificado' ELSE v_status END,
    updated_at = now();

  RETURN NEW;
END;
$function$;