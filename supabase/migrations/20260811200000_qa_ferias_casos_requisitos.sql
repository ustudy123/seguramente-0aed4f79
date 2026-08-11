-- =========================================================
-- QA — Férias: casos de teste do documento de requisitos (11/08)
--
-- ORIGEM: documento "YourEyes — Módulo Férias — Requisitos" (v2):
-- motor de regras legais (seção 5), estados do ciclo (4.2),
-- integrações (6), financeiro (7) e os 17 casos críticos (seção 11).
--
-- PREMISSA PEDIDA E ADOTADA: os casos descrevem COMO O SISTEMA DEVE
-- SER para estar conforme a CLT — não como está hoje. O módulo
-- jornada-rotina/ferias não tinha NENHUM caso; estes nascem como
-- especificação executável. Enquanto o desenvolvimento não entrega as
-- funcionalidades, o motor reporta os casos como "não implementado" —
-- que é o estado honesto: a régua já existe, o sistema ainda não a
-- alcança. Cada caso cita a base legal e o CT do documento.
--
-- Fio condutor legal: CLT arts. 129 a 145 (férias), CF/88 art. 7º,
-- XVII (terço), Lei 13.467/2017 (fracionamento e fim da trava etária).
--
-- ESTA MIGRATION SÓ DOCUMENTA. Nenhuma rotina, nenhuma funcionalidade.
-- =========================================================

SET lock_timeout = '10s';

