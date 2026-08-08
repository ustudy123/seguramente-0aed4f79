-- =========================================================
-- QA — Ponto: casos das frentes de agosto (07/08)
--
-- ORIGEM: a família PONTO-001..271 (03/08) cobriu a Portaria 671 de
-- ponta a ponta — registro, apuração, tolerância, intervalo, noturno,
-- DSR, 12x36, banco de horas, fiscalização, LGPD e a segurança do
-- próprio cercado. Mas o módulo continuou evoluindo DEPOIS dessa
-- documentação: entre 03/08 e 07/08 entraram seis frentes novas, todas
-- nascidas de casos reais de clientes, e NENHUMA tem caso de teste.
-- Sem eles, as correções que acabaram de entrar podem regredir em
-- silêncio — e cada uma delas nasceu exatamente de um silêncio desses.
--
-- As seis frentes e o caso real que as motivou:
--   1. MATERIALIZAÇÃO DE FALTAS (04/08) — a falta da colaboradora da
--      clínica não descontava: o dia sem batida nunca passava a existir.
--   2. UM DIA POR DATA (05/08) — o sábado da Adriana saía duas vezes e
--      debitava 3h40 inexistentes.
--   3. FECHAMENTO POR EMPRESA (04/08) — fechar o banco fechava o tenant
--      inteiro e carimbava colaboradores com a empresa errada.
--   4. RN23 FERIADO TRABALHADO (04/08) — o sistema sabia que era
--      feriado e parava no rótulo: nem adicional de 100%, nem onde
--      registrar a folga compensatória.
--   5. ESPELHO-RESUMO (04/08) — o espelho somava colunas órfãs e saía
--      zerado para todo mundo; zero afirmativo em documento assinado.
--   6. ORIGEM DA MARCAÇÃO (07/08) — coluna nova O/A/P/E/I distinguindo
--      original, ajuste, pré-assinalada, importada e integração.
--
-- ESTA MIGRATION SÓ DOCUMENTA os casos. As rotinas executáveis são o
-- passo seguinte — as frentes 1-5 exigem fixtures de colaborador,
-- escala e competência no cercado, e merecem uma leva própria em vez
-- de rotinas apressadas aqui.
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

  -- ═══════════════════════════════════════════════════════
  -- A) MATERIALIZAÇÃO DE FALTAS — o dia sem batida precisa existir
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'PONTO-290', 'Dia útil sem marcação é materializado como falta',
   'feliz', 'critica', 'aprovado', 'api',
   'CLT, art. 473 (a contrario sensu); Lei 605/1949, art. 6º (a falta injustificada repercute no DSR — mas só se for vista)',
   'A apuração percorre as linhas de ponto_diario; quem cria a linha do dia SEM batida é a materialização (ponto_materializar_faltas). Sem ela, a falta não é calculada e ignorada — ela nunca chega a existir, e nada é descontado. Foi o caso da clínica: a lista pulava de domingo para terça.',
   'Colaborador ativo em escala 5x2; um dia útil já passado sem nenhuma marcação e sem amparo.',
   '[{"ordem":1,"acao":"Rodar a materialização para o período que contém o dia sem batida","resultado_esperado":"Linha criada em ponto_diario com status de falta"},
     {"ordem":2,"acao":"Conferir a apuração da competência","resultado_esperado":"O dia aparece na lista e o débito da falta entra no saldo"},
     {"ordem":3,"acao":"Rodar a materialização passando um período com data futura","resultado_esperado":"Datas futuras são ignoradas — não existe falta em dia que não aconteceu"}]'::jsonb,
   'O dia sem batida passa a existir, desconta, e o futuro fica de fora.',
   'Regressão aqui reabre o caso de 13/07 (falta que não desconta). A rotina diária automatiza o dia anterior; a recuperação retroativa é decisão de quem opera a folha — o caso testa a função, não dispara retroativo.'),

  (v_mod, 'PONTO-291', 'Ausência amparada não vira falta na materialização',
   'alternativo', 'alta', 'aprovado', 'api',
   'CLT, art. 473 (ausências legais); Lei 605/1949, art. 6º, §1º',
   'A materialização não pode ser um gerador cego de débito: dia sem batida com atestado, férias ou feriado na unidade é dia amparado. PONTO-024 já garante isso na apuração; este caso garante na MATERIALIZAÇÃO — a linha criada precisa nascer com o status do amparo, não como falta.',
   'Colaborador com atestado aprovado cobrindo um dia útil sem marcação; outro dia coberto por feriado da unidade.',
   '[{"ordem":1,"acao":"Materializar o período com o dia do atestado","resultado_esperado":"Linha criada com status de ausência amparada, sem débito"},
     {"ordem":2,"acao":"Materializar o período com o feriado","resultado_esperado":"Dia reconhecido como feriado, sem falta e sem débito"}]'::jsonb,
   'Materialização distingue falta de ausência amparada.',
   NULL),

  (v_mod, 'PONTO-292', 'Materializar duas vezes não duplica o dia',
   'excecao', 'alta', 'aprovado', 'api',
   'Portaria MTE 671/2021 (integridade dos registros de tratamento)',
   'A rotina roda todo dia e a recuperação por período pode passar pelo mesmo intervalo mais de uma vez. Idempotência é o que separa uma rotina de manutenção de um gerador de duplicatas — e dia duplicado é exatamente a doença que a frente "um dia por data" acabou de tratar.',
   'Dia já materializado como falta.',
   '[{"ordem":1,"acao":"Rodar a materialização de novo sobre o mesmo período","resultado_esperado":"Nenhuma linha nova; a existente permanece uma só"},
     {"ordem":2,"acao":"Conferir o saldo da competência","resultado_esperado":"O débito da falta conta uma única vez"}]'::jsonb,
   'Rodar N vezes produz o mesmo estado de rodar uma.',
   NULL),

  (v_mod, 'PONTO-293', 'Diagnóstico aponta os dias que faltam materializar',
   'alternativo', 'media', 'aprovado', 'api',
   'Portaria MTE 671/2021 (dever de tratamento fiel dos registros)',
   'ponto_dias_nao_materializados é o exame que revela o buraco antes de o cliente notar no espelho. O caso garante que o diagnóstico enxerga o dia ausente e que, depois da materialização, a lista zera.',
   'Colaborador com um dia útil passado sem linha em ponto_diario.',
   '[{"ordem":1,"acao":"Rodar o diagnóstico","resultado_esperado":"O dia sem linha aparece na lista"},
     {"ordem":2,"acao":"Materializar e rodar o diagnóstico de novo","resultado_esperado":"Lista vazia"}]'::jsonb,
   'O diagnóstico acusa antes e silencia depois.',
   NULL),

  -- ═══════════════════════════════════════════════════════
  -- B) UM DIA POR DATA — a apuração nunca duplica um dia
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'PONTO-300', 'A apuração devolve no máximo uma linha por data',
   'excecao', 'critica', 'aprovado', 'api',
   'CLT, art. 74 (fidelidade do registro); caso Adriana 27/06 (débito de 3h40 inexistente)',
   'ponto_saldo_dias_competencia ganhou a garantia de UM DIA POR DATA: quando algum ramo interno emite a mesma data duas vezes (o caso da linha de equalização), o invólucro agrupa — dia protegido vence com saldo zero; senão vale o trabalhado real e a maior jornada. Duplicata debita o colaborador duas vezes.',
   'Competência com marcações normais, incluindo um sábado trabalhado e uma equalização configurada.',
   '[{"ordem":1,"acao":"Apurar a competência e agrupar por data","resultado_esperado":"Nenhuma data aparece mais de uma vez"},
     {"ordem":2,"acao":"Conferir o sábado trabalhado","resultado_esperado":"Uma linha só, com as horas reais — não uma linha real mais uma de equalização zerada"},
     {"ordem":3,"acao":"Somar o saldo do mês","resultado_esperado":"Cada dia contribui uma única vez"}]'::jsonb,
   'Um dia civil, uma linha de apuração, um débito/crédito.',
   'O corpo antigo segue intacto (renomeado _bruto); a garantia vive no invólucro. Se alguém voltar a chamar o bruto diretamente, este caso acusa.'),

  (v_mod, 'PONTO-301', 'Dia normal atravessa o agrupamento sem ser alterado',
   'alternativo', 'alta', 'aprovado', 'api',
   'CLT, art. 74 (fidelidade do registro)',
   'A promessa da correção foi cirúrgica: dia que sai uma vez só passa intocado — valores idênticos aos de antes. Este caso compara a saída agrupada com a bruta num período sem duplicatas: precisa ser igual, linha a linha.',
   'Competência sem nenhuma data duplicada no ramo bruto.',
   '[{"ordem":1,"acao":"Apurar pela função pública e pela bruta","resultado_esperado":"Mesmo número de linhas, mesmos valores por dia"}]'::jsonb,
   'O invólucro só age quando há duplicata.',
   NULL),

  -- ═══════════════════════════════════════════════════════
  -- C) FECHAMENTO E APURAÇÃO POR EMPRESA
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'PONTO-310', 'Apuração filtrada por empresa traz só aquela empresa',
   'feliz', 'critica', 'aprovado', 'api',
   'CLT, art. 74, §2º (registro por estabelecimento); caso "fecha pra todas as empresas" (04/08)',
   'O filtro antigo tinha a válvula "OR empresa_id IS NULL": todo colaborador sem empresa entrava na apuração de TODAS as empresas do tenant. A correção resolve a empresa pelo cadastro de admissão quando a linha não tem, e o filtro passa a ser empresa resolvida = empresa pedida. Fechar a empresa A não pode arrastar gente da B.',
   'Tenant com duas empresas, colaboradores com marcações em ambas.',
   '[{"ordem":1,"acao":"Apurar a competência filtrando pela empresa A","resultado_esperado":"Só colaboradores da empresa A na saída"},
     {"ordem":2,"acao":"Apurar pela empresa B","resultado_esperado":"Só os da B — sem interseção com a lista anterior"},
     {"ordem":3,"acao":"Apurar sem filtro","resultado_esperado":"Todos aparecem, cada um uma vez"}]'::jsonb,
   'Cada empresa fecha o próprio pessoal, e mais ninguém.',
   NULL),

  (v_mod, 'PONTO-311', 'Colaborador sem empresa na linha é resolvido pelo cadastro',
   'alternativo', 'alta', 'aprovado', 'api',
   'CLT, art. 74, §2º (vinculação ao estabelecimento)',
   'Linha de ponto sem empresa preenchida não pode nem sumir do fechamento nem entrar em todos: a empresa vem da admissão vigente do colaborador. É a substituição da válvula de escape por resolução de verdade.',
   'Colaborador admitido na empresa A com linhas de ponto_diario sem empresa_id.',
   '[{"ordem":1,"acao":"Apurar filtrando pela empresa A","resultado_esperado":"O colaborador aparece — a empresa veio do cadastro"},
     {"ordem":2,"acao":"Apurar filtrando pela empresa B","resultado_esperado":"O colaborador NÃO aparece"}]'::jsonb,
   'Sem empresa na linha, vale a do cadastro — nunca a da vez.',
   NULL),

  (v_mod, 'PONTO-312', 'Reapurar por uma empresa não rouba colaborador da outra',
   'negativo', 'critica', 'aprovado', 'api',
   'Portaria MTE 671/2021 (fidelidade do espelho por estabelecimento)',
   'O defeito original tinha segunda camada: além de fechar demais, o reapurar carimbava cada linha com a empresa selecionada na barra do topo (COALESCE(p_empresa_id, ...)), MUDANDO a empresa de quem já tinha a sua. Espelho da empresa errada é documento errado assinado.',
   'Colaborador da empresa A com linhas já atribuídas à empresa A.',
   '[{"ordem":1,"acao":"Reapurar a competência filtrando pela empresa B","resultado_esperado":"As linhas do colaborador da A permanecem com a empresa A"},
     {"ordem":2,"acao":"Conferir o espelho do colaborador","resultado_esperado":"Emitido pela empresa A, a dele"}]'::jsonb,
   'Reapuração nunca reatribui empresa de quem já tem.',
   'Foi necessária uma migration de reparo (corrige_empresa_atribuida_errada) para desfazer o estrago desse comportamento — este caso impede a reincidência.'),

  -- ═══════════════════════════════════════════════════════
  -- D) RN23 — FERIADO TRABALHADO: DOBRA OU FOLGA
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'PONTO-320', 'Feriado trabalhado sem folga compensatória rende adicional de 100%',
   'feliz', 'critica', 'aprovado', 'api',
   'Lei 605/1949, art. 9º; Súmula 146 do TST (trabalho em feriado não compensado é pago em dobro)',
   'O sistema já sabia que o dia era feriado e que houve marcação — e parava no rótulo. Agora ponto_feriado_adicional_competencia devolve os minutos trabalhados no feriado com adicional de 100%, prontos para a folha, a partir do feriado resolvido pela tabela da unidade (RN22).',
   'Colaborador com marcações completas num feriado da tabela vinculada à sua unidade; nenhuma folga compensatória registrada.',
   '[{"ordem":1,"acao":"Apurar o adicional de feriado da competência","resultado_esperado":"Os minutos trabalhados no feriado aparecem com adicional de 100%"},
     {"ordem":2,"acao":"Conferir um dia comum trabalhado na mesma competência","resultado_esperado":"Fora do cálculo do adicional — só feriado entra"}]'::jsonb,
   'Feriado trabalhado e não compensado vira verba de 100% apurada, sem lançamento manual.',
   NULL),

  (v_mod, 'PONTO-321', 'Folga compensatória registrada afasta o pagamento em dobro',
   'alternativo', 'alta', 'aprovado', 'api',
   'Lei 605/1949, art. 9º, parte final (salvo se houver folga compensatória em outro dia)',
   'A parte final do art. 9º é a exceção que a tabela feriado_folga_compensatoria materializa: RH registra que o feriado trabalhado foi compensado com folga em outro dia, e o adicional daquele feriado deixa de ser devido.',
   'Feriado trabalhado com folga compensatória registrada apontando outro dia.',
   '[{"ordem":1,"acao":"Registrar a folga compensatória do feriado trabalhado","resultado_esperado":"Registro aceito, vinculando feriado, colaborador e dia da folga"},
     {"ordem":2,"acao":"Apurar o adicional da competência","resultado_esperado":"O feriado compensado sai do cálculo; outros feriados não compensados permanecem"}]'::jsonb,
   'Compensou, não dobra; não compensou, dobra.',
   NULL),

  (v_mod, 'PONTO-322', 'Adicional de feriado não entra no saldo do banco de horas',
   'negativo', 'alta', 'aprovado', 'api',
   'Lei 605/1949, art. 9º; princípio do non bis in idem (não pagar duas vezes a mesma hora)',
   'O adicional de feriado é verba de folha, não crédito de compensação. Se os mesmos minutos entrassem também no saldo do banco, o colaborador receberia em dobro E folgaria por eles. A apuração do adicional não altera o saldo — e este caso vigia exatamente isso.',
   'Feriado trabalhado sem compensação, com o adicional apurado.',
   '[{"ordem":1,"acao":"Comparar o saldo do banco antes e depois de apurar o adicional","resultado_esperado":"Idêntico — a apuração do adicional é somente leitura sobre o saldo"}]'::jsonb,
   'A mesma hora não vira verba e crédito ao mesmo tempo.',
   NULL),

  -- ═══════════════════════════════════════════════════════
  -- E) ESPELHO-RESUMO — o fim do zero afirmativo
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'PONTO-330', 'Espelho-resumo agrega a mesma fonte que o banco de horas',
   'feliz', 'critica', 'aprovado', 'api',
   'Portaria MTE 671/2021, art. 84 (espelho de ponto fiel); caso do espelho zerado (07/2026)',
   'O espelho somava colunas órfãs da consolidação antiga e saía zerado para todo mundo. ponto_espelho_resumo agrega a fonte real (ponto_saldo_dias_competencia): as duas telas — espelho e banco de horas — precisam dizer a mesma coisa para a mesma competência.',
   'Colaborador com competência apurada, saldo diferente de zero.',
   '[{"ordem":1,"acao":"Gerar o espelho-resumo da competência","resultado_esperado":"Totais de horas e saldo iguais aos do banco de horas"},
     {"ordem":2,"acao":"Conferir dias trabalhados e faltas","resultado_esperado":"Batem com a apuração dia a dia"}]'::jsonb,
   'Espelho e banco de horas contam a mesma história.',
   NULL),

  (v_mod, 'PONTO-331', 'O que o modelo não apura sai como não apurado, nunca como zero',
   'negativo', 'alta', 'aprovado', 'api',
   'Portaria MTE 671/2021 (fidelidade); vedação à declaração falsa em documento que o colaborador assina',
   'A apuração atual trabalha em minutos de saldo e não separa HE 50% de 100% nem adicional noturno próprio. Zero afirma que não houve; num espelho assinado, isso é declaração falsa. Esses campos saem marcados como não apurados neste modelo — e o adicional de feriado, esse sim calculado, sai em campo próprio.',
   'Colaborador com horas extras reais na competência.',
   '[{"ordem":1,"acao":"Gerar o espelho-resumo","resultado_esperado":"HE 50%/100% e adicional noturno marcados como não apurados neste modelo — não como 0h00"},
     {"ordem":2,"acao":"Conferir o adicional de feriado","resultado_esperado":"Aparece em campo próprio, com o valor apurado da RN23"}]'::jsonb,
   'Zero só quando é zero de verdade.',
   'Se um dia a apuração passar a separar os percentuais, este caso deve ser revisado junto — a marca de não apurado deixa de valer para o campo que passar a existir.'),

  -- ═══════════════════════════════════════════════════════
  -- F) ORIGEM DA MARCAÇÃO — O/A/P/E/I
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'PONTO-340', 'Marcação nasce original e ajuste é rotulado como ajuste',
   'feliz', 'alta', 'aprovado', 'api',
   'Portaria MTE 671/2021 (AEJ distingue a origem de cada marcação tratada)',
   'A coluna origem_marcacao classifica cada batida: O (original), A (ajuste), P (pré-assinalada), E (importada), I (integração). É o que o AEJ exige e o que permite auditar quanto do espelho veio de batida real e quanto veio de tratamento. A batida comum nasce O; a marcação criada por ajuste nasce A — em harmonia com PONTO-190 (o ajuste cria batida de correção e preserva a original).',
   'Colaborador ativo; um ajuste aprovado criando marcação de correção.',
   '[{"ordem":1,"acao":"Registrar uma batida comum","resultado_esperado":"origem_marcacao = O"},
     {"ordem":2,"acao":"Criar marcação por ajuste aprovado","resultado_esperado":"origem_marcacao = A; a original permanece O"}]'::jsonb,
   'Cada marcação carrega a própria origem, e o ajuste não se disfarça de original.',
   NULL),

  (v_mod, 'PONTO-341', 'Origem fora da lista O/A/P/E/I é recusada',
   'negativo', 'media', 'aprovado', 'api',
   'Portaria MTE 671/2021 (padronização do AEJ)',
   'O CHECK da coluna fecha a lista em cinco valores. Origem inventada quebraria a geração do AEJ e a auditoria de tratamento.',
   'Cercado disponível.',
   '[{"ordem":1,"acao":"Gravar marcação com origem_marcacao = X","resultado_esperado":"Recusado pelo CHECK"},
     {"ordem":2,"acao":"Gravar com origem_marcacao vazia ou nula","resultado_esperado":"Recusado — a coluna é NOT NULL com DEFAULT O"}]'::jsonb,
   'Só entram as cinco origens previstas.',
   NULL)

  ON CONFLICT (codigo) DO NOTHING;

  SELECT count(*) INTO v_depois FROM public.qa_casos_teste WHERE modulo_id = v_mod;
  RAISE NOTICE 'Casos das frentes de agosto: módulo Ponto tinha % casos, agora tem % (+%).',
    v_antes, v_depois, v_depois - v_antes;
END $doc$;
