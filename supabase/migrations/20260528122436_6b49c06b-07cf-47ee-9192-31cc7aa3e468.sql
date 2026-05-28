DO $$
DECLARE
    v_tenant_id UUID := '186f6e2e-ecdd-447c-9cfd-cadca2080e58';
    v_empresa_id UUID := 'a79910e3-c5be-40b7-b2ee-b8ea07148327';
    v_user_id UUID := 'dfa9a813-a06a-4c43-a2af-237626509552';
    v_cargo_aux UUID := '36e03761-9bda-4e54-b8dd-5efb0f8ddafb';
    v_epi_tipo UUID := 'f12085aa-6f5b-4296-ae1e-689fd3ccedef';
    v_meta_id UUID := gen_random_uuid();
    v_swot_id UUID := gen_random_uuid();
BEGIN
    -- 1. Colaboradores
    INSERT INTO public.usuarios_base (id, tenant_id, nome_completo, email_principal, status, tipo_usuario, cargo_funcao, matricula, cpf, data_nascimento)
    VALUES 
    (gen_random_uuid(), v_tenant_id, 'Ana Silva', 'ana.' || substr(gen_random_uuid()::text, 1, 8) || '@exemplo.com', 'ativo', 'colaborador', 'Auxiliar Administrativo', 'MAT001', '12345678901', '1995-05-15'),
    (gen_random_uuid(), v_tenant_id, 'Bruno Oliveira', 'bruno.' || substr(gen_random_uuid()::text, 1, 8) || '@exemplo.com', 'ativo', 'colaborador', 'Analista Contábil', 'MAT002', '23456789012', '1990-08-20')
    ON CONFLICT DO NOTHING;

    -- 2. Metas
    INSERT INTO public.metas (id, tenant_id, empresa_id, titulo, descricao, nivel, status, periodo, data_inicio, data_fim, criado_por, ano)
    VALUES (v_meta_id, v_tenant_id, v_empresa_id, 'Meta Demo 2026', 'Desc', 'estrategica', 'em_andamento', 'anual', '2026-01-01', '2026-12-31', v_user_id, 2026);

    INSERT INTO public.meta_okrs (id, tenant_id, meta_id, key_result, descricao, valor_inicial, valor_alvo, valor_atual, progresso, status, tipo, unidade)
    VALUES (gen_random_uuid(), v_tenant_id, v_meta_id, 'KR Demo', 'Desc', 0, 100, 45, 45, 'em_andamento', 'percentual', '%');

    -- 3. Planos
    INSERT INTO public.plano_acoes (id, tenant_id, empresa_id, titulo, descricao, status, prioridade, prazo, responsavel_id, criado_por)
    VALUES (gen_random_uuid(), v_tenant_id, v_empresa_id, 'Ação Demo', 'Desc', 'em_andamento', 'medio', CURRENT_DATE + 10, v_user_id, v_user_id);

    -- 4. SWOT
    INSERT INTO public.estrategia_swot (id, tenant_id, empresa_id, titulo, criado_por)
    VALUES (v_swot_id, v_tenant_id, v_empresa_id, 'SWOT Demo', v_user_id);

    INSERT INTO public.estrategia_swot_itens (id, tenant_id, swot_id, tipo, descricao, ordem)
    VALUES (gen_random_uuid(), v_tenant_id, v_swot_id, 'forca', 'Força Demo', 1);

    -- 5. Feed
    INSERT INTO public.feed_posts (id, tenant_id, autor_id, autor_nome, conteudo, tipo)
    VALUES (gen_random_uuid(), v_tenant_id, v_user_id, 'Demo User', 'Olá Mundo!', 'post');

    -- 6. Humor
    INSERT INTO public.humor_diario (id, tenant_id, user_id, user_nome, humor, emoji, data)
    VALUES (gen_random_uuid(), v_tenant_id, v_user_id, 'Demo User', 'Animado', '😊', CURRENT_DATE - 8)
    ON CONFLICT DO NOTHING;

    -- 7. EPI
    INSERT INTO public.epis (id, tenant_id, empresa_id, tipo_id, codigo, ca, marca, modelo, status, quantidade_estoque)
    VALUES (gen_random_uuid(), v_tenant_id, v_empresa_id, v_epi_tipo, 'EPI-T-' || substr(gen_random_uuid()::text, 1, 3), '123', 'Marca', 'Modelo', 'disponivel', 10);

    -- 8. Ouvidoria
    INSERT INTO public.ouvidoria (id, tenant_id, assunto, mensagem, tipo, status, prioridade)
    VALUES (gen_random_uuid(), v_tenant_id, 'Sugestão Demo', 'Mensagem Demo', 'sugestao', 'pendente', 'baixa');

    -- 9. SST
    INSERT INTO public.psicossocial_riscos (id, tenant_id, empresa_id, nome, descricao, severidade, ativo)
    VALUES (gen_random_uuid(), v_tenant_id, v_empresa_id, 'Risco Demo', 'Desc', 2, true);

    INSERT INTO public.ergonomia_riscos (id, tenant_id, empresa_id, titulo, eixo, severidade, probabilidade)
    VALUES (gen_random_uuid(), v_tenant_id, v_empresa_id, 'Risco Ergo Demo', 'fisico', 'medio', 'medio');

    -- 10. PDI
    INSERT INTO public.pdis (id, tenant_id, empresa_id, colaborador_id, colaborador_nome, titulo, status, periodo, data_inicio, data_fim, criado_por)
    VALUES (gen_random_uuid(), v_tenant_id, v_empresa_id, v_user_id::text, 'Demo User', 'PDI Demo', 'ativo', 'semestral', CURRENT_DATE, CURRENT_DATE + 90, v_user_id);

    -- 11. Funções
    INSERT INTO public.funcao_atividades (id, tenant_id, cargo_id, nome, frequencia)
    VALUES (gen_random_uuid(), v_tenant_id, v_cargo_aux, 'Ativ ' || substr(gen_random_uuid()::text, 1, 3), 'diaria');

    INSERT INTO public.funcao_competencias (id, tenant_id, cargo_id, nome, tipo)
    VALUES (gen_random_uuid(), v_tenant_id, v_cargo_aux, 'Comp ' || substr(gen_random_uuid()::text, 1, 3), 'comportamental');

END $$;
