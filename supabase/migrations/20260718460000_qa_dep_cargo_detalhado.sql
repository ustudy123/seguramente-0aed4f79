-- =========================================================
-- QA — Módulos DEPARTAMENTOS e CARGOS DETALHADOS (11 casos)
-- Bloco Estrutura Organizacional. Dois modulos que trabalham juntos:
-- um cargo pertence a um departamento.
--
-- Padrao aprovado: objetivo (regra+porque), pre_condicoes, passos com dados
-- exatos+tela, resultado_esperado, observacoes (impacto+correcao).
-- CARGO-012 guarda um ACHADO (salario min>max aceito).
-- =========================================================

DO $d$
DECLARE v_dep uuid; v_cargo uuid;
BEGIN
  SELECT id INTO v_dep FROM public.qa_modulos WHERE path='estrutura-organizacional/departamentos';
  SELECT id INTO v_cargo FROM public.qa_modulos WHERE path='estrutura-organizacional/cargos';
  IF v_dep IS NULL OR v_cargo IS NULL THEN RAISE EXCEPTION 'Modulos dep/cargo nao encontrados.'; END IF;

  -- ═══════════════ DEPARTAMENTOS ═══════════════

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar o cadastro basico de um departamento. Regra: departamento precisa de um nome '
             || 'unico no cliente. Importa porque departamentos organizam a estrutura — cargos e '
             || 'colaboradores se distribuem por eles; sao a base do organograma.',
    pre_condicoes = 'Usuario com permissao de administracao da estrutura.',
    passos = '[
      {"ordem":1,"acao":"Abrir o cadastro de departamento","onde_na_tela":"Menu > Estrutura Organizacional > Departamentos > Novo Departamento","dados":"-","resultado_esperado":"Formulario aberto"},
      {"ordem":2,"acao":"Preencher o nome","onde_na_tela":"Campo Nome","dados":"Nome: Recursos Humanos","resultado_esperado":"Campo aceita o valor"},
      {"ordem":3,"acao":"Salvar","onde_na_tela":"Botao Salvar","dados":"-","resultado_esperado":"Departamento criado e aparece na lista"}
    ]'::jsonb,
    resultado_esperado = 'O departamento Recursos Humanos existe e aparece na lista de departamentos do cliente.',
    observacoes = 'IMPACTO SE FALHAR: sem cadastrar departamentos, nao ha como organizar cargos e '
                || 'colaboradores por area — o organograma e os relatorios por setor ficam inviaveis.'
  WHERE codigo='DEP-001';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que o nome de um departamento pode ser editado e a alteracao persiste. Regra: '
             || 'dados do departamento sao editaveis. Importa porque areas sao renomeadas '
             || '(reestruturacoes) e o nome precisa refletir a realidade nos relatorios.',
    pre_condicoes = 'Precisa existir um departamento cadastrado.',
    passos = '[
      {"ordem":1,"acao":"Abrir um departamento para editar","onde_na_tela":"Departamentos > clicar no departamento > Editar","dados":"-","resultado_esperado":"Formulario com o nome atual"},
      {"ordem":2,"acao":"Alterar o nome","onde_na_tela":"Campo Nome","dados":"Novo nome: Gente e Gestao","resultado_esperado":"Campo aceita o novo valor"},
      {"ordem":3,"acao":"Salvar e conferir","onde_na_tela":"Salvar > reabrir","dados":"-","resultado_esperado":"O nome novo esta gravado"}
    ]'::jsonb,
    resultado_esperado = 'O nome do departamento e atualizado para Gente e Gestao e persiste.',
    observacoes = 'IMPACTO SE FALHAR: se a edicao nao persistir, o nome antigo continua aparecendo em '
                || 'relatorios e telas apos uma reestruturacao.'
  WHERE codigo='DEP-002';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que um departamento sem nome e recusado. Regra: nome e obrigatorio (NOT NULL). '
             || 'Importa porque um departamento sem nome aparece em branco nas listas e nao serve para '
             || 'organizar nada.',
    pre_condicoes = 'Nenhuma.',
    passos = '[
      {"ordem":1,"acao":"Abrir novo departamento","onde_na_tela":"Departamentos > Novo Departamento","dados":"-","resultado_esperado":"Formulario aberto"},
      {"ordem":2,"acao":"Deixar o nome vazio e tentar salvar","onde_na_tela":"Campo Nome (vazio) + Salvar","dados":"Nome: (vazio)","resultado_esperado":"O sistema DEVE recusar — nome e obrigatorio"}
    ]'::jsonb,
    resultado_esperado = 'O cadastro e recusado. Nenhum departamento sem nome e criado.',
    observacoes = 'IMPACTO SE FALHAR: departamento em branco polui as listas e os filtros por area — o '
                || 'usuario nao sabe do que se trata.'
  WHERE codigo='DEP-010';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que dois departamentos com o mesmo nome no mesmo cliente sao recusados. Regra: '
             || 'UNIQUE(tenant_id, nome) — o nome do departamento e unico dentro do cliente. Importa '
             || 'porque dois "Financeiro" no mesmo cliente confundem a que area um cargo ou colaborador '
             || 'pertence.',
    pre_condicoes = 'Precisa existir um departamento com um nome conhecido.',
    passos = '[
      {"ordem":1,"acao":"Criar um departamento","onde_na_tela":"Novo Departamento","dados":"Nome: Financeiro","resultado_esperado":"Criado"},
      {"ordem":2,"acao":"Tentar criar OUTRO com o mesmo nome","onde_na_tela":"Novo Departamento","dados":"Nome: Financeiro (repetido)","resultado_esperado":"O sistema DEVE recusar o nome duplicado"}
    ]'::jsonb,
    resultado_esperado = 'O segundo Financeiro e recusado. So existe um departamento com esse nome no cliente.',
    observacoes = 'IMPACTO SE FALHAR: departamentos de nome repetido tornam ambiguo a qual area cargos e '
                || 'pessoas pertencem, quebrando relatorios por setor.'
  WHERE codigo='DEP-011';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que o mesmo nome de departamento pode existir em clientes DIFERENTES. Regra: o '
             || 'UNIQUE e por tenant — a unicidade vale dentro de um cliente, nao entre clientes. Importa '
             || 'para nao restringir demais: "Financeiro" e um nome comum, varios clientes vao te-lo.',
    pre_condicoes = 'Dois clientes distintos no sistema.',
    passos = '[
      {"ordem":1,"acao":"No cliente A, criar departamento Financeiro","onde_na_tela":"Cliente A > Novo Departamento","dados":"Nome: Financeiro","resultado_esperado":"Criado no cliente A"},
      {"ordem":2,"acao":"No cliente B, criar departamento Financeiro","onde_na_tela":"Cliente B > Novo Departamento","dados":"Nome: Financeiro (mesmo nome, outro cliente)","resultado_esperado":"ACEITO — a unicidade e por cliente"}
    ]'::jsonb,
    resultado_esperado = 'Ambos os clientes tem um departamento Financeiro. O nome igual em clientes '
                       || 'diferentes convive sem conflito.',
    observacoes = 'IMPACTO SE FALHAR: se a unicidade fosse global, o segundo cliente nao poderia usar um '
                || 'nome comum ja usado por outro — restricao absurda que vazaria informacao entre clientes.'
  WHERE codigo='DEP-012';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que apagar um departamento que tem cargos apenas DESASSOCIA os cargos, sem '
             || 'apaga-los. Regra: ON DELETE SET NULL — o cargo perde o departamento (fica sem area), mas '
             || 'continua existindo. Importa porque apagar uma area nao deveria destruir os cargos que '
             || 'existiam nela; eles podem ser realocados.',
    pre_condicoes = 'Precisa existir um departamento com pelo menos um cargo ligado a ele.',
    passos = '[
      {"ordem":1,"acao":"Criar departamento e um cargo ligado a ele","onde_na_tela":"Departamentos e Cargos","dados":"Departamento: Operacoes | Cargo: Operador, ligado a Operacoes","resultado_esperado":"Cargo pertence ao departamento"},
      {"ordem":2,"acao":"Apagar o departamento Operacoes","onde_na_tela":"Departamentos > Operacoes > Excluir","dados":"-","resultado_esperado":"Departamento apagado"},
      {"ordem":3,"acao":"Conferir o cargo Operador","onde_na_tela":"Cargos > Operador","dados":"-","resultado_esperado":"O cargo Operador ainda existe, agora sem departamento (desassociado)"}
    ]'::jsonb,
    resultado_esperado = 'O departamento e apagado, mas o cargo Operador continua existindo, agora com '
                       || 'departamento vazio. Nada de cargo apagado junto.',
    observacoes = 'IMPACTO SE FALHAR: se apagar o departamento apagasse os cargos, uma reestruturacao de '
                || 'area destruiria cargos que so precisavam ser realocados — perda de configuracao. O '
                || 'SET NULL preserva os cargos.'
  WHERE codigo='DEP-013';

  -- ═══════════════ CARGOS ═══════════════

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar a criacao de um cargo ligado a um departamento, com faixa salarial. Regra: um '
             || 'cargo tem nome, pode ter faixa salarial e pode pertencer a um departamento. Importa '
             || 'porque cargos definem funcoes e faixas de remuneracao — base para folha e organograma.',
    pre_condicoes = 'Precisa existir um departamento para ligar o cargo (embora o vinculo seja opcional).',
    passos = '[
      {"ordem":1,"acao":"Abrir novo cargo","onde_na_tela":"Menu > Estrutura Organizacional > Cargos > Novo Cargo","dados":"-","resultado_esperado":"Formulario aberto"},
      {"ordem":2,"acao":"Preencher nome, faixa salarial e departamento","onde_na_tela":"Campos Nome, Salario Minimo, Salario Maximo, Departamento","dados":"Nome: Analista de RH | Min: 3000 | Max: 5000 | Departamento: Recursos Humanos","resultado_esperado":"Campos aceitos"},
      {"ordem":3,"acao":"Salvar","onde_na_tela":"Botao Salvar","dados":"-","resultado_esperado":"Cargo criado, ligado ao departamento, com a faixa salarial"}
    ]'::jsonb,
    resultado_esperado = 'O cargo Analista de RH existe, ligado a Recursos Humanos, com faixa de 3000 a 5000.',
    observacoes = 'IMPACTO SE FALHAR: sem cadastrar cargos, nao ha como definir funcoes e faixas '
                || 'salariais — a estrutura de remuneracao e o organograma ficam incompletos.'
  WHERE codigo='CARGO-001';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que um nome de cargo duplicado no mesmo cliente e recusado. Regra: '
             || 'UNIQUE(tenant_id, nome) — o nome do cargo e unico no cliente. Importa porque dois cargos '
             || '"Gerente" iguais confundem alocacao e relatorios de funcao.',
    pre_condicoes = 'Precisa existir um cargo com um nome conhecido.',
    passos = '[
      {"ordem":1,"acao":"Criar um cargo","onde_na_tela":"Novo Cargo","dados":"Nome: Gerente","resultado_esperado":"Criado"},
      {"ordem":2,"acao":"Tentar criar OUTRO cargo com o mesmo nome","onde_na_tela":"Novo Cargo","dados":"Nome: Gerente (repetido)","resultado_esperado":"O sistema DEVE recusar"}
    ]'::jsonb,
    resultado_esperado = 'O segundo Gerente e recusado. So um cargo com esse nome no cliente.',
    observacoes = 'IMPACTO SE FALHAR: cargos de nome repetido tornam ambiguo qual funcao uma pessoa ocupa, '
                || 'confundindo folha e relatorios de cargo.'
  WHERE codigo='CARGO-010';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que um cargo pode existir sem departamento. Regra: departamento_id e opcional '
             || 'no cargo. Importa porque nem todo cargo se encaixa numa area (ex.: cargos transversais) '
             || 'ou o departamento ainda nao foi definido.',
    pre_condicoes = 'Nenhuma.',
    passos = '[
      {"ordem":1,"acao":"Abrir novo cargo","onde_na_tela":"Cargos > Novo Cargo","dados":"-","resultado_esperado":"Formulario aberto"},
      {"ordem":2,"acao":"Preencher so o nome, deixar departamento em branco","onde_na_tela":"Campo Nome (Departamento vazio)","dados":"Nome: Consultor Externo | Departamento: (nenhum)","resultado_esperado":"Aceito sem departamento"},
      {"ordem":3,"acao":"Salvar","onde_na_tela":"Salvar","dados":"-","resultado_esperado":"Cargo criado sem departamento"}
    ]'::jsonb,
    resultado_esperado = 'O cargo Consultor Externo e criado sem departamento associado, sem erro.',
    observacoes = 'IMPACTO SE FALHAR: se o departamento fosse obrigatorio, cargos transversais ou ainda '
                || 'nao alocados nao poderiam ser cadastrados — trava desnecessaria.'
  WHERE codigo='CARGO-011';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar o que acontece ao informar faixa salarial com minimo MAIOR que o maximo. Regra '
             || 'esperada: o minimo deveria ser <= maximo. Este caso revela se o banco tem essa validacao '
             || 'de coerencia. Importa porque uma faixa invertida (min 8000, max 3000) e um dado sem '
             || 'sentido que distorce relatorios de remuneracao.',
    pre_condicoes = 'Formulario de cargo com os campos de salario.',
    passos = '[
      {"ordem":1,"acao":"Abrir novo cargo","onde_na_tela":"Cargos > Novo Cargo","dados":"-","resultado_esperado":"Formulario aberto"},
      {"ordem":2,"acao":"Informar faixa salarial INVERTIDA","onde_na_tela":"Campos Salario Minimo e Salario Maximo","dados":"Nome: Cargo Invertido | Salario Minimo: 8000 | Salario Maximo: 3000 (min > max, incoerente)","resultado_esperado":"Idealmente o sistema DEVERIA recusar (min nao pode ser maior que max)"}
    ]'::jsonb,
    resultado_esperado = 'A faixa invertida deveria ser RECUSADA. ACHADO ATUAL: o banco ACEITA min > max — '
                       || 'nao ha CHECK de coerencia entre salario minimo e maximo. Um cargo com faixa '
                       || 'sem sentido entra.',
    observacoes = 'IMPACTO SE FALHAR (e falha hoje): faixa salarial invertida distorce relatorios de '
                || 'remuneracao e faixas por cargo — calculos que assumem min<=max dao resultado errado. '
                || 'CORRECAO SUGERIDA: adicionar CHECK (salario_min IS NULL OR salario_max IS NULL OR '
                || 'salario_min <= salario_max) na tabela de cargos.'
  WHERE codigo='CARGO-012';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que um cargo de um cliente e invisivel para outro cliente. Regra: isolamento '
             || 'multi-tenant vale para cargos. Importa porque a estrutura de cargos e faixas salariais '
             || 'de um cliente e informacao sensivel que nao pode vazar para outro.',
    pre_condicoes = 'Dois clientes distintos no sistema.',
    passos = '[
      {"ordem":1,"acao":"No cliente A, criar um cargo","onde_na_tela":"Cliente A > Novo Cargo","dados":"Nome: Cargo Secreto do A | faixa 5000-9000","resultado_esperado":"Criado no cliente A"},
      {"ordem":2,"acao":"Entrar como cliente B e procurar esse cargo","onde_na_tela":"Cliente B > Cargos > busca","dados":"Buscar pelo nome do cargo do cliente A","resultado_esperado":"O cargo do cliente A NAO aparece para o cliente B"}
    ]'::jsonb,
    resultado_esperado = 'O cargo do cliente A e invisivel no cliente B. Zero vazamento de estrutura de '
                       || 'cargos e salarios entre clientes.',
    observacoes = 'IMPACTO SE FALHAR: exporia a estrutura de cargos e faixas salariais de um cliente para '
                || 'outro — informacao estrategica e sensivel. Protecao RLS por tenant.'
  WHERE codigo='CARGO-022';

  RAISE NOTICE 'Modulos DEPARTAMENTOS (6) e CARGOS (5) detalhados.';
END $d$;

SELECT codigo, left(objetivo,46) AS objetivo, jsonb_array_length(passos) AS passos,
       (observacoes IS NOT NULL) AS impacto
FROM public.qa_casos_teste
WHERE codigo LIKE 'DEP-%' OR codigo LIKE 'CARGO-%'
ORDER BY codigo;
