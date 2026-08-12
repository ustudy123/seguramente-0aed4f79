-- =========================================================
-- QA — Ponto: casos derivados da Análise de Requisitos do módulo
-- "PONTO Digital" (documento YE-DP-PONTO-001, Google Drive
-- "YE_Ponto_Digital_Requisitos", data-base ago/2026).
--
-- MÉTODO: as 13 regras de negócio (RN-001..013), os 12 requisitos
-- funcionais (RF-001..012), os 14 RNFs, os 14 critérios de aceite
-- (CA-001..014) e os 12 cenários de teste (seção 25) foram cruzados
-- um a um com a família PONTO-001..363 já registrada. Como nas levas
-- anteriores, os casos descrevem o comportamento que a LEI e o
-- documento exigem — não o que o sistema faz hoje.
--
-- JÁ COBERTO (sem caso novo; registrado para a rastreabilidade):
--   RN-003/CA-002 imutabilidade e hash ......... PONTO-004/190/191/192
--   RN-004/CA-005 tolerância art. 58 ........... PONTO-040..043/352/353
--   RN-005 HE e limites ........................ PONTO-090..093
--   RN-006/CA-006 noturno ...................... PONTO-110..113
--   RN-007/CA-008 banco por regime ............. PONTO-170..175/354..356
--   RN-008/CA-007 intervalos/interjornada ...... PONTO-060..064/080
--   RN-009 DSR ................................. PONTO-130..133
--   RN-010 12x36 e escalas ..................... PONTO-150..153
--   RN-013/parte fiscalização .................. PONTO-210..213/359..361
--   CA-009 ajuste rastreável ................... PONTO-190/195/357
--   CA-012 fechamento/reabertura ............... PONTO-193/358
--   Cenário "permissões insuficientes" ......... PONTO-004/252
--   Cenário "dado ausente" ..................... PONTO-021/023/290
--   Anti-duplicidade por janela ................ PONTO-350
--   LGPD selfie/aviso/link ..................... PONTO-254/362/363
--
-- SEM COBERTURA ATÉ AQUI — este arquivo documenta 29 casos novos
-- (PONTO-370..398): enquadramento e obrigatoriedade (RN-001/002),
-- art. 62 e teletrabalho (RN-011), integridade da captura (marcação
-- futura, Súmula 338, offline, Hora Legal), comprovante (RF-003),
-- importação de AFD (RF-004), memória de cálculo (RNF-012),
-- instrumento coletivo vigente, espelho×fechamento, alertas → Plano
-- de Ação (RF-010), limites de IA (LGPD art. 20), dossiê e
-- arquivamento (RF-012/CA-014), múltiplos vínculos, direitos do
-- titular e contingência de integração.
--
-- ESTA MIGRATION SÓ DOCUMENTA. Rotinas em leva futura (boa parte
-- depende de funcionalidades ainda não construídas — é proposital:
-- o documento pede o que o sistema DEVE fazer).
-- =========================================================

SET lock_timeout = '10s';

