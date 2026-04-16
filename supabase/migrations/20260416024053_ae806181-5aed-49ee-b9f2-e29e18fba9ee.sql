
DO $$
DECLARE
  v_tenant uuid := '179fcdc7-f8b4-4838-9793-e3749b5b11b1';
  v_camp1 uuid := gen_random_uuid();
  v_camp2 uuid := gen_random_uuid();
  v_camp3 uuid := gen_random_uuid();
  v_camp4 uuid := gen_random_uuid();
  v_camp5 uuid := gen_random_uuid();
  v_names text[] := ARRAY['Carlos Oliveira','Maria Santos','João Pereira','Ana Costa','Pedro Lima','Fernanda Silva','Ricardo Souza','Juliana Almeida'];
  v_setores text[] := ARRAY['Operações','Administrativo','Logística','Manutenção','RH','Segurança','Produção','Qualidade'];
  v_cargos text[] := ARRAY['Operador','Analista','Técnico','Supervisor','Auxiliar','Engenheiro','Coordenador','Assistente'];
  i int;
BEGIN

  INSERT INTO questionario_psicossocial_campanhas (id, tenant_id, nome, descricao, status, data_inicio, data_fim, instrumento, tipo, escopo, total_respostas, ips_score, ips_classificacao, irps_score, ibo_score, ibd_score, token_publico, criado_por_nome, radar_data)
  VALUES (v_camp1, v_tenant, 'Avaliação Psicossocial Q1/2026', 'Campanha trimestral de monitoramento do clima organizacional - 1º trimestre', 'encerrada', '2026-01-05', '2026-01-31', 'sipro', 'regular', 'empresa', 42, 72.5, 'estavel', 27.5, 31.2, 18.7, 'tk_' || substr(md5(random()::text), 1, 12), 'Anna', 
    '[{"dimensao":"Demandas de Trabalho","score":65,"tipo":"risco"},{"dimensao":"Controle sobre o Trabalho","score":78,"tipo":"protetor"},{"dimensao":"Apoio Social","score":82,"tipo":"protetor"},{"dimensao":"Relacionamentos","score":71,"tipo":"protetor"},{"dimensao":"Papel na Organização","score":68,"tipo":"risco"},{"dimensao":"Mudanças Organizacionais","score":58,"tipo":"risco"},{"dimensao":"Reconhecimento","score":75,"tipo":"protetor"},{"dimensao":"Equilíbrio Trabalho-Vida","score":62,"tipo":"risco"}]'::jsonb);

  INSERT INTO questionario_psicossocial_campanhas (id, tenant_id, nome, descricao, status, data_inicio, data_fim, instrumento, tipo, escopo, total_respostas, ips_score, ips_classificacao, irps_score, ibo_score, ibd_score, token_publico, criado_por_nome, radar_data)
  VALUES (v_camp2, v_tenant, 'Diagnóstico Psicossocial Anual 2025', 'Avaliação anual completa com instrumento COPSOQ III', 'encerrada', '2025-10-01', '2025-10-31', 'copsoq', 'regular', 'empresa', 38, 64.3, 'atencao', 35.7, 42.1, 22.4, 'tk_' || substr(md5(random()::text), 1, 12), 'Anna',
    '[{"dimensao":"Exigências Quantitativas","score":52},{"dimensao":"Ritmo de Trabalho","score":48},{"dimensao":"Exigências Emocionais","score":55},{"dimensao":"Influência no Trabalho","score":72},{"dimensao":"Possibilidades de Desenvolvimento","score":78},{"dimensao":"Significado do Trabalho","score":85},{"dimensao":"Previsibilidade","score":58},{"dimensao":"Reconhecimento","score":63},{"dimensao":"Apoio Social de Colegas","score":71},{"dimensao":"Apoio Social de Superiores","score":66},{"dimensao":"Qualidade da Liderança","score":62},{"dimensao":"Confiança Vertical","score":59},{"dimensao":"Justiça e Respeito","score":57},{"dimensao":"Conflito Trabalho-Família","score":45},{"dimensao":"Satisfação no Trabalho","score":70},{"dimensao":"Burnout","score":41},{"dimensao":"Stress","score":44}]'::jsonb);

  INSERT INTO questionario_psicossocial_campanhas (id, tenant_id, nome, descricao, status, data_inicio, data_fim, instrumento, tipo, escopo, total_respostas, ips_score, ips_classificacao, irps_score, ibo_score, ibd_score, token_publico, criado_por_nome, radar_data)
  VALUES (v_camp3, v_tenant, 'Pesquisa Clima Organizacional Jul/2025', 'Avaliação pós-reestruturação organizacional com HSE-IT', 'encerrada', '2025-07-01', '2025-07-20', 'hse', 'extraordinaria', 'empresa', 35, 56.8, 'atencao', 43.2, 48.5, 29.1, 'tk_' || substr(md5(random()::text), 1, 12), 'Anna',
    '[{"dimensao":"Demandas","score":45},{"dimensao":"Controle","score":62},{"dimensao":"Apoio Gerencial","score":58},{"dimensao":"Apoio de Colegas","score":72},{"dimensao":"Relacionamentos","score":65},{"dimensao":"Papel","score":54},{"dimensao":"Mudanças","score":42}]'::jsonb);

  INSERT INTO questionario_psicossocial_campanhas (id, tenant_id, nome, descricao, status, data_inicio, data_fim, instrumento, tipo, escopo, total_respostas, ips_score, ips_classificacao, irps_score, token_publico, criado_por_nome, radar_data)
  VALUES (v_camp4, v_tenant, 'Avaliação Psicossocial Q2/2026', 'Campanha trimestral em andamento - 2º trimestre 2026', 'ativa', '2026-04-01', '2026-04-30', 'sipro', 'regular', 'empresa', 18, 69.1, 'estavel', 30.9, 'tk_' || substr(md5(random()::text), 1, 12), 'Anna',
    '[{"dimensao":"Demandas de Trabalho","score":62},{"dimensao":"Controle sobre o Trabalho","score":74},{"dimensao":"Apoio Social","score":79},{"dimensao":"Relacionamentos","score":68},{"dimensao":"Papel na Organização","score":65},{"dimensao":"Mudanças Organizacionais","score":55},{"dimensao":"Reconhecimento","score":72},{"dimensao":"Equilíbrio Trabalho-Vida","score":60}]'::jsonb);

  INSERT INTO questionario_psicossocial_campanhas (id, tenant_id, nome, descricao, status, data_inicio, data_fim, instrumento, tipo, escopo, token_publico, criado_por_nome)
  VALUES (v_camp5, v_tenant, 'Avaliação Extraordinária - Setor Produção', 'Avaliação direcionada após incidente no setor de produção', 'rascunho', '2026-05-01', '2026-05-15', 'sipro', 'extraordinaria', 'setor', 'tk_' || substr(md5(random()::text), 1, 12), 'Anna');

  -- Participações
  FOR i IN 1..8 LOOP
    INSERT INTO psicossocial_participacoes (tenant_id, campanha_id, token, colaborador_nome, setor, cargo, elegivel, respondido, respondido_em, enviado_via, enviado_em)
    VALUES (v_tenant, v_camp1, 'p1_' || i || '_' || substr(md5(random()::text),1,6), v_names[i], v_setores[i], v_cargos[i], true, true, '2026-01-15'::timestamptz + (i || ' hours')::interval, 'whatsapp', '2026-01-06'::timestamptz);

    INSERT INTO psicossocial_participacoes (tenant_id, campanha_id, token, colaborador_nome, setor, cargo, elegivel, respondido, respondido_em, enviado_via, enviado_em)
    VALUES (v_tenant, v_camp2, 'p2_' || i || '_' || substr(md5(random()::text),1,6), v_names[i], v_setores[i], v_cargos[i], true, i <= 6, CASE WHEN i <= 6 THEN '2025-10-12'::timestamptz + (i || ' hours')::interval END, 'email', '2025-10-02'::timestamptz);

    INSERT INTO psicossocial_participacoes (tenant_id, campanha_id, token, colaborador_nome, setor, cargo, elegivel, respondido, respondido_em, enviado_via, enviado_em)
    VALUES (v_tenant, v_camp3, 'p3_' || i || '_' || substr(md5(random()::text),1,6), v_names[i], v_setores[i], v_cargos[i], true, i <= 7, CASE WHEN i <= 7 THEN '2025-07-10'::timestamptz + (i || ' hours')::interval END, 'link', '2025-07-02'::timestamptz);

    INSERT INTO psicossocial_participacoes (tenant_id, campanha_id, token, colaborador_nome, setor, cargo, elegivel, respondido, respondido_em, enviado_via, enviado_em)
    VALUES (v_tenant, v_camp4, 'p4_' || i || '_' || substr(md5(random()::text),1,6), v_names[i], v_setores[i], v_cargos[i], true, i <= 4, CASE WHEN i <= 4 THEN '2026-04-10'::timestamptz + (i || ' hours')::interval END, 'whatsapp', '2026-04-02'::timestamptz);
  END LOOP;

  -- Extra participants for realistic totals
  FOR i IN 1..34 LOOP
    INSERT INTO psicossocial_participacoes (tenant_id, campanha_id, token, colaborador_nome, setor, cargo, elegivel, respondido, respondido_em, enviado_via, enviado_em)
    VALUES (v_tenant, v_camp1, 'p1x_' || i, 'Colaborador ' || (8+i), v_setores[1 + (i % 8)], v_cargos[1 + (i % 8)], true, true, '2026-01-15'::timestamptz + (i || ' hours')::interval, 'whatsapp', '2026-01-06'::timestamptz);
  END LOOP;

  FOR i IN 1..30 LOOP
    INSERT INTO psicossocial_participacoes (tenant_id, campanha_id, token, colaborador_nome, setor, cargo, elegivel, respondido, respondido_em, enviado_via, enviado_em)
    VALUES (v_tenant, v_camp2, 'p2x_' || i, 'Colaborador ' || (8+i), v_setores[1 + (i % 8)], v_cargos[1 + (i % 8)], true, i <= 28, CASE WHEN i <= 28 THEN '2025-10-12'::timestamptz + (i || ' hours')::interval END, 'email', '2025-10-02'::timestamptz);
  END LOOP;

  FOR i IN 1..27 LOOP
    INSERT INTO psicossocial_participacoes (tenant_id, campanha_id, token, colaborador_nome, setor, cargo, elegivel, respondido, respondido_em, enviado_via, enviado_em)
    VALUES (v_tenant, v_camp3, 'p3x_' || i, 'Colaborador ' || (8+i), v_setores[1 + (i % 8)], v_cargos[1 + (i % 8)], true, i <= 25, CASE WHEN i <= 25 THEN '2025-07-10'::timestamptz + (i || ' hours')::interval END, 'link', '2025-07-02'::timestamptz);
  END LOOP;

  FOR i IN 1..14 LOOP
    INSERT INTO psicossocial_participacoes (tenant_id, campanha_id, token, colaborador_nome, setor, cargo, elegivel, respondido, respondido_em, enviado_via, enviado_em)
    VALUES (v_tenant, v_camp4, 'p4x_' || i, 'Colaborador ' || (8+i), v_setores[1 + (i % 8)], v_cargos[1 + (i % 8)], true, i <= 10, CASE WHEN i <= 10 THEN '2026-04-10'::timestamptz + (i || ' hours')::interval END, 'whatsapp', '2026-04-02'::timestamptz);
  END LOOP;

END $$;
