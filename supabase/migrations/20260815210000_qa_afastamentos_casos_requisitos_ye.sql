-- =========================================================
-- QA — Afastamentos: casos derivados da Análise de Requisitos do módulo
-- (documento YE-DP-AFAST-001, Google Doc "YE — Afastamentos — Análise
-- de Requisitos", data-base ago/2026).
--
-- MÉTODO: as 9 regras de negócio (RN-001..009), os 10 critérios de
-- aceite (CA-001..010) e os 12 cenários de teste (seção 25) foram
-- cruzados com a família AFAST (3 casos de encerramento) e com as
-- famílias vizinhas — o documento chama Afastamentos de "tecido
-- conectivo", e boa parte dos reflexos já tem caso do lado de lá:
--
-- JÁ COBERTO (referência cruzada, sem duplicar):
--   Encerramento/datas do afastamento ........... AFAST-001..003
--   Ponto não cobra marcação de afastado ........ PONTO-025
--   Férias: art. 133 reinicia o aquisitivo ...... FERIAS-003/024/053
--   13º: avos e responsabilidade empresa×INSS ... DEC13-003
--   Rescisão: estabilidades bloqueiam dispensa .. DESL-003/070/071/077
--   Folha: conciliação com os módulos ........... FOLHA-080
--   eSocial: anti-duplicidade/rejeição .......... ADM-093..DESL-094 (série)
--
-- PONTOS BONS já visíveis (as sondas confirmarão): a inteligência de
-- afastamento existe e é viva (processar_inteligencia_afastamento:
-- regra dos 15 dias → aguardando_inss, acumulação por CID em 60 dias,
-- NTEP/FAP, tarefa de CAT, estabilidade pós-acidente com
-- data_fim_estabilidade, ASO de retorno pendente); atestados têm CID
-- protegido pela camada perfil_restringe_leitura_atestados.
--
-- SEM COBERTURA — este arquivo documenta 14 casos novos: efeito legal
-- por tipo (interrupção × suspensão) e mapeamento à Tabela 18,
-- sobreposição de períodos, 15 dias/recaída COMO REGRA (não só
-- alerta), reflexo na folha, CAT no 1º dia útil, criação da
-- estabilidade, FGTS por tipo, maternidade/paternidade, art. 473 com
-- hipóteses e prazos, art. 474 (30 dias), prazos do S-2230, retorno
-- com ASO obrigatório e log de acesso ao CID.
--
-- ESTA MIGRATION SÓ DOCUMENTA. Rotinas em leva futura.
-- =========================================================

SET lock_timeout = '10s';

DO $doc$
DECLARE v_mod uuid; v_antes int; v_depois int;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos
  WHERE path = 'jornada-rotina/afastamentos';
  IF v_mod IS NULL THEN RAISE EXCEPTION 'Módulo jornada-rotina/afastamentos não encontrado.'; END IF;
  SELECT count(*) INTO v_antes FROM public.qa_casos_teste WHERE modulo_id = v_mod;

  INSERT INTO public.qa_casos_teste
    (modulo_id, codigo, titulo, tipo, prioridade, status, nivel,
     base_legal, objetivo, pre_condicoes, passos, resultado_esperado, observacoes)
  VALUES

  -- ══════════ A) CLASSIFICAÇÃO E EFEITO LEGAL ══════════

  (v_mod, 'AFAST-010', 'Cada tipo de afastamento tem efeito legal e código da Tabela 18 definidos',
   'feliz', 'alta', 'aprovado', 'api',
   'CLT (interrupção × suspensão do contrato); eSocial — S-2230 e Tabela 18 (motivos de afastamento)',
   'O tipo do afastamento decide TUDO: interrupção mantém salário e tempo de serviço; suspensão não paga e (em regra) não conta. E cada tipo precisa do código da Tabela 18 do eSocial para o S-2230 sair certo. O sistema já classifica por um catálogo rico de tipos — o que falta conferir é se cada tipo carrega o EFEITO legal parametrizado e o código do eSocial, em vez de deixar as consequências por conta de quem lê o nome.',
   'Catálogo de tipos de afastamento carregado (enum afastamento_tipo_principal).',
   '[{"ordem":1,"acao":"Conferir o catálogo de tipos","resultado_esperado":"Cada tipo com efeito legal (interrupção/suspensão) e código da Tabela 18 parametrizados, com vigência"},
     {"ordem":2,"acao":"Registrar afastamento de tipo com efeito interrupção","resultado_esperado":"Folha mantém pagamento; tempo de serviço corre"},
     {"ordem":3,"acao":"Registrar tipo com efeito suspensão","resultado_esperado":"Pagamento suspenso; efeito em FGTS/tempo conforme a matriz"}]'::jsonb,
   'O tipo carrega a lei consigo — efeito e código, nunca só o nome.',
   'Requisitos YE-DP-AFAST-001: RF-001/RF-002 / RNF-004 / seção 30 (matriz de efeitos por cliente é [VAL]). O enum de tipos existe (afastamento_tipo_principal); a matriz de efeitos e o mapeamento à Tabela 18, não.'),

  (v_mod, 'AFAST-011', 'Períodos de afastamento do mesmo colaborador não se sobrepõem',
   'negativo', 'alta', 'aprovado', 'api',
   'Consistência do registro (seção 13: datas coerentes e sobreposição); reflexos idempotentes (RNF-001)',
   'Dois afastamentos ativos sobrepostos para a mesma pessoa são um bug com juros: o Ponto não sabe qual regra aplicar, a Folha pode suspender duas vezes (ou nenhuma) e o eSocial recebe eventos conflitantes. O registro novo que invade período de afastamento ativo deve ser recusado — ou tratado explicitamente como prorrogação/retificação do existente, nunca como registro paralelo.',
   'Colaborador fictício com afastamento ativo de 1º a 30 do mês.',
   '[{"ordem":1,"acao":"Registrar segundo afastamento começando no dia 15 do mesmo período","resultado_esperado":"Recusado — sobreposição apontada, com oferta de prorrogar/retificar o existente"},
     {"ordem":2,"acao":"Registrar afastamento que começa após o fim do primeiro","resultado_esperado":"Aceito normalmente"}]'::jsonb,
   'Um período por vez: o que invade é prorrogação ou é erro.',
   'Requisitos YE-DP-AFAST-001: seção 13 (sobreposição) / RNF-001 (reflexos sem duplicidade). Complementa AFAST-001..003 (datas e encerramento).'),

  -- ══════════ B) DOENÇA: 15 DIAS, RECAÍDA E FOLHA ══════════

  (v_mod, 'AFAST-020', 'Doença acima de 15 dias: empresa paga 15, INSS assume do 16º',
   'feliz', 'critica', 'aprovado', 'api',
   'Lei 8.213/1991, art. 60, §3º',
   'Na incapacidade por doença, a empresa paga os 15 PRIMEIROS dias e o INSS assume do 16º em diante. O sistema deve virar o afastamento para o estado de encaminhamento ao INSS ao cruzar os 15 dias — automaticamente, não quando alguém lembra — e alertar o DP no 15º dia. A regra já vive no banco (inteligência do afastamento); o caso a exercita e a protege de regressão.',
   'Afastamento por doença com duração superior a 15 dias no ambiente de teste.',
   '[{"ordem":1,"acao":"Registrar afastamento de doença com 20 dias","resultado_esperado":"Ao cruzar os 15 dias, status muda para aguardando_inss automaticamente"},
     {"ordem":2,"acao":"Conferir o alerta","resultado_esperado":"DP alertado no 15º dia para encaminhar ao INSS"},
     {"ordem":3,"acao":"Registrar afastamento de 10 dias","resultado_esperado":"Permanece por conta da empresa, sem encaminhamento"}]'::jsonb,
   'Quinze dias da empresa, o resto do INSS — e a virada é automática.',
   'Requisitos YE-DP-AFAST-001: RN-001 / CA-001 / cenário "Longo (INSS)" (seção 25). PONTO BOM: processar_inteligencia_afastamento já implementa a virada para aguardando_inss — o caso protege a regra de regressão.'),

  (v_mod, 'AFAST-021', 'Recaída da mesma doença em 60 dias reabre o benefício sem novos 15 dias',
   'alternativo', 'alta', 'aprovado', 'api',
   'Lei 8.213/1991 e regulamento (recaída dentro de 60 dias da cessação: mesmo benefício); eSocial — S-2230 no 1º dia na recaída',
   'Afastou por lombalgia, voltou, e em 40 dias afastou de novo pela MESMA doença: é recaída — o benefício anterior reabre, a empresa NÃO paga novos 15 dias e o S-2230 vai no 1º dia. Tratar recaída como afastamento novo faz a empresa pagar quinze dias que são do INSS, repetidamente. A acumulação por CID em 60 dias já existe na inteligência; o caso confere o efeito completo.',
   'Colaborador com afastamento encerrado há menos de 60 dias e novo atestado com o mesmo CID.',
   '[{"ordem":1,"acao":"Registrar o novo afastamento com o mesmo CID dentro de 60 dias","resultado_esperado":"Reconhecido como recaída — dias acumulados com o afastamento anterior"},
     {"ordem":2,"acao":"Conferir a responsabilidade","resultado_esperado":"Sem novos 15 dias da empresa; encaminhamento ao INSS conforme o acumulado"},
     {"ordem":3,"acao":"Novo atestado com CID diferente","resultado_esperado":"Afastamento novo — contagem própria de 15 dias"}]'::jsonb,
   'Mesma doença em 60 dias soma; doença nova zera.',
   'Requisitos YE-DP-AFAST-001: RN-001 (exceção) / cenário "Recaída" (seção 25). A acumulação por CID existe (processar_inteligencia_afastamento); a regra exata da recaída é [VAL] (seção 30). Depende do CID — que o formulário de atestado precisa alimentar.'),

  (v_mod, 'AFAST-022', 'O afastamento chega à folha: 15 dias pagos, suspensão do 16º',
   'feliz', 'critica', 'aprovado', 'api',
   'Lei 8.213/1991, art. 60 (responsabilidade da empresa); CLT (efeitos da suspensão no salário)',
   'Registrar o afastamento é metade do trabalho; a outra metade é a FOLHA obedecer: os 15 primeiros dias de doença entram como remuneração normal (rubrica própria), do 16º em diante o salário suspende, e a competência que atravessa a virada divide os dias. Se a folha não consome o afastamento, o DP ajusta na mão — e o erro em cadeia que o documento descreve começa exatamente aí.',
   'Afastamento de 40 dias atravessando duas competências; folha das competências processada.',
   '[{"ordem":1,"acao":"Processar a folha da competência do início","resultado_esperado":"15 dias pagos pela empresa em rubrica própria; dias seguintes suspensos"},
     {"ordem":2,"acao":"Processar a competência seguinte","resultado_esperado":"Período INSS integralmente suspenso na folha"},
     {"ordem":3,"acao":"Conferir a origem do lançamento","resultado_esperado":"Gerado do afastamento registrado (origem rastreável), não redigitado"}]'::jsonb,
   'O afastamento registrado vira folha certa — sem redigitação.',
   'Requisitos YE-DP-AFAST-001: RN-001 (impacto Folha) / CA-001. Par do FOLHA-080 (lado folha): aqui se testa que o AFASTAMENTO dispara o reflexo. DIVERGÊNCIA VISÍVEL: nenhuma função liga afastamentos a folha_lancamentos. Deve falhar e encaminhar.'),

  -- ══════════ C) ACIDENTE: CAT, ESTABILIDADE E FGTS ══════════

  (v_mod, 'AFAST-030', 'Acidente de trabalho: CAT preparada até o 1º dia útil seguinte',
   'excecao', 'critica', 'aprovado', 'api',
   'Lei 8.213/1991, art. 22 (CAT até o 1º dia útil seguinte; imediata em óbito); eSocial — S-2210',
   'A CAT tem o prazo mais curto do DP: 1º dia útil seguinte ao acidente (imediata no óbito). Registrado um afastamento acidentário, o sistema prepara a CAT (S-2210), projeta o prazo pelo calendário (acidente na sexta → CAT até segunda) e escala o alerta como crítico — CAT fora do prazo é multa e enfraquece a defesa da empresa em tudo que vier depois.',
   'Afastamento com tipo acidentário (acidente_tipico/trajeto) registrado no ambiente de teste.',
   '[{"ordem":1,"acao":"Registrar o afastamento acidentário","resultado_esperado":"Pendência de CAT criada com prazo no 1º dia útil seguinte (calendário consultado)"},
     {"ordem":2,"acao":"Deixar o prazo se aproximar sem emissão","resultado_esperado":"Alerta crítico a SST/DP; ação no Plano de Ação"},
     {"ordem":3,"acao":"Emitir e anexar a CAT","resultado_esperado":"S-2210 preparado; CAT arquivada na pasta do colaborador com recibo"}]'::jsonb,
   'Acidente hoje, CAT amanhã — o prazo mais curto do DP é vigiado como tal.',
   'Requisitos YE-DP-AFAST-001: RN-002 / CA-002 / cenário "Prazo vencido" (seção 25). A inteligência já cria tarefa de CAT; o que se confere é o PRAZO no 1º dia útil (calendário) e a escalada. Integra com eventos_sst (cat_tipo/cat_data_emissao).'),

  (v_mod, 'AFAST-031', 'Acidente cria a estabilidade de 12 meses que a Rescisão enxerga',
   'feliz', 'alta', 'aprovado', 'api',
   'Lei 8.213/1991, art. 118 (estabilidade de 12 meses após a cessação do auxílio acidentário)',
   'A estabilidade acidentária nasce AQUI: cessado o auxílio-doença acidentário, correm 12 meses em que a dispensa imotivada é vedada. O afastamento acidentário encerrado deve gravar o fim da estabilidade (data da alta + 12 meses) — e é esse registro que o módulo de Rescisão consulta (DESL-071) para bloquear a dispensa. Sem a criação automática, o bloqueio de lá não tem o que ler (o falso negativo do DESL-077).',
   'Afastamento acidentário com benefício encerrado (alta) no ambiente de teste.',
   '[{"ordem":1,"acao":"Encerrar o afastamento acidentário","resultado_esperado":"data_fim_estabilidade gravada = alta + 12 meses"},
     {"ordem":2,"acao":"Consultar o mapa de estabilidades","resultado_esperado":"Estabilidade ativa listada com o vencimento"},
     {"ordem":3,"acao":"Vencido o período","resultado_esperado":"Estabilidade expira e a dispensa volta a ser possível"}]'::jsonb,
   'A alta liga o relógio dos 12 meses — e a Rescisão lê este registro.',
   'Requisitos YE-DP-AFAST-001: RN-002/RN-006 / CA-002/CA-003. PONTO BOM: data_fim_estabilidade existe e a inteligência a alimenta (migration de 23/07) — o caso protege a regra e confere a ponta da expiração. O lado Rescisão é DESL-071/077.'),

  (v_mod, 'AFAST-032', 'FGTS mantido no acidente e no serviço militar; suspenso nos demais',
   'alternativo', 'media', 'aprovado', 'api',
   'Lei 8.036/1990, art. 15, §5º',
   'O FGTS não para em dois afastamentos: acidente de trabalho e serviço militar — nesses, o depósito de 8% continua o afastamento inteiro. Nos demais (doença comum a partir do 16º, licença sem remuneração), suspende. Errar para menos é dívida de FGTS que o FGTS Digital denuncia; errar para mais é custo indevido. O efeito por tipo precisa estar na matriz do AFAST-010 e chegar à folha.',
   'Afastamentos de tipos distintos (acidentário, doença comum longa, licença não remunerada).',
   '[{"ordem":1,"acao":"Conferir o FGTS do afastado por acidente","resultado_esperado":"Depósito de 8% mantido em todas as competências do afastamento"},
     {"ordem":2,"acao":"Conferir doença comum a partir do 16º dia","resultado_esperado":"Depósito suspenso no período INSS"},
     {"ordem":3,"acao":"Conferir licença não remunerada","resultado_esperado":"Depósito suspenso"}]'::jsonb,
   'Acidente e quartel mantêm o FGTS; o resto suspende — por tipo, nunca por lembrança.',
   'Requisitos YE-DP-AFAST-001: RN-005 / CA-005. Depende da matriz de efeitos (AFAST-010) e do reflexo na folha (AFAST-022). Efeitos por tipo são [VAL] (seção 30).'),

  -- ══════════ D) MATERNIDADE E PATERNIDADE ══════════

  (v_mod, 'AFAST-040', 'Maternidade: 120 dias (+60 Empresa Cidadã), estabilidade gestante criada',
   'feliz', 'alta', 'aprovado', 'api',
   'CLT, art. 392; Lei 8.213/1991, art. 71; ADCT, art. 10, II, "b" e §1º; Lei 11.770/2008 (Empresa Cidadã)',
   'A licença-maternidade é de 120 dias — 180 se a empresa aderiu ao Empresa Cidadã — e caminha junto com a estabilidade da gestante (confirmação da gravidez até 5 meses após o parto), que a Rescisão precisa enxergar. A paternidade é de 5 dias (+15 na adesão). A adesão ao programa é parâmetro da EMPRESA: sem ela cadastrada, o sistema nem sabe qual prazo aplicar.',
   'Empresa fictícia com e sem adesão ao Empresa Cidadã; licenças registradas.',
   '[{"ordem":1,"acao":"Registrar licença-maternidade em empresa sem adesão","resultado_esperado":"120 dias projetados; estabilidade gestante criada (até 5 meses pós-parto)"},
     {"ordem":2,"acao":"Registrar em empresa aderente ao Empresa Cidadã","resultado_esperado":"180 dias (120+60), citando a adesão parametrizada"},
     {"ordem":3,"acao":"Registrar licença-paternidade","resultado_esperado":"5 dias (+15 na adesão), sem desconto"}]'::jsonb,
   'O prazo vem da lei e da adesão; a estabilidade nasce junto com a licença.',
   'Requisitos YE-DP-AFAST-001: RN-006 / CA-006 / cenário "Maternidade" (seção 25). O tipo licenca_maternidade existe no enum; a adesão ao Empresa Cidadã e a estabilidade gestante estruturada, não. O lado Rescisão é DESL-070. Salário-maternidade (pagamento/compensação) é [VAL].'),

  -- ══════════ E) FALTAS JUSTIFICADAS E SUSPENSÃO ══════════

  (v_mod, 'AFAST-050', 'Faltas do art. 473: hipóteses com prazos próprios, sem desconto e com DSR',
   'alternativo', 'alta', 'aprovado', 'api',
   'CLT, art. 473 (falecimento 2 dias; casamento 3; paternidade; doação de sangue 1/ano; alistamento 2; juízo; pré-natal — cada hipótese com seu prazo)',
   'O art. 473 é uma LISTA com prazos: 2 dias por falecimento de familiar próximo, 3 por casamento, 1 por ano para doar sangue, comparecimento a juízo pelo tempo necessário, acompanhamento de pré-natal... Dentro da hipótese e do prazo, não há desconto e o DSR fica preservado; o que EXCEDER vira falta comum. Um tipo genérico "falta justificada" sem as hipóteses parametrizadas deixa a decisão (e o erro) para o operador.',
   'Catálogo de faltas justificadas; registros de hipóteses distintas no ambiente de teste.',
   '[{"ordem":1,"acao":"Registrar 2 dias por falecimento (art. 473, I)","resultado_esperado":"Sem desconto; DSR preservado; hipótese e prazo citados"},
     {"ordem":2,"acao":"Registrar 4 dias pelo mesmo motivo","resultado_esperado":"2 dias justificados; os 2 excedentes tratados como falta comum (com alerta)"},
     {"ordem":3,"acao":"Registrar segunda doação de sangue no mesmo ano","resultado_esperado":"Recusada como justificada — limite de 1/ano; vira falta comum se mantida"}]'::jsonb,
   'Cada hipótese com seu prazo; o excedente não pega carona na justificativa.',
   'Requisitos YE-DP-AFAST-001: RN-009 / CA-010 / cenário "Falta justificada" (seção 25). O enum tem só falta_justificada_legal genérico — as hipóteses/prazos do 473 não existem parametrizados. Hipóteses ampliadas por CCT são [RCC].'),

  (v_mod, 'AFAST-051', 'Suspensão disciplinar limitada a 30 dias',
   'negativo', 'media', 'aprovado', 'api',
   'CLT, art. 474 — suspensão superior a 30 dias consecutivos importa rescisão injusta do contrato',
   'A suspensão disciplinar tem teto DURO: 30 dias consecutivos. No 31º dia, a lei converte a punição em rescisão injusta — o empregado pode considerar-se dispendido com todas as verbas. Suspensão de 45 dias gravada sem resistência é o sistema ajudando a empresa a criar o passivo. O registro deve recusar (ou travar em 30 com alerta) qualquer suspensão disciplinar acima do limite.',
   'Registro de suspensão disciplinar no ambiente de teste.',
   '[{"ordem":1,"acao":"Registrar suspensão disciplinar de 45 dias","resultado_esperado":"Recusada — teto legal de 30 dias consecutivos (art. 474)"},
     {"ordem":2,"acao":"Registrar suspensão de 15 dias","resultado_esperado":"Aceita; salário suspenso no período; evidência arquivada"}]'::jsonb,
   'Trinta dias é punição; trinta e um é rescisão que a empresa não queria.',
   'Requisitos YE-DP-AFAST-001: base legal art. 474 / cenário "Suspensão disciplinar" (seção 9). O tipo suspensao_disciplinar existe no enum; o teto, não.'),

  -- ══════════ F) eSOCIAL ══════════

  (v_mod, 'AFAST-060', 'S-2230 no prazo do motivo: dia 15, 16º dia na doença longa, 1º dia na recaída',
   'excecao', 'alta', 'aprovado', 'api',
   'eSocial — S-2230, prazos por motivo/duração (regra geral: dia 15 do mês seguinte; doença > 15 dias: até o 16º dia; recaída: 1º dia; término: dia 15 seguinte)',
   'O S-2230 não tem UM prazo — tem uma tabela deles: regra geral até o dia 15 do mês seguinte; doença que passa de 15 dias, até o 16º dia do afastamento; recaída, no 1º dia; término, até o dia 15 após o retorno. O motor de prazos precisa escolher o prazo pelo MOTIVO e pela DURAÇÃO, projetar a data-limite e vigiar — a inteligência já cria a tarefa de S-2230 na doença longa; falta o relógio completo.',
   'Afastamentos de motivos/durações distintos registrados no ambiente de teste.',
   '[{"ordem":1,"acao":"Registrar doença de 20 dias","resultado_esperado":"Prazo do S-2230 projetado para o 16º dia do afastamento"},
     {"ordem":2,"acao":"Registrar afastamento curto de outro motivo","resultado_esperado":"Prazo projetado para o dia 15 do mês seguinte"},
     {"ordem":3,"acao":"Registrar recaída","resultado_esperado":"Prazo no 1º dia — alerta imediato"},
     {"ordem":4,"acao":"Encerrar um afastamento","resultado_esperado":"Prazo do evento de término projetado (dia 15 seguinte)"}]'::jsonb,
   'O prazo certo depende do motivo — e o sistema escolhe sozinho.',
   'Requisitos YE-DP-AFAST-001: RN-008 / CA-007 / RNF-003. PARCIAL: a tarefa de S-2230 nasce na doença longa (inteligência); a tabela completa de prazos e a geração do evento, não. Prazos vigentes são [VAL] (seção 30). Anti-duplicidade/rejeição é a série ADM-093..DESL-094.'),

  -- ══════════ G) RETORNO ══════════

  (v_mod, 'AFAST-070', 'Retorno de afastamento longo exige ASO antes de reativar as obrigações',
   'feliz', 'alta', 'aprovado', 'api',
   'NR-7 (exame de retorno ao trabalho antes da retomada, após afastamento ≥ 30 dias por doença/acidente/parto)',
   'Voltou de afastamento longo, o primeiro compromisso é o ASO de retorno — ANTES de retomar a função. O encerramento do afastamento deve exigir o exame (a pendência já existe: aso_retorno_pendente), e enquanto ele não vem, o retorno não se completa: reativar ponto e obrigações com ASO pendente é colocar para trabalhar alguém que a NR-7 mandou examinar primeiro.',
   'Afastamento de 45 dias por doença sendo encerrado no ambiente de teste.',
   '[{"ordem":1,"acao":"Encerrar o afastamento longo","resultado_esperado":"aso_retorno_pendente marcado; retorno condicionado ao exame"},
     {"ordem":2,"acao":"Tentar completar o retorno sem ASO","resultado_esperado":"Pendência mantida com alerta a SST/DP — não conclui em silêncio"},
     {"ordem":3,"acao":"Registrar o ASO de retorno apto","resultado_esperado":"Pendência baixada; ponto e obrigações reativados; término no eSocial"}]'::jsonb,
   'Afastamento longo só termina de verdade depois do médico.',
   'Requisitos YE-DP-AFAST-001: RN-007 / CA-008 / cenário "Normal" (seção 25). PONTO BOM: aso_retorno_pendente existe e a inteligência o marca — o caso confere se a pendência TRAVA o retorno ou só decora o registro. O lado exame demissional é DESL-060..067.'),

  -- ══════════ H) LGPD: SIGILO DO CID ══════════

  (v_mod, 'AFAST-080', 'CID restrito ao SST, com log próprio de acesso; gestor vê o afastamento, não o diagnóstico',
   'negativo', 'critica', 'aprovado', 'api',
   'LGPD (Lei 13.709/2018), arts. 11 (dado de saúde é sensível) e 46; matriz de perfis do documento (seção 6)',
   'O afastamento é público interno (a equipe precisa saber quem está fora e até quando); o DIAGNÓSTICO não é. O CID e o atestado ficam restritos ao SST/medicina, o gestor enxerga período e status sem o motivo clínico, e cada acesso ao CID gera log PRÓPRIO — a matriz do documento é explícita, e o "cofre do CID" (seção 29) é a evolução natural. A camada de perfil já protege atestados; o caso confere o conjunto: restrição + separação gestor/SST + log de acesso.',
   'Atestados com CID no tenant de teste; usuários de perfis distintos (gestor, SST, DP).',
   '[{"ordem":1,"acao":"Gestor consulta o afastamento de alguém da equipe","resultado_esperado":"Vê período, tipo e status — SEM o CID/diagnóstico"},
     {"ordem":2,"acao":"SST consulta o mesmo registro","resultado_esperado":"Vê o CID; o acesso entra em log específico (quem, quando, qual registro)"},
     {"ordem":3,"acao":"Perfil sem o módulo de saúde tenta ler atestados","resultado_esperado":"Bloqueado pela camada perfil_restringe_leitura_atestados"},
     {"ordem":4,"acao":"Exportar relatório de afastamentos","resultado_esperado":"CID protegido na exportação (seção 21)"}]'::jsonb,
   'Todo mundo sabe que afastou; só a medicina sabe do quê — e fica registrado quem olhou.',
   'Requisitos YE-DP-AFAST-001: CA-009 / RNF-002 / seção 22 / cenário "Permissões (CID)" (seção 25). PONTO BOM: perfil_restringe_leitura_atestados existe (uma das 20 tabelas protegidas). O que falta conferir: log específico de acesso ao CID e a separação gestor × SST dentro do mesmo tenant.')

  ON CONFLICT (codigo) DO NOTHING;

  -- ---------------------------------------------------------
  -- Referências cruzadas em casos de outras famílias
  -- (só acrescenta às observações, não reescreve)
  -- ---------------------------------------------------------
  UPDATE public.qa_casos_teste SET observacoes = observacoes ||
    ' Requisitos YE-DP-AFAST-001: o lado AFASTAMENTOS (registro, efeito e reflexo) está em AFAST-010..080.'
  WHERE codigo IN ('FERIAS-003','PONTO-025','DESL-071','DEC13-003','FOLHA-080')
    AND position('YE-DP-AFAST-001' IN observacoes) = 0;

  SELECT count(*) INTO v_depois FROM public.qa_casos_teste WHERE modulo_id = v_mod;
  RAISE NOTICE 'Afastamentos: % casos antes, % depois (esperado +14 na primeira execução).', v_antes, v_depois;
END $doc$;