DO $doc$
DECLARE v_mod uuid; v_antes int; v_depois int;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos WHERE path = 'jornada-rotina/ponto';
  IF v_mod IS NULL THEN RAISE EXCEPTION 'Módulo jornada-rotina/ponto não encontrado.'; END IF;
  SELECT count(*) INTO v_antes FROM public.qa_casos_teste WHERE modulo_id = v_mod;

  INSERT INTO public.qa_casos_teste
    (modulo_id, codigo, titulo, tipo, prioridade, status, nivel,
     base_legal, objetivo, pre_condicoes, passos, resultado_esperado, observacoes)
  VALUES

  -- ══════════ A) ENQUADRAMENTO E OBRIGATORIEDADE (RN-001/002) ══════════

  (v_mod, 'PONTO-370', 'Estabelecimento com mais de 20 trabalhadores exige controle',
   'feliz', 'alta', 'aprovado', 'api',
   'CLT, art. 74, §2º (redação da Lei 13.874/2019)',
   'O controle de jornada é obrigatório quando o ESTABELECIMENTO passa de 20 trabalhadores — a contagem é por estabelecimento, não pela empresa inteira. Ao criar vínculo obrigado, o sistema deve exigir o controle e sinalizar a obrigatoriedade.',
   'Estabelecimento com 21+ colaboradores ativos.',
   '[{"ordem":1,"acao":"Cadastrar o 21º colaborador ativo no estabelecimento","resultado_esperado":"Sistema passa a tratar o controle como obrigatório e sinaliza"},
     {"ordem":2,"acao":"Conferir vínculo novo criado depois","resultado_esperado":"Nasce com exigência de marcação ativa"}]'::jsonb,
   'Acima de 20 no estabelecimento, controle obrigatório e sinalizado.',
   'Requisitos YE-DP-PONTO-001: RN-001 / CA-001. Sem controle quando obrigado, vale a jornada que o empregado alegar (Súmula 338 TST).'),

  (v_mod, 'PONTO-371', 'Até 20 trabalhadores: controle facultativo, sem falsas pendências',
   'alternativo', 'media', 'aprovado', 'api',
   'CLT, art. 74, §2º (contrario sensu)',
   'Abaixo do limite o controle é opcional. Empresa que NÃO optou não pode ser bombardeada com pendências de marcação; empresa que optou assume o padrão completo (comprovante, integridade, guarda).',
   'Estabelecimento com 10 colaboradores, controle desativado.',
   '[{"ordem":1,"acao":"Apurar a competência sem nenhuma marcação","resultado_esperado":"Nenhuma falta ou pendência de marcação é gerada"},
     {"ordem":2,"acao":"Ativar o controle por opção da empresa","resultado_esperado":"A partir daí o padrão legal completo se aplica, com a mesma integridade do obrigado"}]'::jsonb,
   'Facultativo de verdade: nem cobrança indevida, nem meio-padrão quando aderir.',
   'Requisitos YE-DP-PONTO-001: RN-001 (parametrização por estabelecimento).'),

  (v_mod, 'PONTO-372', 'Registro por exceção só com acordo escrito ou instrumento coletivo',
   'negativo', 'alta', 'aprovado', 'e2e',
   'CLT, art. 74, §4º',
   'O modo "registro por exceção" (só se anota o que foge da jornada) é lícito apenas mediante acordo individual ESCRITO, convenção ou acordo coletivo. Ativar o modo sem o documento anexado deve ser recusado ou, no mínimo, bloqueado com alerta.',
   'Empresa sem acordo de exceção cadastrado.',
   '[{"ordem":1,"acao":"Tentar ativar registro por exceção sem anexar o documento autorizador","resultado_esperado":"Recusado ou bloqueado, pedindo o acordo/instrumento"},
     {"ordem":2,"acao":"Anexar acordo individual escrito vigente e ativar","resultado_esperado":"Modo ativado, com o documento vinculado e a vigência registrada"}]'::jsonb,
   'Sem papel, sem exceção.',
   'Requisitos YE-DP-PONTO-001: RN-002. Documento arquivado em Empresa › Acordos (seção 16).'),

  -- ══════════ B) ART. 62 E TELETRABALHO (RN-011 / RF-011) ══════════

  (v_mod, 'PONTO-373', 'Dispensado do art. 62 não gera pendência nem falta',
   'feliz', 'alta', 'aprovado', 'api',
   'CLT, art. 62, I a III',
   'Atividade externa incompatível, cargo de gestão e teletrabalho por produção/tarefa dispensam controle. Para esses vínculos o sistema não exige marcação, não materializa falta e não abre pendência.',
   'Colaborador enquadrado no art. 62 (com documento de enquadramento).',
   '[{"ordem":1,"acao":"Apurar um mês inteiro sem nenhuma marcação do dispensado","resultado_esperado":"Nenhuma falta, lacuna ou pendência gerada"},
     {"ordem":2,"acao":"Conferir o cadastro do vínculo","resultado_esperado":"Enquadramento sinalizado com o fundamento (inciso) e o documento vinculado"}]'::jsonb,
   'Dispensado de direito, dispensado de fato.',
   'Requisitos YE-DP-PONTO-001: RN-011 / RF-011 / CA-010.'),

  (v_mod, 'PONTO-374', 'Teletrabalho por JORNADA mantém o controle obrigatório',
   'alternativo', 'alta', 'aprovado', 'api',
   'CLT, art. 62, III; Lei 14.442/2022',
   'A exclusão do teletrabalho vale só para quem é contratado por produção/tarefa. Teletrabalhista por jornada continua sujeito a controle — o sistema não pode dispensá-lo por engano só porque é remoto.',
   'Colaborador em teletrabalho com contrato por jornada.',
   '[{"ordem":1,"acao":"Enquadrar o contrato como teletrabalho por jornada","resultado_esperado":"Exigência de marcação permanece ativa (REP-P)"},
     {"ordem":2,"acao":"Dia útil sem marcação","resultado_esperado":"Lacuna apontada normalmente, como qualquer controlado"}]'::jsonb,
   'Remoto não é sinônimo de dispensado.',
   'Requisitos YE-DP-PONTO-001: RN-011. A modalidade (jornada × produção/tarefa) vem do contrato.'),

  (v_mod, 'PONTO-375', 'Controle de fato sobre dispensado gera alerta de descaracterização',
   'excecao', 'alta', 'aprovado', 'api',
   'CLT, art. 62 (jurisprudência: controle de fato descaracteriza a exclusão)',
   'Se um vínculo dispensado do controle passa a ter marcações reais, a exclusão do art. 62 corre risco de cair na Justiça — e as horas extras do período inteiro junto. O sistema deve detectar o conflito e alertar RH/Jurídico.',
   'Colaborador enquadrado no art. 62.',
   '[{"ordem":1,"acao":"Registrar marcações reais em dias seguidos para o dispensado","resultado_esperado":"Sistema detecta controle de fato em vínculo dispensado"},
     {"ordem":2,"acao":"Conferir alertas","resultado_esperado":"Alerta de possível descaracterização para RH/Jurídico, com a lista das marcações"}]'::jsonb,
   'Ou é dispensado, ou é controlado — os dois juntos são passivo.',
   'Requisitos YE-DP-PONTO-001: RN-011 / RF-011 / CA-010 / alerta da seção 14.'),

  -- ══════════ C) CAPTURA E INTEGRIDADE (RF-002 / RN-003 / RNF-003) ══════════

  (v_mod, 'PONTO-376', 'Marcação com data ou hora futura é recusada',
   'negativo', 'alta', 'aprovado', 'api',
   'Portaria MTE 671/2021 (fidelidade do registro); CLT, art. 74',
   'A marcação registra o momento em que aconteceu. Data ou hora futura (relógio adulterado do dispositivo, chamada direta de API) deve ser recusada — o carimbo de tempo é do servidor, sincronizado, nunca do cliente.',
   'Colaborador ativo.',
   '[{"ordem":1,"acao":"Enviar marcação com data de amanhã","resultado_esperado":"Recusada"},
     {"ordem":2,"acao":"Enviar marcação de hoje com hora futura (ex.: 23:59 sendo 10h)","resultado_esperado":"Recusada ou registrada com o horário DO SERVIDOR, nunca o informado"}]'::jsonb,
   'Ninguém bate o ponto de amanhã.',
   'Requisitos YE-DP-PONTO-001: validações da seção 13 ("marcação futura"). Complementa PONTO-002 (não restringir horário): recusar o FUTURO não é restringir horário legítimo.'),

  (v_mod, 'PONTO-377', 'Marcações "britânicas" (uniformes) são detectadas e alertadas',
   'excecao', 'alta', 'aprovado', 'api',
   'Súmula 338, III, TST',
   'Espelhos com horários idênticos todos os dias (08:00/12:00/13:00/17:00 cravados) são considerados INVÁLIDOS como prova — presunção a favor do empregado. O sistema deve detectar uniformidade prolongada e alertar, pois indica registro artificial.',
   'Colaborador com 30 dias de marcações idênticas ao minuto.',
   '[{"ordem":1,"acao":"Apurar competência com todas as marcações cravadas no mesmo minuto","resultado_esperado":"Detecção de uniformidade (ausência de variação real)"},
     {"ordem":2,"acao":"Conferir alertas","resultado_esperado":"Alerta de marcações uniformes com o risco da Súmula 338 explicado"}]'::jsonb,
   'Ponto britânico é prova contra a empresa, não a favor.',
   'Requisitos YE-DP-PONTO-001: RN-003 (Súmula 338 — marcações uniformes inválidas). Caso candidato a IA de anomalias (seção 18).'),

  (v_mod, 'PONTO-378', 'Marcação offline sincroniza depois preservando o momento real',
   'alternativo', 'alta', 'aprovado', 'e2e',
   'Portaria MTE 671/2021 (REP-P; identificação de status on/off-line)',
   'Sem conexão, a marcação grava localmente com o horário do MOMENTO DA BATIDA e sincroniza quando a rede volta — carimbada como off-line. O horário da sincronização não pode substituir o da batida.',
   'Dispositivo em modo offline.',
   '[{"ordem":1,"acao":"Marcar ponto às 08:00 sem conexão","resultado_esperado":"Gravada localmente com 08:00"},
     {"ordem":2,"acao":"Reconectar às 10:30","resultado_esperado":"Marcação sobe com hora 08:00 e status off-line preservado; comprovante emitido"},
     {"ordem":3,"acao":"Conferir a apuração do dia","resultado_esperado":"Usa 08:00, não 10:30"}]'::jsonb,
   'A hora é a da batida; a sincronização é só transporte.',
   'Requisitos YE-DP-PONTO-001: RF-002 / RNF-004 / cenário "Offline" da seção 25.'),

  (v_mod, 'PONTO-379', 'Divergência com a Hora Legal Brasileira gera alerta e registro',
   'excecao', 'media', 'aprovado', 'api',
   'Portaria MTE 671/2021 (sincronização com a Hora Legal Brasileira — Observatório Nacional)',
   'O REP-P deve operar sincronizado com a Hora Legal. Desvio acima da tolerância parametrizada precisa disparar alerta imediato (DP/TI), registrar o evento na trilha e ressincronizar — horário errado contamina toda a cadeia de marcações.',
   'Monitoração de tempo ativa.',
   '[{"ordem":1,"acao":"Simular desvio do relógio acima da tolerância","resultado_esperado":"Alerta imediato de divergência de relógio"},
     {"ordem":2,"acao":"Conferir a trilha","resultado_esperado":"Evento registrado com o desvio medido e a ressincronização"}]'::jsonb,
   'Relógio fora da Hora Legal é incidente, não detalhe.',
   'Requisitos YE-DP-PONTO-001: RNF-003 / alerta "Divergência de relógio (HBL)" da seção 14.'),

  -- ══════════ D) COMPROVANTE DE REGISTRO (RF-003) ══════════

  (v_mod, 'PONTO-380', 'Comprovante traz o conteúdo mínimo e o vínculo com a marcação',
   'feliz', 'alta', 'aprovado', 'e2e',
   'Portaria MTE 671/2021 (comprovante de registro de ponto)',
   'Cada marcação gera comprovante com identificação do empregador, do trabalhador, data/hora da marcação e vínculo com o registro (NSR). É o recibo legal do trabalhador — incompleto não vale.',
   'Colaborador ativo com marcação registrada.',
   '[{"ordem":1,"acao":"Registrar uma marcação","resultado_esperado":"Comprovante gerado"},
     {"ordem":2,"acao":"Abrir o comprovante","resultado_esperado":"Contém empregador, trabalhador, data/hora e referência inequívoca à marcação (NSR)"},
     {"ordem":3,"acao":"Conferir no módulo Documentos","resultado_esperado":"Arquivado em Funcionário › Ponto › Comprovantes, sem novo upload"}]'::jsonb,
   'Comprovante completo, vinculado e arquivado sozinho.',
   'Requisitos YE-DP-PONTO-001: RF-003 / CA-003 / seção 16. Complementa PONTO-005 (existência) e PONTO-359 (extração 48h).'),

  (v_mod, 'PONTO-381', 'Comprovante não disponibilizado em 48h vira alerta crítico',
   'excecao', 'alta', 'aprovado', 'api',
   'Portaria MTE 671/2021 (REP-P: comprovante em até 48 horas por meio eletrônico)',
   'No REP-P o comprovante pode ser disponibilizado eletronicamente em até 48h da marcação. Estourar esse prazo é descumprimento direto da Portaria: o sistema deve alertar ANTES do vencimento e criar ação se estourar.',
   'Marcação registrada há mais de 40h sem comprovante disponível.',
   '[{"ordem":1,"acao":"Aproximar-se do prazo (ex.: 40h) com comprovante pendente","resultado_esperado":"Alerta preventivo ao DP"},
     {"ordem":2,"acao":"Estourar as 48h","resultado_esperado":"Alerta crítico + ação no Plano de Ação com a marcação de origem vinculada"}]'::jsonb,
   'As 48h são da lei, não meta interna.',
   'Requisitos YE-DP-PONTO-001: RF-003 / CA-003 / alerta da seção 14 / cenário "Prazo vencido" da seção 25.'),

  -- ══════════ E) IMPORTAÇÃO DE AFD (RF-004) ══════════

  (v_mod, 'PONTO-382', 'AFD com integridade violada vai para quarentena — nada é conciliado',
   'excecao', 'alta', 'aprovado', 'api',
   'Portaria MTE 671/2021 (AFD: NSR, CRC-16 nos tipos 1-5, SHA-256 encadeado no tipo 7, assinatura)',
   'Arquivo importado com CRC inválido, cadeia SHA quebrada ou assinatura .p7s inválida não pode entrar nem parcialmente: vai inteiro para quarentena, com relatório do que falhou, e o DP é alertado. Conciliar arquivo corrompido contamina a base probatória.',
   'Arquivo AFD adulterado (um byte alterado num registro tipo 3).',
   '[{"ordem":1,"acao":"Importar o AFD adulterado","resultado_esperado":"Validação acusa a falha (CRC/SHA/assinatura) e o arquivo entra em quarentena"},
     {"ordem":2,"acao":"Conferir as marcações","resultado_esperado":"NENHUMA linha do arquivo foi conciliada"},
     {"ordem":3,"acao":"Conferir alertas","resultado_esperado":"Alerta crítico com o relatório de inconsistências"}]'::jsonb,
   'Ou o arquivo inteiro é confiável, ou nada dele entra.',
   'Requisitos YE-DP-PONTO-001: RF-004 / CA-004 / cenário "Com erro" da seção 25. Complementa PONTO-212 (lacuna de NSR).'),

  (v_mod, 'PONTO-383', 'Reimportar o mesmo AFD não duplica marcações',
   'negativo', 'alta', 'aprovado', 'api',
   'Portaria MTE 671/2021 (NSR único por REP); princípio da fidelidade',
   'Reprocessamento é rotina (falha no meio, operador repete o upload). O mesmo arquivo — ou outro arquivo contendo NSRs já importados do mesmo equipamento — não pode gerar marcações em dobro.',
   'AFD já importado com sucesso.',
   '[{"ordem":1,"acao":"Importar o mesmo AFD de novo","resultado_esperado":"Sistema reconhece (mesmo arquivo/NSRs) e não duplica nada"},
     {"ordem":2,"acao":"Conferir a contagem de marcações do período","resultado_esperado":"Idêntica à da primeira importação"}]'::jsonb,
   'Importar duas vezes = importar uma vez.',
   'Requisitos YE-DP-PONTO-001: seção 13 ("duplicidade de importação — mesmo AFD/NSR — e reprocessamento seguro").'),

  (v_mod, 'PONTO-384', 'Ajustes de relógio e eventos sensíveis do AFD entram na trilha',
   'alternativo', 'media', 'aprovado', 'api',
   'Portaria MTE 671/2021 (AFD: registro tipo 4 — ajuste do relógio; tipo 6 — eventos sensíveis)',
   'O AFD não traz só marcações: traz ajustes de relógio do equipamento (tipo 4) e eventos sensíveis (tipo 6). Esses registros devem ser importados e visíveis na trilha de auditoria — um relógio ajustado perto de uma marcação suspeita é exatamente o que o fiscal procura.',
   'AFD contendo registros tipo 4 e tipo 6.',
   '[{"ordem":1,"acao":"Importar o AFD","resultado_esperado":"Registros tipo 4 e 6 importados, não descartados"},
     {"ordem":2,"acao":"Consultar a trilha do equipamento/período","resultado_esperado":"Ajustes de relógio e eventos sensíveis listados com data/hora"}]'::jsonb,
   'A trilha guarda o relógio, não só as batidas.',
   'Requisitos YE-DP-PONTO-001: RF-004 / seção 23 ("ajustes de relógio; eventos sensíveis do REP").'),

  -- ══════════ F) MEMÓRIA DE CÁLCULO E PARÂMETROS (RF-005 / RNF-012) ══════════

  (v_mod, 'PONTO-385', 'Memória de cálculo reproduz o resultado a partir da fonte',
   'feliz', 'alta', 'aprovado', 'api',
   'Portaria MTE 671/2021 (Programa de Tratamento); princípio da auditabilidade',
   'Cada competência apurada gera memória de cálculo versionada: marcações-fonte + versão dos parâmetros → resultado. Reprocessar com os MESMOS insumos tem de dar o MESMO resultado, e a memória deve ser exportável para o auditor refazer a conta.',
   'Competência apurada.',
   '[{"ordem":1,"acao":"Apurar a competência e guardar a memória de cálculo","resultado_esperado":"Memória gerada com fonte, parâmetros e versão"},
     {"ordem":2,"acao":"Reprocessar a mesma competência sem mudar nada","resultado_esperado":"Resultado idêntico, minuto a minuto"},
     {"ordem":3,"acao":"Exportar a memória","resultado_esperado":"Legível o bastante para refazer a conta fora do sistema"}]'::jsonb,
   'Mesma fonte + mesmos parâmetros = mesmo resultado, sempre.',
   'Requisitos YE-DP-PONTO-001: RF-005 / RNF-012 / seção 13 ("validação de cálculo: reprodutibilidade").'),

  (v_mod, 'PONTO-386', 'Apuração usa o instrumento coletivo vigente NA COMPETÊNCIA',
   'alternativo', 'alta', 'aprovado', 'api',
   'CF/88, art. 7º, XXVI (reconhecimento das convenções); CLT (parametrização por CCT/ACT)',
   'Tolerância, adicionais e banco podem vir da CCT/ACT — mas do instrumento vigente na competência apurada, não do mais recente. Reapurar março com a convenção que só entrou em maio é erro clássico. Sobreposição de instrumentos deve gerar alerta, e instrumento a vencer avisa com 60/30 dias.',
   'Duas CCTs cadastradas com vigências distintas (percentuais diferentes).',
   '[{"ordem":1,"acao":"Apurar competência coberta pela CCT antiga","resultado_esperado":"Percentuais/tolerância da CCT antiga aplicados"},
     {"ordem":2,"acao":"Apurar competência coberta pela nova","resultado_esperado":"Parâmetros da nova aplicados"},
     {"ordem":3,"acao":"Cadastrar instrumentos com vigência sobreposta","resultado_esperado":"Alerta de conflito/sobreposição"},
     {"ordem":4,"acao":"Aproximar o vencimento do instrumento","resultado_esperado":"Alerta preventivo (60/30 dias) a RH/Jurídico"}]'::jsonb,
   'Cada competência com a norma do seu tempo.',
   'Requisitos YE-DP-PONTO-001: RNF-009 / seção 13 (vigências) / alerta "Instrumento coletivo vencido" / cenário "Regra coletiva diferente" da seção 25. Par com PONTO-153 (parâmetro não retroage).'),

  -- ══════════ G) ESPELHO × FECHAMENTO (RF-006 / RF-009) ══════════

  (v_mod, 'PONTO-387', 'Espelho não assinado impede a conclusão do fechamento',
   'negativo', 'alta', 'aprovado', 'e2e',
   'Portaria MTE 671/2021 (ciência do trabalhador); Súmula 338 TST (valor probatório)',
   'O espelho assinado pelo colaborador é a prova de ciência da jornada apurada. Fechar a competência com espelhos pendentes de assinatura, sem tratamento formal da recusa, enfraquece a prova — o fechamento deve travar ou exigir justificativa registrada.',
   'Competência apurada com 1 espelho sem assinatura.',
   '[{"ordem":1,"acao":"Tentar concluir o fechamento com espelho pendente","resultado_esperado":"Fechamento não conclui (ou exige justificativa formal da pendência), com alerta ao responsável"},
     {"ordem":2,"acao":"Colher a assinatura (ou registrar a recusa com ressalva) e fechar","resultado_esperado":"Fechamento conclui, com a situação de cada espelho registrada"}]'::jsonb,
   'Fechou, é porque todo mundo viu — ou a recusa está documentada.',
   'Requisitos YE-DP-PONTO-001: RF-006 / cenário "Documento inválido" da seção 25. Complementa PONTO-195 (ciência e ressalva).'),

  (v_mod, 'PONTO-388', 'Fechamento bloqueado enquanto houver pendência crítica',
   'negativo', 'alta', 'aprovado', 'api',
   'Portaria MTE 671/2021 (tratamento completo antes da consolidação)',
   'A competência só fecha com as pendências críticas resolvidas: ajustes em aberto, lacunas sem justificativa, falhas de integridade. Fechar por cima de pendência crítica manda dado errado para a folha e congela o erro.',
   'Competência com ajuste pendente de aprovação.',
   '[{"ordem":1,"acao":"Tentar fechar com ajuste pendente","resultado_esperado":"Bloqueado, listando as pendências que impedem"},
     {"ordem":2,"acao":"Resolver as pendências e fechar","resultado_esperado":"Fechamento conclui e a edição é bloqueada dali em diante"}]'::jsonb,
   'Pendência crítica aberta = competência aberta.',
   'Requisitos YE-DP-PONTO-001: RF-009 (validações). Par com PONTO-193 (competência fechada não aceita alteração) e PONTO-358 (reabertura formal).'),

  -- ══════════ H) ALERTAS, PLANO DE AÇÃO E IA (RF-010 / seções 14-15/18) ══════════

  (v_mod, 'PONTO-389', 'Alerta do ponto gera ação no Plano de Ação com 5W2H e origem',
   'feliz', 'media', 'aprovado', 'e2e',
   'Boa prática de compliance (documento YE: integração nativa com Plano de Ação)',
   'Todo alerta do módulo (lacuna, HE habitual, intervalo, banco a expirar, integridade, instrumento vencido) pode virar ação no Plano de Ação já preenchida: o quê, por quê (fundamento legal e risco), onde, quando (prazo pelo gatilho), quem (responsável sugerido) e como — mantendo o vínculo com o alerta de origem.',
   'Alerta de intervalo suprimido gerado.',
   '[{"ordem":1,"acao":"A partir do alerta, criar ação no Plano de Ação","resultado_esperado":"Ação nasce com 5W2H preenchido e fundamento legal no porquê"},
     {"ordem":2,"acao":"Abrir a ação criada","resultado_esperado":"Vínculo navegável com o alerta/marcação/competência de origem"}]'::jsonb,
   'Do alerta à ação sem digitação — e com rastro.',
   'Requisitos YE-DP-PONTO-001: RF-010 / seções 14-15 / CA-013.'),

  (v_mod, 'PONTO-390', 'Concluir a ação exige verificar se a ocorrência foi resolvida',
   'alternativo', 'media', 'aprovado', 'e2e',
   'Boa prática de gestão (validação de eficácia — documento YE, seção 15)',
   'Ao concluir a ação vinculada, o sistema confere a eficácia: a ocorrência de origem foi resolvida? O alerta pode encerrar? Se a causa persiste (ex.: intervalo continua suprimido na semana seguinte), o encerramento deve apontar a reincidência em vez de dar baixa cega.',
   'Ação de regularização vinculada a alerta de intervalo.',
   '[{"ordem":1,"acao":"Concluir a ação com a ocorrência de fato resolvida","resultado_esperado":"Alerta encerra junto, com evidência da regularização registrada"},
     {"ordem":2,"acao":"Concluir outra ação com a causa ainda ativa","resultado_esperado":"Sistema aponta que a ocorrência persiste (novo alerta ou reabertura), sem baixa silenciosa"}]'::jsonb,
   'Baixa de ação não é baixa de problema.',
   'Requisitos YE-DP-PONTO-001: seção 15 (validação de eficácia).'),

  (v_mod, 'PONTO-391', 'IA sugere, humano decide — nada automatizado afeta direito do trabalhador',
   'excecao', 'alta', 'aprovado', 'e2e',
   'LGPD, art. 20 (decisões automatizadas); CLT (direitos indisponíveis)',
   'O "Analisar com IA" produz causa provável, impacto e ação sugerida — mas NUNCA executa sozinho decisão que afete direito (descontar falta, negar ajuste, apontar fraude). Toda sugestão fica registrada com a decisão humana que a acatou ou rejeitou.',
   'Alerta com análise de IA disponível.',
   '[{"ordem":1,"acao":"Rodar o Analisar com IA sobre uma ocorrência","resultado_esperado":"Sugestão gerada; NENHUM desconto, negativa ou sanção aplicada automaticamente"},
     {"ordem":2,"acao":"Acatar ou rejeitar a sugestão","resultado_esperado":"Registro da sugestão da IA + decisão humana + autor, na trilha"}]'::jsonb,
   'IA no volante de apoio, nunca no comando.',
   'Requisitos YE-DP-PONTO-001: RF-010 / seção 18 (limites gerais de IA).'),

  -- ══════════ I) FISCALIZAÇÃO E DOCUMENTOS (RF-012 / CA-011 / CA-014) ══════════

  (v_mod, 'PONTO-392', 'Dossiê de fiscalização sai íntegro, assinado e com índice',
   'feliz', 'alta', 'aprovado', 'e2e',
   'Portaria MTE 671/2021 (apresentação ao Auditor-Fiscal); Súmula 338 TST (dever de exibição)',
   'Diante de fiscalização ou litígio, o DP/Jurídico gera em uma operação o dossiê do período/trabalhador: AFD, AEJ, comprovantes, espelhos assinados, trilha de ajustes e memórias — cada peça com integridade e assinatura verificadas, e um índice com os hashes.',
   'Período com dados completos (marcações, espelhos, arquivos).',
   '[{"ordem":1,"acao":"Gerar o dossiê de um trabalhador/período","resultado_esperado":"Pacote com todas as peças, índice de conteúdo e hashes"},
     {"ordem":2,"acao":"Verificar as assinaturas das peças","resultado_esperado":"Todas válidas; peça com problema é apontada antes da entrega"}]'::jsonb,
   'Fiscalização atendida em um clique, sem caça a arquivos.',
   'Requisitos YE-DP-PONTO-001: RF-012 / CA-011 / seção 29 ("modo fiscalização em um clique").'),

  (v_mod, 'PONTO-393', 'Toda peça do ponto se arquiva sozinha no módulo Documentos',
   'feliz', 'media', 'aprovado', 'e2e',
   'Boa prática de guarda documental (prazos legais de guarda — Portaria 671/2021)',
   'Comprovantes, AFD, AEJ, espelhos, memórias, extratos de banco e logs são salvos automaticamente no módulo Documentos, classificados na pasta certa (seção 16 do documento) e vinculados a empresa/funcionário/competência — sem upload manual, sem cópia solta.',
   'Competência processada de ponta a ponta.',
   '[{"ordem":1,"acao":"Percorrer as pastas de Documentos após o fechamento","resultado_esperado":"Cada peça na pasta prevista (Funcionário › Ponto › ..., Processo › Ponto › ...) com metadados e vínculos"},
     {"ordem":2,"acao":"Conferir duplicidade","resultado_esperado":"Uma peça, um registro — sem cópias divergentes"}]'::jsonb,
   'Gerou, arquivou, classificou — sozinho.',
   'Requisitos YE-DP-PONTO-001: CA-014 / seção 16 (tabela de documentos e pastas).'),

  -- ══════════ J) MÚLTIPLOS VÍNCULOS E MOVIMENTAÇÃO (seção 9) ══════════

  (v_mod, 'PONTO-394', 'Dois vínculos do mesmo trabalhador apuram separados',
   'alternativo', 'alta', 'aprovado', 'api',
   'CLT (contratos autônomos entre si); Portaria MTE 671/2021 (arquivos por empregador)',
   'Um CPF pode ter dois vínculos (duas empresas do grupo, ou dois estabelecimentos). Marcações, apuração, banco de horas e arquivos legais são POR VÍNCULO — nada se mistura. Consolidação só em visão gerencial, nunca na apuração.',
   'Mesmo CPF com dois vínculos ativos em estabelecimentos distintos.',
   '[{"ordem":1,"acao":"Marcar ponto nos dois vínculos no mesmo dia","resultado_esperado":"Cada marcação no seu vínculo, sem vazamento"},
     {"ordem":2,"acao":"Apurar e gerar arquivos","resultado_esperado":"Espelhos, AFD/AEJ e banco segregados por vínculo/estabelecimento"}]'::jsonb,
   'Um CPF, dois contratos, duas contas separadas.',
   'Requisitos YE-DP-PONTO-001: cenário "Múltiplos vínculos" das seções 9 e 25. Difere de PONTO-250 (fronteira entre TENANTS): aqui é dentro do mesmo cliente.'),

  (v_mod, 'PONTO-395', 'Transferência de estabelecimento preserva o histórico e a continuidade',
   'alternativo', 'media', 'aprovado', 'api',
   'CLT, art. 469 (transferência); Portaria MTE 671/2021 (arquivos por estabelecimento)',
   'Transferido o colaborador, o ponto encerra no estabelecimento de origem e reinicia no destino — na data certa, sem buraco e sem sobreposição. O histórico anterior permanece consultável e entra nos arquivos do estabelecimento onde foi gerado.',
   'Colaborador transferido no meio da competência.',
   '[{"ordem":1,"acao":"Efetivar a transferência com data de corte","resultado_esperado":"Origem encerra no dia D-1, destino inicia no dia D"},
     {"ordem":2,"acao":"Apurar a competência da transferência","resultado_esperado":"Cada trecho apurado no seu estabelecimento; total do mês íntegro"},
     {"ordem":3,"acao":"Gerar AFD/AEJ de cada estabelecimento","resultado_esperado":"Marcações no arquivo do estabelecimento onde ocorreram"}]'::jsonb,
   'Mudou de casa, não de história.',
   'Requisitos YE-DP-PONTO-001: cenário "Transferência de estabelecimento" da seção 9.'),

  -- ══════════ K) LGPD E CONTINGÊNCIA (seções 22-23 / RNF) ══════════

  (v_mod, 'PONTO-396', 'Colaborador acessa os próprios dados de ponto',
   'feliz', 'media', 'aprovado', 'e2e',
   'LGPD, art. 18 (direitos do titular); Portaria MTE 671/2021 (comprovante ao trabalhador)',
   'O titular acessa o que é dele: comprovantes, espelhos, extrato de banco de horas e as próprias marcações — sem depender de pedir ao RH. Correção de dado se faz pelo ajuste rastreável, nunca por edição livre.',
   'Colaborador logado no portal.',
   '[{"ordem":1,"acao":"Abrir comprovantes, espelhos e extrato de banco próprios","resultado_esperado":"Tudo acessível, somente os PRÓPRIOS dados"},
     {"ordem":2,"acao":"Tentar acessar dados de um colega","resultado_esperado":"Negado"},
     {"ordem":3,"acao":"Pedir correção de uma marcação","resultado_esperado":"Cai no fluxo de ajuste com justificativa — não em edição direta"}]'::jsonb,
   'Transparência para o dono do dado; porta fechada para o resto.',
   'Requisitos YE-DP-PONTO-001: seção 22 (direitos do titular). Par com PONTO-362 (enumeração bloqueada).'),

  (v_mod, 'PONTO-397', 'Acesso a dado sensível e exportação ficam na trilha de auditoria',
   'excecao', 'alta', 'aprovado', 'api',
   'LGPD, arts. 11 e 46 (dados sensíveis; registros de tratamento)',
   'Quem visualizou biometria/selfie/geolocalização e quem exportou dados de ponto (AFD, AEJ, relatórios) fica registrado em log imutável: usuário, data/hora, o que acessou e por quê. Sem esse rastro, vazamento vira mistério insolúvel.',
   'Usuário gestor com acesso a dados de marcação.',
   '[{"ordem":1,"acao":"Visualizar a selfie/geolocalização de uma marcação","resultado_esperado":"Acesso registrado no log (quem, quando, o quê)"},
     {"ordem":2,"acao":"Exportar um relatório de marcações","resultado_esperado":"Exportação registrada com escopo e destinatário"},
     {"ordem":3,"acao":"Tentar apagar a entrada do log","resultado_esperado":"Impossível — log é append-only"}]'::jsonb,
   'Dado sensível visto = visita registrada.',
   'Requisitos YE-DP-PONTO-001: seção 23 ("acessos a dados sensíveis e exportações") / RNF-007.'),

  (v_mod, 'PONTO-398', 'Folha indisponível no fechamento: pacote enfileira e reenvia sem perda',
   'excecao', 'media', 'aprovado', 'api',
   'Boa prática de contingência (documento YE: RNF-014)',
   'Se a integração com a Folha está fora do ar na hora do fechamento, o pacote de eventos entra em fila e reenvia sozinho quando voltar — sem perder evento, sem duplicar no reenvio e sem travar o fechamento já concluído.',
   'Competência fechada com integração de folha indisponível.',
   '[{"ordem":1,"acao":"Fechar a competência com a folha fora do ar","resultado_esperado":"Fechamento conclui; pacote enfileirado com alerta do pendente"},
     {"ordem":2,"acao":"Restabelecer a integração","resultado_esperado":"Reenvio automático; recebimento confirmado"},
     {"ordem":3,"acao":"Conferir os eventos entregues","resultado_esperado":"Completos e sem duplicidade"}]'::jsonb,
   'A fila segura; ninguém digita de novo.',
   'Requisitos YE-DP-PONTO-001: RNF-014 / cenário "Integração indisponível" da seção 25.')

  ON CONFLICT (codigo) DO NOTHING;

  -- ---------------------------------------------------------
  -- Melhorias em casos existentes (referência cruzada com o
  -- documento de requisitos; só acrescenta, não reescreve)
  -- ---------------------------------------------------------
  UPDATE public.qa_casos_teste
  SET observacoes = observacoes || ' Requisitos YE-DP-PONTO-001: RF-003/CA-003 — conteúdo mínimo e prazo de 48h ganharam casos próprios (PONTO-380/381).'
  WHERE codigo = 'PONTO-005' AND position('YE-DP-PONTO-001' IN observacoes) = 0;

  UPDATE public.qa_casos_teste
  SET observacoes = observacoes || ' Requisitos YE-DP-PONTO-001: RN-004 — CCT/ACT pode fixar tolerância MAIS benéfica que a legal; a trava é só para cima.'
  WHERE codigo = 'PONTO-043' AND position('YE-DP-PONTO-001' IN observacoes) = 0;

  UPDATE public.qa_casos_teste
  SET observacoes = observacoes || ' Requisitos YE-DP-PONTO-001: seção 23 — a trilha também deve capturar ACESSOS a dados sensíveis e exportações (caso PONTO-397).'
  WHERE codigo = 'PONTO-192' AND position('YE-DP-PONTO-001' IN observacoes) = 0;

  UPDATE public.qa_casos_teste
  SET observacoes = observacoes || ' Requisitos YE-DP-PONTO-001: RF-004 — além da lacuna de NSR, integridade CRC-16/SHA-256/assinatura e quarentena ganharam o caso PONTO-382.'
  WHERE codigo = 'PONTO-212' AND position('YE-DP-PONTO-001' IN observacoes) = 0;

  SELECT count(*) INTO v_depois FROM public.qa_casos_teste WHERE modulo_id = v_mod;
  RAISE NOTICE 'Ponto: % casos antes, % depois (esperado +29 na primeira execução).', v_antes, v_depois;
END $doc$;
