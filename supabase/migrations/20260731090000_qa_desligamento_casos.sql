-- =========================================================
-- QA — Desligamento de colaborador (30/07/2026)
--
-- PRINCIPIO DESTA MIGRATION: o caso documenta O QUE A LEI EXIGE, nao o que
-- o sistema faz hoje. Onde o sistema divergir, o caso FALHA e a falha e o
-- encaminhamento para a equipe de desenvolvimento. Nenhuma regra aqui foi
-- escrita por deducao: cada uma cita artigo, item de NR, sumula ou decreto.
-- Onde a fundamentacao depende de negociacao coletiva ou de decisao de
-- produto ainda nao tomada, o caso entra como rascunho [A CONSTRUIR] e diz
-- o que precisa ser definido — nao inventa a regra.
--
-- ESTRUTURA NOVA: qa_casos_teste ganha a coluna base_legal. Fundamentacao
-- deixa de ser texto solto em observacoes e vira campo consultavel. Num
-- sistema de conformidade ocupacional e trabalhista, poder responder "com
-- base em que?" para cada teste e requisito, nao enfeite.
--
-- DIVERGENCIAS JA CONFIRMADAS CONTRA A NORMA (vao falhar de proposito):
--   DESL-035/042  culpa reciproca — o sistema nao paga 50% do aviso nem os
--                 20% de FGTS que a Sumula 14 do TST e o art. 18, §2o da
--                 Lei 8.036/90 determinam. Hoje zera os dois.
--   DESL-062/064  fronteira do ASO — a NR-07, item 7.5.11, dispensa o exame
--                 quando o anterior foi feito "ha MENOS DE" 135 ou 90 dias.
--                 O sistema compara com <=, entao dispensa no limite exato,
--                 quando a norma exige o exame.
--   DESL-065      o prazo de 10 dias do item 7.5.11 para realizar o exame
--                 nao e controlado em lugar nenhum.
--   DESL-072/073/074  estabilidade de dirigente sindical, de membro da CIPA
--                 e de pre-aposentadoria por CCT nao sao verificadas.
--   DESL-091/092  o S-2299 e gerado de forma nao bloqueante (o desligamento
--                 persiste se o eSocial falhar) e o S-2399 nao existe.
--
-- NIVEL: 'api' onde a regra e (ou deveria ser) garantida pelo banco;
--        'e2e' onde o calculo vive no React e so o navegador exercita.
-- =========================================================

-- ─────────────────────────────────────────────────────────
-- 0) Fundamentacao legal como campo de primeira classe
-- ─────────────────────────────────────────────────────────
ALTER TABLE public.qa_casos_teste
  ADD COLUMN IF NOT EXISTS base_legal text;

COMMENT ON COLUMN public.qa_casos_teste.base_legal IS
  'Dispositivo que sustenta a regra: artigo de lei, item de NR, sumula, '
  'orientacao jurisprudencial, decreto ou instrucao normativa. Obrigatorio '
  'para todo caso de regra legal. Caso sem base legal declarada e regra de '
  'produto, e deve dizer isso explicitamente.';

-- ─────────────────────────────────────────────────────────
-- 1) Modulo proprio, filho de Colaboradores
-- ─────────────────────────────────────────────────────────
INSERT INTO public.qa_modulos (parent_id, label, path, prioridade_doc, status_doc)
SELECT m.id, 'Desligamento', 'estrutura-organizacional/colaboradores/desligamento', 1, 'em_andamento'
FROM public.qa_modulos m
WHERE m.path = 'estrutura-organizacional/colaboradores'
ON CONFLICT (path) DO NOTHING;

