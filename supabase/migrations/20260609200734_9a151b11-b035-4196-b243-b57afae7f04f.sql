-- Função para disparar a consolidação do ponto a partir de um ajuste
CREATE OR REPLACE FUNCTION public.consolidar_ponto_por_ajuste()
RETURNS TRIGGER AS $$
DECLARE
    v_colaborador_id UUID;
    v_colaborador_nome TEXT;
BEGIN
    -- Só precisamos consolidar se o status mudar (aprovação/rejeição) ou se for um novo ajuste pendente
    IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) OR (TG_OP = 'INSERT') THEN
        
        -- Chamamos a função de consolidação existente. 
        -- Ela espera um registro da tabela ponto_marcacoes no parâmetro NEW.
        -- Como não temos esse registro, mas a função usa apenas alguns campos do NEW, 
        -- podemos simular um registro ou ajustar a lógica.
        
        -- A função consolidar_ponto_diario usa: 
        -- NEW.tenant_id, NEW.colaborador_cpf, NEW.data_marcacao, NEW.colaborador_id, NEW.colaborador_nome
        
        -- Vamos executar a lógica de atualização diretamente para garantir consistência
        -- baseado na lógica da função consolidar_ponto_diario(32483)
        
        PERFORM public.consolidar_ponto_diario_manual(NEW.tenant_id, NEW.colaborador_cpf, NEW.data_referencia);
        
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função auxiliar para consolidar ponto sem depender de trigger NEW record de ponto_marcacoes
CREATE OR REPLACE FUNCTION public.consolidar_ponto_diario_manual(p_tenant_id UUID, p_colaborador_cpf TEXT, p_data DATE)
RETURNS VOID AS $$
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
  v_colaborador_id UUID;
  v_colaborador_nome TEXT;
BEGIN
  -- Busca dados do colaborador a partir da última marcação ou ajuste
  SELECT colaborador_id, colaborador_nome INTO v_colaborador_id, v_colaborador_nome
  FROM public.ponto_marcacoes
  WHERE tenant_id = p_tenant_id AND colaborador_cpf = p_colaborador_cpf
  ORDER BY created_at DESC LIMIT 1;

  IF v_colaborador_id IS NULL THEN
      SELECT colaborador_id, colaborador_nome INTO v_colaborador_id, v_colaborador_nome
      FROM public.ponto_ajustes
      WHERE tenant_id = p_tenant_id AND colaborador_cpf = p_colaborador_cpf
      ORDER BY created_at DESC LIMIT 1;
  END IF;

  -- Lógica idêntica à trigger de ponto_marcacoes
  SELECT (SELECT hora_marcacao FROM public.ponto_marcacoes 
    WHERE tenant_id = p_tenant_id 
      AND colaborador_cpf = p_colaborador_cpf 
      AND data_marcacao = p_data 
      AND tipo_marcacao = 'entrada' 
    ORDER BY created_at DESC, id DESC LIMIT 1) 
  INTO v_entrada;
  
  SELECT (SELECT hora_marcacao FROM public.ponto_marcacoes 
    WHERE tenant_id = p_tenant_id 
      AND colaborador_cpf = p_colaborador_cpf 
      AND data_marcacao = p_data 
      AND tipo_marcacao = 'saida_almoco' 
    ORDER BY created_at DESC, id DESC LIMIT 1) 
  INTO v_saida_almoco;
  
  SELECT (SELECT hora_marcacao FROM public.ponto_marcacoes 
    WHERE tenant_id = p_tenant_id 
      AND colaborador_cpf = p_colaborador_cpf 
      AND data_marcacao = p_data 
      AND tipo_marcacao = 'retorno_almoco' 
    ORDER BY created_at DESC, id DESC LIMIT 1) 
  INTO v_retorno_almoco;
  
  SELECT (SELECT hora_marcacao FROM public.ponto_marcacoes 
    WHERE tenant_id = p_tenant_id 
      AND colaborador_cpf = p_colaborador_cpf 
      AND data_marcacao = p_data 
      AND tipo_marcacao = 'saida' 
    ORDER BY created_at DESC, id DESC LIMIT 1) 
  INTO v_saida;

  SELECT EXISTS (
    SELECT 1 FROM public.ponto_ajustes 
    WHERE tenant_id = p_tenant_id 
      AND colaborador_cpf = p_colaborador_cpf 
      AND data_referencia = p_data
      AND status = 'pendente'
  ) INTO v_tem_ajuste_pendente;

  IF v_entrada IS NOT NULL AND v_saida_almoco IS NOT NULL THEN
    v_total_minutos := v_total_minutos + (EXTRACT(EPOCH FROM (v_saida_almoco - v_entrada)) / 60)::INT;
  END IF;
  
  IF v_retorno_almoco IS NOT NULL AND v_saida IS NOT NULL THEN
    v_total_minutos := v_total_minutos + (EXTRACT(EPOCH FROM (v_saida - v_retorno_almoco)) / 60)::INT;
  ELSIF v_entrada IS NOT NULL AND v_saida IS NOT NULL AND v_saida_almoco IS NULL AND v_retorno_almoco IS NULL THEN
    v_total_minutos := (EXTRACT(EPOCH FROM (v_saida - v_entrada)) / 60)::INT;
  END IF;

  v_horas_trabalhadas := make_interval(mins => GREATEST(0, v_total_minutos));

  -- Lógica de pendência
  IF (v_entrada IS NOT NULL AND v_saida IS NOT NULL AND (
       (v_saida_almoco IS NOT NULL AND v_retorno_almoco IS NULL) OR 
       (v_saida_almoco IS NULL AND v_retorno_almoco IS NOT NULL) OR
       (v_saida_almoco IS NOT NULL AND v_saida_almoco <= v_entrada) OR
       (v_retorno_almoco IS NOT NULL AND v_retorno_almoco <= v_saida_almoco) OR
       (v_saida <= COALESCE(v_retorno_almoco, v_entrada))
     )) OR (v_entrada IS NULL AND (v_saida_almoco IS NOT NULL OR v_retorno_almoco IS NOT NULL OR v_saida IS NOT NULL)) THEN
    v_pendente := true;
  END IF;

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

  IF v_colaborador_id IS NOT NULL THEN
      INSERT INTO public.ponto_diario (
        tenant_id, colaborador_id, colaborador_nome, colaborador_cpf, data,
        entrada, saida_almoco, retorno_almoco, saida,
        horas_trabalhadas, status
      ) VALUES (
        p_tenant_id, v_colaborador_id, v_colaborador_nome, p_colaborador_cpf, p_data,
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
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criação da trigger na tabela ponto_ajustes
DROP TRIGGER IF EXISTS trigger_consolidar_ponto_ajustes ON public.ponto_ajustes;
CREATE TRIGGER trigger_consolidar_ponto_ajustes
AFTER INSERT OR UPDATE ON public.ponto_ajustes
FOR EACH ROW
EXECUTE FUNCTION public.consolidar_ponto_por_ajuste();

-- Força uma atualização para os dados da Jaqueline Dalmolin citados no chamado
SELECT public.consolidar_ponto_diario_manual('83f1b040-c857-45a4-b71d-506e2a32d527', '10140589961', '2026-06-08');
SELECT public.consolidar_ponto_diario_manual('299779a8-1cd2-4ffe-9462-78181426cd1a', '10140589961', '2026-06-08');
