-- Get the target user info
DO $$
DECLARE
    v_user_id UUID := 'd63756f7-4866-4a80-8793-b33456bdde6a';
    v_tenant_id UUID;
    v_nome TEXT;
    v_colab_id UUID;
    v_cpf TEXT;
    v_escala_id UUID;
    v_banco_id UUID;
    v_date DATE;
    v_empresa_id UUID;
BEGIN
    -- 1. Identify User and Tenant
    SELECT tenant_id, nome_completo, id, cpf INTO v_tenant_id, v_nome, v_colab_id, v_cpf
    FROM public.usuarios_base 
    WHERE auth_user_id = v_user_id;

    IF v_tenant_id IS NULL THEN
        RAISE NOTICE 'User or Tenant not found';
        RETURN;
    END IF;

    -- Create a dummy CPF if null (required for the unique constraint)
    IF v_cpf IS NULL THEN
        v_cpf := '000.000.000-00';
        UPDATE public.usuarios_base SET cpf = v_cpf WHERE id = v_colab_id;
    END IF;

    -- Get a valid empresa_id from empresa_cadastro
    SELECT id INTO v_empresa_id FROM public.empresa_cadastro WHERE tenant_id = v_tenant_id LIMIT 1;

    -- 2. Ensure a Scale exists
    SELECT id INTO v_escala_id FROM public.ponto_escalas WHERE tenant_id = v_tenant_id LIMIT 1;
    
    IF v_escala_id IS NULL THEN
        INSERT INTO public.ponto_escalas (
            tenant_id, nome, tipo, jornada_diaria_minutos, jornada_semanal_minutos,
            intervalo_intrajornada_minutos, hora_entrada_padrao, hora_saida_padrao,
            ativa, empresa_id
        ) VALUES (
            v_tenant_id, 'Escala Padrão (Demo)', '5x2', 480, 2400,
            60, '08:00:00', '17:00:00',
            true, v_empresa_id
        ) RETURNING id INTO v_escala_id;
    END IF;

    -- 3. Assign Scale to Colaborador
    INSERT INTO public.ponto_escala_atribuicoes (
        tenant_id, escala_id, colaborador_id, colaborador_nome, data_inicio
    ) VALUES (
        v_tenant_id, v_escala_id, v_colab_id, v_nome, CURRENT_DATE - INTERVAL '60 days'
    ) ON CONFLICT DO NOTHING;

    -- 4. Generate Daily Point Records for the last 30 days
    FOR i IN 0..30 LOOP
        v_date := CURRENT_DATE - i;
        
        -- Skip weekends for 5x2 demo
        IF EXTRACT(DOW FROM v_date) NOT IN (0, 6) THEN
            -- Check if record exists first to avoid constraint issues if CPF changed or something
            IF NOT EXISTS (SELECT 1 FROM public.ponto_diario WHERE tenant_id = v_tenant_id AND colaborador_cpf = v_cpf AND data = v_date) THEN
                INSERT INTO public.ponto_diario (
                    tenant_id, colaborador_id, colaborador_nome, colaborador_cpf, data,
                    entrada, saida_almoco, retorno_almoco, saida,
                    status, horas_trabalhadas, empresa_id, escala_id
                ) VALUES (
                    v_tenant_id, v_colab_id, v_nome, v_cpf, v_date,
                    '08:00:00', '12:00:00', '13:00:00', '17:00:00',
                    'regular', '8 hours', v_empresa_id, v_escala_id
                );
            END IF;
            
            -- Also create actual markings
            INSERT INTO public.ponto_marcacoes (
                tenant_id, colaborador_id, colaborador_nome, colaborador_cpf, data_marcacao, hora_marcacao, tipo_marcacao, hash_marcacao, empresa_id
            ) VALUES 
            (v_tenant_id, v_colab_id, v_nome, v_cpf, v_date, '08:00:00', 'entrada', md5(random()::text), v_empresa_id),
            (v_tenant_id, v_colab_id, v_nome, v_cpf, v_date, '12:00:00', 'saida_almoco', md5(random()::text), v_empresa_id),
            (v_tenant_id, v_colab_id, v_nome, v_cpf, v_date, '13:00:00', 'retorno_almoco', md5(random()::text), v_empresa_id),
            (v_tenant_id, v_colab_id, v_nome, v_cpf, v_date, '17:00:00', 'saida', md5(random()::text), v_empresa_id)
            ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;

    -- 5. Time Bank
    IF NOT EXISTS (SELECT 1 FROM public.ponto_banco_horas WHERE colaborador_id::text = v_colab_id::text AND competencia = to_char(CURRENT_DATE, 'YYYY-MM')) THEN
        INSERT INTO public.ponto_banco_horas (
            tenant_id, colaborador_id, colaborador_nome, colaborador_cpf, competencia, tipo,
            saldo_anterior_minutos, creditos_minutos, debitos_minutos, saldo_atual_minutos
        ) VALUES (
            v_tenant_id, v_colab_id, v_nome, v_cpf, to_char(CURRENT_DATE, 'YYYY-MM'), 'mensal',
            120, 60, 0, 180
        ) RETURNING id INTO v_banco_id;

        IF v_banco_id IS NOT NULL THEN
            INSERT INTO public.ponto_banco_horas_movimentacoes (
                tenant_id, banco_horas_id, colaborador_cpf, data_referencia, tipo, minutos, descricao
            ) VALUES (
                v_tenant_id, v_banco_id, v_cpf, CURRENT_DATE - 5, 'credito', 60, 'Hora extra projeto demo'
            );
        END IF;
    END IF;

    -- 6. Alerts
    INSERT INTO public.ponto_alertas (
        tenant_id, colaborador_id, colaborador_nome, colaborador_cpf, tipo, titulo, descricao, data_referencia, severidade
    ) VALUES (
        v_tenant_id, v_colab_id, v_nome, v_cpf, 'atraso', 'Atraso Recorrente', 'Atraso recorrente na última semana', CURRENT_DATE, 'media'
    ) ON CONFLICT DO NOTHING;

END $$;