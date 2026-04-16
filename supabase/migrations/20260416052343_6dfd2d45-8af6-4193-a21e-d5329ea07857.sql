
-- 1. ONBOARDING TEMPLATES
INSERT INTO onboarding_templates (tenant_id, nome, descricao, ativo, prazo_dias, pontuacao_total, emitir_certificado, conexao_pdi, criado_por_nome)
VALUES
  ('179fcdc7-f8b4-4838-9793-e3749b5b11b1', 'Integração Administrativo', 'Template padrão para colaboradores do setor administrativo', true, 30, 100, true, true, 'Anna'),
  ('179fcdc7-f8b4-4838-9793-e3749b5b11b1', 'Integração Operacional', 'Template para colaboradores do setor operacional com foco em segurança', true, 15, 80, true, false, 'Anna'),
  ('179fcdc7-f8b4-4838-9793-e3749b5b11b1', 'Onboarding Liderança', 'Programa especial para novos líderes e gestores', true, 45, 150, true, true, 'Anna');

-- 2. ONBOARDING ETAPAS
INSERT INTO onboarding_etapas (tenant_id, template_id, titulo, descricao, tipo, ordem, pontuacao, obrigatoria, tempo_estimado_min, ativo)
SELECT '179fcdc7-f8b4-4838-9793-e3749b5b11b1', t.id, e.titulo, e.descricao, e.tipo::onboarding_etapa_tipo, e.ordem, e.pontuacao, e.obrigatoria, e.tempo_estimado_min, true
FROM onboarding_templates t
CROSS JOIN (VALUES
  ('Boas-vindas à Empresa', 'Conheça nossa história e missão', 'apresentacao_institucional', 1, 10, true, 15),
  ('Cultura & Valores', 'Nossos pilares culturais', 'cultura_valores', 2, 15, true, 20),
  ('Mural de Boas-vindas', 'Mensagens da equipe', 'mural_boas_vindas', 3, 10, false, 10),
  ('Checklist de Integração', 'Itens para completar nos primeiros dias', 'checklist_integracao', 4, 20, true, 30),
  ('Quiz de Integração', 'Teste seus conhecimentos', 'quiz', 5, 25, true, 15),
  ('Reflexão Pessoal', 'Compartilhe suas expectativas', 'reflexao', 6, 20, false, 10)
) AS e(titulo, descricao, tipo, ordem, pontuacao, obrigatoria, tempo_estimado_min)
WHERE t.nome = 'Integração Administrativo' AND t.tenant_id = '179fcdc7-f8b4-4838-9793-e3749b5b11b1';

-- 3. ONBOARDING PROCESSOS
DO $$
DECLARE
  v_tenant UUID := '179fcdc7-f8b4-4838-9793-e3749b5b11b1';
  v_template_id UUID;
  v_adm_ids UUID[];
BEGIN
  SELECT id INTO v_template_id FROM onboarding_templates WHERE tenant_id = v_tenant AND nome = 'Integração Administrativo' LIMIT 1;
  SELECT ARRAY(SELECT id FROM admissoes WHERE tenant_id = v_tenant LIMIT 6) INTO v_adm_ids;

  IF array_length(v_adm_ids, 1) >= 6 THEN
    INSERT INTO onboarding_processos (tenant_id, admissao_id, template_id, colaborador_nome, colaborador_cpf, status, progresso, pontos_obtidos, data_inicio, data_conclusao, certificado_emitido)
    VALUES
      (v_tenant, v_adm_ids[1], v_template_id, 'Carlos Eduardo Silva', '12345678900', 'concluido', 100, 95, NOW() - INTERVAL '60 days', NOW() - INTERVAL '30 days', true),
      (v_tenant, v_adm_ids[2], v_template_id, 'Maria Fernanda Oliveira', '23456789001', 'concluido', 100, 88, NOW() - INTERVAL '45 days', NOW() - INTERVAL '20 days', true),
      (v_tenant, v_adm_ids[3], v_template_id, 'João Pedro Santos', '34567890102', 'em_andamento', 65, 52, NOW() - INTERVAL '10 days', NULL, false),
      (v_tenant, v_adm_ids[4], v_template_id, 'Ana Beatriz Costa', '45678901203', 'em_andamento', 40, 30, NOW() - INTERVAL '5 days', NULL, false),
      (v_tenant, v_adm_ids[5], v_template_id, 'Rafael Augusto Lima', '56789012304', 'pendente', 0, 0, NULL, NULL, false),
      (v_tenant, v_adm_ids[6], v_template_id, 'Juliana Martins Rocha', '67890123405', 'pendente', 0, 0, NULL, NULL, false);
  END IF;