DO $doc$
DECLARE
  v_mod uuid;
  v_antes int; v_depois int;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos
  WHERE path = 'estrutura-organizacional/colaboradores/desligamento';

  IF v_mod IS NULL THEN
    RAISE EXCEPTION 'Modulo de desligamento nao foi criado.';
  END IF;

  SELECT count(*) INTO v_antes FROM public.qa_casos_teste WHERE modulo_id = v_mod;

  INSERT INTO public.qa_casos_teste
    (modulo_id, codigo, titulo, tipo, prioridade, status, nivel,
     base_legal, objetivo, pre_condicoes, passos, resultado_esperado, observacoes)
  VALUES

  -- ═══════════════════════════════════════════════════════
  -- A) ELEGIBILIDADE
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'DESL-001', 'Colaborador com contrato ativo pode ser desligado',
   'feliz', 'alta', 'aprovado', 'api',
   'CLT, art. 477 (extincao do contrato e obrigacao de quitacao das verbas)',
   'Caminho normal: contrato vigente, admissao concluida, sem desligamento anterior.',
   'Colaborador com admissao concluida e status ativo.',
   '[{"ordem":1,"acao":"Registrar desligamento com data, motivo e demais campos validos","resultado_esperado":"Aceito"},
     {"ordem":2,"acao":"Conferir o registro gravado","resultado_esperado":"Desligamento persistido e vinculado ao colaborador"},
     {"ordem":3,"acao":"Conferir o status do colaborador","resultado_esperado":"Atualizado para desligado"}]'::jsonb,
   'O desligamento e registrado e o colaborador deixa de constar como ativo.',
   'Caso base do modulo. Se ele falhar, os demais nao tem significado.'),

  (v_mod, 'DESL-002', 'Colaborador ja desligado nao pode ser desligado de novo',
   'negativo', 'critica', 'aprovado', 'api',
   'CLT, art. 477 c/c art. 442 — extinto o contrato, nao ha vinculo a extinguir. '
   'Duplicidade produziria dois eventos S-2299 para o mesmo vinculo.',
   'Impedir segundo evento rescisorio sobre um contrato ja extinto.',
   'Colaborador com desligamento ja registrado.',
   '[{"ordem":1,"acao":"Tentar registrar novo desligamento pela tela","resultado_esperado":"Bloqueado com mensagem de que ja existe desligamento"},
     {"ordem":2,"acao":"Tentar gravar o mesmo desligamento direto pela API","resultado_esperado":"Recusado pelo banco"},
     {"ordem":3,"acao":"Conferir o historico","resultado_esperado":"Somente o desligamento original permanece"}]'::jsonb,
   'A duplicidade e impedida nas duas rotas de entrada, nao so na tela.',
   'GAP CONHECIDO: hoje a checagem existe apenas no item de menu da tela de Colaboradores, e esta DUPLICADA em dois lugares do mesmo arquivo. Nao ha constraint no banco. O passo 2 deve falhar. Correcao sugerida: indice unico parcial sobre o vinculo com desligamento ativo.'),

  (v_mod, 'DESL-003', 'Contrato suspenso por beneficio previdenciario impede dispensa imotivada',
   'negativo', 'critica', 'aprovado', 'api',
   'CLT, art. 476 (licenca por auxilio-doenca conta como suspensao do contrato); '
   'CLT, art. 471; Sumula 371 do TST (efeitos do auxilio-doenca no aviso previo)',
   'Durante a suspensao o contrato existe mas suas obrigacoes estao paralisadas. '
   'Dispensa imotivada nesse periodo nao produz efeito.',
   'Colaborador com afastamento previdenciario ativo, sem retorno formal registrado.',
   '[{"ordem":1,"acao":"Tentar registrar dispensa sem justa causa","resultado_esperado":"Bloqueado, com indicacao da suspensao"},
     {"ordem":2,"acao":"Registrar o retorno formal ao trabalho","resultado_esperado":"Aceito"},
     {"ordem":3,"acao":"Repetir o desligamento","resultado_esperado":"Agora permitido"}]'::jsonb,
   'A dispensa so e possivel apos o retorno formal.',
   'Ha excecoes: falecimento e o termino de contrato por prazo determinado nao dependem de retorno. Justa causa durante suspensao e materia controversa — vale decisao juridica antes de liberar.'),

  (v_mod, 'DESL-004', 'Contrato com inicio futuro nao pode ser desligado',
   'negativo', 'alta', 'aprovado', 'api',
   'CLT, art. 442 e art. 443 — sem inicio da prestacao nao ha contrato de trabalho em curso.',
   'Impedir evento rescisorio sobre contrato que ainda nao comecou.',
   'Colaborador com data de admissao futura.',
   '[{"ordem":1,"acao":"Tentar registrar desligamento","resultado_esperado":"Bloqueado, informando que o contrato nao iniciou"},
     {"ordem":2,"acao":"Conferir persistencia","resultado_esperado":"Nada foi gravado e nenhuma integracao disparada"}]'::jsonb,
   'Contrato nao iniciado nao gera rescisao.',
   'Cenario real em admissao programada. O correto para desistencia antes do inicio e cancelamento da admissao, nao desligamento — sao eventos diferentes no eSocial.'),

  (v_mod, 'DESL-006', 'Desligamento nao atravessa a fronteira entre clientes',
   'negativo', 'critica', 'aprovado', 'api',
   'LGPD, Lei 13.709/2018, art. 46 e art. 47 (seguranca e prevencao de acesso indevido); '
   'regra de isolamento multi-tenant do produto.',
   'Nenhum usuario pode registrar desligamento de colaborador de outro tenant.',
   'Dois tenants, cada um com colaborador ativo.',
   '[{"ordem":1,"acao":"Autenticado no tenant A, tentar desligar colaborador do tenant B","resultado_esperado":"Recusado"},
     {"ordem":2,"acao":"Repetir a operacao direto pela API","resultado_esperado":"Continua recusado — a protecao nao pode depender da tela"},
     {"ordem":3,"acao":"Conferir se o desligamento gravou tenant_id coerente com o colaborador","resultado_esperado":"Coerente, sem cruzamento"}]'::jsonb,
   'O evento rescisorio respeita a fronteira do cliente na escrita.',
   'Escrito com base no gap identico encontrado em HIER-006, onde matriz_id atravessava tenant por ser FK sem validacao. Vale conferir se a gravacao do desligamento tem o mesmo problema. Dado de desligamento e dado pessoal sensivel — vazamento aqui e incidente de LGPD.'),

  -- ═══════════════════════════════════════════════════════
  -- B) DATA
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'DESL-010', 'Data de desligamento e obrigatoria',
   'negativo', 'alta', 'aprovado', 'e2e',
   'CLT, art. 477, §6o — o prazo de pagamento conta do TERMINO DO CONTRATO, '
   'que so existe se houver data.',
   'Sem data nao ha como apurar prazo legal, verbas nem evento do eSocial.',
   'Colaborador elegivel.',
   '[{"ordem":1,"acao":"Deixar a data em branco e tentar confirmar","resultado_esperado":"Bloqueado, campo validado como obrigatorio"}]'::jsonb,
   'A confirmacao exige data.',
   'Implementado: o botao fica desabilitado sem data.'),

  (v_mod, 'DESL-011', 'Data de desligamento nao pode ser anterior a admissao',
   'negativo', 'alta', 'aprovado', 'e2e',
   'CLT, art. 442 — nao ha extincao anterior a constituicao do vinculo.',
   'Impedir contrato com duracao negativa, que corromperia todo o calculo rescisorio.',
   'Colaborador com data de admissao conhecida.',
   '[{"ordem":1,"acao":"Informar data anterior a admissao","resultado_esperado":"Bloqueado com mensagem de inconsistencia"},
     {"ordem":2,"acao":"Conferir se algum calculo foi disparado","resultado_esperado":"Nenhum calculo nem integracao"}]'::jsonb,
   'Data incoerente e barrada antes de qualquer calculo.',
   'Implementado em RNDES02.'),

  (v_mod, 'DESL-012', 'Data futura e bloqueada fora do contexto de desligamento programado',
   'negativo', 'media', 'aprovado', 'e2e',
   'CLT, art. 477, §6o — o prazo de 10 dias corre do termino; data futura sem '
   'controle de efetivacao tornaria o prazo indeterminado.',
   'Evitar rescisao registrada como concluida antes de existir.',
   'Colaborador elegivel.',
   '[{"ordem":1,"acao":"Informar data posterior a hoje","resultado_esperado":"Bloqueado"},
     {"ordem":2,"acao":"Informar a data de hoje","resultado_esperado":"Aceito"}]'::jsonb,
   'Somente data ate hoje e aceita no fluxo comum.',
   'A mensagem atual diz "salvo desligamento programado", mas esse contexto nao existe no sistema — ver DESL-013.'),

  (v_mod, 'DESL-013', '[A CONSTRUIR] Desligamento programado com data futura',
   'alternativo', 'media', 'rascunho', 'api',
   'CLT, art. 487 (aviso previo trabalhado projeta o termino); '
   'Sumula 371 do TST (projecao do aviso previo)',
   'ESPECIFICACAO. O aviso previo trabalhado projeta legitimamente o termino do '
   'contrato para data futura. Falta definir o fluxo entre o registro e a efetivacao.',
   'Depende de decisao de produto sobre o ciclo de vida do registro programado.',
   '[{"ordem":1,"acao":"Registrar desligamento com data futura em contexto de aviso trabalhado","resultado_esperado":"Aceito, com status distinto de efetivado"},
     {"ordem":2,"acao":"Alcancada a data, verificar efetivacao","resultado_esperado":"Status muda e as integracoes disparam"},
     {"ordem":3,"acao":"Antes da data, tentar novo desligamento do mesmo colaborador","resultado_esperado":"Bloqueado — ja existe programado"}]'::jsonb,
   'Data futura e valida quando ha projecao de aviso, com efetivacao controlada.',
   'PERGUNTAS EM ABERTO para o time: o registro programado ja gera S-2299 ou espera a data? O colaborador aparece como ativo ou em aviso? Cancelar programado exige trilha de auditoria? Sem essas respostas o caso nao vira rotina.'),

  (v_mod, 'DESL-014', 'Prazo legal de pagamento das verbas e de 10 dias',
   'alternativo', 'alta', 'aprovado', 'e2e',
   'CLT, art. 477, §6o (redacao da Lei 13.467/2017) — pagamento em ate 10 dias '
   'contados do termino do contrato; §8o — multa em favor do empregado '
   'equivalente ao seu salario em caso de atraso',
   'O sistema precisa informar o prazo e a consequencia do descumprimento.',
   'Desligamento confirmado.',
   '[{"ordem":1,"acao":"Confirmar desligamento","resultado_esperado":"Alerta informando o prazo de 10 dias corridos a partir do termino"},
     {"ordem":2,"acao":"Conferir a data limite exibida","resultado_esperado":"Data do desligamento mais 10 dias corridos"}]'::jsonb,
   'O responsavel enxerga a data limite e a multa do §8o.',
   'Implementado como RNDES24. O passo 2 verifica se o calculo e em dias CORRIDOS, nao uteis — o §6o nao distingue, e a contagem corrida e a interpretacao consolidada.'),

  -- ═══════════════════════════════════════════════════════
  -- C) MOTIVO
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'DESL-020', 'Motivo do desligamento e obrigatorio',
   'negativo', 'critica', 'aprovado', 'e2e',
   'eSocial, evento S-2299, campo mtvDeslig (Tabela 19 do leiaute) — obrigatorio',
   'O motivo determina aviso, FGTS, seguro-desemprego e o codigo enviado ao eSocial.',
   'Colaborador elegivel.',
   '[{"ordem":1,"acao":"Tentar confirmar sem motivo","resultado_esperado":"Bloqueado"}]'::jsonb,
   'Sem motivo nao ha rescisao.',
   'Implementado.'),

  (v_mod, 'DESL-021', 'Motivos disponiveis cobrem as hipoteses legais de extincao',
   'alternativo', 'alta', 'aprovado', 'e2e',
   'CLT, arts. 477, 482 (justa causa), 483 (rescisao indireta), 484 (culpa reciproca), '
   '484-A (acordo mutuo), 479/480 (contrato a termo); Tabela 19 do eSocial',
   'Cada hipotese legal precisa existir na lista, sob pena de o usuario escolher '
   'motivo aproximado e distorcer o calculo e o evento enviado.',
   'Nenhuma.',
   '[{"ordem":1,"acao":"Abrir a lista de motivos","resultado_esperado":"Contem dispensa sem justa causa, dispensa com justa causa (art. 482), pedido de demissao, acordo mutuo (art. 484-A), termino de contrato, aposentadoria, falecimento, rescisao indireta (art. 483) e culpa reciproca (art. 484)"},
     {"ordem":2,"acao":"Conferir o mapeamento de cada motivo para o codigo da Tabela 19 do eSocial","resultado_esperado":"Cada motivo corresponde ao codigo correto"}]'::jsonb,
   'A lista cobre as hipoteses legais e mapeia corretamente para o eSocial.',
   'Os nove motivos ja existem. O passo 2 nunca foi verificado e e o que importa: motivo certo na tela com codigo errado no evento produz inconsistencia que so aparece no retorno do eSocial.'),

  (v_mod, 'DESL-022', 'Culpa reciproca depende de reconhecimento judicial',
   'excecao', 'alta', 'aprovado', 'e2e',
   'CLT, art. 484 — "havendo culpa reciproca... O TRIBUNAL DO TRABALHO reduzira a '
   'indenizacao"; Lei 8.036/1990, art. 18, §2o — "reconhecida pela Justica do Trabalho"',
   'A culpa reciproca nao e declaravel pelo empregador. Ambos os dispositivos '
   'atribuem o reconhecimento a Justica do Trabalho.',
   'Colaborador elegivel.',
   '[{"ordem":1,"acao":"Selecionar culpa reciproca","resultado_esperado":"O sistema exige referencia ao processo ou decisao que reconheceu a culpa reciproca"},
     {"ordem":2,"acao":"Confirmar sem essa referencia","resultado_esperado":"Bloqueado ou, no minimo, alertado de forma destacada"}]'::jsonb,
   'A escolha do motivo exige lastro na decisao judicial que o autoriza.',
   'GAP: hoje culpa reciproca e selecionavel como qualquer outro motivo, sem nenhuma exigencia de lastro. Como o reconhecimento e judicial e posterior, vale discutir com o juridico se o motivo deve estar na tela de desligamento comum ou apenas em retificacao pos-sentenca.'),

  -- ═══════════════════════════════════════════════════════
  -- D) AVISO PREVIO
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'DESL-030', 'Aviso previo proporcional: 30 dias mais 3 por ano, teto de 90',
   'feliz', 'critica', 'aprovado', 'e2e',
   'CLT, art. 487, I e II; Lei 12.506/2011, art. 1o e paragrafo unico — 30 dias '
   'acrescidos de 3 dias por ano de servico na mesma empresa, ate o maximo de 60 '
   'dias adicionais, totalizando 90 dias',
   'Calculo central da rescisao. Erro aqui contamina verba, prazo e evento.',
   'Dispensa sem justa causa.',
   '[{"ordem":1,"acao":"Colaborador com menos de 1 ano completo","resultado_esperado":"30 dias"},
     {"ordem":2,"acao":"Colaborador com 5 anos completos","resultado_esperado":"45 dias (30 + 15)"},
     {"ordem":3,"acao":"Colaborador com 10 anos completos","resultado_esperado":"60 dias"}]'::jsonb,
   'O calculo segue exatamente a formula da Lei 12.506/2011.',
   'Implementado: min(30 + anos*3, 90).'),

  (v_mod, 'DESL-031', 'Fronteiras exatas do aviso previo proporcional',
   'alternativo', 'critica', 'aprovado', 'e2e',
   'Lei 12.506/2011, art. 1o, paragrafo unico — a proporcionalidade conta ANOS '
   'COMPLETOS de servico; o teto e de 60 dias adicionais',
   'O erro de aviso previo mora na borda, nao no meio: um ano incompleto contado '
   'como completo gera 3 dias a mais de verba, e o teto mal aplicado gera muito mais.',
   'Dispensa sem justa causa.',
   '[{"ordem":1,"acao":"364 dias de casa","resultado_esperado":"30 dias — o ano nao se completou"},
     {"ordem":2,"acao":"Exatamente 1 ano","resultado_esperado":"33 dias"},
     {"ordem":3,"acao":"Exatamente 20 anos","resultado_esperado":"90 dias — o teto e alcancado exatamente aqui (30 + 60)"},
     {"ordem":4,"acao":"25 anos","resultado_esperado":"90 dias — permanece no teto"}]'::jsonb,
   'Cada virada acontece no ponto exato previsto em lei.',
   'Quatro fronteiras, nenhuma testada no documento original. O passo 3 e o mais relevante: 20 anos e o ponto onde os 60 dias adicionais se esgotam, e e o unico lugar onde formula e teto coincidem.'),

  (v_mod, 'DESL-032', 'Justa causa nao gera aviso previo',
   'negativo', 'critica', 'aprovado', 'e2e',
   'CLT, art. 487, caput — o aviso e devido quando NAO houver prazo estipulado e '
   'a parte quiser rescindir SEM JUSTO MOTIVO; CLT, art. 482 (hipoteses de justa causa)',
   'Havendo justo motivo, nao ha dever de pre-aviso.',
   'Motivo: dispensa com justa causa.',
   '[{"ordem":1,"acao":"Selecionar dispensa com justa causa","resultado_esperado":"Aviso marcado como nao aplicavel, 0 dias"},
     {"ordem":2,"acao":"Conferir as verbas","resultado_esperado":"Nenhuma verba de aviso e gerada"}]'::jsonb,
   'Justa causa afasta o aviso previo integralmente.',
   'Implementado.'),

  (v_mod, 'DESL-033', 'Contrato por prazo determinado nao gera aviso previo no termo final',
   'negativo', 'alta', 'aprovado', 'e2e',
   'CLT, art. 487, caput (aviso aplica-se a contrato SEM prazo estipulado); '
   'CLT, art. 481 (clausula assecuratoria de direito reciproco de rescisao antecipada)',
   'Chegando ao termo, o contrato se extingue por decurso, sem pre-aviso.',
   'Motivo: termino de contrato.',
   '[{"ordem":1,"acao":"Selecionar termino de contrato no termo final","resultado_esperado":"Aviso nao aplicavel"},
     {"ordem":2,"acao":"Cenario de rescisao ANTECIPADA de contrato a termo","resultado_esperado":"Regra distinta — arts. 479 e 480, indenizacao de metade da remuneracao do periodo restante"}]'::jsonb,
   'O termo final nao gera aviso; a antecipacao segue os arts. 479 e 480.',
   'O passo 2 aponta uma lacuna: o sistema tem um unico motivo "termino de contrato", que nao distingue termo final de rescisao antecipada. Sao regimes juridicos diferentes e verbas diferentes. Vale avaliar com o time se merece motivo proprio.'),

  (v_mod, 'DESL-034', 'Acordo mutuo: aviso previo indenizado pela metade',
   'alternativo', 'alta', 'aprovado', 'e2e',
   'CLT, art. 484-A, I, "a" (incluido pela Lei 13.467/2017) — sao devidos pela '
   'metade o aviso previo, se indenizado',
   'O acordo do art. 484-A tem regime proprio, com verbas reduzidas.',
   'Motivo: acordo mutuo.',
   '[{"ordem":1,"acao":"Colaborador com 5 anos, acordo mutuo","resultado_esperado":"Metade de 45, ou seja 23 dias (arredondamento para cima)"},
     {"ordem":2,"acao":"Colaborador com menos de 1 ano","resultado_esperado":"15 dias"},
     {"ordem":3,"acao":"Conferir se a reducao vale para aviso INDENIZADO","resultado_esperado":"A reducao do inciso I, a, refere-se ao aviso indenizado"}]'::jsonb,
   'O aviso e reduzido a metade conforme o art. 484-A, I, "a".',
   'O passo 1 fixa a regra de arredondamento: 45/2 = 22,5 e o sistema usa Math.ceil, resultando 23. A lei nao trata da fracao; adotar arredondamento a favor do empregado e a escolha conservadora e deve ficar registrada como decisao, nao como acidente.'),

  (v_mod, 'DESL-035', 'Culpa reciproca: aviso previo devido pela metade',
   'excecao', 'critica', 'aprovado', 'e2e',
   'Sumula 14 do TST — reconhecida a culpa reciproca (art. 484 da CLT), o empregado '
   'tem direito a 50% do valor do aviso previo, do decimo terceiro salario e das '
   'ferias proporcionais',
   'A culpa reciproca reduz as verbas pela metade, mas NAO as elimina.',
   'Motivo: culpa reciproca, com reconhecimento judicial.',
   '[{"ordem":1,"acao":"Colaborador com 5 anos, culpa reciproca","resultado_esperado":"Aviso devido pela metade — 23 dias, nao zero"},
     {"ordem":2,"acao":"Conferir 13o proporcional","resultado_esperado":"50% do valor"},
     {"ordem":3,"acao":"Conferir ferias proporcionais","resultado_esperado":"50% do valor"}]'::jsonb,
   'As tres verbas da Sumula 14 sao pagas pela metade.',
   'DIVERGENCIA CONFIRMADA: o sistema inclui culpa_reciproca na lista de motivos SEM aviso previo, gerando 0 dias. A Sumula 14 determina 50%. Este caso deve falhar e ser encaminhado para correcao. Observar que a Sumula alcanca tambem 13o e ferias proporcionais, que o sistema pode estar tratando de forma integral ou zerada — ambos errados.'),

  (v_mod, 'DESL-036', 'Aviso indenizado gera verba; aviso cumprido nao',
   'alternativo', 'alta', 'aprovado', 'e2e',
   'CLT, art. 487, §1o (falta de aviso pelo empregador da ao empregado direito aos '
   'salarios do periodo) e §2o (falta de aviso pelo empregado autoriza desconto)',
   'A verba indenizatoria substitui o periodo nao trabalhado. Cumprido o aviso, '
   'nao ha o que indenizar.',
   'Motivo com aviso aplicavel.',
   '[{"ordem":1,"acao":"Marcar aviso como trabalhado e cumprido","resultado_esperado":"Nenhuma verba indenizatoria de aviso"},
     {"ordem":2,"acao":"Marcar aviso como indenizado","resultado_esperado":"Verba correspondente aos dias calculados"},
     {"ordem":3,"acao":"Pedido de demissao sem cumprimento do aviso pelo empregado","resultado_esperado":"Desconto correspondente, conforme §2o"}]'::jsonb,
   'A verba acompanha o cumprimento, nos dois sentidos.',
   'O passo 3 e o menos coberto: o §2o autoriza DESCONTO quando quem falta com o aviso e o empregado. Vale conferir se o sistema trata esse sinal invertido.'),

  (v_mod, 'DESL-037', 'Aviso trabalhado assegura reducao de jornada',
   'alternativo', 'media', 'aprovado', 'e2e',
   'CLT, art. 488 — durante o aviso trabalhado, a jornada e reduzida em 2 horas '
   'diarias, sem prejuizo do salario; paragrafo unico — facultado ao empregado '
   'optar por faltar 7 dias corridos',
   'A reducao e direito indisponivel no aviso trabalhado e afeta a apuracao do ponto.',
   'Aviso previo do tipo trabalhado.',
   '[{"ordem":1,"acao":"Registrar aviso trabalhado","resultado_esperado":"O sistema sinaliza a reducao do art. 488 para o periodo"},
     {"ordem":2,"acao":"Conferir reflexo na apuracao do ponto no periodo do aviso","resultado_esperado":"As 2 horas diarias nao sao tratadas como falta ou atraso"}]'::jsonb,
   'O periodo de aviso trabalhado reflete a reducao legal na jornada.',
   'GAP PROVAVEL e de alto impacto: o modulo de ponto nao sabe que o colaborador esta em aviso previo trabalhado. Sem isso, a reducao do art. 488 vira atraso e pode gerar desconto indevido no ultimo mes. Vale investigar a integracao entre desligamento e apuracao.'),

  -- ═══════════════════════════════════════════════════════
  -- E) FGTS
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'DESL-040', 'Indenizacao de 40% do FGTS na dispensa sem justa causa',
   'feliz', 'critica', 'aprovado', 'e2e',
   'Lei 8.036/1990, art. 18, §1o — na despedida sem justa causa, deposito de '
   'importancia igual a 40% do montante dos depositos do FGTS, atualizados',
   'Verba de maior valor da rescisao sem justa causa.',
   'Motivo: dispensa sem justa causa.',
   '[{"ordem":1,"acao":"Selecionar dispensa sem justa causa","resultado_esperado":"Percentual 40% aplicado"},
     {"ordem":2,"acao":"Conferir a base de calculo","resultado_esperado":"Incide sobre o MONTANTE DOS DEPOSITOS atualizados, nao sobre o salario"}]'::jsonb,
   'A indenizacao de 40% e aplicada sobre a base correta.',
   'ATENCAO NO PASSO 2: o codigo calcula multaFgtsValor como salarioBase * percentual. O §1o define a base como o montante dos depositos do FGTS atualizado monetariamente, nao o salario. Se a implementacao usa salario, o valor esta errado em qualquer contrato com mais de um mes. Precisa confirmacao do time — pode ser simplificacao consciente para estimativa em tela, mas nao pode ir para a folha assim.'),

  (v_mod, 'DESL-041', 'Indenizacao de 20% do FGTS no acordo mutuo',
   'alternativo', 'alta', 'aprovado', 'e2e',
   'CLT, art. 484-A, I, "b" — devida pela metade a indenizacao sobre o saldo do '
   'FGTS prevista no §1o do art. 18 da Lei 8.036/1990',
   'O acordo reduz a indenizacao a metade dos 40%.',
   'Motivo: acordo mutuo.',
   '[{"ordem":1,"acao":"Selecionar acordo mutuo","resultado_esperado":"Percentual 20%"}]'::jsonb,
   'Metade da indenizacao do art. 18, §1o.',
   'Implementado.'),

  (v_mod, 'DESL-042', 'Indenizacao de 20% do FGTS na culpa reciproca',
   'excecao', 'critica', 'aprovado', 'e2e',
   'Lei 8.036/1990, art. 18, §2o — ocorrendo despedida por culpa reciproca ou '
   'forca maior, RECONHECIDA PELA JUSTICA DO TRABALHO, o percentual sera de 20%',
   'A culpa reciproca reduz a indenizacao pela metade, nao a elimina.',
   'Motivo: culpa reciproca reconhecida judicialmente.',
   '[{"ordem":1,"acao":"Selecionar culpa reciproca","resultado_esperado":"Percentual 20%"},
     {"ordem":2,"acao":"Conferir se ha exigencia de referencia ao reconhecimento judicial","resultado_esperado":"O §2o condiciona os 20% ao reconhecimento pela Justica do Trabalho"}]'::jsonb,
   'Culpa reciproca gera 20%, condicionada ao reconhecimento judicial.',
   'DIVERGENCIA CONFIRMADA: o sistema retorna 0% para culpa reciproca. O art. 18, §2o determina 20%. Deve falhar e ir para correcao, junto com DESL-035. O par culpa reciproca (aviso zerado + FGTS zerado) sugere que o motivo foi adicionado a lista sem que as regras dele fossem implementadas.'),

  (v_mod, 'DESL-043', 'Pedido de demissao e justa causa nao geram indenizacao de FGTS',
   'negativo', 'alta', 'aprovado', 'e2e',
   'Lei 8.036/1990, art. 18, §1o — a indenizacao e devida na despedida SEM JUSTA '
   'CAUSA; nao alcanca pedido de demissao nem dispensa por justa causa',
   'Evitar verba indevida.',
   'Nenhuma.',
   '[{"ordem":1,"acao":"Pedido de demissao","resultado_esperado":"0%"},
     {"ordem":2,"acao":"Dispensa com justa causa","resultado_esperado":"0%"}]'::jsonb,
   'Nenhuma indenizacao nessas hipoteses.',
   'Implementado.'),

  (v_mod, 'DESL-044', 'Rescisao indireta equipara-se a dispensa sem justa causa',
   'alternativo', 'alta', 'aprovado', 'e2e',
   'CLT, art. 483 — o empregado podera considerar rescindido o contrato e pleitear '
   'a devida indenizacao nas hipoteses das alineas "a" a "g"; equiparacao aos '
   'efeitos da dispensa imotivada',
   'A rescisao indireta produz os mesmos efeitos economicos da dispensa sem justa causa.',
   'Motivo: rescisao indireta.',
   '[{"ordem":1,"acao":"Selecionar rescisao indireta","resultado_esperado":"Indenizacao de FGTS em 40%"},
     {"ordem":2,"acao":"Conferir aviso previo","resultado_esperado":"Devido, com proporcionalidade da Lei 12.506/2011"},
     {"ordem":3,"acao":"Conferir seguro-desemprego","resultado_esperado":"Elegivel"}]'::jsonb,
   'Todos os efeitos economicos da dispensa imotivada.',
   'Implementado corretamente no sistema (40% e seguro elegivel). Caso de protecao: uma simplificacao futura que trate apenas "sem_justa_causa" quebraria a rescisao indireta em silencio.'),

  -- ═══════════════════════════════════════════════════════
  -- F) SEGURO-DESEMPREGO
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'DESL-050', 'Dispensa sem justa causa habilita o seguro-desemprego',
   'feliz', 'alta', 'aprovado', 'e2e',
   'Lei 7.998/1990, art. 2o, I e art. 3o — assistencia financeira temporaria ao '
   'trabalhador dispensado SEM JUSTA CAUSA',
   'A elegibilidade orienta o encaminhamento do trabalhador.',
   'Motivo: dispensa sem justa causa.',
   '[{"ordem":1,"acao":"Selecionar o motivo","resultado_esperado":"Marcado como elegivel"}]'::jsonb,
   'Elegibilidade sinalizada.',
   'Implementado. O sistema sinaliza elegibilidade ao PROGRAMA; o deferimento depende de requisitos de carencia do art. 3o que o sistema nao afere.'),

  (v_mod, 'DESL-051', 'Acordo mutuo NAO habilita o seguro-desemprego',
   'negativo', 'critica', 'aprovado', 'e2e',
   'CLT, art. 484-A, §2o — a extincao por acordo NAO AUTORIZA o ingresso no '
   'Programa de Seguro-Desemprego',
   'Vedacao expressa em lei. Sinalizar elegibilidade induziria o trabalhador a erro.',
   'Motivo: acordo mutuo.',
   '[{"ordem":1,"acao":"Selecionar acordo mutuo","resultado_esperado":"NAO elegivel"},
     {"ordem":2,"acao":"Conferir se ha aviso ao usuario sobre a vedacao","resultado_esperado":"Idealmente informado, citando o §2o"}]'::jsonb,
   'Nao elegivel, por vedacao expressa.',
   'Implementado. O passo 2 e melhoria: o acordo do art. 484-A e frequentemente proposto ao trabalhador sem que ele saiba que perde o seguro. Informar isso na tela e boa pratica de conformidade.'),

  (v_mod, 'DESL-052', 'Pedido de demissao e justa causa nao habilitam o seguro',
   'negativo', 'alta', 'aprovado', 'e2e',
   'Lei 7.998/1990, art. 2o, I — o beneficio destina-se ao dispensado sem justa causa',
   'Evitar indicacao indevida de beneficio.',
   'Nenhuma.',
   '[{"ordem":1,"acao":"Pedido de demissao","resultado_esperado":"Nao elegivel"},
     {"ordem":2,"acao":"Justa causa","resultado_esperado":"Nao elegivel"}]'::jsonb,
   'Nao elegivel em ambas.',
   'Implementado.'),

  (v_mod, 'DESL-055', 'Saque do FGTS conforme a hipotese legal do motivo',
   'alternativo', 'alta', 'aprovado', 'e2e',
   'Lei 8.036/1990, art. 20, I (despedida sem justa causa), I-A (extincao por '
   'acordo do art. 484-A, movimentacao limitada a 80%), IX (extincao normal do '
   'contrato a termo); CLT, art. 484-A, §1o',
   'A chave de conectividade so faz sentido quando ha hipotese de saque.',
   'Nenhuma.',
   '[{"ordem":1,"acao":"Dispensa sem justa causa","resultado_esperado":"Saque integral permitido; chave exigida"},
     {"ordem":2,"acao":"Acordo mutuo","resultado_esperado":"Movimentacao limitada a 80% do saldo, conforme art. 484-A, §1o"},
     {"ordem":3,"acao":"Pedido de demissao","resultado_esperado":"Sem hipotese de saque; chave nao exigida"}]'::jsonb,
   'A exigencia da chave acompanha a hipotese legal de movimentacao.',
   'O passo 2 e o mais provavel de estar faltando: o limite de 80% do §1o e especifico do acordo e raramente implementado. Vale conferir se o sistema apenas permite o saque ou tambem informa o limite.'),

  -- ═══════════════════════════════════════════════════════
  -- G) NR-07 — EXAME DEMISSIONAL
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'DESL-060', 'Sem exame ocupacional anterior, o demissional e obrigatorio',
   'feliz', 'critica', 'aprovado', 'e2e',
   'NR-07, item 7.5.11 (redacao da Portaria SEPRT 6.734/2020, vigente desde '
   '03/01/2022) — a dispensa do exame demissional pressupoe exame ocupacional '
   'recente; inexistindo, nao ha dispensa. CLT, art. 168, II',
   'Sem exame anterior nao ha o que dispensar.',
   'Colaborador sem nenhum ASO ocupacional registrado.',
   '[{"ordem":1,"acao":"Abrir o desligamento","resultado_esperado":"Alerta informando ausencia de ASO e obrigatoriedade do demissional"},
     {"ordem":2,"acao":"Tentar confirmar sem o exame","resultado_esperado":"Bloqueado"}]'::jsonb,
   'O exame demissional e exigido e a confirmacao fica bloqueada.',
   'Implementado como RNDES16.'),

  (v_mod, 'DESL-061', 'Grau de risco 1 ou 2: exame ha menos de 135 dias dispensa o demissional',
   'alternativo', 'alta', 'aprovado', 'e2e',
   'NR-07, item 7.5.11 — dispensa quando o exame clinico ocupacional mais recente '
   'foi realizado HA MENOS DE 135 dias, para organizacoes de graus de risco 1 e 2; '
   'grau conforme Quadro I da NR-04',
   'Evitar exame desnecessario dentro do prazo de validade da norma.',
   'Empresa de grau 1 ou 2, colaborador com ASO ha 100 dias.',
   '[{"ordem":1,"acao":"Abrir o desligamento","resultado_esperado":"Exame demissional dispensado"},
     {"ordem":2,"acao":"Confirmar sem novo exame","resultado_esperado":"Permitido"}]'::jsonb,
   'A dispensa e reconhecida dentro do prazo.',
   'Implementado: o sistema le o grau de risco da empresa e o ultimo atestado.'),

  (v_mod, 'DESL-062', 'Grau 1 ou 2: exatamente 135 dias NAO dispensa o demissional',
   'excecao', 'critica', 'aprovado', 'e2e',
   'NR-07, item 7.5.11 — a dispensa exige exame realizado "HA MENOS DE 135 dias". '
   '135 dias nao e menos de 135 dias: no limite exato, o exame e devido',
   'Fronteira exata da norma. E onde o erro de comparacao mora.',
   'Empresa de grau 1 ou 2, colaborador com ultimo ASO ha exatamente 135 dias.',
   '[{"ordem":1,"acao":"Abrir o desligamento","resultado_esperado":"Exame demissional OBRIGATORIO"},
     {"ordem":2,"acao":"Tentar confirmar sem novo exame","resultado_esperado":"Bloqueado"},
     {"ordem":3,"acao":"Testar 134 dias","resultado_esperado":"Dispensado — aqui sim esta dentro do prazo"}]'::jsonb,
   'A dispensa vale ate 134 dias; em 135 o exame volta a ser exigido.',
   'DIVERGENCIA CONFIRMADA: o sistema usa a comparacao dias <= limite, o que dispensa o exame em 135 dias exatos. A norma exige "ha menos de", ou seja, dias < limite. Deve falhar. Correcao: trocar <= por <. Erro de um dia, mas com consequencia de autuacao e de nulidade da dispensa do exame.'),

  (v_mod, 'DESL-063', 'Grau de risco 3 ou 4: exame ha menos de 90 dias dispensa o demissional',
   'alternativo', 'alta', 'aprovado', 'e2e',
   'NR-07, item 7.5.11 — dispensa quando o exame mais recente foi realizado HA '
   'MENOS DE 90 dias, para organizacoes de graus de risco 3 e 4; Quadro I da NR-04',
   'Atividades de maior risco tem prazo de validade menor.',
   'Empresa de grau 3 ou 4, colaborador com ASO ha 60 dias.',
   '[{"ordem":1,"acao":"Abrir o desligamento","resultado_esperado":"Dispensado"},
     {"ordem":2,"acao":"Conferir se o prazo aplicado foi 90 e nao 135","resultado_esperado":"90 dias, conforme o grau"}]'::jsonb,
   'O prazo menor e corretamente aplicado ao grau mais alto.',
   'O passo 2 protege contra a inversao dos prazos, erro que passaria despercebido em empresas de grau 1 e 2.'),

  (v_mod, 'DESL-064', 'Grau 3 ou 4: exatamente 90 dias NAO dispensa o demissional',
   'excecao', 'critica', 'aprovado', 'e2e',
   'NR-07, item 7.5.11 — dispensa apenas se realizado "HA MENOS DE 90 dias"',
   'Mesma fronteira do DESL-062, no prazo mais curto e no risco mais alto.',
   'Empresa de grau 3 ou 4, ultimo ASO ha exatamente 90 dias.',
   '[{"ordem":1,"acao":"Abrir o desligamento","resultado_esperado":"Exame OBRIGATORIO"},
     {"ordem":2,"acao":"Testar 89 dias","resultado_esperado":"Dispensado"}]'::jsonb,
   'A dispensa vale ate 89 dias; em 90 o exame e devido.',
   'DIVERGENCIA CONFIRMADA, mesma causa do DESL-062. Aqui e mais grave: grau 3 e 4 abrangem atividades de risco elevado, onde o exame demissional tem maior valor probatorio em eventual discussao de doenca ocupacional.'),

  (v_mod, 'DESL-065', 'Exame demissional deve ocorrer em ate 10 dias do termino do contrato',
   'alternativo', 'alta', 'aprovado', 'api',
   'NR-07, item 7.5.11 — no exame demissional, o exame clinico DEVE SER REALIZADO '
   'EM ATE 10 DIAS contados do termino do contrato',
   'A norma impoe prazo proprio ao exame, distinto do prazo de pagamento do art. 477.',
   'Desligamento com exame demissional obrigatorio.',
   '[{"ordem":1,"acao":"Confirmar desligamento com exame obrigatorio","resultado_esperado":"O sistema registra a data limite para o exame — termino mais 10 dias"},
     {"ordem":2,"acao":"Consultar desligamentos com exame pendente alem do prazo","resultado_esperado":"Aparecem como pendencia de conformidade"}]'::jsonb,
   'O prazo de 10 dias do item 7.5.11 e controlado e cobravel.',
   'GAP: o sistema nao controla esse prazo em lugar nenhum. Ele coincide numericamente com os 10 dias do art. 477, §6o da CLT, mas sao prazos DIFERENTES, de normas diferentes, com consequencias diferentes — um gera multa trabalhista ao empregado, o outro autuacao por descumprimento de NR. Tratar como o mesmo prazo seria erro conceitual.'),

  (v_mod, 'DESL-066', 'ASO exige identificacao completa do medico e do resultado',
   'excecao', 'critica', 'aprovado', 'e2e',
   'NR-07, item 7.5.19 (emissao do ASO para cada exame clinico ocupacional) e '
   'item 7.5.20 (conteudo minimo do ASO, incluindo identificacao do medico '
   'responsavel e sua inscricao no conselho de classe); CLT, art. 168, §5o',
   'ASO sem medico identificado, sem CRM e sem resultado nao e ASO — e um campo '
   'de data preenchido.',
   'Cenario com exame demissional obrigatorio.',
   '[{"ordem":1,"acao":"Preencher apenas a data do exame e confirmar","resultado_esperado":"BLOQUEADO — faltam resultado, medico e inscricao no conselho"},
     {"ordem":2,"acao":"Anexar somente o arquivo, sem os demais campos","resultado_esperado":"BLOQUEADO — o anexo nao substitui os dados estruturados"},
     {"ordem":3,"acao":"Preencher data, resultado, medico, inscricao e anexo","resultado_esperado":"Permitido"}]'::jsonb,
   'Somente o ASO completo libera a confirmacao.',
   'DIVERGENCIA CONFIRMADA: o sistema libera com "arquivo anexado OU data preenchida". E possivel confirmar desligamento informando apenas uma data, sem resultado, sem medico e sem CRM. Os passos 1 e 2 devem falhar. Este e o gap de maior risco de autuacao do modulo, porque produz aparencia de conformidade sem lastro. CONFIRMAR com o time a numeracao exata dos itens 7.5.19 e 7.5.20 contra o texto vigente da NR-07 antes de fechar a fundamentacao.'),

  (v_mod, 'DESL-067', 'Resultado do ASO limitado as conclusoes previstas na norma',
   'alternativo', 'media', 'aprovado', 'e2e',
   'NR-07 — o ASO registra a conclusao quanto a aptidao para a funcao: apto, '
   'inapto ou apto com restricoes',
   'Conclusao livre em texto impede tratamento automatizado e comparacao historica.',
   'Cenario com ASO obrigatorio.',
   '[{"ordem":1,"acao":"Abrir a lista de resultados","resultado_esperado":"Apenas apto, inapto e apto com restricoes"},
     {"ordem":2,"acao":"Selecionar inapto e confirmar","resultado_esperado":"Permitido, porem com alerta destacado"}]'::jsonb,
   'Apenas as tres conclusoes sao aceitas.',
   'PERGUNTA EM ABERTO do documento original, que mantenho: ASO demissional com resultado INAPTO pode indicar doenca ocupacional nao diagnosticada e, com ela, estabilidade do art. 118 da Lei 8.213/1991 (ver Sumula 378, II, do TST, que alcanca doenca profissional constatada apos a despedida). Hoje o sistema aceita inapto sem qualquer alerta. Decisao juridica necessaria: bloquear, alertar ou apenas registrar.'),

  -- ═══════════════════════════════════════════════════════
  -- H) ESTABILIDADES
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'DESL-070', 'Estabilidade da gestante bloqueia dispensa imotivada',
   'negativo', 'critica', 'aprovado', 'e2e',
   'ADCT, art. 10, II, "b" — vedada a dispensa arbitraria ou sem justa causa da '
   'empregada gestante, desde a confirmacao da gravidez ate 5 meses apos o parto; '
   'Sumula 244 do TST (III — aplica-se tambem ao contrato por prazo determinado)',
   'Garantia constitucional de emprego.',
   'Colaboradora com gravidez confirmada ou dentro de 5 meses do parto.',
   '[{"ordem":1,"acao":"Tentar dispensa sem justa causa","resultado_esperado":"Bloqueado, com indicacao da estabilidade e do dispositivo"},
     {"ordem":2,"acao":"Conferir contrato por prazo determinado","resultado_esperado":"Tambem protegido, conforme Sumula 244, III"}]'::jsonb,
   'A dispensa imotivada e impedida durante toda a estabilidade.',
   'PARCIALMENTE implementado, e por HEURISTICA: o sistema deduz a gravidez pela presenca de CID obstetrico em atestado. Isso erra nos dois sentidos — gestante sem atestado no sistema passa direto, e CID obstetrico de outra natureza gera falso positivo. Ver DESL-077.'),

  (v_mod, 'DESL-071', 'Estabilidade acidentaria de 12 meses bloqueia dispensa imotivada',
   'negativo', 'critica', 'aprovado', 'e2e',
   'Lei 8.213/1991, art. 118 — o segurado que sofreu acidente do trabalho tem '
   'garantida a manutencao do contrato por no minimo 12 meses apos a cessacao do '
   'auxilio-doenca acidentario; Sumula 378 do TST (II — requisitos; alcanca '
   'doenca profissional constatada apos a despedida)',
   'Garantia legal de emprego pos-acidente.',
   'Colaborador com afastamento acidentario encerrado ha menos de 12 meses.',
   '[{"ordem":1,"acao":"Tentar dispensa sem justa causa","resultado_esperado":"Bloqueado, citando o art. 118"},
     {"ordem":2,"acao":"Conferir a contagem","resultado_esperado":"12 meses contados da CESSACAO do auxilio-doenca acidentario, nao do acidente"},
     {"ordem":3,"acao":"Colaborador com afastamento comum, sem nexo","resultado_esperado":"Sem estabilidade do art. 118"}]'::jsonb,
   'A estabilidade e reconhecida e contada a partir do marco correto.',
   'Implementado, com dependencia do campo nexo_trabalho estar preenchido. O passo 3 e a contraprova: afastamento comum nao gera estabilidade, e tratar todo afastamento como acidentario travaria dispensas legitimas.'),

  (v_mod, 'DESL-072', 'Estabilidade de dirigente sindical bloqueia dispensa',
   'negativo', 'critica', 'aprovado', 'api',
   'CF/1988, art. 8o, VIII; CLT, art. 543, §3o — vedada a dispensa desde o '
   'registro da candidatura ate 1 ano apos o final do mandato, salvo falta grave '
   'APURADA EM INQUERITO JUDICIAL (CLT, arts. 494 e 853); Sumula 369 do TST',
   'Garantia constitucional que o sistema nao verifica.',
   'Colaborador registrado como dirigente sindical ou candidato.',
   '[{"ordem":1,"acao":"Registrar a condicao de dirigente sindical no cadastro","resultado_esperado":"O sistema precisa ter onde registrar isso"},
     {"ordem":2,"acao":"Tentar dispensa sem justa causa","resultado_esperado":"Bloqueado"},
     {"ordem":3,"acao":"Tentar dispensa por justa causa","resultado_esperado":"Bloqueado tambem — o art. 543, §3o exige inquerito judicial previo, nao basta a justa causa"}]'::jsonb,
   'O dirigente sindical so pode ser dispensado apos inquerito judicial.',
   'GAP TOTAL: nao existe campo para registrar a condicao de dirigente sindical, nem verificacao. O passo 1 sozinho ja demanda trabalho de cadastro. ATENCAO ao passo 3: o sistema hoje libera qualquer estabilidade quando o motivo e justa causa. Para dirigente sindical isso esta ERRADO — a CLT exige inquerito judicial previo. E a excecao da excecao.'),

  (v_mod, 'DESL-073', 'Estabilidade de membro da CIPA bloqueia dispensa arbitraria',
   'negativo', 'critica', 'aprovado', 'api',
   'ADCT, art. 10, II, "a" — vedada a dispensa arbitraria ou sem justa causa do '
   'empregado eleito para cargo de direcao de comissoes internas de prevencao de '
   'acidentes, desde o registro da candidatura ate 1 ano apos o final do mandato; '
   'Sumula 339 do TST (I — a garantia alcanca o SUPLENTE)',
   'Garantia constitucional que o sistema nao verifica, apesar de o proprio '
   'produto gerenciar mandato da CIPA no modulo de Empresa.',
   'Colaborador eleito titular ou suplente da CIPA, dentro do periodo protegido.',
   '[{"ordem":1,"acao":"Tentar dispensa sem justa causa de membro TITULAR","resultado_esperado":"Bloqueado"},
     {"ordem":2,"acao":"Repetir com membro SUPLENTE","resultado_esperado":"Bloqueado tambem, conforme Sumula 339, I"},
     {"ordem":3,"acao":"Colaborador cujo mandato terminou ha mais de 1 ano","resultado_esperado":"Sem estabilidade"}]'::jsonb,
   'Titulares e suplentes sao protegidos ate 1 ano apos o mandato.',
   'GAP TOTAL, e o mais facil de fechar: o modulo de Empresa JA controla mandato da CIPA (cipa_data_mandato_inicio e cipa_data_mandato_fim) e ja tem caso de renovacao. Falta apenas ligar a composicao nominal da comissao ao cadastro do colaborador. O passo 2 e o mais esquecido — a Sumula 339 estende a garantia ao suplente, e sistemas costumam proteger so o titular.'),

  (v_mod, 'DESL-074', '[A CONSTRUIR] Estabilidade pre-aposentadoria prevista em CCT',
   'negativo', 'alta', 'rascunho', 'api',
   'CLT, art. 611-A e art. 611-B (limites da negociacao coletiva) — a estabilidade '
   'pre-aposentadoria NAO tem previsao legal geral e decorre exclusivamente de '
   'convencao ou acordo coletivo',
   'ESPECIFICACAO. Diferente das demais estabilidades, esta nao vem da lei: cada '
   'CCT define periodo e condicoes. Sem cadastro de CCT nao ha como verificar.',
   'Depende de o produto passar a cadastrar clausulas de CCT por empresa.',
   '[{"ordem":1,"acao":"Cadastrar CCT com clausula de estabilidade pre-aposentadoria","resultado_esperado":"O sistema precisa ter onde registrar a clausula"},
     {"ordem":2,"acao":"Colaborador dentro do periodo previsto na clausula","resultado_esperado":"Dispensa bloqueada"},
     {"ordem":3,"acao":"Empresa sem clausula equivalente","resultado_esperado":"Sem bloqueio"}]'::jsonb,
   'A estabilidade e aplicada conforme a clausula vigente para aquela empresa.',
   'NAO E POSSIVEL FUNDAMENTAR EM LEI porque a regra e convencional. O caso fica em rascunho ate existir cadastro de CCT — o mesmo bloqueio que impede DESL-081. Vale avaliar se cadastro de CCT vira epico proprio: ele destrava estabilidade pre-aposentadoria, homologacao obrigatoria e possivelmente jornada.'),

  (v_mod, 'DESL-076', '[A CONSTRUIR] Justificativa especial para dispensa em estabilidade',
   'excecao', 'alta', 'rascunho', 'e2e',
   'ADCT, art. 10, II (a vedacao alcanca dispensa ARBITRARIA OU SEM JUSTA CAUSA — '
   'nao toda e qualquer extincao); CLT, art. 543, §3o (falta grave apurada em '
   'inquerito); CLT, art. 482',
   'ESPECIFICACAO. As garantias nao sao absolutas: ha hipoteses legitimas de '
   'extincao durante a estabilidade. Falta o campo e a trilha de auditoria.',
   'Depende de definicao de quem pode preencher e o que e exigido como lastro.',
   '[{"ordem":1,"acao":"Colaborador com estabilidade e motivo legitimo de extincao","resultado_esperado":"O sistema oferece campo de justificativa com fundamentacao"},
     {"ordem":2,"acao":"Confirmar sem justificativa","resultado_esperado":"Bloqueado"},
     {"ordem":3,"acao":"Confirmar com justificativa","resultado_esperado":"Permitido, com registro de autor, data e fundamento"}]'::jsonb,
   'Existe caminho auditavel de excecao, e ele exige lastro.',
   'Hoje o bloqueio por estabilidade e ABSOLUTO, com duas saidas fixas em codigo: justa causa e falecimento. Falecimento esta correto (nao e dispensa). Justa causa generica esta ERRADA para dirigente sindical, que exige inquerito judicial — ver DESL-072. PERGUNTAS: quem pode preencher a justificativa? Exige anexo? Gera notificacao a quem?'),

  (v_mod, 'DESL-077', 'Estabilidade nao detectada por dado ausente e falso negativo grave',
   'excecao', 'critica', 'aprovado', 'e2e',
   'ADCT, art. 10, II; Lei 8.213/1991, art. 118 — a garantia decorre da CONDICAO '
   'do trabalhador, nao do registro dela no sistema. A ausencia de dado nao afasta '
   'a estabilidade nem a responsabilidade do empregador',
   'Verificacao que depende de dado opcional produz falsa sensacao de seguranca: '
   'a tela diz "sem estabilidade" quando o correto seria "nao foi possivel verificar".',
   'Colaboradores com dados incompletos.',
   '[{"ordem":1,"acao":"Gestante sem atestado com CID obstetrico no sistema","resultado_esperado":"O sistema NAO pode afirmar ausencia de estabilidade — deve indicar verificacao inconclusiva"},
     {"ordem":2,"acao":"Afastamento acidentario com nexo_trabalho em branco","resultado_esperado":"Mesma indicacao de inconclusivo"},
     {"ordem":3,"acao":"Conferir a mensagem exibida","resultado_esperado":"Distingue estabilidade AUSENTE de estabilidade NAO VERIFICAVEL"}]'::jsonb,
   'O sistema distingue ausencia de estabilidade de impossibilidade de verificar.',
   'Este e o caso conceitualmente mais importante do bloco. Hoje a tela mostra "Possivel estabilidade gestante" quando encontra CID, e silencio quando nao encontra — e silencio e lido como liberacao. Num modulo onde o erro custa reintegracao judicial, silencio nao pode significar autorizacao.'),

  -- ═══════════════════════════════════════════════════════
  -- I) HOMOLOGACAO
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'DESL-080', 'Homologacao sindical nao e mais exigencia legal geral',
   'alternativo', 'media', 'aprovado', 'e2e',
   'Lei 13.467/2017 revogou o §1o do art. 477 da CLT, que exigia assistencia '
   'sindical na rescisao de contrato com mais de 1 ano',
   'Impedir que o sistema imponha exigencia revogada.',
   'Colaborador com mais de 1 ano de casa, empresa sem CCT que exija homologacao.',
   '[{"ordem":1,"acao":"Confirmar desligamento sem dados de homologacao","resultado_esperado":"Permitido — nao ha exigencia legal geral"},
     {"ordem":2,"acao":"Conferir se algum alerta sugere obrigatoriedade","resultado_esperado":"Se houver alerta, deve deixar claro que decorre de CCT, nao de lei"}]'::jsonb,
   'A ausencia de homologacao nao bloqueia quando nao ha clausula coletiva.',
   'O sistema exibe hoje "Homologacao pode ser necessaria conforme convencao coletiva" quando o colaborador tem mais de 1 ano. O gatilho de 1 ano e HERANCA do §1o revogado — o criterio deixou de existir em 2017. O alerta nao bloqueia, entao nao ha dano, mas o criterio nao tem mais fundamento e induz a erro.'),

  (v_mod, 'DESL-081', '[A CONSTRUIR] Homologacao obrigatoria por clausula coletiva',
   'alternativo', 'media', 'rascunho', 'api',
   'CLT, art. 611-A — a convencao e o acordo coletivo tem prevalencia sobre a lei '
   'nas materias que especifica, podendo instituir a exigencia de homologacao',
   'ESPECIFICACAO. A exigencia hoje so pode vir de CCT, e o sistema nao cadastra CCT.',
   'Depende do mesmo cadastro de CCT do DESL-074.',
   '[{"ordem":1,"acao":"Empresa com CCT que exige homologacao","resultado_esperado":"Campos de homologacao tornam-se obrigatorios"},
     {"ordem":2,"acao":"Tentar confirmar sem data de homologacao","resultado_esperado":"Bloqueado"},
     {"ordem":3,"acao":"Empresa sem a clausula","resultado_esperado":"Campos permanecem opcionais"}]'::jsonb,
   'A obrigatoriedade acompanha a clausula vigente, nao um prazo fixo.',
   'Bloqueado pela mesma dependencia do DESL-074: sem cadastro de CCT, a regra nao tem como ser avaliada.'),

  -- ═══════════════════════════════════════════════════════
  -- J) eSOCIAL
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'DESL-090', 'Desligamento de vinculo celetista gera evento S-2299',
   'feliz', 'critica', 'aprovado', 'api',
   'Manual de Orientacao do eSocial (MOS), evento S-2299 — Desligamento; '
   'Decreto 8.373/2014 (institui o eSocial)',
   'O evento e a obrigacao acessoria que formaliza a rescisao perante o Fisco, '
   'a Previdencia e o FGTS.',
   'Desligamento de colaborador com vinculo CLT.',
   '[{"ordem":1,"acao":"Confirmar desligamento","resultado_esperado":"Evento S-2299 gerado"},
     {"ordem":2,"acao":"Conferir o motivo enviado","resultado_esperado":"mtvDeslig coerente com o motivo escolhido, conforme Tabela 19"},
     {"ordem":3,"acao":"Conferir as verbas enviadas","resultado_esperado":"Coerentes com o calculado em tela"}]'::jsonb,
   'O evento e gerado com dados coerentes com o desligamento.',
   'Implementado como RNDES23.'),

  (v_mod, 'DESL-091', 'Desligamento nao pode persistir sem o evento correspondente',
   'excecao', 'critica', 'aprovado', 'api',
   'Decreto 8.373/2014 e MOS — a prestacao da informacao e obrigatoria; '
   'a omissao sujeita o empregador as penalidades da legislacao previdenciaria '
   'e trabalhista (CLT, art. 630, §4o e legislacao especifica)',
   'Desligamento registrado sem evento gera obrigacao acessoria omitida, e a '
   'omissao e invisivel se a falha for silenciosa.',
   'Ambiente onde a geracao do evento possa falhar.',
   '[{"ordem":1,"acao":"Forcar falha na geracao do S-2299 e confirmar o desligamento","resultado_esperado":"Ou a transacao inteira e revertida, ou o desligamento fica com status explicito de pendencia de eSocial"},
     {"ordem":2,"acao":"Consultar desligamentos sem evento correspondente","resultado_esperado":"Existe consulta ou painel que os revela"},
     {"ordem":3,"acao":"Conferir se o usuario foi avisado","resultado_esperado":"Aviso visivel, nao apenas log de console"}]'::jsonb,
   'Nenhum desligamento fica sem evento sem que alguem saiba.',
   'DIVERGENCIA CONFIRMADA E DE ALTO RISCO: a geracao do S-2299 esta dentro de um try com log de console marcado como "nao bloqueante". O desligamento persiste, o usuario ve mensagem de sucesso, e a obrigacao acessoria simplesmente nao acontece. Correcao sugerida: status de pendencia no registro mais rotina de reconciliacao, no espirito da reconciliar_pastas_todas_empresas() que ja existe no produto.'),

  (v_mod, 'DESL-092', 'Trabalhador sem vinculo empregaticio gera evento S-2399',
   'alternativo', 'alta', 'aprovado', 'api',
   'MOS, evento S-2399 — Trabalhador Sem Vinculo de Emprego/Estatutario (TSVE), '
   'Termino; aplicavel a diretor nao empregado, cooperado, estagiario, autonomo '
   'e demais categorias sem vinculo celetista',
   'Enviar S-2299 para quem nao e celetista, ou nao enviar nada, sao dois erros '
   'distintos na mesma obrigacao.',
   'Colaborador de categoria TSVE.',
   '[{"ordem":1,"acao":"Encerrar vinculo de trabalhador TSVE","resultado_esperado":"Evento S-2399 gerado"},
     {"ordem":2,"acao":"Conferir que NAO foi gerado S-2299","resultado_esperado":"O evento celetista nao se aplica"},
     {"ordem":3,"acao":"Conferir a decisao de qual evento usar","resultado_esperado":"Baseada na categoria do trabalhador, nao no motivo do desligamento"}]'::jsonb,
   'A categoria do trabalhador determina o evento.',
   'GAP TOTAL: S-2399 nao aparece em nenhum arquivo do repositorio. Antes de implementar, confirmar com o time se o produto atende categorias TSVE — se atender apenas CLT, o caso vira rascunho; se atender estagiarios ou autonomos, e lacuna de conformidade ativa.'),

  -- ═══════════════════════════════════════════════════════
  -- K) TRANSACIONAL
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'DESL-100', 'Confirmacao completa persiste, integra e atualiza o status',
   'feliz', 'critica', 'aprovado', 'api',
   'CLT, art. 477 (quitacao) c/c Decreto 8.373/2014 (eSocial)',
   'Caminho feliz completo, com todos os efeitos.',
   'Colaborador elegivel, dados validos.',
   '[{"ordem":1,"acao":"Confirmar desligamento valido","resultado_esperado":"Registro persistido"},
     {"ordem":2,"acao":"Conferir protocolo","resultado_esperado":"Gerado e apresentado"},
     {"ordem":3,"acao":"Conferir status do colaborador","resultado_esperado":"Desligado"},
     {"ordem":4,"acao":"Conferir integracoes","resultado_esperado":"Folha rescisoria e S-2299 disparados"}]'::jsonb,
   'Todos os efeitos ocorrem de forma consistente.',
   'Caso guarda-chuva. Falhando ele, investigar os especificos antes de concluir.'),

  (v_mod, 'DESL-101', 'Protocolo de desligamento e unico',
   'excecao', 'alta', 'aprovado', 'api',
   'Regra de produto (sem base legal) — rastreabilidade do evento rescisorio. '
   'Apoia a comprovacao exigida pelo art. 477 da CLT, mas o formato e escolha interna.',
   'Protocolo repetido impede rastrear qual tentativa gerou qual efeito.',
   'Colaborador elegivel.',
   '[{"ordem":1,"acao":"Gerar dois desligamentos no mesmo dia para colaboradores diferentes","resultado_esperado":"Protocolos distintos"},
     {"ordem":2,"acao":"Tentar duas confirmacoes para o MESMO colaborador no mesmo dia","resultado_esperado":"Protocolos distintos, ou a segunda barrada pelo DESL-002"},
     {"ordem":3,"acao":"Conferir unicidade no banco","resultado_esperado":"Existe restricao que impede repeticao"}]'::jsonb,
   'Cada evento rescisorio tem identificador proprio.',
   'GAP: o protocolo e DESL-{aaaammdd}-{8 primeiros caracteres do id da admissao}. E deterministico: mesma admissao no mesmo dia produz sempre o mesmo protocolo, e nao ha restricao de unicidade no banco. Note que este caso NAO tem base legal — a lei exige comprovacao, nao um formato. Registrado como regra de produto, para nao misturar as duas coisas.'),

  (v_mod, 'DESL-102', 'Clique duplo nao gera desligamento duplicado',
   'negativo', 'alta', 'aprovado', 'e2e',
   'CLT, art. 477 c/c MOS — evento duplicado no eSocial gera inconsistencia que '
   'exige retificacao ou exclusao formal',
   'Duplicidade transacional produz dois eventos para um unico fato.',
   'Colaborador elegivel, dados validos.',
   '[{"ordem":1,"acao":"Clicar duas vezes rapidamente em confirmar","resultado_esperado":"Uma unica transacao processada"},
     {"ordem":2,"acao":"Repetir com rede lenta","resultado_esperado":"Mesmo comportamento"},
     {"ordem":3,"acao":"Conferir eventos gerados","resultado_esperado":"Um desligamento, um protocolo, um S-2299"}]'::jsonb,
   'Um clique duplo produz um unico efeito.',
   'Parcialmente protegido: o botao e desabilitado enquanto submitting e verdadeiro. O passo 2 e o que realmente testa — sob latencia, a protecao de estado do React pode nao bastar. A garantia definitiva e a restricao de unicidade do DESL-002 no banco.'),

  (v_mod, 'DESL-104', 'Falha na confirmacao nao deixa anexo orfao no armazenamento',
   'excecao', 'media', 'aprovado', 'api',
   'LGPD, Lei 13.709/2018, art. 15 e art. 16 — termino do tratamento e eliminacao '
   'dos dados pessoais quando nao houver mais finalidade; documento medico e dado '
   'pessoal sensivel (art. 5o, II)',
   'O anexo do ASO sobe antes da confirmacao. Se a transacao falhar, o arquivo '
   'permanece sem registro que o justifique.',
   'Cenario com ASO obrigatorio e anexo.',
   '[{"ordem":1,"acao":"Anexar o ASO e forcar falha na confirmacao","resultado_esperado":"O arquivo e removido, ou fica rastreavel como pendente"},
     {"ordem":2,"acao":"Consultar anexos sem desligamento correspondente","resultado_esperado":"Nenhum, ou todos identificados"}]'::jsonb,
   'Nao restam documentos medicos sem vinculo no armazenamento.',
   'Mesma classe do vazamento de pastas fechado em 30/07/2026. Aqui e mais sensivel: ASO e documento medico, dado pessoal sensivel pela LGPD, e arquivo orfao nao tem quem responda por ele nem prazo de eliminacao definido.')

  ON CONFLICT (codigo) DO NOTHING;

  SELECT count(*) INTO v_depois FROM public.qa_casos_teste WHERE modulo_id = v_mod;
  RAISE NOTICE 'Modulo Desligamento: % casos antes, % depois (+%).',
    v_antes, v_depois, v_depois - v_antes;
