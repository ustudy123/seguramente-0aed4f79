
-- Criar itens de EPI no estoque
INSERT INTO public.epis (tenant_id, empresa_id, tipo_id, codigo, ca, marca, modelo, tamanho, data_fabricacao, data_validade, quantidade_estoque, quantidade_minima, custo_unitario, localizacao, status) VALUES
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','faf3652f-d1d6-492c-916d-171308abf72e','EPI-001','CA-12345','3M','H-700','Único','2025-06-01','2027-06-01',25,5,45.90,'Almoxarifado Central','disponivel'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','faf3652f-d1d6-492c-916d-171308abf72e','EPI-002','CA-12345','MSA','V-Gard','Único','2025-08-01','2027-08-01',12,5,52.00,'Almoxarifado Central','disponivel'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','66abb7ee-58b8-4669-8c38-bbf53674b95d','EPI-003','CA-23456','Danny','Maxiflex','M','2025-10-01','2026-10-01',8,10,18.50,'Almoxarifado Central','disponivel'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','66abb7ee-58b8-4669-8c38-bbf53674b95d','EPI-004','CA-23456','Danny','Maxiflex','G','2025-10-01','2026-10-01',3,10,18.50,'Almoxarifado Central','disponivel'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','071de39e-f659-40ac-8e03-a811aae896ef','EPI-005','CA-34567','Honeywell','Uvex S3200','Único','2025-09-01','2027-09-01',30,5,32.00,'Almoxarifado Central','disponivel'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','4e327bae-b193-472a-a8c5-4a7aef6840fe','EPI-006','CA-45678','3M','1100','Único','2025-07-01','2026-07-01',50,10,2.80,'Almoxarifado Central','disponivel'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','1f13a93c-bbc3-4456-909c-d3cbdfd43081','EPI-007','CA-56789','Marluvas','Premier Plus','42','2025-05-01','2027-05-01',15,5,128.00,'Almoxarifado Central','disponivel'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','1f13a93c-bbc3-4456-909c-d3cbdfd43081','EPI-008','CA-56789','Marluvas','Premier Plus','40','2025-05-01','2027-05-01',10,5,128.00,'Almoxarifado Central','disponivel'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','252eaef3-860d-4845-8e87-8f0b6b6b163d','EPI-009','CA-67890','3M','Aura 9320','Único','2025-11-01','2026-05-01',4,10,8.90,'Almoxarifado Central','disponivel'),
('179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1','252eaef3-860d-4845-8e87-8f0b6b6b163d','EPI-010','CA-67890','3M','Aura 9320','Único','2024-06-01','2025-12-01',2,10,8.90,'Almoxarifado Central','vencido');

-- Criar entregas de EPI usando os IDs recém-criados
INSERT INTO public.epi_entregas (tenant_id, empresa_id, epi_id, colaborador_nome, colaborador_cpf, quantidade, data_entrega, data_validade, status, entregue_por_nome)
SELECT '179fcdc7-f8b4-4838-9793-e3749b5b11b1','f4913bed-d079-41f7-984c-34f55af787f1',
  e.id, a.nome_completo, a.cpf, 1, '2026-03-15', e.data_validade, 'ativa', 'Lucas Saro'
FROM public.epis e
CROSS JOIN public.admissoes a
WHERE e.tenant_id = '179fcdc7-f8b4-4838-9793-e3749b5b11b1'
  AND a.tenant_id = '179fcdc7-f8b4-4838-9793-e3749b5b11b1'
  AND a.status = 'concluido'
  AND e.status = 'disponivel'
LIMIT 20;
