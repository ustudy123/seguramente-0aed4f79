-- =========================================================
-- QA — PILOTO: casos de teste de Colaboradores
--
-- Primeiro módulo documentado. Serve de referência de formato e
-- profundidade para os demais.
--
-- Contexto real do módulo (lido do schema, não suposto):
--   * Não existe tabela "colaboradores". O colaborador é
--     usuarios_base (a pessoa) + usuario_vinculos (o vínculo com a
--     empresa).
--   * O índice de CPF é PARCIAL:
--       usuarios_base_cpf_tenant_uidx ON usuarios_base(tenant_id, cpf)
--       WHERE cpf IS NOT NULL
--     Ou seja: por tenant o CPF é único, o mesmo CPF PODE existir em
--     outro tenant (a CLT permite mais de um vínculo empregatício), e
--     pessoa sem CPF não é coberta pelo índice.
--   * Existem alerta_duplicidade / duplicidade_nivel — detecção "soft"
--     convivendo com a constraint "hard".
--
-- ATENÇÃO — casos que documentam comportamento AINDA NÃO IMPLEMENTADO
-- (a documentação é a especificação, não o retrato do código):
--   COLAB-030/031/032 → escolha "substituir ou manter" na reimportação
--   COLAB-033         → normalização de CPF antes de comparar
--   COLAB-034         → deduplicação quando não há CPF
-- Esses nascem falhando de propósito. É o débito que o piloto revelou.
--
-- ON CONFLICT (codigo) DO NOTHING: reexecutar não sobrescreve o que for
-- editado depois pela tela.
-- =========================================================

