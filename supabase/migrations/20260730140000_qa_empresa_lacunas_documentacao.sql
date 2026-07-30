-- =========================================================
-- QA — Empresa: documentar as regras que nunca tiveram caso (30/07/2026)
--
-- ORIGEM: varredura do modulo inteiro (schema, triggers, RLS, componentes de
-- tela e os casos ja documentados nas familias EMP, REGRA, OBRG, COND, ENQ,
-- HIER e JOR). O cruzamento entre AS REGRAS QUE O SISTEMA TEM e AS REGRAS QUE
-- ALGUEM DOCUMENTOU deixou 42 buracos, todos preenchidos aqui.
--
-- O QUE ISSO SIGNIFICA PARA O PLACAR, dito antes que o numero assuste:
-- a cobertura do modulo nao caiu hoje. Ela nunca foi o que o painel dizia.
-- O denominador so continha o que alguem tinha lembrado de escrever, entao
-- "94% coberto" media a memoria de quem documentou, nao o sistema. Depois
-- desta migration o denominador passa a ser o modulo de verdade, e o
-- percentual cai — o sistema nao piorou, a regua ficou honesta.
--
-- CRITERIO DE NIVEL, aplicado do inicio ao fim:
--   nivel 'api' -> a regra e (ou deveria ser) garantida pelo banco.
--                  Entra na fila de rotina SQL do motor.
--   nivel 'e2e' -> a regra vive no React (useEffect, checklist, importacao).
--                  Nenhuma rotina SQL a reproduz. Desde 30/07 o motor diz
--                  isso explicitamente em vez de contar como divida.
-- Sem esse corte, documentar regra de tela envenenaria a lista de pendencia
-- do motor com item que ele nunca vai poder executar.
--
-- ACHADO ESTRUTURAL que atravessa quase tudo: o banco garante CINCO regras
-- neste modulo (CHECK de grau_risco 1-4, CHECK de sesmt_situacao, CHECK de
-- cipa_situacao, trigger de CNPJ ativo duplicado e RLS de tenant). Todo o
-- resto — faixas de cota, arredondamento, coerencia de mandato, faixa do
-- FAP, geracao de obrigacoes, classificacao de porte, validacao de
-- importacao — vive em TypeScript. Dado que entre por importacao, API ou
-- SQL direto nao passa por nada disso. As quatro constraints que o proprio
-- QA sugeriu (pcd_percentual_legal, fap_faixa_legal, cipa_mandato_coerente,
-- grau_ajustado_exige_justificativa) seguem como texto dentro das
-- observacoes dos casos: nunca foram aplicadas na base.
--
-- ESTA MIGRATION SO DOCUMENTA. Nenhuma rotina, nenhuma constraint, nenhuma
-- alteracao de comportamento. Escrever as rotinas e o passo seguinte, e
-- deliberadamente separado: documentar a regra e barato e reversivel;
-- mudar o banco de cliente merece medicao antes.
-- =========================================================

