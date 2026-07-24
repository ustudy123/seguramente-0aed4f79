-- =========================================================
-- QA — DETALHAMENTO DOS 5 CASOS QUE FALTAVAM
--
-- MOTIVO: o Alexandre perguntou se os casos de empresa estavam atualizados.
-- Empresa estava (51 casos completos), mas a verificacao encontrou 5 casos
-- rasos em outros modulos. Estes sao os ultimos fora do padrao.
--
--   COLAB-010  Importacao de colaboradores por planilha
--   COLAB-031  Reimportacao com a opcao "manter"
--   ADM-001    Admissao: criar e avancar status
--   ATE-001    Atestado: registrar e recuperar
--   EPI-001    EPI: entrega baixa o estoque
--
-- Os dois primeiros ja tinham passos, mas no formato antigo — sem dados
-- exatos nem caminho na tela — e com objetivo curto demais para explicar a
-- regra. Os tres ultimos vieram do agente de marco, anteriores ao padrao.
--
-- OS TRES FLUXOS TEM UMA HISTORIA: eram testados pelo agente antigo
-- (ai-qa-agent), que escrevia DIRETO nas tabelas de clientes reais, via IA,
-- sem ambiente isolado. Foram reescritos para rodar no cercado, preservando
-- o que verificavam e trocando como verificavam. O detalhamento registra
-- isso, porque explica por que existem.
-- =========================================================