DO $seed$
DECLARE
  v_mod uuid;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos
  WHERE path = 'estrutura-organizacional/colaboradores';

  IF v_mod IS NULL THEN
    RAISE EXCEPTION 'Módulo estrutura-organizacional/colaboradores não encontrado. Rode a migration do diretório antes.';
  END IF;

  INSERT INTO public.qa_casos_teste
    (modulo_id, codigo, titulo, tipo, prioridade, status, nivel, objetivo, pre_condicoes, passos, resultado_esperado, observacoes)
  VALUES

  -- ─── CAMINHO FELIZ ──────────────────────────────────
  (v_mod, 'COLAB-001', 'Cadastro manual de colaborador com vínculo ativo',
   'feliz', 'alta', 'aprovado', 'api',
   'Garantir que o cadastro básico cria a pessoa e o vínculo, e que ela passa a existir para os demais módulos.',
   'Tenant de teste com 1 empresa, 1 departamento e 1 cargo ativos. Usuário RH autenticado.',
   '[{"ordem":1,"acao":"Cadastrar pessoa com nome completo, e-mail e CPF válido","resultado_esperado":"Registro criado em usuarios_base com o tenant_id do usuário autenticado"},
     {"ordem":2,"acao":"Vincular à empresa, departamento e cargo","resultado_esperado":"usuario_vinculos criado e ativo"},
     {"ordem":3,"acao":"Consultar a lista de colaboradores","resultado_esperado":"Pessoa aparece com cargo e departamento corretos"},
     {"ordem":4,"acao":"Conferir alerta_duplicidade","resultado_esperado":"Vem false — não há duplicata"}]'::jsonb,
   'Colaborador existe, vinculado e disponível para admissão, ponto e SST.', NULL),

  (v_mod, 'COLAB-002', 'Busca de colaborador por nome e por CPF',
   'feliz', 'media', 'aprovado', 'api',
   'A busca encontra a pessoa pelos dois identificadores que o RH usa no dia a dia.',
   'COLAB-001 executado.',
   '[{"ordem":1,"acao":"Buscar pelo nome parcial","resultado_esperado":"Colaborador retornado"},
     {"ordem":2,"acao":"Buscar pelo CPF sem formatação","resultado_esperado":"Colaborador retornado"},
     {"ordem":3,"acao":"Buscar pelo CPF formatado (com pontos e traço)","resultado_esperado":"Colaborador retornado — a busca normaliza a entrada"}]'::jsonb,
   'A busca é indiferente à formatação do CPF.',
   'O passo 3 é o mesmo princípio de normalização do COLAB-033.'),

  -- ─── CAMINHO ALTERNATIVO ────────────────────────────
  (v_mod, 'COLAB-010', 'Importação de colaboradores por planilha',
   'alternativo', 'alta', 'aprovado', 'api',
   'Chegar ao mesmo resultado do cadastro manual por outro caminho.',
   'Planilha com 3 colaboradores novos, CPFs válidos e distintos, nomes com acentuação.',
   '[{"ordem":1,"acao":"Importar a planilha","resultado_esperado":"3 registros criados, 0 erros"},
     {"ordem":2,"acao":"Conferir a acentuação dos nomes gravados","resultado_esperado":"Acentos corretos (UTF-8), sem caracteres trocados"},
     {"ordem":3,"acao":"Conferir os vínculos","resultado_esperado":"Os 3 com vínculo ativo na empresa escolhida"},
     {"ordem":4,"acao":"Comparar a estrutura com o cadastro manual do COLAB-001","resultado_esperado":"Mesmos campos preenchidos — a importação não deixa buraco"}]'::jsonb,
   'Importação produz colaboradores equivalentes ao cadastro manual.',
   'Encoding já causou bug real neste sistema (importação CSV) — daí o passo 2.'),

  (v_mod, 'COLAB-011', 'Cadastro com apenas os campos obrigatórios',
   'alternativo', 'media', 'aprovado', 'api',
   'O cadastro mínimo é aceito; o opcional é de fato opcional.',
   'Tenant de teste.',
   '[{"ordem":1,"acao":"Cadastrar informando somente nome completo e e-mail","resultado_esperado":"Aceito — CPF, matrícula e demais campos são opcionais"},
     {"ordem":2,"acao":"Consultar o registro","resultado_esperado":"Campos não informados vêm nulos, não vazios nem com placeholder"}]'::jsonb,
   'Pessoa criada com o mínimo, pronta para complemento posterior.', NULL),

  (v_mod, 'COLAB-012', 'Mesma pessoa com vínculo em duas empresas do mesmo tenant',
   'alternativo', 'alta', 'aprovado', 'api',
   'Um cliente com várias empresas pode ter a mesma pessoa atuando em mais de uma.',
   'Tenant de teste com 2 empresas. COLAB-001 executado.',
   '[{"ordem":1,"acao":"Criar um segundo vínculo da mesma pessoa em outra empresa do tenant","resultado_esperado":"Aceito — 2 registros em usuario_vinculos para a mesma usuarios_base"},
     {"ordem":2,"acao":"Conferir usuarios_base","resultado_esperado":"Continua 1 pessoa — o CPF não foi duplicado"},
     {"ordem":3,"acao":"Listar colaboradores de cada empresa","resultado_esperado":"A pessoa aparece nas duas, com o cargo de cada vínculo"}]'::jsonb,
   'Pessoa única, múltiplos vínculos.',
   'É o que distingue o modelo pessoa+vínculo de um cadastro chapado por empresa.'),

  -- ─── CAMINHO NEGATIVO ───────────────────────────────
  (v_mod, 'COLAB-020', 'CPF já cadastrado no mesmo tenant é recusado',
   'negativo', 'critica', 'aprovado', 'api',
   'A constraint tem que segurar, e o erro tem que ser legível para o RH.',
   'COLAB-001 executado (existe pessoa com CPF X).',
   '[{"ordem":1,"acao":"Cadastrar nova pessoa com o mesmo CPF X no mesmo tenant","resultado_esperado":"Recusado — violação de usuarios_base_cpf_tenant_uidx"},
     {"ordem":2,"acao":"Ler a mensagem exibida","resultado_esperado":"Erro em português dizendo que o CPF já existe e quem é o titular — nunca o texto cru do Postgres"},
     {"ordem":3,"acao":"Conferir a base","resultado_esperado":"Continua 1 registro para o CPF X"},
     {"ordem":4,"acao":"Cadastrar o mesmo CPF X em OUTRO tenant","resultado_esperado":"Aceito — o índice é por (tenant_id, cpf) e a CLT permite mais de um vínculo empregatício"}]'::jsonb,
   'CPF único por tenant; livre entre tenants.',
   'Passo 4 é decisão de negócio confirmada: a mesma pessoa pode ser colaboradora de dois clientes diferentes.'),

  (v_mod, 'COLAB-021', 'CPF matematicamente inválido é recusado',
   'negativo', 'alta', 'aprovado', 'api',
   'Validar o dígito verificador, não só o tamanho.',
   'Tenant de teste.',
   '[{"ordem":1,"acao":"Cadastrar com CPF de 11 dígitos e DV errado (ex.: 11111111111)","resultado_esperado":"Recusado com mensagem de CPF inválido"},
     {"ordem":2,"acao":"Cadastrar com CPF de menos de 11 dígitos","resultado_esperado":"Recusado"},
     {"ordem":3,"acao":"Cadastrar com letras no campo CPF","resultado_esperado":"Recusado ou sanitizado — nunca gravado com letra"}]'::jsonb,
   'Nenhum CPF inválido entra na base.',
   'CPF inválido contamina eSocial, ponto e qualquer integração fiscal depois.'),

  (v_mod, 'COLAB-022', 'Campo obrigatório vazio é recusado',
   'negativo', 'media', 'aprovado', 'api',
   'O formulário não deixa criar pessoa sem identidade mínima.',
   'Tenant de teste.',
   '[{"ordem":1,"acao":"Tentar salvar sem nome_completo","resultado_esperado":"Recusado, com o campo sinalizado"},
     {"ordem":2,"acao":"Tentar salvar sem email_principal","resultado_esperado":"Recusado, com o campo sinalizado"},
     {"ordem":3,"acao":"Tentar salvar com nome só de espaços","resultado_esperado":"Recusado — espaço não conta como preenchimento"}]'::jsonb,
   'Registro sem identidade mínima não existe.', NULL),

  (v_mod, 'COLAB-023', 'E-mail já em uso no tenant',
   'negativo', 'alta', 'aprovado', 'api',
   'E-mail é chave de acesso; duplicar quebra convite e login.',
   'COLAB-001 executado.',
   '[{"ordem":1,"acao":"Cadastrar outra pessoa com o mesmo email_principal no mesmo tenant","resultado_esperado":"Recusado ou sinalizado como duplicidade — nunca aceito em silêncio"},
     {"ordem":2,"acao":"Conferir alerta_duplicidade da tentativa","resultado_esperado":"Marcado, com duplicidade_nivel preenchido"}]'::jsonb,
   'E-mail não duplica dentro do tenant.',
   'Verificar se a regra é constraint ou só alerta — determina se o passo 1 bloqueia ou avisa.'),

  (v_mod, 'COLAB-024', 'Colaborador de outro tenant é invisível',
   'negativo', 'critica', 'aprovado', 'api',
   'Isolamento multi-tenant. Vazamento aqui é incidente de LGPD.',
   'Dois tenants com colaboradores distintos. Autenticado no tenant A.',
   '[{"ordem":1,"acao":"Listar colaboradores autenticado no tenant A","resultado_esperado":"Somente os do tenant A"},
     {"ordem":2,"acao":"Buscar pelo CPF de um colaborador do tenant B","resultado_esperado":"Nenhum resultado — a existência dele não é revelada"},
     {"ordem":3,"acao":"Requisitar diretamente o id de um colaborador do tenant B (IDOR)","resultado_esperado":"Negado pela RLS"},
     {"ordem":4,"acao":"Repetir a listagem sem autenticação","resultado_esperado":"Negado"}]'::jsonb,
   'Nenhum dado atravessa a fronteira do tenant.',
   'Este caso é o template do bloco Infra & Auth — deve se repetir em cada módulo.'),

  -- ─── EXCEÇÃO ────────────────────────────────────────
  (v_mod, 'COLAB-030', 'Reimportar a mesma planilha não duplica e pede decisão',
   'excecao', 'critica', 'aprovado', 'api',
   'Importação é idempotente: reimportar identifica os existentes e devolve a decisão ao usuário, nunca duplica em silêncio.',
   'COLAB-010 executado (os 3 já existem).',
   '[{"ordem":1,"acao":"Importar exatamente a mesma planilha","resultado_esperado":"Sistema identifica os 3 como já existentes e pergunta se deve substituir os dados ou mantê-los"},
     {"ordem":2,"acao":"Contar registros por CPF","resultado_esperado":"1 por CPF — nenhum duplicado, independentemente da escolha"},
     {"ordem":3,"acao":"Importar planilha com 1 CPF novo entre os 3 existentes","resultado_esperado":"1 criado; os 3 existentes apenas sinalizados, não duplicados"}]'::jsonb,
   'Reimportação nunca duplica; a decisão sobre os dados é do usuário.',
   'REPRODUZ O BUG conhecido de duplicação por reimportação. A escolha substituir/manter é regra NOVA definida em jul/2026 — ainda não implementada.'),

  (v_mod, 'COLAB-031', 'Reimportação com a opção "manter" preserva os dados atuais',
   'excecao', 'alta', 'aprovado', 'api',
   'Escolher manter significa que a planilha não sobrescreve nada.',
   'COLAB-010 executado. Um colaborador teve o cargo alterado no sistema depois da importação.',
   '[{"ordem":1,"acao":"Reimportar a planilha original (que traz o cargo antigo) escolhendo Manter","resultado_esperado":"O cargo alterado no sistema permanece — a planilha não sobrescreve"},
     {"ordem":2,"acao":"Conferir a contagem","resultado_esperado":"Nenhum registro criado"},
     {"ordem":3,"acao":"Conferir o relatório da importação","resultado_esperado":"Informa quantos foram mantidos"}]'::jsonb,
   'Dados do sistema prevalecem sobre a planilha.',
   'Comportamento novo — ainda não implementado.'),

  (v_mod, 'COLAB-032', 'Reimportação com "substituir" atualiza sem recriar a pessoa',
   'excecao', 'critica', 'aprovado', 'api',
   'Substituir é UPDATE no lugar. Se apagar e recriar, o id muda e todo o histórico da pessoa é órfão.',
   'COLAB-010 executado. O colaborador possui marcações de ponto, férias e entrega de EPI registradas.',
   '[{"ordem":1,"acao":"Anotar o id (usuarios_base.id) do colaborador antes da importação","resultado_esperado":"id registrado para comparação"},
     {"ordem":2,"acao":"Reimportar a planilha com dados alterados escolhendo Substituir","resultado_esperado":"Dados atualizados"},
     {"ordem":3,"acao":"Conferir o id do colaborador","resultado_esperado":"O MESMO id de antes — foi update, não delete + insert"},
     {"ordem":4,"acao":"Conferir ponto, férias e EPI da pessoa","resultado_esperado":"Histórico intacto e ainda vinculado"},
     {"ordem":5,"acao":"Conferir os vínculos","resultado_esperado":"Preservados, não recriados"}]'::jsonb,
   'Substituir troca os dados e preserva identidade, vínculos e histórico.',
   'Caso de maior risco do módulo: apagar-e-recriar destruiria registro de ponto (CLT) e prova de entrega de EPI (NR-06). Comportamento novo — ainda não implementado.'),

  (v_mod, 'COLAB-033', 'CPF com formatação diferente é reconhecido como a mesma pessoa',
   'excecao', 'critica', 'aprovado', 'api',
   'O índice único compara string. "111.222.333-44" e "11122233344" passam os dois — e duplicam.',
   'COLAB-001 executado com CPF gravado sem formatação.',
   '[{"ordem":1,"acao":"Cadastrar pessoa com o mesmo CPF, porém formatado com pontos e traço","resultado_esperado":"Recusado como duplicata — o CPF é normalizado antes de comparar e gravar"},
     {"ordem":2,"acao":"Importar planilha com os CPFs formatados","resultado_esperado":"Reconhecidos como os já existentes; nada duplicado"},
     {"ordem":3,"acao":"Conferir como o CPF foi gravado","resultado_esperado":"Formato único e consistente na base, independente de como foi digitado"}]'::jsonb,
   'A formatação do CPF não cria pessoas diferentes.',
   'HIPÓTESE DE CAUSA-RAIZ do bug de duplicação: se o CPF não é normalizado, o índice único não protege. Confirmar contra a base antes de implementar.'),

  (v_mod, 'COLAB-034', 'Colaborador sem CPF não escapa da detecção de duplicidade',
   'excecao', 'alta', 'aprovado', 'api',
   'O índice único é parcial (WHERE cpf IS NOT NULL). Sem CPF, ele não protege nada.',
   'Tenant de teste.',
   '[{"ordem":1,"acao":"Cadastrar pessoa sem CPF","resultado_esperado":"Aceito — CPF é opcional"},
     {"ordem":2,"acao":"Cadastrar outra com o mesmo nome e o mesmo e-mail, também sem CPF","resultado_esperado":"alerta_duplicidade = true e duplicidade_nivel preenchido"},
     {"ordem":3,"acao":"Importar duas vezes uma planilha sem coluna de CPF","resultado_esperado":"Não duplica — a deduplicação recai sobre e-mail/matrícula"}]'::jsonb,
   'A ausência de CPF não abre buraco na deduplicação.',
   'Descoberto lendo o índice parcial. Comportamento novo — ainda não implementado.'),

  (v_mod, 'COLAB-035', 'Desligamento preserva a pessoa e todo o histórico',
   'excecao', 'critica', 'aprovado', 'api',
   'Desligar encerra o vínculo. Não apaga a pessoa — o histórico tem valor legal por anos.',
   'Colaborador ativo com marcações de ponto, férias e ASO registrados.',
   '[{"ordem":1,"acao":"Desligar o colaborador","resultado_esperado":"Vínculo encerrado com data de desligamento"},
     {"ordem":2,"acao":"Conferir usuarios_base","resultado_esperado":"Pessoa continua existindo — não foi apagada"},
     {"ordem":3,"acao":"Consultar o ponto do período trabalhado","resultado_esperado":"Marcações preservadas e consultáveis"},
     {"ordem":4,"acao":"Listar colaboradores ativos","resultado_esperado":"O desligado não aparece na operação do dia a dia"}]'::jsonb,
   'Vínculo encerra; pessoa e histórico permanecem.',
   'Registro de ponto tem guarda legal (CLT). Exclusão física aqui seria perda de prova.'),

  (v_mod, 'COLAB-036', 'Readmissão reaproveita a pessoa existente',
   'excecao', 'alta', 'aprovado', 'api',
   'Readmitir não pode criar uma segunda pessoa com o mesmo CPF — a constraint impediria, e o histórico se partiria em dois.',
   'COLAB-035 executado (pessoa desligada).',
   '[{"ordem":1,"acao":"Admitir novamente a mesma pessoa (mesmo CPF)","resultado_esperado":"Sistema reconhece o CPF existente e propõe reaproveitar a pessoa, em vez de recusar por duplicidade"},
     {"ordem":2,"acao":"Conferir usuarios_base","resultado_esperado":"Continua 1 registro para o CPF"},
     {"ordem":3,"acao":"Conferir os vínculos","resultado_esperado":"Novo vínculo ativo convivendo com o vínculo anterior encerrado"},
     {"ordem":4,"acao":"Consultar o histórico do período anterior","resultado_esperado":"Acessível e atribuído à mesma pessoa"}]'::jsonb,
   'Uma pessoa, dois vínculos em períodos distintos, histórico contínuo.',
   'Se a readmissão apenas estourar erro de CPF duplicado, o RH fica sem saída — vira bug de usabilidade com efeito legal.')

  ON CONFLICT (codigo) DO NOTHING;

  -- Módulo sai da fila e entra em andamento
  UPDATE public.qa_modulos
  SET    status_doc = 'em_andamento'
  WHERE  id = v_mod;

  RAISE NOTICE 'Casos de Colaboradores semeados. Módulo marcado como em_andamento.';
END $seed$;
