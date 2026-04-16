
DO $$
DECLARE
  t_id uuid := '179fcdc7-f8b4-4838-9793-e3749b5b11b1';
  e_id uuid := 'f4913bed-d079-41f7-984c-34f55af787f1';
  c1 uuid := 'ce50e95a-c26a-4d70-b65e-f3bbfcb3eb29';
  c2 uuid := '10366e62-226b-4bd3-93c2-5ba053c455bc';
  c3 uuid := '05a7c2e8-ae43-4ced-b5fb-1196447a8c57';
  c4 uuid := 'd0b1f1d9-7659-433f-9b74-a679a29ef7bc';
  c5 uuid := '9a400af6-939e-4ca7-bbb5-21c678300e1a';
  c6 uuid := '588f9fd2-c8c4-443b-a97f-18c2f53b6fa7';
  c7 uuid := 'ea48b927-5776-4ce6-b10c-cfb5475e54f3';
  c8 uuid := 'd247b5a8-dd8e-4100-b3d3-6a55ed4198ab';
  bt_vr uuid := gen_random_uuid();
  bt_va uuid := gen_random_uuid();
  bt_saude uuid := gen_random_uuid();
  bt_odonto uuid := gen_random_uuid();
  bt_vt uuid := gen_random_uuid();
  bt_seguro uuid := gen_random_uuid();
  p_jan uuid := gen_random_uuid();
  p_fev uuid := gen_random_uuid();
  p_mar uuid := gen_random_uuid();
  p_abr uuid := gen_random_uuid();
  fi uuid;
