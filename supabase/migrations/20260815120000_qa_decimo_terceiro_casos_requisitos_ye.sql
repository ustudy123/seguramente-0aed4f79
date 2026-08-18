-- =========================================================
-- QA — 13º Salário: casos derivados da Análise de Requisitos do módulo
-- (documento YE-DP-13-001, Google Doc "YE — 13º Salário — Análise de
-- Requisitos", data-base ago/2026).
--
-- MÉTODO: as 10 regras de negócio (RN-001..010), os 9 critérios de
-- aceite (CA-001..009) e os 12 cenários de teste (seção 25) foram
-- cruzados com o que já existe no motor de QA. O 13º ainda NÃO tinha
-- família própria — a tela vive em Financeiro › 13º Salário
-- (DecimoTerceiroTab) e o cálculo em src/lib/folha/calculos.ts
-- (calcular13). Como sempre: os casos descrevem o que a LEI e o
-- documento exigem, não o que o sistema faz hoje.
--
-- JÁ COBERTO EM OUTRAS FAMÍLIAS (referência cruzada, sem duplicar):
--   Adiantamento da 1ª parcela nas férias ....... FERIAS-035 (lado Férias)
--   13º proporcional na culpa recíproca (50%) ... DESL-035 (Súmula 14)
--   13º proporcional na rescisão em geral ....... família DESL (verbas)
--
-- DIVERGÊNCIAS JÁ VISÍVEIS NO CÓDIGO (casos devem falhar e encaminhar):
--   - calcular13 recebe mesesTrabalhados DIGITADO na tela — não há
--     apuração automática de avos (fração ≥ 15 dias, faltas,
--     afastamentos): DEC13-001/002/003.
--   - Não há motor de prazos (30/11 e 20/12, antecipação por fim de
--     semana/feriado) nem alertas: DEC13-030/031.
--   - FGTS da 2ª parcela incide só sobre a diferença (correto por
--     competência), mas não há guia/competência registrada; INSS/IRRF
--     usam as tabelas de folha_tabelas_inss/irrf — vigência a conferir:
--     DEC13-040..042.
--   - Não há S-1200 anual / S-1210 nem provisão específica do 13º
--     conciliada mês a mês: DEC13-050/051.
--
-- ESTA MIGRATION SÓ DOCUMENTA (módulo novo + 17 casos). Rotinas
-- executáveis em leva futura, como nas famílias anteriores.
-- =========================================================

SET lock_timeout = '10s';

-- Módulo próprio, filho de Financeiro (a tela é uma aba de Financeiro)
INSERT INTO public.qa_modulos (parent_id, label, path, prioridade_doc, status_doc)
SELECT m.id, '13º Salário', 'financeiro/decimo-terceiro', 1, 'em_andamento'
FROM public.qa_modulos m
WHERE m.path = 'financeiro'
ON CONFLICT (path) DO NOTHING;

DO $doc$
DECLARE v_mod uuid; v_antes int; v_depois int;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos
  WHERE path = 'financeiro/decimo-terceiro';
  IF v_mod IS NULL THEN RAISE EXCEPTION 'Módulo financeiro/decimo-terceiro não encontrado.'; END IF;
  SELECT count(*) INTO v_antes FROM public.qa_casos_teste WHERE modulo_id = v_mod;

  INSERT INTO public.qa_casos_teste
    (modulo_id, codigo, titulo, tipo, prioridade, status, nivel,
     base_legal, objetivo, pre_condicoes, passos, resultado_esperado, observacoes)
  VALUES

  -- ══════════ A) APURAÇÃO DE AVOS ══════════

  (v_mod, 'DEC13-001', 'Avos apurados do vínculo: 1/12 por mês, fração de 15 dias conta',
   'feliz', 'alta', 'aprovado', 'e2e',
   'Lei 4.090/1962, art. 1º, §§1º e 2º',
   'O 13º é 1/12 da remuneração por mês de serviço do ano, e a fração igual ou superior a 15 dias conta como mês inteiro. Os avos devem sair da DATA DE ADMISSÃO do vínculo — não de um número digitado à mão. Admitido em 20 de maio: maio tem menos de 15 dias, não conta; junho a dezembro contam — 7 avos. Admitido em 10 de maio: maio conta — 8 avos.',
   'Vínculos fictícios admitidos em 10/05 e 20/05 do ano-base.',
   '[{"ordem":1,"acao":"Apurar o 13º do admitido em 10/05","resultado_esperado":"8 avos (maio conta — 22 dias trabalhados ≥ 15)"},
     {"ordem":2,"acao":"Apurar o 13º do admitido em 20/05","resultado_esperado":"7 avos (maio com menos de 15 dias não conta)"},
     {"ordem":3,"acao":"Conferir a origem do número de meses","resultado_esperado":"Calculado da data de admissão, não digitado livremente pelo operador"}]'::jsonb,
   'Avos nascem do vínculo e da regra dos 15 dias — nunca de digitação.',
   'Requisitos YE-DP-13-001: RN-001 / CA-001 / cenário "Admissão no ano" (seção 25). DIVERGÊNCIA VISÍVEL: calcular13 recebe mesesTrabalhados informado na tela (DecimoTerceiroTab) — sem apuração automática. Deve falhar e encaminhar.'),

  (v_mod, 'DEC13-002', 'Faltas injustificadas derrubam o avo do mês que fica com menos de 15 dias',
   'negativo', 'alta', 'aprovado', 'e2e',
   'Lei 4.090/1962, art. 1º, §1º (mês de serviço); tratamento consolidado das faltas injustificadas',
   'Mês em que as faltas INJUSTIFICADAS reduzem o trabalho para menos de 15 dias não gera avo. Faltas justificadas e afastamentos legais não entram nessa conta. A fonte é o Ponto — as ocorrências do módulo de jornada precisam refletir na apuração, senão o 13º sai maior do que o devido.',
   'Vínculo com 16 faltas injustificadas registradas no Ponto em um mesmo mês do ano-base.',
   '[{"ordem":1,"acao":"Apurar os avos do vínculo","resultado_esperado":"O mês com 16 faltas injustificadas NÃO conta como avo"},
     {"ordem":2,"acao":"Repetir com faltas justificadas (atestado)","resultado_esperado":"O mês conta normalmente — justificada não derruba avo"}]'::jsonb,
   'Injustificada demais no mês, avo a menos; justificada não mexe.',
   'Requisitos YE-DP-13-001: RN-001 / fluxo "Faltas injustificadas" (seção 9). Integração com Ponto/Afastamentos (seção 17).'),

  (v_mod, 'DEC13-003', 'Afastamentos: maternidade integra, auxílio-doença divide com o INSS',
   'alternativo', 'alta', 'aprovado', 'e2e',
   'Lei 8.213/1991 (abono anual, art. 120 do Decreto 3.048/1999); salário-maternidade integra a apuração patronal',
   'Afastamentos não são todos iguais: na licença-maternidade o período INTEGRA a apuração do empregador; no auxílio-doença, o empregador paga os avos trabalhados e o INSS paga o abono anual proporcional ao benefício. O sistema deve tratar cada tipo pelo seu efeito e marcar o caso para validação contábil — não apagar nem contar tudo igual.',
   'Vínculos fictícios com licença-maternidade (4 meses) e auxílio-doença (5 meses) no ano-base.',
   '[{"ordem":1,"acao":"Apurar o 13º da colaboradora em licença-maternidade","resultado_esperado":"Período da licença conta na apuração patronal"},
     {"ordem":2,"acao":"Apurar o 13º do afastado por auxílio-doença","resultado_esperado":"Avos patronais só dos meses trabalhados; período do benefício sinalizado como abono anual do INSS"},
     {"ordem":3,"acao":"Conferir a marcação do caso","resultado_esperado":"Apuração marcada para validação contábil, com o tipo de afastamento visível"}]'::jsonb,
   'Cada afastamento com seu efeito — e contabilidade avisada.',
   'Requisitos YE-DP-13-001: RN-008 / CA (seção 24) / cenário "Afastamento" (seção 25). Classificação [OLC]/[VAL] — a divisão exata patronal×INSS é ponto de validação (seção 30). Integra com jornada-rotina/afastamentos.'),

  -- ══════════ B) BASE DE CÁLCULO E MÉDIAS ══════════

  (v_mod, 'DEC13-020', 'Base do 13º inclui as médias das variáveis do ano',
   'feliz', 'alta', 'aprovado', 'e2e',
   'Decreto 57.155/1965, art. 2º; Súmulas 45, 148 e 253 do TST',
   'Quem recebe horas extras habituais, adicional noturno ou comissões não tem 13º só do salário fixo: as variáveis do ano entram na base pela média, conforme a parametrização de rubricas. Base composta apenas do fixo, para quem tem variável habitual, é diferença certa em reclamação.',
   'Vínculo com salário fixo e horas extras habituais lançadas na folha ao longo do ano-base.',
   '[{"ordem":1,"acao":"Calcular o 13º do vínculo com variáveis","resultado_esperado":"Base = salário + média das variáveis, com memória de cálculo mostrando a composição"},
     {"ordem":2,"acao":"Conferir as rubricas que integraram","resultado_esperado":"Somente rubricas parametrizadas como integrantes da base do 13º"}]'::jsonb,
   'Variável habitual entra pela média — e a memória mostra o caminho.',
   'Requisitos YE-DP-13-001: RN-002 / CA-002. Composição exata da base é [VAL]/[DAE] por cliente (seção 30); o que se testa é que a média EXISTE e é parametrizável (folha_rubricas).'),

  (v_mod, 'DEC13-021', 'Base de médias incompleta trava com alerta antes do fechamento',
   'excecao', 'media', 'aprovado', 'api',
   'Documento YE-DP-13-001, RF-006 e seção 14 (alerta "Base de médias incompleta")',
   'Fechar o 13º com rubricas variáveis do ano faltando é pagar errado com hora marcada. Antes do fechamento, o sistema confere se as competências do ano têm as variáveis lançadas; faltando, alerta o DP e aponta o que completar — o fechamento com pendência exige decisão consciente, não passa em silêncio.',
   'Ano-base com competências sem lançamento de rubricas variáveis para vínculo que as recebe habitualmente.',
   '[{"ordem":1,"acao":"Preparar o fechamento do 13º","resultado_esperado":"Alerta de base incompleta com as competências/rubricas faltantes"},
     {"ordem":2,"acao":"Completar os lançamentos e reprocessar","resultado_esperado":"Alerta encerrado; médias recalculadas"}]'::jsonb,
   'Média só fecha com o ano inteiro na mesa.',
   'Requisitos YE-DP-13-001: seção 14 / cenário "Dado ausente" (seção 25) / IA "Detecção de médias incompletas" (seção 18).'),

  -- ══════════ C) PARCELAS E PRAZOS ══════════

  (v_mod, 'DEC13-030', '1ª parcela: 50%, paga entre 1º de fevereiro e 30 de novembro',
   'feliz', 'critica', 'aprovado', 'api',
   'Lei 4.749/1965, art. 2º',
   'O adiantamento é METADE da remuneração do mês anterior, pago entre 1º/02 e 30/11. O sistema agenda a data-alvo, alerta na aproximação (D-30/15/7) e acusa o atraso — 1ª parcela paga em dezembro é infração, ainda que o valor esteja certo. FGTS incide sobre o adiantamento na competência do pagamento.',
   'Ano-base com vínculos ativos e calendário carregado.',
   '[{"ordem":1,"acao":"Programar a 1ª parcela dentro do prazo","resultado_esperado":"50% da base, agendada até 30/11, com FGTS da competência"},
     {"ordem":2,"acao":"Aproximar-se de 30/11 sem pagamento","resultado_esperado":"Alertas D-30/15/7 para DP/RH/Financeiro, com ação no Plano de Ação"},
     {"ordem":3,"acao":"Simular data de pagamento em dezembro","resultado_esperado":"Acusado como fora do prazo legal — não passa como regular"}]'::jsonb,
   'Metade do valor, dentro da janela legal, com o prazo vigiado.',
   'Requisitos YE-DP-13-001: RN-003 / CA-003 / alerta "1ª parcela a vencer" (seção 14). DIVERGÊNCIA VISÍVEL: não há motor de prazos nem alertas do 13º hoje. Deve falhar e encaminhar.'),

  (v_mod, 'DEC13-031', '2ª parcela até 20 de dezembro, antecipando em fim de semana ou feriado',
   'feliz', 'critica', 'aprovado', 'api',
   'Lei 4.749/1965, art. 1º; regra de antecipação por dia não útil',
   'A 2ª parcela vence em 20/12 — e quando o dia 20 cai em sábado, domingo ou feriado, paga-se ANTES, não depois. O motor de datas precisa conhecer o calendário (tabela de feriados) e mover a data-alvo para o dia útil anterior, refletindo isso nos alertas (D-15/7/3).',
   'Ano em que 20/12 cai em fim de semana; tabela de feriados carregada.',
   '[{"ordem":1,"acao":"Consultar a data-alvo da 2ª parcela nesse ano","resultado_esperado":"Antecipada para o último dia útil antes de 20/12"},
     {"ordem":2,"acao":"Conferir os alertas","resultado_esperado":"D-15/7/3 contados sobre a data antecipada, prioridade crítica"}]'::jsonb,
   'O prazo corre para trás no calendário, nunca para frente.',
   'Requisitos YE-DP-13-001: RN-004 / CA-004 / cenário "Prazo vencido" (seção 25) / RNF-003. Usa a tabela feriados já existente no projeto.'),

  (v_mod, 'DEC13-032', 'Adiantamento nas férias: requerido em janeiro, pago no gozo, baixado na apuração',
   'alternativo', 'media', 'aprovado', 'e2e',
   'Lei 4.749/1965, art. 2º, §2º',
   'Quem requer em janeiro recebe a 1ª parcela junto das férias. O lado Férias já tem caso (FERIAS-035); aqui se testa o lado 13º: a opção registrada muda a data do adiantamento para o gozo, o valor pago nas férias aparece na apuração anual como adiantamento JÁ FEITO e a 2ª parcela deduz exatamente esse valor — sem pagar de novo em novembro.',
   'Vínculo com adiantar_13 = true requerido em janeiro e férias gozadas em julho, com a 1ª parcela paga junto.',
   '[{"ordem":1,"acao":"Consultar a apuração do 13º do vínculo","resultado_esperado":"Adiantamento marcado como pago nas férias, com valor e data"},
     {"ordem":2,"acao":"Programar a rodada geral de novembro","resultado_esperado":"Vínculo fora da rodada da 1ª parcela — já recebeu"},
     {"ordem":3,"acao":"Calcular a 2ª parcela","resultado_esperado":"Deduzido o valor pago nas férias, não os 50% teóricos"}]'::jsonb,
   'Pagou nas férias, baixou na apuração, deduziu na 2ª — uma vez só.',
   'Requisitos YE-DP-13-001: RN-003 / CA-003 / cenário "Adiantamento nas férias" (seção 9). Par do FERIAS-035 (lado Férias). Política de adiantamento é [DAE] (seção 30).'),

  (v_mod, 'DEC13-033', '2ª parcela deduz o adiantamento e diferenças posteriores geram complemento',
   'alternativo', 'alta', 'aprovado', 'e2e',
   'Lei 4.749/1965, arts. 1º e 2º; Decreto 57.155/1965 (recálculo com variáveis do ano)',
   'A 2ª parcela é o total anual MENOS o adiantamento efetivamente pago. E o ano não acaba em 20/12: variável lançada depois (comissão de dezembro, HE do fim do ano) gera DIFERENÇA a apurar como complemento, com trilha própria e reflexo no eSocial — não se reabre o valor pago fingindo que nada mudou.',
   '1ª parcela paga; variável nova lançada após o pagamento da 2ª.',
   '[{"ordem":1,"acao":"Calcular a 2ª parcela","resultado_esperado":"Total anual menos o adiantamento real, com memória de cálculo"},
     {"ordem":2,"acao":"Lançar variável retroativa do ano","resultado_esperado":"Diferença detectada e alerta a DP/Contador"},
     {"ordem":3,"acao":"Apurar o complemento","resultado_esperado":"Complemento com trilha vinculada à apuração original e reflexo no eSocial"}]'::jsonb,
   'Deduz o que foi pago; o que chegar depois vira complemento rastreado.',
   'Requisitos YE-DP-13-001: CA-005 / RF-006 / cenário "Diferença" (seção 25) / alerta "Diferença após a 2ª parcela" (seção 14).'),

  -- ══════════ D) ENCARGOS ══════════

  (v_mod, 'DEC13-040', 'INSS do 13º: só na 2ª parcela, calculado em separado da folha do mês',
   'feliz', 'critica', 'aprovado', 'e2e',
   'Lei 8.212/1991; Decreto 3.048/1999, art. 214, §6º (cálculo em separado); retenção na quitação da 2ª parcela',
   'O INSS incide sobre o 13º INTEIRO, mas só é retido na 2ª parcela — e a base do 13º é tributada SEPARADA da remuneração de dezembro, cada uma com sua progressão de faixas. Somar as duas bases numa conta só infla a alíquota e desconta INSS a mais do colaborador.',
   'Vínculo com salário que, somado ao 13º, mudaria de faixa se as bases fossem somadas.',
   '[{"ordem":1,"acao":"Calcular a 1ª parcela","resultado_esperado":"Nenhum INSS retido no adiantamento"},
     {"ordem":2,"acao":"Calcular a 2ª parcela","resultado_esperado":"INSS sobre o 13º integral, com progressão de faixas própria, separada da folha de dezembro"},
     {"ordem":3,"acao":"Conferir a tabela aplicada","resultado_esperado":"Tabela de INSS vigente na competência (tabela versionada), não fixa em código"}]'::jsonb,
   'Base do 13º anda sozinha na tabela — e só paga na 2ª.',
   'Requisitos YE-DP-13-001: RN-005 / CA-004. Usa folha_tabelas_inss (versionada — RNF-002). Tabelas vigentes são [VAL] (seção 30).'),

  (v_mod, 'DEC13-041', 'IRRF do 13º: tributação exclusiva na fonte, apurada na 2ª parcela',
   'feliz', 'critica', 'aprovado', 'e2e',
   'RIR/2018 (Decreto 9.580/2018), art. 700 — tributação exclusiva na fonte do 13º salário',
   'O IRRF do 13º é EXCLUSIVO na fonte: apurado sobre o valor integral na quitação da 2ª parcela, com as deduções legais (dependentes, INSS do próprio 13º), e NÃO se soma aos rendimentos do mês para reajustar a tabela. Misturar o 13º com o salário de dezembro no IRRF é erro clássico que muda o imposto dos dois.',
   'Vínculo com dependentes cadastrados e 13º na faixa tributável.',
   '[{"ordem":1,"acao":"Calcular a 1ª parcela","resultado_esperado":"Nenhum IRRF no adiantamento"},
     {"ordem":2,"acao":"Calcular a 2ª parcela","resultado_esperado":"IRRF sobre o 13º integral, deduzindo INSS do 13º e dependentes, separado do IRRF do salário"},
     {"ordem":3,"acao":"Conferir o caráter exclusivo","resultado_esperado":"Valor não compensável/somável com a tributação mensal; tabela vigente versionada"}]'::jsonb,
   'Imposto do 13º nasce e morre na 2ª parcela, sem contaminar o mês.',
   'Requisitos YE-DP-13-001: RN-007 / CA-004. Usa folha_tabelas_irrf (versionada). Tabela anual e deduções são [VAL] (seção 30).'),

  (v_mod, 'DEC13-042', 'FGTS de 8% nas duas parcelas, cada uma na sua competência',
   'feliz', 'alta', 'aprovado', 'e2e',
   'Lei 8.036/1990, art. 15 (a remuneração inclui a gratificação de Natal)',
   'O FGTS incide sobre AMBAS as parcelas — 8% sobre o adiantamento na competência em que foi pago e 8% sobre o restante na competência da 2ª parcela. Depositar tudo em dezembro, ou esquecer o depósito do adiantamento, deixa diferença de FGTS que o FGTS Digital denuncia.',
   '1ª parcela paga em novembro; 2ª em dezembro.',
   '[{"ordem":1,"acao":"Conferir o FGTS da 1ª parcela","resultado_esperado":"8% sobre os 50% pagos, na competência de novembro"},
     {"ordem":2,"acao":"Conferir o FGTS da 2ª parcela","resultado_esperado":"8% sobre a diferença (total menos adiantamento), na competência de dezembro"},
     {"ordem":3,"acao":"Somar as duas competências","resultado_esperado":"8% exatos sobre o 13º integral — sem falta nem duplicidade"}]'::jsonb,
   'Oito por cento no total, repartidos pela competência de cada parcela.',
   'Requisitos YE-DP-13-001: RN-006 / CA-004. calcular13 já reparte a base (1ª: metade; 2ª: diferença) — o que falta conferir é o registro por competência para a guia. Alíquota parametrizada por vínculo (aprendiz 2%).'),

  -- ══════════ E) RESCISÃO NO ANO ══════════

  (v_mod, 'DEC13-060', 'Rescisão no ano-base: 13º proporcional pago, justa causa perde, adiantamento concilia',
   'alternativo', 'alta', 'aprovado', 'e2e',
   'Lei 4.090/1962, art. 3º; CLT, art. 477; justa causa afasta a gratificação proporcional',
   'Desligado no meio do ano, o colaborador leva o 13º proporcional aos avos trabalhados (indenizado na rescisão); na dispensa POR JUSTA CAUSA, perde a proporcional. E se a 1ª parcela já tinha sido paga (inclusive nas férias), o valor adiantado é conciliado nas verbas — na justa causa, o adiantado a maior vira desconto conforme a regra.',
   'Vínculos fictícios desligados em agosto: um sem justa causa (com adiantamento pago), outro por justa causa.',
   '[{"ordem":1,"acao":"Processar a rescisão sem justa causa","resultado_esperado":"13º proporcional (8/12) nas verbas, deduzido o adiantamento pago"},
     {"ordem":2,"acao":"Processar a rescisão por justa causa","resultado_esperado":"13º proporcional zerado, com a base legal citada"},
     {"ordem":3,"acao":"Conferir a conciliação na apuração anual","resultado_esperado":"Vínculo desligado fora da rodada de novembro/dezembro — quitado na rescisão"}]'::jsonb,
   'Proporcional na rescisão, nada na justa causa, adiantamento nunca em dobro.',
   'Requisitos YE-DP-13-001: RN-009 / CA-006 / cenário "Rescisão" (seção 25). A família DESL cobre as verbas em geral (culpa recíproca 50% = DESL-035); aqui se testa a CONCILIAÇÃO com o módulo do 13º.'),

  -- ══════════ F) eSOCIAL E PROVISÃO ══════════

  (v_mod, 'DEC13-050', 'eSocial do 13º: S-1200 da folha anual e S-1210 dos pagamentos, sem duplicar',
   'excecao', 'alta', 'aprovado', 'api',
   'eSocial — S-1200 (apuração anual do 13º) e S-1210 (pagamentos); regras de retificação',
   'O 13º tem folha PRÓPRIA no eSocial: apuração anual via S-1200 e pagamentos das parcelas via S-1210, no leiaute vigente. Rejeição volta traduzida (o que houve, onde corrigir) e o reenvio retifica — nunca cria segundo evento da mesma competência anual. Sem esses eventos, o 13º pago não existe para o governo.',
   'Apuração e pagamentos do 13º concluídos no ambiente de teste.',
   '[{"ordem":1,"acao":"Fechar a apuração anual","resultado_esperado":"S-1200 anual gerado no leiaute vigente"},
     {"ordem":2,"acao":"Registrar os pagamentos das parcelas","resultado_esperado":"S-1210 correspondente, valores conciliados com as parcelas"},
     {"ordem":3,"acao":"Simular rejeição e reenviar","resultado_esperado":"Retorno traduzido, ação sugerida, reenvio como retificação — sem evento duplicado"}]'::jsonb,
   'Folha anual declarada, pagamentos casados, rejeição virando retificação.',
   'Requisitos YE-DP-13-001: RN-010 / CA-007 / cenário "Com erro" (seção 25). DIVERGÊNCIA VISÍVEL: não há geração de S-1200/S-1210 hoje. Deve falhar e encaminhar. Mesma disciplina de ADM-093 e FERIAS-081.'),

  (v_mod, 'DEC13-051', 'Provisão do 13º atualizada a cada competência e conciliável com a folha',
   'feliz', 'media', 'aprovado', 'api',
   'Documento YE-DP-13-001, CA-009 e RNF-007; regime de competência contábil',
   'O custo do 13º nasce mês a mês (1/12 + encargos por competência), não em dezembro. A provisão acompanha cada fato gerador — admissões, desligamentos e reajustes mexem nela — e o contador consegue conciliar o saldo provisionado com o efetivamente pago no fim do ano, com relatório exportável.',
   'Ano-base com admissões e um desligamento no meio do ano.',
   '[{"ordem":1,"acao":"Conferir a provisão após cada competência","resultado_esperado":"Saldo cresce 1/12 + encargos por vínculo ativo; ajusta em admissão/desligamento"},
     {"ordem":2,"acao":"Pagar as parcelas","resultado_esperado":"Provisão baixada contra os pagamentos"},
     {"ordem":3,"acao":"Exportar o relatório de provisão","resultado_esperado":"Saldo conciliável com a folha e com o pago, por estabelecimento"}]'::jsonb,
   'Provisão viva o ano inteiro — dezembro só confirma o que já estava contado.',
   'Requisitos YE-DP-13-001: CA-009 / seção 20 / alerta "Provisão desatualizada" (seção 14). Existe folha_provisoes genérica; o vínculo específico com o 13º é o que se testa. Regras de conciliação são [DAE]/[VAL] (seção 30).'),

  -- ══════════ G) FLUXO, REABERTURA E ACESSO ══════════

  (v_mod, 'DEC13-070', 'Cálculo fechado do 13º só reabre com dupla aprovação e diferença rastreada',
   'excecao', 'alta', 'aprovado', 'api',
   'Documento YE-DP-13-001, RF-007; RNF-004 (trilha imutável)',
   'Corrigir 13º já fechado e pago não é editar o registro: é REABRIR com motivo, dupla aprovação, recálculo e apuração da diferença (complemento ou estorno), preservando a versão original na trilha. Alteração silenciosa em valor pago é exatamente o que a auditoria trabalhista procura.',
   'Cálculo de 13º fechado e pago no ambiente de teste.',
   '[{"ordem":1,"acao":"Tentar editar diretamente o cálculo fechado","resultado_esperado":"Bloqueado — só via reabertura formal"},
     {"ordem":2,"acao":"Reabrir com motivo e dupla aprovação","resultado_esperado":"Recálculo executado; diferença apurada como complemento/estorno"},
     {"ordem":3,"acao":"Conferir a trilha","resultado_esperado":"Versão original preservada; quem, quando, por quê e a diferença encadeados"}]'::jsonb,
   'Fechado não se edita: reabre com rito ou não muda.',
   'Requisitos YE-DP-13-001: RF-007 / cenário "Alteração retroativa" (seção 25). Mesma disciplina de FERIAS-054 (reabertura de férias).'),

  (v_mod, 'DEC13-071', 'Remuneração do 13º restrita por perfil: colaborador só vê o próprio',
   'negativo', 'alta', 'aprovado', 'api',
   'LGPD (Lei 13.709/2018), arts. 6º, VII e 46 — segurança e acesso mínimo; matriz de perfis do documento (seção 6)',
   'Valores de 13º são dado de remuneração: o colaborador consulta SÓ o próprio cálculo e recibo; a folha da equipe/empresa fica com DP, RH, financeiro e contador conforme a matriz de perfis, sempre dentro do tenant. Vazamento horizontal de remuneração entre colegas é incidente LGPD, não bug estético.',
   'Colaborador comum autenticado no tenant de teste; cálculos de 13º de vários vínculos existentes.',
   '[{"ordem":1,"acao":"Colaborador consulta o próprio 13º","resultado_esperado":"Permitido — parcelas e recibo próprios"},
     {"ordem":2,"acao":"Colaborador tenta ler o cálculo de um colega","resultado_esperado":"Bloqueado pela política de acesso (RLS)"},
     {"ordem":3,"acao":"Usuário de outro tenant tenta ler qualquer cálculo","resultado_esperado":"Bloqueado — segregação por empresa"}]'::jsonb,
   'Cada um vê o seu; a folha inteira é assunto de quem opera a folha.',
   'Requisitos YE-DP-13-001: seção 6 / seção 22 / cenário "Permissões insuficientes" (seção 25). A tabela folha_13_calculo é sensível: conferir cobertura da camada perfil_restringe_leitura_* (rotina PERFIL-003) ou exceção documentada.')

  ON CONFLICT (codigo) DO NOTHING;

  -- ---------------------------------------------------------
  -- Referências cruzadas em casos de outras famílias
  -- (só acrescenta às observações, não reescreve)
  -- ---------------------------------------------------------
  UPDATE public.qa_casos_teste SET observacoes = observacoes ||
    ' Requisitos YE-DP-13-001: o lado 13º do adiantamento nas férias ganhou caso próprio (DEC13-032 — baixa na apuração e dedução na 2ª parcela).'
  WHERE codigo = 'FERIAS-035' AND position('YE-DP-13-001' IN observacoes) = 0;

  UPDATE public.qa_casos_teste SET observacoes = observacoes ||
    ' Requisitos YE-DP-13-001: a conciliação do 13º na rescisão (adiantamento pago, rodada anual) ganhou caso próprio (DEC13-060).'
  WHERE codigo = 'DESL-035' AND position('YE-DP-13-001' IN observacoes) = 0;

  SELECT count(*) INTO v_depois FROM public.qa_casos_teste WHERE modulo_id = v_mod;
  RAISE NOTICE '13º Salário: % casos antes, % depois (esperado +17 na primeira execução).', v_antes, v_depois;
END $doc$;
