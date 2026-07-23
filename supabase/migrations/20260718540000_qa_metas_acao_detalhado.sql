-- =========================================================
-- QA — Módulos METAS/OKRs e PLANO DE AÇÃO DETALHADOS (17 casos)
-- FECHA o bloco Planejamento & Gestão no padrao detalhado.
--
-- Padrao aprovado: objetivo (regra+porque), pre_condicoes, passos com dados
-- exatos+tela, resultado_esperado, observacoes (impacto+correcao).
--
-- DESTAQUE: o par META-012 x ACAO-013 e o contraste mais revelador do piloto.
-- Ambos testam "progresso fora de 0-100". Em Metas o banco ACEITA (achado);
-- em Plano de Acao o banco RECUSA (CHECK existe). Mesma regra, presenca
-- desigual — evidencia de que a boa pratica e conhecida mas nao replicada.
-- As observacoes dos dois casos referenciam um ao outro.
-- =========================================================

DO $d$
DECLARE v_meta uuid; v_acao uuid;
BEGIN
  SELECT id INTO v_meta FROM public.qa_modulos WHERE path='planejamento-gestao/metas';
  SELECT id INTO v_acao FROM public.qa_modulos WHERE path='planejamento-gestao/plano-de-acao';
  IF v_meta IS NULL OR v_acao IS NULL THEN RAISE EXCEPTION 'Modulos metas/plano-de-acao nao encontrados.'; END IF;

  -- ═══════════════ METAS / OKRs ═══════════════

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar a criacao de uma meta com titulo, periodo e ano. Regra: toda meta precisa de '
             || 'titulo e ano; o periodo define o ciclo (mensal, trimestral, semestral ou anual). Importa '
             || 'porque metas sao o instrumento de gestao de desempenho — sem cadastra-las, nao ha o que '
             || 'acompanhar nem cobrar.',
    pre_condicoes = 'Usuario com permissao de gestao de metas.',
    passos = '[
      {"ordem":1,"acao":"Abrir o cadastro de metas","onde_na_tela":"Menu > Planejamento e Gestao > Metas > Nova Meta","dados":"-","resultado_esperado":"Formulario de meta aberto"},
      {"ordem":2,"acao":"Preencher titulo, periodo e ano","onde_na_tela":"Campos Titulo, Periodo e Ano","dados":"Titulo: Reduzir acidentes em 20% | Periodo: trimestral | Ano: 2026","resultado_esperado":"Campos aceitos"},
      {"ordem":3,"acao":"Salvar","onde_na_tela":"Botao Salvar","dados":"-","resultado_esperado":"Meta criada, com status inicial nao_iniciada e progresso 0"}
    ]'::jsonb,
    resultado_esperado = 'A meta Reduzir acidentes em 20% existe, no periodo trimestral de 2026, pronta '
                       || 'para receber key results e acompanhamento.',
    observacoes = 'IMPACTO SE FALHAR: sem cadastrar metas, a gestao de desempenho fica sem instrumento — '
                || 'nao ha o que acompanhar, medir nem cobrar ao longo do ciclo.'
  WHERE codigo='META-001';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que key results (OKRs) podem ser vinculados a uma meta. Regra: uma meta se '
             || 'desdobra em resultados-chave mensuraveis, cada um com um valor-alvo. Importa porque a '
             || 'meta sozinha e uma intencao; sao os key results que a tornam mensuravel e acompanhavel.',
    pre_condicoes = 'Precisa existir uma meta cadastrada.',
    passos = '[
      {"ordem":1,"acao":"Abrir uma meta e ir aos key results","onde_na_tela":"Metas > abrir a meta > aba Key Results (OKRs) > Adicionar","dados":"-","resultado_esperado":"Formulario de key result aberto"},
      {"ordem":2,"acao":"Adicionar dois key results com valores-alvo","onde_na_tela":"Campos Key Result e Valor Alvo","dados":"KR1: Treinar 100% da equipe (alvo 100) | KR2: Zerar reincidencias (alvo 0)","resultado_esperado":"Os dois key results sao aceitos"},
      {"ordem":3,"acao":"Salvar e conferir","onde_na_tela":"Salvar > aba Key Results","dados":"-","resultado_esperado":"Os 2 key results aparecem vinculados a meta"}
    ]'::jsonb,
    resultado_esperado = 'A meta tem 2 key results vinculados, cada um com seu valor-alvo. O progresso da '
                       || 'meta pode ser acompanhado por eles.',
    observacoes = 'IMPACTO SE FALHAR: sem key results, a meta fica sem criterio objetivo de sucesso — '
                || 'vira uma intencao sem medicao, impossivel de avaliar ao fim do ciclo.'
  WHERE codigo='META-002';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que o progresso e o status de uma meta podem ser atualizados ao longo do ciclo. '
             || 'Regra: progresso (0 a 100) e status (nao_iniciada, em_andamento, concluida, cancelada, '
             || 'atrasada) evoluem conforme a meta avanca. Importa porque acompanhar o andamento e o '
             || 'proprio proposito da gestao de metas.',
    pre_condicoes = 'Precisa existir uma meta cadastrada.',
    passos = '[
      {"ordem":1,"acao":"Abrir uma meta","onde_na_tela":"Metas > abrir a meta","dados":"-","resultado_esperado":"Meta aberta, com progresso e status atuais"},
      {"ordem":2,"acao":"Atualizar o progresso e o status","onde_na_tela":"Campos Progresso e Status","dados":"Progresso: 50 | Status: em_andamento","resultado_esperado":"Os valores sao aceitos"},
      {"ordem":3,"acao":"Salvar e conferir","onde_na_tela":"Salvar > reabrir","dados":"-","resultado_esperado":"A meta mostra 50% de progresso e status em_andamento"}
    ]'::jsonb,
    resultado_esperado = 'A meta fica com progresso 50 e status em_andamento, e os valores persistem.',
    observacoes = 'IMPACTO SE FALHAR: sem atualizar progresso e status, o painel de metas congela — a '
                || 'gestao perde a visibilidade de como o ciclo esta andando.'
  WHERE codigo='META-003';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que uma meta sem titulo e recusada. Regra: titulo e NOT NULL. Importa porque '
             || 'uma meta sem titulo nao comunica o que se quer atingir — aparece em branco nos paineis e '
             || 'nao serve para nada.',
    pre_condicoes = 'Nenhuma.',
    passos = '[
      {"ordem":1,"acao":"Abrir nova meta","onde_na_tela":"Metas > Nova Meta","dados":"-","resultado_esperado":"Formulario aberto"},
      {"ordem":2,"acao":"Deixar o titulo vazio e tentar salvar","onde_na_tela":"Campo Titulo (vazio) + Salvar","dados":"Titulo: (vazio) | Ano: 2026","resultado_esperado":"O sistema DEVE recusar — titulo e obrigatorio"}
    ]'::jsonb,
    resultado_esperado = 'A meta sem titulo e recusada. Nenhuma meta em branco entra no sistema.',
    observacoes = 'IMPACTO SE FALHAR: metas sem titulo poluem os paineis de acompanhamento e nao '
                || 'comunicam nada a quem precisa executa-las.'
  WHERE codigo='META-010';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que um periodo invalido e recusado. Regra: periodo so aceita mensal, '
             || 'trimestral, semestral ou anual (enum). Importa porque o periodo define o ciclo de '
             || 'apuracao — um valor fora da lista quebraria os calculos e agrupamentos por ciclo.',
    pre_condicoes = 'Formulario de meta com o campo periodo.',
    passos = '[
      {"ordem":1,"acao":"Abrir nova meta","onde_na_tela":"Metas > Nova Meta","dados":"-","resultado_esperado":"Formulario aberto"},
      {"ordem":2,"acao":"Tentar um periodo fora da lista","onde_na_tela":"Campo Periodo","dados":"Periodo: quinzenal (invalido — nao esta entre mensal/trimestral/semestral/anual)","resultado_esperado":"O sistema DEVE recusar"}
    ]'::jsonb,
    resultado_esperado = 'O periodo quinzenal e recusado. So os quatro periodos validos sao aceitos.',
    observacoes = 'IMPACTO SE FALHAR: periodo invalido quebraria os agrupamentos e calculos por ciclo de '
                || 'apuracao (relatorios trimestrais, anuais).'
  WHERE codigo='META-011';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar o que acontece ao informar um progresso fora da faixa 0-100 numa meta. Regra '
             || 'esperada: progresso e uma porcentagem, entao deveria aceitar apenas 0 a 100. Este caso '
             || 'revela se existe essa trava no banco. Importa porque progresso de 150% ou negativo e '
             || 'matematicamente sem sentido e quebra barras de progresso e medias.',
    pre_condicoes = 'Formulario de meta com o campo progresso.',
    passos = '[
      {"ordem":1,"acao":"Abrir uma meta (nova ou existente)","onde_na_tela":"Metas > Nova Meta ou abrir uma existente","dados":"-","resultado_esperado":"Campo progresso disponivel"},
      {"ordem":2,"acao":"Informar um progresso absurdo","onde_na_tela":"Campo Progresso","dados":"Progresso: 150 (fora da faixa 0-100)","resultado_esperado":"Idealmente o sistema DEVERIA recusar — progresso e porcentagem"}
    ]'::jsonb,
    resultado_esperado = 'O progresso 150 deveria ser RECUSADO. ACHADO ATUAL: o banco ACEITA — nao ha CHECK '
                       || 'de faixa nas tabelas metas e meta_okrs. Um progresso impossivel entra.',
    observacoes = 'IMPACTO SE FALHAR (e falha hoje): progresso fora de 0-100 quebra barras de progresso na '
                || 'tela (barra passando de 100%), distorce medias de atingimento e relatorios de '
                || 'desempenho. CORRECAO SUGERIDA: adicionar CHECK (progresso BETWEEN 0 AND 100) em metas '
                || 'e meta_okrs. NOTA IMPORTANTE: esse CHECK JA EXISTE no modulo Plano de Acao (veja o '
                || 'caso ACAO-013, que passa) — a boa pratica e conhecida pela equipe, so nao foi '
                || 'replicada aqui. E o exemplo mais claro de inconsistencia entre modulos do sistema.'
  WHERE codigo='META-012';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que apagar uma meta apaga seus key results junto (CASCADE). Regra: '
             || 'meta_id ON DELETE CASCADE — um key result nao existe sem a meta a que pertence. Importa '
             || 'porque key results orfaos seriam metricas sem objetivo, lixo sem contexto.',
    pre_condicoes = 'Precisa existir uma meta com pelo menos um key result.',
    passos = '[
      {"ordem":1,"acao":"Criar uma meta com um key result","onde_na_tela":"Metas","dados":"Meta: Meta Teste | KR: um key result qualquer (alvo 100)","resultado_esperado":"Key result pertence a meta"},
      {"ordem":2,"acao":"Apagar a meta","onde_na_tela":"Metas > abrir a meta > Excluir","dados":"-","resultado_esperado":"Meta apagada"},
      {"ordem":3,"acao":"Conferir o key result","onde_na_tela":"-","dados":"-","resultado_esperado":"O key result foi apagado JUNTO com a meta (nao sobra orfao)"}
    ]'::jsonb,
    resultado_esperado = 'A meta e apagada e seus key results somem junto (CASCADE). Nenhum key result '
                       || 'orfao sobra na base.',
    observacoes = 'IMPACTO SE FALHAR: key results orfaos (sem meta) seriam metricas sem objetivo — lixo '
                || 'que aparece em consultas sem fazer sentido. O CASCADE mantem a base limpa.'
  WHERE codigo='META-013';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que uma meta de um cliente e invisivel para outro. Regra: isolamento '
             || 'multi-tenant. Importa porque metas revelam prioridades estrategicas e desempenho '
             || 'interno — informacao sensivel que nao pode vazar entre clientes.',
    pre_condicoes = 'Dois clientes distintos no sistema.',
    passos = '[
      {"ordem":1,"acao":"No cliente A, criar uma meta","onde_na_tela":"Cliente A > Metas > Nova Meta","dados":"Titulo: Meta secreta do cliente A | Ano: 2026","resultado_esperado":"Criada no cliente A"},
      {"ordem":2,"acao":"Entrar como cliente B e procurar","onde_na_tela":"Cliente B > Metas","dados":"Procurar pela meta do cliente A","resultado_esperado":"NAO aparece para o cliente B"}
    ]'::jsonb,
    resultado_esperado = 'A meta do cliente A e invisivel no cliente B. Zero vazamento.',
    observacoes = 'IMPACTO SE FALHAR: exporia prioridades estrategicas e indicadores de desempenho de um '
                || 'cliente a outro. Protecao RLS por tenant.'
  WHERE codigo='META-022';

  -- ═══════════════ PLANO DE AÇÃO (5W2H + GUT) ═══════════════

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar a criacao de uma acao no formato 5W2H (o que, por que, onde, quando, quem, '
             || 'como, quanto). Regra: uma acao tem codigo, titulo e os campos do 5W2H. Importa porque o '
             || 'plano de acao e o instrumento que transforma um problema identificado em execucao '
             || 'concreta — e a saida pratica de auditorias, inspecoes e analises de risco.',
    pre_condicoes = 'Usuario com permissao de criar acoes.',
    passos = '[
      {"ordem":1,"acao":"Abrir o cadastro de acao","onde_na_tela":"Menu > Planejamento e Gestao > Plano de Acao > Nova Acao","dados":"-","resultado_esperado":"Formulario 5W2H aberto"},
      {"ordem":2,"acao":"Preencher os campos do 5W2H","onde_na_tela":"Campos O que (titulo), Por que, Onde, Quando (prazo), Como","dados":"O que: Instalar guarda-corpo | Por que: Risco de queda | Onde: Mezanino | Quando: daqui a 30 dias | Como: Contratar serralheria","resultado_esperado":"Campos aceitos"},
      {"ordem":3,"acao":"Salvar","onde_na_tela":"Botao Salvar","dados":"-","resultado_esperado":"Acao criada com status pendente e progresso 0"}
    ]'::jsonb,
    resultado_esperado = 'A acao Instalar guarda-corpo existe, com os campos 5W2H preenchidos, pronta para '
                       || 'ser executada e acompanhada.',
    observacoes = 'IMPACTO SE FALHAR: sem criar acoes, os problemas identificados em auditorias e '
                || 'inspecoes nao viram execucao — o sistema aponta riscos mas nada e feito a respeito.'
  WHERE codigo='ACAO-001';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que tarefas podem ser vinculadas a uma acao. Regra: uma acao se desdobra em '
             || 'tarefas menores, cada uma com seu responsavel. Importa porque acoes complexas precisam '
             || 'ser quebradas em passos executaveis — e assim que a execucao realmente acontece.',
    pre_condicoes = 'Precisa existir uma acao cadastrada.',
    passos = '[
      {"ordem":1,"acao":"Abrir uma acao e ir as tarefas","onde_na_tela":"Plano de Acao > abrir a acao > aba Tarefas > Adicionar","dados":"-","resultado_esperado":"Formulario de tarefa aberto"},
      {"ordem":2,"acao":"Adicionar tres tarefas","onde_na_tela":"Campo Titulo da tarefa","dados":"T1: Cotar fornecedor | T2: Aprovar orcamento | T3: Executar instalacao","resultado_esperado":"As tres tarefas sao aceitas"},
      {"ordem":3,"acao":"Salvar e conferir","onde_na_tela":"Salvar > aba Tarefas","dados":"-","resultado_esperado":"As 3 tarefas aparecem vinculadas a acao"}
    ]'::jsonb,
    resultado_esperado = 'A acao tem 3 tarefas vinculadas, formando o roteiro de execucao.',
    observacoes = 'IMPACTO SE FALHAR: sem tarefas, acoes complexas ficam como um bloco unico sem passos '
                || 'claros — dificulta a delegacao e o acompanhamento da execucao.'
  WHERE codigo='ACAO-002';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que a pontuacao GUT e calculada automaticamente pelo sistema (gravidade x '
             || 'urgencia x tendencia). Regra: pontuacao_gut e uma coluna GENERATED — o proprio banco '
             || 'multiplica os tres fatores, ninguem digita o resultado. Importa porque a priorizacao GUT '
             || 'define a ordem de execucao das acoes; se o calculo pudesse ser digitado errado, a fila '
             || 'de prioridade ficaria distorcida.',
    pre_condicoes = 'Formulario de acao com os campos de priorizacao GUT.',
    passos = '[
      {"ordem":1,"acao":"Abrir nova acao e ir a priorizacao GUT","onde_na_tela":"Nova Acao > secao Priorizacao (GUT)","dados":"-","resultado_esperado":"Campos Gravidade, Urgencia e Tendencia disponiveis"},
      {"ordem":2,"acao":"Informar os tres fatores","onde_na_tela":"Campos Gravidade, Urgencia, Tendencia","dados":"Gravidade: 5 | Urgencia: 4 | Tendencia: 3","resultado_esperado":"Os tres valores sao aceitos"},
      {"ordem":3,"acao":"Salvar e conferir a pontuacao","onde_na_tela":"Salvar > ver a pontuacao GUT da acao","dados":"-","resultado_esperado":"A pontuacao aparece como 60 (5 x 4 x 3), calculada automaticamente"}
    ]'::jsonb,
    resultado_esperado = 'A pontuacao GUT da acao e 60, resultado de 5 x 4 x 3, calculada pelo sistema sem '
                       || 'digitacao manual.',
    observacoes = 'IMPACTO SE FALHAR: se a pontuacao nao fosse calculada automaticamente, um valor '
                || 'digitado errado distorceria a fila de prioridade — acoes criticas poderiam ficar atras '
                || 'de acoes menores. A coluna GENERATED garante o calculo correto sempre.'
  WHERE codigo='ACAO-003';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que uma acao sem titulo e recusada. Regra: titulo e NOT NULL — e o "o que" do '
             || '5W2H. Importa porque uma acao sem titulo nao diz o que precisa ser feito.',
    pre_condicoes = 'Nenhuma.',
    passos = '[
      {"ordem":1,"acao":"Abrir nova acao","onde_na_tela":"Plano de Acao > Nova Acao","dados":"-","resultado_esperado":"Formulario aberto"},
      {"ordem":2,"acao":"Deixar o titulo (o que) vazio e tentar salvar","onde_na_tela":"Campo O que / Titulo (vazio) + Salvar","dados":"Titulo: (vazio)","resultado_esperado":"O sistema DEVE recusar"}
    ]'::jsonb,
    resultado_esperado = 'A acao sem titulo e recusada. Nenhuma acao em branco entra no plano.',
    observacoes = 'IMPACTO SE FALHAR: acoes sem titulo aparecem em branco no plano e ninguem sabe o que '
                || 'deve ser executado.'
  WHERE codigo='ACAO-010';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que valores de GUT fora da faixa 1-5 sao recusados. Regra: gravidade, urgencia '
             || 'e tendencia sao notas de 1 a 5 (CHECK BETWEEN 1 AND 5). Importa porque a escala GUT e '
             || 'padronizada; um valor fora dela distorceria a pontuacao (que multiplica os tres) e '
             || 'quebraria a comparabilidade entre acoes.',
    pre_condicoes = 'Formulario de acao com os campos GUT.',
    passos = '[
      {"ordem":1,"acao":"Abrir nova acao e ir a priorizacao GUT","onde_na_tela":"Nova Acao > secao Priorizacao (GUT)","dados":"-","resultado_esperado":"Campos GUT disponiveis"},
      {"ordem":2,"acao":"Tentar uma gravidade fora da escala","onde_na_tela":"Campo Gravidade","dados":"Gravidade: 9 (fora da escala 1-5)","resultado_esperado":"O sistema DEVE recusar — a escala GUT vai de 1 a 5"}
    ]'::jsonb,
    resultado_esperado = 'A gravidade 9 e recusada. So notas de 1 a 5 sao aceitas nos tres fatores GUT.',
    observacoes = 'IMPACTO SE FALHAR: uma nota fora da escala distorceria a pontuacao GUT (que multiplica '
                || 'os tres fatores) e quebraria a comparabilidade da fila de prioridades.'
  WHERE codigo='ACAO-011';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que um tipo de acao invalido e recusado. Regra: tipo so aceita corretiva, '
             || 'preventiva ou melhoria. Importa porque o tipo classifica a natureza da acao — corrigir '
             || 'algo que deu errado, prevenir um risco ou melhorar o que ja funciona — e orienta '
             || 'relatorios de gestao.',
    pre_condicoes = 'Formulario de acao com o campo tipo.',
    passos = '[
      {"ordem":1,"acao":"Abrir nova acao","onde_na_tela":"Plano de Acao > Nova Acao > campo Tipo","dados":"-","resultado_esperado":"Campo tipo disponivel"},
      {"ordem":2,"acao":"Tentar um tipo fora da lista","onde_na_tela":"Campo Tipo","dados":"Tipo: urgente (invalido — nao e corretiva/preventiva/melhoria)","resultado_esperado":"O sistema DEVE recusar"}
    ]'::jsonb,
    resultado_esperado = 'O tipo urgente e recusado. So corretiva, preventiva ou melhoria sao aceitos.',
    observacoes = 'IMPACTO SE FALHAR: tipo invalido quebraria os relatorios que classificam acoes por '
                || 'natureza (quantas sao corretivas vs preventivas — indicador de maturidade em SST).'
  WHERE codigo='ACAO-012';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que um progresso fora da faixa 0-100 e recusado numa acao. Regra: progresso e '
             || 'porcentagem e tem CHECK BETWEEN 0 AND 100 nesta tabela. Importa porque progresso '
             || 'impossivel quebraria barras e medias — e este modulo TEM a protecao no banco.',
    pre_condicoes = 'Formulario de acao com o campo progresso.',
    passos = '[
      {"ordem":1,"acao":"Abrir uma acao (nova ou existente)","onde_na_tela":"Plano de Acao > Nova Acao ou abrir uma existente","dados":"-","resultado_esperado":"Campo progresso disponivel"},
      {"ordem":2,"acao":"Tentar um progresso absurdo","onde_na_tela":"Campo Progresso","dados":"Progresso: 150 (fora da faixa 0-100)","resultado_esperado":"O sistema DEVE recusar — progresso e porcentagem"}
    ]'::jsonb,
    resultado_esperado = 'O progresso 150 e RECUSADO. O banco tem CHECK (progresso BETWEEN 0 AND 100) '
                       || 'nesta tabela e ele funciona.',
    observacoes = 'IMPACTO SE FALHAR: progresso impossivel quebraria barras de progresso e medias de '
                || 'execucao do plano. CONTRASTE IMPORTANTE: este caso PASSA (o CHECK existe aqui), mas o '
                || 'caso equivalente em Metas (META-012) FALHA — la o mesmo CHECK nao foi aplicado. Mesma '
                || 'regra, dois modulos, comportamentos opostos: evidencia de que a equipe conhece a boa '
                || 'pratica (esta implementada aqui) mas nao a replicou de forma consistente.'
  WHERE codigo='ACAO-013';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que apagar uma acao apaga suas tarefas junto (CASCADE). Regra: '
             || 'acao_id ON DELETE CASCADE — uma tarefa nao existe sem a acao a que pertence. Importa '
             || 'porque tarefas orfas seriam passos sem objetivo, lixo sem contexto.',
    pre_condicoes = 'Precisa existir uma acao com pelo menos uma tarefa.',
    passos = '[
      {"ordem":1,"acao":"Criar uma acao com uma tarefa","onde_na_tela":"Plano de Acao","dados":"Acao: Acao Teste | Tarefa: uma tarefa qualquer","resultado_esperado":"Tarefa pertence a acao"},
      {"ordem":2,"acao":"Apagar a acao","onde_na_tela":"Plano de Acao > abrir a acao > Excluir","dados":"-","resultado_esperado":"Acao apagada"},
      {"ordem":3,"acao":"Conferir a tarefa","onde_na_tela":"-","dados":"-","resultado_esperado":"A tarefa foi apagada JUNTO com a acao (nao sobra orfa)"}
    ]'::jsonb,
    resultado_esperado = 'A acao e apagada e suas tarefas somem junto (CASCADE). Nenhuma tarefa orfa sobra.',
    observacoes = 'IMPACTO SE FALHAR: tarefas orfas seriam passos de execucao sem acao a que pertencem — '
                || 'apareceriam em listas de pendencias sem fazer sentido. O CASCADE mantem a limpeza.'
  WHERE codigo='ACAO-014';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que uma acao de um cliente e invisivel para outro. Regra: isolamento '
             || 'multi-tenant. Importa porque o plano de acao revela os problemas identificados e as '
             || 'pendencias de SST de um cliente — informacao sensivel, inclusive do ponto de vista legal.',
    pre_condicoes = 'Dois clientes distintos no sistema.',
    passos = '[
      {"ordem":1,"acao":"No cliente A, criar uma acao","onde_na_tela":"Cliente A > Plano de Acao > Nova Acao","dados":"Titulo: Acao secreta do cliente A","resultado_esperado":"Criada no cliente A"},
      {"ordem":2,"acao":"Entrar como cliente B e procurar","onde_na_tela":"Cliente B > Plano de Acao","dados":"Procurar pela acao do cliente A","resultado_esperado":"NAO aparece para o cliente B"}
    ]'::jsonb,
    resultado_esperado = 'A acao do cliente A e invisivel no cliente B. Zero vazamento.',
    observacoes = 'IMPACTO SE FALHAR: exporia os problemas de SST identificados e as pendencias de um '
                || 'cliente a outro — informacao sensivel com implicacoes legais. Protecao RLS por tenant.'
  WHERE codigo='ACAO-022';

  RAISE NOTICE 'Modulos METAS (8) e PLANO DE ACAO (9) detalhados. Bloco Planejamento & Gestao COMPLETO no padrao.';
END $d$;

SELECT codigo, left(objetivo,42) AS objetivo, jsonb_array_length(passos) AS passos,
       (observacoes IS NOT NULL) AS impacto
FROM public.qa_casos_teste
WHERE codigo LIKE 'META-%' OR codigo LIKE 'ACAO-%'
ORDER BY codigo;