END $$;

-- 4. TRILHAS
INSERT INTO trilhas (tenant_id, empresa_id, nome, descricao, objetivo, tipo, prioridade, visibilidade, status, pontuacao_minima, prazo_dias, conexao_pdi, criado_por_nome, total_modulos)
VALUES
  ('179fcdc7-f8b4-4838-9793-e3749b5b11b1', 'f4913bed-d079-41f7-984c-34f55af787f1', 'Segurança do Trabalho — Fundamentos', 'Trilha essencial sobre normas regulamentadoras e práticas seguras', 'Capacitar colaboradores nos fundamentos de SST', 'tecnica', 'obrigatoria', 'publica', 'ativa', 60, 30, false, 'Anna', 5),
  ('179fcdc7-f8b4-4838-9793-e3749b5b11b1', 'f4913bed-d079-41f7-984c-34f55af787f1', 'Liderança e Gestão de Pessoas', 'Habilidades de liderança, feedback e gestão de equipes', 'Formar líderes preparados', 'lideranca', 'recomendada', 'publica', 'ativa', 70, 45, true, 'Anna', 4),
  ('179fcdc7-f8b4-4838-9793-e3749b5b11b1', 'f4913bed-d079-41f7-984c-34f55af787f1', 'Cultura Organizacional & Engajamento', 'Conheça e viva a cultura da empresa', 'Fortalecer o alinhamento cultural', 'cultura', 'recomendada', 'publica', 'ativa', 50, 20, false, 'Anna', 3),
  ('179fcdc7-f8b4-4838-9793-e3749b5b11b1', 'f4913bed-d079-41f7-984c-34f55af787f1', 'Ergonomia e Saúde no Trabalho', 'Práticas ergonômicas e promoção da saúde ocupacional', 'Reduzir riscos ergonômicos', 'ergonomia_saude', 'obrigatoria', 'publica', 'ativa', 60, 15, false, 'Anna', 4),
  ('179fcdc7-f8b4-4838-9793-e3749b5b11b1', 'f4913bed-d079-41f7-984c-34f55af787f1', 'Processos Internos e Compliance', 'Processos internos e requisitos de conformidade', 'Garantir conformidade regulatória', 'processos', 'obrigatoria', 'restrita', 'ativa', 70, 30, false, 'Anna', 3);

-- 5. MÓDULOS
DO $$
DECLARE
  v_tenant UUID := '179fcdc7-f8b4-4838-9793-e3749b5b11b1';
  v_trilha RECORD;
