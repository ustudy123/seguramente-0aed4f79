-- =========================================================
-- QA — Rescisão/Desligamento: casos derivados da Análise de Requisitos
-- do módulo (documento YE-DP-RESC-001, Google Doc "YE — Rescisão e
-- Desligamento — Análise de Requisitos", data-base ago/2026).
--
-- MÉTODO: as 9 regras de negócio (RN-001..009), os 9 critérios de
-- aceite (CA-001..009), os 12 cenários de teste (seção 25) e os fluxos
-- alternativos (seção 9) foram cruzados um a um com a família
-- DESL-001..104 já registrada (54 casos — a mais completa do motor).
-- Como sempre: os casos descrevem o que a LEI e o documento exigem,
-- não o que o sistema faz hoje.
--
-- JÁ COBERTO (sem caso novo; registrado para a rastreabilidade):
--   RN-001/CA-001 verbas por modalidade ......... DESL-021/032..044
--   RN-002/CA-002 estabilidades ................. DESL-070..077
--   RN-003/CA-003 aviso proporcional + redução .. DESL-030/031/037
--   CA-004 acordo 484-A (aviso ½, FGTS 20%) ..... DESL-034/041/051
--   RN-004 prazo de 10 dias (data-limite) ....... DESL-014
--   RN-005 FGTS 40%/20% por modalidade .......... DESL-040..043
--   RN-006 S-2299/S-2399 existem como eventos ... DESL-090..092
--   RN-008 seguro-desemprego por modalidade ..... DESL-050..052
--   Saque do FGTS por hipótese .................. DESL-055
--   ASO demissional (NR-07) ..................... DESL-060..067
--   Homologação (fim da obrigatoriedade/CCT) .... DESL-080/081
--   Integridade da confirmação .................. DESL-100..104
--
-- SEM COBERTURA — este arquivo documenta 14 casos novos:
--   prazo: multa do §8º sinalizada no atraso e antecipação por dia não
--   útil (DESL-015); modalidades: falecimento com verbas aos sucessores
--   (DESL-023), rescisão antecipada de contrato a termo — indenizações
--   dos arts. 479/480 (DESL-024), justa causa/indireta exigem validação
--   jurídica (DESL-025); verbas: incidências das indenizatórias
--   (DESL-045), médias de variáveis na base (DESL-046); FGTS Digital:
--   guia rescisória + contingência (DESL-057); documentos: TRCT
--   discriminado e quitação assinada (DESL-082), assistência ao menor
--   (DESL-083); eSocial: prazo do S-2299 (DESL-093), rejeição traduzida
--   sem duplicidade (DESL-094); pós-desligamento: rescisão complementar
--   (DESL-105), reversão com rito (DESL-106); LGPD: acesso por perfil
--   ao dossiê (DESL-110).
--
-- ESTA MIGRATION SÓ DOCUMENTA. Rotinas em leva futura.
-- =========================================================

SET lock_timeout = '10s';

DO $doc$
DECLARE v_mod uuid; v_antes int; v_depois int;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos
  WHERE path = 'estrutura-organizacional/colaboradores/desligamento';
  IF v_mod IS NULL THEN RAISE EXCEPTION 'Módulo de desligamento não encontrado.'; END IF;
  SELECT count(*) INTO v_antes FROM public.qa_casos_teste WHERE modulo_id = v_mod;

  INSERT INTO public.qa_casos_teste
    (modulo_id, codigo, titulo, tipo, prioridade, status, nivel,
     base_legal, objetivo, pre_condicoes, passos, resultado_esperado, observacoes)
  VALUES

  -- ══════════ A) PRAZO: MULTA E ANTECIPAÇÃO ══════════

  (v_mod, 'DESL-015', 'Pagamento no 11º dia sinaliza a multa do §8º; dia não útil antecipa',
   'excecao', 'critica', 'aprovado', 'api',
   'CLT, art. 477, §§6º e 8º',
   'O DESL-014 garante que a data-limite (término + 10 dias corridos) é exibida; este caso cobra o DEPOIS: registrado o pagamento no 11º dia, o sistema sinaliza a multa do §8º (um salário ao empregado) em vez de aceitar em silêncio — e quando o 10º dia cai em fim de semana ou feriado, a data-alvo anda para TRÁS, para o dia útil anterior, nos alertas D-5/3/1.',
   'Desligamento confirmado com data-limite conhecida; tabela de feriados carregada.',
   '[{"ordem":1,"acao":"Registrar pagamento das verbas no 11º dia após o término","resultado_esperado":"Atraso acusado com a multa do §8º calculada (um salário), nunca aceitação silenciosa"},
     {"ordem":2,"acao":"Simular término cujo 10º dia cai no sábado","resultado_esperado":"Data-alvo antecipada para a sexta-feira; alertas contados sobre a data antecipada"},
     {"ordem":3,"acao":"Conferir o painel de prazos","resultado_esperado":"Rescisões com prazo em risco visíveis com a multa evitável projetada"}]'::jsonb,
   'Prazo estourado tem nome e valor; dia não útil nunca empurra para depois.',
   'Requisitos YE-DP-RESC-001: RN-004 / CA-005 / cenário "Prazo vencido" (seção 25) / RNF-002. A contagem (corridos × úteis) é [VAL] (seção 30) — o caso segue a interpretação consolidada de dias corridos já adotada no DESL-014.'),

  -- ══════════ B) MODALIDADES AINDA SEM CASO ══════════

  (v_mod, 'DESL-023', 'Falecimento do empregado: verbas aos dependentes, sem aviso nem multa',
   'excecao', 'media', 'aprovado', 'e2e',
   'Lei 6.858/1980 (pagamento aos dependentes habilitados); CLT (extinção pelo falecimento)',
   'O falecimento extingue o contrato sem aviso prévio e sem multa de FGTS: as verbas devidas (saldo, férias + 1/3, 13º proporcional) são pagas aos dependentes habilitados ou sucessores, mediante documentação própria — e o fluxo não pode exigir assinatura do "colaborador" nem gerar seguro-desemprego. O eSocial usa motivo específico de desligamento por óbito.',
   'Desligamento com motivo falecimento no ambiente de teste.',
   '[{"ordem":1,"acao":"Processar o desligamento por falecimento","resultado_esperado":"Sem aviso prévio e sem multa de FGTS; verbas devidas calculadas normalmente"},
     {"ordem":2,"acao":"Conferir o destinatário do pagamento","resultado_esperado":"Dependentes/sucessores com documentação exigida (Lei 6.858), não o CPF do falecido"},
     {"ordem":3,"acao":"Conferir assinatura e seguro-desemprego","resultado_esperado":"Fluxo de assinatura do colaborador dispensado; seguro-desemprego não ofertado"}]'::jsonb,
   'Óbito encerra sem aviso nem multa; quem recebe é o dependente habilitado.',
   'Requisitos YE-DP-RESC-001: fluxo "Falecimento" (seção 9). O motivo já existe na lista (DESL-021) e dispensa o retorno de suspensão (DESL-003); faltava o caso das VERBAS e do destinatário.'),

  (v_mod, 'DESL-024', 'Contrato a termo rescindido antes do prazo: indenizações dos arts. 479 e 480',
   'alternativo', 'alta', 'aprovado', 'e2e',
   'CLT, arts. 479 (empregador indeniza metade do período restante) e 480 (empregado indeniza os prejuízos, limitado ao art. 479)',
   'Contrato por prazo determinado rescindido ANTES do termo tem regra própria, e ela muda de lado: o empregador que dispensa sem justa causa paga metade da remuneração do período restante (art. 479); o empregado que pede demissão indeniza o empregador pelos prejuízos, no teto do art. 479 (art. 480). Sem cláusula assecuratória recíproca (art. 481), não há aviso prévio — há indenização.',
   'Contratos a termo fictícios (experiência/determinado) com término futuro conhecido.',
   '[{"ordem":1,"acao":"Empregador rescinde a termo faltando 60 dias","resultado_esperado":"Indenização do art. 479: metade da remuneração dos 60 dias restantes, na memória de cálculo"},
     {"ordem":2,"acao":"Empregado pede demissão faltando 60 dias","resultado_esperado":"Indenização do art. 480 a favor do empregador, limitada ao valor do art. 479"},
     {"ordem":3,"acao":"Contrato com cláusula assecuratória (art. 481)","resultado_esperado":"Tratado como prazo indeterminado: aviso prévio em vez das indenizações"}]'::jsonb,
   'Antecipou o fim do termo: indenização certa, do lado certo, com o teto certo.',
   'Requisitos YE-DP-RESC-001: fluxo "Contrato por prazo determinado" (seção 9) / base legal arts. 479/480. O DESL-033 trata o AVISO no termo final e só cita a antecipação; este caso cobra o cálculo das indenizações.'),

  (v_mod, 'DESL-025', 'Justa causa e rescisão indireta exigem validação de perfil competente',
   'negativo', 'alta', 'aprovado', 'api',
   'CLT, arts. 482 e 483; matriz de perfis do documento (seção 6) — jurídico valida o enquadramento',
   'Justa causa mal enquadrada é a modalidade que mais vira reversão judicial com verbas dobradas de volta. O documento exige que o enquadramento (art. 482) e a rescisão indireta (art. 483) passem por validação de perfil competente (jurídico), com as evidências anexadas — o DP sozinho não conclui, e a trilha registra quem validou o quê.',
   'Desligamento aberto com motivo justa causa por usuário de DP, sem validação jurídica.',
   '[{"ordem":1,"acao":"Tentar concluir a justa causa sem a validação competente","resultado_esperado":"Retido — exige aprovação do perfil jurídico (ou papel configurado)"},
     {"ordem":2,"acao":"Anexar evidências e validar com o perfil competente","resultado_esperado":"Conclusão liberada; trilha registra validador, data e evidências"},
     {"ordem":3,"acao":"Repetir com rescisão indireta (art. 483)","resultado_esperado":"Mesmo rito de validação, no sentido inverso (falta grave do empregador)"}]'::jsonb,
   'Modalidade grave só conclui com o crivo de quem responde por ela.',
   'Requisitos YE-DP-RESC-001: RF-001 / cenário "Permissões insuficientes" (seção 25) / alerta "Modalidade a validar" (seção 14). O enquadramento em si é [VAL] jurídico — o caso testa o RITO, não o mérito.'),

  -- ══════════ C) VERBAS: INCIDÊNCIAS E MÉDIAS ══════════

  (v_mod, 'DESL-045', 'Verbas indenizatórias sem INSS/IRRF; saldo de salário com',
   'feliz', 'alta', 'aprovado', 'e2e',
   'Lei 8.212/1991, art. 28, §9º; IN RFB; jurisprudência consolidada (aviso indenizado e férias indenizadas + 1/3 não integram o salário de contribuição)',
   'A rescisão mistura naturezas: saldo de salário e 13º proporcional sofrem INSS/IRRF; aviso prévio INDENIZADO e férias INDENIZADAS + 1/3 são verbas indenizatórias — fora da base de INSS/IRRF conforme a jurisprudência consolidada. Tributar tudo igual desconta a mais do desligado; isentar tudo deixa encargo patronal para trás. A memória de cálculo precisa mostrar verba a verba a incidência aplicada.',
   'Rescisão sem justa causa com aviso indenizado, férias vencidas + proporcionais e 13º proporcional.',
   '[{"ordem":1,"acao":"Calcular a rescisão e abrir a memória","resultado_esperado":"Cada verba com a natureza (remuneratória/indenizatória) e as incidências marcadas"},
     {"ordem":2,"acao":"Conferir INSS/IRRF do aviso indenizado e das férias indenizadas","resultado_esperado":"Fora da base — sem retenção sobre as indenizatórias"},
     {"ordem":3,"acao":"Conferir saldo de salário e 13º proporcional","resultado_esperado":"Na base — INSS (com 13º em cálculo separado) e IRRF conforme tabelas vigentes"}]'::jsonb,
   'Cada verba com sua natureza; a memória prova o enquadramento.',
   'Requisitos YE-DP-RESC-001: RN-007 / seção 30 (tratamento tributário é [VAL] com a contabilidade). Regras por verba parametrizadas (RNF-003). O 13º na rescisão concilia com DEC13-060.'),

  (v_mod, 'DESL-046', 'Base das verbas rescisórias inclui as médias das variáveis',
   'feliz', 'alta', 'aprovado', 'e2e',
   'CLT, arts. 457/458 (remuneração); art. 487, §3º (aviso com base na remuneração); Súmula 347 do TST (média de horas extras nas verbas)',
   'Quem tem horas extras habituais, comissões ou adicionais não pode ter rescisão calculada só sobre o fixo: aviso indenizado, férias + 1/3 e 13º proporcional levam a MÉDIA das variáveis na base. Rescisão pelo fixo, para quem tem variável habitual, é a diferença mais comum em reclamatória — e a mais fácil de provar contra a empresa.',
   'Vínculo com salário fixo e variáveis habituais lançadas na folha; rescisão sem justa causa.',
   '[{"ordem":1,"acao":"Calcular a rescisão do vínculo com variáveis","resultado_esperado":"Base das verbas = fixo + média das variáveis, com a composição na memória"},
     {"ordem":2,"acao":"Conferir rubricas que integraram a média","resultado_esperado":"Somente rubricas parametrizadas (incide_rescisao) e do período correto"},
     {"ordem":3,"acao":"Calcular com médias incompletas (competência sem lançamento)","resultado_esperado":"Alerta de base incompleta ANTES de fechar as verbas"}]'::jsonb,
   'Variável habitual entra na rescisão pela média — e avisada quando faltar.',
   'Requisitos YE-DP-RESC-001: RF-004 / cenário "Dado ausente" (seção 25) / dado "Médias de variáveis" (seção 12). folha_rubricas.incide_rescisao existe — o caso testa se alguém a consome (par do DEC13-020 no 13º).'),

  -- ══════════ D) FGTS DIGITAL ══════════

  (v_mod, 'DESL-057', 'Guia rescisória no FGTS Digital com o percentual da modalidade e contingência',
   'alternativo', 'alta', 'aprovado', 'api',
   'Lei 8.036/1990; FGTS Digital (guia rescisória); CLT, art. 484-A (20% no acordo)',
   'Apurada a multa (40% sem justa causa; 20% no acordo; zero em pedido/justa causa — DESL-040..043), o recolhimento acontece no FGTS DIGITAL: a guia rescisória é gerada com base e percentual da modalidade e prazo próprio. Indisponibilidade do serviço não pode perder o prazo: a guia entra em fila de reprocessamento com alerta, e o comprovante final é arquivado no dossiê.',
   'Rescisão sem justa causa apurada, com base de FGTS conhecida.',
   '[{"ordem":1,"acao":"Gerar a guia rescisória","resultado_esperado":"Guia do FGTS Digital com base, percentual da modalidade (40%) e prazo"},
     {"ordem":2,"acao":"Simular indisponibilidade do FGTS Digital","resultado_esperado":"Fila de reprocessamento + alerta; a guia não se perde nem o prazo passa em silêncio"},
     {"ordem":3,"acao":"Recolher e anexar o comprovante","resultado_esperado":"Comprovante arquivado em Documentos, vinculado ao desligamento"}]'::jsonb,
   'Multa certa, guia gerada, contingência sem perder o prazo.',
   'Requisitos YE-DP-RESC-001: RN-005 / CA-006 / fluxo "FGTS Digital indisponível" (seção 9) / RNF-008. O fluxo vigente do FGTS Digital é [VAL] (seção 30). Percentuais já testados em DESL-040..043 — aqui se testa a GUIA e a contingência.'),

  -- ══════════ E) DOCUMENTOS: TRCT, QUITAÇÃO E MENOR ══════════

  (v_mod, 'DESL-082', 'TRCT discrimina as verbas e a quitação assinada é arquivada',
   'feliz', 'alta', 'aprovado', 'e2e',
   'CLT, art. 477, caput e §2º (instrumento de rescisão com especificação das parcelas e valores)',
   'O TRCT precisa DISCRIMINAR verba a verba — natureza e valor de cada parcela (§2º) — e a quitação vale pelo que está escrito e assinado. O fluxo completo: TRCT gerado da memória de cálculo (mesmos números), assinatura das partes com trilha, e a versão ASSINADA arquivada automaticamente na pasta do colaborador. TRCT genérico ou divergente da memória não quita nada.',
   'Rescisão apurada com verbas calculadas e memória disponível.',
   '[{"ordem":1,"acao":"Gerar o TRCT","resultado_esperado":"Parcelas discriminadas uma a uma, batendo com a memória de cálculo"},
     {"ordem":2,"acao":"Colher as assinaturas (colaborador e empresa)","resultado_esperado":"Trilha com signatário, data/hora e integridade do documento"},
     {"ordem":3,"acao":"Concluir e conferir Documentos","resultado_esperado":"TRCT e termo de quitação ASSINADOS arquivados na pasta Funcionário › Rescisão"}]'::jsonb,
   'O que se paga é o que está discriminado; o que se arquiva é o que foi assinado.',
   'Requisitos YE-DP-RESC-001: RF-005 / CA-008 / seção 16 (pastas). Espelha o ADM-070 (assinatura trava a conclusão) no fim do ciclo do vínculo.'),

  (v_mod, 'DESL-083', 'Quitação de menor de 18 anos exige assistência do responsável',
   'negativo', 'media', 'aprovado', 'api',
   'CLT, art. 439 — é lícito ao menor firmar recibo; quitação final só com assistência dos responsáveis legais',
   'Menor de 18 pode assinar recibos de pagamento no curso do contrato, mas a QUITAÇÃO FINAL da rescisão só vale com a assistência do responsável legal (art. 439). O sistema deve detectar a idade na data do término e exigir o assistente no fluxo de assinatura — quitação de menor sem assistência é nula e reabre a discussão de todas as verbas.',
   'Colaborador fictício com 17 anos na data do desligamento.',
   '[{"ordem":1,"acao":"Concluir a rescisão do menor sem dados do assistente","resultado_esperado":"Retido — assistência do responsável obrigatória na quitação"},
     {"ordem":2,"acao":"Registrar o responsável e colher as duas assinaturas","resultado_esperado":"Quitação válida; trilha registra menor + assistente"},
     {"ordem":3,"acao":"Repetir com colaborador de 18+","resultado_esperado":"Fluxo normal, sem exigência de assistente"}]'::jsonb,
   'Menor assina acompanhado — ou a quitação não fica de pé.',
   'Requisitos YE-DP-RESC-001: RN-009 / CA-008 / cenário "Menor de 18" (seção 25). Depende da data de nascimento no cadastro (mesma fonte do ADM-030/031).'),

  -- ══════════ F) eSOCIAL: PRAZO E REJEIÇÃO ══════════

  (v_mod, 'DESL-093', 'S-2299 transmitido em até 10 dias do desligamento — ou antes do pagamento',
   'excecao', 'alta', 'aprovado', 'api',
   'eSocial — prazo do S-2299: até 10 dias contados do desligamento, antecipado se o pagamento das verbas ocorrer antes',
   'Gerar o S-2299 (DESL-090/091) não basta: ele tem PRAZO — até 10 dias do desligamento, e ANTES disso se o pagamento das verbas acontecer primeiro. O sistema projeta a data-limite pelo que ocorrer primeiro (pagamento × 10º dia), alerta a aproximação e acusa a transmissão tardia como fora do prazo, sem fingir regularidade.',
   'Desligamento confirmado com data conhecida; pagamento agendado.',
   '[{"ordem":1,"acao":"Confirmar o desligamento","resultado_esperado":"Data-limite do S-2299 projetada (mín entre pagamento e 10º dia), com alertas"},
     {"ordem":2,"acao":"Registrar pagamento no 5º dia com S-2299 pendente","resultado_esperado":"Prazo reprojetado para antes do pagamento; pendência acusada como crítica"},
     {"ordem":3,"acao":"Transmitir no 12º dia","resultado_esperado":"Marcado FORA DO PRAZO, com alerta e ação no Plano de Ação — nunca silêncio"}]'::jsonb,
   'O S-2299 corre contra dois relógios — vence o que chegar primeiro.',
   'Requisitos YE-DP-RESC-001: RN-006 / CA-007 / alerta "S-2299 a transmitir" (seção 14). Prazo/leiaute vigentes são [VAL] (seção 30). Complementa DESL-090/091 (existência do evento) — par do ADM-071 no fim do vínculo.'),

  (v_mod, 'DESL-094', 'Rejeição do S-2299 é traduzida e o reenvio retifica, nunca duplica',
   'excecao', 'alta', 'aprovado', 'api',
   'eSocial — regras de retificação do S-2299; boa prática de integração',
   'Rejeição do S-2299 chega em código técnico; o DP precisa da tradução (o que houve, onde corrigir, ação sugerida) e de reenvio SEGURO: corrigido o dado, o reenvio retifica o evento — nunca cria segundo desligamento do mesmo vínculo no ambiente do governo. Desligamento duplicado no eSocial trava o vínculo para eventos futuros e vira passivo criado pela própria correção.',
   'Evento S-2299 rejeitado por inconsistência simulada no ambiente de teste.',
   '[{"ordem":1,"acao":"Receber a rejeição","resultado_esperado":"Explicação em linguagem simples + ação sugerida (Plano de Ação)"},
     {"ordem":2,"acao":"Corrigir e reenviar","resultado_esperado":"Evento aceito como retificação; nenhum S-2299 duplicado do vínculo"},
     {"ordem":3,"acao":"Conferir a trilha","resultado_esperado":"Rejeição, correção e recibo final encadeados no dossiê"}]'::jsonb,
   'Rejeição vira instrução; reenvio vira retificação, nunca clone.',
   'Requisitos YE-DP-RESC-001: cenário "Com erro" (seção 25) / RNF-008. Quarto da série ADM-093 / FERIAS-081 / DEC13-050 — a mesma disciplina de anti-duplicidade, agora no evento que encerra o vínculo.'),

  -- ══════════ G) PÓS-DESLIGAMENTO: COMPLEMENTAR E REVERSÃO ══════════

  (v_mod, 'DESL-105', 'Diferença após o desligamento gera rescisão complementar com S-2299 próprio',
   'alternativo', 'media', 'aprovado', 'api',
   'CLT, art. 477 (quitação das parcelas); eSocial — S-2299 complementar/retificação; prática consolidada de rescisão complementar (dissídio retroativo)',
   'Dissídio com reajuste retroativo, variável lançada tarde ou erro de cálculo descoberto depois geram DIFERENÇA a favor do desligado: a rescisão complementar apura só a diferença, vinculada à rescisão original, com pagamento e reflexo no eSocial — sem reabrir nem sobrescrever o TRCT já quitado. Ignorar a diferença é passivo; editar a rescisão paga é fraude de trilha.',
   'Rescisão concluída e paga; reajuste retroativo de CCT publicado depois.',
   '[{"ordem":1,"acao":"Registrar o reajuste retroativo da categoria","resultado_esperado":"Diferença detectada nas rescisões do período, com alerta a DP/Contador"},
     {"ordem":2,"acao":"Apurar a complementar","resultado_esperado":"Só a diferença, com memória própria e vínculo à rescisão original intacta"},
     {"ordem":3,"acao":"Transmitir e pagar","resultado_esperado":"S-2299 complementar/retificação no eSocial e pagamento rastreado"}]'::jsonb,
   'A diferença ganha rescisão própria; a original fica intocada na história.',
   'Requisitos YE-DP-RESC-001: RF-010 / CA-009 / cenário "Complementar" (seção 25) / alerta "Diferença/rescisão complementar" (seção 14). Par do DEC13-033 (complemento no 13º).'),

  (v_mod, 'DESL-106', 'Reversão do desligamento só com dupla aprovação, motivo e estorno rastreado',
   'excecao', 'alta', 'aprovado', 'api',
   'Documento YE-DP-RESC-001, RF-010; RNF-004 (log imutável); eSocial — exclusão/retificação de eventos',
   'Desligamento revertido (decisão judicial, acordo, erro operacional) não é DELETE: é reabertura controlada com motivo, dupla aprovação e trilha — estornando verbas pagas, revertendo o evento no eSocial pelas regras próprias e reativando o vínculo com os efeitos em cadeia (ponto, benefícios, férias) documentados. Reversão silenciosa deixa o governo com um desligamento que a empresa diz não existir.',
   'Desligamento concluído (com verbas e S-2299) no ambiente de teste.',
   '[{"ordem":1,"acao":"Tentar excluir/editar diretamente o desligamento concluído","resultado_esperado":"Bloqueado — só via fluxo de reversão"},
     {"ordem":2,"acao":"Abrir a reversão com motivo e duas aprovações","resultado_esperado":"Vínculo reativado; verbas estornadas com trilha; evento do eSocial tratado (exclusão/retificação)"},
     {"ordem":3,"acao":"Conferir a cadeia reativada","resultado_esperado":"Ponto, benefícios e contadores de férias/13º voltam a correr da data certa"}]'::jsonb,
   'Reverter é um fluxo com rito e estorno — nunca um apagar.',
   'Requisitos YE-DP-RESC-001: fluxo "Reversão do desligamento" (seção 9) / RF-010. Mesma disciplina de reabertura do FERIAS-054 e DEC13-070, com o agravante do evento já transmitido.'),

  -- ══════════ H) LGPD E PERFIS ══════════

  (v_mod, 'DESL-110', 'Dossiê rescisório restrito por perfil: gestor vê a equipe, colaborador só o seu',
   'negativo', 'alta', 'aprovado', 'api',
   'LGPD (Lei 13.709/2018), arts. 6º, VII, 11 e 46; matriz de perfis do documento (seção 6)',
   'A rescisão concentra o que o sistema tem de mais sensível: remuneração (verbas), saúde (estabilidade acidentária, ASO) e motivo do desligamento. A matriz do documento é explícita: gestor solicitante enxerga SÓ a própria equipe; colaborador desligado, só o próprio dossiê; jurídico/DP/financeiro conforme o papel — sempre dentro do tenant e com a camada RESTRICTIVE de perfil cobrindo as tabelas da rescisão.',
   'Usuários fictícios de perfis distintos no tenant de teste; rescisões de mais de um departamento.',
   '[{"ordem":1,"acao":"Colaborador consulta o próprio dossiê","resultado_esperado":"Permitido — TRCT, termos e comprovantes próprios"},
     {"ordem":2,"acao":"Colaborador tenta ler a rescisão de um colega","resultado_esperado":"Bloqueado pela política de acesso"},
     {"ordem":3,"acao":"Gestor consulta rescisão de OUTRO departamento","resultado_esperado":"Bloqueado — gestor só a própria equipe"},
     {"ordem":4,"acao":"Conferir a camada de perfil das tabelas da rescisão","resultado_esperado":"Política RESTRICTIVE presente (padrão perfil_restringe_leitura_*) ou exceção documentada"}]'::jsonb,
   'O fim do vínculo é o dado mais sensível dele — e o acesso mais estreito.',
   'Requisitos YE-DP-RESC-001: seções 6 e 22 / RNF-005. folha_rescisoes está fora da camada perfil_restringe_leitura_* (mesmo achado do DEC13-071 na folha de 13º) — a rotina PERFIL-003 cobra tabela sensível nova.')

  ON CONFLICT (codigo) DO NOTHING;

  -- ---------------------------------------------------------
  -- Melhorias em casos existentes: referência cruzada ao documento
  -- (só acrescenta às observações, não reescreve)
  -- ---------------------------------------------------------
  UPDATE public.qa_casos_teste SET observacoes = observacoes ||
    ' Requisitos YE-DP-RESC-001: RN-004/CA-005 — o pós-prazo (multa do §8º e antecipação por dia não útil) ganhou caso próprio (DESL-015).'
  WHERE codigo = 'DESL-014' AND position('YE-DP-RESC-001' IN observacoes) = 0;

  UPDATE public.qa_casos_teste SET observacoes = observacoes ||
    ' Requisitos YE-DP-RESC-001: RN-003/CA-003 (aviso proporcional da Lei 12.506/2011 e redução do art. 488).'
  WHERE codigo IN ('DESL-030','DESL-031','DESL-037') AND position('YE-DP-RESC-001' IN observacoes) = 0;

  UPDATE public.qa_casos_teste SET observacoes = observacoes ||
    ' Requisitos YE-DP-RESC-001: RN-005/CA-004/CA-006 (FGTS 40%/20% por modalidade) — a guia do FGTS Digital ganhou caso próprio (DESL-057).'
  WHERE codigo IN ('DESL-040','DESL-041','DESL-042','DESL-043') AND position('YE-DP-RESC-001' IN observacoes) = 0;

  UPDATE public.qa_casos_teste SET observacoes = observacoes ||
    ' Requisitos YE-DP-RESC-001: RN-002/CA-002 (estabilidades bloqueiam antes de concluir; jurídico acionado).'
  WHERE codigo IN ('DESL-070','DESL-071','DESL-072','DESL-073','DESL-077') AND position('YE-DP-RESC-001' IN observacoes) = 0;

  UPDATE public.qa_casos_teste SET observacoes = observacoes ||
    ' Requisitos YE-DP-RESC-001: RN-006/CA-007 — o PRAZO do S-2299 (10 dias/antes do pagamento) ganhou caso próprio (DESL-093) e a rejeição/anti-duplicidade também (DESL-094).'
  WHERE codigo IN ('DESL-090','DESL-091') AND position('YE-DP-RESC-001' IN observacoes) = 0;

  UPDATE public.qa_casos_teste SET observacoes = observacoes ||
    ' Requisitos YE-DP-RESC-001: cenário "Acordo 484-A" (seção 25) — aviso pela metade, FGTS 20%, sem seguro-desemprego.'
  WHERE codigo IN ('DESL-034','DESL-051') AND position('YE-DP-RESC-001' IN observacoes) = 0;

  SELECT count(*) INTO v_depois FROM public.qa_casos_teste WHERE modulo_id = v_mod;
  RAISE NOTICE 'Rescisão/Desligamento: % casos antes, % depois (esperado +14 na primeira execução).', v_antes, v_depois;
END $doc$;
