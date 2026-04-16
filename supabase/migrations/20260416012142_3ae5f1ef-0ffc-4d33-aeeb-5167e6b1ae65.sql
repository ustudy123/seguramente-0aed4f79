
INSERT INTO public.ponto_diario (tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf, data, entrada, saida_almoco, retorno_almoco, saida, horas_trabalhadas, status) VALUES
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','ce50e95a-c26a-4d70-b65e-f3bbfcb3eb29','Igor Monteiro Lopes','347.113.066-76','2026-04-14','08:00','12:00','13:00','17:00','08:00:00','regular'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','ce50e95a-c26a-4d70-b65e-f3bbfcb3eb29','Igor Monteiro Lopes','347.113.066-76','2026-04-15','08:15','12:00','13:00','17:00','07:45:00','atraso'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','ce50e95a-c26a-4d70-b65e-f3bbfcb3eb29','Igor Monteiro Lopes','347.113.066-76','2026-04-11','08:00','12:00','13:00','18:30','09:30:00','regular'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','ce50e95a-c26a-4d70-b65e-f3bbfcb3eb29','Igor Monteiro Lopes','347.113.066-76','2026-04-10',NULL,NULL,NULL,NULL,NULL,'falta'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','10366e62-226b-4bd3-93c2-5ba053c455bc','Leonardo Costa Mendes','724.210.608-77','2026-04-14','07:55','12:00','13:00','17:00','08:05:00','regular'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','10366e62-226b-4bd3-93c2-5ba053c455bc','Leonardo Costa Mendes','724.210.608-77','2026-04-15','08:00','12:00','13:00','17:00','08:00:00','regular'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','05a7c2e8-ae43-4ced-b5fb-1196447a8c57','Vanessa Lima Mendes','955.733.054-68','2026-04-14','08:00','12:00','13:00','17:00','08:00:00','regular'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','05a7c2e8-ae43-4ced-b5fb-1196447a8c57','Vanessa Lima Mendes','955.733.054-68','2026-04-15','08:30','12:00','13:00','17:00','07:30:00','atraso'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','d0b1f1d9-7659-433f-9b74-a679a29ef7bc','Isabela Barbosa Oliveira','215.277.340-30','2026-04-14','08:00','12:00','13:00','17:00','08:00:00','regular'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','d0b1f1d9-7659-433f-9b74-a679a29ef7bc','Isabela Barbosa Oliveira','215.277.340-30','2026-04-15',NULL,NULL,NULL,NULL,NULL,'falta'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','9a400af6-939e-4ca7-bbb5-21c678300e1a','Karina Oliveira Batista','180.983.257-84','2026-04-14','08:00','12:00','13:00','17:00','08:00:00','regular'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','588f9fd2-c8c4-443b-a97f-18c2f53b6fa7','Sabrina Rodrigues Batista','135.810.871-46','2026-04-14','08:00','12:00','13:00','17:00','08:00:00','regular'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','588f9fd2-c8c4-443b-a97f-18c2f53b6fa7','Sabrina Rodrigues Batista','135.810.871-46','2026-04-15','08:00','12:00','13:00','17:30','08:30:00','regular');

INSERT INTO public.plano_acoes (tenant_id, empresa_id, titulo, descricao, tipo, origem_modulo, origem_descricao, responsavel_nome, data_inicio, data_conclusao, status, prioridade, gravidade, urgencia, tendencia, progresso) VALUES
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','Implementar pausas ativas','Ginástica laboral 2x/dia','preventiva','ergonomia','Laudo ergonômico','Igor Monteiro Lopes','2026-03-01','2026-05-30','em_andamento','urgente',4,5,4,65),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','Adequar postos NR-17','Ajustar mobiliário','corretiva','ergonomia','AEP','Leonardo Costa Mendes','2026-02-15','2026-04-30','concluida','imediato',5,5,5,100),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','Treinamento riscos psicossociais','Capacitar gestores NR-01','preventiva','psicossocial','SIPRO','Vanessa Lima Mendes','2026-03-15','2026-06-15','em_andamento','medio',3,4,3,40),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','Substituição EPIs vencidos','Trocar luvas e óculos','corretiva','epi','Estoque','Karina Oliveira Batista','2026-04-01','2026-04-20','concluida','urgente',4,5,3,100),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','Programa reconhecimento','Boas práticas SST','melhoria','clima','Pesquisa','Sabrina Rodrigues Batista','2026-04-01','2026-07-31','pendente','baixo',2,2,3,0),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','Revisão PCMSO','Atualizar controle médico','corretiva','saude','Auditoria','Isabela Barbosa Oliveira','2026-01-15','2026-03-30','concluida','imediato',5,5,4,100);

