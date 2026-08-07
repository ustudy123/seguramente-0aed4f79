-- =========================================================
-- QA — Ponto, Jornada e Banco de Horas (31/07/2026)
--
-- FONTE: "Análise de Conformidade e Plano de Adequação — Módulo de Ponto,
-- Jornada e Banco de Horas", versão 1.0, julho/2026. A Parte 2 daquele
-- documento traz a base legal classificada dispositivo por dispositivo e é
-- a fundamentação de tudo aqui.
--
-- PRINCÍPIO, conforme instrução do dono do produto:
--   O caso documenta COMO O SISTEMA DEVE SER para atender a legislação,
--   nunca como ele está. Onde o sistema divergir, o caso FALHA — e a falha
--   é o encaminhamento para o desenvolvimento. A auditoria as-built indica
--   que a maior parte do motor de apuração não existe: horas extras,
--   adicional noturno, hora ficta, intervalo, DSR e feriado não são
--   calculados em nenhum ponto do fluxo. Portanto ESPERA-SE FALHA EM MASSA
--   na primeira execução. Isso é o retrato correto, não defeito do teste.
--
-- CLASSIFICAÇÃO HERDADA DO DOCUMENTO, preservada em cada caso:
--   OBRIGAÇÃO LEGAL          — norma vigente, não negociável
--   CONDICIONADA A CCT/ACT   — norma coletiva pode alterar; exige parâmetro
--   CONDICIONADA AO ENQUADRAMENTO — depende de regime, porte ou atividade
--   JURISPRUDÊNCIA CONSOLIDADA — súmula ou OJ do TST
--
-- AVISO DE VIGÊNCIA, repetido aqui de propósito: os leiautes da Portaria
-- MTE 671/2021 e os padrões de assinatura mudam. Nenhum caso deste bloco
-- deve virar rotina sem revalidar a norma na data da implementação. Os
-- casos de leiaute (AFD, AEJ) citam a norma, nunca o conteúdo do leiaute.
--
-- NÍVEL: 'api' onde a regra é (ou deve ser) garantida pelo banco; 'e2e'
-- onde depende de tela ou de aparelho. O motor de apuração, por decisão
-- do próprio documento (RQ-010: "camada única em banco de dados"), é 'api'.
-- =========================================================

SET lock_timeout = '10s';
ALTER TABLE public.qa_casos_teste ADD COLUMN IF NOT EXISTS base_legal text;

INSERT INTO public.qa_modulos (parent_id, label, path, prioridade_doc, status_doc)
SELECT m.id, 'Ponto e Jornada', 'jornada-rotina/ponto', 1, 'em_andamento'
FROM public.qa_modulos m WHERE m.path = 'jornada-rotina'
ON CONFLICT (path) DO NOTHING;

