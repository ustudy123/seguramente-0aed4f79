CREATE OR REPLACE FUNCTION public.consolidar_ponto_diario()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_total_minutos INT := 0;
  v_primeira_entrada TIME;
  v_saida_almoco TIME;
  v_retorno_almoco TIME;
  v_ultima_saida TIME;
  v_status TEXT;
  v_pending_entrada TIME;
  v_count_marcacoes INT := 0;
  v_target_tenant_id UUID;
  r RECORD;
BEGIN
  -- Definimos o tenant_id de destino (preferencialmente o do vinculo principal se existisse, mas usaremos o da marcação atual)
  v_target_tenant_id := NEW.tenant_id;
  v_pending_entrada := NULL;
  
  -- Buscar marcações filtrando duplicatas (5 min) de TODAS as unidades (tenants) do colaborador no mesmo dia
  FOR r IN
    WITH marcacoes_ordenadas AS (
      SELECT 
        tipo_marcacao, 
        hora_marcacao,
        LAG(hora_marcacao) OVER (ORDER BY hora_marcacao) as last_hora
      FROM public.ponto_marcacoes
      WHERE colaborador_cpf = NEW.colaborador_cpf
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
    
    -- Atribuição baseada na ordem cronológica
    IF v_count_marcacoes = 1 THEN
      v_primeira_entrada := r.hora_marcacao;
    ELSIF v_count_marcacoes = 2 THEN
      v_saida_almoco := r.hora_marcacao;
    ELSIF v_count_marcacoes = 3 THEN
      v_retorno_almoco := r.hora_marcacao;
    ELSIF v_count_marcacoes = 4 THEN
      v_ultima_saida := r.hora_marcacao;
    END IF;

    -- Cálculo de horas trabalhadas (pares entrada/saída)
    IF (v_count_marcacoes % 2) != 0 THEN
      v_pending_entrada := r.hora_marcacao;
    ELSE
      IF v_pending_entrada IS NOT NULL THEN
        v_total_minutos := v_total_minutos + (EXTRACT(EPOCH FROM (r.hora_marcacao - v_pending_entrada)) / 60)::INT;
        v_pending_entrada := NULL;
      END IF;
    END IF;
  END LOOP;

  -- Determinar status
  IF v_count_marcacoes = 0 THEN
    v_status := 'falta';
  ELSIF (v_count_marcacoes % 2 != 0) THEN
    v_status := 'ajuste_pendente';
  ELSE
    IF v_primeira_entrada IS NOT NULL AND v_primeira_entrada > '08:10'::TIME THEN
      v_status := 'atraso';
    ELSE
      v_status := 'regular';
    END IF;
  END IF;

  -- Limpar registros duplicados em outros tenants para este colaborador/dia antes de inserir/atualizar o consolidado
  DELETE FROM public.ponto_diario 
  WHERE colaborador_cpf = NEW.colaborador_cpf 
    AND data = NEW.data_marcacao 
    AND tenant_id != v_target_tenant_id;

  -- Atualizar ou inserir o registro consolidado no tenant atual
  INSERT INTO public.ponto_diario (
    tenant_id, colaborador_id, colaborador_nome, colaborador_cpf, data,
    entrada, saida_almoco, retorno_almoco, saida, horas_trabalhadas, status
  ) VALUES (
    v_target_tenant_id, NEW.colaborador_id, NEW.colaborador_nome, NEW.colaborador_cpf, NEW.data_marcacao,
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