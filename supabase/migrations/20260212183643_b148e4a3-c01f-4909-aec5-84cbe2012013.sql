
-- Insert 8 fictitious professionals
INSERT INTO public.marketplace_profissionais (
  nome_completo, email, registro_profissional, conselho, uf_registro, registro_validade,
  bio, formacao_academica, especialidades, areas_atuacao, modalidades_atendimento,
  cidade, estado, latitude, longitude,
  aceite_codigo_etica, aceite_codigo_etica_data, status, plano,
  selo_verificado, nota_media, total_avaliacoes, total_servicos_executados, tem_atestado_capacidade
) VALUES
(
  'Dra. Mariana Silva', 'mariana.silva@demo.com', 'CREFITO-3/12345', 'CREFITO', 'SP', '2027-06-15',
  'Fisioterapeuta do trabalho com 12 anos de experiência em ergonomia industrial e prevenção de LER/DORT.',
  'Fisioterapia - UNIFESP', ARRAY['Ergonomia','LER/DORT','Biomecânica'], ARRAY['AEP','AET','Laudo Ergonômico'],
  ARRAY['presencial','online']::marketplace_servico_modalidade[],
  'São Paulo', 'SP', -23.5505, -46.6333,
  true, now(), 'ativo', 'parceiro', true, 4.9, 47, 82, true
),
(
  'Dr. Ricardo Mendes', 'ricardo.mendes@demo.com', 'CRM-SP/98765', 'CRM', 'SP', '2027-12-31',
  'Médico do trabalho com foco em saúde mental ocupacional e prevenção ao burnout.',
  'Medicina do Trabalho - USP', ARRAY['Saúde Mental','PCMSO','Burnout'], ARRAY['ASO','PCMSO','Avaliação Psicossocial'],
  ARRAY['presencial','online','hibrido']::marketplace_servico_modalidade[],
  'Campinas', 'SP', -22.9056, -47.0608,
  true, now(), 'ativo', 'profissional', true, 4.7, 31, 56, true
),
(
  'Eng. Fernanda Costa', 'fernanda.costa@demo.com', 'CREA-RJ/45678', 'CREA', 'RJ', '2028-03-20',
  'Engenheira de segurança com expertise em indústria pesada. Certificada em ISO 45001.',
  'Eng. Segurança do Trabalho - UFRJ', ARRAY['NR-12','ISO 45001','Gestão de Riscos'], ARRAY['PGR','LTCAT','APR'],
  ARRAY['presencial']::marketplace_servico_modalidade[],
  'Rio de Janeiro', 'RJ', -22.9068, -43.1729,
  true, now(), 'ativo', 'parceiro', true, 4.8, 23, 41, true
),
(
  'Psic. André Oliveira', 'andre.oliveira@demo.com', 'CRP-06/112233', 'CRP', 'SP', '2027-08-10',
  'Psicólogo organizacional especializado em avaliação psicossocial NR-1 e QVT.',
  'Psicologia Organizacional - PUC-SP', ARRAY['Psicossocial','QVT','Clima Organizacional'], ARRAY['Avaliação Psicossocial','Pesquisa de Clima'],
  ARRAY['online','hibrido']::marketplace_servico_modalidade[],
  'São Paulo', 'SP', -23.5630, -46.6543,
  true, now(), 'ativo', 'profissional', false, 4.6, 18, 29, false
),
(
  'Dra. Juliana Barros', 'juliana.barros@demo.com', 'CRM-MG/55443', 'CRM', 'MG', '2028-01-15',
  'Médica do trabalho com atuação em saúde ocupacional e perícias médicas.',
  'Medicina do Trabalho - UFMG', ARRAY['Saúde Ocupacional','Perícia','Absenteísmo'], ARRAY['ASO','PCMSO','Perícia'],
  ARRAY['presencial','online']::marketplace_servico_modalidade[],
  'Belo Horizonte', 'MG', -19.9167, -43.9345,
  true, now(), 'ativo', 'base', true, 4.5, 12, 19, false
),
(
  'Tec. Paulo Nascimento', 'paulo.nascimento@demo.com', 'CREA-PR/78901', 'CREA', 'PR', '2027-11-30',
  'Técnico de segurança com 15 anos de experiência em treinamentos NR. Instrutor certificado NR-10, NR-33 e NR-35.',
  'Técnico em Segurança - SENAI', ARRAY['NR-10','NR-33','NR-35','Treinamentos'], ARRAY['Treinamento NR','DDS','SIPAT'],
  ARRAY['presencial']::marketplace_servico_modalidade[],
  'Curitiba', 'PR', -25.4284, -49.2733,
  true, now(), 'ativo', 'profissional', false, 4.4, 35, 120, true
),
(
  'Adv. Camila Torres', 'camila.torres@demo.com', 'OAB-SP/334455', 'OAB', 'SP', '2028-06-01',
  'Advogada trabalhista com foco em compliance SST e defesa em autuações do MTE.',
  'Direito Trabalhista - Mackenzie', ARRAY['Compliance','NR Compliance','Autuações MTE'], ARRAY['Parecer Jurídico','Defesa Administrativa'],
  ARRAY['online','hibrido']::marketplace_servico_modalidade[],
  'São Paulo', 'SP', -23.5475, -46.6361,
  true, now(), 'ativo', 'base', false, 4.3, 8, 14, false
),
(
  'Ft. Roberto Lima', 'roberto.lima@demo.com', 'CREFITO-8/67890', 'CREFITO', 'PR', '2027-09-25',
  'Fisioterapeuta especialista em ginástica laboral e blitz ergonômica para empresas.',
  'Fisioterapia do Trabalho - PUCPR', ARRAY['Ginástica Laboral','Blitz Ergonômica','Ergonomia'], ARRAY['Ginástica Laboral','Blitz Ergonômica','AEP'],
  ARRAY['presencial']::marketplace_servico_modalidade[],
  'Londrina', 'PR', -23.3103, -51.1628,
  true, now(), 'ativo', 'base', false, 4.2, 15, 38, true
);