INSERT INTO public.pdis (tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cargo, colaborador_departamento, titulo, descricao, periodo, status, data_inicio, data_fim, responsavel_nome, progresso, gatilho) VALUES
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','ce50e95a-c26a-4d70-b65e-f3bbfcb3eb29','Igor Monteiro Lopes','Analista RH','RH','Certificação Gestão Pessoas','SHRM-CP','semestral','ativo','2026-01-15','2026-07-15','Igor Monteiro Lopes',55,'avaliacao_desempenho'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','10366e62-226b-4bd3-93c2-5ba053c455bc','Leonardo Costa Mendes','Eng. Segurança','SST','Higiene Ocupacional','Pós-graduação','anual','ativo','2026-02-01','2027-02-01','Leonardo Costa Mendes',30,'feedback_gestor'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','05a7c2e8-ae43-4ced-b5fb-1196447a8c57','Vanessa Lima Mendes','Psicóloga','Saúde','Avaliação Psicossocial NR-01','Instrumentos','trimestral','concluido','2026-01-01','2026-03-31','Vanessa Lima Mendes',100,'meta_corporativa'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','d0b1f1d9-7659-433f-9b74-a679a29ef7bc','Isabela Barbosa Oliveira','Coordenadora','Admin','Liderança','Situacional','semestral','ativo','2026-03-01','2026-09-01','Isabela Barbosa Oliveira',20,'avaliacao_desempenho');

INSERT INTO public.gro_riscos (tenant_id, empresa_id, subtipo, fonte, titulo, descricao, perigo_identificado, setor, cargo, probabilidade, severidade, nivel_risco, status_gro, medidas_existentes, medidas_recomendadas, base_normativa, trabalhadores_expostos, ativo) VALUES
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','psicossocial','questionario','Sobrecarga de trabalho','Pressão por resultados','Demandas excessivas','Comercial','Vendedor','alta','grave','alto','avaliado',ARRAY['Reunião semanal'],ARRAY['Redistribuir metas'],ARRAY['NR-01'],12,true),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','fisico','aep','Postura inadequada','Mobiliário não ergonômico','Postura forçada','Administrativo','Analista','alta','moderada','medio','controlado',ARRAY['Apoio de pés'],ARRAY['Cadeiras ergonômicas'],ARRAY['NR-17'],25,true),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','psicossocial','questionario','Conflitos interpessoais','Comunicação agressiva','Relações conflituosas','Produção','Operador','moderada','grave','alto','identificado',ARRAY['Ouvidoria'],ARRAY['Mediação'],ARRAY['NR-01'],18,true),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','fisico','manual','Ruído excessivo','Acima de 85dB','Ruído industrial','Produção','Operador','muito_alta','grave','critico','monitorado',ARRAY['Protetor auricular'],ARRAY['Enclausuramento'],ARRAY['NR-15'],8,true);