BEGIN
  FOR v_trilha IN SELECT id FROM trilhas WHERE tenant_id = v_tenant AND nome LIKE 'Segurança do Trabalho%' LIMIT 1
  LOOP
    INSERT INTO trilha_modulos (tenant_id, trilha_id, titulo, descricao, tipo, tempo_estimado_min, pontuacao, ordem, ativo) VALUES
      (v_tenant, v_trilha.id, 'Introdução às NRs', 'Visão geral das Normas Regulamentadoras', 'conteudo_interno', 20, 15, 1, true),
      (v_tenant, v_trilha.id, 'NR-1: Disposições Gerais e GRO', 'Gerenciamento de Riscos Ocupacionais', 'video', 30, 20, 2, true),
      (v_tenant, v_trilha.id, 'NR-6: EPIs na Prática', 'Uso correto de Equipamentos de Proteção', 'video', 25, 20, 3, true),
      (v_tenant, v_trilha.id, 'Estudo de Caso: Prevenção', 'Análise de casos reais', 'estudo_caso', 30, 25, 4, true),
      (v_tenant, v_trilha.id, 'Quiz — Segurança', 'Avalie seus conhecimentos', 'quiz', 15, 20, 5, true);
  END LOOP;

  FOR v_trilha IN SELECT id FROM trilhas WHERE tenant_id = v_tenant AND nome LIKE 'Liderança%' LIMIT 1
  LOOP
    INSERT INTO trilha_modulos (tenant_id, trilha_id, titulo, descricao, tipo, tempo_estimado_min, pontuacao, ordem, ativo) VALUES
      (v_tenant, v_trilha.id, 'Estilos de Liderança', 'Principais estilos e quando aplicar', 'conteudo_interno', 25, 20, 1, true),
      (v_tenant, v_trilha.id, 'Feedback Eficaz', 'Técnicas para dar e receber feedback', 'video', 20, 25, 2, true),
      (v_tenant, v_trilha.id, 'Gestão de Conflitos', 'Mediar e resolver conflitos', 'reflexao', 30, 25, 3, true),
      (v_tenant, v_trilha.id, 'Microdesafio: Plano de Ação', 'Crie um plano para sua equipe', 'microdesafio', 45, 30, 4, true);
  END LOOP;

  FOR v_trilha IN SELECT id FROM trilhas WHERE tenant_id = v_tenant AND nome LIKE 'Cultura%' LIMIT 1
  LOOP
    INSERT INTO trilha_modulos (tenant_id, trilha_id, titulo, descricao, tipo, tempo_estimado_min, pontuacao, ordem, ativo) VALUES
      (v_tenant, v_trilha.id, 'Nossa Missão e Valores', 'O DNA da organização', 'conteudo_interno', 15, 20, 1, true),
      (v_tenant, v_trilha.id, 'Cultura no Dia a Dia', 'Exemplos práticos', 'video', 20, 20, 2, true),
      (v_tenant, v_trilha.id, 'Reflexão: Meu Papel', 'Como você contribui', 'reflexao', 20, 25, 3, true);
  END LOOP;

  FOR v_trilha IN SELECT id FROM trilhas WHERE tenant_id = v_tenant AND nome LIKE 'Ergonomia%' LIMIT 1
  LOOP
    INSERT INTO trilha_modulos (tenant_id, trilha_id, titulo, descricao, tipo, tempo_estimado_min, pontuacao, ordem, ativo) VALUES
      (v_tenant, v_trilha.id, 'Fundamentos de Ergonomia', 'Conceitos básicos', 'conteudo_interno', 20, 15, 1, true),
      (v_tenant, v_trilha.id, 'Postura e Posto de Trabalho', 'Ajustes ergonômicos', 'video', 25, 20, 2, true),
      (v_tenant, v_trilha.id, 'Ginástica Laboral', 'Exercícios para o dia a dia', 'atividade_pratica', 15, 20, 3, true),
      (v_tenant, v_trilha.id, 'Checklist Ergonômico', 'Avalie seu posto', 'checklist', 20, 25, 4, true);
  END LOOP;

  FOR v_trilha IN SELECT id FROM trilhas WHERE tenant_id = v_tenant AND nome LIKE 'Processos%' LIMIT 1
  LOOP
    INSERT INTO trilha_modulos (tenant_id, trilha_id, titulo, descricao, tipo, tempo_estimado_min, pontuacao, ordem, ativo) VALUES
      (v_tenant, v_trilha.id, 'Políticas Internas', 'Conheça as políticas', 'pdf', 20, 20, 1, true),
      (v_tenant, v_trilha.id, 'LGPD e Proteção de Dados', 'Responsabilidades', 'conteudo_interno', 25, 30, 2, true),
      (v_tenant, v_trilha.id, 'Quiz — Compliance', 'Teste de conformidade', 'quiz', 15, 25, 3, true);
  END LOOP;
END $$;

-- 6. PROGRESSO DO USUÁRIO (Anna / 18603342-a643-4ef9-9e85-d111bbe0592b)
DO $$
DECLARE
  v_tenant UUID := '179fcdc7-f8b4-4838-9793-e3749b5b11b1';
  v_user_id TEXT := '18603342-a643-4ef9-9e85-d111bbe0592b';
  v_user_name TEXT := 'Anna';
  v_trilha RECORD;
  v_modulo RECORD;
  v_count INT := 0;
