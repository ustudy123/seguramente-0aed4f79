-- Insert admissões (collaborators)
INSERT INTO admissoes (tenant_id, empresa_id, nome_completo, cpf, email, cargo, departamento, data_admissao, salario, status, tipo_contrato, genero) VALUES
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','Carlos Eduardo Silva','111.222.333-44','carlos.silva@empresa.com','Analista de RH','Recursos Humanos','2024-03-15',4500,'concluido','CLT','masculino'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','Maria Fernanda Costa','222.333.444-55','maria.costa@empresa.com','Coordenadora SST','Segurança do Trabalho','2023-08-01',6200,'concluido','CLT','feminino'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','João Pedro Oliveira','333.444.555-66','joao.oliveira@empresa.com','Operador de Produção','Produção','2024-06-10',3200,'concluido','CLT','masculino'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','Ana Beatriz Santos','444.555.666-77','ana.santos@empresa.com','Auxiliar Administrativo','Administrativo','2024-09-01',2800,'concluido','CLT','feminino'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','Ricardo Almeida','555.666.777-88','ricardo.almeida@empresa.com','Engenheiro de Segurança','Segurança do Trabalho','2023-02-20',8500,'concluido','CLT','masculino'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','Fernanda Lima','666.777.888-99','fernanda.lima@empresa.com','Analista Financeiro','Financeiro','2024-01-10',5100,'concluido','CLT','feminino'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','Lucas Mendes','777.888.999-00','lucas.mendes@empresa.com','Supervisor de Produção','Produção','2022-11-05',5800,'concluido','CLT','masculino'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','Patricia Rocha','888.999.000-11','patricia.rocha@empresa.com','Psicóloga Organizacional','Recursos Humanos','2024-04-01',5500,'concluido','CLT','feminino'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','Marcos Souza','999.000.111-22','marcos.souza@empresa.com','Técnico de Manutenção','Manutenção','2025-01-15',3800,'concluido','CLT','masculino'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','Juliana Martins','000.111.222-33','juliana.martins@empresa.com','Assistente de DP','Recursos Humanos','2025-03-01',3000,'aguardando_documentos','CLT','feminino'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','Roberto Ferreira','123.456.789-10','roberto.ferreira@empresa.com','Motorista','Logística','2024-07-20',3500,'concluido','CLT','masculino'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','Camila Barbosa','234.567.890-12','camila.barbosa@empresa.com','Recepcionista','Administrativo','2025-02-10',2500,'em_analise','CLT','feminino');

-- Insert EPI tipos
INSERT INTO epi_tipos (tenant_id, nome, descricao, categoria, ca_numero, marca, fabricante, estoque_minimo, quantidade_estoque, is_active, ca_validade, periodicidade_troca_dias) VALUES
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','Capacete de Segurança','Capacete classe B','Proteção da Cabeça','CA 29798','3M','3M do Brasil',10,45,true,'2027-06-15',365),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','Luva Nitrílica','Luva contra agentes químicos','Proteção das Mãos','CA 32145','SuperSafety','Super Safety',20,120,true,'2026-12-01',90),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','Óculos de Proteção','Óculos ampla visão','Proteção dos Olhos','CA 27850','Kalipso','Kalipso',15,68,true,'2027-03-20',180),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','Protetor Auricular','Plug de inserção 15dB','Proteção Auditiva','CA 5745','3M','3M do Brasil',30,200,true,'2027-09-10',30),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','Bota de Segurança','Bota com biqueira de aço','Proteção dos Pés','CA 38200','Marluvas','Marluvas',8,32,true,'2027-01-15',365),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','Respirador PFF2','Máscara PFF2 sem válvula','Proteção Respiratória','CA 44241','3M','3M do Brasil',50,180,true,'2026-08-30',7);