DO $doc$
DECLARE
  v_mod uuid;
  v_antes int;
  v_depois int;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos
  WHERE path = 'estrutura-organizacional/empresa';

  IF v_mod IS NULL THEN
    RAISE EXCEPTION 'Modulo estrutura-organizacional/empresa nao encontrado.';
  END IF;

  SELECT count(*) INTO v_antes FROM public.qa_casos_teste WHERE modulo_id = v_mod;

  INSERT INTO public.qa_casos_teste
    (modulo_id, codigo, titulo, tipo, prioridade, status, nivel,
     objetivo, pre_condicoes, passos, resultado_esperado, observacoes)
  VALUES

  -- ═══════════════════════════════════════════════════════
  -- A) CICLO DE VIDA DA EMPRESA
  -- O que EMP-020/021/022 deixaram de fora: a contraparte da regra e o
  -- que acontece com os dados quando a empresa sai de cena.
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'EMP-014', 'Documento exigido acompanha o tipo de pessoa',
   'alternativo', 'alta', 'aprovado', 'e2e',
   'tipo_pessoa define qual documento e obrigatorio: PJ exige CNPJ, PF exige CPF. Hoje isso vive so no checklist da tela.',
   'Formulario de cadastro aberto.',
   '[{"ordem":1,"acao":"Marcar tipo_pessoa = pj e deixar o CNPJ vazio","resultado_esperado":"Checklist acusa CNPJ como pendencia obrigatoria"},
     {"ordem":2,"acao":"Marcar tipo_pessoa = pf","resultado_esperado":"A pendencia passa a ser CPF, e o CNPJ deixa de ser exigido"},
     {"ordem":3,"acao":"Gravar PJ sem CNPJ direto pela API","resultado_esperado":"Hoje: aceito. Nao ha constraint nem validacao fora da tela"}]'::jsonb,
   'O documento obrigatorio muda conforme o tipo de pessoa, nas duas rotas de entrada.',
   'GAP CONHECIDO: a constraint tipo_pessoa_valido consta como SUGERIDA em caso anterior e nunca foi aplicada. O passo 3 documenta a rota que escapa.'),

  (v_mod, 'EMP-023', 'Duplicata INATIVA do mesmo CNPJ e permitida',
   'alternativo', 'alta', 'aprovado', 'api',
   'Contraparte do EMP-020. A trigger so age quando ativo IS TRUE — de proposito. Sem este caso, alguem "melhora" a trigger para barrar todo CNPJ repetido e quebra o fluxo de desativar e recadastrar.',
   'Uma empresa ativa com CNPJ conhecido.',
   '[{"ordem":1,"acao":"Cadastrar segunda empresa com o MESMO CNPJ e ativo = false","resultado_esperado":"ACEITO — a trigger nao age sobre registro inativo"},
     {"ordem":2,"acao":"Contar empresas com o CNPJ no tenant","resultado_esperado":"2 — uma ativa, uma inativa"},
     {"ordem":3,"acao":"Tentar ativar a segunda","resultado_esperado":"Recusado (EMP-021) enquanto a primeira estiver ativa"}]'::jsonb,
   'Historico convive; so a ATIVACAO e exclusiva.',
   'Caso de protecao, nao de defeito. Serve para que uma correcao futura da trigger nao restrinja mais do que a regra pede.'),

  (v_mod, 'EMP-024', 'Desativar empresa preserva vinculos e dados',
   'alternativo', 'alta', 'aprovado', 'api',
   'Desativar e o caminho normal de saida (o botao da lista alterna ativo). Precisa ser reversivel: nada pode ser destruido no caminho.',
   'Empresa ativa com colaboradores vinculados e documentos gerados.',
   '[{"ordem":1,"acao":"Anotar quantidade de vinculos e de pastas da empresa","resultado_esperado":"Numeros registrados"},
     {"ordem":2,"acao":"Desativar a empresa (ativo = false)","resultado_esperado":"Aceito"},
     {"ordem":3,"acao":"Reconferir vinculos e pastas","resultado_esperado":"Intactos — desativar nao e apagar"},
     {"ordem":4,"acao":"Reativar a empresa","resultado_esperado":"Volta ao estado anterior sem perda"}]'::jsonb,
   'Desativacao e reversivel e nao destroi dado dependente.',
   'Importa porque desativar e o caminho usado para resolver duplicata de CNPJ (EMP-020). Se desativar destruisse vinculo, a saida recomendada pelo proprio sistema causaria perda.'),

  (v_mod, 'EMP-025', 'Empresa com vinculo nao pode ser apagada',
   'negativo', 'alta', 'aprovado', 'api',
   'usuario_vinculos referencia empresa_cadastro com ON DELETE RESTRICT. O hook expoe delete(); a trava tem que estar no banco.',
   'Empresa com ao menos um colaborador vinculado.',
   '[{"ordem":1,"acao":"Tentar apagar a empresa","resultado_esperado":"Recusado por foreign_key_violation (ON DELETE RESTRICT)"},
     {"ordem":2,"acao":"Revogar os vinculos e tentar de novo","resultado_esperado":"Depende da regra de negocio — documentar o comportamento observado"}]'::jsonb,
   'Exclusao nao pode orfanar historico de pessoa.',
   'O passo 2 esta em aberto de proposito: a regra de o que fazer com empresa sem vinculo nunca foi definida. O caso serve para forcar a decisao.'),

  (v_mod, 'EMP-060', 'Criar empresa vincula todos os administradores do tenant',
   'feliz', 'media', 'aprovado', 'api',
   'A trigger auto_vincular_admins_nova_empresa da acesso imediato a quem administra o cliente. Efeito colateral desejado do INSERT.',
   'Tenant com 2 ou mais usuarios tipo_usuario = administrador.',
   '[{"ordem":1,"acao":"Cadastrar empresa nova","resultado_esperado":"Aceito"},
     {"ordem":2,"acao":"Listar vinculos da empresa criada","resultado_esperado":"Um vinculo administrador ativo para CADA administrador do tenant"},
     {"ordem":3,"acao":"Conferir a observacao dos vinculos","resultado_esperado":"Marcados como criados automaticamente ao cadastrar a empresa"},
     {"ordem":4,"acao":"Rodar a mesma criacao duas vezes (mesma empresa reprocessada)","resultado_esperado":"ON CONFLICT DO NOTHING evita vinculo duplicado"}]'::jsonb,
   'Administrador enxerga empresa nova sem intervencao manual.',
   'O passo 4 so passou a significar algo em 15/07/2026: o ON CONFLICT DO NOTHING desta trigger era no-op desde maio, porque nao existia indice unico para conflitar. Hoje funciona. Este caso protege essa garantia.'),

  (v_mod, 'EMP-061', 'Criar empresa gera a estrutura de pastas de documentos',
   'feliz', 'media', 'aprovado', 'api',
   'A trigger auto_gerar_pastas_empresa monta a arvore documental. Empresa sem pastas quebra o modulo de documentos silenciosamente.',
   'Nenhuma.',
   '[{"ordem":1,"acao":"Cadastrar empresa nova","resultado_esperado":"Aceito"},
     {"ordem":2,"acao":"Listar pastas da empresa","resultado_esperado":"Estrutura padrao criada, nao vazia"}]'::jsonb,
   'Toda empresa nasce com a arvore de pastas pronta.',
   'Efeito colateral de INSERT nunca documentado. Se a trigger falhar, o sintoma aparece semanas depois no modulo de documentos, longe da causa.'),

  -- ═══════════════════════════════════════════════════════
  -- B) COTA PcD — as fronteiras e os automatismos
  -- EMP-030..035 cobrem gravacao e coerencia. Ninguem testou as
  -- BORDAS das faixas, que e exatamente onde erro de faixa mora.
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'EMP-036', 'Fronteiras das faixas legais da cota PcD',
   'alternativo', 'critica', 'aprovado', 'e2e',
   'As faixas da Lei 8.213/91 sao definidas por intervalos fechados. Erro de faixa quase sempre esta no limite, nao no meio: um >= trocado por > desloca a empresa inteira de percentual.',
   'Formulario com total de colaboradores editavel.',
   '[{"ordem":1,"acao":"Total = 99","resultado_esperado":"Cota nao obrigatoria automaticamente"},
     {"ordem":2,"acao":"Total = 100","resultado_esperado":"pcd_obrigatoria liga sozinha e percentual = 2%"},
     {"ordem":3,"acao":"Total = 200 e depois 201","resultado_esperado":"2% vira 3% exatamente em 201"},
     {"ordem":4,"acao":"Total = 500 e depois 501","resultado_esperado":"3% vira 4% exatamente em 501"},
     {"ordem":5,"acao":"Total = 1000 e depois 1001","resultado_esperado":"4% vira 5% exatamente em 1001"}]'::jsonb,
   'Cada troca de faixa acontece no numero exato previsto em lei.',
   'Cinco fronteiras, nenhuma testada ate hoje. Uma empresa que cruza de 200 para 201 passa a precisar de mais PcDs — errar a borda subdimensiona a cota de um cliente inteiro.'),

  (v_mod, 'EMP-037', 'Quantidade exigida sempre arredonda para cima',
   'alternativo', 'alta', 'aprovado', 'e2e',
   'O calculo usa Math.ceil. Arredondar para baixo entregaria cota menor que a lei exige — erro que so aparece em fiscalizacao.',
   'Cota PcD obrigatoria ligada.',
   '[{"ordem":1,"acao":"Total = 350, percentual 3%","resultado_esperado":"10,5 arredonda para 11"},
     {"ordem":2,"acao":"Total = 480, percentual 3%","resultado_esperado":"14,4 arredonda para 15"},
     {"ordem":3,"acao":"Total = 100, percentual 2%","resultado_esperado":"Exatos 2 — sem fracao, sem arredondar"}]'::jsonb,
   'Fracao sempre sobe, nunca desce.',
   'O passo 3 protege o caso exato: arredondamento nao pode inventar uma unidade a mais quando a conta ja e inteira.'),

  (v_mod, 'EMP-038', 'Cem ou mais colaboradores liga a cota sozinho',
   'feliz', 'alta', 'aprovado', 'e2e',
   'A obrigatoriedade e da lei, nao do usuario. Ao cruzar 100, o sistema liga pcd_obrigatoria sem perguntar.',
   'Empresa com cota desligada e menos de 100 colaboradores.',
   '[{"ordem":1,"acao":"Elevar o total para 100","resultado_esperado":"pcd_obrigatoria liga automaticamente"},
     {"ordem":2,"acao":"Tentar desligar a cota manualmente mantendo 100+","resultado_esperado":"Documentar o comportamento: hoje o desligamento e possivel e o automatismo religa no proximo render"}]'::jsonb,
   'Cota obrigatoria acompanha o quadro, nao a vontade de quem preenche.',
   'O passo 2 expoe um conflito real entre o switch manual e o useEffect. Vale medir antes de decidir: ou o switch fica somente-leitura acima de 100, ou o automatismo precisa respeitar a escolha explicita.'),

  (v_mod, 'EMP-039', 'Abaixo de cem, cota marcada a mao usa piso de 2%',
   'alternativo', 'media', 'aprovado', 'e2e',
   'Empresa com menos de 100 empregados nao e obrigada por lei, mas pode assumir a cota voluntariamente ou por TAC. Nesse caso o sistema adota 2% como piso.',
   'Empresa com menos de 100 colaboradores.',
   '[{"ordem":1,"acao":"Marcar pcd_obrigatoria manualmente com total = 60","resultado_esperado":"Percentual assume 2%"},
     {"ordem":2,"acao":"Informar percentual proprio (ex.: 4%)","resultado_esperado":"O valor informado prevalece — o piso so vale quando nada foi informado"},
     {"ordem":3,"acao":"Conferir se o campo de percentual esta editavel","resultado_esperado":"Editavel abaixo de 100; somente-leitura de 100 em diante"}]'::jsonb,
   'Piso de 2% e default, nao imposicao.',
   'Regra sutil e nunca documentada: o piso so entra quando pcd_percentual_exigido esta vazio. Cobre tambem a alternancia editavel/somente-leitura do campo.'),

  -- ═══════════════════════════════════════════════════════
  -- C) APRENDIZ
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'EMP-042', 'Auto-calculo de aprendiz permanece desligado',
   'negativo', 'media', 'aprovado', 'e2e',
   'O calculo automatico de 5% a 15% foi removido por DECISAO DE PRODUTO e esta comentado no codigo. Sem caso registrando isso, o proximo leitor encontra codigo comentado, acha que e esquecimento e "conserta".',
   'Empresa com total de colaboradores preenchido e cota de aprendiz obrigatoria.',
   '[{"ordem":1,"acao":"Informar total = 200 e ligar aprendiz_obrigatorio","resultado_esperado":"Minimo e maximo permanecem como estavam — nada e calculado"},
     {"ordem":2,"acao":"Preencher minimo e maximo manualmente","resultado_esperado":"Valores aceitos e preservados"},
     {"ordem":3,"acao":"Alterar o total de colaboradores","resultado_esperado":"Os valores informados NAO sao recalculados nem sobrescritos"}]'::jsonb,
   'A cota de aprendiz e informada, nunca inferida.',
   'MOTIVO DA DECISAO, registrado para nao se perder: a base de calculo do Decreto 9.579/2018 exclui funcoes que exigem formacao tecnica e cargos de confianca. Calcular sobre o headcount bruto produziria numero errado com aparencia de exatidao — pior que campo vazio.'),

  -- ═══════════════════════════════════════════════════════
  -- D) CNAE E GRAU DE RISCO
  -- ENQ-010..014 cobrem validacao. O AUTOMATISMO nunca foi testado.
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'ENQ-015', 'CNAE principal preenche o grau de risco automaticamente',
   'feliz', 'alta', 'aprovado', 'e2e',
   'getGrauRiscoByCnae traduz o CNAE no grau da NR-04 e avisa por toast. E a porta de entrada de todo o enquadramento: SESMT, exames e programas dependem do grau.',
   'Formulario de enquadramento aberto, grau de risco vazio.',
   '[{"ordem":1,"acao":"Informar CNAE 4120-4/00 (construcao de edificios)","resultado_esperado":"Grau de risco preenchido automaticamente e toast informando a origem"},
     {"ordem":2,"acao":"Conferir o grau atribuido","resultado_esperado":"Corresponde ao Quadro I da NR-04 para o CNAE informado"}]'::jsonb,
   'O grau vem do CNAE sem digitacao.',
   'Regra central do modulo e sem caso ate hoje. O toast faz parte do resultado esperado: preenchimento silencioso de campo legal e pior que nenhum, porque ninguem confere o que nao viu acontecer.'),

  (v_mod, 'ENQ-016', 'Auto-preenchimento nao atropela ajuste manual',
   'excecao', 'alta', 'aprovado', 'e2e',
   'O useEffect so age quando o CNAE MUDOU ou quando o grau esta vazio. Reabrir a ficha nao pode desfazer decisao tecnica de quem ajustou o grau na mao.',
   'Empresa com CNAE preenchido e grau de risco ajustado manualmente para valor diferente do sugerido.',
   '[{"ordem":1,"acao":"Sair da ficha e reabrir","resultado_esperado":"O grau ajustado permanece — o automatismo nao dispara"},
     {"ordem":2,"acao":"Editar outro campo qualquer e salvar","resultado_esperado":"O grau segue intacto"},
     {"ordem":3,"acao":"Trocar o CNAE principal","resultado_esperado":"AI sim o grau e recalculado, com toast, porque a premissa mudou"}]'::jsonb,
   'Automatismo cede ao ajuste humano, exceto quando a premissa muda.',
   'Classe de bug perigosa e invisivel: o dado volta ao valor automatico sem ninguem perceber, e a empresa passa a operar com grau errado. O passo 3 garante que a protecao nao vire engessamento.'),

  (v_mod, 'ENQ-017', 'CNAE sem grau mapeado nao quebra o cadastro',
   'excecao', 'media', 'aprovado', 'e2e',
   'CNAE inexistente, mal digitado ou fora da tabela nao pode travar o formulario nem gravar grau invalido.',
   'Formulario de enquadramento aberto.',
   '[{"ordem":1,"acao":"Informar um CNAE inexistente (ex.: 9999-9/99)","resultado_esperado":"Nenhum grau atribuido, sem erro em tela, campo segue editavel"},
     {"ordem":2,"acao":"Informar texto que nao e CNAE","resultado_esperado":"Mesmo comportamento — degrada sem quebrar"},
     {"ordem":3,"acao":"Preencher o grau manualmente","resultado_esperado":"Aceito normalmente"}]'::jsonb,
   'CNAE desconhecido degrada com elegancia.',
   'Importa porque a tabela CNAE-grau nao e exaustiva e o campo e texto livre, sem mascara nem selecao assistida.'),

  (v_mod, 'ENQ-050', '[A CONSTRUIR] Obrigatoriedade do SESMT vem do dimensionamento',
   'feliz', 'alta', 'rascunho', 'api',
   'ESPECIFICACAO — nao implementado. sesmt_obrigatorio e hoje um switch manual. A NR-04 define a obrigatoriedade de forma deterministica pelo cruzamento de grau de risco com numero de empregados. Os dois dados ja estao no cadastro.',
   'Depende de definir a fonte do numero de empregados (ver EMP-050) e de embarcar o Quadro II da NR-04.',
   '[{"ordem":1,"acao":"Empresa grau 3 com 60 empregados","resultado_esperado":"SESMT obrigatorio marcado automaticamente"},
     {"ordem":2,"acao":"Empresa grau 1 com 40 empregados","resultado_esperado":"SESMT nao obrigatorio"},
     {"ordem":3,"acao":"Cruzar a faixa admitindo empregados","resultado_esperado":"A obrigatoriedade acompanha, como acontece hoje com a cota PcD"}]'::jsonb,
   'Obrigatoriedade derivada da norma, nao declarada por quem preenche.',
   'Mesma classe do EMP-050: o dado necessario ja existe no sistema, a derivacao nao foi feita. Enquanto for switch manual, uma empresa obrigada pode ficar marcada como dispensada e o painel de conformidade concorda com o erro.'),

  (v_mod, 'ENQ-051', '[A CONSTRUIR] Obrigatoriedade da CIPA vem do Quadro I da NR-05',
   'feliz', 'media', 'rascunho', 'api',
   'ESPECIFICACAO — nao implementado. cipa_obrigatoria e switch manual. A NR-05 dimensiona por CNAE e numero de empregados.',
   'Depende do EMP-050 e do Quadro I da NR-05.',
   '[{"ordem":1,"acao":"Empresa no grupo de CNAE aplicavel com 25 empregados","resultado_esperado":"CIPA obrigatoria marcada automaticamente"},
     {"ordem":2,"acao":"Empresa abaixo do corte","resultado_esperado":"Nao obrigatoria, com indicacao de designado responsavel"}]'::jsonb,
   'Obrigatoriedade e dimensionamento derivados da norma.',
   'Par do ENQ-050. Documentado agora para que a lacuna fique visivel no backlog em vez de viver so na cabeca de quem leu a NR.'),

  (v_mod, 'ENQ-018', 'Mandato e membros viram obrigatorios com CIPA ativa',
   'alternativo', 'media', 'aprovado', 'e2e',
   'O checklist torna mandato (inicio e fim) e membros obrigatorios quando cipa_situacao = ativa. Declarar CIPA ativa sem mandato e sem membros e declaracao vazia.',
   'Empresa com CIPA obrigatoria.',
   '[{"ordem":1,"acao":"Marcar situacao nao_constituida","resultado_esperado":"Mandato e membros nao aparecem como pendencia obrigatoria"},
     {"ordem":2,"acao":"Mudar para ativa deixando mandato e membros vazios","resultado_esperado":"Checklist passa a acusar as duas pendencias"},
     {"ordem":3,"acao":"Preencher mandato e membros","resultado_esperado":"Pendencias resolvidas e bloco marcado como completo"}]'::jsonb,
   'Obrigatoriedade condicional acompanha a situacao declarada.',
   'Coberto so pelo checklist, sem nenhuma garantia no banco: pela API da para gravar CIPA ativa sem mandato nenhum.'),

  -- ═══════════════════════════════════════════════════════
  -- E) HIERARQUIA — matriz e filial
  -- HIER-001/002 cobrem grupo economico. A relacao matriz/filial,
  -- que e onde moram os ciclos e o vazamento entre tenants, nao.
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'HIER-003', 'Alternar entre matriz e filial limpa o vinculo anterior',
   'alternativo', 'media', 'aprovado', 'e2e',
   'Marcar a unidade como matriz zera matriz_id. Sem isso, sobra um ponteiro orfao apontando para a antiga matriz.',
   'Empresa cadastrada como filial, com matriz escolhida.',
   '[{"ordem":1,"acao":"Alterar tipo_unidade para matriz","resultado_esperado":"matriz_id e zerado e o seletor de matriz some da tela"},
     {"ordem":2,"acao":"Salvar e reabrir","resultado_esperado":"Continua matriz, sem vinculo residual"},
     {"ordem":3,"acao":"Voltar para filial","resultado_esperado":"Seletor reaparece vazio, exigindo nova escolha"}]'::jsonb,
   'Trocar o tipo nao deixa referencia pendurada.',
   'Ponteiro orfao nao aparece na tela e so se manifesta em relatorio consolidado por grupo.'),

  (v_mod, 'HIER-004', 'Filial herda o grupo economico da matriz sem sobrescrever',
   'alternativo', 'media', 'aprovado', 'e2e',
   'Ao escolher matriz que ja pertence a um grupo, a filial recebe o mesmo grupo — mas so se o campo estiver vazio.',
   'Uma matriz vinculada a um grupo economico.',
   '[{"ordem":1,"acao":"Criar filial com grupo vazio e escolher a matriz","resultado_esperado":"Grupo preenchido automaticamente com o da matriz"},
     {"ordem":2,"acao":"Criar filial com grupo JA escolhido e apontar a mesma matriz","resultado_esperado":"O grupo informado prevalece — nao e sobrescrito"}]'::jsonb,
   'Heranca preenche vazio, nunca substitui escolha.',
   'Mesma classe do ENQ-016: automatismo que respeita decisao explicita. O passo 2 e o que impede o auto-fill de virar atropelo.'),

  (v_mod, 'HIER-005', 'Ciclo entre matriz e filial e recusado',
   'negativo', 'alta', 'aprovado', 'api',
   'Se A e filial de B e B pode virar filial de A, a arvore vira ciclo e qualquer travessia recursiva trava.',
   'Duas empresas, A filial de B.',
   '[{"ordem":1,"acao":"Tentar tornar B filial de A","resultado_esperado":"Recusado — criaria ciclo"},
     {"ordem":2,"acao":"Tentar fazer uma empresa ser filial de si mesma","resultado_esperado":"Recusado"},
     {"ordem":3,"acao":"Tentar ciclo de tres niveis (A->B->C->A)","resultado_esperado":"Recusado"}]'::jsonb,
   'A arvore de unidades nunca fecha em ciclo.',
   'GAP PROVAVEL: nao ha constraint nem trigger de ciclo; a tela apenas exclui a propria empresa da lista de matrizes, o que resolve so o passo 2. Os passos 1 e 3 devem falhar. Caso escrito para medir antes de propor correcao.'),

  (v_mod, 'HIER-006', 'Filial nao pode apontar matriz de outro cliente',
   'negativo', 'critica', 'aprovado', 'api',
   'Isolamento multi-tenant tambem vale para a hierarquia. Uma filial apontando matriz de outro tenant vaza estrutura societaria entre clientes.',
   'Duas empresas em tenants diferentes.',
   '[{"ordem":1,"acao":"Tentar gravar matriz_id apontando empresa de outro tenant","resultado_esperado":"Recusado"},
     {"ordem":2,"acao":"Conferir a lista de matrizes na tela","resultado_esperado":"So aparecem empresas do proprio tenant"},
     {"ordem":3,"acao":"Repetir o passo 1 direto pela API","resultado_esperado":"Continua recusado — a protecao nao pode depender da tela"}]'::jsonb,
   'Hierarquia nao atravessa a fronteira do cliente.',
   'Prioridade critica pelo mesmo motivo do EMP-022. A RLS protege a LEITURA; nada garante que a FK de matriz_id respeite o tenant na escrita — o passo 3 e o que revela isso.'),

  -- ═══════════════════════════════════════════════════════
  -- F) GERACAO DE OBRIGACOES — 8 dos 14 templates sem caso
  -- REGRA-001..006/010/011 cobrem 6. Estes fecham a tabela.
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'REGRA-007', 'CIPA em implantacao gera obrigacao de eleicao',
   'feliz', 'media', 'aprovado', 'api',
   'Regra: cipa_obrigatoria E cipa_situacao = em_implantacao gera "Realizar eleicao da CIPA". Base legal NR-05.',
   'Empresa com CIPA obrigatoria e situacao em_implantacao.',
   '[{"ordem":1,"acao":"Gerar as obrigacoes da empresa","resultado_esperado":"Obrigacao de eleicao registrada, criticidade media"},
     {"ordem":2,"acao":"Mudar a situacao para ativa","resultado_esperado":"A obrigacao de eleicao deixa de ser gerada"}]'::jsonb,
   'Estado intermediario da CIPA tem obrigacao propria.',
   'Terceiro estado do cipa_situacao, sem caso ate hoje: REGRA-002 cobre nao_constituida e REGRA-011 cobre ativa. em_implantacao ficou no vao.'),

  (v_mod, 'REGRA-008', 'Mandato da CIPA perto do fim gera obrigacao de renovacao',
   'feliz', 'alta', 'aprovado', 'api',
   'Regra: falta menos de 90 dias para cipa_data_mandato_fim (ou ja venceu) gera "Renovar mandato da CIPA". Unica regra do modulo que depende da data corrente.',
   'Empresa com CIPA ativa e mandato cadastrado.',
   '[{"ordem":1,"acao":"Mandato terminando em 30 dias","resultado_esperado":"Obrigacao de renovacao registrada, criticidade alta"},
     {"ordem":2,"acao":"Mandato ja vencido","resultado_esperado":"Obrigacao tambem registrada — vencido e caso mais grave, nao menos"},
     {"ordem":3,"acao":"Mandato sem data de fim","resultado_esperado":"Nenhuma obrigacao — a regra retorna falso sem data"}]'::jsonb,
   'A renovacao entra na fila com antecedencia e continua depois de vencer.',
   'Regra sensivel ao tempo: passa a valer sozinha com o calendario, sem ninguem editar nada. E a unica do modulo com esse comportamento, o que a torna a mais facil de quebrar sem perceber.'),

  (v_mod, 'REGRA-009', 'Deficit de aprendiz gera obrigacao de contratacao',
   'feliz', 'media', 'aprovado', 'api',
   'Regra: aprendiz_obrigatorio E aprendiz_quantidade_atual menor que aprendiz_quantidade_minima gera "Contratar jovem aprendiz". Base legal CLT art. 429.',
   'Empresa com cota de aprendiz obrigatoria e minimo informado.',
   '[{"ordem":1,"acao":"Minimo 10, atual 4","resultado_esperado":"Obrigacao registrada"},
     {"ordem":2,"acao":"Minimo 10, atual 10","resultado_esperado":"Nenhuma obrigacao"},
     {"ordem":3,"acao":"Minimo 10, atual 12","resultado_esperado":"Nenhuma obrigacao — acima do minimo continua regular"}]'::jsonb,
   'Deficit de aprendiz vira pendencia; cota cumprida nao polui o painel.',
   'Decimo quarto template e o unico do bloco de inclusao sem caso. Note a diferenca em relacao ao PcD: aqui a comparacao e contra o MINIMO da faixa, nao contra uma quantidade calculada.'),

  (v_mod, 'REGRA-012', 'Cada condicao especial gera a obrigacao da sua norma',
   'feliz', 'alta', 'aprovado', 'api',
   'Cinco condicoes especiais, cada uma amarrada a uma NR. Sao cinco templates independentes que nunca tiveram caso.',
   'Empresa cadastrada, condicoes especiais desmarcadas.',
   '[{"ordem":1,"acao":"Marcar trabalho_altura","resultado_esperado":"Obrigacao de treinamento NR-35, criticidade alta"},
     {"ordem":2,"acao":"Marcar espaco_confinado","resultado_esperado":"Obrigacao de treinamento NR-33, criticidade alta"},
     {"ordem":3,"acao":"Marcar insalubridade","resultado_esperado":"Obrigacao de revisar laudos NR-15, criticidade media"},
     {"ordem":4,"acao":"Marcar periculosidade","resultado_esperado":"Obrigacao de revisar laudos NR-16, criticidade media"},
     {"ordem":5,"acao":"Marcar possui_terceiro_turno","resultado_esperado":"Obrigacao de avaliar impacto, NR-17 e CLT art. 73, criticidade media"},
     {"ordem":6,"acao":"Desmarcar todas","resultado_esperado":"Nenhuma das cinco obrigacoes e gerada"}]'::jsonb,
   'Cada condicao marcada produz exatamente a obrigacao da sua norma.',
   'Cinco templates em um caso porque a estrutura e identica — switch booleano direto para obrigacao. O passo 6 e a contraprova coletiva, no espirito de REGRA-010 e REGRA-011.'),

  (v_mod, 'REGRA-013', 'Cota PcD obrigatoria com quantidade zerada gera obrigacao',
   'alternativo', 'alta', 'aprovado', 'api',
   'Ramo esquecido da regra do PcD: a condicao dispara tambem quando pcd_quantidade_exigida = 0, nao so quando ha deficit. Marcar a cota como obrigatoria e nao calcular nada nao pode passar batido.',
   'Empresa com pcd_obrigatoria = true e pcd_quantidade_exigida = 0.',
   '[{"ordem":1,"acao":"Gerar as obrigacoes","resultado_esperado":"Obrigacao de adequacao registrada, mesmo sem deficit calculado"},
     {"ordem":2,"acao":"Calcular a cota corretamente e ficar em dia","resultado_esperado":"A obrigacao deixa de ser gerada"}]'::jsonb,
   'Cota obrigatoria em branco e tratada como pendencia, nao como conformidade.',
   'Ramo proposital da condicao, facil de perder numa refatoracao: quem simplificar para "atual < exigida" quebra este caso em silencio, e empresa com cota zerada passa a aparecer como conforme.'),

  (v_mod, 'REGRA-014', 'FAP exatamente em 1,5 nao gera obrigacao',
   'negativo', 'media', 'aprovado', 'api',
   'A condicao e ESTRITAMENTE maior que 1,5. A fronteira precisa de caso proprio porque um >= trocado por > passa despercebido em revisao.',
   'Empresa cadastrada.',
   '[{"ordem":1,"acao":"FAP = 1,5","resultado_esperado":"Nenhuma obrigacao — o limite nao esta incluido"},
     {"ordem":2,"acao":"FAP = 1,5001","resultado_esperado":"Obrigacao de plano de reducao registrada"},
     {"ordem":3,"acao":"FAP nulo","resultado_esperado":"Nenhuma obrigacao — ausencia nao e valor alto"}]'::jsonb,
   'A fronteira do FAP e exclusiva e a ausencia nao dispara nada.',
   'fap_atual e NUMERIC(5,4): a quarta casa decimal existe e o passo 2 usa isso. Complementa REGRA-004, que testa o caso claramente acima do limite.'),

  -- ═══════════════════════════════════════════════════════
  -- G) PORTE DA EMPRESA — familia inteira sem um unico caso
  -- Alimenta o dimensionamento do Plano de Acao do PGR.
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'PORTE-001', 'Classificacao de porte em comercio e servicos',
   'feliz', 'alta', 'aprovado', 'e2e',
   'Cortes IBGE/SEBRAE por pessoal ocupado. Pequena e Media sao agrupadas na Categoria B, como fazem os modelos de referencia.',
   'Empresa com CNAE de comercio ou servicos.',
   '[{"ordem":1,"acao":"9 colaboradores","resultado_esperado":"Categoria A — MEI e Microempresa"},
     {"ordem":2,"acao":"10 colaboradores","resultado_esperado":"Categoria B — Pequeno e Medio Porte"},
     {"ordem":3,"acao":"99 colaboradores","resultado_esperado":"Continua Categoria B"},
     {"ordem":4,"acao":"100 colaboradores","resultado_esperado":"Categoria C — Grande Porte"}]'::jsonb,
   'As tres categorias e suas fronteiras respeitam o criterio IBGE/SEBRAE.',
   'Familia sem nenhum caso ate hoje, apesar de definir o dimensionamento do Plano de Acao do PGR. O porte decide se o plano pede comite multidisciplinar ou acao simples de baixo custo.'),

  (v_mod, 'PORTE-002', 'Industria e construcao usam cortes proprios',
   'alternativo', 'alta', 'aprovado', 'e2e',
   'O mesmo headcount classifica diferente conforme o setor. Uma industria com 80 pessoas e Categoria B; um comercio com 80 tambem, mas por pouco — e com 100 os dois divergem.',
   'Empresa com CNAE industrial ou de construcao.',
   '[{"ordem":1,"acao":"19 colaboradores","resultado_esperado":"Categoria A"},
     {"ordem":2,"acao":"20 colaboradores","resultado_esperado":"Categoria B"},
     {"ordem":3,"acao":"499 colaboradores","resultado_esperado":"Continua Categoria B"},
     {"ordem":4,"acao":"500 colaboradores","resultado_esperado":"Categoria C"},
     {"ordem":5,"acao":"Mesmo headcount de 100 em ambos os setores","resultado_esperado":"Comercio = Categoria C; industria = Categoria B"}]'::jsonb,
   'Os cortes acompanham o setor, nao so o numero.',
   'O passo 5 e o coracao do caso: prova que a classificacao nao pode ser feita so pelo headcount, erro provavel em qualquer reimplementacao.'),

  (v_mod, 'PORTE-003', 'Setor derivado da divisao do CNAE',
   'alternativo', 'media', 'aprovado', 'e2e',
   'setorPorCnae le os dois primeiros digitos do CNAE 2.0. Divisoes 05-09 (extrativas), 10-33 (transformacao) e 41-43 (construcao) sao industria; o resto e comercio e servicos.',
   'Nenhuma.',
   '[{"ordem":1,"acao":"CNAE iniciado em 41 (construcao)","resultado_esperado":"Industria e construcao"},
     {"ordem":2,"acao":"CNAE iniciado em 10 (alimentos)","resultado_esperado":"Industria e construcao"},
     {"ordem":3,"acao":"CNAE iniciado em 47 (comercio varejista)","resultado_esperado":"Comercio e servicos"},
     {"ordem":4,"acao":"CNAE iniciado em 34 (fora das faixas industriais)","resultado_esperado":"Comercio e servicos"},
     {"ordem":5,"acao":"CNAE com pontuacao (41.20-4/00)","resultado_esperado":"Mesma classificacao — a pontuacao e removida antes da leitura"}]'::jsonb,
   'A divisao do CNAE determina o setor, com ou sem formatacao.',
   'O passo 4 cobre a borda entre 33 e 41, faixa que NAO e industrial e passaria despercebida numa reimplementacao por intervalo unico.'),

  (v_mod, 'PORTE-004', 'Sem CNAE, o sistema adota o corte mais conservador',
   'excecao', 'media', 'aprovado', 'e2e',
   'Empresa sem CNAE cai em comercio e servicos, que tem cortes mais baixos. O porte tende a subir, e um plano mais robusto que o necessario e erro menos grave que o contrario.',
   'Empresa sem CNAE principal.',
   '[{"ordem":1,"acao":"Classificar empresa sem CNAE, 50 colaboradores","resultado_esperado":"Comercio e servicos — Categoria B"},
     {"ordem":2,"acao":"CNAE com menos de dois digitos","resultado_esperado":"Mesmo tratamento do vazio"},
     {"ordem":3,"acao":"Comparar com a classificacao industrial do mesmo headcount","resultado_esperado":"O default nunca produz porte MENOR que o setor real"}]'::jsonb,
   'A ausencia de CNAE erra para o lado seguro, de forma deliberada.',
   'Decisao de projeto documentada no codigo e agora tambem em caso: nao e fallback acidental. O passo 3 protege a intencao — quem trocar o default por industria inverte o sentido do erro.'),

  (v_mod, 'PORTE-005', 'Contagem de porte usa admissoes concluidas e nao inativas',
   'alternativo', 'critica', 'aprovado', 'api',
   'O porte e o unico ponto do modulo que conta gente de verdade, em vez de ler o campo digitado. A regra de quem entra na conta precisa estar registrada.',
   'Empresa com admissoes em varios status.',
   '[{"ordem":1,"acao":"Admissao com status concluido e inativo = false","resultado_esperado":"Conta"},
     {"ordem":2,"acao":"Admissao com status concluido e inativo = NULL","resultado_esperado":"CONTA — registro antigo sem o campo e tratado como ativo"},
     {"ordem":3,"acao":"Admissao com status concluido e inativo = true","resultado_esperado":"Nao conta"},
     {"ordem":4,"acao":"Admissao em andamento","resultado_esperado":"Nao conta — so concluida entra"},
     {"ordem":5,"acao":"Admissao de outra empresa do mesmo tenant","resultado_esperado":"Nao conta — a unidade e o CNPJ, nao o grupo"}]'::jsonb,
   'A contagem e por CNPJ, so concluidas, e nulo em inativo conta como ativo.',
   'CRITICO e sutil: o passo 2 e a regra mais facil de quebrar. Trocar o filtro por inativo = false silenciosamente exclui todo registro antigo e derruba o porte da empresa uma categoria inteira. O passo 5 registra que a unidade e o CNPJ, coerente com a emissao do plano.'),

  -- ═══════════════════════════════════════════════════════
  -- H) IMPORTACAO DE EMPRESAS — familia inteira sem caso
  -- 680 linhas de validacao sem um unico teste documentado.
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'IMP-001', 'Importar planilha valida cria as empresas',
   'feliz', 'alta', 'aprovado', 'e2e',
   'Caminho normal da importacao por XLSX, com o modelo baixado do proprio sistema.',
   'Modelo baixado e preenchido com 3 empresas novas e documentos validos.',
   '[{"ordem":1,"acao":"Subir a planilha","resultado_esperado":"3 empresas criadas, nenhum erro"},
     {"ordem":2,"acao":"Conferir a acentuacao das razoes sociais","resultado_esperado":"Acentos corretos, sem caractere trocado"},
     {"ordem":3,"acao":"Comparar a estrutura com o cadastro manual","resultado_esperado":"Mesmos campos preenchidos"}]'::jsonb,
   'Importacao produz empresas equivalentes ao cadastro manual.',
   'O passo 2 nao e zelo excessivo: encoding ja causou bug real de importacao neste sistema, e o mesmo passo existe no COLAB-010 pelo mesmo motivo.'),

  (v_mod, 'IMP-002', 'Linha sem CNPJ nem CPF e recusada com o numero da linha',
   'excecao', 'alta', 'aprovado', 'e2e',
   'Documento e o unico campo realmente obrigatorio da importacao. O erro precisa dizer QUAL linha, senao o usuario nao tem como corrigir uma planilha de centenas.',
   'Planilha com uma linha sem documento no meio de linhas validas.',
   '[{"ordem":1,"acao":"Importar","resultado_esperado":"Erro citando o numero da linha na planilha (cabecalho contado)"},
     {"ordem":2,"acao":"Conferir as demais linhas","resultado_esperado":"As validas foram importadas — uma linha ruim nao aborta o lote"}]'::jsonb,
   'Erro por linha, importacao parcial preservada.',
   'A numeracao mostrada precisa bater com a que o usuario ve no Excel, incluindo a linha de cabecalho. Fora por um e erro classico aqui.'),

  (v_mod, 'IMP-003', 'CNPJ com digito verificador invalido e recusado',
   'excecao', 'alta', 'aprovado', 'e2e',
   'A importacao valida o DV com validateCnpj, nao apenas o tamanho. CNPJ com 14 digitos aleatorios nao pode entrar.',
   'Planilha com um CNPJ de 14 digitos e DV errado.',
   '[{"ordem":1,"acao":"Importar","resultado_esperado":"Erro citando linha e o documento invalido"},
     {"ordem":2,"acao":"Corrigir o DV e reimportar","resultado_esperado":"Aceito"}]'::jsonb,
   'Validacao e de DV, nao de comprimento.',
   'Diferenca relevante em relacao ao cadastro de pessoa: no CPF do colaborador nao ha validacao equivalente (ver COLAB-033/034). Os dois caminhos tratam documento com rigor diferente.'),

  (v_mod, 'IMP-004', 'Documento repetido dentro da propria planilha',
   'excecao', 'alta', 'aprovado', 'e2e',
   'A planilha pode conter a mesma empresa duas vezes. A deteccao acontece durante a leitura, antes de gravar.',
   'Planilha com o mesmo CNPJ em duas linhas.',
   '[{"ordem":1,"acao":"Importar","resultado_esperado":"A primeira ocorrencia entra, a segunda e sinalizada como duplicada"},
     {"ordem":2,"acao":"Conferir a base","resultado_esperado":"Uma unica empresa criada"}]'::jsonb,
   'Duplicata interna da planilha nao vira duplicata na base.',
   'Distinto do IMP-005: aqui o conflito e da planilha consigo mesma, e nao existe registro previo para comparar.'),

  (v_mod, 'IMP-005', 'Documento ja existente e sinalizado, nao recriado',
   'excecao', 'critica', 'aprovado', 'e2e',
   'A importacao monta um mapa dos documentos ja cadastrados e devolve os conflitos como duplicados. Reimportar nao pode gerar segunda empresa nem sobrescrever em silencio.',
   'Empresa ja cadastrada e planilha contendo o mesmo documento.',
   '[{"ordem":1,"acao":"Importar a planilha","resultado_esperado":"Documento aparece na lista de duplicados, nenhuma empresa nova criada"},
     {"ordem":2,"acao":"Conferir a empresa existente","resultado_esperado":"Dados originais preservados — a importacao nao sobrescreveu"},
     {"ordem":3,"acao":"Conferir com documento formatado diferente na planilha","resultado_esperado":"Continua reconhecido — a comparacao e por digitos"}]'::jsonb,
   'Reimportacao identifica, informa e nao duplica.',
   'CRITICO e diretamente comparavel ao COLAB-030: mesmo problema, modulo diferente. Aqui a deteccao ja existe; no colaborador, a escolha substituir/manter ainda esta por construir. Vale conferir se as duas rotas de importacao merecem a mesma regra.'),

  (v_mod, 'IMP-006', 'Linha de exemplo e linhas vazias sao ignoradas',
   'alternativo', 'media', 'aprovado', 'e2e',
   'O modelo vem com uma linha de exemplo marcada e 500 linhas pre-alocadas. Nenhuma das duas pode virar empresa.',
   'Modelo baixado do sistema, preenchido apenas nas primeiras linhas.',
   '[{"ordem":1,"acao":"Importar sem apagar a linha de exemplo","resultado_esperado":"A linha de exemplo e ignorada, sem erro"},
     {"ordem":2,"acao":"Conferir as linhas em branco pre-alocadas","resultado_esperado":"Ignoradas silenciosamente"},
     {"ordem":3,"acao":"Conferir o total importado","resultado_esperado":"Exatamente as linhas preenchidas pelo usuario"}]'::jsonb,
   'O proprio modelo do sistema nao contamina a importacao.',
   'Sem isso, todo usuario que nao apagar a linha de exemplo cadastra uma empresa ficticia — e o modelo e do proprio sistema.'),

  (v_mod, 'IMP-010', 'Enriquecimento via BrasilAPI so preenche campo vazio',
   'alternativo', 'media', 'aprovado', 'e2e',
   'A funcao de enriquecer busca dados publicos por CNPJ e completa empresas incompletas. Nao pode sobrescrever informacao que alguem ajustou a mao.',
   'Empresa com CNPJ valido, alguns campos vazios e outros preenchidos manualmente.',
   '[{"ordem":1,"acao":"Rodar o enriquecimento","resultado_esperado":"Campos vazios preenchidos com os dados publicos"},
     {"ordem":2,"acao":"Conferir os campos preenchidos manualmente","resultado_esperado":"Intactos"},
     {"ordem":3,"acao":"Rodar com CNPJ inexistente na base publica","resultado_esperado":"Falha isolada, sem interromper as demais empresas"},
     {"ordem":4,"acao":"Conferir o aviso ao final","resultado_esperado":"Informa quantas empresas foram enriquecidas"}]'::jsonb,
   'Enriquecimento completa lacunas sem atropelar dado curado.',
   'Terceira ocorrencia do mesmo padrao no modulo (ENQ-016 e HIER-004 sao as outras): automatismo que preenche vazio mas respeita escolha explicita. Vale tratar como principio do modulo, nao como decisao caso a caso.'),

  -- ═══════════════════════════════════════════════════════
  -- I) CHECKLIST DE COMPLETUDE
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'CHK-001', 'Checklist reflete o preenchimento em tempo real',
   'feliz', 'media', 'aprovado', 'e2e',
   'O checklist e a leitura que o usuario tem do proprio cadastro, dividido em cinco blocos. Precisa acompanhar a digitacao, nao o salvamento.',
   'Cadastro novo, em branco.',
   '[{"ordem":1,"acao":"Abrir o checklist","resultado_esperado":"Todos os obrigatorios listados como pendentes"},
     {"ordem":2,"acao":"Preencher razao social, documento, e-mail, CEP, endereco, cidade e estado","resultado_esperado":"Bloco de dados basicos marcado como completo"},
     {"ordem":3,"acao":"Conferir a contagem de pendencias","resultado_esperado":"Diminui conforme os campos sao preenchidos"}]'::jsonb,
   'O checklist e espelho fiel e imediato do cadastro.',
   'Cinco blocos: dados basicos, enquadramento, inclusao, FAP/TAC e jornada. Opcionais aparecem sem marcacao de obrigatorio.'),

  (v_mod, 'CHK-002', 'Obrigatoriedade condicional acompanha o que foi declarado',
   'alternativo', 'alta', 'aprovado', 'e2e',
   'Varios campos so viram obrigatorios em funcao de outra escolha. E a parte mais dificil de acertar do checklist e a que ninguem testou.',
   'Cadastro com os dados basicos completos.',
   '[{"ordem":1,"acao":"Ligar sesmt_obrigatorio","resultado_esperado":"Profissionais do SESMT passam a ser exigidos"},
     {"ordem":2,"acao":"Marcar CIPA como ativa","resultado_esperado":"Mandato e membros passam a ser exigidos"},
     {"ordem":3,"acao":"Ligar pcd_obrigatoria","resultado_esperado":"Cota exigida e PcDs atuais passam a ser exigidos"},
     {"ordem":4,"acao":"Ligar aprendiz_obrigatorio","resultado_esperado":"Minimo e atual de aprendizes passam a ser exigidos"},
     {"ordem":5,"acao":"Ligar tac_possui","resultado_esperado":"Detalhes do TAC passam a ser exigidos"},
     {"ordem":6,"acao":"Desligar cada uma das chaves","resultado_esperado":"As exigencias correspondentes desaparecem, sem deixar pendencia orfa"}]'::jsonb,
   'A exigencia nasce e morre junto com a declaracao que a origina.',
   'Cinco condicionais em um caso porque a mecanica e a mesma. O passo 6 e o que garante que desmarcar limpa de verdade — pendencia orfa deixa o cadastro travado em incompleto para sempre, sem o usuario descobrir o motivo.'),

  (v_mod, 'CHK-003', 'Quantidade zero conta como preenchida',
   'excecao', 'media', 'aprovado', 'e2e',
   'Zero PcDs contratados e uma resposta legitima e diferente de nao ter respondido. O checklist trata os dois campos de quantidade atual com verificacao propria, distinta do resto.',
   'Empresa com cota PcD e de aprendiz obrigatorias.',
   '[{"ordem":1,"acao":"Informar 0 em PcDs contratados atualmente","resultado_esperado":"Campo considerado PREENCHIDO — zero e resposta"},
     {"ordem":2,"acao":"Deixar o campo realmente vazio","resultado_esperado":"Considerado pendente"},
     {"ordem":3,"acao":"Repetir com aprendizes contratados","resultado_esperado":"Mesmo comportamento"}]'::jsonb,
   'Zero e informacao; vazio e ausencia. O checklist distingue os dois.',
   'Distincao facil de perder: uma verificacao ingenua de valor vazio trataria 0 como nao preenchido e a empresa em deficit total nunca completaria o cadastro — justamente a que mais precisa aparecer como conforme para o painel funcionar.')

  ON CONFLICT (codigo) DO NOTHING;

  SELECT count(*) INTO v_depois FROM public.qa_casos_teste WHERE modulo_id = v_mod;

  RAISE NOTICE 'Modulo Empresa: % casos antes, % depois (+%).',
    v_antes, v_depois, v_depois - v_antes;