DO $d$
BEGIN

  -- ══════════ IMPORTAÇÃO POR PLANILHA ══════════

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que importar colaboradores por planilha chega ao mesmo resultado do cadastro '
             || 'manual. Regra: a importacao cria as pessoas, os vinculos e preserva a acentuacao dos '
             || 'nomes. Importa porque a importacao e o caminho usado na implantacao de um cliente novo — '
             || 'e quando dezenas ou centenas de pessoas entram de uma vez. Se algo falha ali, falha em '
             || 'escala e no pior momento, que e a estreia do cliente no sistema.',
    pre_condicoes = 'Planilha com 3 colaboradores novos, CPFs validos e distintos, nomes com acentuacao '
                  || '(para testar a codificacao). Empresa de destino ja cadastrada.',
    passos = '[
      {"ordem":1,"acao":"Abrir a importacao de colaboradores","onde_na_tela":"Menu > Colaboradores > botao Importar (ou Importar Planilha)","dados":"-","resultado_esperado":"Tela de importacao aberta, com opcao de escolher o arquivo e a empresa de destino"},
      {"ordem":2,"acao":"Selecionar a planilha e a empresa de destino","onde_na_tela":"Campo de arquivo + seletor de Empresa","dados":"Arquivo: 3 colaboradores | Nomes com acento: Joao Conceicao, Antonio Jose, Maria Ines | Empresa: Alfa","resultado_esperado":"O sistema mostra a previa dos registros a importar"},
      {"ordem":3,"acao":"Confirmar a importacao","onde_na_tela":"Botao Importar/Confirmar","dados":"-","resultado_esperado":"3 registros criados, 0 erros"},
      {"ordem":4,"acao":"Conferir a acentuacao dos nomes gravados","onde_na_tela":"Colaboradores > lista","dados":"-","resultado_esperado":"Acentos corretos (UTF-8): Joao Conceicao aparece com til e cedilha, sem caracteres trocados"},
      {"ordem":5,"acao":"Conferir os vinculos criados","onde_na_tela":"Cada colaborador > aba Vinculos","dados":"-","resultado_esperado":"Os 3 com vinculo ativo na empresa escolhida"}
    ]'::jsonb,
    resultado_esperado = 'Os 3 colaboradores existem, com nomes acentuados corretamente e vinculo ativo '
                       || 'na empresa escolhida. O resultado e indistinguivel de terem sido cadastrados '
                       || 'um a um pela tela.',
    observacoes = 'IMPACTO SE FALHAR: a importacao e o caminho da implantacao. Um erro de codificacao '
                || 'grava "Joao Conceicao" com caracteres trocados em centenas de registros de uma vez, e '
                || 'a correcao depois e manual. Um vinculo que nao se cria deixa as pessoas cadastradas '
                || 'mas invisiveis na empresa. '
                || 'NOTA SOBRE COBERTURA: este caso nao tem rotina automatizada. A importacao acontece no '
                || 'front (leitura do arquivo, previa, confirmacao) e o robo SQL nao alcanca esse fluxo. '
                || 'Fica documentado para execucao manual ou para Cypress. O que o robo cobre e o '
                || 'RESULTADO da importacao — que as pessoas e vinculos criados respeitam as mesmas '
                || 'regras do cadastro manual (casos COLAB-020, 023, 025).'
  WHERE codigo = 'COLAB-010';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que reimportar a mesma planilha com a opcao "manter" nao sobrescreve o que foi '
             || 'alterado no sistema. Regra: quando o colaborador ja existe, a escolha "manter" preserva '
             || 'os dados atuais e ignora os da planilha. Importa porque a planilha envelhece: depois da '
             || 'importacao inicial, o RH ajusta cargos e dados pelo sistema. Reimportar sem essa protecao '
             || 'desfaria todo o trabalho, voltando aos valores antigos do arquivo.',
    pre_condicoes = 'COLAB-010 executado (os 3 colaboradores importados). Depois disso, um deles teve o '
                  || 'cargo alterado pelo sistema — a planilha original ainda traz o cargo antigo.',
    passos = '[
      {"ordem":1,"acao":"Alterar o cargo de um colaborador importado, pelo sistema","onde_na_tela":"Colaboradores > abrir a ficha > campo Cargo","dados":"Cargo antigo (na planilha): Auxiliar | Novo cargo (no sistema): Analista","resultado_esperado":"O colaborador fica com o cargo Analista"},
      {"ordem":2,"acao":"Reimportar a MESMA planilha original","onde_na_tela":"Colaboradores > Importar > mesmo arquivo","dados":"Arquivo: o mesmo da importacao inicial, que traz o cargo Auxiliar","resultado_esperado":"O sistema detecta que os 3 ja existem e pergunta o que fazer"},
      {"ordem":3,"acao":"Escolher a opcao Manter","onde_na_tela":"Dialogo de decisao > opcao Manter dados atuais","dados":"Escolha: Manter","resultado_esperado":"A importacao prossegue sem sobrescrever"},
      {"ordem":4,"acao":"Conferir o cargo do colaborador","onde_na_tela":"Colaboradores > ficha do colaborador alterado","dados":"-","resultado_esperado":"O cargo continua Analista — a planilha NAO sobrescreveu com Auxiliar"},
      {"ordem":5,"acao":"Conferir a contagem e o relatorio","onde_na_tela":"Relatorio da importacao","dados":"-","resultado_esperado":"Nenhum registro criado; o relatorio informa quantos foram mantidos"}
    ]'::jsonb,
    resultado_esperado = 'O cargo alterado no sistema permanece. Nenhum registro novo e criado (nao houve '
                       || 'duplicacao). O relatorio da importacao informa quantos registros foram mantidos.',
    observacoes = 'IMPACTO SE FALHAR: se "manter" nao preservasse, uma reimportacao de rotina desfaria '
                || 'silenciosamente semanas de ajustes feitos pelo RH — cargos, departamentos e dados '
                || 'corrigidos voltariam aos valores da planilha antiga. E o pior tipo de perda: acontece '
                || 'sem erro, sem aviso, e so se descobre quando alguem estranha um dado. '
                || 'NOTA SOBRE COBERTURA: sem rotina automatizada, pelo mesmo motivo do COLAB-010 — a '
                || 'decisao "substituir ou manter" acontece no front. Documentado para execucao manual ou '
                || 'Cypress. Complementar: COLAB-030 (reimportar nao duplica) e COLAB-032 (a opcao '
                || 'substituir).'
  WHERE codigo = 'COLAB-031';

  -- ══════════ OS TRÊS FLUXOS PRESERVADOS ══════════

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar o ciclo basico de admissao: criar o registro e avancar o status ate a '
             || 'conclusao. Regra: a admissao percorre etapas ate o colaborador estar efetivamente '
             || 'admitido. Importa porque e o processo de entrada de pessoas na empresa — e porque este '
             || 'fluxo era testado pelo agente anterior escrevendo direto em dados de clientes reais; '
             || 'aqui ele roda no ambiente cercado, verificando a mesma coisa sem risco.',
    pre_condicoes = 'Empresa cadastrada no ambiente de teste.',
    passos = '[
      {"ordem":1,"acao":"Iniciar uma nova admissao","onde_na_tela":"Menu > RH e DP > Admissao > Nova Admissao","dados":"Nome do candidato e dados basicos","resultado_esperado":"Admissao criada com status inicial"},
      {"ordem":2,"acao":"Avancar o status da admissao","onde_na_tela":"Admissao > acao de avancar etapa","dados":"Status: avancar para a proxima etapa do fluxo","resultado_esperado":"O status muda e a data da transicao e registrada"},
      {"ordem":3,"acao":"Conferir o registro","onde_na_tela":"Lista de admissoes","dados":"-","resultado_esperado":"A admissao aparece com o status atualizado"}
    ]'::jsonb,
    resultado_esperado = 'A admissao e criada e avanca de status corretamente, com o registro persistindo '
                       || 'entre as etapas.',
    observacoes = 'IMPACTO SE FALHAR: a admissao e o processo de entrada de pessoas — se travar, ninguem '
                || 'e contratado pelo sistema. '
                || 'HISTORIA DESTE CASO: era testado pelo agente de QA anterior (ai-qa-agent, marco/2026), '
                || 'que escrevia DIRETO nas tabelas de clientes reais, usando IA para decidir o que '
                || 'verificar. Foi reescrito para rodar no cercado, de forma deterministica. O que se '
                || 'verifica e o mesmo; o como mudou completamente.'
  WHERE codigo = 'ADM-001';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que um atestado medico e registrado e pode ser recuperado. Regra: o atestado '
             || 'guarda o afastamento do colaborador com seus dados. Importa porque atestados alimentam '
             || 'o controle de absenteismo, o eSocial e, em caso de acidente, a emissao de CAT — perder '
             || 'um registro desses tem consequencia legal.',
    pre_condicoes = 'Colaborador cadastrado no ambiente de teste.',
    passos = '[
      {"ordem":1,"acao":"Registrar um atestado para o colaborador","onde_na_tela":"Menu > Saude Ocupacional > Atestados > Novo","dados":"Colaborador, data de inicio, quantidade de dias e CID (se houver)","resultado_esperado":"Atestado registrado"},
      {"ordem":2,"acao":"Recuperar o atestado registrado","onde_na_tela":"Atestados > lista ou busca","dados":"-","resultado_esperado":"O atestado aparece com os dados informados, integros"}
    ]'::jsonb,
    resultado_esperado = 'O atestado e gravado e recuperado com os mesmos dados. Nada se perde entre '
                       || 'gravar e consultar.',
    observacoes = 'IMPACTO SE FALHAR: atestados alimentam absenteismo, eSocial e a emissao de CAT em caso '
                || 'de acidente. Um registro perdido ou corrompido tem consequencia legal e previdenciaria. '
                || 'HISTORIA DESTE CASO: como o ADM-001, vem do agente de marco que testava em dados de '
                || 'clientes reais. Reescrito para o cercado.'
  WHERE codigo = 'ATE-001';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que entregar um EPI a um colaborador decrementa o estoque. Regra: a entrega '
             || 'e uma saida — o saldo disponivel diminui na mesma quantidade entregue. Importa por dois '
             || 'motivos: o estoque precisa refletir a realidade para que ninguem fique sem equipamento, '
             || 'e a ficha de entrega de EPI e prova legal de que a empresa forneceu a protecao exigida '
             || '(NR-06). Estoque errado significa ou falta de EPI no chao de fabrica, ou registro que '
             || 'nao corresponde ao que foi entregue.',
    pre_condicoes = 'Tipo de EPI cadastrado com saldo em estoque, e um colaborador para receber.',
    passos = '[
      {"ordem":1,"acao":"Conferir o saldo atual do EPI em estoque","onde_na_tela":"Menu > Saude Ocupacional > EPI > Estoque","dados":"Anotar o saldo antes da entrega (ex.: 10 unidades)","resultado_esperado":"Saldo inicial visivel"},
      {"ordem":2,"acao":"Registrar a entrega do EPI ao colaborador","onde_na_tela":"EPI > Entregas > Nova Entrega","dados":"Colaborador: um do cadastro | EPI: o mesmo conferido | Quantidade: 2","resultado_esperado":"Entrega registrada com data e responsavel"},
      {"ordem":3,"acao":"Conferir o saldo apos a entrega","onde_na_tela":"EPI > Estoque","dados":"-","resultado_esperado":"Saldo diminuido na quantidade entregue (10 - 2 = 8)"}
    ]'::jsonb,
    resultado_esperado = 'A entrega e registrada e o estoque cai exatamente na quantidade entregue. O '
                       || 'saldo apos a operacao e igual ao saldo anterior menos a quantidade.',
    observacoes = 'IMPACTO SE FALHAR: se o estoque nao baixar, o sistema mostra equipamento que nao '
                || 'existe mais — e alguem que precisa de protecao pode nao encontrar. Se baixar errado, o '
                || 'inventario diverge do fisico. Alem disso, a ficha de entrega e prova legal de '
                || 'fornecimento de EPI (NR-06): em fiscalizacao ou acao trabalhista, ela e o que '
                || 'demonstra que a empresa cumpriu sua obrigacao. '
                || 'HISTORIA DESTE CASO: vem do agente de marco, que testava esse fluxo escrevendo em '
                || 'estoque de clientes reais — ou seja, o teste antigo podia alterar saldos de verdade. '
                || 'Reescrito para o cercado.'
  WHERE codigo = 'EPI-001';

  RAISE NOTICE 'Detalhados: COLAB-010, COLAB-031, ADM-001, ATE-001, EPI-001.';
END $d$;

-- ── Conferência: sobrou algum caso raso? ──
SELECT
  COALESCE(m.label, '(sem modulo)') AS modulo,
  c.codigo,
  CASE WHEN c.objetivo IS NULL THEN 'sem objetivo'
       WHEN length(c.objetivo) < 80 THEN 'objetivo curto'
       WHEN c.passos IS NULL OR jsonb_array_length(c.passos) = 0 THEN 'sem passos'
       WHEN c.observacoes IS NULL THEN 'sem impacto' END AS falta
FROM public.qa_casos_teste c
LEFT JOIN public.qa_modulos m ON m.id = c.modulo_id
WHERE c.objetivo IS NULL OR length(c.objetivo) < 80
   OR c.passos IS NULL OR jsonb_array_length(c.passos) = 0
   OR c.observacoes IS NULL
ORDER BY 1, 2;
