DO $$
DECLARE
    v_tenant_id UUID := '186f6e2e-ecdd-447c-9cfd-cadca2080e58';
    v_user_id UUID := '1a4496d7-f086-40ce-b76e-c919a0bce0c6'; -- profile id
    v_filial_id UUID;
    v_meta_id UUID := 'de7d5e8f-5b71-4616-ae57-daee5fc6932a';
BEGIN
    -- 1. Criar Filial
    INSERT INTO public.filiais (id, tenant_id, nome, cnpj, ativo)
    VALUES (gen_random_uuid(), v_tenant_id, 'Matriz São Paulo', '12.345.678/0001-90', true)
    RETURNING id INTO v_filial_id;

    -- 2. Criar Departamento
    INSERT INTO public.departamentos (id, tenant_id, filial_id, nome, ativo)
    VALUES (gen_random_uuid(), v_tenant_id, v_filial_id, 'Recursos Humanos', true);

    -- 3. Ouvidoria
    INSERT INTO public.ouvidoria (id, tenant_id, tipo, assunto, mensagem)
    VALUES (gen_random_uuid(), v_tenant_id, 'elogio', 'Elogio à infraestrutura', 'A nova copa ficou excelente.');

    -- 4. SST - Eventos
    INSERT INTO public.eventos_sst (id, tenant_id, tipo, descricao, data_evento, colaborador_id)
    VALUES (gen_random_uuid(), v_tenant_id, 'incidente', 'Queda de nível no almoxarifado (sem lesão)', now(), v_user_id);

    -- 5. Estratégia - OKR
    INSERT INTO public.meta_okrs (id, tenant_id, meta_id, key_result, descricao, valor_inicial, valor_atual, valor_alvo, progresso)
    VALUES (gen_random_uuid(), v_tenant_id, v_meta_id, 'Treinamentos Realizados', 'Aumentar engajamento SST', 0, 45, 100, 45.0);

    -- 6. Pessoas - Humor e PDI
    INSERT INTO public.humor_diario (id, tenant_id, user_id, user_nome, humor, emoji, data)
    VALUES (gen_random_uuid(), v_tenant_id, v_user_id, 'Usuário Demonstração', 'muito_bem', '😊', current_date);

    INSERT INTO public.pdis (id, tenant_id, colaborador_id, colaborador_nome, titulo, descricao, data_inicio, data_fim, status)
    VALUES (gen_random_uuid(), v_tenant_id, v_user_id, 'Usuário Demonstração', 'Plano de Liderança 2024', 'Desenvolver soft skills para gestão de equipes', now(), now() + interval '6 months', 'ativo');

    -- 7. SST - EPI
    INSERT INTO public.epi_tipos (id, tenant_id, nome, descricao)
    VALUES (gen_random_uuid(), v_tenant_id, 'Capacete de Segurança', 'Capacete classe B com jugular');

    -- 8. Jornada - Análise
    INSERT INTO public.jornada_analises (id, tenant_id, colaborador_cpf, colaborador_nome, periodo_inicio, periodo_fim)
    VALUES (gen_random_uuid(), v_tenant_id, '123.456.789-00', 'Usuário Demonstração', now() - interval '1 month', now());

END $$;