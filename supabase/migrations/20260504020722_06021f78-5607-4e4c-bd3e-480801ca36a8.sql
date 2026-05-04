DO $$
DECLARE
    v_tenant_id UUID := 'a9b23784-5e5c-4f54-a71c-f1168e02771b';
    v_empresa_id UUID := 'af14ea7c-9955-4174-a077-eebaf8d3211a';
    v_user_id UUID := 'd63756f7-4866-4a80-8793-b33456bdde6a';
    v_escala_5x2 UUID;
    v_escala_6x1 UUID;
    v_escala_12x36 UUID;
    v_colab_id UUID;
    v_banco_id UUID;
    v_date DATE;
    v_status TEXT;
    v_entrada TIME;
    v_saida TIME;
    v_horas_trabalhadas INTERVAL;
    v_atraso_min INT;
    v_he50 INT;
    v_dow INT;
    v_rand FLOAT;
    nomes TEXT[] := ARRAY[
        'Carlos Roberto Silva', 'Mariana Costa Souza', 'Ana Paula Pereira', 'Roberto Almeida Santos',
        'Juliana Ferreira Lima', 'Pedro Henrique Oliveira', 'Fernanda Ribeiro Castro', 'Lucas Martins Rocha',
        'Patricia Gomes Cardoso', 'Rafael Alves Mendes'
    ];
    cpfs TEXT[] := ARRAY[
        '111.111.111-01', '222.222.222-02', '333.333.333-03', '444.444.444-04',
        '555.555.555-05', '666.666.666-06', '777.777.777-07', '888.888.888-08',
        '999.999.999-09', '101.010.101-10'
    ];
    cargos TEXT[] := ARRAY[
        'Analista Financeiro', 'Coordenadora de RH', 'Assistente Administrativa', 'Gerente Comercial',
        'Analista de Marketing', 'Auxiliar de Logistica', 'Contadora', 'Desenvolvedor',
        'Consultora de Vendas', 'Supervisor Operacional'
    ];
    departamentos TEXT[] := ARRAY[
        'Financeiro', 'RH', 'Administrativo', 'Comercial',
        'Marketing', 'Operacional', 'Financeiro', 'TI',
        'Comercial', 'Operacional'
    ];
    escala_arr UUID[] := ARRAY[]::UUID[];
    colab_ids UUID[] := ARRAY[]::UUID[];
    cpf_atual TEXT;
    nome_atual TEXT;