BEGIN
  -- BENEFÍCIOS TIPOS
  INSERT INTO beneficios_tipos (id, tenant_id, nome, categoria, descricao, valor_padrao, tipo_desconto, percentual_desconto, valor_desconto_fixo, ativo) VALUES
    (bt_vr, t_id, 'Vale Refeição', 'alimentacao', 'Cartão refeição Sodexo - R$35/dia útil', 770.00, 'percentual', 20, 0, true),
    (bt_va, t_id, 'Vale Alimentação', 'alimentacao', 'Cesta básica mensal Alelo', 450.00, 'percentual', 20, 0, true),
    (bt_saude, t_id, 'Plano de Saúde Unimed', 'saude', 'Plano enfermaria com coparticipação', 580.00, 'percentual', 30, 0, true),
    (bt_odonto, t_id, 'Plano Odontológico', 'saude', 'MetLife Dental básico', 45.00, 'fixo', 0, 15, true),
    (bt_vt, t_id, 'Vale Transporte', 'transporte', 'Desconto legal de 6%', 220.00, 'percentual', 6, 0, true),
    (bt_seguro, t_id, 'Seguro de Vida', 'seguro', 'Seguro vida grupo Porto Seguro', 35.00, 'fixo', 0, 0, true);

  -- BENEFÍCIOS COLABORADORES
  INSERT INTO beneficios_colaboradores (tenant_id, empresa_id, beneficio_tipo_id, colaborador_id, colaborador_nome, colaborador_cpf, valor, valor_desconto, data_inicio, status) VALUES
    (t_id, e_id, bt_vr, c1::text, 'Igor Monteiro Lopes', '347.113.066-76', 770, 154, '2025-03-01', 'ativo'),
    (t_id, e_id, bt_saude, c1::text, 'Igor Monteiro Lopes', '347.113.066-76', 580, 174, '2025-03-01', 'ativo'),
    (t_id, e_id, bt_vt, c1::text, 'Igor Monteiro Lopes', '347.113.066-76', 220, 180, '2025-03-01', 'ativo'),
    (t_id, e_id, bt_vr, c2::text, 'Leonardo Costa Mendes', '724.210.608-77', 770, 154, '2025-01-01', 'ativo'),
    (t_id, e_id, bt_va, c2::text, 'Leonardo Costa Mendes', '724.210.608-77', 450, 90, '2025-01-01', 'ativo'),
    (t_id, e_id, bt_saude, c2::text, 'Leonardo Costa Mendes', '724.210.608-77', 580, 174, '2025-01-01', 'ativo'),
    (t_id, e_id, bt_odonto, c2::text, 'Leonardo Costa Mendes', '724.210.608-77', 45, 15, '2025-01-01', 'ativo'),
    (t_id, e_id, bt_vt, c2::text, 'Leonardo Costa Mendes', '724.210.608-77', 220, 264, '2025-01-01', 'ativo'),
    (t_id, e_id, bt_vr, c3::text, 'Vanessa Lima Mendes', '955.733.054-68', 770, 154, '2025-02-01', 'ativo'),
    (t_id, e_id, bt_saude, c3::text, 'Vanessa Lima Mendes', '955.733.054-68', 580, 174, '2025-02-01', 'ativo'),
    (t_id, e_id, bt_seguro, c3::text, 'Vanessa Lima Mendes', '955.733.054-68', 35, 0, '2025-02-01', 'ativo'),
    (t_id, e_id, bt_vr, c4::text, 'Isabela Barbosa Oliveira', '215.277.340-30', 770, 154, '2025-04-01', 'ativo'),
    (t_id, e_id, bt_vt, c4::text, 'Isabela Barbosa Oliveira', '215.277.340-30', 220, 150, '2025-04-01', 'ativo'),
    (t_id, e_id, bt_vr, c5::text, 'Karina Oliveira Batista', '180.983.257-84', 770, 154, '2024-06-01', 'ativo'),
    (t_id, e_id, bt_va, c5::text, 'Karina Oliveira Batista', '180.983.257-84', 450, 90, '2024-06-01', 'ativo'),
    (t_id, e_id, bt_saude, c5::text, 'Karina Oliveira Batista', '180.983.257-84', 580, 174, '2024-06-01', 'ativo'),
    (t_id, e_id, bt_odonto, c5::text, 'Karina Oliveira Batista', '180.983.257-84', 45, 15, '2024-06-01', 'ativo'),
    (t_id, e_id, bt_vt, c5::text, 'Karina Oliveira Batista', '180.983.257-84', 220, 300, '2024-06-01', 'ativo'),
    (t_id, e_id, bt_seguro, c5::text, 'Karina Oliveira Batista', '180.983.257-84', 35, 0, '2024-06-01', 'ativo'),
    (t_id, e_id, bt_vr, c6::text, 'Sabrina Rodrigues Batista', '135.810.871-46', 770, 154, '2025-01-01', 'ativo'),
    (t_id, e_id, bt_saude, c6::text, 'Sabrina Rodrigues Batista', '135.810.871-46', 580, 174, '2025-01-01', 'ativo'),
    (t_id, e_id, bt_vr, c7::text, 'Ana Silva Oliveira', '616.517.286-58', 770, 154, '2025-01-01', 'ativo'),
    (t_id, e_id, bt_va, c7::text, 'Ana Silva Oliveira', '616.517.286-58', 450, 90, '2025-01-01', 'ativo'),
    (t_id, e_id, bt_vt, c7::text, 'Ana Silva Oliveira', '616.517.286-58', 220, 192, '2025-01-01', 'ativo'),
    (t_id, e_id, bt_seguro, c7::text, 'Ana Silva Oliveira', '616.517.286-58', 35, 0, '2025-01-01', 'ativo'),
    (t_id, e_id, bt_vr, c8::text, 'Bruno Souza Lopes', '031.862.659-40', 770, 154, '2025-02-01', 'ativo'),
    (t_id, e_id, bt_saude, c8::text, 'Bruno Souza Lopes', '031.862.659-40', 580, 174, '2025-02-01', 'ativo'),
    (t_id, e_id, bt_vt, c8::text, 'Bruno Souza Lopes', '031.862.659-40', 220, 168, '2025-02-01', 'ativo');

  -- FOLHA PERÍODOS
  INSERT INTO folha_periodos (id, tenant_id, empresa_id, competencia, status, data_abertura, data_fechamento, total_bruto, total_descontos, total_liquido, total_colaboradores, observacoes) VALUES
    (p_jan, t_id, e_id, '2026-01', 'fechado', '2026-01-20', '2026-01-30', 42850, 12420, 30430, 8, 'Folha janeiro processada'),
    (p_fev, t_id, e_id, '2026-02', 'fechado', '2026-02-18', '2026-02-28', 43200, 12580, 30620, 8, 'Folha fevereiro com HE'),
    (p_mar, t_id, e_id, '2026-03', 'fechado', '2026-03-20', '2026-03-31', 44100, 12750, 31350, 8, 'Folha março conferida'),
    (p_abr, t_id, e_id, '2026-04', 'aberto', '2026-04-15', NULL, 0, 0, 0, 8, 'Abril em processamento');

  -- FOLHA ITENS Janeiro
  fi := gen_random_uuid();
  INSERT INTO folha_itens (id,tenant_id,periodo_id,colaborador_id,colaborador_nome,colaborador_cpf,cargo,departamento,salario_base,total_proventos,total_descontos,total_liquido,status) VALUES (fi,t_id,p_jan,c1::text,'Igor Monteiro Lopes','347.113.066-76','Auxiliar de RH','RH',3000,3770,1108,2662,'calculado');
  INSERT INTO folha_eventos (tenant_id,folha_item_id,tipo,codigo,descricao,referencia,valor,origem) VALUES (t_id,fi,'PROVENTO','1000','Salário Base','30d',3000,'sistema'),(t_id,fi,'PROVENTO','1010','Vale Refeição','22d',770,'beneficio'),(t_id,fi,'DESCONTO','9001','INSS','12%',360,'sistema'),(t_id,fi,'DESCONTO','9002','IRRF','7.5%',142.80,'sistema'),(t_id,fi,'DESCONTO','9010','VR Desc.','20%',154,'beneficio'),(t_id,fi,'DESCONTO','9011','Plano Saúde','30%',174,'beneficio'),(t_id,fi,'DESCONTO','9012','Vale Transporte','6%',180,'beneficio');

  fi := gen_random_uuid();
  INSERT INTO folha_itens (id,tenant_id,periodo_id,colaborador_id,colaborador_nome,colaborador_cpf,cargo,departamento,salario_base,total_proventos,total_descontos,total_liquido,status) VALUES (fi,t_id,p_jan,c2::text,'Leonardo Costa Mendes','724.210.608-77','Vendedor','Comercial',4400,6085,1897,4188,'calculado');
  INSERT INTO folha_eventos (tenant_id,folha_item_id,tipo,codigo,descricao,referencia,valor,origem) VALUES (t_id,fi,'PROVENTO','1000','Salário Base','30d',4400,'sistema'),(t_id,fi,'PROVENTO','1005','Comissão',NULL,1200,'manual'),(t_id,fi,'PROVENTO','1010','Vale Refeição','22d',485,'beneficio'),(t_id,fi,'DESCONTO','9001','INSS','14%',616,'sistema'),(t_id,fi,'DESCONTO','9002','IRRF','15%',584,'sistema'),(t_id,fi,'DESCONTO','9010','VR+VA Desc.',NULL,244,'beneficio'),(t_id,fi,'DESCONTO','9011','Plano Saúde+Odonto',NULL,189,'beneficio'),(t_id,fi,'DESCONTO','9012','Vale Transporte','6%',264,'beneficio');

  fi := gen_random_uuid();
  INSERT INTO folha_itens (id,tenant_id,periodo_id,colaborador_id,colaborador_nome,colaborador_cpf,cargo,departamento,salario_base,total_proventos,total_descontos,total_liquido,status) VALUES (fi,t_id,p_jan,c3::text,'Vanessa Lima Mendes','955.733.054-68','Comprador','Suprimentos',5200,5970,1728,4242,'calculado');

  fi := gen_random_uuid();
  INSERT INTO folha_itens (id,tenant_id,periodo_id,colaborador_id,colaborador_nome,colaborador_cpf,cargo,departamento,salario_base,total_proventos,total_descontos,total_liquido,status) VALUES (fi,t_id,p_jan,c4::text,'Isabela Barbosa Oliveira','215.277.340-30','Recepcionista','Administrativo',2500,3270,854,2416,'calculado');

  fi := gen_random_uuid();
  INSERT INTO folha_itens (id,tenant_id,periodo_id,colaborador_id,colaborador_nome,colaborador_cpf,cargo,departamento,salario_base,total_proventos,total_descontos,total_liquido,status) VALUES (fi,t_id,p_jan,c5::text,'Karina Oliveira Batista','180.983.257-84','Analista de Suporte','TI',5000,6070,1933,4137,'calculado');

  fi := gen_random_uuid();
  INSERT INTO folha_itens (id,tenant_id,periodo_id,colaborador_id,colaborador_nome,colaborador_cpf,cargo,departamento,salario_base,total_proventos,total_descontos,total_liquido,status) VALUES (fi,t_id,p_jan,c6::text,'Sabrina Rodrigues Batista','135.810.871-46','Coordenador Comercial','Comercial',7500,8270,2728,5542,'calculado');

  fi := gen_random_uuid();
  INSERT INTO folha_itens (id,tenant_id,periodo_id,colaborador_id,colaborador_nome,colaborador_cpf,cargo,departamento,salario_base,total_proventos,total_descontos,total_liquido,status) VALUES (fi,t_id,p_jan,c7::text,'Ana Silva Oliveira','616.517.286-58','Analista Administrativo','Administrativo',3200,4420,1246,3174,'calculado');

  fi := gen_random_uuid();
  INSERT INTO folha_itens (id,tenant_id,periodo_id,colaborador_id,colaborador_nome,colaborador_cpf,cargo,departamento,salario_base,total_proventos,total_descontos,total_liquido,status) VALUES (fi,t_id,p_jan,c8::text,'Bruno Souza Lopes','031.862.659-40','Assistente Financeiro','Financeiro',2800,3570,956,2614,'calculado');

  -- FOLHA ITENS Fevereiro
  fi := gen_random_uuid();
  INSERT INTO folha_itens (id,tenant_id,periodo_id,colaborador_id,colaborador_nome,colaborador_cpf,cargo,departamento,salario_base,total_proventos,total_descontos,total_liquido,status) VALUES (fi,t_id,p_fev,c1::text,'Igor Monteiro Lopes','347.113.066-76','Auxiliar de RH','RH',3000,3920,1150,2770,'calculado');
  fi := gen_random_uuid();
  INSERT INTO folha_itens (id,tenant_id,periodo_id,colaborador_id,colaborador_nome,colaborador_cpf,cargo,departamento,salario_base,total_proventos,total_descontos,total_liquido,status) VALUES (fi,t_id,p_fev,c2::text,'Leonardo Costa Mendes','724.210.608-77','Vendedor','Comercial',4400,6485,2010,4475,'calculado');
  fi := gen_random_uuid();
  INSERT INTO folha_itens (id,tenant_id,periodo_id,colaborador_id,colaborador_nome,colaborador_cpf,cargo,departamento,salario_base,total_proventos,total_descontos,total_liquido,status) VALUES (fi,t_id,p_fev,c3::text,'Vanessa Lima Mendes','955.733.054-68','Comprador','Suprimentos',5200,5970,1728,4242,'calculado');
  fi := gen_random_uuid();
  INSERT INTO folha_itens (id,tenant_id,periodo_id,colaborador_id,colaborador_nome,colaborador_cpf,cargo,departamento,salario_base,total_proventos,total_descontos,total_liquido,status) VALUES (fi,t_id,p_fev,c4::text,'Isabela Barbosa Oliveira','215.277.340-30','Recepcionista','Administrativo',2500,3270,854,2416,'calculado');
  fi := gen_random_uuid();
  INSERT INTO folha_itens (id,tenant_id,periodo_id,colaborador_id,colaborador_nome,colaborador_cpf,cargo,departamento,salario_base,total_proventos,total_descontos,total_liquido,status) VALUES (fi,t_id,p_fev,c5::text,'Karina Oliveira Batista','180.983.257-84','Analista de Suporte','TI',5000,6070,1933,4137,'calculado');
  fi := gen_random_uuid();
  INSERT INTO folha_itens (id,tenant_id,periodo_id,colaborador_id,colaborador_nome,colaborador_cpf,cargo,departamento,salario_base,total_proventos,total_descontos,total_liquido,status) VALUES (fi,t_id,p_fev,c6::text,'Sabrina Rodrigues Batista','135.810.871-46','Coordenador Comercial','Comercial',7500,8270,2728,5542,'calculado');
  fi := gen_random_uuid();
  INSERT INTO folha_itens (id,tenant_id,periodo_id,colaborador_id,colaborador_nome,colaborador_cpf,cargo,departamento,salario_base,total_proventos,total_descontos,total_liquido,status) VALUES (fi,t_id,p_fev,c7::text,'Ana Silva Oliveira','616.517.286-58','Analista Administrativo','Administrativo',3200,4420,1246,3174,'calculado');
  fi := gen_random_uuid();
  INSERT INTO folha_itens (id,tenant_id,periodo_id,colaborador_id,colaborador_nome,colaborador_cpf,cargo,departamento,salario_base,total_proventos,total_descontos,total_liquido,status) VALUES (fi,t_id,p_fev,c8::text,'Bruno Souza Lopes','031.862.659-40','Assistente Financeiro','Financeiro',2800,3570,956,2614,'calculado');

  -- FOLHA ITENS Março
  fi := gen_random_uuid();
  INSERT INTO folha_itens (id,tenant_id,periodo_id,colaborador_id,colaborador_nome,colaborador_cpf,cargo,departamento,salario_base,total_proventos,total_descontos,total_liquido,status) VALUES (fi,t_id,p_mar,c1::text,'Igor Monteiro Lopes','347.113.066-76','Auxiliar de RH','RH',3000,3770,1108,2662,'calculado');
  fi := gen_random_uuid();
  INSERT INTO folha_itens (id,tenant_id,periodo_id,colaborador_id,colaborador_nome,colaborador_cpf,cargo,departamento,salario_base,total_proventos,total_descontos,total_liquido,status) VALUES (fi,t_id,p_mar,c2::text,'Leonardo Costa Mendes','724.210.608-77','Vendedor','Comercial',4400,6885,2140,4745,'calculado');
  fi := gen_random_uuid();
  INSERT INTO folha_itens (id,tenant_id,periodo_id,colaborador_id,colaborador_nome,colaborador_cpf,cargo,departamento,salario_base,total_proventos,total_descontos,total_liquido,status) VALUES (fi,t_id,p_mar,c3::text,'Vanessa Lima Mendes','955.733.054-68','Comprador','Suprimentos',5200,6170,1788,4382,'calculado');
  fi := gen_random_uuid();
  INSERT INTO folha_itens (id,tenant_id,periodo_id,colaborador_id,colaborador_nome,colaborador_cpf,cargo,departamento,salario_base,total_proventos,total_descontos,total_liquido,status) VALUES (fi,t_id,p_mar,c4::text,'Isabela Barbosa Oliveira','215.277.340-30','Recepcionista','Administrativo',2500,3270,854,2416,'calculado');
  fi := gen_random_uuid();
  INSERT INTO folha_itens (id,tenant_id,periodo_id,colaborador_id,colaborador_nome,colaborador_cpf,cargo,departamento,salario_base,total_proventos,total_descontos,total_liquido,status) VALUES (fi,t_id,p_mar,c5::text,'Karina Oliveira Batista','180.983.257-84','Analista de Suporte','TI',5000,6270,1993,4277,'calculado');
  fi := gen_random_uuid();
  INSERT INTO folha_itens (id,tenant_id,periodo_id,colaborador_id,colaborador_nome,colaborador_cpf,cargo,departamento,salario_base,total_proventos,total_descontos,total_liquido,status) VALUES (fi,t_id,p_mar,c6::text,'Sabrina Rodrigues Batista','135.810.871-46','Coordenador Comercial','Comercial',7500,8770,2900,5870,'calculado');
  fi := gen_random_uuid();
  INSERT INTO folha_itens (id,tenant_id,periodo_id,colaborador_id,colaborador_nome,colaborador_cpf,cargo,departamento,salario_base,total_proventos,total_descontos,total_liquido,status) VALUES (fi,t_id,p_mar,c7::text,'Ana Silva Oliveira','616.517.286-58','Analista Administrativo','Administrativo',3200,4420,1246,3174,'calculado');
  fi := gen_random_uuid();
  INSERT INTO folha_itens (id,tenant_id,periodo_id,colaborador_id,colaborador_nome,colaborador_cpf,cargo,departamento,salario_base,total_proventos,total_descontos,total_liquido,status) VALUES (fi,t_id,p_mar,c8::text,'Bruno Souza Lopes','031.862.659-40','Assistente Financeiro','Financeiro',2800,3570,956,2614,'calculado');

  -- 13º SALÁRIO
  INSERT INTO folha_13_calculo (tenant_id,ano,colaborador_id,colaborador_nome,colaborador_cpf,parcela,meses_trabalhados,remuneracao_base,media_variaveis,valor_bruto,valor_primeira_parcela,base_inss,valor_inss,base_irrf,valor_irrf,base_fgts,valor_fgts,total_descontos,total_liquido,status) VALUES
    (t_id,2025,c1::text,'Igor Monteiro Lopes','347.113.066-76',1,10,3000,0,2500,0,0,0,0,0,2500,200,0,2500,'calculado'),
    (t_id,2025,c2::text,'Leonardo Costa Mendes','724.210.608-77',1,12,4400,600,2500,0,0,0,0,0,2500,200,0,2500,'calculado'),
    (t_id,2025,c5::text,'Karina Oliveira Batista','180.983.257-84',1,12,5000,0,2500,0,0,0,0,0,2500,200,0,2500,'calculado'),
    (t_id,2025,c6::text,'Sabrina Rodrigues Batista','135.810.871-46',1,12,7500,0,3750,0,0,0,0,0,3750,300,0,3750,'calculado'),
    (t_id,2025,c2::text,'Leonardo Costa Mendes','724.210.608-77',2,12,4400,600,5000,2500,5000,700,4300,460.72,5000,400,1160.72,1339.28,'calculado'),
    (t_id,2025,c6::text,'Sabrina Rodrigues Batista','135.810.871-46',2,12,7500,0,7500,3750,7500,908.85,6591.15,1199.87,7500,600,2108.72,1641.28,'calculado');

  -- FÉRIAS
  INSERT INTO folha_ferias_calculo (tenant_id,colaborador_id,colaborador_nome,colaborador_cpf,periodo_aquisitivo_inicio,periodo_aquisitivo_fim,data_inicio_gozo,data_fim_gozo,dias_gozo,dias_abono,remuneracao_base,media_variaveis,valor_ferias,valor_terco,valor_abono,valor_abono_terco,base_inss,valor_inss,base_irrf,valor_irrf,base_fgts,valor_fgts,total_bruto,total_descontos,total_liquido,em_dobro,data_pagamento,prazo_legal,status) VALUES
    (t_id,c1::text,'Igor Monteiro Lopes','347.113.066-76','2025-03-01','2026-02-28','2026-03-10','2026-03-29',20,0,3000,0,2000,666.67,0,0,2666.67,319.88,2346.79,0,2666.67,213.33,2666.67,319.88,2346.79,false,'2026-03-08','2026-03-08','calculado'),
    (t_id,c5::text,'Karina Oliveira Batista','180.983.257-84','2024-06-01','2025-05-31','2026-01-05','2026-02-03',30,10,5000,0,5000,1666.67,1666.67,555.56,6666.67,908.85,5757.82,740.70,8888.90,711.11,8888.90,1649.55,7239.35,false,'2026-01-03','2026-01-03','pago'),
    (t_id,c7::text,'Ana Silva Oliveira','616.517.286-58','2025-01-01','2025-12-31','2026-05-04','2026-05-23',20,0,3200,0,2133.33,711.11,0,0,2844.44,341.33,2503.11,0,2844.44,227.56,2844.44,341.33,2503.11,false,'2026-05-02','2026-05-02','calculado');

  -- PROVISÕES (all same columns)
  INSERT INTO folha_provisoes (tenant_id,competencia,colaborador_id,colaborador_nome,tipo,valor_provisao,valor_terco,encargos_inss,encargos_fgts,valor_total,revertida) VALUES
    (t_id,'2026-01',c1::text,'Igor Monteiro Lopes','ferias',250,83.33,73.33,26.67,433.33,false),
    (t_id,'2026-01',c1::text,'Igor Monteiro Lopes','13_salario',250,0,55,20,325,false),
    (t_id,'2026-01',c2::text,'Leonardo Costa Mendes','ferias',366.67,122.22,107.56,39.11,635.56,false),
    (t_id,'2026-01',c2::text,'Leonardo Costa Mendes','13_salario',366.67,0,80.67,29.33,476.67,false),
    (t_id,'2026-01',c5::text,'Karina Oliveira Batista','ferias',416.67,138.89,122.22,44.44,722.22,false),
    (t_id,'2026-01',c5::text,'Karina Oliveira Batista','13_salario',416.67,0,91.67,33.33,541.67,false),
    (t_id,'2026-01',c6::text,'Sabrina Rodrigues Batista','ferias',625,208.33,183.33,66.67,1083.33,false),
    (t_id,'2026-01',c6::text,'Sabrina Rodrigues Batista','13_salario',625,0,137.50,50,812.50,false),
    (t_id,'2026-02',c1::text,'Igor Monteiro Lopes','ferias',250,83.33,73.33,26.67,433.33,false),
    (t_id,'2026-02',c2::text,'Leonardo Costa Mendes','ferias',366.67,122.22,107.56,39.11,635.56,false),
    (t_id,'2026-02',c5::text,'Karina Oliveira Batista','ferias',416.67,138.89,122.22,44.44,722.22,false),
    (t_id,'2026-02',c6::text,'Sabrina Rodrigues Batista','ferias',625,208.33,183.33,66.67,1083.33,false),
    (t_id,'2026-03',c3::text,'Vanessa Lima Mendes','ferias',433.33,144.44,127.11,46.22,751.10,false);

  -- PROVISÃO revertida separada (com data_reversao)
  INSERT INTO folha_provisoes (tenant_id,competencia,colaborador_id,colaborador_nome,tipo,valor_provisao,valor_terco,encargos_inss,encargos_fgts,valor_total,revertida,data_reversao) VALUES
    (t_id,'2026-03',c1::text,'Igor Monteiro Lopes','ferias',250,83.33,73.33,26.67,433.33,true,'2026-03-10');

  -- RUBRICAS
  INSERT INTO folha_rubricas (tenant_id,codigo_interno,descricao,tipo,natureza,incide_inss,incide_irrf,incide_fgts,incide_ferias,incide_13,incide_rescisao,prioridade_calculo,protegida,ativa) VALUES
    (t_id,'1000','Salário Base','PROVENTO','REMUNERATORIA',true,true,true,true,true,true,1,true,true),
    (t_id,'1003','Hora Extra 50%','PROVENTO','REMUNERATORIA',true,true,true,true,true,true,10,false,true),
    (t_id,'1004','Hora Extra 100%','PROVENTO','REMUNERATORIA',true,true,true,true,true,true,11,false,true),
    (t_id,'1005','Comissão','PROVENTO','REMUNERATORIA',true,true,true,true,true,true,15,false,true),
    (t_id,'1006','Adicional Noturno','PROVENTO','REMUNERATORIA',true,true,true,true,true,true,20,false,true),
    (t_id,'1007','Adicional Periculosidade','PROVENTO','REMUNERATORIA',true,true,true,true,true,true,25,false,true),
    (t_id,'1008','Adicional Insalubridade','PROVENTO','REMUNERATORIA',true,true,true,true,true,true,26,false,true),
    (t_id,'1010','Vale Refeição','PROVENTO','INDENIZATORIA',false,false,false,false,false,false,50,false,true),
    (t_id,'1011','Vale Alimentação','PROVENTO','INDENIZATORIA',false,false,false,false,false,false,51,false,true),
    (t_id,'1020','DSR s/ Comissões','PROVENTO','REMUNERATORIA',true,true,true,true,true,true,30,false,true),
    (t_id,'9001','INSS','DESCONTO','OUTRA',false,false,false,false,false,false,100,true,true),
    (t_id,'9002','IRRF','DESCONTO','OUTRA',false,false,false,false,false,false,101,true,true),
    (t_id,'9010','Desc. Vale Refeição','DESCONTO','OUTRA',false,false,false,false,false,false,110,false,true),
    (t_id,'9011','Desc. Plano de Saúde','DESCONTO','OUTRA',false,false,false,false,false,false,111,false,true),
    (t_id,'9012','Desc. Vale Transporte','DESCONTO','OUTRA',false,false,false,false,false,false,112,false,true),
    (t_id,'9020','Pensão Alimentícia','DESCONTO','OUTRA',false,false,false,false,false,false,120,false,true),
    (t_id,'9030','Adiantamento Salarial','DESCONTO','OUTRA',false,false,false,false,false,false,130,false,true);

END $$;
