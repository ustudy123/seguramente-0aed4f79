
CREATE OR REPLACE FUNCTION public.consolidar_ponto_diario()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_entrada TIME;
  v_saida_almoco TIME;
  v_retorno_almoco TIME;
  v_saida TIME;
  v_horas_trabalhadas INTERVAL := make_interval(mins => 0);
  v_total_minutos INT := 0;
  v_status TEXT;
  v_pendente BOOLEAN := false;
  v_tem_ajuste_pendente BOOLEAN := FALSE;
BEGIN
  -- Buscar marcações mapeadas pelo tipo_marcacao usando subqueries para evitar FILTER
  -- IMPORTANTE: Consolidar DENTRO DO MESMO TENANT_ID para evitar mixing de escopos
  -- Ordenamos por created_at DESC para garantir que ajustes manuais ou correções recentes prevaleçam
  -- Quando há duplicatas do mesmo tipo, pegamos a mais recente (aprovada).
  SELECT (SELECT hora_marcacao FROM public.ponto_marcacoes 
    WHERE tenant_id = NEW.tenant_id 
      AND colaborador_cpf = NEW.colaborador_cpf 
      AND data_marcacao = NEW.data_marcacao 
      AND tipo_marcacao = 'entrada' 
    ORDER BY created_at DESC, id DESC LIMIT 1) 
  INTO v_entrada;
  
  SELECT (SELECT hora_marcacao FROM public.ponto_marcacoes 
    WHERE tenant_id = NEW.tenant_id 
      AND colaborador_cpf = NEW.colaborador_cpf 
      AND data_marcacao = NEW.data_marcacao 
      AND tipo_marcacao = 'saida_almoco' 
    ORDER BY created_at DESC, id DESC LIMIT 1) 
  INTO v_saida_almoco;
  
  SELECT (SELECT hora_marcacao FROM public.ponto_marcacoes 
    WHERE tenant_id = NEW.tenant_id 
      AND colaborador_cpf = NEW.colaborador_cpf 
      AND data_marcacao = NEW.data_marcacao 
      AND tipo_marcacao = 'retorno_almoco' 
    ORDER BY created_at DESC, id DESC LIMIT 1) 
  INTO v_retorno_almoco;
  
  SELECT (SELECT hora_marcacao FROM public.ponto_marcacoes 
    WHERE tenant_id = NEW.tenant_id 
      AND colaborador_cpf = NEW.colaborador_cpf 
      AND data_marcacao = NEW.data_marcacao 
      AND tipo_marcacao = 'saida' 
    ORDER BY created_at DESC, id DESC LIMIT 1) 
  INTO v_saida;

  -- Verificar se existe ajuste pendente no sistema (dentro do mesmo tenant)
  SELECT EXISTS (
    SELECT 1 FROM public.ponto_ajustes 
    WHERE tenant_id = NEW.tenant_id 
      AND colaborador_cpf = NEW.colaborador_cpf 
      AND data_referencia = NEW.data_marcacao::TEXT 
      AND status = 'pendente'
  ) INTO v_tem_ajuste_pendente;

  -- Cálculo de horas trabalhadas (Pares: Entrada-S.Almoco e R.Almoco-Saida)
  IF v_entrada IS NOT NULL AND v_saida_almoco IS NOT NULL THEN
    v_total_minutos := v_total_minutos + (EXTRACT(EPOCH FROM (v_saida_almoco - v_entrada)) / 60)::INT;
  END IF;
  
  IF v_retorno_almoco IS NOT NULL AND v_saida IS NOT NULL THEN
    v_total_minutos := v_total_minutos + (EXTRACT(EPOCH FROM (v_saida - v_retorno_almoco)) / 60)::INT;
  ELSIF v_entrada IS NOT NULL AND v_saida IS NOT NULL AND v_saida_almoco IS NULL AND v_retorno_almoco IS NULL THEN
    v_total_minutos := (EXTRACT(EPOCH FROM (v_saida - v_entrada)) / 60)::INT;
  END IF;

  v_horas_trabalhadas := make_interval(mins => GREATEST(0, v_total_minutos));

  -- Validação de inconsistência
  IF (v_entrada IS NOT NULL AND v_saida IS NOT NULL AND (
       (v_saida_almoco IS NOT NULL AND v_retorno_almoco IS NULL) OR 
       (v_saida_almoco IS NULL AND v_retorno_almoco IS NOT NULL) OR
       (v_saida_almoco IS NOT NULL AND v_saida_almoco <= v_entrada) OR
       (v_retorno_almoco IS NOT NULL AND v_retorno_almoco <= v_saida_almoco) OR
       (v_saida <= COALESCE(v_retorno_almoco, v_entrada))
     )) OR (v_entrada IS NULL AND (v_saida_almoco IS NOT NULL OR v_retorno_almoco IS NOT NULL OR v_saida IS NOT NULL)) THEN
    v_pendente := true;
  END IF;

  -- Definir status
  IF v_tem_ajuste_pendente OR v_pendente THEN
    v_status := 'ajuste_pendente';
  ELSIF v_entrada IS NULL AND v_saida IS NULL THEN
    v_status := 'falta';
  ELSIF v_entrada IS NOT NULL AND v_saida IS NULL THEN
    v_status := 'incompleto';
  ELSIF v_entrada IS NOT NULL AND v_entrada > '08:10'::TIME THEN
    v_status := 'atraso';
  ELSE
    v_status := 'regular';
  END IF;

  INSERT INTO public.ponto_diario (
    tenant_id, colaborador_id, colaborador_nome, colaborador_cpf, data,
    entrada, saida_almoco, retorno_almoco, saida,
    horas_trabalhadas, status
  ) VALUES (
    NEW.tenant_id, NEW.colaborador_id, NEW.colaborador_nome, NEW.colaborador_cpf, NEW.data_marcacao,
    v_entrada, v_saida_almoco, v_retorno_almoco, v_saida,
    v_horas_trabalhadas, v_status
  )
  ON CONFLICT (tenant_id, colaborador_cpf, data)
  DO UPDATE SET
    entrada = v_entrada,
    saida_almoco = v_saida_almoco,
    retorno_almoco = v_retorno_almoco,
    saida = v_saida,
    horas_trabalhadas = v_horas_trabalhadas,
    status = CASE WHEN public.ponto_diario.status = 'justificado' THEN 'justificado' ELSE v_status END,
    updated_at = now();

  RETURN NEW;
END;
$function$;
