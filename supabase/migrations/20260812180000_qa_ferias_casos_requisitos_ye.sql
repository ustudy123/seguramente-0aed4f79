-- =========================================================
-- QA — Férias: casos derivados da Análise de Requisitos do módulo
-- (documento YE-DP-FERIAS-001, Google Doc "YE - Férias - Análise de
-- Requisitos", pasta YOUREYES › REQUISITOS, data-base ago/2026).
--
-- MÉTODO: as 12 regras de negócio (RN-001..012), os 12 critérios de
-- aceite (CA-001..012), os 12 cenários de teste (seção 25) e os fluxos
-- alternativos (seção 9) foram cruzados um a um com a família
-- FERIAS-001..071 já registrada (27 casos, todos com rotina). Como
-- sempre: os casos descrevem o que a LEI e o documento exigem, não o
-- que o sistema faz hoje.
--
-- JÁ COBERTO (sem caso novo; registrado para a rastreabilidade):
--   RN-001/CA-001/002 escala de faltas ......... FERIAS-001/002
--   RN-002 perda art. 133 ...................... FERIAS-003
--   RN-003/CA-009 concessivo/dobra ............. FERIAS-020/021
--   RN-004/CA-003 fracionamento ................ FERIAS-010..012
--   RN-005/CA-004 véspera de feriado/DSR ....... FERIAS-014
--   CA-005 aviso 30 dias ....................... FERIAS-030/031
--   CA-008 pagamento D-2 + terço ............... FERIAS-032
--   RN-008/CA-007 abono ........................ FERIAS-040..042
--   RN-011/CA-010 coletivas (limites/comun.) ... FERIAS-060/061
--   Estudante menor (art. 136, §2º) ............ FERIAS-016
--   Cancelamento/estados/em-gozo ............... FERIAS-050..053
--   Encargos Simples / cobertura ............... FERIAS-070/071
--
-- SEM COBERTURA — este arquivo documenta 19 casos novos:
--   aquisitivo: art. 131 (ausência legal), art. 130 §1º (vedação de
--   desconto), tempo parcial pós-reforma, prescrição (art. 149);
--   época: familiares juntos (art. 136 §1º); dobra: Súmula 81 (só os
--   dias excedentes); afastamento × férias (sobreposição); cálculo:
--   médias do art. 142 com memória, incidências (art. 144/Tema 985),
--   adiantamento do 13º; fluxo: reabertura com dupla aprovação, aviso
--   sem ciência trava, autoaprovação vedada; coletivas: < 12 meses
--   (art. 140); eSocial: S-2230/S-1200/S-1210 e rejeição; rescisão
--   (arts. 146-148); múltiplos vínculos.
--
-- ESTA MIGRATION SÓ DOCUMENTA. Rotinas em leva futura.
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

  -- ══════════ A) PERÍODO AQUISITIVO E SALDO ══════════

  (v_mod, 'FERIAS-005', 'Ausência amparada por lei não reduz o saldo de férias',
   'excecao', 'alta', 'aprovado', 'api',
   'CLT, art. 131 (hipóteses que não são falta); art. 130',
   'A escala do art. 130 conta só faltas INJUSTIFICADAS. Atestado, licença-maternidade, acidente de trabalho, ausências do art. 473 — nada disso entra na contagem que reduz os 30 dias. Um sistema que soma tudo corta férias de quem adoeceu.',
   'Colaborador com 8 ausências no aquisitivo: 6 amparadas por atestado + 2 injustificadas.',
   '[{"ordem":1,"acao":"Apurar o saldo do período com as 8 ausências (6 justificadas, 2 não)","resultado_esperado":"Contam APENAS as 2 injustificadas → direito integral de 30 dias"},
     {"ordem":2,"acao":"Conferir a memória da apuração","resultado_esperado":"As ausências amparadas listadas como não computáveis, com o amparo de cada uma"}]'::jsonb,
   'Só falta injustificada morde o saldo.',
   'Requisitos YE-DP-FERIAS-001: RN-001 / art. 131. Par do PONTO-024 (amparada não vira falta) — aqui o efeito é no SALDO de férias, via fonte_faltas.'),

  (v_mod, 'FERIAS-006', 'Faltas não podem ser descontadas dos dias de gozo',
   'negativo', 'alta', 'aprovado', 'api',
   'CLT, art. 130, §1º',
   'É vedado descontar as faltas do período de férias: a punição da falta é a REDUÇÃO DA FAIXA (30→24→18...), nunca o abatimento um-a-um dos dias de gozo. Sistema que faz "30 dias menos 8 faltas = 22" aplica um desconto que a lei proíbe expressamente.',
   'Colaborador com 8 faltas injustificadas (faixa de 24 dias).',
   '[{"ordem":1,"acao":"Apurar o direito com 8 faltas","resultado_esperado":"24 dias (faixa do art. 130), NUNCA 22 (30 - 8)"},
     {"ordem":2,"acao":"Tentar registrar desconto adicional de dias de gozo por causa das faltas","resultado_esperado":"Recusado — a faixa já é a única consequência legal"}]'::jsonb,
   'Falta muda a faixa; não vira subtração de dias.',
   'Requisitos YE-DP-FERIAS-001: base legal art. 130, §1º. Complementa FERIAS-001/002 (a escala em si).'),

  (v_mod, 'FERIAS-007', 'Tempo parcial segue a tabela geral (art. 130-A revogado)',
   'alternativo', 'media', 'aprovado', 'api',
   'CLT, art. 130-A (REVOGADO pela Lei 13.467/2017); art. 58-A, §7º',
   'Antes da reforma, o tempo parcial tinha tabela própria (máx. 18 dias). Desde 2017, contrato a tempo parcial usa a MESMA escala do art. 130 (30 dias com até 5 faltas). Sistema que aplicar a tabela antiga corta férias com regra revogada — mesmo padrão da trava etária (FERIAS-015).',
   'Colaborador com contrato de tempo parcial (25h semanais), sem faltas.',
   '[{"ordem":1,"acao":"Apurar o direito do contrato a tempo parcial sem faltas","resultado_esperado":"30 dias — a tabela geral, não os 18 da regra revogada"},
     {"ordem":2,"acao":"AUDITORIA: procurar resquício da tabela do 130-A nas funções de férias","resultado_esperado":"Nenhum — dispositivo revogado não pode estar no código"}]'::jsonb,
   'Tempo parcial, férias inteiras.',
   'Requisitos YE-DP-FERIAS-001: base legal (linha do art. 130-A). Guarda-corpo contra regra revogada, como FERIAS-015.'),

  (v_mod, 'FERIAS-008', 'Prescrição: o relógio corre do fim do concessivo',
   'excecao', 'media', 'aprovado', 'api',
   'CF, art. 7º, XXIX; CLT, art. 149',
   'O prazo para reclamar férias conta do FIM DO PERÍODO CONCESSIVO (ou da rescisão), não do aquisitivo: 5 anos na vigência do contrato, 2 após a extinção. O sistema deve calcular o marco por período e alertar — período prescrito é passivo que virou perda definitiva do trabalhador e prova de desorganização da empresa.',
   'Período com concessivo encerrado há mais de 4 anos, não gozado nem pago.',
   '[{"ordem":1,"acao":"Consultar o período antigo","resultado_esperado":"Marco prescricional calculado (fim do concessivo + 5 anos) e exibido"},
     {"ordem":2,"acao":"Aproximar-se do marco","resultado_esperado":"Alerta a RH/Jurídico antes da consumação, com o valor em risco"}]'::jsonb,
   'Cada período com seu marco de prescrição visível.',
   'Requisitos YE-DP-FERIAS-001: base legal CF 7º XXIX / art. 149.'),

  -- ══════════ B) ÉPOCA E SOBREPOSIÇÕES ══════════

  (v_mod, 'FERIAS-017', 'Familiares na mesma empresa podem tirar férias juntos',
   'alternativo', 'baixa', 'aprovado', 'api',
   'CLT, art. 136, §1º',
   'Membros da mesma família que trabalhem na mesma empresa têm direito a férias no mesmo período, se quiserem e se não prejudicar o serviço. O sistema deve reconhecer o vínculo familiar e facilitar a coincidência na programação (informativo, não bloqueante — a época segue sendo do empregador).',
   'Dois colaboradores da mesma empresa marcados como familiares (cônjuges).',
   '[{"ordem":1,"acao":"Programar férias de um dos familiares","resultado_esperado":"Sistema aponta a preferência legal de coincidência com o familiar"},
     {"ordem":2,"acao":"Programar o segundo em período coincidente","resultado_esperado":"Aceito sem atrito; a coincidência fica registrada como atendida"}]'::jsonb,
   'A preferência familiar aparece na programação.',
   'Requisitos YE-DP-FERIAS-001: art. 136, §1º (seção 4). Depende de vínculo familiar no cadastro.'),

  (v_mod, 'FERIAS-022', 'A dobra incide só sobre os dias excedentes ao concessivo',
   'alternativo', 'alta', 'aprovado', 'api',
   'CLT, art. 137; Súmula 81 do TST',
   'Se PARTE do gozo cabe dentro do concessivo e parte fica de fora, a dobra alcança apenas os dias gozados APÓS o vencimento — não o período inteiro. Dobrar tudo superestima o passivo; não dobrar nada o esconde. A Súmula 81 fixa o corte exato.',
   'Concessivo vencendo em 10 dias; férias de 30 dias iniciando 5 dias antes do vencimento.',
   '[{"ordem":1,"acao":"Calcular férias que atravessam o vencimento do concessivo (5 dias dentro, 25 fora)","resultado_esperado":"Dobra sobre os 25 dias excedentes; os 5 dentro do prazo saem simples"},
     {"ordem":2,"acao":"Conferir a memória de cálculo","resultado_esperado":"O corte no vencimento demonstrado dia a dia"}]'::jsonb,
   'Dobra cirúrgica: só o que passou do prazo.',
   'Requisitos YE-DP-FERIAS-001: RN-006 / CA-009 (Súmula 81). Refina FERIAS-020/021, que tratam o vencimento integral.'),

  (v_mod, 'FERIAS-024', 'Afastamento sobreposto às férias suspende e reprograma',
   'excecao', 'alta', 'aprovado', 'api',
   'CLT, arts. 476 (auxílio-doença suspende) e 131; jurisprudência sobre sobreposição',
   'Colaborador afastado (ex.: auxílio-doença) na véspera ou durante as férias não está gozando férias — os dois institutos não coexistem. O sistema deve detectar a sobreposição, suspender o gozo, devolver os dias não usufruídos e reprogramar, recalculando pagamento e eSocial.',
   'Férias aprovadas de 30 dias; afastamento por doença inicia no 10º dia do gozo.',
   '[{"ordem":1,"acao":"Registrar o afastamento no meio das férias","resultado_esperado":"Sobreposição detectada; os 20 dias restantes voltam ao saldo"},
     {"ordem":2,"acao":"Conferir estado e integrações","resultado_esperado":"Gozo interrompido com evidência; recálculo sinalizado; eSocial de férias ajustado"}]'::jsonb,
   'Doença não consome férias.',
   'Requisitos YE-DP-FERIAS-001: fluxo alternativo "Afastamento durante/antes das férias" (seção 9). Conversa com FERIAS-053 (ponte com Afastamentos).'),

  -- ══════════ C) CÁLCULO, ENCARGOS E PAGAMENTO ══════════

  (v_mod, 'FERIAS-033', 'Cálculo com médias das variáveis e memória auditável',
   'feliz', 'alta', 'aprovado', 'api',
   'CLT, art. 142 e §§; CF, art. 7º, XVII',
   'Quem recebe variáveis (horas extras, adicional noturno, comissões) leva a MÉDIA para as férias — salário fixo puro é só o começo. A base é parametrizável por rubrica, a conta gera memória reproduzível, e rubrica variável faltante ALERTA antes de fechar (não fecha com base incompleta em silêncio).',
   'Colaborador com salário fixo + horas extras habituais nos últimos 12 meses.',
   '[{"ordem":1,"acao":"Calcular as férias do comissionado/horista","resultado_esperado":"Remuneração = salário da época + média das variáveis + 1/3, com memória"},
     {"ordem":2,"acao":"Recalcular com os mesmos insumos","resultado_esperado":"Mesmo resultado — determinístico"},
     {"ordem":3,"acao":"Calcular com rubrica variável faltando na base","resultado_esperado":"Alerta para completar a base ANTES de fechar"}]'::jsonb,
   'Média certa, memória aberta, base incompleta não fecha calada.',
   'Requisitos YE-DP-FERIAS-001: RN-007 / CA-006 / RNF-001 / cenário "Dado ausente". A composição da base é [VAL] por cliente (seção 30).'),

  (v_mod, 'FERIAS-034', 'Incidências: férias gozadas tributam; abono é indenizatório',
   'alternativo', 'alta', 'aprovado', 'api',
   'CLT, art. 144; STF, Tema 985 (RE 1.072.485); legislação de INSS/FGTS/IRRF',
   'Duas naturezas na mesma folha de férias: férias gozadas + 1/3 sofrem INSS/FGTS/IRRF (o terço inclusive na patronal, pelo Tema 985, observada a modulação); abono pecuniário + seu 1/3 são indenizatórios — não incidem. Misturar as naturezas erra encargo para os dois lados.',
   'Cálculo com 20 dias gozados + 10 de abono.',
   '[{"ordem":1,"acao":"Apurar encargos do cálculo misto (gozo + abono)","resultado_esperado":"Incidências sobre gozo + 1/3; abono + 1/3 fora da base"},
     {"ordem":2,"acao":"Conferir a memória de encargos","resultado_esperado":"Cada rubrica com sua natureza (tributável × indenizatória) explicitada"}]'::jsonb,
   'Cada verba com sua natureza — nem tributo a mais, nem a menos.',
   'Requisitos YE-DP-FERIAS-001: RN-010 / art. 144 / Tema 985 ([VAL] contábil — modulação 15/09/2020).'),

  (v_mod, 'FERIAS-035', 'Adiantamento da 1ª parcela do 13º integra o pagamento',
   'alternativo', 'media', 'aprovado', 'api',
   'Lei 4.749/1965, art. 2º, §2º (adiantamento por ocasião das férias)',
   'O empregado que requer em janeiro tem direito de receber a 1ª parcela do 13º junto com as férias. O campo de opção já existe na programação (adiantar_13); o caso garante que a opção produz efeito: o valor entra no pagamento das férias e baixa na apuração do 13º de novembro.',
   'Programação com adiantar_13 = true, requerida no prazo.',
   '[{"ordem":1,"acao":"Calcular o pagamento com a opção de adiantamento marcada","resultado_esperado":"1ª parcela do 13º somada ao líquido das férias, destacada"},
     {"ordem":2,"acao":"Conferir a apuração do 13º no fim do ano","resultado_esperado":"Adiantamento abatido — sem pagamento em duplicidade"}]'::jsonb,
   'Opção marcada, valor pago, baixa registrada.',
   'Requisitos YE-DP-FERIAS-001: RF-005 / seção 30 (política de adiantamento é [DAE]). O campo adiantar_13 existe; o efeito é o que se testa.'),

  -- ══════════ D) FLUXO, APROVAÇÃO E REABERTURA ══════════

  (v_mod, 'FERIAS-054', 'Cálculo fechado só reabre com dupla aprovação e diferença',
   'excecao', 'alta', 'aprovado', 'api',
   'Princípio da imutabilidade do documento entregue; boa prática de auditoria (documento YE)',
   'Erro descoberto depois do fechamento não se corrige por cima: reabertura com motivo, DUPLA aprovação, recálculo e geração de diferença/estorno — preservando a versão anterior e a trilha. Editar cálculo pago silenciosamente é reescrever recibo que o colaborador já assinou.',
   'Cálculo de férias fechado e pago, com erro de média descoberto depois.',
   '[{"ordem":1,"acao":"Tentar editar diretamente o cálculo fechado","resultado_esperado":"Bloqueado"},
     {"ordem":2,"acao":"Reabrir formalmente com motivo e duas aprovações","resultado_esperado":"Reaberto; recálculo gera a DIFERENÇA (a pagar/estornar), nunca substitui o histórico"},
     {"ordem":3,"acao":"Conferir a trilha","resultado_esperado":"Versões, aprovadores, motivo e diferença registrados"}]'::jsonb,
   'Fechado não se edita: reabre-se com rito e diferença.',
   'Requisitos YE-DP-FERIAS-001: RF-010 / cenário "Alteração retroativa". Espelha PONTO-358 (reabertura de competência).'),

  (v_mod, 'FERIAS-055', 'Aviso sem ciência do colaborador não conclui a concessão',
   'negativo', 'alta', 'aprovado', 'e2e',
   'CLT, art. 135 (comunicação mediante recibo)',
   'O aviso de férias vale com a CIÊNCIA do colaborador (recibo/assinatura). Concessão que avança com aviso apenas "emitido" deixa a empresa sem a prova central do art. 135. O fluxo deve travar (ou exigir tratamento formal da recusa) enquanto a ciência não vier.',
   'Férias aprovadas com aviso emitido e não assinado.',
   '[{"ordem":1,"acao":"Tentar concluir a concessão com o aviso pendente de ciência","resultado_esperado":"Não conclui; alerta ao responsável"},
     {"ordem":2,"acao":"Colher a ciência (ou registrar recusa formal) e concluir","resultado_esperado":"Concessão conclui com a evidência anexada"}]'::jsonb,
   'Aviso emitido não basta; aviso CIENTE conclui.',
   'Requisitos YE-DP-FERIAS-001: cenário "Documento inválido" (seção 25). Par do PONTO-387 (espelho sem assinatura).'),

  (v_mod, 'FERIAS-056', 'Ninguém aprova as próprias férias',
   'negativo', 'alta', 'aprovado', 'api',
   'Segregação de funções (boa prática de controle; matriz de perfis do documento YE)',
   'O colaborador solicita; gestor/DP aprovam. Um gestor que também é colaborador não pode aprovar a PRÓPRIA solicitação — mesma segregação já exigida no ajuste de ponto (PONTO-252). Sem a trava, o aprovador escolhe as próprias datas e valores sem contrapeso.',
   'Gestor com solicitação de férias própria pendente.',
   '[{"ordem":1,"acao":"Tentar aprovar a própria solicitação","resultado_esperado":"Recusado — outro aprovador competente deve analisar"},
     {"ordem":2,"acao":"AUDITORIA: procurar aprovações onde aprovador = solicitante","resultado_esperado":"Nenhuma"}]'::jsonb,
   'Quem pede não aprova.',
   'Requisitos YE-DP-FERIAS-001: cenário "Permissões insuficientes" (seção 25) / matriz da seção 6. Espelha PONTO-252.'),

  -- ══════════ E) COLETIVAS ══════════

  (v_mod, 'FERIAS-062', 'Coletivas com menos de 12 meses de casa: proporcionais e novo aquisitivo',
   'alternativo', 'media', 'aprovado', 'api',
   'CLT, art. 140',
   'Na coletiva, quem ainda não completou 12 meses goza férias PROPORCIONAIS ao tempo de casa — e o período aquisitivo REINICIA na volta. Aplicar a coletiva cheia ao novato (ou descontar os dias "a mais" depois) erra dos dois lados; esquecer o reinício infla o aquisitivo seguinte.',
   'Coletiva de 20 dias; colaborador com 6 meses de casa (proporcional ≈ 15 dias).',
   '[{"ordem":1,"acao":"Aplicar a coletiva ao colaborador com 6 meses","resultado_esperado":"Goza os proporcionais; o excedente é tratado como licença remunerada, não como débito"},
     {"ordem":2,"acao":"Conferir o período aquisitivo após a coletiva","resultado_esperado":"Reiniciado a partir do retorno (art. 140)"}]'::jsonb,
   'Novato goza proporcional e recomeça o relógio.',
   'Requisitos YE-DP-FERIAS-001: RN-011 (parte final) / art. 140. Complementa FERIAS-060/061 (limites e comunicações).'),

  -- ══════════ F) eSOCIAL E INTEGRAÇÕES ══════════

  (v_mod, 'FERIAS-080', 'Concessão gera o S-2230 com motivo 15 e datas exatas',
   'feliz', 'alta', 'aprovado', 'api',
   'eSocial — evento S-2230 (afastamento temporário; motivo 15 = gozo de férias)',
   'Cada gozo concedido vira um S-2230 com o motivo 15 e as datas de início/fim EXATAS do período. Fracionou em três, são três eventos coerentes. Sem o evento, o afastamento oficial não existe para o governo; com datas erradas, a folha e o FGTS digital desalinham.',
   'Férias aprovadas com fracionamento em dois períodos.',
   '[{"ordem":1,"acao":"Concluir a concessão dos dois períodos","resultado_esperado":"Dois eventos S-2230 (motivo 15), cada um com as datas do seu período"},
     {"ordem":2,"acao":"Validar antes do envio","resultado_esperado":"Consistência de datas contra a programação aprovada; leiaute da versão vigente"}]'::jsonb,
   'Cada período de gozo, um S-2230 fiel.',
   'Requisitos YE-DP-FERIAS-001: RN-012 / CA-011 / RF-008. Leiautes são [VAL] na implementação.'),

  (v_mod, 'FERIAS-081', 'Rejeição do eSocial é traduzida e o reenvio não duplica',
   'excecao', 'alta', 'aprovado', 'api',
   'eSocial — regras de retificação e recibos; boa prática de integração',
   'Retorno de rejeição chega em código técnico; o DP precisa de tradução (o que houve, onde corrigir) e de reenvio SEGURO: corrigido o dado, o reenvio substitui/retifica — nunca cria evento duplicado do mesmo gozo. Duplicidade no eSocial é passivo novo criado pela própria correção.',
   'Evento S-2230 rejeitado por inconsistência de data.',
   '[{"ordem":1,"acao":"Receber a rejeição","resultado_esperado":"Explicação em linguagem simples + ação sugerida (Plano de Ação)"},
     {"ordem":2,"acao":"Corrigir e reenviar","resultado_esperado":"Evento aceito; nenhum duplicado do mesmo período no ambiente"},
     {"ordem":3,"acao":"Conferir a trilha","resultado_esperado":"Rejeição, correção e recibo final encadeados"}]'::jsonb,
   'Rejeição vira instrução; reenvio vira retificação, nunca clone.',
   'Requisitos YE-DP-FERIAS-001: fluxo "Rejeição no eSocial" (seção 9) / cenário "Com erro" (seção 25).'),

  (v_mod, 'FERIAS-082', 'Férias refletem na folha: S-1200 e S-1210 com as rubricas certas',
   'feliz', 'media', 'aprovado', 'api',
   'eSocial — S-1200 (remuneração) e S-1210 (pagamentos, detPgtoFer)',
   'O dinheiro das férias precisa aparecer nos eventos de folha: S-1200 com as rubricas de férias e do terço na competência certa, S-1210 com o detalhamento do pagamento e a DATA REAL (que prova o D-2). Sem esse reflexo, o pagamento existiu no banco e não existiu para o Fisco.',
   'Férias calculadas e pagas no prazo.',
   '[{"ordem":1,"acao":"Gerar os eventos de folha da competência","resultado_esperado":"S-1200 com rubricas de férias + 1/3 (e abono como indenizatório); S-1210 com a data real do pagamento"},
     {"ordem":2,"acao":"Conciliar com a memória de cálculo","resultado_esperado":"Valores idênticos — sem diferença entre o pago e o declarado"}]'::jsonb,
   'O que se pagou é o que se declarou, com a data que prova o prazo.',
   'Requisitos YE-DP-FERIAS-001: RN-012 / CA-011. Naturezas conforme FERIAS-034.'),

  -- ══════════ G) RESCISÃO E MÚLTIPLOS VÍNCULOS ══════════

  (v_mod, 'FERIAS-090', 'Rescisão liquida vencidas e proporcionais com o terço',
   'excecao', 'alta', 'aprovado', 'api',
   'CLT, arts. 146 a 148; Súmula 171 do TST',
   'No desligamento, férias vencidas saem integrais (em dobro se o concessivo venceu) e as proporcionais por duodécimos — ambas + 1/3, natureza indenizatória. O módulo de férias deve entregar ao Desligamento o retrato exato: períodos abertos, saldos, vencimentos e valores.',
   'Colaborador desligado com um período vencido não gozado + 7 meses do aquisitivo corrente.',
   '[{"ordem":1,"acao":"Processar o desligamento","resultado_esperado":"Vencidas integrais (+ dobro se concessivo vencido) e 7/12 proporcionais, tudo + 1/3"},
     {"ordem":2,"acao":"Conferir os períodos após a rescisão","resultado_esperado":"Encerrados como indenizados, com memória e vínculo ao termo de rescisão"}]'::jsonb,
   'Nenhum período aberto sobrevive à rescisão sem virar valor.',
   'Requisitos YE-DP-FERIAS-001: arts. 146-148 / fluxo "Rescisão com férias pendentes" (seção 9). Par do PONTO-173 (banco de horas na rescisão).'),

  (v_mod, 'FERIAS-091', 'Dois vínculos do mesmo CPF: períodos e cálculos segregados',
   'alternativo', 'media', 'aprovado', 'api',
   'CLT (contratos autônomos entre si)',
   'Cada contrato tem seu próprio aquisitivo, saldo, programação e cálculo — o CPF é a pessoa, o vínculo é o contrato. Períodos que se misturam entre vínculos corrompem os dois: falta de um reduz férias do outro, gozo de um consome saldo do outro.',
   'Mesmo CPF com dois vínculos ativos (empresas/estabelecimentos distintos).',
   '[{"ordem":1,"acao":"Apurar os períodos aquisitivos dos dois vínculos","resultado_esperado":"Dois relógios independentes, cada um com a data de admissão do seu contrato"},
     {"ordem":2,"acao":"Registrar faltas num vínculo e gozo no outro","resultado_esperado":"Nenhum efeito cruzado — saldo e cálculo de cada contrato intactos"}]'::jsonb,
   'Um CPF, dois contratos, dois relógios de férias.',
   'Requisitos YE-DP-FERIAS-001: cenário "Múltiplos vínculos" (seção 25). Espelha PONTO-394 — lá o achado foi estrutural (chave por CPF); aqui ferias_periodos_aquisitivos também é chaveado por CPF, mesma raiz.')

  ON CONFLICT (codigo) DO NOTHING;

  -- ---------------------------------------------------------
  -- Melhorias em casos existentes: referência cruzada ao documento
  -- (só acrescenta às observações, não reescreve)
  -- ---------------------------------------------------------
  UPDATE public.qa_casos_teste SET observacoes = observacoes ||
    ' Requisitos YE-DP-FERIAS-001: RN-001/CA-001/CA-002.'
  WHERE codigo IN ('FERIAS-001','FERIAS-002') AND position('YE-DP-FERIAS-001' IN observacoes) = 0;

  UPDATE public.qa_casos_teste SET observacoes = observacoes ||
    ' Requisitos YE-DP-FERIAS-001: RN-004/CA-003 (fracionamento) — a concordância do empregado agora tem caso próprio de composição válida (FERIAS-010).'
  WHERE codigo IN ('FERIAS-011','FERIAS-012') AND position('YE-DP-FERIAS-001' IN observacoes) = 0;

  UPDATE public.qa_casos_teste SET observacoes = observacoes ||
    ' Requisitos YE-DP-FERIAS-001: RN-005/CA-004.'
  WHERE codigo = 'FERIAS-014' AND position('YE-DP-FERIAS-001' IN observacoes) = 0;

  UPDATE public.qa_casos_teste SET observacoes = observacoes ||
    ' Requisitos YE-DP-FERIAS-001: RN-003/RN-006/CA-009 — a Súmula 81 (dobro só dos dias excedentes) ganhou o caso FERIAS-022.'
  WHERE codigo IN ('FERIAS-020','FERIAS-021') AND position('YE-DP-FERIAS-001' IN observacoes) = 0;

  UPDATE public.qa_casos_teste SET observacoes = observacoes ||
    ' Requisitos YE-DP-FERIAS-001: CA-005/CA-008/RN-009 — as médias do art. 142 e as incidências (Tema 985) ganharam casos próprios (FERIAS-033/034).'
  WHERE codigo IN ('FERIAS-030','FERIAS-031','FERIAS-032') AND position('YE-DP-FERIAS-001' IN observacoes) = 0;

  UPDATE public.qa_casos_teste SET observacoes = observacoes ||
    ' Requisitos YE-DP-FERIAS-001: RN-008/CA-007.'
  WHERE codigo IN ('FERIAS-040','FERIAS-041','FERIAS-042') AND position('YE-DP-FERIAS-001' IN observacoes) = 0;

  UPDATE public.qa_casos_teste SET observacoes = observacoes ||
    ' Requisitos YE-DP-FERIAS-001: RN-011/CA-010 — o caso dos contratados há menos de 12 meses (art. 140) é o FERIAS-062.'
  WHERE codigo IN ('FERIAS-060','FERIAS-061') AND position('YE-DP-FERIAS-001' IN observacoes) = 0;

  SELECT count(*) INTO v_depois FROM public.qa_casos_teste WHERE modulo_id = v_mod;
  RAISE NOTICE 'Férias: % casos antes, % depois (esperado +19 na primeira execução).', v_antes, v_depois;
END $doc$;