DO $doc$
DECLARE v_mod uuid; v_antes int; v_depois int;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos WHERE path = 'jornada-rotina/ferias';
  IF v_mod IS NULL THEN RAISE EXCEPTION 'Módulo jornada-rotina/ferias não encontrado.'; END IF;
  SELECT count(*) INTO v_antes FROM public.qa_casos_teste WHERE modulo_id = v_mod;

  INSERT INTO public.qa_casos_teste
    (modulo_id, codigo, titulo, tipo, prioridade, status, nivel,
     base_legal, objetivo, pre_condicoes, passos, resultado_esperado, observacoes)
  VALUES

  -- ══════════ A) DIREITO E PERÍODO AQUISITIVO ══════════

  (v_mod, 'FERIAS-001', 'Fechar o período aquisitivo calcula o direito pelo Ponto',
   'feliz', 'critica', 'aprovado', 'api',
   'CLT, art. 130 (escala de dias por faltas injustificadas); art. 129 (direito anual)',
   'Ao completar 12 meses de período aquisitivo, o sistema calcula os dias de direito pela escala do art. 130 usando as faltas injustificadas REAIS do módulo Ponto — com memória de cálculo auditável, sem apuração manual. Com até 5 faltas: 30 dias.',
   'Colaborador com período aquisitivo completo e até 5 faltas injustificadas no Ponto.',
   '[{"ordem":1,"acao":"Fechar o período aquisitivo","resultado_esperado":"Direito de 30 dias calculado automaticamente"},
     {"ordem":2,"acao":"Abrir a memória de cálculo","resultado_esperado":"Faltas consideradas listadas, com vínculo aos dias do Ponto"}]'::jsonb,
   'O direito nasce do dado real, com memória auditável.',
   'Documento de requisitos: seção 5 e CT-07; integração da seção 6 (Ponto).'),

  (v_mod, 'FERIAS-002', 'Escala do art. 130 nas quatro faixas e fronteiras',
   'alternativo', 'critica', 'aprovado', 'api',
   'CLT, art. 130, I a IV',
   'A escala é degrau, não proporção: 6 a 14 faltas = 24 dias; 15 a 23 = 18; 24 a 32 = 12; acima de 32 = perde o direito. As fronteiras (5/6, 14/15, 23/24, 32/33) são onde sistemas erram.',
   'Colaboradores de teste com 5, 6, 14, 15, 23, 24, 32 e 33 faltas injustificadas.',
   '[{"ordem":1,"acao":"Fechar o aquisitivo com 5 e com 6 faltas","resultado_esperado":"30 e 24 dias, respectivamente"},
     {"ordem":2,"acao":"Fechar com 14 e 15 faltas","resultado_esperado":"24 e 18 dias"},
     {"ordem":3,"acao":"Fechar com 23 e 24 faltas","resultado_esperado":"18 e 12 dias"},
     {"ordem":4,"acao":"Fechar com 32 e 33 faltas","resultado_esperado":"12 dias e perda do direito"}]'::jsonb,
   'Cada fronteira cai no degrau certo da lei.',
   'Documento: seção 5. Falta JUSTIFICADA (art. 473, atestado aceito) não entra na contagem — pré-condição herdada de PONTO-024/132.'),

  (v_mod, 'FERIAS-003', 'Afastamento longo reinicia o período aquisitivo',
   'excecao', 'alta', 'aprovado', 'api',
   'CLT, art. 133, IV (benefício previdenciário por mais de 6 meses) e demais incisos',
   'Benefício previdenciário por mais de 6 meses (ainda que descontínuos), licença remunerada acima de 30 dias e as demais hipóteses do art. 133 zeram o aquisitivo. O recálculo deve vir do módulo Afastamentos, com a origem registrada.',
   'Colaborador com afastamento previdenciário de 7 meses no módulo Afastamentos.',
   '[{"ordem":1,"acao":"Encerrar o afastamento e reprocessar o período aquisitivo","resultado_esperado":"Nova data-base a partir do retorno, com a origem do recálculo registrada"},
     {"ordem":2,"acao":"Conferir o saldo anterior","resultado_esperado":"Direito do período interrompido tratado conforme o art. 133 (perda), sem sumir silenciosamente — o motivo fica visível"}]'::jsonb,
   'O reinício é automático, rastreável e explicado.',
   'Documento: seção 5 e CT-08; integração da seção 6 (Afastamentos).'),

  (v_mod, 'FERIAS-004', 'Dois períodos aquisitivos em aberto: baixa o mais antigo primeiro',
   'excecao', 'alta', 'aprovado', 'api',
   'CLT, arts. 134 e 137 (o período mais antigo é o que dobra primeiro)',
   'Acúmulo de períodos é a antessala do passivo: o sistema deve priorizar a baixa do período mais antigo em toda programação e sinalizar o acúmulo ao RH — programar contra o período novo deixando o velho vencer é o erro mais caro possível.',
   'Colaborador com dois períodos aquisitivos vencidos e não gozados.',
   '[{"ordem":1,"acao":"Programar 15 dias de férias","resultado_esperado":"Baixa aplicada ao período MAIS ANTIGO, com o acúmulo sinalizado"},
     {"ordem":2,"acao":"Tentar direcionar a baixa ao período mais novo","resultado_esperado":"Recusado ou exigindo justificativa registrada — o antigo dobra primeiro"}]'::jsonb,
   'A ordem de baixa protege do pagamento em dobro.',
   'Documento: CT-17.'),

  -- ══════════ B) PROGRAMAÇÃO E FRACIONAMENTO ══════════

  (v_mod, 'FERIAS-010', 'Fracionar em 14 + 11 + 5 com concordância registrada',
   'feliz', 'critica', 'aprovado', 'api',
   'CLT, art. 134, §1º (até 3 períodos; um ≥ 14 dias; demais ≥ 5 dias; concordância do empregado)',
   'O fracionamento legal exige três coisas juntas: no máximo 3 períodos, um deles com pelo menos 14 dias corridos, os demais com pelo menos 5 — e a concordância do empregado registrada. A composição válida grava com a evidência da concordância.',
   'Colaborador com direito integral de 30 dias.',
   '[{"ordem":1,"acao":"Programar P1=14, P2=11, P3=5 com o aceite do colaborador","resultado_esperado":"Programação aceita"},
     {"ordem":2,"acao":"Conferir o registro","resultado_esperado":"Concordância do empregado gravada com data e identificação"}]'::jsonb,
   'Composição válida entra, com a concordância como evidência.',
   'Documento: seção 5 e CT-03.'),

  (v_mod, 'FERIAS-011', 'Fracionamento sem período de 14 dias é bloqueado',
   'negativo', 'critica', 'aprovado', 'api',
   'CLT, art. 134, §1º',
   '10+10+10 soma 30, mas nenhum período atinge os 14 dias corridos exigidos — a soma certa não salva a composição errada.',
   'Colaborador com direito integral.',
   '[{"ordem":1,"acao":"Programar P1=10, P2=10, P3=10","resultado_esperado":"Bloqueado, com mensagem apontando a exigência do período de 14 dias"}]'::jsonb,
   'Sem um período de 14, não grava.',
   'Documento: CT-02.'),

  (v_mod, 'FERIAS-012', 'Terceiro período menor que 5 dias é bloqueado',
   'negativo', 'critica', 'aprovado', 'api',
   'CLT, art. 134, §1º',
   '20+7+3: o primeiro cumpre os 14, mas o terceiro tem 3 dias — abaixo do piso de 5 dias corridos de qualquer período.',
   'Colaborador com direito integral.',
   '[{"ordem":1,"acao":"Programar P1=20, P2=7, P3=3","resultado_esperado":"Bloqueado, apontando o período inferior a 5 dias"},
     {"ordem":2,"acao":"Tentar um quarto período (7+7+8+8)","resultado_esperado":"Bloqueado — máximo de 3 períodos"}]'::jsonb,
   'Piso de 5 por período e teto de 3 períodos.',
   'Documento: CT-04.'),

  (v_mod, 'FERIAS-013', 'Programar mais dias do que o saldo é bloqueado',
   'negativo', 'critica', 'aprovado', 'api',
   'CLT, arts. 129 e 130 (o direito é o teto)',
   'Solicitar 42 dias com saldo de 30 não é arredondável: bloqueio com mensagem que informe o saldo disponível e o período aquisitivo correspondente.',
   'Colaborador com saldo de 30 dias.',
   '[{"ordem":1,"acao":"Solicitar 42 dias","resultado_esperado":"Bloqueado, com o saldo disponível e o período aquisitivo na mensagem"}]'::jsonb,
   'Saldo é limite duro.',
   'Documento: CT-01.'),

  (v_mod, 'FERIAS-014', 'Início nos 2 dias antes de feriado ou repouso é bloqueado',
   'negativo', 'critica', 'aprovado', 'api',
   'CLT, art. 134, §3º',
   'É vedado iniciar férias nos 2 dias que antecedem feriado ou DSR. Sexta-feira com repouso no domingo: bloqueada, com sugestão da data válida mais próxima — considerando o calendário de feriados DA UNIDADE (RN22), inclusive o municipal.',
   'Colaborador com DSR aos domingos; feriado municipal cadastrado na tabela da unidade.',
   '[{"ordem":1,"acao":"Programar início numa sexta-feira","resultado_esperado":"Bloqueado, com sugestão da segunda-feira seguinte"},
     {"ordem":2,"acao":"Programar início na véspera do feriado municipal da unidade","resultado_esperado":"Bloqueado — o calendário considerado é o da unidade"},
     {"ordem":3,"acao":"Programar na véspera do mesmo feriado para colaborador de OUTRA unidade (sem esse feriado)","resultado_esperado":"Aceito — o feriado não vale lá"}]'::jsonb,
   'A vedação usa o calendário certo de cada unidade.',
   'Documento: seção 5, CT-05 e CT-06; depende da fonte única de feriados (RN22, família FER-/PONTO-131).'),

  (v_mod, 'FERIAS-015', 'Sem trava etária: menor de 18 e maior de 50 fracionam',
   'excecao', 'media', 'aprovado', 'api',
   'Lei 13.467/2017 (revogação do art. 134, §2º da CLT)',
   'A antiga obrigação de gozo em período único para menores de 18 e maiores de 50 anos foi REVOGADA. Sistema que ainda aplica a trava (erro comum em legados) está bloqueando direito que a lei devolveu.',
   'Colaboradores de 17 e de 55 anos com direito integral.',
   '[{"ordem":1,"acao":"Fracionar as férias dos dois em 14+11+5 com concordância","resultado_esperado":"Aceito para ambos — nenhuma trava por idade"}]'::jsonb,
   'A trava revogada não existe no sistema.',
   'Documento: seção 5 (último item). Caso de proteção contra "conformidade fantasma".'),

  (v_mod, 'FERIAS-016', 'Estudante menor de 18: coincidência com férias escolares',
   'alternativo', 'media', 'aprovado', 'api',
   'CLT, art. 136, §2º',
   'O empregado estudante menor de 18 anos tem direito a fazer coincidir as férias com as férias escolares. O sistema deve sinalizar o colaborador e restringir/alertar a janela de programação.',
   'Colaborador de 17 anos marcado como estudante.',
   '[{"ordem":1,"acao":"Programar férias fora do período de férias escolares","resultado_esperado":"Alerta exigindo aceite justificado — a coincidência é direito do estudante"}]'::jsonb,
   'O direito do estudante aparece na programação.',
   'Documento: seção 5. O art. 136, §1º (familiares no mesmo estabelecimento) é informativo — sugerir períodos coincidentes, sem caso próprio.'),

  -- ══════════ C) PRAZO CONCESSIVO E DOBRA ══════════

  (v_mod, 'FERIAS-020', 'Programação além do limite concessivo exige diretoria e mostra a dobra',
   'negativo', 'critica', 'aprovado', 'api',
   'CLT, art. 134, caput (concessão nos 12 meses seguintes) e art. 137 (dobra)',
   'As férias devem ser concedidas nos 12 meses seguintes ao fim do aquisitivo. Programar além disso só com justificativa de alçada de diretoria — e com o CUSTO DA DOBRA exibido antes da decisão, porque é isso que a empresa está assinando.',
   'Colaborador com limite concessivo a vencer em 20 dias e programação proposta para depois dele.',
   '[{"ordem":1,"acao":"Programar início após o limite concessivo","resultado_esperado":"Bloqueado para perfis comuns"},
     {"ordem":2,"acao":"Autorizar com alçada de diretoria","resultado_esperado":"Grava com justificativa registrada e o valor da dobra exibido"}]'::jsonb,
   'Estourar o prazo é decisão informada de diretoria, nunca acidente.',
   'Documento: seção 5 e CT-09.'),

  (v_mod, 'FERIAS-021', 'Prazo vencido: o dobro aparece sozinho no painel',
   'excecao', 'alta', 'aprovado', 'api',
   'CLT, art. 137 (pagamento em dobro da remuneração das férias concedidas após o prazo)',
   'No dia seguinte ao vencimento do limite concessivo, o painel financeiro passa a exibir o valor em dobro — automaticamente, sem depender de alguém lembrar. O passivo visível é o que dispara a gestão.',
   'Colaborador com limite concessivo vencido ontem.',
   '[{"ordem":1,"acao":"Abrir o painel financeiro","resultado_esperado":"Valor em dobro calculado e exibido para o período vencido"},
     {"ordem":2,"acao":"Conferir o alerta de vencimento","resultado_esperado":"Ativo desde D-45, com trilha do que foi (ou não foi) feito"}]'::jsonb,
   'Dobra vencida é passivo exposto, não surpresa de fiscalização.',
   'Documento: seção 5 (informativo) e 7.'),

  -- ══════════ D) AVISO E PAGAMENTO ══════════

  (v_mod, 'FERIAS-030', 'Aviso por escrito 30 dias antes, com contagem regressiva',
   'feliz', 'critica', 'aprovado', 'api',
   'CLT, art. 135 (participação por escrito com antecedência mínima de 30 dias)',
   'Cada período aprovado dispara o relógio do aviso: alerta ao RH em D-45 e emissão do aviso com 30 dias de antecedência, com recibo de ciência do colaborador (assinatura via módulo de Documentos).',
   'Período de férias aprovado com início em 40 dias.',
   '[{"ordem":1,"acao":"Emitir o aviso de férias","resultado_esperado":"Documento gerado com os dados do período e enviado à assinatura"},
     {"ordem":2,"acao":"Colaborador dá ciência","resultado_esperado":"Ciência registrada com data — evidência para fiscalização"}]'::jsonb,
   'O aviso sai no prazo e deixa evidência.',
   'Documento: seções 5 e 8; integração com Governança/Documentos.'),

  (v_mod, 'FERIAS-031', 'Aprovar com início em menos de 30 dias exige justificativa',
   'negativo', 'alta', 'aprovado', 'api',
   'CLT, art. 135',
   'Início em 20 dias significa aviso fora do prazo legal. O status Aprovado deve ser travado sem aviso emitido em prazo hábil — a exceção só passa com alerta aceito e justificativa registrada.',
   'Solicitação com início em 20 dias, sem aviso emitido.',
   '[{"ordem":1,"acao":"Tentar aprovar","resultado_esperado":"Alerta de aviso fora do prazo; aprovação só com justificativa registrada em trilha"}]'::jsonb,
   'Prazo de aviso curto nunca passa em silêncio.',
   'Documento: seção 5 e CT-12.'),

  (v_mod, 'FERIAS-032', 'Pagamento até D-2 com terço constitucional automático',
   'feliz', 'critica', 'aprovado', 'api',
   'CLT, art. 145 (pagamento até 2 dias antes do início); CF/88, art. 7º, XVII (terço)',
   'A aprovação gera a obrigação financeira com vencimento em D-2 do início, alertando a tesouraria. O terço constitucional é aplicado automaticamente em TODOS os cálculos — inclusive sobre o abono pecuniário.',
   'Período aprovado com remuneração base conhecida e abono requerido.',
   '[{"ordem":1,"acao":"Aprovar o período","resultado_esperado":"Obrigação financeira criada com vencimento em D-2"},
     {"ordem":2,"acao":"Conferir o cálculo","resultado_esperado":"Terço aplicado sobre a remuneração de férias E sobre o abono"},
     {"ordem":3,"acao":"Chegar a D-2 sem baixa de pagamento","resultado_esperado":"Alerta à tesouraria — pagamento fora do prazo gera dobra (Súmula 450 do TST)"}]'::jsonb,
   'O dinheiro certo, na data certa, com o terço sempre dentro.',
   'Documento: seções 5 e 7.'),

  -- ══════════ E) ABONO PECUNIÁRIO ══════════

  (v_mod, 'FERIAS-040', 'Abono de 1/3 requerido no prazo',
   'feliz', 'alta', 'aprovado', 'api',
   'CLT, art. 143 e §1º (abono de até 1/3, requerido até 15 dias antes do fim do aquisitivo)',
   'O colaborador converte até 1/3 do direito em abono (10 dias num direito de 30), desde que requeira até 15 dias antes do término do período aquisitivo. Os dias vendidos saem do saldo de gozo e entram no cálculo financeiro com o terço.',
   'Colaborador com direito de 30 dias, a 30 dias do fim do aquisitivo.',
   '[{"ordem":1,"acao":"Requerer abono de 10 dias","resultado_esperado":"Aceito; saldo de gozo passa a 20 dias"},
     {"ordem":2,"acao":"Conferir o financeiro","resultado_esperado":"Abono com terço no cálculo (FERIAS-032)"}]'::jsonb,
   'Abono no prazo entra e ajusta saldo e cálculo.',
   'Documento: seção 5.'),

  (v_mod, 'FERIAS-041', 'Abono acima de 1/3 é bloqueado',
   'negativo', 'alta', 'aprovado', 'api',
   'CLT, art. 143 (limite de 1/3)',
   'Num direito de 30 dias, o abono máximo é 10. Pedir 15 é bloqueado — e em direito reduzido pelo art. 130 (ex.: 24 dias), o teto acompanha (8 dias).',
   'Colaboradores com direitos de 30 e de 24 dias.',
   '[{"ordem":1,"acao":"Requerer 15 dias de abono no direito de 30","resultado_esperado":"Bloqueado — limite de 10"},
     {"ordem":2,"acao":"Requerer 9 dias no direito de 24","resultado_esperado":"Bloqueado — limite de 8 (1/3 do direito real)"}]'::jsonb,
   'O terço vendável é do direito real, não do ideal.',
   'Documento: CT-11.'),

  (v_mod, 'FERIAS-042', 'Abono fora do prazo de 15 dias fica indisponível',
   'negativo', 'media', 'aprovado', 'api',
   'CLT, art. 143, §1º',
   'A 10 dias do fim do período aquisitivo, o prazo legal do requerimento (15 dias antes) já passou: a opção deve estar indisponível, com mensagem explicando o prazo — não um erro genérico depois de preenchido.',
   'Colaborador a 10 dias do fim do aquisitivo.',
   '[{"ordem":1,"acao":"Tentar requerer o abono","resultado_esperado":"Opção indisponível, com a explicação do prazo de 15 dias"}]'::jsonb,
   'Prazo vencido se explica, não se descobre no erro.',
   'Documento: CT-10.'),

  -- ══════════ F) CICLO DE ESTADOS ══════════

  (v_mod, 'FERIAS-050', 'O ciclo completo: de Sugerido a Concluído, cada estado com seu efeito',
   'feliz', 'alta', 'aprovado', 'api',
   'CLT, arts. 134, 135, 145 (os marcos que os estados materializam)',
   'Cada estado do ciclo (Sugerido → Planejado → Confirmado → Ciente → Solicitado → Aprovado → Em gozo → Concluído) tem efeito próprio: Sugerido entra só em provisão; Planejado sensibiliza desembolso; Solicitado dispara o relógio do aviso; Aprovado habilita documentos e financeiro; Concluído baixa o saldo e arquiva evidências.',
   'Colaborador com direito integral; plano anual em montagem.',
   '[{"ordem":1,"acao":"Percorrer o ciclo inteiro de um período","resultado_esperado":"Cada transição registrada, com o efeito do estado aplicado (indicadores, relógios, documentos)"},
     {"ordem":2,"acao":"Concluir o período","resultado_esperado":"Saldo baixado, evidências arquivadas, evento de eSocial conciliado"}]'::jsonb,
   'O estado dirige o comportamento — nada acontece fora dele.',
   'Documento: seção 4.2.'),

  (v_mod, 'FERIAS-051', 'Cancelar período aprovado devolve tudo e deixa trilha',
   'excecao', 'alta', 'aprovado', 'api',
   'CLT, art. 134 (o direito permanece devido)',
   'Cancelamento exige motivo e produz três efeitos: os dias voltam ao saldo, o alerta de vencimento do concessivo REABRE (o risco voltou), e a trilha registra quem, quando e por quê.',
   'Período aprovado com aviso emitido.',
   '[{"ordem":1,"acao":"Cancelar com motivo","resultado_esperado":"Dias devolvidos ao saldo"},
     {"ordem":2,"acao":"Conferir alertas","resultado_esperado":"Alerta de vencimento reaberto"},
     {"ordem":3,"acao":"Conferir a trilha","resultado_esperado":"Cancelamento registrado com autor, data e motivo"}]'::jsonb,
   'Cancelar desfaz o gozo, nunca o rastro.',
   'Documento: seção 4.2 e CT-16.'),

  (v_mod, 'FERIAS-052', 'Data confirmada só muda com justificativa',
   'negativo', 'media', 'aprovado', 'api',
   'CLT, art. 135 (o empregado se organiza em cima da data comunicada)',
   'A partir do estado Confirmado, a data é compromisso: alteração exige justificativa registrada em trilha de auditoria. Mudança silenciosa de data confirmada é a origem clássica de conflito trabalhista.',
   'Período em estado Confirmado.',
   '[{"ordem":1,"acao":"Alterar a data sem justificativa","resultado_esperado":"Recusado"},
     {"ordem":2,"acao":"Alterar com justificativa","resultado_esperado":"Aceito e registrado na trilha"}]'::jsonb,
   'Confirmado é compromisso auditável.',
   'Documento: seção 4.2.'),

  (v_mod, 'FERIAS-053', 'Em gozo bloqueia o ponto e conversa com Afastamentos',
   'excecao', 'alta', 'aprovado', 'api',
   'CLT, art. 130 c/c art. 74 (férias não é dia de trabalho)',
   'Durante o gozo, marcação de ponto é recusada com mensagem clara (espelho de PONTO-025) e o período integra com Afastamentos — o dia aparece justificado na apuração (CT-007 do Ponto), sem falta e sem saldo negativo.',
   'Colaborador em gozo de férias.',
   '[{"ordem":1,"acao":"Tentar marcar ponto durante o gozo","resultado_esperado":"Recusado com mensagem explicativa, nada gravado"},
     {"ordem":2,"acao":"Apurar os dias do gozo","resultado_esperado":"Dias justificados, saldo zero, sem falta e sem alerta"}]'::jsonb,
   'Férias e ponto não se atropelam.',
   'Documento: seções 4.2 e 6; casa com PONTO-024/025.'),

  -- ══════════ G) FÉRIAS COLETIVAS ══════════

  (v_mod, 'FERIAS-060', 'Coletivas: até 2 períodos de no mínimo 10 dias, com comunicações',
   'feliz', 'media', 'aprovado', 'api',
   'CLT, arts. 139 a 141',
   'Férias coletivas podem ser concedidas em até 2 períodos anuais, nenhum inferior a 10 dias corridos, com comunicação ao órgão do Ministério do Trabalho e ao sindicato com 15 dias de antecedência — e comunicação aos empregados. O fluxo próprio gera os comunicados.',
   'Setor selecionado para coletivas em janeiro (12 dias).',
   '[{"ordem":1,"acao":"Programar as coletivas do setor","resultado_esperado":"Período aceito e comunicados gerados com 15 dias de antecedência"},
     {"ordem":2,"acao":"Conferir colaborador com menos de 12 meses de casa","resultado_esperado":"Férias proporcionais concedidas e novo período aquisitivo iniciado (art. 140)"}]'::jsonb,
   'Coletivas com rito completo, inclusive para os novatos.',
   'Documento: seção 5.'),

  (v_mod, 'FERIAS-061', 'Coletiva com período menor que 10 dias é bloqueada',
   'negativo', 'media', 'aprovado', 'api',
   'CLT, art. 139, §1º',
   'Período coletivo de 8 dias viola o mínimo legal de 10 dias corridos; terceiro período coletivo no ano viola o máximo de 2.',
   'Setor com um período coletivo já concedido no ano.',
   '[{"ordem":1,"acao":"Programar coletiva de 8 dias","resultado_esperado":"Bloqueado — mínimo de 10 dias corridos"},
     {"ordem":2,"acao":"Programar um terceiro período no mesmo ano","resultado_esperado":"Bloqueado — máximo de 2 períodos anuais"}]'::jsonb,
   'Os limites das coletivas valem no cadastro.',
   'Documento: seção 5.'),

  -- ══════════ H) FINANCEIRO E COBERTURA ══════════

  (v_mod, 'FERIAS-070', 'Encargos por enquadramento: Simples Anexo III x Anexo IV',
   'alternativo', 'alta', 'aprovado', 'api',
   'LC 123/2006 (Simples Nacional); parametrização de encargos da seção 7.4',
   'A provisão depende do enquadramento: Simples Anexo III não recolhe contribuição patronal (mantém FGTS); Anexo IV recolhe. O parâmetro vem do cadastro da empresa e a memória mostra a composição.',
   'Duas empresas de teste: uma Anexo III, outra Anexo IV.',
   '[{"ordem":1,"acao":"Calcular a provisão na empresa Anexo III","resultado_esperado":"Sem contribuição patronal; FGTS mantido"},
     {"ordem":2,"acao":"Calcular na empresa Anexo IV","resultado_esperado":"Com contribuição patronal"}]'::jsonb,
   'O encargo segue o enquadramento, não um padrão fixo.',
   'Documento: seção 7.4, CT-13 e CT-14. Confirmar parâmetros com a assessoria contábil antes da produção (ressalva do próprio documento).'),

  (v_mod, 'FERIAS-071', 'Cobertura operacional: estourar o limite da equipe gera alerta',
   'alternativo', 'media', 'aprovado', 'api',
   'Gestão operacional (seção 4.6 do documento); CLT, art. 136 (a época atende ao interesse do empregador)',
   'Com limite parametrizado de 20% da equipe simultaneamente em férias, programar 40% de um departamento no mesmo mês gera alerta de cobertura com destaque no mapa de calor — informação para decidir, não bloqueio (a época é prerrogativa do empregador).',
   'Departamento de 10 pessoas com limite de cobertura de 20%.',
   '[{"ordem":1,"acao":"Programar 4 pessoas do departamento no mesmo mês","resultado_esperado":"Alerta de cobertura com o estouro destacado no mapa de calor"}]'::jsonb,
   'O RH decide vendo o buraco de cobertura, não descobrindo depois.',
   'Documento: seções 4.5, 4.6 e CT-15.')

  ON CONFLICT (codigo) DO NOTHING;

  SELECT count(*) INTO v_depois FROM public.qa_casos_teste WHERE modulo_id = v_mod;
  RAISE NOTICE 'Férias: módulo tinha % casos, agora tem % (+%).', v_antes, v_depois, v_depois - v_antes;
END $doc$;
