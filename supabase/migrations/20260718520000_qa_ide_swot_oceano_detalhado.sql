-- =========================================================
-- QA — Módulos IDENTIDADE ESTRATEGICA, SWOT e OCEANO AZUL DETALHADOS (22 casos)
-- Abre o detalhamento do bloco Planejamento & Gestão.
--
-- Padrao aprovado: objetivo (regra+porque), pre_condicoes, passos com dados
-- exatos+tela, resultado_esperado, observacoes (impacto+correcao).
-- Destaques: IDE-020 (singleton por empresa), a matriz ERRC do Oceano, e a
-- conexao SWOT<->Oceano (OCEANO-003/013).
-- =========================================================

DO $d$
DECLARE v_ide uuid; v_pe uuid;
BEGIN
  SELECT id INTO v_ide FROM public.qa_modulos WHERE path='planejamento-gestao/identidade-estrategica';
  SELECT id INTO v_pe  FROM public.qa_modulos WHERE path='planejamento-gestao/planejamento-estrategico';
  IF v_ide IS NULL OR v_pe IS NULL THEN RAISE EXCEPTION 'Modulos ide/pe nao encontrados.'; END IF;

  -- ═══════════════ IDENTIDADE ESTRATEGICA ═══════════════

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que o cliente pode definir a identidade estrategica (missao e visao) da empresa. '
             || 'Regra: a identidade guarda missao, visao e valores. Importa porque a identidade e a base '
             || 'do planejamento — orienta metas, cultura e decisoes; e o "porque a empresa existe".',
    pre_condicoes = 'Precisa existir uma empresa cadastrada (a identidade e por empresa).',
    passos = '[
      {"ordem":1,"acao":"Abrir a identidade estrategica","onde_na_tela":"Menu > Planejamento e Gestao > Identidade Estrategica","dados":"-","resultado_esperado":"Tela de identidade aberta"},
      {"ordem":2,"acao":"Preencher missao e visao","onde_na_tela":"Campos Missao e Visao","dados":"Missao: Proteger vidas no trabalho | Visao: Ser referencia em SST no Brasil","resultado_esperado":"Campos aceitos"},
      {"ordem":3,"acao":"Salvar","onde_na_tela":"Botao Salvar","dados":"-","resultado_esperado":"Identidade gravada com missao e visao"}
    ]'::jsonb,
    resultado_esperado = 'A empresa passa a ter uma identidade com a missao e a visao definidas.',
    observacoes = 'IMPACTO SE FALHAR: sem identidade, o planejamento estrategico perde a ancora — metas e '
                || 'cultura ficam sem direcao definida.'
  WHERE codigo='IDE-001';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que os valores da empresa sao guardados como uma lista. Regra: valores sao '
             || 'multiplos (ex.: Seguranca, Etica, Cuidado) e ficam numa lista (JSONB). Importa porque os '
             || 'valores orientam a cultura e o comportamento esperado — precisam ser varios, nao um so.',
    pre_condicoes = 'Tela de identidade disponivel.',
    passos = '[
      {"ordem":1,"acao":"Abrir a identidade e ir aos valores","onde_na_tela":"Identidade Estrategica > secao Valores","dados":"-","resultado_esperado":"Campo de valores disponivel"},
      {"ordem":2,"acao":"Adicionar tres valores","onde_na_tela":"Lista de Valores > adicionar item","dados":"Valores: Seguranca, Etica, Cuidado","resultado_esperado":"Os tres valores aparecem na lista"},
      {"ordem":3,"acao":"Salvar e reabrir","onde_na_tela":"Salvar > reabrir","dados":"-","resultado_esperado":"Os tres valores foram guardados"}
    ]'::jsonb,
    resultado_esperado = 'A identidade guarda os tres valores como uma lista. Ao reabrir, os tres estao la.',
    observacoes = 'IMPACTO SE FALHAR: se os valores nao forem guardados como lista, a empresa nao consegue '
                || 'registrar seus multiplos valores culturais corretamente.'
  WHERE codigo='IDE-002';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que a missao da identidade pode ser editada. Regra: a identidade e editavel. '
             || 'Importa porque missao e visao sao revisadas ao longo do tempo (mudancas de estrategia) e '
             || 'precisam poder ser atualizadas.',
    pre_condicoes = 'Precisa existir uma identidade ja definida.',
    passos = '[
      {"ordem":1,"acao":"Abrir a identidade existente","onde_na_tela":"Identidade Estrategica","dados":"-","resultado_esperado":"Missao atual exibida"},
      {"ordem":2,"acao":"Alterar a missao","onde_na_tela":"Campo Missao","dados":"Nova missao: Proteger vidas e promover saude no trabalho","resultado_esperado":"Campo aceita o novo texto"},
      {"ordem":3,"acao":"Salvar e conferir","onde_na_tela":"Salvar > reabrir","dados":"-","resultado_esperado":"A missao nova esta gravada"}
    ]'::jsonb,
    resultado_esperado = 'A missao e atualizada para o novo texto e persiste.',
    observacoes = 'IMPACTO SE FALHAR: se a edicao nao persistir, a empresa fica presa a uma missao antiga '
                || 'apos uma revisao estrategica.'
  WHERE codigo='IDE-003';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que a identidade pode ser salva so com a missao, deixando a visao para depois. '
             || 'Regra: os campos sao opcionais — da para preencher aos poucos. Importa porque o cliente '
             || 'muitas vezes define a missao primeiro e a visao numa etapa seguinte do planejamento.',
    pre_condicoes = 'Precisa existir uma empresa.',
    passos = '[
      {"ordem":1,"acao":"Abrir a identidade","onde_na_tela":"Identidade Estrategica","dados":"-","resultado_esperado":"Tela aberta"},
      {"ordem":2,"acao":"Preencher SO a missao, deixar a visao vazia","onde_na_tela":"Campo Missao (Visao vazia)","dados":"Missao: Cuidar de quem trabalha | Visao: (vazia)","resultado_esperado":"Aceito sem exigir a visao"},
      {"ordem":3,"acao":"Salvar","onde_na_tela":"Salvar","dados":"-","resultado_esperado":"Identidade salva so com missao"}
    ]'::jsonb,
    resultado_esperado = 'A identidade e salva apenas com a missao. A visao pode ser preenchida depois, sem '
                       || 'erro.',
    observacoes = 'IMPACTO SE FALHAR: se a visao fosse obrigatoria, o cliente nao poderia salvar o '
                || 'progresso parcial do planejamento — teria que ter tudo pronto de uma vez.'
  WHERE codigo='IDE-010';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que a identidade aceita comecar com a lista de valores vazia. Regra: a lista de '
             || 'valores pode iniciar vazia. Importa porque os valores podem ser definidos numa etapa '
             || 'posterior, sem impedir de salvar a identidade antes.',
    pre_condicoes = 'Precisa existir uma empresa.',
    passos = '[
      {"ordem":1,"acao":"Abrir a identidade","onde_na_tela":"Identidade Estrategica","dados":"-","resultado_esperado":"Tela aberta"},
      {"ordem":2,"acao":"Preencher missao mas nao adicionar nenhum valor","onde_na_tela":"Missao preenchida, lista de Valores vazia","dados":"Missao: Missao teste | Valores: (nenhum)","resultado_esperado":"Aceito com valores vazios"},
      {"ordem":3,"acao":"Salvar","onde_na_tela":"Salvar","dados":"-","resultado_esperado":"Identidade salva com lista de valores vazia"}
    ]'::jsonb,
    resultado_esperado = 'A identidade e salva com a lista de valores vazia, sem erro. Os valores podem ser '
                       || 'adicionados depois.',
    observacoes = 'IMPACTO SE FALHAR: se a lista de valores nao pudesse ser vazia, travaria salvar a '
                || 'identidade antes de os valores serem definidos.'
  WHERE codigo='IDE-011';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que NAO da para criar duas identidades para a MESMA empresa. Regra: '
             || 'UNIQUE(tenant_id, empresa_id) — cada empresa tem UMA identidade. Um cliente com varias '
             || 'empresas tem uma identidade por empresa. Importa porque duas missoes/visoes para a mesma '
             || 'empresa seriam contraditorias — qual vale?',
    pre_condicoes = 'Precisa existir uma empresa que ja tenha uma identidade definida.',
    passos = '[
      {"ordem":1,"acao":"Definir a identidade de uma empresa","onde_na_tela":"Empresa X > Identidade Estrategica","dados":"Empresa: Alfa | Missao: Primeira missao","resultado_esperado":"Identidade da Alfa criada"},
      {"ordem":2,"acao":"Tentar criar uma SEGUNDA identidade para a MESMA empresa Alfa","onde_na_tela":"Alfa > tentar nova Identidade","dados":"Empresa: Alfa (a mesma) | Missao: Segunda missao","resultado_esperado":"O sistema DEVE recusar — a Alfa ja tem identidade"}
    ]'::jsonb,
    resultado_esperado = 'A segunda identidade para a mesma empresa e recusada. Cada empresa tem exatamente '
                       || 'uma identidade.',
    observacoes = 'IMPACTO SE FALHAR: duas identidades para a mesma empresa gerariam missoes/visoes '
                || 'conflitantes, sem saber qual e a oficial. NOTA: esta regra mudou em mai/2026 — antes '
                || 'era uma identidade por CLIENTE, agora e uma por EMPRESA (cliente com varias empresas '
                || 'tem uma para cada). O indice unico (tenant_id, empresa_id) garante.'
  WHERE codigo='IDE-020';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que a identidade de um cliente e invisivel para outro. Regra: isolamento '
             || 'multi-tenant. Importa porque a missao, visao e valores de um cliente sao informacao '
             || 'estrategica que nao pode vazar para outro.',
    pre_condicoes = 'Dois clientes distintos no sistema.',
    passos = '[
      {"ordem":1,"acao":"No cliente A, definir uma identidade","onde_na_tela":"Cliente A > Identidade Estrategica","dados":"Missao: Missao secreta do cliente A","resultado_esperado":"Identidade criada no cliente A"},
      {"ordem":2,"acao":"Entrar como cliente B e consultar a identidade","onde_na_tela":"Cliente B > Identidade Estrategica","dados":"-","resultado_esperado":"A identidade do cliente A NAO aparece para o cliente B"}
    ]'::jsonb,
    resultado_esperado = 'A identidade do cliente A e invisivel no cliente B. Zero vazamento.',
    observacoes = 'IMPACTO SE FALHAR: exporia a estrategia (missao, visao, valores) de um cliente a outro. '
                || 'Protecao RLS por tenant.'
  WHERE codigo='IDE-022';

  -- ═══════════════ SWOT ═══════════════

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar a criacao de uma analise SWOT. Regra: a matriz SWOT tem um titulo e reune '
             || 'forcas, fraquezas, oportunidades e ameacas. Importa porque a SWOT e a ferramenta base do '
             || 'diagnostico estrategico — orienta o planejamento a partir do cenario atual.',
    pre_condicoes = 'Usuario com acesso ao planejamento estrategico.',
    passos = '[
      {"ordem":1,"acao":"Abrir o planejamento estrategico e criar uma SWOT","onde_na_tela":"Menu > Planejamento e Gestao > Planejamento Estrategico > Nova Analise SWOT","dados":"-","resultado_esperado":"Formulario de SWOT aberto"},
      {"ordem":2,"acao":"Dar um titulo a analise","onde_na_tela":"Campo Titulo","dados":"Titulo: Planejamento 2026","resultado_esperado":"Campo aceito"},
      {"ordem":3,"acao":"Salvar","onde_na_tela":"Salvar","dados":"-","resultado_esperado":"Matriz SWOT criada"}
    ]'::jsonb,
    resultado_esperado = 'A analise SWOT Planejamento 2026 existe e esta pronta para receber itens.',
    observacoes = 'IMPACTO SE FALHAR: sem criar a SWOT, nao ha diagnostico estrategico estruturado — o '
                || 'planejamento perde a ferramenta base de analise de cenario.'
  WHERE codigo='SWOT-001';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que os 4 tipos de item da SWOT (forca, fraqueza, oportunidade, ameaca) sao '
             || 'guardados. Regra: cada item tem um tipo entre esses quatro, formando a matriz. Importa '
             || 'porque a SWOT so faz sentido com os quatro quadrantes preenchidos — e a essencia da '
             || 'ferramenta.',
    pre_condicoes = 'Precisa existir uma matriz SWOT criada.',
    passos = '[
      {"ordem":1,"acao":"Abrir a SWOT e adicionar um item de cada tipo","onde_na_tela":"SWOT > adicionar item em cada quadrante","dados":"Forca: Equipe qualificada | Fraqueza: Processos manuais | Oportunidade: Novo mercado | Ameaca: Concorrencia","resultado_esperado":"Os quatro itens sao adicionados nos quadrantes certos"},
      {"ordem":2,"acao":"Salvar e conferir","onde_na_tela":"Salvar > visualizar a matriz","dados":"-","resultado_esperado":"Os 4 itens aparecem, um em cada quadrante"}
    ]'::jsonb,
    resultado_esperado = 'A SWOT tem 4 itens, um de cada tipo (forca, fraqueza, oportunidade, ameaca), nos '
                       || 'quadrantes corretos.',
    observacoes = 'IMPACTO SE FALHAR: se os tipos nao forem guardados corretamente, a matriz SWOT fica '
                || 'incompleta ou com itens no quadrante errado — o diagnostico perde o sentido.'
  WHERE codigo='SWOT-002';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que o titulo de uma SWOT pode ser editado. Regra: a matriz e editavel. Importa '
             || 'porque analises sao renomeadas e revisadas ao longo do planejamento.',
    pre_condicoes = 'Precisa existir uma SWOT criada.',
    passos = '[
      {"ordem":1,"acao":"Abrir uma SWOT existente","onde_na_tela":"Planejamento Estrategico > abrir a SWOT","dados":"-","resultado_esperado":"Titulo atual exibido"},
      {"ordem":2,"acao":"Alterar o titulo","onde_na_tela":"Campo Titulo","dados":"Novo titulo: Planejamento 2026 - Revisado","resultado_esperado":"Campo aceita"},
      {"ordem":3,"acao":"Salvar e conferir","onde_na_tela":"Salvar > reabrir","dados":"-","resultado_esperado":"O titulo novo esta gravado"}
    ]'::jsonb,
    resultado_esperado = 'O titulo da SWOT e atualizado e persiste.',
    observacoes = 'IMPACTO SE FALHAR: analises ficariam com titulos desatualizados apos revisoes.'
  WHERE codigo='SWOT-003';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que uma SWOT sem titulo e recusada. Regra: titulo e NOT NULL. Importa porque '
             || 'uma analise sem titulo nao pode ser identificada entre varias.',
    pre_condicoes = 'Nenhuma.',
    passos = '[
      {"ordem":1,"acao":"Iniciar uma nova SWOT","onde_na_tela":"Planejamento Estrategico > Nova Analise SWOT","dados":"-","resultado_esperado":"Formulario aberto"},
      {"ordem":2,"acao":"Deixar o titulo vazio e tentar salvar","onde_na_tela":"Campo Titulo (vazio) + Salvar","dados":"Titulo: (vazio)","resultado_esperado":"O sistema DEVE recusar"}
    ]'::jsonb,
    resultado_esperado = 'A SWOT sem titulo e recusada. Nenhuma analise sem titulo e criada.',
    observacoes = 'IMPACTO SE FALHAR: analises sem titulo ficam indistinguiveis numa lista de varias SWOTs.'
  WHERE codigo='SWOT-010';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que um item de SWOT com tipo invalido e recusado. Regra: tipo so aceita forca, '
             || 'fraqueza, oportunidade ou ameaca (enum). Importa porque um tipo fora desses quebraria a '
             || 'organizacao da matriz em quadrantes.',
    pre_condicoes = 'Precisa existir uma matriz SWOT.',
    passos = '[
      {"ordem":1,"acao":"Abrir uma SWOT e tentar adicionar um item com tipo invalido","onde_na_tela":"SWOT > adicionar item","dados":"Tipo: neutro (invalido — nao e um dos 4) | Descricao: item invalido","resultado_esperado":"O sistema DEVE recusar o tipo fora da lista"}
    ]'::jsonb,
    resultado_esperado = 'O item com tipo neutro e recusado. So os 4 tipos validos sao aceitos.',
    observacoes = 'IMPACTO SE FALHAR: um tipo invalido quebraria a organizacao da matriz em quadrantes — o '
                || 'item nao saberia onde aparecer.'
  WHERE codigo='SWOT-011';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que apagar a matriz SWOT apaga seus itens junto (CASCADE). Regra: '
             || 'ON DELETE CASCADE — os itens nao existem sem a matriz. Importa porque um item de SWOT '
             || 'solto, sem a matriz a que pertence, seria lixo sem contexto.',
    pre_condicoes = 'Precisa existir uma SWOT com pelo menos um item.',
    passos = '[
      {"ordem":1,"acao":"Criar uma SWOT com um item","onde_na_tela":"Planejamento Estrategico","dados":"SWOT: Analise Teste | Item: uma forca qualquer","resultado_esperado":"Item pertence a matriz"},
      {"ordem":2,"acao":"Apagar a matriz SWOT","onde_na_tela":"SWOT > Excluir analise","dados":"-","resultado_esperado":"Matriz apagada"},
      {"ordem":3,"acao":"Conferir o item","onde_na_tela":"-","dados":"-","resultado_esperado":"O item foi apagado JUNTO com a matriz (nao sobra orfao)"}
    ]'::jsonb,
    resultado_esperado = 'A matriz SWOT e apagada e seus itens somem junto (CASCADE). Nenhum item orfao '
                       || 'sobra.',
    observacoes = 'IMPACTO SE FALHAR: itens de SWOT orfaos (sem matriz) seriam lixo sem contexto na base. '
                || 'O CASCADE mantem a limpeza.'
  WHERE codigo='SWOT-013';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que uma SWOT de um cliente e invisivel para outro. Regra: isolamento '
             || 'multi-tenant. Importa porque o diagnostico estrategico (forcas, fraquezas) de um cliente '
             || 'e altamente sensivel e nao pode vazar.',
    pre_condicoes = 'Dois clientes distintos no sistema.',
    passos = '[
      {"ordem":1,"acao":"No cliente A, criar uma SWOT","onde_na_tela":"Cliente A > Planejamento Estrategico > Nova SWOT","dados":"Titulo: SWOT secreta do cliente A","resultado_esperado":"Criada no cliente A"},
      {"ordem":2,"acao":"Entrar como cliente B e procurar","onde_na_tela":"Cliente B > Planejamento Estrategico","dados":"Procurar pela SWOT do cliente A","resultado_esperado":"NAO aparece para o cliente B"}
    ]'::jsonb,
    resultado_esperado = 'A SWOT do cliente A e invisivel no cliente B. Zero vazamento.',
    observacoes = 'IMPACTO SE FALHAR: exporia o diagnostico estrategico (forcas, fraquezas, ameacas) de um '
                || 'cliente a outro — informacao muito sensivel. Protecao RLS por tenant.'
  WHERE codigo='SWOT-022';

  -- ═══════════════ OCEANO AZUL ═══════════════

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar a criacao de uma analise Oceano Azul. Regra: a matriz Oceano Azul tem um '
             || 'titulo e organiza acoes nos 4 quadrantes ERRC. Importa porque o Oceano Azul e a '
             || 'ferramenta de estrategia para criar novos espacos de mercado — complementa a SWOT.',
    pre_condicoes = 'Usuario com acesso ao planejamento estrategico.',
    passos = '[
      {"ordem":1,"acao":"Abrir o planejamento estrategico e criar uma analise Oceano Azul","onde_na_tela":"Planejamento Estrategico > Nova Analise Oceano Azul","dados":"-","resultado_esperado":"Formulario aberto"},
      {"ordem":2,"acao":"Dar um titulo","onde_na_tela":"Campo Titulo","dados":"Titulo: Novo Mercado 2026","resultado_esperado":"Campo aceito"},
      {"ordem":3,"acao":"Salvar","onde_na_tela":"Salvar","dados":"-","resultado_esperado":"Matriz Oceano Azul criada"}
    ]'::jsonb,
    resultado_esperado = 'A analise Oceano Azul Novo Mercado 2026 existe e esta pronta para receber itens.',
    observacoes = 'IMPACTO SE FALHAR: sem a analise Oceano Azul, o cliente perde a ferramenta de estrategia '
                || 'para criar diferenciacao e novos espacos de mercado.'
  WHERE codigo='OCEANO-001';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que os itens dos 4 quadrantes ERRC (Eliminar, Reduzir, Elevar, Criar) sao '
             || 'guardados. Regra: cada item pertence a um dos quatro quadrantes da matriz ERRC — a '
             || 'essencia do metodo Oceano Azul. Importa porque e o ERRC que estrutura a estrategia de '
             || 'diferenciacao (o que eliminar, reduzir, elevar e criar em relacao ao mercado).',
    pre_condicoes = 'Precisa existir uma matriz Oceano Azul criada.',
    passos = '[
      {"ordem":1,"acao":"Abrir a matriz e adicionar um item em cada quadrante ERRC","onde_na_tela":"Oceano Azul > adicionar item em cada quadrante","dados":"Eliminar: Burocracia excessiva | Reduzir: Custo operacional | Elevar: Qualidade do atendimento | Criar: Servico inovador","resultado_esperado":"Os quatro itens sao adicionados nos quadrantes certos"},
      {"ordem":2,"acao":"Salvar e conferir","onde_na_tela":"Salvar > visualizar a matriz","dados":"-","resultado_esperado":"Os 4 itens aparecem, um em cada quadrante ERRC"}
    ]'::jsonb,
    resultado_esperado = 'A matriz Oceano Azul tem 4 itens, um em cada quadrante ERRC (eliminar, reduzir, '
                       || 'elevar, criar).',
    observacoes = 'IMPACTO SE FALHAR: se os quadrantes nao forem guardados corretamente, a matriz ERRC '
                || 'fica incompleta — a estrategia de diferenciacao perde a estrutura.'
  WHERE codigo='OCEANO-002';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que uma analise Oceano Azul pode NASCER de uma SWOT (referenciar a SWOT de '
             || 'origem). Regra: o Oceano pode apontar para uma SWOT via swot_id. Importa porque as duas '
             || 'ferramentas se conectam — o Oceano Azul aprofunda o diagnostico da SWOT, e essa ligacao '
             || 'mantem a linha de raciocinio estrategico.',
    pre_condicoes = 'Precisa existir uma SWOT para servir de origem.',
    passos = '[
      {"ordem":1,"acao":"Ter uma SWOT ja criada","onde_na_tela":"Planejamento Estrategico","dados":"SWOT: Analise de origem","resultado_esperado":"SWOT existe"},
      {"ordem":2,"acao":"Criar um Oceano Azul indicando essa SWOT como origem","onde_na_tela":"Nova Analise Oceano Azul > campo SWOT de origem","dados":"Titulo: Oceano da Analise | SWOT de origem: Analise de origem","resultado_esperado":"O Oceano e criado vinculado a SWOT"},
      {"ordem":3,"acao":"Conferir o vinculo","onde_na_tela":"Propriedades do Oceano","dados":"-","resultado_esperado":"O Oceano aparece ligado a SWOT de origem"}
    ]'::jsonb,
    resultado_esperado = 'O Oceano Azul referencia a SWOT de origem. As duas analises ficam conectadas.',
    observacoes = 'IMPACTO SE FALHAR: sem o vinculo, o Oceano Azul viraria uma analise isolada, perdendo a '
                || 'conexao com o diagnostico da SWOT que o originou.'
  WHERE codigo='OCEANO-003';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que um Oceano Azul sem titulo e recusado. Regra: titulo e NOT NULL. Importa '
             || 'porque uma analise sem titulo nao pode ser identificada.',
    pre_condicoes = 'Nenhuma.',
    passos = '[
      {"ordem":1,"acao":"Iniciar uma nova analise Oceano Azul","onde_na_tela":"Planejamento Estrategico > Nova Analise Oceano Azul","dados":"-","resultado_esperado":"Formulario aberto"},
      {"ordem":2,"acao":"Deixar o titulo vazio e tentar salvar","onde_na_tela":"Campo Titulo (vazio) + Salvar","dados":"Titulo: (vazio)","resultado_esperado":"O sistema DEVE recusar"}
    ]'::jsonb,
    resultado_esperado = 'O Oceano sem titulo e recusado. Nenhuma analise sem titulo e criada.',
    observacoes = 'IMPACTO SE FALHAR: analises sem titulo ficam indistinguiveis numa lista.'
  WHERE codigo='OCEANO-010';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que um item do Oceano com quadrante invalido e recusado. Regra: quadrante so '
             || 'aceita eliminar, reduzir, elevar ou criar (enum ERRC). Importa porque um quadrante fora '
             || 'desses quebraria a estrutura da matriz ERRC.',
    pre_condicoes = 'Precisa existir uma matriz Oceano Azul.',
    passos = '[
      {"ordem":1,"acao":"Abrir uma matriz e tentar adicionar item com quadrante invalido","onde_na_tela":"Oceano Azul > adicionar item","dados":"Quadrante: manter (invalido — nao e ERRC) | Descricao: item invalido","resultado_esperado":"O sistema DEVE recusar"}
    ]'::jsonb,
    resultado_esperado = 'O item com quadrante manter e recusado. So os 4 quadrantes ERRC sao aceitos.',
    observacoes = 'IMPACTO SE FALHAR: um quadrante invalido quebraria a estrutura ERRC — o item nao '
                || 'saberia em qual coluna aparecer.'
  WHERE codigo='OCEANO-011';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que apagar a SWOT de origem apenas DESASSOCIA o Oceano, sem apaga-lo. Regra: '
             || 'swot_id ON DELETE SET NULL — o Oceano sobrevive sem a SWOT. Importa porque apagar a SWOT '
             || 'de origem nao deveria destruir a analise Oceano Azul que ja evoluiu por conta propria.',
    pre_condicoes = 'Precisa existir um Oceano Azul vinculado a uma SWOT de origem.',
    passos = '[
      {"ordem":1,"acao":"Ter um Oceano ligado a uma SWOT","onde_na_tela":"Planejamento Estrategico","dados":"SWOT: Origem | Oceano: Oceano Orfao, ligado a Origem","resultado_esperado":"Oceano vinculado a SWOT"},
      {"ordem":2,"acao":"Apagar a SWOT de origem","onde_na_tela":"SWOT Origem > Excluir","dados":"-","resultado_esperado":"SWOT apagada"},
      {"ordem":3,"acao":"Conferir o Oceano","onde_na_tela":"Oceano Orfao","dados":"-","resultado_esperado":"O Oceano AINDA EXISTE, agora sem a SWOT de origem (desassociado, nao apagado)"}
    ]'::jsonb,
    resultado_esperado = 'A SWOT de origem e apagada, mas o Oceano Azul sobrevive, agora sem vinculo. A '
                       || 'analise nao foi destruida (SET NULL).',
    observacoes = 'IMPACTO SE FALHAR: se apagar a SWOT apagasse o Oceano junto, perder-se-ia uma analise '
                || 'que ja tinha valor proprio. O SET NULL preserva o Oceano, so remove o vinculo.'
  WHERE codigo='OCEANO-013';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que apagar a matriz Oceano apaga seus itens junto (CASCADE). Regra: '
             || 'oceano_id ON DELETE CASCADE — os itens nao existem sem a matriz. Importa porque um item '
             || 'ERRC solto, sem a matriz, seria lixo sem contexto.',
    pre_condicoes = 'Precisa existir um Oceano Azul com pelo menos um item.',
    passos = '[
      {"ordem":1,"acao":"Criar um Oceano com um item","onde_na_tela":"Planejamento Estrategico","dados":"Oceano: Matriz Teste | Item: um item em Criar","resultado_esperado":"Item pertence a matriz"},
      {"ordem":2,"acao":"Apagar a matriz Oceano","onde_na_tela":"Oceano > Excluir","dados":"-","resultado_esperado":"Matriz apagada"},
      {"ordem":3,"acao":"Conferir o item","onde_na_tela":"-","dados":"-","resultado_esperado":"O item foi apagado JUNTO com a matriz"}
    ]'::jsonb,
    resultado_esperado = 'A matriz Oceano e apagada e seus itens somem junto (CASCADE). Nenhum item orfao '
                       || 'sobra.',
    observacoes = 'IMPACTO SE FALHAR: itens ERRC orfaos seriam lixo sem contexto. O CASCADE mantem a '
                || 'limpeza. (Note o contraste com OCEANO-013: a SWOT de origem e SET NULL, mas os itens '
                || 'da propria matriz sao CASCADE — logicas diferentes para relacoes diferentes.)'
  WHERE codigo='OCEANO-014';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que um Oceano Azul de um cliente e invisivel para outro. Regra: isolamento '
             || 'multi-tenant. Importa porque a estrategia de diferenciacao de um cliente e sensivel e '
             || 'nao pode vazar.',
    pre_condicoes = 'Dois clientes distintos no sistema.',
    passos = '[
      {"ordem":1,"acao":"No cliente A, criar um Oceano Azul","onde_na_tela":"Cliente A > Planejamento Estrategico > Nova Analise Oceano Azul","dados":"Titulo: Oceano secreto do cliente A","resultado_esperado":"Criado no cliente A"},
      {"ordem":2,"acao":"Entrar como cliente B e procurar","onde_na_tela":"Cliente B > Planejamento Estrategico","dados":"Procurar pelo Oceano do cliente A","resultado_esperado":"NAO aparece para o cliente B"}
    ]'::jsonb,
    resultado_esperado = 'O Oceano do cliente A e invisivel no cliente B. Zero vazamento.',
    observacoes = 'IMPACTO SE FALHAR: exporia a estrategia de diferenciacao de um cliente a outro. '
                || 'Protecao RLS por tenant.'
  WHERE codigo='OCEANO-022';

  RAISE NOTICE 'Modulos IDENTIDADE (7), SWOT (7) e OCEANO (8) detalhados.';
END $d$;

SELECT codigo, left(objetivo,42) AS objetivo, jsonb_array_length(passos) AS passos,
       (observacoes IS NOT NULL) AS impacto
FROM public.qa_casos_teste
WHERE codigo LIKE 'IDE-%' OR codigo LIKE 'SWOT-%' OR codigo LIKE 'OCEANO-%'
ORDER BY codigo;
