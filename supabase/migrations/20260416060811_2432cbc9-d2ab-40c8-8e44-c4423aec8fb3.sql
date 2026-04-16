
INSERT INTO public.audit_logs (tenant_id, user_id, user_name, user_email, action, module, description, target_type, target_name, metadata, created_at) VALUES
-- Equipe
('179fcdc7-f8b4-4838-9793-e3749b5b11b1', '18603342-a643-4ef9-9e85-d111bbe0592b', 'Anna', 'lucassaro07@hotmail.com', 'user.created', 'equipe', 'Colaborador João Silva adicionado à equipe', 'colaborador', 'João Silva', '{"cargo": "Analista de RH"}', now() - interval '12 hours'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1', '18603342-a643-4ef9-9e85-d111bbe0592b', 'Anna', 'lucassaro07@hotmail.com', 'user.invited', 'equipe', 'Convite enviado para maria.santos@empresa.com', 'colaborador', 'Maria Santos', '{"email": "maria.santos@empresa.com"}', now() - interval '10 hours'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1', '18603342-a643-4ef9-9e85-d111bbe0592b', 'Anna', 'lucassaro07@hotmail.com', 'user.role_updated', 'equipe', 'Perfil de acesso de Carlos Oliveira alterado para Gestor', 'colaborador', 'Carlos Oliveira', '{"role_anterior": "colaborador", "role_novo": "gestor"}', now() - interval '8 hours'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1', '18603342-a643-4ef9-9e85-d111bbe0592b', 'Anna', 'lucassaro07@hotmail.com', 'user.removed', 'equipe', 'Colaborador Pedro Almeida removido da equipe', 'colaborador', 'Pedro Almeida', '{"motivo": "Desligamento"}', now() - interval '6 hours'),
-- Admissões
('179fcdc7-f8b4-4838-9793-e3749b5b11b1', '18603342-a643-4ef9-9e85-d111bbe0592b', 'Anna', 'lucassaro07@hotmail.com', 'admissao.created', 'admissoes', 'Nova admissão criada para Ana Beatriz Costa', 'admissao', 'Ana Beatriz Costa', '{"cargo": "Engenheira de Segurança"}', now() - interval '5 days'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1', '18603342-a643-4ef9-9e85-d111bbe0592b', 'Anna', 'lucassaro07@hotmail.com', 'admissao.status_updated', 'admissoes', 'Status da admissão de Rafael Mendes atualizado para Documentação Pendente', 'admissao', 'Rafael Mendes', '{"status_anterior": "aguardando_documentos", "status_novo": "documentacao_pendente"}', now() - interval '4 days'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1', '18603342-a643-4ef9-9e85-d111bbe0592b', 'Anna', 'lucassaro07@hotmail.com', 'admissao.completed', 'admissoes', 'Admissão de Fernanda Lima concluída com sucesso', 'admissao', 'Fernanda Lima', '{"data_admissao": "2026-04-01"}', now() - interval '3 days'),
-- Atestados
('179fcdc7-f8b4-4838-9793-e3749b5b11b1', '18603342-a643-4ef9-9e85-d111bbe0592b', 'Anna', 'lucassaro07@hotmail.com', 'atestado.uploaded', 'atestados', 'Atestado médico registrado para Lucas Ferreira — 3 dias', 'atestado', 'Lucas Ferreira', '{"dias": 3, "grupo_clinico": "Osteomuscular"}', now() - interval '2 days'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1', '18603342-a643-4ef9-9e85-d111bbe0592b', 'Anna', 'lucassaro07@hotmail.com', 'atestado.approved', 'atestados', 'Atestado de Mariana Souza validado pelo gestor', 'atestado', 'Mariana Souza', '{"dias": 1}', now() - interval '1 day'),
-- Configurações
('179fcdc7-f8b4-4838-9793-e3749b5b11b1', '18603342-a643-4ef9-9e85-d111bbe0592b', 'Anna', 'lucassaro07@hotmail.com', 'config.updated', 'configuracoes', 'Configurações de notificação por e-mail atualizadas', 'configuracao', 'Notificações', '{"tipo": "email"}', now() - interval '7 days'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1', '18603342-a643-4ef9-9e85-d111bbe0592b', 'Anna', 'lucassaro07@hotmail.com', 'config.updated', 'configuracoes', 'Logo da empresa atualizada', 'configuracao', 'Branding', '{"campo": "logo"}', now() - interval '9 days'),
-- Ponto
('179fcdc7-f8b4-4838-9793-e3749b5b11b1', '18603342-a643-4ef9-9e85-d111bbe0592b', 'Anna', 'lucassaro07@hotmail.com', 'ponto.ajuste', 'ponto', 'Ajuste de ponto aprovado para Roberto Dias — 14/04/2026', 'registro_ponto', 'Roberto Dias', '{"data": "2026-04-14", "tipo": "entrada"}', now() - interval '1 day 3 hours'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1', '18603342-a643-4ef9-9e85-d111bbe0592b', 'Anna', 'lucassaro07@hotmail.com', 'ponto.fechamento', 'ponto', 'Fechamento de ponto do mês 03/2026 realizado', 'registro_ponto', 'Março 2026', '{"mes": 3, "ano": 2026}', now() - interval '15 days'),
-- Férias
('179fcdc7-f8b4-4838-9793-e3749b5b11b1', '18603342-a643-4ef9-9e85-d111bbe0592b', 'Anna', 'lucassaro07@hotmail.com', 'ferias.solicitada', 'ferias', 'Solicitação de férias registrada para Camila Rocha — 01/05 a 30/05/2026', 'ferias', 'Camila Rocha', '{"inicio": "2026-05-01", "fim": "2026-05-30"}', now() - interval '3 days 2 hours'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1', '18603342-a643-4ef9-9e85-d111bbe0592b', 'Anna', 'lucassaro07@hotmail.com', 'ferias.aprovada', 'ferias', 'Férias de Thiago Barbosa aprovadas pelo gestor', 'ferias', 'Thiago Barbosa', '{"inicio": "2026-06-01", "fim": "2026-06-15"}', now() - interval '2 days 5 hours'),
-- SST
('179fcdc7-f8b4-4838-9793-e3749b5b11b1', '18603342-a643-4ef9-9e85-d111bbe0592b', 'Anna', 'lucassaro07@hotmail.com', 'sst.documento_importado', 'sst', 'PGR importado e validado pela IA', 'documento_sst', 'PGR 2026', '{"tipo": "PGR", "paginas": 45}', now() - interval '6 days'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1', '18603342-a643-4ef9-9e85-d111bbe0592b', 'Anna', 'lucassaro07@hotmail.com', 'sst.risco_cadastrado', 'sst', 'Risco ergonômico cadastrado para Setor Administrativo', 'risco', 'Postura inadequada', '{"nivel": "moderado", "setor": "Administrativo"}', now() - interval '4 days 6 hours'),
-- Trilhas
('179fcdc7-f8b4-4838-9793-e3749b5b11b1', '18603342-a643-4ef9-9e85-d111bbe0592b', 'Anna', 'lucassaro07@hotmail.com', 'trilha.concluida', 'trilhas', 'Trilha "Segurança no Trabalho" concluída com certificado emitido', 'trilha', 'Segurança no Trabalho', '{"progresso": 100}', now() - interval '1 day 8 hours'),
-- Avaliações
('179fcdc7-f8b4-4838-9793-e3749b5b11b1', '18603342-a643-4ef9-9e85-d111bbe0592b', 'Anna', 'lucassaro07@hotmail.com', 'avaliacao.respondida', 'avaliacoes', 'Autoavaliação do ciclo Q1-2026 respondida', 'avaliacao', 'Ciclo Q1-2026', '{"tipo": "autoavaliacao"}', now() - interval '8 days'),
-- Benefícios
('179fcdc7-f8b4-4838-9793-e3749b5b11b1', '18603342-a643-4ef9-9e85-d111bbe0592b', 'Anna', 'lucassaro07@hotmail.com', 'beneficio.atualizado', 'beneficios', 'Plano de saúde atualizado para inclusão de dependente', 'beneficio', 'Plano de Saúde', '{"operacao": "inclusao_dependente"}', now() - interval '5 days 4 hours');