BEGIN
    SET session_replication_role = 'replica';

    DELETE FROM public.ponto_alertas WHERE empresa_id = v_empresa_id;
    DELETE FROM public.ponto_banco_horas_movimentacoes WHERE tenant_id = v_tenant_id;
    DELETE FROM public.ponto_banco_horas WHERE tenant_id = v_tenant_id;
    DELETE FROM public.ponto_diario WHERE empresa_id = v_empresa_id;
    DELETE FROM public.ponto_marcacoes WHERE empresa_id = v_empresa_id;
    DELETE FROM public.ponto_ajustes WHERE tenant_id = v_tenant_id;
    DELETE FROM public.ponto_fechamentos WHERE tenant_id = v_tenant_id;
    DELETE FROM public.ponto_escala_atribuicoes WHERE tenant_id = v_tenant_id;
    DELETE FROM public.ponto_escalas WHERE tenant_id = v_tenant_id;

    INSERT INTO public.ponto_escalas (tenant_id, empresa_id, nome, tipo, jornada_diaria_minutos, jornada_semanal_minutos,
        intervalo_intrajornada_minutos, hora_entrada_padrao, hora_saida_padrao, ativa, sabado_util, domingo_util)
    VALUES (v_tenant_id, v_empresa_id, 'Administrativa 5x2', '5x2', 480, 2400, 60, '08:00:00', '17:00:00', true, false, false)
    RETURNING id INTO v_escala_5x2;

    INSERT INTO public.ponto_escalas (tenant_id, empresa_id, nome, tipo, jornada_diaria_minutos, jornada_semanal_minutos,
        intervalo_intrajornada_minutos, hora_entrada_padrao, hora_saida_padrao, ativa, sabado_util, domingo_util)
    VALUES (v_tenant_id, v_empresa_id, 'Comercial 6x1', '6x1', 440, 2640, 60, '09:00:00', '18:00:00', true, true, false)
    RETURNING id INTO v_escala_6x1;

    INSERT INTO public.ponto_escalas (tenant_id, empresa_id, nome, tipo, jornada_diaria_minutos, jornada_semanal_minutos,
        intervalo_intrajornada_minutos, hora_entrada_padrao, hora_saida_padrao, ativa, sabado_util, domingo_util)
    VALUES (v_tenant_id, v_empresa_id, 'Operacional 12x36', '12x36', 720, 2160, 60, '07:00:00', '19:00:00', true, true, true)
    RETURNING id INTO v_escala_12x36;

    escala_arr := ARRAY[v_escala_5x2, v_escala_5x2, v_escala_5x2, v_escala_6x1, v_escala_5x2,
                       v_escala_12x36, v_escala_5x2, v_escala_5x2, v_escala_6x1, v_escala_12x36];

    FOR i IN 1..10 LOOP
        INSERT INTO public.admissoes (
            tenant_id, empresa_id, status, nome_completo, cpf, cargo, departamento,
            email, data_admissao, tipo_contrato, criado_por, salario, jornada_trabalho,
            data_nascimento, genero, nacionalidade, estado_civil
        )
        VALUES (v_tenant_id, v_empresa_id, 'concluido', nomes[i], cpfs[i], cargos[i], departamentos[i],
               lower(replace(nomes[i], ' ', '.')) || '@empresah.demo',
               CURRENT_DATE - (random() * 1500)::INT, 'clt', v_user_id, (3000 + random() * 8000)::NUMERIC(10,2), '44h semanais',
               CURRENT_DATE - (random() * 15000 + 7300)::INT,
               CASE WHEN i % 2 = 0 THEN 'feminino' ELSE 'masculino' END,
               'Brasileira', 'solteiro')
        RETURNING id INTO v_colab_id;

        colab_ids := array_append(colab_ids, v_colab_id);

        INSERT INTO public.ponto_escala_atribuicoes (tenant_id, escala_id, colaborador_id, colaborador_nome, colaborador_cpf, data_inicio, ativa)
        VALUES (v_tenant_id, escala_arr[i], v_colab_id::TEXT, nomes[i], cpfs[i], CURRENT_DATE - 90, true);
    END LOOP;

    FOR idx IN 1..array_length(colab_ids, 1) LOOP
        v_colab_id := colab_ids[idx];
        cpf_atual := cpfs[idx];
        nome_atual := nomes[idx];

        FOR i IN 0..30 LOOP
            v_date := CURRENT_DATE - i;
            v_dow := EXTRACT(DOW FROM v_date);

            IF escala_arr[idx] = v_escala_5x2 AND v_dow IN (0, 6) THEN CONTINUE; END IF;
            IF escala_arr[idx] = v_escala_6x1 AND v_dow = 0 THEN CONTINUE; END IF;
            IF escala_arr[idx] = v_escala_12x36 AND (EXTRACT(DAY FROM v_date)::INT + idx) % 2 = 0 THEN CONTINUE; END IF;

            v_rand := random();
            v_atraso_min := 0;
            v_he50 := 0;

            IF v_rand < 0.05 AND i > 0 THEN
                INSERT INTO public.ponto_diario (tenant_id, empresa_id, escala_id, colaborador_id, colaborador_nome, colaborador_cpf, data, status)
                VALUES (v_tenant_id, v_empresa_id, escala_arr[idx], v_colab_id, nome_atual, cpf_atual, v_date, 'falta');
                CONTINUE;
            ELSIF v_rand < 0.10 AND i > 0 THEN
                INSERT INTO public.ponto_diario (tenant_id, empresa_id, escala_id, colaborador_id, colaborador_nome, colaborador_cpf, data, status, observacao)
                VALUES (v_tenant_id, v_empresa_id, escala_arr[idx], v_colab_id, nome_atual, cpf_atual, v_date, 'justificado', 'Atestado medico');
                CONTINUE;
            ELSIF v_rand < 0.18 AND i > 0 THEN
                INSERT INTO public.ponto_diario (tenant_id, empresa_id, escala_id, colaborador_id, colaborador_nome, colaborador_cpf, data,
                    entrada, saida_almoco, retorno_almoco, status)
                VALUES (v_tenant_id, v_empresa_id, escala_arr[idx], v_colab_id, nome_atual, cpf_atual, v_date,
                    '08:00:00', '12:00:00', '13:00:00', 'incompleto');
                INSERT INTO public.ponto_marcacoes (tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf, data_marcacao, hora_marcacao, tipo_marcacao, hash_marcacao)
                VALUES
                (v_tenant_id, v_empresa_id, v_colab_id, nome_atual, cpf_atual, v_date, '08:00:00', 'entrada', md5(random()::text)),
                (v_tenant_id, v_empresa_id, v_colab_id, nome_atual, cpf_atual, v_date, '12:00:00', 'saida_almoco', md5(random()::text)),
                (v_tenant_id, v_empresa_id, v_colab_id, nome_atual, cpf_atual, v_date, '13:00:00', 'retorno_almoco', md5(random()::text));
                CONTINUE;
            ELSIF v_rand < 0.30 THEN
                v_atraso_min := (10 + random() * 30)::INT;
                v_entrada := '08:00:00'::TIME + (v_atraso_min || ' minutes')::INTERVAL;
                v_saida := '17:00:00';
                v_status := 'atraso';
                v_horas_trabalhadas := ((8 - v_atraso_min::FLOAT/60)::TEXT || ' hours')::INTERVAL;
            ELSIF v_rand < 0.35 THEN
                v_entrada := '08:00:00';
                v_saida := '19:00:00'::TIME + ((random()*60)::INT || ' minutes')::INTERVAL;
                v_status := 'regular';
                v_he50 := 120 + (random() * 60)::INT;
                v_horas_trabalhadas := '10 hours';
            ELSE
                v_entrada := '08:00:00';
                v_saida := '17:00:00';
                v_status := 'regular';
                v_horas_trabalhadas := '8 hours';
            END IF;

            INSERT INTO public.ponto_diario (
                tenant_id, empresa_id, escala_id, colaborador_id, colaborador_nome, colaborador_cpf, data,
                entrada, saida_almoco, retorno_almoco, saida, horas_trabalhadas, status,
                atraso_minutos, horas_extras_50_minutos
            ) VALUES (
                v_tenant_id, v_empresa_id, escala_arr[idx], v_colab_id, nome_atual, cpf_atual, v_date,
                v_entrada, '12:00:00', '13:00:00', v_saida, v_horas_trabalhadas, v_status,
                v_atraso_min, v_he50
            );

            INSERT INTO public.ponto_marcacoes (tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf, data_marcacao, hora_marcacao, tipo_marcacao, hash_marcacao)
            VALUES
            (v_tenant_id, v_empresa_id, v_colab_id, nome_atual, cpf_atual, v_date, v_entrada, 'entrada', md5(random()::text)),
            (v_tenant_id, v_empresa_id, v_colab_id, nome_atual, cpf_atual, v_date, '12:00:00', 'saida_almoco', md5(random()::text)),
            (v_tenant_id, v_empresa_id, v_colab_id, nome_atual, cpf_atual, v_date, '13:00:00', 'retorno_almoco', md5(random()::text)),
            (v_tenant_id, v_empresa_id, v_colab_id, nome_atual, cpf_atual, v_date, v_saida, 'saida', md5(random()::text));
        END LOOP;

        INSERT INTO public.ponto_banco_horas (
            tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf, competencia, tipo,
            saldo_anterior_minutos, creditos_minutos, debitos_minutos, compensados_minutos, saldo_atual_minutos
        ) VALUES (
            v_tenant_id, v_empresa_id, v_colab_id, nome_atual, cpf_atual, to_char(CURRENT_DATE, 'YYYY-MM'), 'mensal',
            (random() * 240 - 120)::INT, (60 + random() * 240)::INT, (random() * 60)::INT, (random() * 30)::INT, (random() * 200 - 50)::INT
        ) RETURNING id INTO v_banco_id;

        INSERT INTO public.ponto_banco_horas_movimentacoes (tenant_id, banco_horas_id, colaborador_cpf, data_referencia, tipo, minutos, descricao) VALUES
        (v_tenant_id, v_banco_id, cpf_atual, CURRENT_DATE - 3, 'credito', 120, 'Hora extra projeto urgente'),
        (v_tenant_id, v_banco_id, cpf_atual, CURRENT_DATE - 7, 'credito', 90, 'HE final de semana'),
        (v_tenant_id, v_banco_id, cpf_atual, CURRENT_DATE - 12, 'compensacao', 60, 'Saida antecipada'),
        (v_tenant_id, v_banco_id, cpf_atual, CURRENT_DATE - 18, 'debito', 30, 'Atraso justificado');

        INSERT INTO public.ponto_banco_horas (
            tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf, competencia, tipo,
            saldo_anterior_minutos, creditos_minutos, debitos_minutos, compensados_minutos, saldo_atual_minutos
        ) VALUES (
            v_tenant_id, v_empresa_id, v_colab_id, nome_atual, cpf_atual, to_char(CURRENT_DATE - INTERVAL '1 month', 'YYYY-MM'), 'mensal',
            0, (60 + random() * 180)::INT, (random() * 90)::INT, (random() * 60)::INT, (random() * 150)::INT
        );

        IF idx <= 5 THEN
            INSERT INTO public.ponto_alertas (tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf, tipo, severidade, titulo, descricao, data_referencia)
            VALUES
            (v_tenant_id, v_empresa_id, v_colab_id, nome_atual, cpf_atual,
             (ARRAY['atraso','falta','excesso_jornada','intervalo'])[1 + (idx % 4)],
             (ARRAY['baixa','media','alta'])[1 + (idx % 3)],
             'Atencao: ' || (ARRAY['Atrasos recorrentes','Faltas nao justificadas','Excesso de jornada (>10h)','Intervalo intrajornada inferior'])[1 + (idx % 4)],
             'Detectado padrao de irregularidade nas ultimas marcacoes de ' || nome_atual,
             CURRENT_DATE - (idx * 2));
        END IF;

        IF idx <= 4 THEN
            INSERT INTO public.ponto_ajustes (
                tenant_id, colaborador_id, colaborador_nome, colaborador_cpf, data_referencia,
                tipo_ajuste, tipo_marcacao, hora_solicitada, motivo, status, created_by, created_by_nome
            ) VALUES (
                v_tenant_id, v_colab_id, nome_atual, cpf_atual, CURRENT_DATE - idx,
                (ARRAY['inclusao','correcao','justificativa','inclusao'])[idx],
                'entrada', '08:15:00',
                (ARRAY['Esqueci de bater o ponto na entrada','Sistema fora do ar','Atestado medico anexado','Reuniao externa nao registrada'])[idx],
                'pendente', v_user_id, 'Sistema Demo'
            );
        END IF;
    END LOOP;

    INSERT INTO public.ponto_fechamentos (tenant_id, empresa_id, competencia, status, total_colaboradores, total_faltas, total_atrasos, total_horas_extras_minutos, fechado_por, fechado_por_nome, data_fechamento)
    VALUES
    (v_tenant_id, v_empresa_id, to_char(CURRENT_DATE - INTERVAL '1 month', 'YYYY-MM'), 'fechado', 10, 12, 8, 1850, v_user_id, 'TESTE EM 02 DE MAIO', NOW() - INTERVAL '15 days'),
    (v_tenant_id, v_empresa_id, to_char(CURRENT_DATE - INTERVAL '2 months', 'YYYY-MM'), 'fechado', 10, 8, 15, 2200, v_user_id, 'TESTE EM 02 DE MAIO', NOW() - INTERVAL '45 days'),
    (v_tenant_id, v_empresa_id, to_char(CURRENT_DATE, 'YYYY-MM'), 'aberto', 10, 5, 9, 1200, NULL, NULL, NULL);

    SET session_replication_role = 'origin';
END $$;