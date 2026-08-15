-- =========================================================
-- QA — SST/Saúde Ocupacional: casos derivados da Análise de Requisitos
-- do módulo (documento YE-DP-SST-001, Google Doc "YE — SST e Saúde
-- Ocupacional — Análise de Requisitos", data-base ago/2026).
--
-- ESCOPO DO DOCUMENTO: GESTÃO dos documentos que a empresa já possui
-- (importar/interpretar PGR, PCMSO, LTCAT, laudos; gerar OS e ficha de
-- EPI; controlar prazos e reflexos). A ELABORAÇÃO de programas está
-- explicitamente fora do escopo (braço futuro) — nenhum caso cobra o
-- que o documento não pede.
--
-- MÉTODO: as 9 regras de negócio, os 10 critérios de aceite e os 12
-- cenários (seção 25) foram cruzados com o que já existe no motor.
-- O ASO por evento e a CAT já têm dono em outras famílias:
--
-- JÁ COBERTO (referência cruzada, sem duplicar):
--   ASO admissional habilita o início ........... ADM-060..063 / ADM-072
--   ASO demissional (prazos NR-7) ............... DESL-060..067
--   ASO de retorno trava a reativação ........... AFAST-070
--   CAT no 1º dia útil + estabilidade ........... AFAST-030/031
--   Sigilo do CID + log de acesso ............... AFAST-080
--   Adicionais de risco na Folha ................ FOLHA-021 (prevalência)
--   RAT×FAP no custo patronal ................... FOLHA-050
--   Riscos psicossociais / Lei 14.457 ........... família PSICO
--   Anti-duplicidade/rejeição do eSocial ........ série ADM-093..DESL-094
--
-- BASE JÁ EXISTENTE no sistema (as sondas confirmarão o quanto vive):
--   sst_documentos (tipo PGR/PCMSO/LTCAT + data_vigencia); tabela aso;
--   eventos_sst + esocial_transmissoes (S-2210/2220/2240 pela tela);
--   subsistema de EPI (tipos, CETs/CA, entregas, estoque — EPI-001);
--   ordem_servico_links; periodicidade_exame_meses; eventos_saude na
--   camada perfil_restringe_leitura_*.
--
-- SEM COBERTURA — este arquivo documenta 15 casos novos (família SST,
-- em Saúde & Segurança › Compliance SST): vigência e alerta dos
-- documentos, extração rastreável com revisão, ações do PGR no Plano
-- de Ação, OS por função com ciência, ficha de EPI com CA vigente,
-- agenda do periódico, ASO de mudança de risco, prazos do S-2220 e
-- S-2240, CIPA (dimensionamento/atas), canal de assédio com sigilo,
-- laudo→adicional com neutralização por EPI, PPP, e coerência
-- documental PGR-LTCAT-PCMSO.
--
-- ESTA MIGRATION SÓ DOCUMENTA. Rotinas em leva futura.
-- =========================================================

SET lock_timeout = '10s';

DO $doc$
DECLARE v_mod uuid; v_antes int; v_depois int;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos
  WHERE path = 'saude-seguranca/compliance-sst';
  IF v_mod IS NULL THEN RAISE EXCEPTION 'Módulo saude-seguranca/compliance-sst não encontrado.'; END IF;
  SELECT count(*) INTO v_antes FROM public.qa_casos_teste WHERE modulo_id = v_mod;

  INSERT INTO public.qa_casos_teste
    (modulo_id, codigo, titulo, tipo, prioridade, status, nivel,
     base_legal, objetivo, pre_condicoes, passos, resultado_esperado, observacoes)
  VALUES

  -- ══════════ A) GESTÃO DOS DOCUMENTOS (PGR/PCMSO/LAUDOS) ══════════

  (v_mod, 'SST-001', 'PGR, PCMSO e laudos com vigência viva: vencimento avisa antes, não depois',
   'feliz', 'critica', 'aprovado', 'api',
   'NR-1 (PGR: revisão a cada 2 anos, ou 3 com certificação; avaliação de riscos) ; NR-7 (PCMSO baseado no PGR)',
   'O coração do escopo de GESTÃO: os documentos importados (PGR, PCMSO, LTCAT, laudos) têm vigência controlada — o sistema conhece a validade de cada um, avisa com antecedência (60/30 dias) que uma nova versão precisa ser solicitada à consultoria e acusa o vencido. Documento vencido descoberto pela fiscalização é exatamente o problema que o módulo existe para eliminar.',
   'Documentos de SST cadastrados com data de vigência no ambiente de teste.',
   '[{"ordem":1,"acao":"Cadastrar PGR com vigência a 45 dias do fim","resultado_esperado":"Alerta de renovação disparado (janela de 60/30 dias), com ação no Plano de Ação"},
     {"ordem":2,"acao":"Deixar a vigência vencer","resultado_esperado":"Documento marcado VENCIDO e sinalizado no painel — nunca silêncio"},
     {"ordem":3,"acao":"Importar a nova versão","resultado_esperado":"Versão anterior preservada como histórico; vigência renovada; reflexos reprocessados"}]'::jsonb,
   'Todo documento tem prazo de validade — e o sistema olha o calendário primeiro.',
   'Requisitos YE-DP-SST-001: RF-001 / alerta "Documento vencido" (seção 14) / cenário "Documento vencido" (seção 25). sst_documentos existe com tipo e data_vigencia — a sonda confere se alguém VIGIA a data ou se ela é decorativa.'),

  (v_mod, 'SST-002', 'Dado extraído de documento aponta a fonte e passa por revisão humana',
   'alternativo', 'alta', 'aprovado', 'api',
   'Documento YE-DP-SST-001, RF-009 / RNF-003 (extração com confiança, revisão humana e rastreio do documento-fonte)',
   'A interpretação por IA é o núcleo do módulo, e ela só é confiável com dois cintos: cada dado extraído (risco, exame, periodicidade, enquadramento) aponta o DOCUMENTO-FONTE de onde saiu, e extração com baixa confiança para na mesa de um humano antes de virar OS, ficha ou adicional. Dado extraído errado que vira adicional na folha é erro de IA cobrado em reclamatória.',
   'Documento importado com dados extraídos no ambiente de teste.',
   '[{"ordem":1,"acao":"Conferir um risco/exame extraído","resultado_esperado":"Vínculo com o documento-fonte (qual arquivo, qual versão) rastreável"},
     {"ordem":2,"acao":"Simular extração de baixa confiança","resultado_esperado":"Revisão humana exigida antes de o dado produzir efeito"},
     {"ordem":3,"acao":"Revisar e aprovar a extração","resultado_esperado":"Dado liberado com o revisor registrado na trilha"}]'::jsonb,
   'Dado sem fonte não vale; extração sem revisão não produz efeito.',
   'Requisitos YE-DP-SST-001: RF-009 / RNF-003 / cenário "Documento ruim" (seção 25). Estrutura de extração (dados ligados ao documento-fonte + estado de revisão) não existe hoje — deve falhar e encaminhar.'),

  (v_mod, 'SST-003', 'As ações do plano do PGR viram tarefas rastreáveis no Plano de Ação',
   'feliz', 'alta', 'aprovado', 'api',
   'NR-1 (PGR = inventário de riscos + PLANO DE AÇÃO com cronograma)',
   'O PGR não é só inventário: ele traz um plano de ação com medidas, responsáveis e prazos. O "documento que vira ação" (seção 29) é a promessa central do módulo: importado o PGR, cada medida proposta vira tarefa no módulo Plano de Ação, com o vínculo ao risco de origem preservado — e a conclusão da tarefa volta como evidência de que a medida saiu do papel.',
   'PGR importado com plano de ação interpretado no ambiente de teste.',
   '[{"ordem":1,"acao":"Importar/interpretar o PGR","resultado_esperado":"Medidas do plano viram ações no Plano de Ação (5W2H), vinculadas ao risco de origem"},
     {"ordem":2,"acao":"Concluir uma ação","resultado_esperado":"Evidência registrada; o risco de origem mostra a medida executada"},
     {"ordem":3,"acao":"Reimportar versão nova do PGR","resultado_esperado":"Ações novas criadas sem duplicar as existentes; encerradas as que saíram do plano"}]'::jsonb,
   'O plano do PGR deixa de ser página de PDF e vira fila de trabalho.',
   'Requisitos YE-DP-SST-001: RN-008 / CA-002 / seção 15. O módulo Plano de Ação existe (família própria no motor); a ponte PGR→ações, não. Deve falhar e encaminhar.'),

  -- ══════════ B) OS E FICHA DE EPI (DOCUMENTOS DERIVADOS) ══════════

  (v_mod, 'SST-010', 'Ordem de Serviço por função: riscos, medidas e ciência do colaborador',
   'feliz', 'alta', 'aprovado', 'api',
   'NR-1, item 1.4.1 (ordem de serviço: informar os riscos e as medidas de prevenção)',
   'A OS é o documento que prova que o colaborador FOI INFORMADO dos riscos da função e das medidas de prevenção — gerada a partir do PGR interpretado, por função, e assinada (ciência). Sem OS assinada, a empresa não prova a informação do risco, e a multa vem acompanhada do agravamento de qualquer acidente. Colaborador novo ou mudança de função exigem OS nova.',
   'Função com riscos extraídos do PGR; colaborador vinculado à função.',
   '[{"ordem":1,"acao":"Gerar a OS da função","resultado_esperado":"Riscos, medidas e procedimentos da função no documento, derivados do PGR"},
     {"ordem":2,"acao":"Colher a ciência do colaborador","resultado_esperado":"Assinatura com trilha; OS arquivada na pasta do colaborador"},
     {"ordem":3,"acao":"Admitir colaborador novo na função","resultado_esperado":"OS pendente de ciência apontada — não fica esquecida"}]'::jsonb,
   'Risco informado é risco assinado — por função, por pessoa.',
   'Requisitos YE-DP-SST-001: RF-010 / CA-002 / seção 16. Existe ordem_servico_links (infraestrutura de assinatura); a GERAÇÃO por função a partir dos riscos, não. Modelos por cliente são [DAE] (seção 30).'),

  (v_mod, 'SST-011', 'Ficha de EPI: entrega só com CA vigente, assinatura e treinamento',
   'negativo', 'alta', 'aprovado', 'api',
   'NR-6 (fornecimento gratuito, CA válido, registro de entrega e treinamento)',
   'O subsistema de EPI já controla tipos, CAs (CETs), entregas e estoque — o que o caso cobra é a REGRA na entrega: EPI só sai com CA vigente (entrega com CA vencido é como não ter entregue), a ficha registra a assinatura do colaborador e o treinamento de uso fica evidenciado. A ficha de EPI por função, derivada do PGR, fecha o ciclo: o que a função exige × o que foi entregue.',
   'EPI cadastrado com CA vencido e outro com CA vigente; colaborador com função de risco.',
   '[{"ordem":1,"acao":"Tentar registrar entrega de EPI com CA vencido","resultado_esperado":"Bloqueada — CA vigente é condição da entrega válida"},
     {"ordem":2,"acao":"Entregar EPI com CA vigente","resultado_esperado":"Ficha gerada com assinatura do colaborador e treinamento registrado"},
     {"ordem":3,"acao":"Conferir a função contra a ficha","resultado_esperado":"EPIs exigidos pela função (PGR) × entregues — pendência apontada"}]'::jsonb,
   'CA vencido não protege ninguém — nem a empresa na fiscalização.',
   'Requisitos YE-DP-SST-001: RN-007 / CA-008 / RF-004. O subsistema existe (epi_tipos/cets/entregas — EPI-001 cobre estoque); a TRAVA de CA na entrega e a ficha por função, a sonda confere. A neutralização do adicional é o SST-050.'),

  -- ══════════ C) PCMSO E ASO: PERIODICIDADE E MUDANÇA ══════════

  (v_mod, 'SST-020', 'Exame periódico agendado pela periodicidade do risco — antes de vencer',
   'feliz', 'critica', 'aprovado', 'api',
   'NR-7 (exame periódico com periodicidade conforme risco/idade; ASO com validade)',
   'O periódico não é evento — é ciclo: cada colaborador tem a próxima data calculada pela periodicidade do seu risco (extraída do PCMSO), e o sistema avisa com 30/15/7 dias, agenda e acusa o vencido. ASO vencido de quem segue trabalhando é a autuação mais fácil da fiscalização — e o primeiro item checado depois de qualquer acidente.',
   'Colaboradores com ASO registrado e periodicidade definida por função/risco.',
   '[{"ordem":1,"acao":"Registrar ASO periódico com periodicidade de 12 meses","resultado_esperado":"Próximo exame calculado e agendado automaticamente"},
     {"ordem":2,"acao":"Aproximar-se do vencimento","resultado_esperado":"Alertas 30/15/7 dias a SST/DP/colaborador"},
     {"ordem":3,"acao":"Deixar vencer sem novo exame","resultado_esperado":"ASO VENCIDO acusado no painel, com ação crítica — nunca silêncio"}]'::jsonb,
   'O periódico se agenda sozinho; o vencido grita.',
   'Requisitos YE-DP-SST-001: RN-002 / alerta "ASO a vencer" (seção 14) / cenário "Normal" (seção 25). periodicidade_exame_meses existe no cadastro — a sonda confere se alguém CALCULA a próxima data e vigia. O admissional é ADM-060..; o demissional, DESL-060...'),

  (v_mod, 'SST-021', 'Mudança de função com risco novo exige ASO de mudança e atualiza OS/ficha',
   'alternativo', 'alta', 'aprovado', 'api',
   'NR-7 (exame de mudança de riscos ocupacionais, antes da mudança)',
   'Trocar de função é trocar de exposição: se a função nova tem risco diferente, o ASO de mudança é obrigatório ANTES da alteração — e a mudança em cadeia não termina no exame: a OS e a ficha de EPI da função nova precisam ser regeradas com ciência, e o adicional na Folha revisto. A transferência silenciosa, sem exame, deixa o colaborador exposto a risco não avaliado.',
   'Colaborador em função sem risco transferido para função com risco cadastrado no PGR.',
   '[{"ordem":1,"acao":"Registrar a mudança para função de risco diferente","resultado_esperado":"ASO de mudança de risco exigido antes de efetivar"},
     {"ordem":2,"acao":"Registrar o ASO apto","resultado_esperado":"Mudança efetivada; OS e ficha de EPI da função nova geradas com ciência pendente"},
     {"ordem":3,"acao":"Conferir a Folha","resultado_esperado":"Adicional revisto conforme o risco da função nova (integração)"}]'::jsonb,
   'Função nova, exame novo, OS nova — antes, nunca depois.',
   'Requisitos YE-DP-SST-001: RN-002 / cenário "Mudança de risco" (seção 25). Nenhum dos quatro eventos de ASO cobertos (admissão/retorno/demissão) trata a MUDANÇA — este é o vão. Deve falhar e encaminhar.'),

  -- ══════════ D) eSOCIAL SST: S-2220 E S-2240 ══════════

  (v_mod, 'SST-030', 'S-2220 do ASO transmitido até o dia 15 do mês seguinte',
   'excecao', 'alta', 'aprovado', 'api',
   'eSocial — S-2220 (monitoramento da saúde: até o dia 15 do mês seguinte à emissão do ASO)',
   'Cada ASO emitido vira um S-2220 com prazo: dia 15 do mês seguinte. A tela de transmissão do eSocial já conhece os eventos SST — o que o caso cobra é o RELÓGIO: ASO registrado projeta a data-limite do evento, o alerta corre até o dia 15 e a transmissão tardia é acusada. ASO em dia com S-2220 esquecido é multa silenciosa acumulando por competência.',
   'ASOs registrados em competências distintas no ambiente de teste.',
   '[{"ordem":1,"acao":"Registrar um ASO","resultado_esperado":"S-2220 preparado com data-limite no dia 15 do mês seguinte"},
     {"ordem":2,"acao":"Aproximar-se do dia 15 sem transmitir","resultado_esperado":"Alerta a SST/DP com escalada"},
     {"ordem":3,"acao":"Transmitir após o prazo","resultado_esperado":"Marcado FORA DO PRAZO com trilha — nunca como regular"}]'::jsonb,
   'Todo ASO carrega um evento com data — e a data é vigiada.',
   'Requisitos YE-DP-SST-001: RN-009 / CA-006 / RNF-002. esocial_transmissoes já recebe S-2220 pela tela; o motor de prazo, não. Anti-duplicidade/rejeição é a série ADM-093..DESL-094.'),

  (v_mod, 'SST-031', 'S-2240 acompanha a exposição: admissão e mudança de agente, até o dia 15',
   'excecao', 'alta', 'aprovado', 'api',
   'eSocial — S-2240 (condições ambientais/agentes nocivos: até o dia 15 do mês seguinte à admissão ou alteração); Lei 8.213/1991 (base do PPP)',
   'O S-2240 é a fotografia da exposição do colaborador aos agentes do LTCAT — devido na admissão e a CADA alteração de exposição (mudança de função, novo laudo, EPI que neutraliza), até o dia 15 do mês seguinte. É ele que constrói o PPP eletrônico: exposição sem S-2240 é aposentadoria especial mal instruída lá na frente, quando não dá mais para reconstituir.',
   'Colaborador exposto a agente do LTCAT; mudança de exposição simulada.',
   '[{"ordem":1,"acao":"Admitir colaborador em função com agente nocivo","resultado_esperado":"S-2240 preparado com a exposição do LTCAT, prazo dia 15 do mês seguinte"},
     {"ordem":2,"acao":"Alterar a exposição (novo laudo/função)","resultado_esperado":"Novo S-2240 de alteração preparado com prazo próprio"},
     {"ordem":3,"acao":"Conferir o histórico","resultado_esperado":"Linha de exposição contínua e consistente — a matéria-prima do PPP (SST-060)"}]'::jsonb,
   'Cada mudança de exposição vira evento — o PPP de amanhã agradece.',
   'Requisitos YE-DP-SST-001: RN-005 / CA-007 / RNF-002. A geração a partir do LTCAT interpretado não existe — deve falhar e encaminhar. Consistência PGR-LTCAT é o SST-070.'),

  -- ══════════ E) CIPA E CANAL DE ASSÉDIO ══════════

  (v_mod, 'SST-040', 'CIPA dimensionada pelo Quadro I, com mandato e atas arquivadas',
   'feliz', 'media', 'aprovado', 'api',
   'NR-5 (dimensionamento pelo Quadro I; mandato de 1 ano + reeleição; reuniões mensais com ata; designado quando não há CIPA)',
   'A CIPA nasce do DIMENSIONAMENTO: o Quadro I da NR-5 cruza o número de empregados com o grupo do CNAE e diz quantos titulares e suplentes a empresa precisa — ou se basta o designado. O sistema deve calcular a obrigação por estabelecimento, controlar mandato (1 ano, uma reeleição consecutiva para representantes dos empregados) e arquivar as atas das reuniões mensais, que são a prova de que a comissão existe de fato.',
   'Estabelecimentos fictícios com efetivos e CNAEs distintos.',
   '[{"ordem":1,"acao":"Consultar o dimensionamento do estabelecimento com 120 empregados","resultado_esperado":"Composição exigida pelo Quadro I (titulares/suplentes) calculada"},
     {"ordem":2,"acao":"Estabelecimento pequeno sem obrigação de CIPA","resultado_esperado":"Designado exigido no lugar da comissão"},
     {"ordem":3,"acao":"Registrar mandato e atas","resultado_esperado":"Vigência do mandato controlada (alerta de eleição) e atas arquivadas com assinatura"}]'::jsonb,
   'Quantos, quem e até quando — o Quadro I responde e o sistema cobra.',
   'Requisitos YE-DP-SST-001: RN-006 / RF-003. Não existe estrutura de CIPA no sistema (nenhuma tabela) — deve falhar e encaminhar. Dimensionamento é [RCE] por porte/CNAE (seção 30).'),

  (v_mod, 'SST-041', 'Canal de denúncias de assédio: sigilo reforçado e prazos da Lei 14.457',
   'negativo', 'critica', 'aprovado', 'api',
   'Lei 14.457/2022 (canal de denúncias com anonimato/sigilo, apuração e medidas); NR-5 (CIPA na prevenção do assédio)',
   'Desde a Lei 14.457, empresa com CIPA precisa de canal de denúncias com garantia de sigilo/anonimato, procedimento de apuração e prazo de tratativa. O sigilo aqui é mais duro que o do CID: a identidade de quem denuncia não pode vazar nem para o gestor da área denunciada — acesso mínimo, log próprio e denúncias fora dos relatórios comuns. Canal que vaza é pior que canal que não existe.',
   'Canal de denúncias com registros fictícios no tenant de teste.',
   '[{"ordem":1,"acao":"Registrar denúncia anônima","resultado_esperado":"Aceita sem identificação obrigatória; protocolo gerado para acompanhamento"},
     {"ordem":2,"acao":"Gestor da área tenta acessar a denúncia","resultado_esperado":"Bloqueado — acesso restrito ao fluxo de apuração; tentativa logada"},
     {"ordem":3,"acao":"Conferir a tratativa","resultado_esperado":"Prazo de apuração vigiado; medidas registradas sem expor o denunciante"}]'::jsonb,
   'A denúncia anda; a identidade fica — trancada e com registro de quem tentou.',
   'Requisitos YE-DP-SST-001: RN-006 / cenário "CIPA/assédio" (seção 25). A família PSICO cobre os riscos psicossociais (questionários/entrevistas com camada de perfil); o CANAL de denúncias formal da 14.457, não. Deve falhar e encaminhar.'),

  -- ══════════ F) LAUDOS → FOLHA E PPP ══════════

  (v_mod, 'SST-050', 'Enquadramento do laudo vira adicional na Folha — e o EPI pode neutralizar',
   'alternativo', 'alta', 'aprovado', 'api',
   'NR-15/NR-16; CLT arts. 191..194 (eliminação/neutralização por EPC/EPI cessa o adicional); Súmula 80 do TST',
   'O laudo é a origem do adicional: enquadramento extraído (insalubridade por grau, periculosidade) alimenta a Folha por função/colaborador — e o caminho de volta também vale: EPI eficaz, entregue e treinado pode NEUTRALIZAR a insalubridade e cessar o adicional (art. 191), decisão que exige laudo e é [VAL]. Sem a ponte laudo→folha, o adicional vive de digitação; sem a neutralização, a empresa paga adicional de risco que o EPI já eliminou.',
   'Laudo com enquadramento extraído; função vinculada; EPI eficaz entregue no cenário de neutralização.',
   '[{"ordem":1,"acao":"Importar laudo com insalubridade grau médio para a função","resultado_esperado":"Enquadramento extraído e adicional de 20% sinalizado à Folha, com o laudo-fonte"},
     {"ordem":2,"acao":"Registrar neutralização por EPI (com laudo)","resultado_esperado":"Adicional cessado a partir da neutralização, com evidência e marcação [VAL]"},
     {"ordem":3,"acao":"Vencer o CA do EPI neutralizador","resultado_esperado":"Neutralização cai e o adicional volta — o vínculo é vivo, não um flag"}]'::jsonb,
   'O laudo liga o adicional; o EPI eficaz desliga; o CA vencido religa.',
   'Requisitos YE-DP-SST-001: RN-004/RN-007 / CA-008 / cenário "Insalubridade" (seção 25). O CÁLCULO do adicional é FOLHA-021; aqui se testa a ORIGEM (laudo→enquadramento→função) e a neutralização. Base da insalubridade é [VAL] (seção 30).'),

  (v_mod, 'SST-060', 'PPP gerado do histórico de exposição (LTCAT/S-2240)',
   'feliz', 'media', 'aprovado', 'api',
   'Lei 8.213/1991, arts. 57-58; PPP eletrônico via eSocial (a partir dos S-2240)',
   'O PPP é a biografia previdenciária da exposição: gerado do LTCAT e da linha de S-2240 do colaborador, entregue no desligamento de quem teve exposição e sob demanda para a aposentadoria especial. Ele não se escreve na hora — se o histórico de exposição não foi mantido (SST-031), o PPP sai furado e o problema aparece anos depois, no INSS, sem como reconstituir.',
   'Colaborador com histórico de exposição registrado (agente, período, EPI).',
   '[{"ordem":1,"acao":"Solicitar o PPP do colaborador exposto","resultado_esperado":"Documento gerado do histórico (agentes, períodos, medições do LTCAT, EPI/EPC)"},
     {"ordem":2,"acao":"Desligar colaborador com exposição","resultado_esperado":"PPP incluído no dossiê da rescisão"},
     {"ordem":3,"acao":"Conferir a consistência","resultado_esperado":"Linha do PPP bate com os S-2240 transmitidos — sem buracos"}]'::jsonb,
   'A aposentadoria especial se instrui todo mês — o PPP só imprime.',
   'Requisitos YE-DP-SST-001: RF-007 / CA-010 / cenário "Aposentadoria especial" (seção 25). Depende do histórico do SST-031. Não existe estrutura de PPP — deve falhar e encaminhar.'),

  -- ══════════ G) COERÊNCIA E SIGILO ══════════

  (v_mod, 'SST-070', 'Coerência documental: PGR, LTCAT, PCMSO e ASO falam dos mesmos riscos',
   'alternativo', 'media', 'aprovado', 'api',
   'NR-1 e NR-7 (PCMSO baseado no PGR); Lei 8.213/1991 (LTCAT coerente com a exposição declarada); RNF-009 do documento',
   'Os documentos de SST formam um sistema: o PCMSO deve examinar os riscos que o PGR inventariou; o LTCAT deve medir os agentes que o PGR apontou; o S-2240 deve declarar o que o LTCAT mediu. Divergência entre eles — risco no PGR sem exame no PCMSO, agente no LTCAT ausente do PGR — é a inconsistência que a fiscalização procura primeiro, porque derruba a credibilidade do conjunto.',
   'Documentos importados com riscos extraídos; divergência proposital entre eles.',
   '[{"ordem":1,"acao":"Rodar a conferência de coerência","resultado_esperado":"Cruzamento PGR × PCMSO × LTCAT × S-2240 com as divergências listadas"},
     {"ordem":2,"acao":"Risco no PGR sem exame correspondente no PCMSO","resultado_esperado":"Divergência apontada com os dois documentos-fonte"},
     {"ordem":3,"acao":"Sanar e reconferir","resultado_esperado":"Painel limpo; conferência arquivada como evidência"}]'::jsonb,
   'Quatro documentos, uma só base de riscos — e o sistema confere o alinhamento.',
   'Requisitos YE-DP-SST-001: RNF-009 / seção 29 ("coerência documental automática") / seção 13. Depende da extração (SST-002). [BPR] com fundamento estrutural nas NRs — deve falhar e encaminhar.'),

  (v_mod, 'SST-080', 'Dado clínico de SST: restrito à medicina, com log próprio — o gestor vê aptidão, não diagnóstico',
   'negativo', 'critica', 'aprovado', 'api',
   'LGPD (Lei 13.709/2018), arts. 11 e 46; NR-7 (prontuário sob responsabilidade do médico); matriz de perfis (seção 6)',
   'No SST circulam três camadas de informação: o ADMINISTRATIVO (apto/inapto, datas, pendências — que DP e gestor precisam ver), o CLÍNICO (exames, resultados, CID — só medicina/SST) e as DENÚNCIAS (sigilo reforçado — SST-041). O caso confere a separação: a aptidão flui para Admissão/Afastamentos sem carregar o diagnóstico junto, as tabelas clínicas ficam na camada de perfil e o acesso ao dado clínico gera log próprio.',
   'ASOs e eventos de saúde no tenant de teste; usuários de perfis distintos.',
   '[{"ordem":1,"acao":"DP consulta a situação do ASO de um colaborador","resultado_esperado":"Vê apto/inapto e validade — sem resultados de exames nem CID"},
     {"ordem":2,"acao":"Médico do trabalho acessa o prontuário","resultado_esperado":"Acesso completo, registrado em log específico (quem, quando, qual registro)"},
     {"ordem":3,"acao":"Perfil sem o módulo de saúde tenta ler eventos_saude/aso","resultado_esperado":"Bloqueado pela camada perfil_restringe_leitura_*"},
     {"ordem":4,"acao":"Exportar relatório de exames","resultado_esperado":"Dados clínicos protegidos na exportação (seção 21)"}]'::jsonb,
   'Aptidão circula, diagnóstico não — e quem abre o clínico deixa rastro.',
   'Requisitos YE-DP-SST-001: CA-009 / RNF-001 / seção 22 / cenário "Permissões (clínico)" (seção 25). eventos_saude e atestados já estão na camada de perfil (ponto bom); a separação aptidão×clínico e o log de acesso, a sonda confere. Par do AFAST-080 (CID nos afastamentos).')

  ON CONFLICT (codigo) DO NOTHING;

  -- ---------------------------------------------------------
  -- Referências cruzadas em casos de outras famílias
  -- (só acrescenta às observações, não reescreve)
  -- ---------------------------------------------------------
  UPDATE public.qa_casos_teste SET observacoes = observacoes ||
    ' Requisitos YE-DP-SST-001: o lado SST (documentos, periodicidade, OS/ficha, eSocial SST) está na família SST-001..080.'
  WHERE codigo IN ('ADM-060','DESL-060','AFAST-030','AFAST-070','AFAST-080','FOLHA-021','FOLHA-050','EPI-001')
    AND position('YE-DP-SST-001' IN observacoes) = 0;

  SELECT count(*) INTO v_depois FROM public.qa_casos_teste WHERE modulo_id = v_mod;
  RAISE NOTICE 'SST/Compliance: % casos antes, % depois (esperado +15 na primeira execução).', v_antes, v_depois;
END $doc$;