END $doc$;

-- ─────────────────────────────────────────────────────────
-- 2) Conferencia: todo caso legal precisa declarar sua base
-- ─────────────────────────────────────────────────────────
DO $confere$
DECLARE v_sem_base text;
BEGIN
  SELECT string_agg(ct.codigo, ', ' ORDER BY ct.codigo) INTO v_sem_base
  FROM public.qa_casos_teste ct
  JOIN public.qa_modulos m ON m.id = ct.modulo_id
  WHERE m.path = 'estrutura-organizacional/colaboradores/desligamento'
    AND (ct.base_legal IS NULL OR btrim(ct.base_legal) = '');

  IF v_sem_base IS NULL THEN
    RAISE NOTICE 'OK: todo caso de desligamento declara sua fundamentacao.';
  ELSE
    RAISE WARNING 'Casos sem base legal declarada: %', v_sem_base;
  END IF;
END $confere$;

-- Retrato do modulo
SELECT ct.nivel, ct.status::text AS status, ct.prioridade::text AS prioridade, count(*) AS casos
FROM public.qa_casos_teste ct
JOIN public.qa_modulos m ON m.id = ct.modulo_id
WHERE m.path = 'estrutura-organizacional/colaboradores/desligamento'
GROUP BY ct.nivel, ct.status, ct.prioridade
ORDER BY ct.nivel, ct.status, ct.prioridade;

-- Divergencias conhecidas contra a norma, para encaminhar ao desenvolvimento
SELECT ct.codigo, ct.prioridade::text AS prioridade, ct.titulo, ct.base_legal
FROM public.qa_casos_teste ct
JOIN public.qa_modulos m ON m.id = ct.modulo_id
WHERE m.path = 'estrutura-organizacional/colaboradores/desligamento'
  AND ct.observacoes LIKE '%DIVERGENCIA CONFIRMADA%'
   OR (m.path = 'estrutura-organizacional/colaboradores/desligamento'
       AND ct.observacoes LIKE '%GAP TOTAL%')
ORDER BY ct.codigo;