END $doc$;

-- ─────────────────────────────────────────────────────────
-- Retrato honesto da cobertura, por nivel
-- ─────────────────────────────────────────────────────────
SELECT
  ct.nivel,
  ct.status::text                                            AS status,
  count(*)                                                   AS casos,
  count(i.funcao_sql)                                        AS com_rotina,
  count(*) - count(i.funcao_sql)                             AS sem_rotina
FROM public.qa_casos_teste ct
JOIN public.qa_modulos m ON m.id = ct.modulo_id
LEFT JOIN public.qa_implementacoes i ON i.codigo = ct.codigo AND i.ativo
WHERE m.path = 'estrutura-organizacional/empresa'
GROUP BY ct.nivel, ct.status
ORDER BY ct.nivel, ct.status;

-- Fila de trabalho: casos de banco, aprovados, ainda sem rotina.
SELECT ct.codigo, ct.prioridade::text AS prioridade, ct.titulo
FROM public.qa_casos_teste ct
JOIN public.qa_modulos m ON m.id = ct.modulo_id
LEFT JOIN public.qa_implementacoes i ON i.codigo = ct.codigo AND i.ativo
WHERE m.path = 'estrutura-organizacional/empresa'
  AND ct.status = 'aprovado'
  AND ct.nivel  = 'api'
  AND i.funcao_sql IS NULL
ORDER BY
  CASE ct.prioridade WHEN 'critica' THEN 1 WHEN 'alta' THEN 2 WHEN 'media' THEN 3 ELSE 4 END,
  ct.codigo;
