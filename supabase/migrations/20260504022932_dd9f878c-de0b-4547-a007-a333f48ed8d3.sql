DO $$
DECLARE
    v_tenant_id UUID := 'a9b23784-5e5c-4f54-a71c-f1168e02771b';
    v_empresa_id UUID := 'af14ea7c-9955-4174-a077-eebaf8d3211a';
    v_tipo_id UUID;
    v_epi_id UUID;
    v_local_id UUID;
BEGIN
    -- 1. Locais de Estoque
    INSERT INTO public.epi_locais_estoque (tenant_id, nome, ativo)
    VALUES (v_tenant_id, 'Almoxarifado Central', true)
    RETURNING id INTO v_local_id;

    INSERT INTO public.epi_locais_estoque (tenant_id, nome, ativo)
    VALUES (v_tenant_id, 'Unidade Operacional A', true);

    -- 2. Tipo: Proteção da Cabeça
    INSERT INTO public.epi_tipos (tenant_id, nome, categoria, periodicidade_troca_dias)
    VALUES (v_tenant_id, 'Capacete de Segurança V-Gard', 'Proteção da Cabeça', 365)
    RETURNING id INTO v_tipo_id;

    INSERT INTO public.epis (tenant_id, empresa_id, tipo_id, ca, marca, modelo, data_validade, quantidade_estoque, local_estoque_id)
    VALUES (v_tenant_id, v_empresa_id, v_tipo_id, '12345', 'MSA', 'Aba Frontal', (now() + interval '2 years'), 50, v_local_id)
    RETURNING id INTO v_epi_id;

    -- Entregas para este EPI
    INSERT INTO public.epi_entregas (tenant_id, empresa_id, epi_id, colaborador_nome, colaborador_cpf, colaborador_cargo, quantidade, data_entrega, status, motivo_entrega)
    VALUES 
    (v_tenant_id, v_empresa_id, v_epi_id, 'João Silva', '111.111.111-11', 'Operador de Máquinas', 1, (now() - interval '30 days'), 'ativa', 'Admissão'),
    (v_tenant_id, v_empresa_id, v_epi_id, 'Maria Oliveira', '222.222.222-22', 'Ajudante Geral', 1, (now() - interval '15 days'), 'ativa', 'Admissão');

    -- 3. Tipo: Proteção Auditiva
    INSERT INTO public.epi_tipos (tenant_id, nome, categoria, periodicidade_troca_dias)
    VALUES (v_tenant_id, 'Protetor Auditivo Plug', 'Proteção Auditiva', 30)
    RETURNING id INTO v_tipo_id;

    INSERT INTO public.epis (tenant_id, empresa_id, tipo_id, ca, marca, modelo, data_validade, quantidade_estoque, local_estoque_id)
    VALUES (v_tenant_id, v_empresa_id, v_tipo_id, '54321', '3M', '1100', (now() + interval '1 year'), 200, v_local_id)
    RETURNING id INTO v_epi_id;

    -- Entregas para este EPI
    INSERT INTO public.epi_entregas (tenant_id, empresa_id, epi_id, colaborador_nome, colaborador_cpf, colaborador_cargo, quantidade, data_entrega, status, motivo_entrega)
    VALUES 
    (v_tenant_id, v_empresa_id, v_epi_id, 'Carlos Santos', '333.333.333-33', 'Mecânico', 2, (now() - interval '5 days'), 'ativa', 'Substituição'),
    (v_tenant_id, v_empresa_id, v_epi_id, 'Ana Costa', '444.444.444-44', 'Eletricista', 2, (now() - interval '10 days'), 'ativa', 'Admissão');

    -- 4. Movimentações
    INSERT INTO public.epi_movimentacoes (tenant_id, epi_id, quantidade, tipo, motivo, quantidade_anterior, quantidade_atual)
    SELECT v_tenant_id, id, 10, 'entrada', 'Compra via NF 123', 0, 10 FROM public.epis WHERE empresa_id = v_empresa_id LIMIT 2;

END $$;
