-- =========================================================
-- QA — Ponto: lacunas do plano de testes da Análise de Conformidade (11/08)
--
-- ORIGEM: documento "Análise de Conformidade — Ponto YourEyes" (v2),
-- Parte 6 (plano de testes CT-001..CT-108) cruzada caso a caso com a
-- família PONTO-001..341 já registrada.
--
-- RESULTADO DO CRUZAMENTO: a maioria dos CTs já tem caso equivalente —
-- apuração básica, tolerância, intervalo, noturno, DSR, 12x36,
-- imutabilidade, hash, fechamento, AFD/AEJ, isolamento, retenção.
-- Treze regras ficaram SEM nenhum caso registrado; são elas que este
-- arquivo documenta, cada uma com a referência CT/RQ do documento na
-- observação, para a matriz de rastreabilidade fechar.
--
-- COBERTOS POR CASO EXISTENTE (registrado aqui para auditoria, sem caso
-- novo): CT-001/003/005/006/008 (PONTO-020..025), CT-007 (PONTO-024),
-- CT-010..012/014 (PONTO-040..043), CT-020..026 (PONTO-060..064),
-- CT-030..039 (PONTO-090..113/130/131), CT-040..044 (PONTO-080/132/133),
-- CT-050..055 (PONTO-150..153), CT-061/064/067/068/069 (PONTO-170..175),
-- CT-070..072/074..077/079/080 (PONTO-004/190..195), CT-090/092/093/
-- 095/096/098 (PONTO-005/210..213/091), CT-100..102/104..107
-- (PONTO-006/250..253).
--
-- ESTA MIGRATION SÓ DOCUMENTA. Rotinas na próxima leva.
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

  -- ══════════ A) REGISTRO DA MARCAÇÃO ══════════

  (v_mod, 'PONTO-350', 'Toque duplo: duas marcações no mesmo minuto',
   'negativo', 'alta', 'aprovado', 'api',
   'Portaria MTE 671/2021 (tratamento de marcações; fidelidade do registro)',
   'Batida repetida no mesmo minuto (dedo que escorrega, clique duplo) não pode virar duas marcações — dobraria pares e quebraria a apuração. A segunda deve ser recusada ou absorvida, com mensagem clara, sem apagar a primeira.',
   'Colaborador ativo, escala 5x2.',
   '[{"ordem":1,"acao":"Registrar entrada às 08:00","resultado_esperado":"Gravada"},
     {"ordem":2,"acao":"Registrar de novo às 08:00 (mesmo minuto)","resultado_esperado":"Segunda recusada pela regra anti-toque-duplo, com mensagem clara; a primeira intacta"}]'::jsonb,
   'Um minuto, uma marcação.',
   'Documento de conformidade: CT-004 / RQ-010. Cuidado no desenho: a recusa aqui NÃO conflita com PONTO-002 (vedado restringir horário) — não se bloqueia o horário, apenas o eco da mesma batida.'),

  (v_mod, 'PONTO-351', 'Batida retroativa reordena os rótulos sem tocar nos horários',
   'alternativo', 'media', 'aprovado', 'api',
   'CLT, art. 74 (fidelidade); Portaria MTE 671/2021 (a marcação original é imutável)',
   'Um ajuste aprovado pode inserir batida ANTERIOR às existentes (a entrada esquecida). Os rótulos do dia (entrada, saída-almoço...) precisam se reordenar pela cronologia — e nenhum horário já gravado pode mudar.',
   'Dia com 3 marcações (12:00, 13:00, 17:00) e ajuste aprovado incluindo 08:00.',
   '[{"ordem":1,"acao":"Incluir a batida retroativa das 08:00 por ajuste","resultado_esperado":"Dia passa a ter 4 marcações pareadas na ordem certa"},
     {"ordem":2,"acao":"Conferir os horários pré-existentes","resultado_esperado":"Idênticos aos originais — só os rótulos se moveram"}]'::jsonb,
   'Cronologia manda nos rótulos; horários gravados são intocáveis.',
   'Documento de conformidade: CT-002 / RQ-060.'),

  -- ══════════ B) TOLERÂNCIA ══════════

  (v_mod, 'PONTO-352', 'Tolerância zero é configuração válida',
   'alternativo', 'baixa', 'aprovado', 'api',
   'CLT, art. 58, §1º (a tolerância é um teto, não um piso)',
   'O art. 58 §1º fixa o MÁXIMO tolerável — a empresa pode adotar menos, inclusive zero. Com zero, toda variação é computada. O cadastro não pode confundir "zero" com "vazio" e cair no padrão.',
   'Parâmetro de tolerância do cliente configurável.',
   '[{"ordem":1,"acao":"Gravar tolerância = 0 minutos","resultado_esperado":"Aceito — zero é escolha, não ausência"},
     {"ordem":2,"acao":"Apurar dia com entrada 08:03","resultado_esperado":"3 minutos computados — nada é abonado"}]'::jsonb,
   'Zero configurado significa zero aplicado.',
   'Documento de conformidade: CT-015 / RQ-011. Complementa PONTO-043 (teto legal): lá o limite superior, aqui o inferior.'),

  (v_mod, 'PONTO-353', 'Fronteira exata do teto diário de 10 minutos',
   'negativo', 'media', 'aprovado', 'api',
   'CLT, art. 58, §1º (10 minutos diários)',
   'Variações somando EXATAMENTE 10 minutos ficam dentro do teto: nada computado. Um minuto a mais (11) e o excedente à jornada é computado integralmente. PONTO-041 cobre a fronteira por marcação; esta é a fronteira do dia.',
   'Colaborador com tolerância legal padrão.',
   '[{"ordem":1,"acao":"Dia com variações somando exatamente 10 minutos","resultado_esperado":"Nada descontado nem computado"},
     {"ordem":2,"acao":"Dia com variações somando 11 minutos","resultado_esperado":"Excedente computado integralmente, como PONTO-042"}]'::jsonb,
   'Dez fica; onze computa.',
   'Documento de conformidade: CT-013 / RQ-011.'),

  -- ══════════ C) BANCO DE HORAS ══════════

  (v_mod, 'PONTO-354', 'Vencimento do saldo segue o instrumento do regime',
   'feliz', 'alta', 'aprovado', 'api',
   'CLT, art. 59, §5º (acordo individual: 6 meses) e §2º (instrumento coletivo: 12 meses)',
   'O prazo de compensação depende do instrumento: acordo individual escrito = 6 meses; norma coletiva = até 12. O sistema precisa calcular e EXIBIR a data de vencimento de cada crédito conforme o regime do colaborador — sem ela, PONTO-171 (saldo vencido vira extra) não tem gatilho confiável.',
   'Dois colaboradores com regimes distintos (individual 6m; coletivo 12m) e créditos no banco.',
   '[{"ordem":1,"acao":"Apurar crédito no regime individual","resultado_esperado":"Vencimento em 6 meses, visível no extrato"},
     {"ordem":2,"acao":"Apurar crédito no regime coletivo","resultado_esperado":"Vencimento conforme o prazo do instrumento"}]'::jsonb,
   'Cada crédito nasce com a própria data de vencimento, pelo regime certo.',
   'Documento de conformidade: CT-062/CT-063 / RQ-041.'),

  (v_mod, 'PONTO-355', 'Saldo perto de vencer gera alerta com ação',
   'alternativo', 'media', 'aprovado', 'api',
   'CLT, art. 59 (gestão do regime de compensação)',
   'A 30 dias do vencimento (parametrizável), o RH precisa ser alertado a tempo de conceder a folga — com a opção de transformar o alerta em ação no Plano de Ação, o mecanismo que a casa já usa para obrigações.',
   'Saldo de banco com vencimento a menos de 30 dias.',
   '[{"ordem":1,"acao":"Rodar a verificação de vencimentos","resultado_esperado":"Alerta gerado para o saldo próximo do prazo"},
     {"ordem":2,"acao":"Acionar a criação de ação a partir do alerta","resultado_esperado":"Ação criada no Plano de Ação vinculada ao alerta"}]'::jsonb,
   'O prazo avisa antes de virar passivo.',
   'Documento de conformidade: CT-065 / RQ-042.'),

  (v_mod, 'PONTO-356', 'Estouro do limite de acúmulo do banco',
   'negativo', 'media', 'aprovado', 'api',
   'CLT, art. 59 (limites do regime); parametrização do cliente',
   'O cliente pode parametrizar um teto de acúmulo (ex.: 40 horas). Saldo acima do teto precisa gerar alerta conforme a configuração — acúmulo ilimitado silencioso é passivo trabalhista crescendo sem ninguém ver.',
   'Limite de acúmulo parametrizado; saldo prestes a ultrapassá-lo.',
   '[{"ordem":1,"acao":"Apurar crédito que ultrapassa o limite","resultado_esperado":"Alerta gerado conforme a configuração"}]'::jsonb,
   'Teto configurado é teto vigiado.',
   'Documento de conformidade: CT-066 / RQ-043.'),

  -- ══════════ D) AJUSTES E FECHAMENTO ══════════

  (v_mod, 'PONTO-357', 'Rejeição de ajuste: motivo visível, dia intocado',
   'alternativo', 'media', 'aprovado', 'api',
   'Portaria MTE 671/2021 (tratamento com trilha)',
   'PONTO-190 cobre a aprovação; a rejeição é o outro braço do fluxo: status rejeitado, motivo visível ao solicitante e NADA alterado no dia — nem marcação de correção, nem reapuração.',
   'Solicitação de ajuste pendente.',
   '[{"ordem":1,"acao":"Rejeitar o ajuste com motivo","resultado_esperado":"Status rejeitado e motivo registrado"},
     {"ordem":2,"acao":"Conferir o dia","resultado_esperado":"Nenhuma marcação criada, apuração intacta"}]'::jsonb,
   'Rejeitar não deixa rastro no dia — só na trilha.',
   'Documento de conformidade: CT-073 / RQ-060.'),

  (v_mod, 'PONTO-358', 'Reabertura formal de competência fechada',
   'excecao', 'alta', 'aprovado', 'api',
   'Portaria MTE 671/2021 (integridade do espelho); contraparte de PONTO-193',
   'PONTO-193 garante que fechado não se altera. Mas erro legítimo descoberto depois precisa de saída FORMAL: reabertura com motivo e alçada, registrada na trilha — e, ao fechar de novo, o espelho ganha NOVA VERSÃO (o documento que o colaborador cientificou não pode ser regravado por cima).',
   'Competência fechada com espelho emitido.',
   '[{"ordem":1,"acao":"Reabrir a competência com motivo e alçada adequada","resultado_esperado":"Reabertura aceita e registrada na trilha"},
     {"ordem":2,"acao":"Corrigir e fechar de novo","resultado_esperado":"Nova versão do espelho; a anterior preservada"},
     {"ordem":3,"acao":"Tentar reabrir sem alçada","resultado_esperado":"Recusado"}]'::jsonb,
   'Fechado só reabre com rito — e nunca sobrescreve a história.',
   'Documento de conformidade: CT-078 / RQ-065.'),

  -- ══════════ E) ARTEFATOS E INTEGRAÇÃO ══════════

  (v_mod, 'PONTO-359', 'Extração dos comprovantes das últimas 48 horas',
   'feliz', 'media', 'aprovado', 'api',
   'Portaria MTE 671/2021 (comprovante do trabalhador; disponibilidade)',
   'Além do comprovante a cada batida (PONTO-005), o trabalhador pode extrair TODOS os comprovantes de um período — o documento fixa a janela de 48 horas como exercício mínimo desse direito.',
   'Colaborador com marcações nas últimas 48 horas.',
   '[{"ordem":1,"acao":"Solicitar os comprovantes das últimas 48 horas","resultado_esperado":"Todos os comprovantes do período extraídos, com os campos exigidos"}]'::jsonb,
   'O período pedido volta completo.',
   'Documento de conformidade: CT-091 / RQ-080.'),

  (v_mod, 'PONTO-360', 'Certificado de assinatura perto de vencer gera alerta',
   'alternativo', 'media', 'aprovado', 'api',
   'Portaria MTE 671/2021 (assinatura dos arquivos AFD/AEJ)',
   'AFD e AEJ são assinados com certificado digital. Certificado vencido para a emissão dos artefatos na hora da fiscalização — o responsável precisa ser alertado com a antecedência parametrizada.',
   'Certificado cadastrado com vencimento dentro da janela de antecedência.',
   '[{"ordem":1,"acao":"Rodar a verificação de certificados","resultado_esperado":"Alerta gerado ao responsável antes do vencimento"}]'::jsonb,
   'A assinatura nunca vence de surpresa.',
   'Documento de conformidade: CT-094 / RQ-084.'),

  (v_mod, 'PONTO-361', 'Exportação para a folha com grandezas e naturezas corretas',
   'feliz', 'critica', 'aprovado', 'api',
   'CLT, arts. 58-73 (as grandezas); fronteira com o eSocial',
   'A exportação da competência fechada é onde o ponto vira dinheiro: horas normais, extras por faixa, adicional noturno, faltas e DSR precisam sair com VALORES REAIS e a natureza correta (vencimento/desconto/indenizatória) — e o arquivo gerado fica arquivado. Zero afirmativo aqui é o mesmo problema do espelho (PONTO-331), com efeito direto na folha.',
   'Competência fechada e apurada, com eventos de cada natureza.',
   '[{"ordem":1,"acao":"Exportar a competência para a folha","resultado_esperado":"Todas as grandezas com valores reais e natureza correta"},
     {"ordem":2,"acao":"Conferir o arquivamento","resultado_esperado":"Arquivo gerado fica retido com data e autor"}]'::jsonb,
   'O que a folha recebe é o que a apuração provou.',
   'Documento de conformidade: CT-097 / RQ-090. Depende das decisões D-01/D-02 do documento (papel do módulo x folha) — o caso vigia a fronteira, qualquer que seja a decisão.'),

  -- ══════════ F) SEGURANÇA ══════════

  (v_mod, 'PONTO-362', 'Enumeração de CPFs num link compartilhado é bloqueada',
   'negativo', 'critica', 'aprovado', 'api',
   'LGPD, arts. 46-49 (segurança); o CPF é o identificador da marcação',
   'O link compartilhado de marcação identifica o trabalhador por CPF. Tentativas em sequência com CPFs diferentes no mesmo link são o padrão de ENUMERAÇÃO — descobrir CPFs válidos da empresa e marcar por terceiros. Precisa de bloqueio temporário e registro do evento.',
   'Link de marcação compartilhado ativo.',
   '[{"ordem":1,"acao":"Tentar vários CPFs em sequência no mesmo link","resultado_esperado":"Bloqueio temporário após o limiar, com o evento registrado"},
     {"ordem":2,"acao":"Aguardar e usar o CPF correto","resultado_esperado":"Fluxo normal — o bloqueio é temporário, não pune o legítimo"}]'::jsonb,
   'O link não serve de oráculo de CPFs.',
   'Documento de conformidade: CT-103 / RQ-101. Complementa PONTO-251 (expiração) e o caso de revogação.'),

  (v_mod, 'PONTO-363', 'Aviso de tratamento de dados na tela de marcação',
   'feliz', 'media', 'aprovado', 'e2e',
   'LGPD, arts. 9º e 18 (transparência ao titular)',
   'Quem bate ponto entrega CPF, horário e — quando configurado — selfie e localização. A tela de marcação precisa exibir aviso de tratamento visível e acessível, dizendo o que é coletado e por quê. Caso de TELA: vive no React.',
   'Tela de marcação acessível (app ou link).',
   '[{"ordem":1,"acao":"Abrir a tela de marcação","resultado_esperado":"Aviso de tratamento visível e acessível antes de bater"}]'::jsonb,
   'O titular sabe o que entrega antes de entregar.',
   'Documento de conformidade: CT-108 / RQ-103. Nível e2e — cobertura no Cypress, não no motor SQL.')

  ON CONFLICT (codigo) DO NOTHING;

  SELECT count(*) INTO v_depois FROM public.qa_casos_teste WHERE modulo_id = v_mod;
  RAISE NOTICE 'Análise de conformidade: módulo Ponto tinha % casos, agora tem % (+%).',
    v_antes, v_depois, v_depois - v_antes;
END $doc$;
