
-- Fix all FK constraints referencing auth.users that don't have CASCADE/SET NULL
-- This prevents "violates foreign key constraint" errors when deleting users

-- admissoes.criado_por
ALTER TABLE public.admissoes DROP CONSTRAINT admissoes_criado_por_fkey;
ALTER TABLE public.admissoes ADD CONSTRAINT admissoes_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES auth.users(id) ON DELETE SET NULL;

-- admissao_documentos.aprovado_por
ALTER TABLE public.admissao_documentos DROP CONSTRAINT admissao_documentos_aprovado_por_fkey;
ALTER TABLE public.admissao_documentos ADD CONSTRAINT admissao_documentos_aprovado_por_fkey FOREIGN KEY (aprovado_por) REFERENCES auth.users(id) ON DELETE SET NULL;

-- admissao_historico.usuario_id
ALTER TABLE public.admissao_historico DROP CONSTRAINT admissao_historico_usuario_id_fkey;
ALTER TABLE public.admissao_historico ADD CONSTRAINT admissao_historico_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- admissao_workflow.responsavel_id
ALTER TABLE public.admissao_workflow DROP CONSTRAINT admissao_workflow_responsavel_id_fkey;
ALTER TABLE public.admissao_workflow ADD CONSTRAINT admissao_workflow_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- marketplace_avaliacoes.avaliador_id
ALTER TABLE public.marketplace_avaliacoes DROP CONSTRAINT marketplace_avaliacoes_avaliador_id_fkey;
ALTER TABLE public.marketplace_avaliacoes ADD CONSTRAINT marketplace_avaliacoes_avaliador_id_fkey FOREIGN KEY (avaliador_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- marketplace_contratacoes.solicitante_id
ALTER TABLE public.marketplace_contratacoes DROP CONSTRAINT marketplace_contratacoes_solicitante_id_fkey;
ALTER TABLE public.marketplace_contratacoes ADD CONSTRAINT marketplace_contratacoes_solicitante_id_fkey FOREIGN KEY (solicitante_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- plano_acoes.criado_por
ALTER TABLE public.plano_acoes DROP CONSTRAINT plano_acoes_criado_por_fkey;
ALTER TABLE public.plano_acoes ADD CONSTRAINT plano_acoes_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES auth.users(id) ON DELETE SET NULL;

-- plano_acoes.responsavel_id
ALTER TABLE public.plano_acoes DROP CONSTRAINT plano_acoes_responsavel_id_fkey;
ALTER TABLE public.plano_acoes ADD CONSTRAINT plano_acoes_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- plano_comentarios.autor_id
ALTER TABLE public.plano_comentarios DROP CONSTRAINT plano_comentarios_autor_id_fkey;
ALTER TABLE public.plano_comentarios ADD CONSTRAINT plano_comentarios_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- plano_evidencias.enviado_por
ALTER TABLE public.plano_evidencias DROP CONSTRAINT plano_evidencias_enviado_por_fkey;
ALTER TABLE public.plano_evidencias ADD CONSTRAINT plano_evidencias_enviado_por_fkey FOREIGN KEY (enviado_por) REFERENCES auth.users(id) ON DELETE SET NULL;

-- plano_historico.usuario_id
ALTER TABLE public.plano_historico DROP CONSTRAINT plano_historico_usuario_id_fkey;
ALTER TABLE public.plano_historico ADD CONSTRAINT plano_historico_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- plano_participantes.usuario_id
ALTER TABLE public.plano_participantes DROP CONSTRAINT plano_participantes_usuario_id_fkey;
ALTER TABLE public.plano_participantes ADD CONSTRAINT plano_participantes_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- plano_tarefas.responsavel_id
ALTER TABLE public.plano_tarefas DROP CONSTRAINT plano_tarefas_responsavel_id_fkey;
ALTER TABLE public.plano_tarefas ADD CONSTRAINT plano_tarefas_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- plano_tarefas.concluida_por
ALTER TABLE public.plano_tarefas DROP CONSTRAINT plano_tarefas_concluida_por_fkey;
ALTER TABLE public.plano_tarefas ADD CONSTRAINT plano_tarefas_concluida_por_fkey FOREIGN KEY (concluida_por) REFERENCES auth.users(id) ON DELETE SET NULL;

-- plano_templates.criado_por
ALTER TABLE public.plano_templates DROP CONSTRAINT plano_templates_criado_por_fkey;
ALTER TABLE public.plano_templates ADD CONSTRAINT plano_templates_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES auth.users(id) ON DELETE SET NULL;

-- plano_tempo.usuario_id
ALTER TABLE public.plano_tempo DROP CONSTRAINT plano_tempo_usuario_id_fkey;
ALTER TABLE public.plano_tempo ADD CONSTRAINT plano_tempo_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ponto_ajustes.created_by
ALTER TABLE public.ponto_ajustes DROP CONSTRAINT ponto_ajustes_created_by_fkey;
ALTER TABLE public.ponto_ajustes ADD CONSTRAINT ponto_ajustes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ponto_marcacoes.created_by
ALTER TABLE public.ponto_marcacoes DROP CONSTRAINT ponto_marcacoes_created_by_fkey;
ALTER TABLE public.ponto_marcacoes ADD CONSTRAINT ponto_marcacoes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
