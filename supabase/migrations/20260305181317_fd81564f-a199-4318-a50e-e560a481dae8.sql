-- Reset completo de usuários (mantendo dados de negócio)
BEGIN;

-- 1) Limpa referências opcionais a auth.users
UPDATE public.admissao_documentos SET aprovado_por = NULL WHERE aprovado_por IS NOT NULL;
UPDATE public.admissao_historico SET usuario_id = NULL WHERE usuario_id IS NOT NULL;
UPDATE public.admissao_workflow SET responsavel_id = NULL WHERE responsavel_id IS NOT NULL;
UPDATE public.admissoes SET criado_por = NULL WHERE criado_por IS NOT NULL;
UPDATE public.marketplace_avaliacoes SET avaliador_id = NULL WHERE avaliador_id IS NOT NULL;
UPDATE public.marketplace_contratacoes SET solicitante_id = NULL WHERE solicitante_id IS NOT NULL;
UPDATE public.marketplace_profissionais SET user_id = NULL WHERE user_id IS NOT NULL;
UPDATE public.plano_acoes SET criado_por = NULL WHERE criado_por IS NOT NULL;
UPDATE public.plano_acoes SET responsavel_id = NULL WHERE responsavel_id IS NOT NULL;
UPDATE public.plano_evidencias SET enviado_por = NULL WHERE enviado_por IS NOT NULL;
UPDATE public.plano_historico SET usuario_id = NULL WHERE usuario_id IS NOT NULL;
UPDATE public.plano_tarefas SET concluida_por = NULL WHERE concluida_por IS NOT NULL;
UPDATE public.plano_tarefas SET responsavel_id = NULL WHERE responsavel_id IS NOT NULL;
UPDATE public.plano_templates SET criado_por = NULL WHERE criado_por IS NOT NULL;
UPDATE public.ponto_ajustes SET created_by = NULL WHERE created_by IS NOT NULL;
UPDATE public.ponto_marcacoes SET created_by = NULL WHERE created_by IS NOT NULL;
UPDATE public.system_manual SET updated_by = NULL WHERE updated_by IS NOT NULL;

-- 2) Limpa referências obrigatórias a auth.users
DELETE FROM public.plano_comentarios WHERE autor_id IS NOT NULL;
DELETE FROM public.plano_participantes WHERE usuario_id IS NOT NULL;
DELETE FROM public.plano_tempo WHERE usuario_id IS NOT NULL;

-- 3) Limpa tabelas diretamente ligadas ao usuário
DELETE FROM public.user_roles;
DELETE FROM public.superadmins;
DELETE FROM public.profiles;

-- 4) Remove todos os usuários de autenticação
DELETE FROM auth.users;

COMMIT;