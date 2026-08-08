-- =========================================================
-- QA — Empresa: revisão da tela contra os casos documentados (07/08/2026)
--
-- ORIGEM: pedido de revisão do módulo de Empresas — conferir se algum
-- caso escapou. O método foi ler a tela inteira (Empresa.tsx e todos os
-- componentes de src/components/empresa/) e cruzar cada recurso com as
-- famílias já documentadas (EMP, ENQ, JOR, HIER, OBRG, IMP, PORTE,
-- REGRA, CHK, DADO). O grosso está coberto. Sobraram CINCO frentes sem
-- nenhum caso, todas com regra de negócio própria:
--
--   1) UNICIDADE DE CPF — o trigger prevent_duplicate_active_cnpj só
--      protege CNPJ. Duas empresas PF ativas com o mesmo CPF passam
--      hoje. EMP-020/021/023 documentam a regra para PJ e ninguém
--      escreveu a contraparte PF. ACHADO, não só lacuna de doc.
--   2) TABELA DE FERIADOS (RN22) — a aba Jornada vincula a unidade a
--      uma tabela de feriados (feriado_tabela_empresas). O UNIQUE é
--      (tabela_id, empresa_id): nada impede a MESMA empresa em DUAS
--      tabelas — a regra "uma tabela por unidade" vive só no
--      delete-then-insert do front. E o vínculo alimenta a apuração de
--      ponto: duas tabelas = feriado ambíguo. ACHADO.
--   3) TAC DETALHADO — a aba Indicadores mantém a lista tac_detalhes
--      (JSONB): incluir, arquivar, excluir, vigência. Nenhuma validação
--      no banco, nenhum caso em nenhuma família (ENQ-010 cobre FAP;
--      TAC ficou de fora).
--   4) RASCUNHO LOCAL — o formulário guarda rascunho por usuário e por
--      empresa no localStorage, restaura ao voltar, tem botão de
--      descarte e flush no beforeunload. Comportamento inteiro sem
--      caso. Nível e2e: vive todo no React.
--   5) EXCLUSÃO EM LOTE — a lista exclui várias empresas num laço, uma
--      a uma, e reporta parciais. A proteção unitária é a de EMP-025;
--      o que não tem caso é o comportamento do lote com falha parcial.
--
-- O QUE FOI VISTO E DELIBERADAMENTE NÃO GEROU CASO, para a revisão
-- ficar auditável:
--   - Aba Contexto I.A.: campos de texto livre sem consequência de
--     regra — testar somaria contagem sem somar segurança (critério da
--     varredura de 18/07).
--   - Exportação de planilha: leitura dos mesmos dados que a lista já
--     exibe, sob a mesma RLS coberta por EMP-022.
--   - Enriquecimento via BrasilAPI: já coberto por IMP-010.
--   - Navegação persistida entre abas (sessionStorage): conveniência
--     sem regra de negócio.
--
-- ESTA MIGRATION SÓ DOCUMENTA. Nenhuma rotina, nenhuma constraint.
-- Escrever as rotinas (e as duas constraints sugeridas nos achados) é o
-- passo seguinte, deliberadamente separado.
-- =========================================================

SET lock_timeout = '10s';