DO $doc$
DECLARE v_mod uuid; v_antes int; v_depois int;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos WHERE path = 'jornada-rotina/ponto';
  IF v_mod IS NULL THEN RAISE EXCEPTION 'Modulo jornada-rotina/ponto nao criado.'; END IF;
  SELECT count(*) INTO v_antes FROM public.qa_casos_teste WHERE modulo_id = v_mod;

  INSERT INTO public.qa_casos_teste
    (modulo_id, codigo, titulo, tipo, prioridade, status, nivel,
     base_legal, objetivo, pre_condicoes, passos, resultado_esperado, observacoes)
  VALUES

  -- ═══════════════════════════════════════════════════════
  -- A) REGISTRO DA MARCAÇÃO — vedações da Portaria 671
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'PONTO-001', 'Marcação é registrada com data, hora e identificação por CPF',
   'feliz', 'critica', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — CLT, art. 74, §2º; Portaria MTE 671/2021 (identificação '
   'do trabalhador por CPF, e não mais por PIS, em AFD, AEJ, comprovante e espelho)',
   'Caminho base do módulo. A identificação por CPF é exigência expressa da '
   'Portaria 671 e atravessa todos os artefatos regulamentares.',
   'Colaborador ativo, escala 5x2, jornada de 8h.',
   '[{"ordem":1,"acao":"Registrar marcação de entrada","resultado_esperado":"Gravada com data, hora, CPF do trabalhador e identificação do estabelecimento"},
     {"ordem":2,"acao":"Conferir o fuso aplicado","resultado_esperado":"Horário local do estabelecimento, sem deslocamento por UTC"},
     {"ordem":3,"acao":"Conferir se o CPF está no registro","resultado_esperado":"Presente — é a chave exigida pela Portaria 671"}]'::jsonb,
   'A marcação nasce completa e identificada conforme a norma.',
   'Caso base. Se falhar, os demais do bloco não têm significado.'),

  (v_mod, 'PONTO-002', 'Sistema não restringe horário de marcação',
   'negativo', 'critica', 'aprovado', 'e2e',
   'OBRIGAÇÃO LEGAL — Portaria MTE 671/2021: é vedado restringir horários de marcação',
   'A vedação é expressa. Impedir a batida fora do horário previsto apaga a prova '
   'de que o trabalho ocorreu — exatamente o oposto da finalidade do registro.',
   'Colaborador com jornada 08:00–17:00.',
   '[{"ordem":1,"acao":"Marcar às 05:30, muito antes da entrada prevista","resultado_esperado":"ACEITO e registrado"},
     {"ordem":2,"acao":"Marcar às 23:50, muito depois da saída prevista","resultado_esperado":"ACEITO e registrado"},
     {"ordem":3,"acao":"Marcar em domingo, fora da escala","resultado_esperado":"ACEITO e registrado; o tratamento é na apuração, nunca no bloqueio"},
     {"ordem":4,"acao":"Conferir se algum parâmetro do sistema permite bloquear","resultado_esperado":"Nenhuma configuração pode impedir a marcação"}]'::jsonb,
   'Nenhum horário é recusado. Divergências viram alerta na apuração, não bloqueio.',
   'A auditoria as-built registra um toggle "permitir registro fora de horário" que é gravado e não aplicado. O passo 4 exige mais que isso: a configuração NÃO PODE existir como bloqueio, porque a norma veda. Parâmetro que permite descumprir a lei é defeito, mesmo desligado.'),

  (v_mod, 'PONTO-003', 'Sistema não marca ponto automaticamente',
   'negativo', 'critica', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — Portaria MTE 671/2021: é vedado marcar ponto automaticamente',
   'Marcação automática é ficção de jornada. A norma veda porque destrói o valor '
   'probatório de todo o conjunto.',
   'Colaborador com escala cadastrada.',
   '[{"ordem":1,"acao":"Passar o dia sem nenhuma batida","resultado_esperado":"Nenhuma marcação é criada pelo sistema"},
     {"ordem":2,"acao":"Conferir se a escala preenche marcação prevista","resultado_esperado":"A escala define jornada ESPERADA, nunca marcação realizada"},
     {"ordem":3,"acao":"Conferir rotinas automáticas e jobs","resultado_esperado":"Nenhuma cria registro em ponto_marcacoes"}]'::jsonb,
   'Marcação só existe por ato do trabalhador ou por ajuste formal aprovado.',
   'A pré-assinalação de intervalo é exceção prevista e distinta: ela declara intervalo previsto, não cria batida. Ver PONTO-072.'),

  (v_mod, 'PONTO-004', 'Marcação original não pode ser alterada nem apagada',
   'negativo', 'critica', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — Portaria MTE 671/2021: é vedado alterar ou apagar marcações '
   'registradas; CLT, art. 74; TST, Súmula 338 (ônus da prova do empregador)',
   'É o coração da inalterabilidade. Registro que pode ser editado não prova nada, '
   'e a Súmula 338 joga o ônus sobre quem não consegue provar.',
   'Marcação já gravada.',
   '[{"ordem":1,"acao":"Tentar alterar o horário pela edição em linha do espelho","resultado_esperado":"Nenhum caminho da aplicação permite"},
     {"ordem":2,"acao":"Tentar alterar direto pela API","resultado_esperado":"Recusado pelo banco"},
     {"ordem":3,"acao":"Tentar apagar a marcação","resultado_esperado":"Recusado"},
     {"ordem":4,"acao":"Corrigir pelo fluxo de ajuste aprovado","resultado_esperado":"Cria batida de CORREÇÃO; a original permanece visível e íntegra"}]'::jsonb,
   'A marcação original é imutável. Correção é acréscimo, nunca substituição.',
   'A auditoria as-built (GAP-010, 019, 023, 035) indica que a edição em linha do espelho permite alterar a marcação original. Deve falhar nos passos 1 e 2. É o requisito que o próprio documento chama de mais importante da seção.'),

  (v_mod, 'PONTO-005', 'Comprovante de marcação fica disponível após cada batida',
   'feliz', 'critica', 'aprovado', 'e2e',
   'OBRIGAÇÃO LEGAL — Portaria MTE 671/2021 (Comprovante de Registro de Ponto do '
   'Trabalhador); MTE, Perguntas e Respostas oficiais: a emissão no momento é '
   'dispensada se o sistema disponibilizar acesso eletrônico após cada marcação, '
   'independentemente de solicitação prévia, e permitir extrair as últimas 48 horas',
   'É direito do trabalhador ter prova da própria batida, sem depender de pedir.',
   'Colaborador que acabou de marcar.',
   '[{"ordem":1,"acao":"Conferir o comprovante logo após a marcação","resultado_esperado":"Disponível sem solicitação prévia"},
     {"ordem":2,"acao":"Conferir os campos","resultado_esperado":"Os dados padronizados exigidos pela norma vigente"},
     {"ordem":3,"acao":"Extrair os comprovantes das últimas 48 horas","resultado_esperado":"Todos os do período, no mínimo"},
     {"ordem":4,"acao":"Conferir a assinatura eletrônica","resultado_esperado":"Padrão PAdES com certificado ICP-Brasil (Portaria MTP 1.486/2022)"}]'::jsonb,
   'O trabalhador tem acesso autônomo e assinado ao comprovante de cada batida.',
   'GAP conhecido: não há comprovante nem assinatura ICP-Brasil. O passo 3 tem piso normativo de 48 horas — guardar mais é permitido, menos não.'),

  (v_mod, 'PONTO-006', 'Cerca virtual registra e sinaliza, nunca bloqueia',
   'alternativo', 'alta', 'aprovado', 'e2e',
   'OBRIGAÇÃO LEGAL — Portaria MTE 671/2021 (vedação de restringir horários e '
   'condições de marcação); LGPD, art. 6º (necessidade)',
   'Geolocalização é evidência, não autorização. Recusar batida por distância é '
   'restringir a marcação, o que a norma veda.',
   'Colaborador com unidade que tem cerca virtual configurada.',
   '[{"ordem":1,"acao":"Marcar a 2 km da unidade","resultado_esperado":"ACEITA; distância registrada; alerta gerado; justificativa solicitada"},
     {"ordem":2,"acao":"Marcar com GPS indisponível no aparelho","resultado_esperado":"ACEITA; condição registrada; alerta gerado"},
     {"ordem":3,"acao":"Conferir se existe configuração que bloqueie por distância","resultado_esperado":"Nenhuma pode bloquear"}]'::jsonb,
   'A localização qualifica a marcação; jamais a impede.',
   'Mesmo raciocínio do PONTO-002: a existência do parâmetro de bloqueio já é o defeito.'),

  -- ═══════════════════════════════════════════════════════
  -- B) APURAÇÃO DIÁRIA
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'PONTO-020', 'Dia completo apura jornada, saldo zero e status regular',
   'feliz', 'critica', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — CLT, art. 58, caput (duração normal de até 8 horas diárias)',
   'Caminho feliz da apuração. Base de comparação para todos os demais.',
   'Escala 5x2, 8h, intervalo de 1h, entrada 08:00, saída 17:00.',
   '[{"ordem":1,"acao":"Marcações 08:00, 12:00, 13:00, 17:00","resultado_esperado":"8h trabalhadas"},
     {"ordem":2,"acao":"Conferir saldo","resultado_esperado":"Zero"},
     {"ordem":3,"acao":"Conferir status e alertas","resultado_esperado":"Regular, sem alerta"},
     {"ordem":4,"acao":"Conferir a memória de cálculo","resultado_esperado":"Persistida, com a versão dos parâmetros usada"}]'::jsonb,
   'Dia regular apurado, com memória rastreável.',
   'O passo 4 é exigência do RQ-021: sem memória versionada não há como reapurar competência antiga com os parâmetros da época.'),

  (v_mod, 'PONTO-021', 'Número ímpar de marcações não inventa par',
   'excecao', 'critica', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — Portaria MTE 671/2021 (vedação de marcar ponto '
   'automaticamente); CLT, art. 74',
   'Fechar o par que falta seria criar marcação. A norma veda, e o dia deve ficar '
   'visivelmente incompleto para ser corrigido pelo fluxo formal.',
   'Escala 5x2.',
   '[{"ordem":1,"acao":"Marcações 08:00, 12:00, 13:00 — sem a saída","resultado_esperado":"Dia INCOMPLETO"},
     {"ordem":2,"acao":"Conferir horas apuradas","resultado_esperado":"Apenas o período pareado (4h), sem completar o aberto"},
     {"ordem":3,"acao":"Conferir alerta","resultado_esperado":"Gerado, com o dia sinalizado para correção"},
     {"ordem":4,"acao":"Conferir se o sistema fechou o par sozinho","resultado_esperado":"NÃO — nenhuma marcação criada automaticamente"}]'::jsonb,
   'Dia incompleto permanece incompleto e visível.',
   'O passo 4 é o negativo essencial: um motor mal escrito "ajuda" fechando com o horário da escala, e isso é marcação automática vedada.'),

  (v_mod, 'PONTO-022', 'Turno que cruza a meia-noite pertence ao dia de início',
   'alternativo', 'critica', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — CLT, art. 73, §5º e Súmula 60, II do TST (prorrogação da '
   'jornada noturna, que pressupõe jornada única e contínua)',
   'Partir a jornada em dois dias gera falta fictícia no segundo e subdimensiona a '
   'prorrogação noturna.',
   'Escala noturna.',
   '[{"ordem":1,"acao":"Entrada 22:00 do dia 10, saída 06:00 do dia 11","resultado_esperado":"8h atribuídas integralmente ao dia 10"},
     {"ordem":2,"acao":"Conferir o dia 11","resultado_esperado":"Sem saldo negativo e sem falta por causa dessa jornada"},
     {"ordem":3,"acao":"Conferir o adicional noturno","resultado_esperado":"Calculado sobre a jornada inteira, sem corte na virada do dia"}]'::jsonb,
   'A jornada é uma só e pertence ao dia em que começou.',
   'O passo 2 é onde o erro aparece na prática: o colaborador leva falta num dia em que trabalhou a noite inteira.'),

  (v_mod, 'PONTO-023', 'Dia sem marcação em dia útil é falta, não dia neutro',
   'negativo', 'alta', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — Lei 605/1949, art. 6º (falta injustificada faz perder a '
   'remuneração do repouso semanal)',
   'A falta tem consequência sobre o DSR. Tratar ausência como neutro esconde o '
   'efeito legal.',
   'Escala 5x2, dia útil sem justificativa.',
   '[{"ordem":1,"acao":"Nenhuma marcação em dia útil","resultado_esperado":"Falta registrada"},
     {"ordem":2,"acao":"Conferir o saldo","resultado_esperado":"Negativo, igual à jornada esperada do dia"},
     {"ordem":3,"acao":"Conferir o efeito no DSR da semana","resultado_esperado":"Perda do repouso semanal, conforme art. 6º da Lei 605/1949"}]'::jsonb,
   'A falta é apurada e repercute no DSR.',
   'O passo 3 é o que quase nenhum sistema faz e é obrigação legal expressa.'),

  (v_mod, 'PONTO-024', 'Ausência amparada não vira falta',
   'alternativo', 'alta', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — CLT, art. 473 (faltas justificadas); Lei 605/1949, art. 6º, '
   '§1º (motivos que não retiram o repouso); CLT, art. 476 (suspensão por '
   'benefício previdenciário)',
   'Férias, atestado, afastamento e as hipóteses do art. 473 têm regime próprio.',
   'Colaborador com cada situação, uma por vez.',
   '[{"ordem":1,"acao":"Colaborador em férias","resultado_esperado":"Dia justificado, saldo zero, sem falta e sem alerta"},
     {"ordem":2,"acao":"Colaborador com atestado aceito","resultado_esperado":"Dia justificado, sem perda de DSR"},
     {"ordem":3,"acao":"Colaborador afastado pelo INSS","resultado_esperado":"Contrato suspenso; dia não gera falta nem saldo"},
     {"ordem":4,"acao":"Falta amparada pelo art. 473 (ex.: falecimento de cônjuge)","resultado_esperado":"Justificada, sem perda de DSR"}]'::jsonb,
   'Cada amparo legal produz o efeito próprio, distinto da falta injustificada.',
   'O passo 4 costuma faltar: o art. 473 lista hipóteses específicas com número de dias próprio, e o sistema precisa distingui-las de "abono genérico".'),

  (v_mod, 'PONTO-025', 'Colaborador afastado não consegue marcar',
   'negativo', 'alta', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — CLT, art. 476 (suspensão do contrato durante benefício '
   'previdenciário)',
   'Durante a suspensão não há prestação de serviço a registrar.',
   'Colaborador com afastamento ativo.',
   '[{"ordem":1,"acao":"Tentar marcar durante o afastamento","resultado_esperado":"Recusado com mensagem explicativa; nada gravado"},
     {"ordem":2,"acao":"Conferir se ficou registro parcial","resultado_esperado":"Nenhum"},
     {"ordem":3,"acao":"Marcar após o retorno formal","resultado_esperado":"Aceito normalmente"}]'::jsonb,
   'A suspensão impede o registro, e o retorno o restabelece.',
   'Note a tensão deliberada com o PONTO-002: aqui a recusa NÃO é restrição de horário, é ausência de contrato em curso. A distinção precisa estar clara na mensagem ao trabalhador.'),

  -- ═══════════════════════════════════════════════════════
  -- C) TOLERÂNCIA — art. 58, §1º e Súmulas 366 e 449
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'PONTO-040', 'Variação de até 5 minutos por marcação não é computada',
   'feliz', 'critica', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — CLT, art. 58, §1º: variações de até 5 minutos por marcação, '
   'limitadas a 10 minutos diários, não são descontadas nem computadas como '
   'jornada extraordinária',
   'A tolerância é bilateral: não desconta e não paga.',
   'Escala 08:00–17:00.',
   '[{"ordem":1,"acao":"Marcações 08:03, 12:00, 13:00, 17:00","resultado_esperado":"Sem desconto e sem hora extra; considera-se 08:00"},
     {"ordem":2,"acao":"Marcações 07:57, 12:00, 13:00, 17:00","resultado_esperado":"Igualmente neutro — a tolerância vale para os dois lados"}]'::jsonb,
   'Variação dentro do limite é neutra em ambos os sentidos.',
   'O passo 2 é o lado esquecido: sistemas costumam tolerar o atraso e computar a antecipação como extra, o que contraria o §1º.'),

  (v_mod, 'PONTO-041', 'Fronteira exata dos 5 minutos por marcação',
   'excecao', 'critica', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — CLT, art. 58, §1º; JURISPRUDÊNCIA CONSOLIDADA — TST, '
   'Súmula 366: ultrapassado o limite, computa-se a TOTALIDADE do tempo que '
   'exceder a jornada, não apenas o excedente à tolerância',
   'É a borda mais cara do módulo: errar aqui muda a base de cálculo de toda a '
   'hora extra da empresa.',
   'Escala 08:00–17:00.',
   '[{"ordem":1,"acao":"Entrada às 08:05, exatamente no limite","resultado_esperado":"Dentro da tolerância — nada computado"},
     {"ordem":2,"acao":"Entrada às 08:06, um minuto além","resultado_esperado":"Estourou: computam-se os 6 minutos INTEGRALMENTE, não apenas 1"},
     {"ordem":3,"acao":"Saída às 17:05","resultado_esperado":"Dentro da tolerância"},
     {"ordem":4,"acao":"Saída às 17:07","resultado_esperado":"Computam-se os 7 minutos integralmente (Súmula 366)"}]'::jsonb,
   'No limite exato é neutro; um minuto além computa tudo.',
   'A Súmula 366 é contraintuitiva e é onde a maioria dos motores erra: computa-se o excedente à JORNADA, não o excedente à TOLERÂNCIA. Sete minutos viram sete, nunca dois.'),

  (v_mod, 'PONTO-042', 'Teto diário de 10 minutos, independente do limite por marcação',
   'excecao', 'critica', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — CLT, art. 58, §1º: limitadas a 10 minutos diários; '
   'TST, Súmula 366',
   'São dois tetos cumulativos. Respeitar só o de 5 minutos por marcação deixa '
   'passar 20 minutos diários em quatro batidas.',
   'Escala 08:00–17:00 com quatro marcações.',
   '[{"ordem":1,"acao":"Variações de 4 minutos em cada uma das 4 marcações, somando 16","resultado_esperado":"Cada uma está dentro dos 5, MAS o teto diário de 10 estourou: computa-se integralmente o excedente à jornada"},
     {"ordem":2,"acao":"Variações somando exatamente 10 minutos","resultado_esperado":"Dentro do teto — nada computado"},
     {"ordem":3,"acao":"Variações somando 11 minutos","resultado_esperado":"Estourou; computa-se tudo"}]'::jsonb,
   'Os dois tetos valem ao mesmo tempo; estourar qualquer um computa a totalidade.',
   'O passo 1 é o caso clássico e o mais provável de estar errado.'),

  (v_mod, 'PONTO-043', 'Cadastro de tolerância acima do limite legal é recusado',
   'negativo', 'critica', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — CLT, art. 58, §1º; JURISPRUDÊNCIA CONSOLIDADA — TST, '
   'Súmula 449: é inválida cláusula de norma coletiva que amplie o limite de '
   'tolerância previsto em lei',
   'A Súmula 449 fecha a porta inclusive para a negociação coletiva. O sistema '
   'não pode oferecer o parâmetro fora da faixa.',
   'Tela de parâmetros de jornada.',
   '[{"ordem":1,"acao":"Gravar tolerância de 12 minutos por marcação","resultado_esperado":"RECUSADO, com mensagem citando o limite legal"},
     {"ordem":2,"acao":"Gravar 15 minutos alegando previsão em CCT","resultado_esperado":"RECUSADO — a Súmula 449 invalida a ampliação por norma coletiva"},
     {"ordem":3,"acao":"Gravar tolerância zero","resultado_esperado":"ACEITO — reduzir é permitido; toda variação passa a ser computada"},
     {"ordem":4,"acao":"Gravar valor negativo","resultado_esperado":"RECUSADO"}]'::jsonb,
   'A faixa aceita é de 0 a 5 minutos por marcação e 0 a 10 diários.',
   'O passo 2 é o mais importante e o menos óbvio: é comum o sistema liberar o campo "porque a CCT permite". A Súmula 449 diz que não permite.'),

  -- ═══════════════════════════════════════════════════════
  -- D) INTERVALO INTRAJORNADA — art. 71
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'PONTO-060', 'Supressão parcial do intervalo paga apenas o período suprimido',
   'excecao', 'critica', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — CLT, art. 71, §4º (redação da Lei 13.467/2017): a não '
   'concessão total ou parcial gera pagamento de natureza INDENIZATÓRIA apenas '
   'do período suprimido, com acréscimo de 50% sobre a hora normal',
   'A regra mudou em 2017 e muitos sistemas ainda calculam pela anterior, que '
   'pagava a hora inteira com natureza salarial e reflexos.',
   'Jornada de 8h, intervalo mínimo de 1h.',
   '[{"ordem":1,"acao":"Marcações 08:00, 12:00, 12:40, 17:00 — intervalo de 40 minutos","resultado_esperado":"20 minutos suprimidos, com acréscimo de 50%"},
     {"ordem":2,"acao":"Conferir a natureza da verba","resultado_esperado":"INDENIZATÓRIA, sem reflexos em DSR, férias, 13º ou FGTS"},
     {"ordem":3,"acao":"Conferir se foi lançado como hora extra","resultado_esperado":"NÃO — é grandeza própria, com rubrica própria"},
     {"ordem":4,"acao":"Conferir a saída para a folha","resultado_esperado":"Rubrica indenizatória; a folha não pode consumir como salarial"}]'::jsonb,
   'Paga-se o suprimido, com 50%, como verba indenizatória.',
   'Os passos 2 e 3 são o achado: a saída do cálculo não é "1 hora extra", é "X minutos suprimidos". Lançar como hora extra gera reflexos indevidos e distorce a base do eSocial.'),

  (v_mod, 'PONTO-061', 'Intervalo integralmente suprimido',
   'excecao', 'critica', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — CLT, art. 71, caput e §4º',
   'Nenhuma pausa em jornada superior a 6 horas.',
   'Jornada de 8h sem pré-assinalação.',
   '[{"ordem":1,"acao":"Apenas 08:00 e 17:00","resultado_esperado":"60 minutos suprimidos"},
     {"ordem":2,"acao":"Conferir alerta","resultado_esperado":"Gerado no dia, para permitir correção antes do fechamento"},
     {"ordem":3,"acao":"Conferir se o sistema deduziu intervalo que não houve","resultado_esperado":"NÃO — sem pré-assinalação, não se presume pausa"}]'::jsonb,
   'A supressão total é apurada e alertada.',
   'O passo 3 é o negativo crítico: deduzir 1 hora "porque a escala prevê" é inventar pausa não ocorrida e subdimensionar a jornada.'),

  (v_mod, 'PONTO-062', 'Faixas de intervalo conforme a duração da jornada',
   'alternativo', 'alta', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — CLT, art. 71, caput (mais de 6 horas: mínimo de 1 hora, '
   'máximo de 2) e §1º (entre 4 e 6 horas: 15 minutos)',
   'O mínimo aplicável depende da faixa da jornada. Aplicar 1 hora a todas as '
   'jornadas gera supressão fictícia nas curtas.',
   'Colaboradores com jornadas de durações diferentes.',
   '[{"ordem":1,"acao":"Jornada de 4 horas, sem intervalo","resultado_esperado":"Nenhuma supressão — abaixo da faixa que exige pausa"},
     {"ordem":2,"acao":"Jornada de exatamente 6 horas, sem intervalo","resultado_esperado":"Mínimo de 15 minutos aplicável — 15 suprimidos"},
     {"ordem":3,"acao":"Jornada de 6h01, intervalo de 15 minutos","resultado_esperado":"Passou a exigir 1 hora — 45 minutos suprimidos"},
     {"ordem":4,"acao":"Jornada de 5 horas com intervalo de 10 minutos","resultado_esperado":"5 minutos suprimidos (mínimo de 15)"}]'::jsonb,
   'Cada faixa aplica o seu mínimo, com virada no ponto exato.',
   'O passo 3 é a fronteira: 6 horas exatas e 6h01 caem em regimes diferentes, com salto de 15 minutos para 1 hora.'),

  (v_mod, 'PONTO-063', 'Redução do intervalo por norma coletiva respeita o piso de 30 minutos',
   'alternativo', 'alta', 'aprovado', 'api',
   'CONDICIONADA A CCT/ACT — CLT, art. 611-A, III: norma coletiva pode reduzir o '
   'intervalo, respeitado o mínimo de 30 minutos para jornadas superiores a 6 horas',
   'A negociação coletiva pode reduzir, mas há piso absoluto.',
   'Empresa com CCT que reduz o intervalo.',
   '[{"ordem":1,"acao":"Parametrizar intervalo de 30 minutos por CCT e cumprir 30","resultado_esperado":"Nenhuma supressão; a memória indica a origem do parâmetro"},
     {"ordem":2,"acao":"Tentar parametrizar 20 minutos","resultado_esperado":"RECUSADO — abaixo do piso do art. 611-A, III"},
     {"ordem":3,"acao":"Conferir a memória de cálculo","resultado_esperado":"Indica que o mínimo veio de norma coletiva, com vigência"}]'::jsonb,
   'A redução é possível até 30 minutos e a origem fica registrada.',
   'O passo 3 importa para defesa: apurar com parâmetro reduzido sem registrar o instrumento que autorizou deixa o cálculo sem lastro.'),

  (v_mod, 'PONTO-064', 'Pré-assinalação deduz intervalo previsto e fica visível',
   'alternativo', 'media', 'aprovado', 'api',
   'CONDICIONADA AO ENQUADRAMENTO — CLT, art. 74, §2º e regulamentação do registro; '
   'a pré-assinalação do intervalo é prática admitida no controle de jornada',
   'Permite operar com duas marcações, desde que o intervalo previsto seja '
   'declarado e visível.',
   'Colaborador com pré-assinalação configurada.',
   '[{"ordem":1,"acao":"Marcações 08:00 e 17:00 com pré-assinalação de 1 hora","resultado_esperado":"Intervalo previsto deduzido; dia regular"},
     {"ordem":2,"acao":"Conferir o espelho","resultado_esperado":"Indica expressamente que o intervalo foi pré-assinalado, não marcado"},
     {"ordem":3,"acao":"Colaborador registra o intervalo real, menor que o previsto","resultado_esperado":"O real prevalece sobre o pré-assinalado; supressão apurada"}]'::jsonb,
   'A pré-assinalação é presunção que cede diante da marcação real.',
   'O passo 3 é essencial: pré-assinalação que ignora batida real vira ficção de pausa.'),

  -- ═══════════════════════════════════════════════════════
  -- E) INTERJORNADA — art. 66
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'PONTO-080', 'Descanso mínimo de 11 horas entre jornadas',
   'excecao', 'alta', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — CLT, art. 66: descanso mínimo de 11 horas consecutivas '
   'entre duas jornadas',
   'A supressão do descanso é violação autônoma, independente de haver hora extra.',
   'Duas jornadas consecutivas.',
   '[{"ordem":1,"acao":"Saída às 23:00 e entrada às 07:00 do dia seguinte","resultado_esperado":"3 horas de descanso suprimido registradas como grandeza própria; alerta gerado"},
     {"ordem":2,"acao":"Saída às 20:00 e entrada às 07:00 — exatamente 11 horas","resultado_esperado":"Nenhuma supressão"},
     {"ordem":3,"acao":"Saída às 20:00 e entrada às 06:59","resultado_esperado":"1 minuto suprimido — a fronteira é exata"},
     {"ordem":4,"acao":"Conferir a interjornada na virada de fim de semana","resultado_esperado":"Contada entre jornadas efetivas, não por dia de calendário"}]'::jsonb,
   'O descanso é medido entre jornadas reais, com fronteira exata em 11 horas.',
   'A auditoria indica que a detecção existe em outro módulo (Análise de Jornada), duplicada. O RQ-005 pede implementação única — duas implementações da mesma regra divergem com o tempo.'),

  -- ═══════════════════════════════════════════════════════
  -- F) HORAS EXTRAS — art. 59 e CF art. 7º, XVI
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'PONTO-090', 'Hora extra em dia útil com adicional mínimo de 50%',
   'feliz', 'critica', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — CF/1988, art. 7º, XVI (mínimo de 50% sobre a hora normal); '
   'CLT, art. 59, §1º',
   'É a apuração central do módulo e a que hoje não existe.',
   'Escala 8h, jornada 08:00–17:00.',
   '[{"ordem":1,"acao":"Marcações 08:00, 12:00, 13:00, 18:30","resultado_esperado":"90 minutos na faixa de 50%"},
     {"ordem":2,"acao":"Conferir o percentual aplicado","resultado_esperado":"50% é PISO; percentual maior de CCT prevalece se houver"},
     {"ordem":3,"acao":"Conferir a memória","resultado_esperado":"Mostra jornada esperada, realizada, excedente e o percentual com sua origem"}]'::jsonb,
   'A hora extra é apurada por faixa, com percentual parametrizável acima do piso.',
   'O passo 2 é a razão de o percentual nunca poder ser constante no código: 50% é mínimo constitucional, e CCTs frequentemente preveem 60%, 70% ou 100%.'),

  (v_mod, 'PONTO-091', 'Horas normais usam a jornada real da escala, não 8 horas fixas',
   'alternativo', 'critica', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — CLT, art. 58, caput ("salvo limite inferior"); CF, art. 7º, '
   'XIII (jornada de ATÉ 8 horas)',
   'Jornada contratual menor é limite contratual. Tratar 8 horas como padrão '
   'universal apaga a hora extra de quem tem jornada de 6.',
   'Colaborador com jornada contratual de 6 horas.',
   '[{"ordem":1,"acao":"20 dias trabalhados de 6 horas","resultado_esperado":"120 horas normais, não 160"},
     {"ordem":2,"acao":"Jornada de 6h30 num dia de 6 horas","resultado_esperado":"30 minutos de hora extra"},
     {"ordem":3,"acao":"Turno ininterrupto de revezamento","resultado_esperado":"Jornada de 6 horas (CF, art. 7º, XIV), salvo negociação coletiva"}]'::jsonb,
   'A jornada esperada vem da escala do colaborador.',
   'O passo 2 é onde o erro fere o trabalhador: com 8h fixas como base, a 7ª hora de quem tem jornada de 6 não aparece como extra.'),

  (v_mod, 'PONTO-092', 'Excesso ao limite de 2 horas extras é apurado E sinalizado',
   'excecao', 'alta', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — CLT, art. 59, caput: acréscimo de até 2 horas extras diárias',
   'Trabalho além do limite legal continua sendo devido — o que se faz é apurar e '
   'alertar, nunca deixar de pagar.',
   'Colaborador com jornada de 11 horas.',
   '[{"ordem":1,"acao":"Jornada de 11 horas, sendo 8 normais","resultado_esperado":"3 horas extras apuradas INTEGRALMENTE"},
     {"ordem":2,"acao":"Conferir alerta","resultado_esperado":"Excesso ao limite do art. 59 sinalizado ao RH"},
     {"ordem":3,"acao":"Conferir se o sistema limitou a apuração a 2 horas","resultado_esperado":"NÃO — limitar a apuração seria deixar de pagar hora trabalhada"}]'::jsonb,
   'Apura tudo, sinaliza o excesso.',
   'O passo 3 é o negativo mais perigoso deste bloco: um motor que "respeita o limite" truncando a apuração cria passivo em vez de evitá-lo.'),

  (v_mod, 'PONTO-093', 'Prorrogação por necessidade imperiosa tem regime próprio',
   'alternativo', 'media', 'aprovado', 'api',
   'CONDICIONADA AO ENQUADRAMENTO — CLT, art. 61 (necessidade imperiosa, força '
   'maior ou serviços inadiáveis, com regras próprias de limite e comunicação)',
   'A hipótese existe em lei e tem tratamento distinto do acréscimo comum.',
   'Evento registrado como necessidade imperiosa.',
   '[{"ordem":1,"acao":"Marcar a ocorrência como prorrogação do art. 61","resultado_esperado":"Registrada com a hipótese e a justificativa"},
     {"ordem":2,"acao":"Conferir o tratamento","resultado_esperado":"Distinto do acréscimo comum, conforme a hipótese"}]'::jsonb,
   'A hipótese do art. 61 é identificável e tratada à parte.',
   'EXIGE VALIDAÇÃO JURÍDICA antes de virar rotina: os efeitos variam conforme a hipótese (força maior, serviços inadiáveis, recuperação de paralisação) e há divergência sobre o adicional aplicável.'),

  -- ═══════════════════════════════════════════════════════
  -- G) TRABALHO NOTURNO — art. 73
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'PONTO-110', 'Adicional noturno urbano de 20% na janela das 22h às 5h',
   'feliz', 'critica', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — CLT, art. 73, caput (mínimo de 20%) e §2º (período noturno '
   'urbano: das 22h de um dia às 5h do dia seguinte)',
   'Base do cálculo noturno.',
   'Colaborador urbano.',
   '[{"ordem":1,"acao":"Jornada das 18:00 às 23:30","resultado_esperado":"Adicional apenas sobre os 90 minutos após as 22:00"},
     {"ordem":2,"acao":"Jornada das 22:00 às 06:00","resultado_esperado":"Adicional sobre 22:00–05:00; das 05:00 às 06:00 segue a regra da prorrogação (PONTO-112)"},
     {"ordem":3,"acao":"Jornada das 08:00 às 17:00","resultado_esperado":"Nenhum adicional noturno"},
     {"ordem":4,"acao":"Conferir o percentual","resultado_esperado":"20% é PISO; percentual maior de CCT prevalece"}]'::jsonb,
   'O adicional incide sobre os minutos dentro da janela legal.',
   'Implementado como parâmetro na escala e não consumido por motor nenhum.'),

  (v_mod, 'PONTO-111', 'Hora ficta noturna de 52 minutos e 30 segundos',
   'excecao', 'critica', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — CLT, art. 73, §1º: a hora do trabalho noturno urbano é '
   'computada como 52 minutos e 30 segundos',
   'A hora ficta AUMENTA a quantidade de horas noturnas apuradas. Ignorá-la '
   'subdimensiona a jornada de quem trabalha à noite.',
   'Colaborador urbano em jornada integralmente noturna.',
   '[{"ordem":1,"acao":"Jornada das 22:00 às 05:00 — 7 horas de relógio","resultado_esperado":"8 horas noturnas apuradas (7h ÷ 52min30s), com a conversão demonstrada na memória"},
     {"ordem":2,"acao":"Conferir o efeito no saldo","resultado_esperado":"A conversão pode gerar hora extra mesmo sem o trabalhador exceder o relógio"},
     {"ordem":3,"acao":"Conferir a memória de cálculo","resultado_esperado":"Mostra minutos de relógio, fator de conversão e horas resultantes"}]'::jsonb,
   'A hora ficta é aplicada e a conversão é auditável.',
   'O passo 2 é o efeito que surpreende o RH: 7 horas de relógio viram 8 horas de jornada, e a diferença é hora extra devida. Sem a memória do passo 3, ninguém entende de onde veio.'),

  (v_mod, 'PONTO-112', 'Prorrogação da jornada noturna mantém o adicional',
   'excecao', 'critica', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — CLT, art. 73, §5º; JURISPRUDÊNCIA CONSOLIDADA — TST, '
   'Súmula 60, II: cumprida integralmente a jornada no período noturno e '
   'prorrogada esta, o adicional é devido também sobre as horas prorrogadas',
   'Sem a Súmula 60, II, o adicional cessaria às 5h e a prorrogação ficaria '
   'sem adicional — resultado que o TST já rejeitou.',
   'Colaborador urbano em jornada noturna prorrogada.',
   '[{"ordem":1,"acao":"Jornada das 22:00 às 07:00","resultado_esperado":"Adicional também sobre 05:00–07:00, por prorrogação"},
     {"ordem":2,"acao":"Jornada das 02:00 às 07:00 — não cumpriu integralmente o período noturno","resultado_esperado":"A Súmula 60, II exige cumprimento integral; tratar conforme a orientação, com a razão registrada"},
     {"ordem":3,"acao":"Conferir a hora ficta nas horas prorrogadas","resultado_esperado":"Conforme orientação jurídica adotada, registrada na memória"}]'::jsonb,
   'A prorrogação carrega o adicional quando a jornada noturna foi integralmente cumprida.',
   'EXIGE VALIDAÇÃO JURÍDICA no passo 3: a aplicação da hora ficta às horas prorrogadas é controvertida. O caso registra a pergunta em vez de fingir que há resposta pacífica.'),

  (v_mod, 'PONTO-113', 'Trabalhador rural tem janela, percentual e regra próprios',
   'alternativo', 'alta', 'aprovado', 'api',
   'CONDICIONADA AO ENQUADRAMENTO — Lei 5.889/1973, art. 7º: lavoura das 21h às '
   '5h; pecuária das 20h às 4h; adicional de 25%; SEM hora ficta',
   'O regime rural é integralmente diferente do urbano nos três eixos.',
   'Colaboradores rurais de lavoura e de pecuária.',
   '[{"ordem":1,"acao":"Rural lavoura, jornada das 20:00 às 04:00","resultado_esperado":"Janela 21:00–05:00, adicional de 25%, sem hora ficta"},
     {"ordem":2,"acao":"Rural pecuária, mesma jornada","resultado_esperado":"Janela 20:00–04:00 — diferente da lavoura"},
     {"ordem":3,"acao":"Conferir se aplicou hora ficta","resultado_esperado":"NÃO — a Lei 5.889/1973 não prevê hora ficta"},
     {"ordem":4,"acao":"Conferir o percentual","resultado_esperado":"25%, não 20%"}]'::jsonb,
   'O enquadramento rural aplica as três regras próprias simultaneamente.',
   'Este caso sozinho demonstra por que janela, percentual e hora ficta precisam ser parâmetros por enquadramento e nunca constantes.'),

  -- ═══════════════════════════════════════════════════════
  -- H) REPOUSO, DOMINGOS E FERIADOS
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'PONTO-130', 'Trabalho em domingo ou feriado não compensado é pago em dobro',
   'excecao', 'critica', 'aprovado', 'api',
   'JURISPRUDÊNCIA CONSOLIDADA — TST, Súmula 146: o trabalho em domingos e '
   'feriados, não compensado, é pago em dobro, sem prejuízo da remuneração do '
   'repouso; OBRIGAÇÃO LEGAL — CLT, art. 67',
   'A dobra é regime próprio, distinto do adicional de hora extra.',
   'Feriado nacional cadastrado.',
   '[{"ordem":1,"acao":"Jornada integral em feriado nacional sem folga compensatória","resultado_esperado":"Pagamento em dobro, sem prejuízo do repouso"},
     {"ordem":2,"acao":"Mesmo feriado, com folga compensatória concedida","resultado_esperado":"Sem dobra; a compensação é registrada e rastreável"},
     {"ordem":3,"acao":"Trabalho em domingo que é o repouso semanal","resultado_esperado":"Mesmo tratamento da Súmula 146"},
     {"ordem":4,"acao":"Conferir alerta","resultado_esperado":"Trabalho em feriado sem compensação sinalizado ao RH"}]'::jsonb,
   'A dobra é aplicada quando não há compensação, e a compensação é comprovável.',
   'O passo 2 exige que o sistema saiba se houve folga compensatória — informação que precisa existir para a dobra não ser aplicada indevidamente.'),

  (v_mod, 'PONTO-131', 'Feriado é reconhecido pela abrangência e pela unidade do colaborador',
   'alternativo', 'alta', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — Lei 605/1949 e Lei 9.093/1995 (feriados civis e religiosos, '
   'inclusive municipais)',
   'Feriado municipal vale para a unidade daquele município e para nenhuma outra.',
   'Empresa com unidades em municípios diferentes.',
   '[{"ordem":1,"acao":"Feriado municipal da unidade A, colaborador da unidade A sem marcação","resultado_esperado":"Dia registrado como FERIADO, não como falta"},
     {"ordem":2,"acao":"Mesmo feriado, colaborador da unidade B","resultado_esperado":"Dia útil normal; falta se não houver marcação"},
     {"ordem":3,"acao":"Feriado estadual","resultado_esperado":"Aplica-se a todas as unidades daquele estado"},
     {"ordem":4,"acao":"Feriado nacional","resultado_esperado":"Aplica-se a todas as unidades"}]'::jsonb,
   'A abrangência do feriado governa quem é afetado.',
   'O passo 2 é o erro que gera falta indevida em massa: aplicar feriado municipal a toda a empresa.'),

  (v_mod, 'PONTO-132', 'Falta injustificada retira a remuneração do repouso da semana',
   'excecao', 'alta', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — Lei 605/1949, art. 6º: a falta injustificada na semana faz '
   'o empregado perder a remuneração do repouso semanal',
   'É consequência automática e frequentemente não implementada.',
   'Semana com uma falta.',
   '[{"ordem":1,"acao":"Uma falta injustificada na semana","resultado_esperado":"Perda do DSR daquela semana, calculada como valor"},
     {"ordem":2,"acao":"Falta com atestado aceito","resultado_esperado":"Sem perda do repouso"},
     {"ordem":3,"acao":"Atraso, sem falta","resultado_esperado":"Conferir a regra adotada e registrá-la expressamente"},
     {"ordem":4,"acao":"Conferir a saída","resultado_esperado":"DSR como VALOR devido ou perdido, não como marcação de sim ou não"}]'::jsonb,
   'O DSR é apurado como valor e responde às faltas da semana.',
   'O passo 3 EXIGE VALIDAÇÃO: o art. 6º fala em falta; o efeito do atraso sobre o repouso depende de interpretação e de norma coletiva. Registrar a decisão em vez de assumir.'),

  (v_mod, 'PONTO-133', 'Semana sem 24 horas consecutivas de repouso gera alerta',
   'excecao', 'alta', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — CLT, art. 67: repouso semanal remunerado de 24 horas '
   'consecutivas, preferencialmente aos domingos',
   'Trabalhar sete dias seguidos é violação autônoma, ainda que tudo seja pago.',
   'Colaborador que trabalhou todos os dias da semana.',
   '[{"ordem":1,"acao":"Marcações em todos os sete dias","resultado_esperado":"Alerta de ausência de repouso semanal"},
     {"ordem":2,"acao":"Conferir se o repouso foi de 24 horas CONSECUTIVAS","resultado_esperado":"Folgas fracionadas não satisfazem o art. 67"},
     {"ordem":3,"acao":"Conferir a preferência pelo domingo","resultado_esperado":"Sinalizada quando o repouso recai sistematicamente em outro dia"}]'::jsonb,
   'A ausência de repouso é detectada mesmo quando as horas são pagas.',
   'O passo 2 é sutil e importante: duas folgas de 12 horas não equivalem a 24 consecutivas.'),

  -- ═══════════════════════════════════════════════════════
  -- I) ESCALAS E CICLO 12x36
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'PONTO-150', 'Escala 12x36 apura ciclo de trabalho e folga',
   'feliz', 'alta', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — CLT, art. 59-A: escala 12x36 mediante acordo individual '
   'escrito, convenção ou acordo coletivo',
   'A escala tem regime próprio e depende de instrumento que a autorize.',
   'Colaborador em 12x36 com instrumento vigente.',
   '[{"ordem":1,"acao":"Dia de trabalho do ciclo, 12 horas registradas","resultado_esperado":"Jornada esperada de 12h, saldo zero"},
     {"ordem":2,"acao":"Dia de folga do ciclo, sem marcação","resultado_esperado":"Folga; sem falta e sem saldo negativo"},
     {"ordem":3,"acao":"Conferir a existência do instrumento","resultado_esperado":"Sem acordo escrito ou norma coletiva, a escala não pode ser aplicada"}]'::jsonb,
   'O ciclo é calculado a partir de data de referência e sequência.',
   'O passo 3 é o que costuma faltar: a 12x36 sem instrumento é jornada de 12 horas comum, com 4 horas extras diárias.'),

  (v_mod, 'PONTO-151', 'Na 12x36, feriados e prorrogação noturna são compensados',
   'excecao', 'alta', 'aprovado', 'api',
   'CONDICIONADA AO ENQUADRAMENTO — CLT, art. 59-A, parágrafo único: na escala '
   '12x36 consideram-se compensados os feriados e as prorrogações de trabalho noturno',
   'É exceção legal expressa. Aplicar a regra geral de feriado à 12x36 gera '
   'pagamento indevido.',
   'Colaborador em 12x36, feriado coincidindo com dia de escala.',
   '[{"ordem":1,"acao":"Trabalho em feriado no dia de escala","resultado_esperado":"SEM pagamento adicional por feriado; razão registrada na memória"},
     {"ordem":2,"acao":"Prorrogação noturna na 12x36","resultado_esperado":"Considerada compensada pelo parágrafo único"},
     {"ordem":3,"acao":"Mesmo cenário em escala 5x2","resultado_esperado":"Regra geral: dobra da Súmula 146 e adicional de prorrogação"}]'::jsonb,
   'A exceção do art. 59-A é aplicada apenas a quem está nessa escala.',
   'O passo 3 é a contraprova: uma implementação que generalize a exceção deixaria de pagar feriado a toda a empresa.'),

  (v_mod, 'PONTO-152', 'Troca de escala preserva o histórico de vigência',
   'alternativo', 'critica', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — CLT, art. 74 e dever de guarda dos controles; a apuração '
   'deve usar o parâmetro vigente na data do fato gerador',
   'Apurar dia antigo com escala nova falsifica o passado.',
   'Colaborador com troca de escala no dia 15.',
   '[{"ordem":1,"acao":"Apurar dias 1 a 14","resultado_esperado":"Com a escala ANTERIOR"},
     {"ordem":2,"acao":"Apurar dias 15 em diante","resultado_esperado":"Com a escala NOVA"},
     {"ordem":3,"acao":"Reapurar a competência inteira depois da troca","resultado_esperado":"Resultado idêntico ao original — cada dia com a escala da sua data"},
     {"ordem":4,"acao":"Tentar vigência retroativa sobre competência fechada","resultado_esperado":"RECUSADO, com explicação"}]'::jsonb,
   'Cada dia é apurado com o parâmetro vigente naquele dia.',
   'O passo 3 é o teste real do versionamento: reapurar não pode mudar o passado.'),

  (v_mod, 'PONTO-153', 'Alteração de parâmetro não altera competência já apurada',
   'excecao', 'critica', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — CLT, art. 74; princípio da apuração pela norma vigente na '
   'data do fato gerador',
   'Parâmetros versionados por vigência são o que separa auditoria de reescrita '
   'da história.',
   'Competência anterior já apurada.',
   '[{"ordem":1,"acao":"Alterar hoje o percentual de hora extra","resultado_esperado":"Nova versão do parâmetro, com vigência a partir de hoje"},
     {"ordem":2,"acao":"Reapurar o mês passado","resultado_esperado":"Resultado idêntico ao original, com a versão ANTIGA do parâmetro"},
     {"ordem":3,"acao":"Conferir a memória do mês passado","resultado_esperado":"Indica qual versão do parâmetro foi usada"}]'::jsonb,
   'Reapuração é reprodução, não recálculo com regras novas.',
   'Sem isso, qualquer ajuste de parâmetro reescreve meses fechados e destrói o valor probatório do espelho já entregue.'),

  -- ═══════════════════════════════════════════════════════
  -- J) BANCO DE HORAS
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'PONTO-170', 'Hora extra só vai para banco se houver instrumento vigente',
   'excecao', 'critica', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — CLT, art. 59, §§2º, 5º e 6º: o banco de horas depende de '
   'convenção, acordo coletivo ou acordo individual escrito, conforme o prazo',
   'Sem instrumento, a hora extra é devida em dinheiro. Mandar para banco sem '
   'lastro é postergar pagamento devido.',
   'Colaborador sem acordo de compensação.',
   '[{"ordem":1,"acao":"Hora extra realizada sem instrumento vigente","resultado_esperado":"Direcionada a PAGAMENTO, não a banco; alerta ao RH"},
     {"ordem":2,"acao":"Colaborador com acordo individual escrito","resultado_esperado":"Pode ir para banco, prazo de 6 meses (§5º)"},
     {"ordem":3,"acao":"Colaborador com instrumento coletivo","resultado_esperado":"Pode ir para banco, prazo de até 12 meses (§2º)"},
     {"ordem":4,"acao":"Compensação dentro do mesmo mês","resultado_esperado":"Admitida por acordo individual, inclusive tácito (§6º)"}]'::jsonb,
   'O destino da hora extra segue o instrumento aplicável àquele colaborador.',
   'Os prazos NÃO são um número único: 6 meses, 12 meses ou mesmo mês, conforme o instrumento. O sistema precisa saber qual se aplica a cada pessoa.'),

  (v_mod, 'PONTO-171', 'Saldo não compensado no prazo vira hora extra devida',
   'excecao', 'critica', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — CLT, art. 59, §§2º e 5º (prazos de compensação); §3º '
   '(pagamento das horas não compensadas)',
   'Vencido o prazo, a compensação deixa de ser possível e a hora vira crédito '
   'em dinheiro.',
   'Saldo positivo com prazo vencido.',
   '[{"ordem":1,"acao":"Saldo positivo após a data de vencimento","resultado_esperado":"Convertido em hora extra devida, com movimentação e evidência"},
     {"ordem":2,"acao":"Conferir a data de vencimento","resultado_esperado":"Calculada a partir do instrumento, não de constante"},
     {"ordem":3,"acao":"Saldo a 30 dias do vencimento","resultado_esperado":"Alerta gerado com antecedência para permitir compensação"},
     {"ordem":4,"acao":"Conferir se o saldo simplesmente expirou","resultado_esperado":"NÃO — saldo não desaparece; vira crédito"}]'::jsonb,
   'O vencimento converte, nunca elimina.',
   'O passo 4 é o negativo grave: zerar saldo vencido é apropriação de hora trabalhada.'),

  (v_mod, 'PONTO-172', 'Compensação respeita o limite de 10 horas diárias',
   'excecao', 'alta', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — CLT, art. 59, §2º: compensação sem exceder 10 horas diárias',
   'O limite é do regime de compensação e independe do limite de 2 horas extras.',
   'Colaborador em regime de banco de horas.',
   '[{"ordem":1,"acao":"Jornada de 11 horas em regime de compensação","resultado_esperado":"Alerta de excesso ao limite do §2º; horas apuradas integralmente"},
     {"ordem":2,"acao":"Jornada de exatamente 10 horas","resultado_esperado":"Dentro do limite"},
     {"ordem":3,"acao":"Saldo ultrapassa o limite de acúmulo parametrizado","resultado_esperado":"Alerta conforme configuração; sem bloquear a apuração"}]'::jsonb,
   'Os limites geram alerta e nunca truncam a apuração.',
   'Mesma lógica do PONTO-092: sinalizar sem deixar de apurar.'),

  (v_mod, 'PONTO-173', 'Rescisão com saldo de banco de horas',
   'excecao', 'critica', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — CLT, art. 59, §3º: na rescisão sem compensação integral, '
   'pagamento das horas não compensadas sobre a remuneração da DATA DA RESCISÃO',
   'A base de cálculo é a remuneração da rescisão, não a da época em que a hora '
   'foi trabalhada.',
   'Colaborador em desligamento com saldo positivo.',
   '[{"ordem":1,"acao":"Iniciar desligamento com saldo positivo","resultado_esperado":"Saldo apresentado; conclusão bloqueada sem tratamento"},
     {"ordem":2,"acao":"Conferir a base de cálculo","resultado_esperado":"Remuneração da data da rescisão, conforme §3º"},
     {"ordem":3,"acao":"Saldo NEGATIVO na rescisão","resultado_esperado":"Tratamento conforme orientação jurídica, registrado"},
     {"ordem":4,"acao":"Conferir integração com o módulo de Desligamento","resultado_esperado":"O saldo chega às verbas rescisórias"}]'::jsonb,
   'Nenhum desligamento conclui com saldo de banco sem tratamento.',
   'O passo 3 EXIGE VALIDAÇÃO: o desconto de saldo negativo na rescisão é controvertido. Conecta com DESL-100 e DESL-101, já documentados.'),

  (v_mod, 'PONTO-174', 'Habitualidade de hora extra não invalida o acordo de compensação',
   'negativo', 'media', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — CLT, art. 59-B, parágrafo único: a prestação habitual de '
   'horas extras não descaracteriza o acordo de compensação',
   'Regra pós-reforma que inverteu entendimento anterior. Sistema que invalida o '
   'banco por habitualidade aplica direito revogado.',
   'Colaborador com hora extra habitual e banco vigente.',
   '[{"ordem":1,"acao":"Hora extra em todos os dias do mês, com banco vigente","resultado_esperado":"Acordo permanece válido; horas seguem para banco"},
     {"ordem":2,"acao":"Conferir se o sistema descaracterizou o acordo","resultado_esperado":"NÃO — o art. 59-B veda essa consequência"}]'::jsonb,
   'A habitualidade não desfaz o regime de compensação.',
   'Caso de proteção contra implementação baseada em jurisprudência anterior à Lei 13.467/2017.'),

  (v_mod, 'PONTO-175', 'Reapuração preserva lançamento manual',
   'excecao', 'alta', 'aprovado', 'api',
   'BOA PRÁTICA — rastreabilidade do saldo; apoia CLT, art. 59, §3º (o saldo '
   'precisa ser reconstituível na rescisão)',
   'Lançamento manual tem autor e justificativa. Regenerá-lo apaga decisão humana '
   'registrada.',
   'Banco com movimentações automáticas e um lançamento manual.',
   '[{"ordem":1,"acao":"Reapurar a competência","resultado_esperado":"Movimentações automáticas regeneradas"},
     {"ordem":2,"acao":"Conferir o lançamento manual","resultado_esperado":"PRESERVADO, com autor e justificativa intactos"},
     {"ordem":3,"acao":"Conferir o saldo final","resultado_esperado":"Coerente, sem duplicar nem perder o manual"}]'::jsonb,
   'A reapuração recalcula o automático e respeita o manual.',
   'Sem isso, cada reapuração apaga correções feitas pelo RH e o saldo oscila sem explicação.'),

  -- ═══════════════════════════════════════════════════════
  -- K) AJUSTES, TRILHA E FECHAMENTO
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'PONTO-190', 'Ajuste cria batida de correção e preserva a original',
   'alternativo', 'critica', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — Portaria MTE 671/2021 (inalterabilidade das marcações); '
   'TST, Súmula 338',
   'É o único caminho legítimo de correção.',
   'Marcação esquecida.',
   '[{"ordem":1,"acao":"Colaborador solicita inclusão com motivo","resultado_esperado":"Ajuste pendente; dia sinalizado; aprovador notificado"},
     {"ordem":2,"acao":"Gestor aprova","resultado_esperado":"Batida de CORREÇÃO criada; original preservada; dia e saldo reapurados"},
     {"ordem":3,"acao":"Conferir o espelho","resultado_esperado":"Mostra original e correção, com autor, data e motivo"},
     {"ordem":4,"acao":"Gestor rejeita outro ajuste","resultado_esperado":"Status rejeitado; motivo visível ao solicitante; nada alterado no dia"}]'::jsonb,
   'A correção é acréscimo rastreável, com aprovação registrada.',
   'A auditoria indica que esse fluxo está bem construído. É caso de proteção do que já funciona.'),

  (v_mod, 'PONTO-191', 'Cadeia de hash detecta alteração direta no banco',
   'excecao', 'critica', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — Portaria MTE 671/2021 (inalterabilidade e armazenamento de '
   'registro de ponto); TST, Súmula 338',
   'Encadeamento criptográfico é o que transforma "não editamos" em prova.',
   'Marcações gravadas com hash encadeado.',
   '[{"ordem":1,"acao":"Alterar um registro direto no banco","resultado_esperado":"A rotina de verificação DETECTA e reporta a inconsistência"},
     {"ordem":2,"acao":"Conferir a cobertura do hash","resultado_esperado":"Toda batida, original ou de correção, tem hash encadeado com a anterior"},
     {"ordem":3,"acao":"Conferir a periodicidade da verificação","resultado_esperado":"Executada por rotina, não apenas sob demanda"}]'::jsonb,
   'A cadeia é homogênea e verificada.',
   'O passo 2 é o gap indicado na auditoria: o hash não é homogêneo entre batidas originais e ajustadas, o que deixa lacuna na cadeia.'),

  (v_mod, 'PONTO-192', 'Trilha de auditoria é completa e não pode ser apagada',
   'negativo', 'critica', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — Portaria MTE 671/2021; LGPD, art. 37 (registro das operações '
   'de tratamento)',
   'Trilha que pode ser apagada não é trilha.',
   'Módulo em operação.',
   '[{"ordem":1,"acao":"Executar todas as operações relevantes do módulo","resultado_esperado":"Cada uma gera registro com autor, data, valor anterior e posterior"},
     {"ordem":2,"acao":"Tentar excluir registro da trilha por qualquer caminho","resultado_esperado":"IMPOSSÍVEL"},
     {"ordem":3,"acao":"Tentar alterar registro da trilha","resultado_esperado":"IMPOSSÍVEL"},
     {"ordem":4,"acao":"Conferir se a trilha registra tentativas negadas","resultado_esperado":"Sim — tentativa recusada também é evento auditável"}]'::jsonb,
   'A trilha é completa, imutável e registra inclusive o que foi negado.',
   'O passo 4 é frequentemente esquecido e é o que permite detectar tentativa de fraude.'),

  (v_mod, 'PONTO-193', 'Competência fechada não aceita alteração',
   'negativo', 'critica', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — CLT, art. 74 e dever de guarda; o espelho fechado é o '
   'documento entregue ao trabalhador',
   'Alterar competência fechada muda documento já entregue e assinado.',
   'Competência fechada.',
   '[{"ordem":1,"acao":"Tentar ajuste em competência fechada","resultado_esperado":"RECUSADO com mensagem explicativa"},
     {"ordem":2,"acao":"Tentar alterar marcação de período fechado direto pela API","resultado_esperado":"RECUSADO"},
     {"ordem":3,"acao":"Reabrir formalmente, com motivo e alçada adequada","resultado_esperado":"Reabertura registrada na trilha"},
     {"ordem":4,"acao":"Fechar novamente","resultado_esperado":"NOVA VERSÃO do espelho; a anterior permanece recuperável"}]'::jsonb,
   'O fechamento é barreira, e a reabertura é ato formal versionado.',
   'O passo 4 importa: substituir o espelho anterior apagaria o documento que o trabalhador já recebeu.'),

  (v_mod, 'PONTO-194', 'Falha durante o fechamento não deixa espelho parcial',
   'excecao', 'alta', 'aprovado', 'api',
   'BOA PRÁTICA — integridade transacional; apoia CLT, art. 74 (o espelho é '
   'documento com valor probatório)',
   'Espelho parcial é pior que espelho ausente: parece completo e não é.',
   'Fechamento em execução.',
   '[{"ordem":1,"acao":"Interromper o processo no meio","resultado_esperado":"NENHUM espelho parcial persistido"},
     {"ordem":2,"acao":"Conferir o estado da competência","resultado_esperado":"Continua aberta, sem registro de fechamento"},
     {"ordem":3,"acao":"Repetir o fechamento","resultado_esperado":"Conclui normalmente, sem duplicar"}]'::jsonb,
   'O fechamento é tudo ou nada.',
   'Mesma classe do DESL-091: integração não bloqueante que deixa estado intermediário.'),

  (v_mod, 'PONTO-195', 'Colaborador tem ciência do espelho, com direito a ressalva',
   'alternativo', 'alta', 'aprovado', 'e2e',
   'OBRIGAÇÃO LEGAL — Portaria MTE 671/2021 (Espelho de Ponto Eletrônico); '
   'TST, Súmula 338 (valor probatório dos controles)',
   'Ciência sem possibilidade de discordar não é ciência.',
   'Competência fechada.',
   '[{"ordem":1,"acao":"Colaborador acessa o portal após o fechamento","resultado_esperado":"Espelho visível na íntegra"},
     {"ordem":2,"acao":"Registrar ciência","resultado_esperado":"Gravada com data e identificação"},
     {"ordem":3,"acao":"Registrar RESSALVA em vez de ciência","resultado_esperado":"Aceita e registrada; o fechamento não a apaga"},
     {"ordem":4,"acao":"Conferir o espelho depois da ressalva","resultado_esperado":"A ressalva acompanha o documento"}]'::jsonb,
   'O trabalhador pode concordar ou discordar, e ambos ficam registrados.',
   'O passo 3 é o que distingue ciência real de mero aceite: sistema que só oferece "concordo" produz prova frágil.'),

  -- ═══════════════════════════════════════════════════════
  -- L) ARTEFATOS REGULAMENTARES
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'PONTO-210', 'AFD é gerado com numeração sequencial sem lacunas',
   'feliz', 'critica', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — Portaria MTE 671/2021 (Arquivo Fonte de Dados, com marcações '
   'inalteráveis; no REP-P pode ser fracionado); Portaria MTP 1.486/2022 (assinatura '
   'CAdES com certificado ICP-Brasil)',
   'A sequência sem lacunas é o que demonstra que nada foi removido.',
   'Período com marcações.',
   '[{"ordem":1,"acao":"Gerar AFD por período","resultado_esperado":"Arquivo no leiaute VIGENTE na data da geração"},
     {"ordem":2,"acao":"Conferir a numeração","resultado_esperado":"Sequencial, sem lacunas"},
     {"ordem":3,"acao":"Conferir a assinatura","resultado_esperado":"CAdES com certificado ICP-Brasil"},
     {"ordem":4,"acao":"Conferir a identificação do trabalhador","resultado_esperado":"Por CPF, conforme a Portaria 671"}]'::jsonb,
   'O AFD é íntegro, sequencial e assinado.',
   'ATENÇÃO DE VIGÊNCIA: o leiaute muda. Este caso verifica CONFORMIDADE COM O LEIAUTE VIGENTE, e não um leiaute específico. Baixar a versão oficial na data do desenvolvimento — nunca implementar a partir de documentação de terceiros.'),

  (v_mod, 'PONTO-211', 'AEJ é gerado pelo programa de tratamento',
   'feliz', 'critica', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — Portaria MTE 671/2021 (Arquivo Eletrônico de Jornada, '
   'gerado pelo programa de tratamento, substituindo AFDT e ACJEF); '
   'Portaria MTP 1.486/2022 (assinatura CAdES)',
   'O AEJ é a saída obrigatória do PTRP e hoje não existe.',
   'Competência fechada, estabelecimento definido.',
   '[{"ordem":1,"acao":"Gerar AEJ","resultado_esperado":"Arquivo no leiaute vigente, assinado, com emissão registrada"},
     {"ordem":2,"acao":"Conferir a jornada apurada no arquivo","resultado_esperado":"Valores reais; zero apenas onde de fato não houve"},
     {"ordem":3,"acao":"Conferir a identificação","resultado_esperado":"Por CPF"}]'::jsonb,
   'O AEJ existe, é assinado e reflete a apuração real.',
   'O passo 2 conecta com o achado central da auditoria: enquanto o motor não calcular, o AEJ levaria zeros — e um AEJ de zeros é declaração formal de que não houve hora extra.'),

  (v_mod, 'PONTO-212', 'Importação de AFD com lacuna é recusada por inteiro',
   'negativo', 'alta', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — Portaria MTE 671/2021 (integridade e inalterabilidade do AFD)',
   'Importar arquivo com lacuna incorpora prova adulterada ao acervo.',
   'Arquivo AFD com registro faltante na sequência.',
   '[{"ordem":1,"acao":"Importar o arquivo","resultado_esperado":"RECUSADO por inteiro; relatório da inconsistência apresentado"},
     {"ordem":2,"acao":"Conferir o que foi gravado","resultado_esperado":"NADA — importação parcial é pior que nenhuma"},
     {"ordem":3,"acao":"Importar arquivo íntegro","resultado_esperado":"Aceito"}]'::jsonb,
   'Ou entra íntegro, ou não entra.',
   'O passo 2 é o negativo essencial: importação parcial mistura registros de origens distintas sem que ninguém saiba.'),

  (v_mod, 'PONTO-213', 'Cliente sem autorização coletiva não usa sistema alternativo',
   'negativo', 'critica', 'aprovado', 'api',
   'CONDICIONADA A CCT/ACT — Portaria MTE 671/2021: o sistema alternativo de '
   'controle de jornada (REP-A) é admitido apenas quando autorizado por convenção '
   'ou acordo coletivo; CLT, art. 74, §4º (registro por exceção)',
   'Sem autorização coletiva, a operação por aplicativo precisa atender às '
   'formalidades do REP-P.',
   'Cliente sem autorização coletiva registrada.',
   '[{"ordem":1,"acao":"Tentar gerar link de marcação por aplicativo","resultado_esperado":"RECUSADO, com explicação da exigência"},
     {"ordem":2,"acao":"Cadastrar autorização coletiva vigente e repetir","resultado_esperado":"Permitido"},
     {"ordem":3,"acao":"Autorização vencida","resultado_esperado":"Bloqueado, com alerta de vencimento anterior à expiração"}]'::jsonb,
   'A vigência da autorização coletiva governa a modalidade de registro.',
   'DECISÃO DE PRODUTO PRECEDENTE (D-01 do documento): ou o YourEyes se estrutura como REP-P conforme, ou cada cliente precisa de autorização em norma coletiva. Este caso pressupõe o segundo caminho. Se a decisão for o primeiro, o caso muda de forma.'),

  -- ═══════════════════════════════════════════════════════
  -- M) MULTI-TENANT, PERMISSÕES E PROTEÇÃO DE DADOS
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'PONTO-250', 'Marcação não atravessa a fronteira entre clientes',
   'negativo', 'critica', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — LGPD, arts. 46 e 47 (segurança e prevenção de acesso '
   'indevido); art. 6º, VII (segurança)',
   'Ponto é dado pessoal e revela rotina, localização e presença. Vazamento entre '
   'clientes é incidente, não inconveniência.',
   'Dois tenants com colaboradores ativos.',
   '[{"ordem":1,"acao":"Autenticado no tenant A, consultar marcações do tenant B","resultado_esperado":"Nenhum dado retornado"},
     {"ordem":2,"acao":"Gravar marcação com tenant_id de outro cliente pela API","resultado_esperado":"RECUSADO"},
     {"ordem":3,"acao":"Consultar por cada caminho público do módulo","resultado_esperado":"Nenhum retorna dado de outra empresa"},
     {"ordem":4,"acao":"Conferir RLS em todas as tabelas de ponto","resultado_esperado":"Ativa, com política, nas 24 tabelas do módulo"}]'::jsonb,
   'O isolamento vale para leitura e escrita, em todos os caminhos.',
   'O passo 4 é verificável por consulta ao catálogo e é o mais barato de automatizar. Conecta com o achado HIER-006, onde a escrita atravessava tenant porque a FK não validava.'),

  (v_mod, 'PONTO-251', 'Link de marcação exige expiração e é revogável',
   'negativo', 'critica', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — LGPD, arts. 46 e 47; art. 6º, VIII (prevenção)',
   'Link sem expiração é credencial permanente distribuída por mensagem.',
   'Tela de geração de link.',
   '[{"ordem":1,"acao":"Tentar criar link sem data de expiração","resultado_esperado":"RECUSADO"},
     {"ordem":2,"acao":"Acessar com token revogado","resultado_esperado":"Acesso negado; tentativa registrada"},
     {"ordem":3,"acao":"Acessar com token expirado","resultado_esperado":"Acesso negado"},
     {"ordem":4,"acao":"Conferir a geração do token","resultado_esperado":"No servidor, com entropia adequada — nunca previsível ou derivado de dado do colaborador"},
     {"ordem":5,"acao":"Vários CPFs em sequência no mesmo link compartilhado","resultado_esperado":"Bloqueio temporário e registro do evento"}]'::jsonb,
   'O link é temporário, revogável, imprevisível e protegido contra varredura.',
   'O passo 5 trata o link compartilhado como superfície de enumeração de CPF — que é exatamente o que ele é se não houver limite de tentativas.'),

  (v_mod, 'PONTO-252', 'Aprovação de ajuste exige alçada',
   'negativo', 'critica', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — Portaria MTE 671/2021 (integridade do registro); '
   'LGPD, art. 6º, III (necessidade)',
   'Aprovar o próprio ajuste destrói o controle.',
   'Colaborador comum e gestor.',
   '[{"ordem":1,"acao":"Colaborador comum tenta aprovar ajuste","resultado_esperado":"RECUSADO com mensagem clara"},
     {"ordem":2,"acao":"Colaborador tenta aprovar o PRÓPRIO ajuste","resultado_esperado":"RECUSADO mesmo se tiver papel de gestor"},
     {"ordem":3,"acao":"Gestor de outra empresa tenta aprovar","resultado_esperado":"RECUSADO"},
     {"ordem":4,"acao":"Gestor com alçada aprova","resultado_esperado":"Permitido, com autor registrado"}]'::jsonb,
   'A alçada é verificada por papel, por escopo e por conflito de interesse.',
   'O passo 2 é o mais esquecido: gestor que ajusta o próprio ponto e aprova sozinho anula todo o fluxo.'),

  (v_mod, 'PONTO-253', 'Dado acessório é eliminado no fim do prazo, sem perder a marcação',
   'excecao', 'alta', 'aprovado', 'api',
   'OBRIGAÇÃO LEGAL — LGPD, art. 16 (eliminação após o término do tratamento, '
   'ressalvadas hipóteses de guarda legal); art. 6º, III (necessidade); '
   'CLT, art. 74 (guarda dos controles de jornada)',
   'Selfie e geolocalização são acessórios com finalidade limitada. A marcação em '
   'si tem guarda legal e permanece.',
   'Marcações com selfie e localização, com prazo vencido.',
   '[{"ordem":1,"acao":"Rodar o expurgo do prazo vencido","resultado_esperado":"Selfie e geolocalização eliminadas"},
     {"ordem":2,"acao":"Conferir a marcação","resultado_esperado":"PRESERVADA — tem guarda legal própria"},
     {"ordem":3,"acao":"Conferir o registro do expurgo","resultado_esperado":"Evento registrado, conforme LGPD art. 37"},
     {"ordem":4,"acao":"Conferir a cadeia de hash após o expurgo","resultado_esperado":"Íntegra — o expurgo do acessório não pode quebrar a prova da batida"}]'::jsonb,
   'O acessório some no prazo, a prova permanece, e a cadeia sobrevive.',
   'O passo 4 é a armadilha: se o hash incluir a selfie, expurgá-la invalida a cadeia inteira. É decisão de projeto que precisa ser tomada antes, não depois.'),

  (v_mod, 'PONTO-254', 'Selfie é dado comum enquanto não houver verificação facial',
   'alternativo', 'critica', 'aprovado', 'e2e',
   'CONDICIONADA AO USO — LGPD, art. 5º, II (dado biométrico é dado pessoal '
   'sensível); art. 11 (tratamento de dado sensível exige base legal própria); '
   'art. 7º, II (obrigação legal do controlador)',
   'O regime jurídico muda conforme o uso, não conforme o formato do arquivo.',
   'Sistema com selfie na marcação.',
   '[{"ordem":1,"acao":"Selfie armazenada apenas como evidência, sem comparação","resultado_esperado":"Dado pessoal COMUM; base legal do art. 7º, II"},
     {"ordem":2,"acao":"Sistema passa a comparar a foto para identificar o trabalhador","resultado_esperado":"Vira dado BIOMÉTRICO — sensível; exige base do art. 11 e avaliação de impacto"},
     {"ordem":3,"acao":"Conferir o aviso de tratamento na tela de marcação","resultado_esperado":"Visível e acessível, com a finalidade correta para o uso vigente"}]'::jsonb,
   'O uso define o regime, e o aviso acompanha o uso.',
   'DECISÃO DE PRODUTO COM CONSEQUÊNCIA JURÍDICA: ativar verificação facial sem trocar a base legal e sem avaliação de impacto é tratar dado sensível fora do art. 11.'),

  -- ═══════════════════════════════════════════════════════
  -- N) ISOLAMENTO DO PRÓPRIO QA — os testes não podem cruzar a cerca
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'PONTO-270', 'Todas as tabelas de ponto têm a trava do cercado',
   'negativo', 'critica', 'aprovado', 'api',
   'Regra de produto (sem base legal direta) — apoia LGPD, arts. 46 e 47: rotina '
   'de teste que escreva em dado de cliente é incidente de segurança causado pela '
   'própria ferramenta de qualidade',
   'O módulo tem 24 tabelas de ponto e 6 de jornada. Uma rotina com erro de tenant '
   'não pode alcançar nenhuma delas.',
   'Cercado instalado.',
   '[{"ordem":1,"acao":"Listar tabelas de ponto e jornada sem a trava qa_guarda_cercado","resultado_esperado":"Nenhuma"},
     {"ordem":2,"acao":"Com o modo de teste ligado, tentar INSERT em ponto de tenant real","resultado_esperado":"BLOQUEADO"},
     {"ordem":3,"acao":"Tentar UPDATE movendo linha do cercado para tenant real","resultado_esperado":"BLOQUEADO"},
     {"ordem":4,"acao":"Tentar DELETE em ponto de tenant real","resultado_esperado":"BLOQUEADO"},
     {"ordem":5,"acao":"Escrever no cercado","resultado_esperado":"PERMITIDO"}]'::jsonb,
   'A cerca cobre as três operações em todas as tabelas do módulo.',
   'Verificado em 31/07/2026 com a cerca genérica: 24 tabelas de ponto e 6 de jornada protegidas, e as três operações bloqueadas contra tenant real. Este caso vigia para que continue assim quando tabelas novas de ponto forem criadas.'),

  (v_mod, 'PONTO-271', 'Bateria de ponto não deixa resíduo no cercado',
   'negativo', 'critica', 'aprovado', 'api',
   'Regra de produto — integridade do ambiente de teste',
   'As rotinas de ponto escrevem em marcação, dia, banco de horas, alertas e '
   'fechamento. Nada pode sobrar.',
   'Bateria do módulo executada.',
   '[{"ordem":1,"acao":"Rodar a bateria do módulo de ponto","resultado_esperado":"Concluída"},
     {"ordem":2,"acao":"Rodar qa_verifica_vazamento()","resultado_esperado":"Limpo — nada fora do mobiliário fixo em nenhuma das 298 tabelas"},
     {"ordem":3,"acao":"Conferir especificamente as tabelas de ponto","resultado_esperado":"Zero linhas no tenant do cercado"}]'::jsonb,
   'O cercado volta ao repouso após a bateria.',
   'O detector genérico cobre isso automaticamente desde 01/08/2026 — tabela nova de ponto entra na vigilância sem alteração de código.')

  ON CONFLICT (codigo) DO NOTHING;

  SELECT count(*) INTO v_depois FROM public.qa_casos_teste WHERE modulo_id = v_mod;
  RAISE NOTICE 'Modulo Ponto: % casos antes, % depois (+%).', v_antes, v_depois, v_depois - v_antes;
END $doc$;

-- Conferencia: todo caso deste modulo declara base legal
DO $confere$
DECLARE v_sem text;
BEGIN
  SELECT string_agg(ct.codigo, ', ' ORDER BY ct.codigo) INTO v_sem
  FROM public.qa_casos_teste ct
  JOIN public.qa_modulos m ON m.id = ct.modulo_id
  WHERE m.path = 'jornada-rotina/ponto'
    AND (ct.base_legal IS NULL OR btrim(ct.base_legal) = '');
  IF v_sem IS NULL THEN
    RAISE NOTICE 'OK: todo caso de Ponto declara sua fundamentacao.';
  ELSE
    RAISE WARNING 'Sem base legal: %', v_sem;
  END IF;
END $confere$;

SELECT ct.prioridade::text AS prioridade, ct.nivel, count(*) AS casos
FROM public.qa_casos_teste ct
JOIN public.qa_modulos m ON m.id = ct.modulo_id
WHERE m.path = 'jornada-rotina/ponto'
GROUP BY ct.prioridade, ct.nivel
ORDER BY CASE ct.prioridade WHEN 'critica' THEN 1 WHEN 'alta' THEN 2
                            WHEN 'media' THEN 3 ELSE 4 END, ct.nivel;
