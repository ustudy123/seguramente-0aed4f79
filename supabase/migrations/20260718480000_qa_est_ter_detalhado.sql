-- =========================================================
-- QA — Módulos ESTABELECIMENTOS/OBRAS e TERCEIROS DETALHADOS (16 casos)
-- Bloco Estrutura Organizacional.
--
-- Padrao aprovado: objetivo (regra+porque), pre_condicoes, passos com dados
-- exatos+tela, resultado_esperado, observacoes (impacto+correcao).
-- TER-020 guarda um ACHADO (CNPJ de terceiro duplicado aceito).
-- Contraste importante: EST-013 e SET NULL (filial sobrevive), TER-013 e
-- CASCADE (trabalhadores somem junto) — logicas opostas, ambas corretas.
-- =========================================================

DO $d$
DECLARE v_est uuid; v_ter uuid;
BEGIN
  SELECT id INTO v_est FROM public.qa_modulos WHERE path='estrutura-organizacional/estabelecimentos';
  SELECT id INTO v_ter FROM public.qa_modulos WHERE path='estrutura-organizacional/prestadores';
  IF v_est IS NULL OR v_ter IS NULL THEN RAISE EXCEPTION 'Modulos est/ter nao encontrados.'; END IF;

  -- ═══════════════ ESTABELECIMENTOS / OBRAS ═══════════════

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar o cadastro basico de um estabelecimento ligado a uma empresa. Regra: um '
             || 'estabelecimento (filial, unidade, obra) pertence a uma empresa e tem nome. Importa '
             || 'porque estabelecimentos representam os locais fisicos da empresa — onde ha pessoas, '
             || 'riscos e obrigacoes de SST especificas por local.',
    pre_condicoes = 'Precisa existir uma empresa cadastrada para vincular o estabelecimento.',
    passos = '[
      {"ordem":1,"acao":"Abrir o cadastro de estabelecimento","onde_na_tela":"Menu > Estrutura Organizacional > Estabelecimentos > Novo","dados":"-","resultado_esperado":"Formulario aberto"},
      {"ordem":2,"acao":"Preencher nome e vincular a empresa","onde_na_tela":"Campos Nome e Empresa","dados":"Nome: Filial Centro | Empresa: Empresa Teste Ltda","resultado_esperado":"Campos aceitos"},
      {"ordem":3,"acao":"Salvar","onde_na_tela":"Botao Salvar","dados":"-","resultado_esperado":"Estabelecimento criado, ligado a empresa"}
    ]'::jsonb,
    resultado_esperado = 'O estabelecimento Filial Centro existe, vinculado a empresa, e aparece na lista.',
    observacoes = 'IMPACTO SE FALHAR: sem estabelecimentos, nao ha como organizar pessoas e riscos por '
                || 'local fisico — obrigacoes de SST especificas de cada unidade ficam sem base.'
  WHERE codigo='EST-001';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que uma filial do tipo OBRA aceita o campo CNO (Cadastro Nacional de Obras). '
             || 'Regra: obras da construcao civil tem um CNO que as identifica legalmente. Importa porque '
             || 'o CNO e obrigatorio para obrigacoes trabalhistas e previdenciarias de obras — sem ele, a '
             || 'obra nao esta em conformidade.',
    pre_condicoes = 'Precisa existir uma empresa. O tipo do estabelecimento sera obra.',
    passos = '[
      {"ordem":1,"acao":"Abrir novo estabelecimento e escolher tipo Obra","onde_na_tela":"Novo Estabelecimento > campo Tipo","dados":"Tipo: obra","resultado_esperado":"Ao escolher obra, o campo CNO aparece"},
      {"ordem":2,"acao":"Preencher nome e CNO","onde_na_tela":"Campos Nome e CNO","dados":"Nome: Obra Residencial Alfa | CNO: 12.345.67890/12","resultado_esperado":"Campos aceitos"},
      {"ordem":3,"acao":"Salvar e reabrir","onde_na_tela":"Salvar > reabrir a obra","dados":"-","resultado_esperado":"O CNO foi gravado e aparece ao reabrir"}
    ]'::jsonb,
    resultado_esperado = 'A obra e criada com o CNO gravado. Ao reabrir, o CNO esta la.',
    observacoes = 'IMPACTO SE FALHAR: sem gravar o CNO, a obra fica sem a identificacao legal exigida para '
                || 'obrigacoes trabalhistas e previdenciarias da construcao — risco de nao conformidade.'
  WHERE codigo='EST-002';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que dados de um estabelecimento podem ser editados e persistem. Regra: dados do '
             || 'estabelecimento sao editaveis. Importa porque locais mudam de nome, endereco e '
             || 'responsavel, e os documentos precisam refletir isso.',
    pre_condicoes = 'Precisa existir um estabelecimento cadastrado.',
    passos = '[
      {"ordem":1,"acao":"Abrir um estabelecimento para editar","onde_na_tela":"Estabelecimentos > clicar > Editar","dados":"-","resultado_esperado":"Formulario com dados atuais"},
      {"ordem":2,"acao":"Alterar o nome","onde_na_tela":"Campo Nome","dados":"Novo nome: Filial Centro Reformada","resultado_esperado":"Campo aceita"},
      {"ordem":3,"acao":"Salvar e conferir","onde_na_tela":"Salvar > reabrir","dados":"-","resultado_esperado":"O nome novo esta gravado"}
    ]'::jsonb,
    resultado_esperado = 'O nome do estabelecimento e atualizado e persiste ao reabrir.',
    observacoes = 'IMPACTO SE FALHAR: dados desatualizados do local aparecem em documentos e relatorios.'
  WHERE codigo='EST-003';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que um estabelecimento sem nome e recusado. Regra: nome e NOT NULL. Importa '
             || 'porque um estabelecimento sem nome aparece em branco e nao serve para localizar pessoas '
             || 'ou riscos.',
    pre_condicoes = 'Precisa existir uma empresa para tentar o vinculo.',
    passos = '[
      {"ordem":1,"acao":"Abrir novo estabelecimento","onde_na_tela":"Estabelecimentos > Novo","dados":"-","resultado_esperado":"Formulario aberto"},
      {"ordem":2,"acao":"Deixar o nome vazio e tentar salvar","onde_na_tela":"Campo Nome (vazio) + Salvar","dados":"Nome: (vazio)","resultado_esperado":"O sistema DEVE recusar"}
    ]'::jsonb,
    resultado_esperado = 'O cadastro e recusado. Nenhum estabelecimento sem nome e criado.',
    observacoes = 'IMPACTO SE FALHAR: estabelecimento em branco polui listas e filtros por local.'
  WHERE codigo='EST-010';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que o mesmo nome de estabelecimento pode existir em clientes diferentes. Regra: '
             || 'o UNIQUE e por tenant. Importa para nao restringir demais — "Matriz" e um nome comum que '
             || 'varios clientes usam.',
    pre_condicoes = 'Dois clientes distintos no sistema.',
    passos = '[
      {"ordem":1,"acao":"No cliente A, criar estabelecimento Matriz","onde_na_tela":"Cliente A > Novo Estabelecimento","dados":"Nome: Matriz","resultado_esperado":"Criado no cliente A"},
      {"ordem":2,"acao":"No cliente B, criar estabelecimento Matriz","onde_na_tela":"Cliente B > Novo Estabelecimento","dados":"Nome: Matriz (mesmo nome, outro cliente)","resultado_esperado":"ACEITO — unicidade e por cliente"}
    ]'::jsonb,
    resultado_esperado = 'Ambos os clientes tem uma Matriz. Nomes iguais em clientes distintos convivem.',
    observacoes = 'IMPACTO SE FALHAR: unicidade global impediria clientes de usar nomes comuns de local — '
                || 'restricao absurda com risco de vazar informacao entre clientes.'
  WHERE codigo='EST-011';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que apagar a empresa apenas DESASSOCIA a filial, sem apaga-la. Regra: '
             || 'empresa_id ON DELETE SET NULL — a filial sobrevive sem empresa. Importa porque apagar '
             || 'uma empresa nao deveria destruir os locais que existiam nela; eles podem ser realocados.',
    pre_condicoes = 'Precisa existir uma empresa com pelo menos uma filial vinculada.',
    passos = '[
      {"ordem":1,"acao":"Criar empresa e uma filial vinculada","onde_na_tela":"Empresas e Estabelecimentos","dados":"Empresa: Matriz SA | Filial: Unidade Norte, ligada a Matriz SA","resultado_esperado":"Filial pertence a empresa"},
      {"ordem":2,"acao":"Apagar a empresa Matriz SA","onde_na_tela":"Empresas > Matriz SA > Excluir","dados":"-","resultado_esperado":"Empresa apagada"},
      {"ordem":3,"acao":"Conferir a filial Unidade Norte","onde_na_tela":"Estabelecimentos > Unidade Norte","dados":"-","resultado_esperado":"A filial ainda existe, agora sem empresa (desassociada)"}
    ]'::jsonb,
    resultado_esperado = 'A empresa e apagada, mas a filial Unidade Norte continua existindo, sem empresa '
                       || 'vinculada. Nada de filial apagada junto.',
    observacoes = 'IMPACTO SE FALHAR: se apagar a empresa apagasse as filiais, perder-se-ia o cadastro de '
                || 'locais que so precisavam ser realocados. O SET NULL preserva as filiais. CONTRASTE: em '
                || 'Terceiros (TER-013) a regra e oposta — CASCADE — porque trabalhador de terceiro nao '
                || 'faz sentido sem o terceiro.'
  WHERE codigo='EST-013';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que dois estabelecimentos com o mesmo nome no mesmo cliente sao recusados. '
             || 'Regra: UNIQUE(tenant_id, nome). Importa porque dois locais de nome igual confundem a '
             || 'qual unidade uma pessoa ou risco pertence.',
    pre_condicoes = 'Precisa existir um estabelecimento com um nome conhecido.',
    passos = '[
      {"ordem":1,"acao":"Criar um estabelecimento","onde_na_tela":"Novo Estabelecimento","dados":"Nome: Deposito Central","resultado_esperado":"Criado"},
      {"ordem":2,"acao":"Tentar criar OUTRO com o mesmo nome","onde_na_tela":"Novo Estabelecimento","dados":"Nome: Deposito Central (repetido)","resultado_esperado":"O sistema DEVE recusar"}
    ]'::jsonb,
    resultado_esperado = 'O segundo Deposito Central e recusado. So um local com esse nome no cliente.',
    observacoes = 'IMPACTO SE FALHAR: locais de nome repetido tornam ambiguo onde pessoas e riscos estao, '
                || 'quebrando relatorios por unidade.'
  WHERE codigo='EST-020';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que um estabelecimento de um cliente e invisivel para outro. Regra: isolamento '
             || 'multi-tenant. Importa porque a estrutura de locais de um cliente e informacao que nao '
             || 'pode vazar.',
    pre_condicoes = 'Dois clientes distintos no sistema.',
    passos = '[
      {"ordem":1,"acao":"No cliente A, criar um estabelecimento","onde_na_tela":"Cliente A > Novo Estabelecimento","dados":"Nome: Unidade Secreta do A","resultado_esperado":"Criado no cliente A"},
      {"ordem":2,"acao":"Entrar como cliente B e procurar","onde_na_tela":"Cliente B > Estabelecimentos > busca","dados":"Buscar pelo nome do local do cliente A","resultado_esperado":"NAO aparece para o cliente B"}
    ]'::jsonb,
    resultado_esperado = 'O estabelecimento do cliente A e invisivel no cliente B. Zero vazamento.',
    observacoes = 'IMPACTO SE FALHAR: exporia a estrutura de locais de um cliente a outro. Protecao RLS '
                || 'por tenant.'
  WHERE codigo='EST-022';

  -- ═══════════════ TERCEIROS / PRESTADORES ═══════════════

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar o cadastro basico de uma empresa terceira (prestadora). Regra: um terceiro tem '
             || 'CNPJ e razao social. Importa porque terceiros sao empresas que prestam servico ao '
             || 'cliente, com seus proprios trabalhadores que precisam de controle de acesso, documentos '
             || 'e treinamentos de SST.',
    pre_condicoes = 'Usuario com permissao de administrar terceiros.',
    passos = '[
      {"ordem":1,"acao":"Abrir cadastro de terceiro","onde_na_tela":"Menu > Estrutura Organizacional > Prestadores/Terceiros > Novo","dados":"-","resultado_esperado":"Formulario aberto"},
      {"ordem":2,"acao":"Preencher razao social e CNPJ","onde_na_tela":"Campos Razao Social e CNPJ","dados":"Razao: Prestadora de Servicos Ltda | CNPJ: 11.222.333/0001-81","resultado_esperado":"Campos aceitos"},
      {"ordem":3,"acao":"Salvar","onde_na_tela":"Botao Salvar","dados":"-","resultado_esperado":"Terceiro criado e aparece na lista"}
    ]'::jsonb,
    resultado_esperado = 'O terceiro Prestadora de Servicos Ltda existe com o CNPJ informado.',
    observacoes = 'IMPACTO SE FALHAR: sem cadastrar terceiros, nao ha como controlar acesso, documentos e '
                || 'treinamentos das empresas que prestam servico — risco de SST com pessoal terceirizado.'
  WHERE codigo='TER-001';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que um trabalhador pode ser vinculado a uma empresa terceira. Regra: '
             || 'terceiro_trabalhadores liga uma pessoa ao terceiro. Importa porque sao esses '
             || 'trabalhadores que efetivamente entram no cliente — precisam de documentos e treinamentos '
             || 'validos para acessar as instalacoes.',
    pre_condicoes = 'Precisa existir uma empresa terceira cadastrada.',
    passos = '[
      {"ordem":1,"acao":"Abrir um terceiro e ir a aba de trabalhadores","onde_na_tela":"Terceiros > abrir o terceiro > aba Trabalhadores > Adicionar","dados":"-","resultado_esperado":"Formulario de trabalhador aberto"},
      {"ordem":2,"acao":"Preencher os dados do trabalhador","onde_na_tela":"Campos Nome e CPF do trabalhador","dados":"Nome: Jose Terceirizado | CPF: 529.982.247-25","resultado_esperado":"Campos aceitos"},
      {"ordem":3,"acao":"Salvar","onde_na_tela":"Salvar","dados":"-","resultado_esperado":"Trabalhador vinculado ao terceiro"}
    ]'::jsonb,
    resultado_esperado = 'O trabalhador Jose Terceirizado esta vinculado a empresa terceira e aparece na '
                       || 'lista de trabalhadores dela.',
    observacoes = 'IMPACTO SE FALHAR: sem vincular trabalhadores ao terceiro, nao ha como controlar quem '
                || 'da terceirizada acessa o cliente nem exigir documentos/treinamentos dessas pessoas.'
  WHERE codigo='TER-002';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que o status de um terceiro pode ser mudado para bloqueado. Regra: o status '
             || '(liberado/restrito/bloqueado) controla o acesso do terceiro e e alteravel. Importa '
             || 'porque bloquear um terceiro (ex.: documentacao vencida) impede o acesso das pessoas '
             || 'dele — mecanismo de seguranca.',
    pre_condicoes = 'Precisa existir um terceiro cadastrado.',
    passos = '[
      {"ordem":1,"acao":"Abrir um terceiro","onde_na_tela":"Terceiros > abrir o terceiro","dados":"-","resultado_esperado":"Ficha do terceiro aberta, com status atual"},
      {"ordem":2,"acao":"Mudar o status para bloqueado","onde_na_tela":"Campo Status","dados":"Status: de liberado para bloqueado","resultado_esperado":"O status muda para bloqueado"},
      {"ordem":3,"acao":"Salvar e conferir","onde_na_tela":"Salvar > reabrir","dados":"-","resultado_esperado":"O terceiro esta bloqueado"}
    ]'::jsonb,
    resultado_esperado = 'O terceiro fica com status bloqueado e persiste. O bloqueio pode entao impedir o '
                       || 'acesso das pessoas dele.',
    observacoes = 'IMPACTO SE FALHAR: se o status nao mudar, nao da para bloquear um terceiro com pendencia '
                || '— pessoas de uma terceirizada irregular continuariam acessando o cliente.'
  WHERE codigo='TER-003';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que um terceiro sem razao social e recusado. Regra: razao_social e NOT NULL. '
             || 'Importa porque um terceiro sem razao social nao tem identificacao — nao da para saber '
             || 'que empresa e.',
    pre_condicoes = 'Nenhuma.',
    passos = '[
      {"ordem":1,"acao":"Abrir novo terceiro","onde_na_tela":"Terceiros > Novo","dados":"-","resultado_esperado":"Formulario aberto"},
      {"ordem":2,"acao":"Deixar a razao social vazia e tentar salvar","onde_na_tela":"Campo Razao Social (vazio) + Salvar","dados":"Razao: (vazio) | CNPJ: 11.222.333/0001-81","resultado_esperado":"O sistema DEVE recusar"}
    ]'::jsonb,
    resultado_esperado = 'O cadastro e recusado. Nenhum terceiro sem razao social e criado.',
    observacoes = 'IMPACTO SE FALHAR: terceiro sem razao social aparece em branco e nao da para '
                || 'identificar a empresa prestadora nos controles de acesso e documentos.'
  WHERE codigo='TER-010';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que um status de terceiro invalido e recusado. Regra: status so aceita '
             || 'liberado, restrito ou bloqueado. Importa porque um status livre quebraria a logica de '
             || 'controle de acesso que depende desses tres estados.',
    pre_condicoes = 'Formulario de terceiro com o campo status.',
    passos = '[
      {"ordem":1,"acao":"Abrir novo terceiro (ou editar um)","onde_na_tela":"Terceiros > Novo/Editar > campo Status","dados":"-","resultado_esperado":"Campo status disponivel"},
      {"ordem":2,"acao":"Tentar um status fora da lista","onde_na_tela":"Campo Status","dados":"Status: pendente (valor invalido — nao existe)","resultado_esperado":"O sistema DEVE recusar"}
    ]'::jsonb,
    resultado_esperado = 'O status invalido e recusado. So liberado, restrito ou bloqueado sao aceitos.',
    observacoes = 'IMPACTO SE FALHAR: status invalido quebra a logica de controle de acesso do terceiro '
                || '(que decide quem entra conforme liberado/restrito/bloqueado).'
  WHERE codigo='TER-011';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que apagar um terceiro APAGA seus trabalhadores junto (CASCADE). Regra: '
             || 'ON DELETE CASCADE — ao contrario de filiais e cargos (que sobrevivem desassociados), o '
             || 'trabalhador de um terceiro nao faz sentido sem o terceiro. Importa porque um trabalhador '
             || 'terceirizado so existe no sistema pela relacao com a empresa dele.',
    pre_condicoes = 'Precisa existir um terceiro com pelo menos um trabalhador vinculado.',
    passos = '[
      {"ordem":1,"acao":"Criar terceiro com um trabalhador","onde_na_tela":"Terceiros","dados":"Terceiro: Prestadora X | Trabalhador: Pedro, vinculado a Prestadora X","resultado_esperado":"Trabalhador pertence ao terceiro"},
      {"ordem":2,"acao":"Apagar o terceiro Prestadora X","onde_na_tela":"Terceiros > Prestadora X > Excluir","dados":"-","resultado_esperado":"Terceiro apagado"},
      {"ordem":3,"acao":"Conferir o trabalhador Pedro","onde_na_tela":"Buscar o trabalhador","dados":"-","resultado_esperado":"O trabalhador Pedro foi apagado JUNTO com o terceiro (nao sobra orfao)"}
    ]'::jsonb,
    resultado_esperado = 'O terceiro e apagado e seus trabalhadores somem junto (CASCADE). Nenhum '
                       || 'trabalhador orfao sobra.',
    observacoes = 'IMPACTO SE FALHAR: se os trabalhadores nao fossem apagados, sobrariam registros orfaos '
                || 'apontando para um terceiro inexistente — lixo na base. CONTRASTE com EST-013 (filial e '
                || 'SET NULL): aqui CASCADE faz sentido porque trabalhador de terceiro nao existe sozinho.'
  WHERE codigo='TER-013';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar o que acontece ao cadastrar dois terceiros com o mesmo CNPJ no mesmo cliente. '
             || 'Regra esperada: o CNPJ deveria ser unico por cliente. Este caso revela se ha essa '
             || 'constraint. Importa porque a mesma empresa terceira cadastrada duas vezes duplica '
             || 'controles de acesso, documentos e treinamentos.',
    pre_condicoes = 'Precisa existir um terceiro com um CNPJ conhecido.',
    passos = '[
      {"ordem":1,"acao":"Cadastrar um terceiro com um CNPJ","onde_na_tela":"Novo Terceiro","dados":"Razao: Primeira Prestadora | CNPJ: 11.444.777/0001-61","resultado_esperado":"Criado"},
      {"ordem":2,"acao":"Tentar cadastrar OUTRO terceiro com o MESMO CNPJ","onde_na_tela":"Novo Terceiro","dados":"Razao: Segunda Prestadora | CNPJ: 11.444.777/0001-61 (mesmo)","resultado_esperado":"Idealmente o sistema DEVERIA recusar o CNPJ duplicado"}
    ]'::jsonb,
    resultado_esperado = 'O CNPJ duplicado deveria ser RECUSADO. ACHADO ATUAL: o banco ACEITA — cnpj e '
                       || 'NOT NULL mas nao tem constraint unica. A mesma empresa terceira pode entrar duas '
                       || 'vezes.',
    observacoes = 'IMPACTO SE FALHAR (e falha hoje): terceiro duplicado divide controles de acesso, '
                || 'documentos e treinamentos entre dois cadastros da mesma empresa — pode liberar acesso '
                || 'por um enquanto o outro esta bloqueado. CORRECAO SUGERIDA: indice unico por '
                || '(tenant_id, cnpj normalizado), como ja existe em empresa_cadastro.'
  WHERE codigo='TER-020';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que um terceiro de um cliente e invisivel para outro. Regra: isolamento '
             || 'multi-tenant. Importa porque a lista de prestadores de um cliente e informacao '
             || 'comercial sensivel que nao pode vazar.',
    pre_condicoes = 'Dois clientes distintos no sistema.',
    passos = '[
      {"ordem":1,"acao":"No cliente A, cadastrar um terceiro","onde_na_tela":"Cliente A > Novo Terceiro","dados":"Razao: Prestadora Secreta do A | CNPJ: 11.222.333/0001-81","resultado_esperado":"Criado no cliente A"},
      {"ordem":2,"acao":"Entrar como cliente B e procurar","onde_na_tela":"Cliente B > Terceiros > busca","dados":"Buscar pela razao ou CNPJ do terceiro do cliente A","resultado_esperado":"NAO aparece para o cliente B"}
    ]'::jsonb,
    resultado_esperado = 'O terceiro do cliente A e invisivel no cliente B. Zero vazamento.',
    observacoes = 'IMPACTO SE FALHAR: exporia a lista de prestadores (relacoes comerciais) de um cliente a '
                || 'outro. Protecao RLS por tenant.'
  WHERE codigo='TER-022';

  RAISE NOTICE 'Modulos ESTABELECIMENTOS (8) e TERCEIROS (8) detalhados.';
END $d$;

SELECT codigo, left(objetivo,44) AS objetivo, jsonb_array_length(passos) AS passos,
       (observacoes IS NOT NULL) AS impacto
FROM public.qa_casos_teste
WHERE codigo LIKE 'EST-%' OR codigo LIKE 'TER-%'
ORDER BY codigo;