DO $doc$
DECLARE
  v_mod uuid;
  v_antes int;
  v_depois int;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos
  WHERE path = 'estrutura-organizacional/empresa';

  IF v_mod IS NULL THEN
    RAISE EXCEPTION 'Módulo estrutura-organizacional/empresa não encontrado.';
  END IF;

  SELECT count(*) INTO v_antes FROM public.qa_casos_teste WHERE modulo_id = v_mod;

  INSERT INTO public.qa_casos_teste
    (modulo_id, codigo, titulo, tipo, prioridade, status, nivel,
     objetivo, pre_condicoes, passos, resultado_esperado, observacoes)
  VALUES

  -- ═══════════════════════════════════════════════════════
  -- A) UNICIDADE DE CPF — a contraparte PF de EMP-020/021/023
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'EMP-070', 'Duas empresas PF ATIVAS com o mesmo CPF é proibido',
   'negativo', 'critica', 'aprovado', 'api',
   'O trigger prevent_duplicate_active_cnpj normaliza e compara apenas a coluna cnpj. Uma empresa PF tem cnpj nulo e o documento no campo cpf — o trigger nem olha. Resultado: o mesmo CPF pode ter duas empresas ativas no mesmo tenant, exatamente o cenário que EMP-020 proíbe para PJ. A regra de unicidade não pode depender do tipo de pessoa.',
   'Uma empresa PF ativa cadastrada no cercado com um CPF conhecido.',
   '[{"ordem":1,"acao":"Inserir segunda empresa com tipo_pessoa = pf, mesmo CPF, ativo = true, no mesmo tenant","resultado_esperado":"Recusado com erro de duplicidade, como acontece com CNPJ"},
     {"ordem":2,"acao":"Repetir com o CPF pontuado (000.000.000-00) contra o mesmo número limpo","resultado_esperado":"Reconhecido como o mesmo documento e recusado, espelhando EMP-013"}]'::jsonb,
   'A segunda empresa ativa com o mesmo CPF não entra, com ou sem pontuação.',
   'ACHADO na revisão de 07/08: hoje os dois passos PASSAM (a duplicata entra). Correção sugerida: estender o trigger para comparar também a coluna cpf quando cnpj está vazio — mesma normalização, mesma mensagem. Enquanto a correção não vem, este caso deve FALHAR na bateria: é o alarme.'),

  (v_mod, 'EMP-071', 'Duplicata INATIVA do mesmo CPF é permitida',
   'alternativo', 'media', 'aprovado', 'api',
   'A contraparte de EMP-023 para PF: a proibição vale só entre ATIVAS. Histórico de reabertura de firma individual precisa conviver — a antiga fica inativa, a nova assume.',
   'Uma empresa PF ativa cadastrada no cercado.',
   '[{"ordem":1,"acao":"Inserir segunda empresa PF com o mesmo CPF e ativo = false","resultado_esperado":"Aceita — inativa não conflita"},
     {"ordem":2,"acao":"Tentar reativar a inativa enquanto a outra segue ativa","resultado_esperado":"Recusado, espelhando EMP-021"}]'::jsonb,
   'Inativa convive; reativação com o CPF já ativo em outra é barrada.',
   'Depende da correção descrita em EMP-070 — sem ela, o passo 2 também passa indevidamente.'),

  (v_mod, 'EMP-072', 'Duplo clique no salvar não cria duas empresas',
   'excecao', 'alta', 'aprovado', 'e2e',
   'O botão Salvar tem trava de re-entrância (savingRef) e, depois do primeiro insert em modo novo, o id criado (createdIdRef) força update nas gravações seguintes. Sem isso, duplo clique ou re-render criava cadastros duplicados. Para PJ o trigger de CNPJ segura o estrago; para PF (EMP-070) e para cadastros sem documento ainda digitado, a trava da tela é a única defesa.',
   'Formulário de nova empresa preenchido com os campos mínimos.',
   '[{"ordem":1,"acao":"Clicar Salvar duas vezes em sequência imediata","onde_na_tela":"Botão Salvar, cabeçalho do formulário","resultado_esperado":"Uma única empresa criada; o segundo clique é ignorado ou vira update"},
     {"ordem":2,"acao":"Após o primeiro salvamento, alterar um campo e salvar de novo sem sair da tela","resultado_esperado":"Atualiza a empresa criada — não nasce uma segunda"}]'::jsonb,
   'Uma empresa no banco, independentemente de quantos cliques o salvamento levou.',
   NULL),

  -- ═══════════════════════════════════════════════════════
  -- B) TABELA DE FERIADOS VINCULADA À UNIDADE (RN22)
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'FER-001', 'Vincular tabela de feriados à unidade',
   'feliz', 'alta', 'aprovado', 'api',
   'A aba Jornada vincula a unidade a uma tabela nomeada de feriados (feriado_tabela_empresas). É esse vínculo que diz à apuração de ponto quais dias são feriado para os colaboradores daquela unidade — errar aqui erra hora extra e adicional.',
   'Uma empresa e uma tabela de feriados ativas no cercado, mesmo tenant.',
   '[{"ordem":1,"acao":"Vincular a tabela à unidade","onde_na_tela":"Empresas > abrir a empresa > aba Jornada > Tabela de feriados vinculada","resultado_esperado":"Vínculo gravado em feriado_tabela_empresas"},
     {"ordem":2,"acao":"Conferir que a apuração passa a enxergar os feriados da tabela para essa empresa","resultado_esperado":"Itens da tabela valem para a unidade vinculada"}]'::jsonb,
   'A unidade fica com exatamente uma tabela vinculada e a apuração a enxerga.',
   NULL),

  (v_mod, 'FER-002', 'Trocar a tabela vinculada substitui, não acumula',
   'alternativo', 'media', 'aprovado', 'api',
   'A troca de tabela na tela apaga o vínculo anterior antes de criar o novo (delete-then-insert). O caso garante que trocar deixa UM vínculo — não dois, não zero.',
   'Unidade já vinculada a uma tabela; segunda tabela disponível no mesmo tenant.',
   '[{"ordem":1,"acao":"Selecionar outra tabela para a mesma unidade","onde_na_tela":"Aba Jornada > seletor de tabela","resultado_esperado":"Vínculo antigo removido, novo criado"},
     {"ordem":2,"acao":"Selecionar a opção sem tabela","resultado_esperado":"Unidade fica sem vínculo, sem erro"}]'::jsonb,
   'Após qualquer troca a unidade tem no máximo um vínculo.',
   NULL),

  (v_mod, 'FER-003', 'Unidade em duas tabelas de feriados ao mesmo tempo é proibido',
   'negativo', 'alta', 'aprovado', 'api',
   'O UNIQUE de feriado_tabela_empresas é (tabela_id, empresa_id) — impede repetir o MESMO par, mas não impede a mesma empresa em DUAS tabelas diferentes. A regra de uma tabela por unidade vive só no delete-then-insert do front: dado que entre por API ou SQL direto cria a ambiguidade, e a apuração de ponto não tem critério para escolher qual tabela vale.',
   'Unidade vinculada a uma tabela; segunda tabela ativa no mesmo tenant.',
   '[{"ordem":1,"acao":"Inserir segundo vínculo direto em feriado_tabela_empresas, para outra tabela, sem apagar o primeiro","resultado_esperado":"Recusado — uma tabela por unidade"}]'::jsonb,
   'O segundo vínculo simultâneo não entra.',
   'ACHADO na revisão de 07/08: hoje o insert PASSA. Correção sugerida: UNIQUE (empresa_id) na tabela de vínculos — a semântica da tela já é essa. Até lá, o caso deve FALHAR na bateria.'),

  (v_mod, 'FER-004', 'Tabela de feriados de outro cliente não pode ser vinculada',
   'negativo', 'alta', 'aprovado', 'api',
   'A RLS de feriado_tabela_empresas confere o tenant_id DA LINHA DE VÍNCULO, e a FK de tabela_id não olha tenant. Um vínculo com tenant_id próprio apontando para tabela de outro cliente é estruturalmente possível — e faria a apuração de uma unidade usar o calendário de outro cliente.',
   'Cercado com dois tenants; tabela de feriados no tenant B, empresa no tenant A.',
   '[{"ordem":1,"acao":"Inserir vínculo no tenant A apontando tabela_id do tenant B","resultado_esperado":"Recusado — tabela e empresa precisam ser do mesmo tenant"}]'::jsonb,
   'Vínculo cruzando tenants não entra.',
   'Mesma família dos casos de coerência de tenant já documentados em outros módulos. Se o insert passar, é achado com o mesmo remédio de sempre: trigger de coerência comparando o tenant da tabela com o do vínculo.'),

  (v_mod, 'FER-005', 'Apagar a tabela vinculada limpa o vínculo e não quebra a unidade',
   'excecao', 'media', 'aprovado', 'api',
   'A FK de tabela_id é ON DELETE CASCADE: apagar a tabela leva os vínculos junto. O caso confirma o cascade e que a unidade simplesmente volta ao estado sem tabela — cadastro intacto, apuração sem os feriados da tabela extinta, nenhum vínculo órfão.',
   'Unidade vinculada a uma tabela de feriados no cercado.',
   '[{"ordem":1,"acao":"Apagar a tabela de feriados","resultado_esperado":"Tabela e vínculo somem juntos"},
     {"ordem":2,"acao":"Conferir a unidade","resultado_esperado":"Empresa intacta, sem vínculo, sem erro na aba Jornada"}]'::jsonb,
   'Cascade limpa o vínculo; a unidade segue íntegra, apenas sem tabela.',
   NULL),

  -- ═══════════════════════════════════════════════════════
  -- C) TAC DETALHADO — a metade esquecida da aba Indicadores
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'TAC-001', 'Registrar TAC com vigência e condicionantes',
   'feliz', 'media', 'aprovado', 'api',
   'A aba Indicadores mantém a lista de TACs (Termo de Ajustamento de Conduta) em empresa_cadastro.tac_detalhes: órgão, número, vigência, condicionantes, situação. ENQ-010 cobre o FAP; o TAC nunca teve caso. TAC descumprido vira multa e ação — o registro precisa gravar por inteiro.',
   'Empresa cadastrada no cercado.',
   '[{"ordem":1,"acao":"Incluir um TAC com órgão, número, início e fim de vigência e condicionantes","onde_na_tela":"Empresas > abrir a empresa > aba Indicadores > seção TAC","resultado_esperado":"Item gravado na lista tac_detalhes com todos os campos"},
     {"ordem":2,"acao":"Reabrir o cadastro","resultado_esperado":"O TAC reaparece como foi gravado"}]'::jsonb,
   'O TAC é gravado e relido por inteiro.',
   NULL),

  (v_mod, 'TAC-002', 'Arquivar TAC preserva o histórico',
   'alternativo', 'baixa', 'aprovado', 'e2e',
   'TAC encerrado não some: a tela o move para arquivados. Excluir é outra ação, separada. Histórico de conduta perante o órgão fiscalizador é exatamente o tipo de dado que não se apaga por engano.',
   'Empresa com um TAC ativo registrado.',
   '[{"ordem":1,"acao":"Arquivar o TAC","onde_na_tela":"Aba Indicadores > item do TAC > arquivar","resultado_esperado":"Item sai dos ativos e aparece nos arquivados, com os dados intactos"},
     {"ordem":2,"acao":"Excluir um item arquivado","resultado_esperado":"Só então o item deixa de existir"}]'::jsonb,
   'Arquivar preserva; excluir é ação distinta e explícita.',
   NULL),

  (v_mod, 'TAC-003', 'Vigência do TAC com fim antes do início',
   'negativo', 'media', 'aprovado', 'api',
   'Nem a tela nem o banco validam a coerência das datas do TAC — tac_detalhes é JSONB livre. Fim antes do início é a mesma incoerência que ENQ-013 documenta para o mandato da CIPA, e aqui não há nem CHECK possível sem estruturar o dado.',
   'Empresa cadastrada no cercado.',
   '[{"ordem":1,"acao":"Registrar TAC com vigência fim anterior à vigência início","resultado_esperado":"Recusado — vigência incoerente não é TAC válido"}]'::jsonb,
   'A vigência invertida não entra.',
   'Provável ACHADO: hoje deve passar. O remédio de curto prazo é validar na tela; o estrutural é o mesmo já anotado nas observações de ENQ-013 — dado com regra própria merece coluna, não JSON livre.'),

  (v_mod, 'TAC-004', 'tac_detalhes com estrutura inesperada não derruba a aba',
   'excecao', 'baixa', 'aprovado', 'e2e',
   'Por ser JSONB sem contrato, qualquer integração ou script pode gravar em tac_detalhes algo que não é a lista esperada (objeto, nulo, item sem campos). A aba Indicadores precisa degradar com elegância — lista vazia ou item ignorado — em vez de tela branca.',
   'Empresa no cercado com tac_detalhes gravado fora do formato (ex.: objeto em vez de lista).',
   '[{"ordem":1,"acao":"Abrir a aba Indicadores da empresa com o dado malformado","resultado_esperado":"Aba renderiza; o dado inválido é ignorado ou sinalizado, sem quebrar"},
     {"ordem":2,"acao":"Incluir um TAC novo por cima","resultado_esperado":"Gravação normaliza a estrutura sem perder o que for recuperável"}]'::jsonb,
   'Dado fora do contrato não tira a aba do ar.',
   NULL),

  -- ═══════════════════════════════════════════════════════
  -- D) RASCUNHO LOCAL DO FORMULÁRIO — comportamento inteiro sem caso
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'RASC-001', 'Rascunho é restaurado ao voltar sem ter salvo',
   'feliz', 'media', 'aprovado', 'e2e',
   'O formulário guarda rascunho no localStorage (com flush no beforeunload) e o restaura na volta. É a defesa contra perder meia hora de preenchimento num F5 — o cadastro tem 8 abas e 64 colunas.',
   'Usuário autenticado, formulário de empresa aberto.',
   '[{"ordem":1,"acao":"Preencher campos em mais de uma aba sem salvar e recarregar a página","resultado_esperado":"Ao reabrir, os valores digitados estão lá e o aviso de rascunho restaurado aparece"},
     {"ordem":2,"acao":"Salvar de fato","resultado_esperado":"Rascunho é limpo; recarregar mostra o dado do banco, sem aviso"}]'::jsonb,
   'Nada digitado se perde antes do salvamento; salvar encerra o rascunho.',
   NULL),

  (v_mod, 'RASC-002', 'Descartar rascunho volta ao que está no banco',
   'alternativo', 'media', 'aprovado', 'e2e',
   'O botão de descarte joga o rascunho fora e recarrega os dados salvos. Sem ele, um rascunho ruim ficaria assombrando o formulário para sempre — restaurado a cada visita.',
   'Empresa salva no banco; rascunho local com alterações por cima.',
   '[{"ordem":1,"acao":"Descartar o rascunho","onde_na_tela":"Aviso de rascunho restaurado > descartar","resultado_esperado":"Formulário volta exatamente ao que está no banco"},
     {"ordem":2,"acao":"Recarregar a página","resultado_esperado":"O rascunho descartado não volta"}]'::jsonb,
   'Descartar é definitivo e restaura o estado do banco.',
   NULL),

  (v_mod, 'RASC-003', 'Rascunho é isolado por usuário e por empresa',
   'negativo', 'alta', 'aprovado', 'e2e',
   'A chave do rascunho é usuario:empresa. Sem esse isolamento, o rascunho da empresa A contaminaria o formulário da empresa B — e, em máquina compartilhada, o rascunho de um usuário apareceria para outro, com dados que ele talvez nem pudesse ver.',
   'Duas empresas cadastradas; rascunho pendente na empresa A.',
   '[{"ordem":1,"acao":"Abrir a empresa B para edição","resultado_esperado":"Formulário limpo, sem nenhum valor do rascunho da empresa A"},
     {"ordem":2,"acao":"Entrar com outro usuário na mesma máquina e abrir a empresa A","resultado_esperado":"Sem rascunho — a chave é do usuário original"}]'::jsonb,
   'Rascunho de uma empresa ou de um usuário nunca aparece em outro contexto.',
   NULL),

  (v_mod, 'RASC-004', 'Novo cadastro não herda rascunho de tentativa anterior',
   'excecao', 'media', 'aprovado', 'e2e',
   'O rascunho de nova empresa usa a chave especial new. Ao clicar Nova Empresa a tela limpa essa chave de propósito: sem isso, um cadastro abandonado semanas atrás ressuscitaria dentro do próximo, misturando dados de empresas diferentes.',
   'Rascunho de um cadastro novo abandonado (preenchido e nunca salvo).',
   '[{"ordem":1,"acao":"Clicar Nova Empresa","onde_na_tela":"Lista de empresas > Nova Empresa","resultado_esperado":"Formulário nasce vazio — o rascunho abandonado não é restaurado"}]'::jsonb,
   'Cada novo cadastro começa do zero.',
   NULL),

  -- ═══════════════════════════════════════════════════════
  -- E) EXCLUSÃO EM LOTE — o comportamento do laço, não da unidade
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'LOTE-001', 'Exclusão em lote com falha parcial reporta e preserva certo',
   'alternativo', 'media', 'aprovado', 'e2e',
   'A lista exclui várias empresas num laço, uma a uma. EMP-025 garante que a unidade protegida (com vínculos) resiste; este caso garante o comportamento do LOTE: as excluíveis saem, as protegidas ficam, e o resumo diz exatamente quantas foram e por que as outras não — sem a primeira falha abortar o resto.',
   'Três empresas no cercado: duas sem vínculos, uma com colaborador vinculado.',
   '[{"ordem":1,"acao":"Selecionar as três e excluir em lote","onde_na_tela":"Lista de empresas > seleção múltipla > excluir","resultado_esperado":"Confirmação exigida antes de qualquer exclusão"},
     {"ordem":2,"acao":"Confirmar","resultado_esperado":"As duas livres são excluídas; a protegida permanece"},
     {"ordem":3,"acao":"Ler o resumo","resultado_esperado":"2 excluídas e 1 falha, com o nome da empresa e o motivo"}]'::jsonb,
   'Falha em uma não impede as demais nem passa despercebida no resumo.',
   NULL)

  ON CONFLICT (codigo) DO NOTHING;

  SELECT count(*) INTO v_depois FROM public.qa_casos_teste WHERE modulo_id = v_mod;

  RAISE NOTICE 'Revisão Empresa 07/08: módulo tinha % casos, agora tem % (+%).',
    v_antes, v_depois, v_depois - v_antes;
END $doc$;
