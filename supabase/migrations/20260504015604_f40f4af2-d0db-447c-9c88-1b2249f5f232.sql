DO $$
DECLARE
    v_colab_id UUID := 'ca9f8ee6-ff05-4476-8cd5-6160d427693c';
    v_tenant_id UUID := 'a9b23784-5e5c-4f54-a71c-f1168e02771b';
    v_escala_id UUID;
    v_cpf TEXT := '000.000.000-00';
    v_date DATE;
    v_empresa_id UUID;
BEGIN
    -- Disable triggers session-wide to allow cleanup
    SET session_replication_role = 'replica';

    -- 1. Get the scale ID and empresa ID
    SELECT id, empresa_id INTO v_escala_id, v_empresa_id FROM public.ponto_escalas WHERE tenant_id = v_tenant_id LIMIT 1;

    -- 2. Update attribution with CPF
    UPDATE public.ponto_escala_atribuicoes 
    SET colaborador_cpf = v_cpf 
    WHERE colaborador_id::text = v_colab_id::text;

    -- 3. Clean up existing records to ensure scale_id and consistency
    DELETE FROM public.ponto_diario WHERE colaborador_id::text = v_colab_id::text;
    DELETE FROM public.ponto_marcacoes WHERE colaborador_id::text = v_colab_id::text;

    -- 4. Re-generate for the last 30 days including scale_id
    FOR i IN 0..30 LOOP
        v_date := CURRENT_DATE - i;
        
        IF EXTRACT(DOW FROM v_date) NOT IN (0, 6) THEN
            INSERT INTO public.ponto_diario (
                tenant_id, colaborador_id, colaborador_nome, colaborador_cpf, data,
                entrada, saida_almoco, retorno_almoco, saida,
                status, horas_trabalhadas, escala_id, empresa_id
            ) VALUES (
                v_tenant_id, v_colab_id, 'TESTE EM 02 DE MAIO', v_cpf, v_date,
                '08:00:00', '12:00:00', '13:00:00', '17:00:00',
                'regular', '8 hours', v_escala_id, v_empresa_id
            );
            
            INSERT INTO public.ponto_marcacoes (
                tenant_id, colaborador_id, colaborador_nome, colaborador_cpf, data_marcacao, hora_marcacao, tipo_marcacao, hash_marcacao, empresa_id
            ) VALUES 
            (v_tenant_id, v_colab_id, 'TESTE EM 02 DE MAIO', v_cpf, v_date, '08:00:00', 'entrada', md5(random()::text), v_empresa_id),
            (v_tenant_id, v_colab_id, 'TESTE EM 02 DE MAIO', v_cpf, v_date, '12:00:00', 'saida_almoco', md5(random()::text), v_empresa_id),
            (v_tenant_id, v_colab_id, 'TESTE EM 02 DE MAIO', v_cpf, v_date, '13:00:00', 'retorno_almoco', md5(random()::text), v_empresa_id),
            (v_tenant_id, v_colab_id, 'TESTE EM 02 DE MAIO', v_cpf, v_date, '17:00:00', 'saida', md5(random()::text), v_empresa_id);
        END IF;
    END LOOP;

    -- Re-enable triggers
    SET session_replication_role = 'origin';
END $$;