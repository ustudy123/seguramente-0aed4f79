-- 1. Corrigir o nome do colaborador (removendo caracteres estranhos)
UPDATE public.ponto_marcacoes 
SET colaborador_nome = 'Dr. Guilherme Gonçalves' 
WHERE colaborador_nome LIKE 'Dr. Guilherme Gon%';

UPDATE public.ponto_diario 
SET colaborador_nome = 'Dr. Guilherme Gonçalves' 
WHERE colaborador_nome LIKE 'Dr. Guilherme Gon%';

-- 2. Atualizar a função de consolidação para lidar com 4 batidas
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
  
  -- Buscar marcações ordenadas, removendo duplicatas num intervalo de 5 minutos
  FOR r IN
    WITH marcacoes_ordenadas AS (
      SELECT 
        tipo_marcacao, 
        hora_marcacao,
        LAG(hora_marcacao) OVER (ORDER BY hora_marcacao) as last_hora,
        LAG(tipo_marcacao) OVER (ORDER BY hora_marcacao) as last_tipo
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
    
    -- Mapear os horários para as colunas específicas do ponto_diario
    IF v_count_marcacoes = 1 THEN 
        v_primeira_entrada := r.hora_marcacao;
        v_pending_entrada := r.hora_marcacao;
    ELSIF v_count_marcacoes = 2 THEN 
        v_saida_almoco := r.hora_marcacao;
        IF v_pending_entrada IS NOT NULL THEN
            v_total_minutos := v_total_minutos + (EXTRACT(EPOCH FROM (r.hora_marcacao - v_pending_entrada)) / 60)::INT;
            v_pending_entrada := NULL;
        END IF;
    ELSIF v_count_marcacoes = 3 THEN 
        v_retorno_almoco := r.hora_marcacao;
        v_pending_entrada := r.hora_marcacao;
    ELSIF v_count_marcacoes = 4 THEN 
        v_ultima_saida := r.hora_marcacao;
        IF v_pending_entrada IS NOT NULL THEN
            v_total_minutos := v_total_minutos + (EXTRACT(EPOCH FROM (r.hora_marcacao - v_pending_entrada)) / 60)::INT;
            v_pending_entrada := NULL;
        END IF;
    END IF;
  END LOOP;

  -- Se houver número ímpar de batidas, ou se não fechou o par da última entrada
  IF (v_count_marcacoes % 2 != 0) OR (v_count_marcacoes = 0) THEN
    v_pendente := true;
  END IF;

  -- Determinar status final
  IF v_count_marcacoes = 0 THEN
    v_status := 'falta';
  ELSIF v_pendente THEN
    v_status := 'ajuste_pendente';
  ELSE
    -- Se tiver pelo menos 2 batidas (par completo), consideramos regular ou atraso
    IF v_primeira_entrada IS NOT NULL AND v_primeira_entrada > '08:10'::TIME THEN
      v_status := 'atraso';
    ELSE
      v_status := 'regular';
    END IF;
  END IF;

  -- Atualizar ou Inserir no ponto_diario
  INSERT INTO public.ponto_diario (
    tenant_id, colaborador_id, colaborador_nome, colaborador_cpf, data,
    entrada, saida_almoco, retorno_almoco, saida, horas_trabalhadas, status
  ) VALUES (
    NEW.tenant_id, NEW.colaborador_id, NEW.colaborador_nome, NEW.colaborador_cpf, NEW.data_marcacao,
    v_primeira_entrada, v_saida_almoco, v_retorno_almoco, v_ultima_saida, make_interval(mins => v_total_minutos), v_status
  )
  ON CONFLICT (tenant_id, colaborador_cpf, data)
  DO UPDATE SET
    entrada = v_primeira_entrada,
    saida_almoco = v_saida_almoco,
    retorno_almoco = v_retorno_almoco,
    saida = v_ultima_saida,
    horas_trabalhadas = make_interval(mins => v_total_minutos),
    status = CASE WHEN public.ponto_diario.status = 'justificado' THEN 'justificado' ELSE v_status END,
    updated_at = now();

  RETURN NEW;
END;
$function$;

-- 3. Forçar a atualização de todos os registros do Dr. Guilherme para aplicar a nova lógica
UPDATE public.ponto_marcacoes 
SET dispositivo = COALESCE(dispositivo, 'ajuste_manual')
WHERE colaborador_cpf = '44076905261' AND data_marcacao >= '2026-06-01';
