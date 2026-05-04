-- Definir variáveis para o usuário e empresa específicos
DO $$
DECLARE
    target_tenant_id UUID := 'a9b23784-5e5c-4f54-a71c-f1168e02771b';
    target_empresa_id UUID := 'af14ea7c-9955-4174-a077-eebaf8d3211a';
    target_user_id UUID := '36a42880-e41e-40d9-8856-2c64d700e838';
    target_user_nome TEXT := 'TESTE EM 02 DE MAIO';
    pasta_rh_id UUID := gen_random_uuid();
    pasta_fin_id UUID := gen_random_uuid();
    pasta_cont_id UUID := gen_random_uuid();
    doc_id_1 UUID := gen_random_uuid();
    doc_id_2 UUID := gen_random_uuid();
    doc_id_3 UUID := gen_random_uuid();
    doc_id_4 UUID := gen_random_uuid();
BEGIN
    -- Criar pastas de exemplo
    INSERT INTO public.documento_pastas (id, tenant_id, empresa_id, nome, tipo, criado_por)
    VALUES 
        (pasta_rh_id, target_tenant_id, target_empresa_id, 'Recursos Humanos', 'categoria', target_user_id),
        (pasta_fin_id, target_tenant_id, target_empresa_id, 'Financeiro', 'categoria', target_user_id),
        (pasta_cont_id, target_tenant_id, target_empresa_id, 'Contratos', 'categoria', target_user_id);

    -- Inserir Documentos Fictícios
    INSERT INTO public.documentos (id, tenant_id, empresa_id, nome_arquivo, nome_original, tipo, status, pasta_id, criado_por, criado_por_nome, created_at, colaborador_nome, tamanho, mime_type, storage_path)
    VALUES 
        (doc_id_1, target_tenant_id, target_empresa_id, 'contrato_trabalho.pdf', 'Contrato de Trabalho.pdf', 'PDF', 'ativo', pasta_rh_id, target_user_id, target_user_nome, now() - interval '20 days', 'João da Silva', 102456, 'application/pdf', 'docs/contrato.pdf'),
        (doc_id_2, target_tenant_id, target_empresa_id, 'holerite_abril.pdf', 'Holerite Abril 2024.pdf', 'PDF', 'ativo', pasta_fin_id, target_user_id, target_user_nome, now() - interval '15 days', 'Maria Oliveira', 56789, 'application/pdf', 'docs/holerite.pdf'),
        (doc_id_3, target_tenant_id, target_empresa_id, 'documento_identidade.jpg', 'RG_FRENTE.jpg', 'JPG', 'ativo', pasta_rh_id, target_user_id, target_user_nome, now() - interval '10 days', 'João da Silva', 890123, 'image/jpeg', 'docs/rg.jpg'),
        (doc_id_4, target_tenant_id, target_empresa_id, 'projeto_ti_v1.docx', 'Projeto Implementação Cloud.docx', 'DOCX', 'ativo', pasta_cont_id, target_user_id, target_user_nome, now() - interval '5 days', 'Empresa Externa', 456789, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docs/projeto.docx');

    -- Inserir logs de auditoria (Trilha de Auditoria)
    INSERT INTO public.documento_audit_log (tenant_id, documento_id, documento_nome, acao, usuario_id, usuario_nome, created_at)
    VALUES 
        (target_tenant_id, doc_id_1, 'Contrato de Trabalho.pdf', 'upload', target_user_id, target_user_nome, now() - interval '20 days'),
        (target_tenant_id, doc_id_2, 'Holerite Abril 2024.pdf', 'upload', target_user_id, target_user_nome, now() - interval '15 days'),
        (target_tenant_id, doc_id_1, 'Contrato de Trabalho.pdf', 'move', target_user_id, target_user_nome, now() - interval '12 days'),
        (target_tenant_id, doc_id_3, 'RG_FRENTE.jpg', 'upload', target_user_id, target_user_nome, now() - interval '10 days'),
        (target_tenant_id, doc_id_4, 'Projeto Implementação Cloud.docx', 'upload', target_user_id, target_user_nome, now() - interval '5 days'),
        (target_tenant_id, doc_id_4, 'Projeto Implementação Cloud.docx', 'rename', target_user_id, target_user_nome, now() - interval '2 days');

    -- Simular algumas movimentações de pasta no log
    UPDATE public.documento_audit_log 
    SET pasta_origem_nome = 'Geral', pasta_destino_nome = 'Recursos Humanos'
    WHERE documento_id = doc_id_1 AND acao = 'move';

END $$;
