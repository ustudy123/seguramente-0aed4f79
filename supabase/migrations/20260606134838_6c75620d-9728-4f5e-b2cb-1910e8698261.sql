CREATE OR REPLACE FUNCTION public.consolidar_ponto_diario()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
  
  -- Contar marcações para o dia
  SELECT COUNT(*) INTO v_count_marcacoes
  FROM public.ponto_marcacoes
  WHERE tenant_id = NEW.tenant_id
    AND colaborador_cpf = NEW.colaborador_cpf
    AND data_marcacao = NEW.data_marcacao;

  FOR r IN
    SELECT tipo_marcacao, hora_marcacao
    FROM public.ponto_marcacoes
    WHERE tenant_id = NEW.tenant_id
      AND colaborador_cpf = NEW.colaborador_cpf
      AND data_marcacao = NEW.data_marcacao
    ORDER BY hora_marcacao ASC, created_at ASC
  LOOP
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

  -- Se sobrar uma entrada sem saída, ou o número de marcações for ímpar, é ajuste pendente
  IF v_pending_entrada IS NOT NULL OR (v_count_marcacoes % 2 != 0) THEN
    v_pendente := true;
  END IF;

  -- Definir status baseado na lógica de jornada
  IF v_primeira_entrada IS NULL AND v_ultima_saida IS NULL THEN
    v_status := 'falta';
  ELSIF v_pendente THEN
    v_status := 'ajuste_pendente';
  ELSIF v_primeira_entrada IS NOT NULL AND v_primeira_entrada > '08:10'::TIME THEN
    v_status := 'atraso';
  ELSE
    v_status := 'regular';
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

-- Atualizar registros que estavam travados em status incorreto
UPDATE public.ponto_diario 
SET status = 'regular' 
WHERE data = '2026-06-05' 
AND colaborador_nome = 'Amanda Cunha' 
AND status = 'ajuste_pendente';

UPDATE public.ponto_diario 
SET status = 'incompleto' 
WHERE data = '2026-06-05' 
AND colaborador_nome = 'Anthony Rezende' 
AND status = 'ajuste_pendente';
