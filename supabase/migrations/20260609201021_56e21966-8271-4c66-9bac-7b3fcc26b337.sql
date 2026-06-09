-- 1. Correção Técnica: Resolver os registros da Jaqueline Dalmolin (08/06)
-- Ela tem 3 saídas e 0 entradas (porque a entrada real foi parar no tenant errado anteriormente e a correção inseriu tipos errados)

SET session_replication_role = 'replica';

-- Corrigir os tipos das marcações da Jaqueline no dia 08/06 no tenant correto
-- O registro de 08:00:38 deve ser ENTRADA (já está certo agora após o migration anterior)
-- O registro de 08:00:00 (ajuste) deve ser deletado pois é redundante e incorreto
DELETE FROM public.ponto_marcacoes 
WHERE id = '0ef9b2ae-b526-4456-9cc8-e5c5beb5c673';

-- O registro de 12:04:00 (ajuste) deve ser SAIDA_ALMOCO
UPDATE public.ponto_marcacoes SET tipo_marcacao = 'saida_almoco' 
WHERE id = '552b4225-879b-4d7f-9ab2-8b9d2e2b476a';

-- O registro de 13:26:00 (ajuste) deve ser RETORNO_ALMOCO
UPDATE public.ponto_marcacoes SET tipo_marcacao = 'retorno_almoco' 
WHERE id = 'cb57387f-1b2c-48bd-9526-e61cee47c04b';

-- O registro de 20:06:00 (ajuste) deve continuar como SAIDA (já está certo)

SET session_replication_role = 'origin';

-- 2. Atualizar a lógica da trigger para ser mais robusta em relação a ajustes aprovados
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

  -- Verificação de ajustes pendentes
  SELECT EXISTS (
    SELECT 1 FROM public.ponto_ajustes 
    WHERE tenant_id = p_tenant_id 
      AND colaborador_cpf = p_colaborador_cpf 
      AND data_referencia = p_data
      AND status = 'pendente'
  ) INTO v_tem_ajuste_pendente;

  -- Cálculo de horas
  IF v_entrada IS NOT NULL AND v_saida_almoco IS NOT NULL THEN
    v_total_minutos := v_total_minutos + (EXTRACT(EPOCH FROM (v_saida_almoco - v_entrada)) / 60)::INT;
  END IF;
  
  IF v_retorno_almoco IS NOT NULL AND v_saida IS NOT NULL THEN
    v_total_minutos := v_total_minutos + (EXTRACT(EPOCH FROM (v_saida - v_retorno_almoco)) / 60)::INT;
  ELSIF v_entrada IS NOT NULL AND v_saida IS NOT NULL AND v_saida_almoco IS NULL AND v_retorno_almoco IS NULL THEN
    v_total_minutos := (EXTRACT(EPOCH FROM (v_saida - v_entrada)) / 60)::INT;
  END IF;

  v_horas_trabalhadas := make_interval(mins => GREATEST(0, v_total_minutos));

  -- Verificação de inconsistências (marcas fora de ordem)
  IF (v_entrada IS NOT NULL AND v_saida IS NOT NULL AND (
       (v_saida_almoco IS NOT NULL AND v_retorno_almoco IS NULL) OR 
       (v_saida_almoco IS NULL AND v_retorno_almoco IS NOT NULL) OR
       (v_saida_almoco IS NOT NULL AND v_saida_almoco <= v_entrada) OR
       (v_retorno_almoco IS NOT NULL AND v_retorno_almoco <= v_saida_almoco) OR
       (v_saida <= COALESCE(v_retorno_almoco, v_entrada))
     )) OR (v_entrada IS NULL AND (v_saida_almoco IS NOT NULL OR v_retorno_almoco IS NOT NULL OR v_saida IS NOT NULL)) THEN
    v_pendente := true;
  END IF;

  -- Definição do status final
  IF v_tem_ajuste_pendente THEN
    v_status := 'ajuste_pendente';
  ELSIF v_pendente THEN
    v_status := 'incompleto'; -- Melhor 'incompleto' que 'pendente' para o usuário
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

-- 3. Forçar a consolidação final para a Jaqueline
SELECT public.consolidar_ponto_diario_manual('83f1b040-c857-45a4-b71d-506e2a32d527', '10140589961', '2026-06-08');