INSERT INTO public.avaliacao_templates (id, tenant_id, nome, descricao, tipo, criterios, categorias, escala_min, escala_max, permite_comentarios, ativo)
VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890','179fcdc7-f8b4-4838-9793-e3749b5b11b1','Avaliação 360° Semestral','Avaliação completa','360',
'[{"nome":"Comunicação","peso":20,"categoria":"Comp"},{"nome":"Trabalho em Equipe","peso":20,"categoria":"Comp"},{"nome":"Proatividade","peso":15,"categoria":"Comp"},{"nome":"Conhecimento Técnico","peso":25,"categoria":"Téc"},{"nome":"Resolução de Problemas","peso":20,"categoria":"Téc"}]',
'["Comp","Téc"]',1,5,true,true);

INSERT INTO public.avaliacao_ciclos (id, tenant_id, empresa_id, nome, descricao, template_id, data_inicio, data_fim, status)
VALUES ('b2c3d4e5-f6a7-8901-bcde-f12345678901','179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','Ciclo 2026.1','Semestral 2026','a1b2c3d4-e5f6-7890-abcd-ef1234567890','2026-03-01','2026-04-30','ativo');

INSERT INTO public.avaliacao_respostas (tenant_id, ciclo_id, avaliado_id, avaliado_nome, avaliador_id, avaliador_nome, tipo_avaliador, status, nota_geral, notas_criterios, pontos_fortes, areas_desenvolvimento, data_conclusao) VALUES
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','b2c3d4e5-f6a7-8901-bcde-f12345678901','ce50e95a-c26a-4d70-b65e-f3bbfcb3eb29','Igor Monteiro','ce50e95a-c26a-4d70-b65e-f3bbfcb3eb29','Igor Monteiro','auto','concluida',4.2,'{"Comunicação":4,"Equipe":5}','Trabalho em equipe','Apresentações','2026-04-10'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','b2c3d4e5-f6a7-8901-bcde-f12345678901','10366e62-226b-4bd3-93c2-5ba053c455bc','Leonardo Costa','ce50e95a-c26a-4d70-b65e-f3bbfcb3eb29','Igor Monteiro','gestor','concluida',4.6,'{"Comunicação":5,"Equipe":4}','Conhecimento SST','Delegação','2026-04-12'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','b2c3d4e5-f6a7-8901-bcde-f12345678901','05a7c2e8-ae43-4ced-b5fb-1196447a8c57','Vanessa Lima','ce50e95a-c26a-4d70-b65e-f3bbfcb3eb29','Igor Monteiro','gestor','concluida',4.8,'{"Comunicação":5,"Equipe":5}','Liderança','Análise dados','2026-04-11'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','b2c3d4e5-f6a7-8901-bcde-f12345678901','d0b1f1d9-7659-433f-9b74-a679a29ef7bc','Isabela Barbosa','d0b1f1d9-7659-433f-9b74-a679a29ef7bc','Isabela Barbosa','auto','concluida',3.8,'{"Comunicação":4,"Equipe":4}','Organização','Iniciativa','2026-04-13'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','b2c3d4e5-f6a7-8901-bcde-f12345678901','588f9fd2-c8c4-443b-a97f-18c2f53b6fa7','Sabrina Rodrigues','588f9fd2-c8c4-443b-a97f-18c2f53b6fa7','Sabrina Rodrigues','auto','pendente',NULL,NULL,NULL,NULL,NULL);

INSERT INTO public.bem_estar_respostas (tenant_id, user_id, eixo, tipo, valor_numerico, opcao_selecionada) VALUES
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f8716816-ad9d-4b5d-9161-cfc1d614c751','emocional','humor',5,'muito_bem'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f8716816-ad9d-4b5d-9161-cfc1d614c751','fisico','humor',4,'bem'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f8716816-ad9d-4b5d-9161-cfc1d614c751','social','humor',4,'bem');

INSERT INTO public.ouvidoria (tenant_id, tipo, assunto, mensagem, status, prioridade, anonimo) VALUES
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','denuncia','Tratamento inadequado','Relato de tratamento inadequado por supervisor.','em_analise','alta',true),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','sugestao','Área de descompressão','Sugestão para área de lazer.','pendente','normal',false),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','elogio','SIPAT 2026','Parabéns equipe SST.','respondido','baixa',false);