-- Now insert services linked to these professionals
-- We'll use a CTE to get their IDs
WITH profs AS (
  SELECT id, nome_completo FROM marketplace_profissionais WHERE email LIKE '%@demo.com'
)
INSERT INTO public.marketplace_servicos (profissional_id, categoria_id, nome, descricao, base_legal, modalidade, publico_alvo, preco_referencia, duracao_estimada_minutos, ativo)
SELECT p.id, cat_id, s.nome, s.descricao, s.base_legal, s.modalidade::marketplace_servico_modalidade, s.publico_alvo, s.preco, s.duracao, true
FROM profs p
JOIN (VALUES
  ('mariana.silva@demo.com', '7f718300-d4d4-46f6-aea4-1b6f93d45dd5'::uuid, 'Análise Ergonômica Preliminar (AEP)', 'Avaliação ergonômica conforme NR-17 com relatório fotográfico e plano de ação.', 'NR-17', 'presencial', 'Indústria e Escritórios', 2500.00, 240),
  ('mariana.silva@demo.com', '7f718300-d4d4-46f6-aea4-1b6f93d45dd5'::uuid, 'Blitz Ergonômica', 'Avaliação rápida de postos de trabalho com orientação imediata aos colaboradores.', 'NR-17', 'presencial', 'Escritórios', 1200.00, 120),
  ('ricardo.mendes@demo.com', '59809c8f-81f2-4534-8909-cf5bc383ac93'::uuid, 'Avaliação Psicossocial', 'Avaliação individual para identificação de fatores de risco psicossocial conforme NR-1.', 'NR-1 / NR-33', 'online', 'Todos os setores', 350.00, 60),
  ('ricardo.mendes@demo.com', 'fcabe55f-6617-422c-9a1d-7df239f4ac50'::uuid, 'Programa PCMSO', 'Elaboração e coordenação do PCMSO com definição de exames e periodicidade.', 'NR-7', 'hibrido', 'Empresas com SESMT', 4500.00, 480),
  ('fernanda.costa@demo.com', '4601ea3f-2f73-44a4-9565-f87c5678cc41'::uuid, 'Elaboração de PGR', 'Programa de Gerenciamento de Riscos com inventário e plano de ação.', 'NR-1 / NR-18', 'presencial', 'Indústria e Construção', 5000.00, 960),
  ('fernanda.costa@demo.com', '4601ea3f-2f73-44a4-9565-f87c5678cc41'::uuid, 'LTCAT', 'Laudo Técnico das Condições Ambientais do Trabalho para aposentadoria especial.', 'IN 128/INSS', 'presencial', 'Indústria', 3500.00, 480),
  ('andre.oliveira@demo.com', '59809c8f-81f2-4534-8909-cf5bc383ac93'::uuid, 'Pesquisa de Clima Organizacional', 'Diagnóstico de clima com relatório executivo e plano de intervenção.', 'NR-1', 'online', 'Todos os setores', 3000.00, 120),
  ('juliana.barros@demo.com', 'fcabe55f-6617-422c-9a1d-7df239f4ac50'::uuid, 'ASO - Atestado de Saúde Ocupacional', 'Emissão de ASO admissional, periódico, demissional e de retorno.', 'NR-7', 'presencial', 'Todos os setores', 120.00, 30),
  ('paulo.nascimento@demo.com', '16ed9845-607f-4595-8062-4ffd27c45153'::uuid, 'Treinamento NR-35 Trabalho em Altura', 'Capacitação teórica e prática para trabalho em altura conforme NR-35.', 'NR-35', 'presencial', 'Construção e Manutenção', 180.00, 480),
  ('paulo.nascimento@demo.com', '16ed9845-607f-4595-8062-4ffd27c45153'::uuid, 'Treinamento NR-10 Eletricidade', 'Curso básico de segurança em instalações elétricas.', 'NR-10', 'presencial', 'Manutenção e Indústria', 200.00, 480),
  ('camila.torres@demo.com', '3c7a47ec-5ee4-44bc-91c7-d9bfd418eef0'::uuid, 'Parecer Jurídico SST', 'Análise jurídica de conformidade com NRs e orientação preventiva.', 'CLT / NRs', 'online', 'Empresas com passivo trabalhista', 1500.00, 120),
  ('roberto.lima@demo.com', 'b8c6ced8-7e75-4b89-b44f-e2a14c160f28'::uuid, 'Ginástica Laboral - Plano Mensal', 'Programa mensal de ginástica laboral com sessões 3x/semana.', 'NR-17', 'presencial', 'Escritórios e Indústria', 2800.00, 60)
) AS s(prof_email, cat_id, nome, descricao, base_legal, modalidade, publico_alvo, preco, duracao)
ON p.nome_completo = (SELECT nome_completo FROM marketplace_profissionais WHERE email = s.prof_email LIMIT 1);