BEGIN
  -- Segurança: 100% concluída
  FOR v_trilha IN SELECT id FROM trilhas WHERE tenant_id = v_tenant AND nome LIKE 'Segurança do Trabalho%' LIMIT 1
  LOOP
    FOR v_modulo IN SELECT id, pontuacao FROM trilha_modulos WHERE trilha_id = v_trilha.id AND ativo = true ORDER BY ordem
    LOOP
      INSERT INTO trilha_progresso (tenant_id, trilha_id, modulo_id, colaborador_id, colaborador_nome, status, data_inicio, data_conclusao, pontos_obtidos)
      VALUES (v_tenant, v_trilha.id, v_modulo.id, v_user_id, v_user_name, 'concluido', NOW() - INTERVAL '25 days', NOW() - INTERVAL '20 days', v_modulo.pontuacao);
    END LOOP;
  END LOOP;

  -- Liderança: 50% (2 de 4)
  FOR v_trilha IN SELECT id FROM trilhas WHERE tenant_id = v_tenant AND nome LIKE 'Liderança%' LIMIT 1
  LOOP
    v_count := 0;
    FOR v_modulo IN SELECT id, pontuacao FROM trilha_modulos WHERE trilha_id = v_trilha.id AND ativo = true ORDER BY ordem
    LOOP
      v_count := v_count + 1;
      IF v_count <= 2 THEN
        INSERT INTO trilha_progresso (tenant_id, trilha_id, modulo_id, colaborador_id, colaborador_nome, status, data_inicio, data_conclusao, pontos_obtidos)
        VALUES (v_tenant, v_trilha.id, v_modulo.id, v_user_id, v_user_name, 'concluido', NOW() - INTERVAL '10 days', NOW() - INTERVAL '7 days', v_modulo.pontuacao);
      ELSIF v_count = 3 THEN
        INSERT INTO trilha_progresso (tenant_id, trilha_id, modulo_id, colaborador_id, colaborador_nome, status, data_inicio, pontos_obtidos)
        VALUES (v_tenant, v_trilha.id, v_modulo.id, v_user_id, v_user_name, 'em_andamento', NOW() - INTERVAL '2 days', 0);
      END IF;
    END LOOP;
  END LOOP;

  -- Cultura: 33% (1 de 3)
  FOR v_trilha IN SELECT id FROM trilhas WHERE tenant_id = v_tenant AND nome LIKE 'Cultura%' LIMIT 1
  LOOP
    v_count := 0;
    FOR v_modulo IN SELECT id, pontuacao FROM trilha_modulos WHERE trilha_id = v_trilha.id AND ativo = true ORDER BY ordem
    LOOP
      v_count := v_count + 1;
      IF v_count = 1 THEN
        INSERT INTO trilha_progresso (tenant_id, trilha_id, modulo_id, colaborador_id, colaborador_nome, status, data_inicio, data_conclusao, pontos_obtidos)
        VALUES (v_tenant, v_trilha.id, v_modulo.id, v_user_id, v_user_name, 'concluido', NOW() - INTERVAL '5 days', NOW() - INTERVAL '4 days', v_modulo.pontuacao);
      END IF;
    END LOOP;
  END LOOP;

  -- Ergonomia: 75% (3 de 4)
  FOR v_trilha IN SELECT id FROM trilhas WHERE tenant_id = v_tenant AND nome LIKE 'Ergonomia%' LIMIT 1
  LOOP
    v_count := 0;
    FOR v_modulo IN SELECT id, pontuacao FROM trilha_modulos WHERE trilha_id = v_trilha.id AND ativo = true ORDER BY ordem
    LOOP
      v_count := v_count + 1;
      IF v_count <= 3 THEN
        INSERT INTO trilha_progresso (tenant_id, trilha_id, modulo_id, colaborador_id, colaborador_nome, status, data_inicio, data_conclusao, pontos_obtidos)
        VALUES (v_tenant, v_trilha.id, v_modulo.id, v_user_id, v_user_name, 'concluido', NOW() - INTERVAL '15 days', NOW() - INTERVAL '12 days', v_modulo.pontuacao);
      END IF;
    END LOOP;
  END LOOP;
END $$;
