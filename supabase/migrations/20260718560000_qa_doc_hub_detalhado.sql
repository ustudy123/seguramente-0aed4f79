-- =========================================================
-- QA — Módulos DOCUMENTOS e HUB CONTÁBIL DETALHADOS (21 casos)
-- FECHA o detalhamento de TODOS os modulos cobertos pelo piloto.
--
-- Padrao aprovado: objetivo (regra+porque), pre_condicoes, passos com dados
-- exatos+tela, resultado_esperado, observacoes (impacto+correcao).
--
-- DESTAQUES:
--   - A PREMISSA do sistema (levantada pelo Alexandre): todo arquivo enviado
--     ou gerado vai para uma pasta, e o assinado e guardado como nova versao.
--     Documentada em DOC-002, DOC-014 e DOC-030.
--   - Os achados DOC-041 (validade nao recalcula) e DOC-042 (status livre),
--     com o contraste em relacao a terceiro_documentos, que TEM a automacao.
--   - O Hub Contabil: modulo que nunca havia sido validado na pratica.
-- =========================================================

DO $d$
DECLARE v_doc uuid; v_hub uuid;
BEGIN
  SELECT id INTO v_doc FROM public.qa_modulos WHERE path='documentos-governanca/documentos';
  SELECT id INTO v_hub FROM public.qa_modulos WHERE path='documentos-governanca/hub-contabil';
  IF v_doc IS NULL OR v_hub IS NULL THEN RAISE EXCEPTION 'Modulos doc/hub nao encontrados.'; END IF;

  -- ═══════════════ DOCUMENTOS ═══════════════

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar a criacao de uma pasta no modulo de documentos. Regra: pastas organizam os '
             || 'arquivos e precisam de nome. Importa porque a estrutura de pastas e o que torna os '
             || 'documentos localizaveis — sem ela, os arquivos viram uma pilha desorganizada.',
    pre_condicoes = 'Usuario com permissao de gerenciar documentos.',
    passos = '[
      {"ordem":1,"acao":"Abrir o modulo de documentos","onde_na_tela":"Menu > Documentos e Governanca > Documentos","dados":"-","resultado_esperado":"Arvore de pastas exibida"},
      {"ordem":2,"acao":"Criar uma nova pasta","onde_na_tela":"Botao Nova Pasta","dados":"Nome: Documentos Admissionais","resultado_esperado":"Campo nome aceito"},
      {"ordem":3,"acao":"Salvar","onde_na_tela":"Confirmar/Salvar","dados":"-","resultado_esperado":"A pasta aparece na arvore de pastas"}
    ]'::jsonb,
    resultado_esperado = 'A pasta Documentos Admissionais existe e aparece na estrutura de pastas.',
    observacoes = 'IMPACTO SE FALHAR: sem pastas, os documentos ficam sem organizacao — impossivel '
                || 'localizar o arquivo certo quando ele for necessario (auditoria, fiscalizacao).'
  WHERE codigo='DOC-001';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que um documento fica guardado dentro de uma pasta. Regra e PREMISSA DO '
             || 'SISTEMA: todo arquivo enviado ou gerado deve ir para a pasta correspondente no modulo de '
             || 'documentos. Importa porque essa e a garantia de que nada se perde — qualquer upload feito '
             || 'em qualquer tela do sistema tem um lugar definido para ser encontrado depois.',
    pre_condicoes = 'Precisa existir uma pasta para receber o documento.',
    passos = '[
      {"ordem":1,"acao":"Criar (ou abrir) uma pasta","onde_na_tela":"Documentos > Nova Pasta ou selecionar uma existente","dados":"Pasta: Contratos","resultado_esperado":"Pasta disponivel"},
      {"ordem":2,"acao":"Enviar um documento para dentro dessa pasta","onde_na_tela":"Pasta aberta > botao Enviar/Upload de documento","dados":"Arquivo: contrato.pdf | Pasta destino: Contratos","resultado_esperado":"O documento e enviado"},
      {"ordem":3,"acao":"Conferir onde o documento ficou","onde_na_tela":"Abrir a pasta Contratos","dados":"-","resultado_esperado":"O contrato.pdf aparece DENTRO da pasta Contratos"}
    ]'::jsonb,
    resultado_esperado = 'O documento contrato.pdf esta guardado na pasta Contratos — o vinculo '
                       || 'documento-pasta existe e funciona. A premissa do sistema e cumprida no banco.',
    observacoes = 'IMPACTO SE FALHAR: se o documento nao ficasse ligado a uma pasta, arquivos enviados '
                || 'sumiriam na base sem lugar definido — inviabilizaria encontrar documentos em auditoria '
                || 'ou fiscalizacao. NOTA: este caso prova que o BANCO sustenta a premissa. Se cada tela '
                || 'do sistema (admissao, ferias, atestado) realmente chama essa gravacao ao fazer upload '
                || 'e comportamento de aplicacao — verificavel por teste de tela (Cypress), nao por banco.'
  WHERE codigo='DOC-002';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que pastas podem conter outras pastas, formando uma hierarquia. Regra: '
             || 'pasta_pai_id permite aninhar pastas (ex.: 2026 > Janeiro). Importa porque a organizacao '
             || 'documental real e hierarquica — por ano, por mes, por colaborador, por categoria.',
    pre_condicoes = 'Nenhuma alem de acesso ao modulo de documentos.',
    passos = '[
      {"ordem":1,"acao":"Criar uma pasta-mae","onde_na_tela":"Documentos > Nova Pasta","dados":"Nome: 2026","resultado_esperado":"Pasta 2026 criada"},
      {"ordem":2,"acao":"Criar uma subpasta dentro dela","onde_na_tela":"Abrir a pasta 2026 > Nova Pasta (dentro)","dados":"Nome: Janeiro | Pasta-mae: 2026","resultado_esperado":"Janeiro e criada dentro de 2026"},
      {"ordem":3,"acao":"Conferir a hierarquia","onde_na_tela":"Arvore de pastas","dados":"-","resultado_esperado":"Janeiro aparece aninhada sob 2026"}
    ]'::jsonb,
    resultado_esperado = 'A pasta Janeiro esta dentro de 2026, formando a hierarquia. A arvore de pastas '
                       || 'reflete o aninhamento.',
    observacoes = 'IMPACTO SE FALHAR: sem hierarquia, todas as pastas ficariam no mesmo nivel — '
                || 'inviabiliza a organizacao por ano/mes/colaborador que a gestao documental exige.'
  WHERE codigo='DOC-003';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que uma pasta sem nome e recusada. Regra: nome e NOT NULL. Importa porque uma '
             || 'pasta sem nome aparece em branco na arvore e ninguem sabe o que guardar nela.',
    pre_condicoes = 'Nenhuma.',
    passos = '[
      {"ordem":1,"acao":"Iniciar a criacao de uma pasta","onde_na_tela":"Documentos > Nova Pasta","dados":"-","resultado_esperado":"Formulario aberto"},
      {"ordem":2,"acao":"Deixar o nome vazio e tentar salvar","onde_na_tela":"Campo Nome (vazio) + Salvar","dados":"Nome: (vazio)","resultado_esperado":"O sistema DEVE recusar"}
    ]'::jsonb,
    resultado_esperado = 'A pasta sem nome e recusada. Nenhuma pasta em branco entra na arvore.',
    observacoes = 'IMPACTO SE FALHAR: pastas em branco poluem a arvore documental e confundem quem '
                || 'procura onde guardar ou encontrar um arquivo.'
  WHERE codigo='DOC-010';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que um documento sem caminho de arquivo (storage_path) e recusado. Regra: '
             || 'storage_path e NOT NULL — todo registro de documento precisa apontar para um arquivo '
             || 'real no armazenamento. Importa porque um registro sem arquivo e uma promessa vazia: '
             || 'aparece na lista mas nao abre nada quando alguem clica.',
    pre_condicoes = 'Nenhuma.',
    passos = '[
      {"ordem":1,"acao":"Tentar registrar um documento sem o arquivo correspondente","onde_na_tela":"Documentos > Enviar documento (via API ou importacao sem arquivo)","dados":"Nome: x.pdf | Arquivo/storage: (nenhum)","resultado_esperado":"O sistema DEVE recusar — documento precisa apontar para um arquivo"}
    ]'::jsonb,
    resultado_esperado = 'O documento sem storage_path e recusado. Nenhum registro de documento sem arquivo '
                       || 'real entra na base.',
    observacoes = 'IMPACTO SE FALHAR: registros de documento sem arquivo apareceriam nas listas mas nao '
                || 'abririam — o usuario acharia que o documento existe quando na verdade nao ha nada '
                || 'armazenado. Grave em auditoria.'
  WHERE codigo='DOC-011';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que apagar uma pasta-mae apaga as subpastas junto (CASCADE). Regra: '
             || 'pasta_pai_id ON DELETE CASCADE — a hierarquia cai junto. Importa porque uma subpasta sem '
             || 'a pasta-mae ficaria orfa na arvore, sem caminho valido.',
    pre_condicoes = 'Precisa existir uma pasta-mae com pelo menos uma subpasta.',
    passos = '[
      {"ordem":1,"acao":"Criar uma pasta com uma subpasta dentro","onde_na_tela":"Documentos","dados":"Pasta-mae: Arquivo Morto | Subpasta: 2020, dentro dela","resultado_esperado":"Hierarquia montada"},
      {"ordem":2,"acao":"Apagar a pasta-mae","onde_na_tela":"Documentos > Arquivo Morto > Excluir","dados":"-","resultado_esperado":"Pasta-mae apagada"},
      {"ordem":3,"acao":"Conferir a subpasta","onde_na_tela":"Arvore de pastas","dados":"-","resultado_esperado":"A subpasta 2020 foi apagada JUNTO (nao sobra orfa na arvore)"}
    ]'::jsonb,
    resultado_esperado = 'A pasta-mae e apagada e suas subpastas somem junto (CASCADE). Nenhuma subpasta '
                       || 'orfa sobra na arvore.',
    observacoes = 'IMPACTO SE FALHAR: subpastas orfas ficariam na base sem caminho valido na arvore — '
                || 'inacessiveis pela interface mas ocupando espaco. NOTA: isso vale para pastas VAZIAS; '
                || 'pastas COM documentos sao protegidas (veja DOC-014).'
  WHERE codigo='DOC-013';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que o banco NAO deixa apagar uma pasta que ainda tem documento dentro. Regra: '
             || 'o vinculo documento-pasta e NO ACTION — a exclusao da pasta e bloqueada enquanto houver '
             || 'documento nela. Importa porque e a protecao que impede alguem apagar uma pasta e levar '
             || 'junto documentos que podem ter valor legal.',
    pre_condicoes = 'Precisa existir uma pasta com pelo menos um documento guardado dentro.',
    passos = '[
      {"ordem":1,"acao":"Criar uma pasta e guardar um documento nela","onde_na_tela":"Documentos","dados":"Pasta: Documentos Importantes | Documento: importante.pdf dentro dela","resultado_esperado":"Documento esta na pasta"},
      {"ordem":2,"acao":"Tentar apagar a pasta que ainda tem o documento","onde_na_tela":"Documentos > Documentos Importantes > Excluir","dados":"-","resultado_esperado":"O sistema DEVE recusar a exclusao — ha documento dentro"},
      {"ordem":3,"acao":"Conferir que o documento continua la","onde_na_tela":"Abrir a pasta","dados":"-","resultado_esperado":"A pasta e o documento continuam intactos"}
    ]'::jsonb,
    resultado_esperado = 'A exclusao da pasta e RECUSADA enquanto houver documento dentro. O documento '
                       || 'esta protegido — nao ha como perde-lo por apagar a pasta sem querer.',
    observacoes = 'IMPACTO SE FALHAR: se a pasta pudesse ser apagada com documentos dentro, um clique '
                || 'errado destruiria (ou orfanaria) arquivos com valor legal — contratos, ASOs, '
                || 'comprovantes. Esta protecao e uma das mais valiosas do modulo e sustenta a premissa de '
                || 'que o sistema guarda os documentos com seguranca.'
  WHERE codigo='DOC-014';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que um documento de um cliente e invisivel para outro. Regra: isolamento '
             || 'multi-tenant. Importa porque documentos contem dados pessoais e sensiveis (contratos, '
             || 'exames, comprovantes) — vazamento aqui seria um incidente grave de LGPD.',
    pre_condicoes = 'Dois clientes distintos no sistema.',
    passos = '[
      {"ordem":1,"acao":"No cliente A, guardar um documento","onde_na_tela":"Cliente A > Documentos > Enviar","dados":"Arquivo: secreto_t1.pdf","resultado_esperado":"Documento guardado no cliente A"},
      {"ordem":2,"acao":"Entrar como cliente B e procurar o documento","onde_na_tela":"Cliente B > Documentos > busca","dados":"Buscar pelo nome do documento do cliente A","resultado_esperado":"NAO aparece para o cliente B"}
    ]'::jsonb,
    resultado_esperado = 'O documento do cliente A e invisivel no cliente B. Zero vazamento.',
    observacoes = 'IMPACTO SE FALHAR: seria vazamento de documentos com dados pessoais e sensiveis entre '
                || 'clientes — incidente grave de LGPD, com risco legal e de reputacao. Protecao RLS por '
                || 'tenant, verificada a cada bateria.'
  WHERE codigo='DOC-022';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que revisar um documento cria uma NOVA VERSAO, preservando a anterior. Regra e '
             || 'PREMISSA DO SISTEMA: quando um documento e assinado, a versao assinada e guardada como '
             || 'nova versao — sem sobrescrever o original. Importa porque em SST o historico de versoes '
             || 'tem valor legal: e preciso poder provar qual documento foi assinado e quando.',
    pre_condicoes = 'Precisa existir um documento ja guardado (a versao 1).',
    passos = '[
      {"ordem":1,"acao":"Guardar um documento (versao 1)","onde_na_tela":"Documentos > Enviar","dados":"Arquivo: termo.pdf (versao 1, sem assinatura)","resultado_esperado":"Documento guardado como versao 1"},
      {"ordem":2,"acao":"O documento e assinado e volta ao sistema","onde_na_tela":"Documento > Nova versao / Substituir com nova versao","dados":"Arquivo: termo_assinado.pdf | Motivo: Versao assinada","resultado_esperado":"E criada a versao 2"},
      {"ordem":3,"acao":"Conferir o historico de versoes","onde_na_tela":"Documento > aba Versoes / Historico","dados":"-","resultado_esperado":"Existem 2 versoes: a v1 (original) PRESERVADA e a v2 (assinada)"}
    ]'::jsonb,
    resultado_esperado = 'O documento tem 2 versoes: a original (v1) continua acessivel e a assinada (v2) '
                       || 'foi adicionada. A assinatura nao apagou o original. A premissa e cumprida.',
    observacoes = 'IMPACTO SE FALHAR: se a versao assinada sobrescrevesse a original, perder-se-ia a '
                || 'rastreabilidade — em uma auditoria ou processo, nao daria para demonstrar o que foi '
                || 'assinado nem comparar com a versao anterior. O versionamento e o que da valor legal '
                || 'ao acervo documental.'
  WHERE codigo='DOC-030';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que a data de validade de um documento e guardada. Regra: documentos de SST '
             || '(ASO, certificados, licencas) tem prazo de validade e o sistema precisa registra-lo. '
             || 'Importa porque a validade e o que permite saber se um documento ainda vale — base de '
             || 'qualquer controle de vencimento.',
    pre_condicoes = 'Acesso ao envio de documentos com o campo de validade.',
    passos = '[
      {"ordem":1,"acao":"Enviar um documento informando a validade","onde_na_tela":"Documentos > Enviar > campo Data de Validade","dados":"Arquivo: aso.pdf | Data de validade: 31/12/2026","resultado_esperado":"O campo aceita a data"},
      {"ordem":2,"acao":"Reabrir o documento e conferir","onde_na_tela":"Abrir o documento > propriedades","dados":"-","resultado_esperado":"A data de validade 31/12/2026 esta gravada"}
    ]'::jsonb,
    resultado_esperado = 'O documento e guardado com a data de validade 31/12/2026, que persiste ao reabrir.',
    observacoes = 'IMPACTO SE FALHAR: sem guardar a validade, nao ha como controlar vencimento de ASOs, '
                || 'certificados e licencas — perde-se a base de qualquer alerta ou relatorio de '
                || 'documentos vencendo.'
  WHERE codigo='DOC-040';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar o que acontece com um documento cuja validade JA passou: o status muda sozinho '
             || 'para vencido? Regra esperada: um documento vencido deveria refletir isso no status. Este '
             || 'caso revela se ha automacao de validade no modulo geral de documentos. Importa porque, '
             || 'se ninguem marcar, um documento vencido continua parecendo valido nas telas e '
             || 'relatorios — risco real em fiscalizacao.',
    pre_condicoes = 'Acesso ao envio de documentos com data de validade.',
    passos = '[
      {"ordem":1,"acao":"Guardar um documento com validade JA vencida","onde_na_tela":"Documentos > Enviar > Data de Validade","dados":"Arquivo: vencido.pdf | Data de validade: uma data do ano passado (ja vencida)","resultado_esperado":"O documento e aceito"},
      {"ordem":2,"acao":"Conferir o status do documento","onde_na_tela":"Abrir o documento > campo Status","dados":"-","resultado_esperado":"Idealmente o status DEVERIA indicar vencido"}
    ]'::jsonb,
    resultado_esperado = 'O status deveria refletir que o documento esta vencido. ACHADO ATUAL: o status '
                       || 'continua "valido" — nao ha trigger nem rotina que recalcule a validade no modulo '
                       || 'geral de documentos. A validade fica sendo apenas um dado guardado.',
    observacoes = 'IMPACTO SE FALHAR (e falha hoje): documentos vencidos continuam aparecendo como validos '
                || 'no banco. Se alguma tela, relatorio ou integracao confiar no campo status, vai tratar '
                || 'um ASO vencido como valido — risco direto em fiscalizacao. CORRECAO SUGERIDA: aplicar '
                || 'em documentos a mesma automacao que JA EXISTE em terceiro_documentos (enum fechado + '
                || 'trigger que calcula valido/a_vencer/vencido pela data), ou criar uma rotina diaria que '
                || 'atualize os vencidos. NOTA: a boa pratica ja esta implementada em outro modulo do '
                || 'sistema — falta replicar aqui. Alem disso, nao existe hoje rotina agendada que AVISE '
                || 'sobre documentos vencendo; se ha aviso, e calculado na tela ao abrir.'
  WHERE codigo='DOC-041';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar se o campo status de um documento aceita qualquer texto ou tem uma lista '
             || 'fechada de valores. Regra esperada: status deveria ser uma lista controlada (valido, '
             || 'vencido, pendente...). Importa porque um status livre permite valores sem sentido '
             || 'entrarem por importacao ou API, quebrando filtros e relatorios que dependem dele.',
    pre_condicoes = 'Acesso ao registro de documentos (via importacao ou API, onde o status pode ser '
                  || 'informado diretamente).',
    passos = '[
      {"ordem":1,"acao":"Tentar registrar um documento com um status sem sentido","onde_na_tela":"Documentos > registro via importacao/API com o campo status","dados":"Arquivo: x.pdf | Status: abacaxi (valor sem sentido, so para testar)","resultado_esperado":"Idealmente o sistema DEVERIA recusar um status fora da lista"}
    ]'::jsonb,
    resultado_esperado = 'O status invalido deveria ser RECUSADO. ACHADO ATUAL: o banco ACEITA qualquer '
                       || 'texto — o campo status e TEXT livre, sem enum nem CHECK.',
    observacoes = 'IMPACTO SE FALHAR (e falha hoje): um status invalido entra pela importacao ou API e '
                || 'quebra filtros e relatorios que agrupam por status — o documento some das listas '
                || 'filtradas ou aparece numa categoria inexistente. CORRECAO SUGERIDA: transformar '
                || 'status em enum (ou adicionar CHECK com a lista de valores validos), como ja e feito '
                || 'em terceiro_documentos e em varias outras tabelas do sistema.'
  WHERE codigo='DOC-042';

  -- ═══════════════ HUB CONTÁBIL ═══════════════

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar o cadastro de uma contabilidade parceira. Regra: a contabilidade que atende o '
             || 'cliente e cadastrada com nome, CNPJ e e-mail. Importa porque o Hub Contabil e a ponte '
             || 'entre a empresa e sua contabilidade — sem cadastrar o parceiro, nao ha com quem trocar '
             || 'as competencias mensais.',
    pre_condicoes = 'Usuario com permissao de administrar o Hub Contabil.',
    passos = '[
      {"ordem":1,"acao":"Abrir o cadastro de contabilidade","onde_na_tela":"Menu > Documentos e Governanca > Hub Contabil > Contabilidades > Nova","dados":"-","resultado_esperado":"Formulario aberto"},
      {"ordem":2,"acao":"Preencher os dados da contabilidade","onde_na_tela":"Campos Nome, CNPJ e E-mail principal","dados":"Nome: Contabil Exemplo | CNPJ: 11.222.333/0001-81 | E-mail: contato@contabil.exemplo","resultado_esperado":"Campos aceitos"},
      {"ordem":3,"acao":"Salvar","onde_na_tela":"Salvar","dados":"-","resultado_esperado":"Contabilidade cadastrada e ativa"}
    ]'::jsonb,
    resultado_esperado = 'A contabilidade Contabil Exemplo esta cadastrada e disponivel para receber as '
                       || 'competencias.',
    observacoes = 'IMPACTO SE FALHAR: sem cadastrar a contabilidade, o Hub nao tem destinatario — nao ha '
                || 'como enviar competencias nem organizar a troca de documentos com o escritorio contabil.'
  WHERE codigo='HUB-001';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar a abertura de uma competencia mensal. Regra: a competencia (ex.: 2026-02) e o '
             || 'pacote mensal que sera preparado, enviado e aprovado; nasce no status em_preparacao. '
             || 'Importa porque a competencia e a unidade de trabalho do Hub — todo o fluxo contabil gira '
             || 'em torno dela.',
    pre_condicoes = 'Acesso ao Hub Contabil.',
    passos = '[
      {"ordem":1,"acao":"Abrir o Hub e criar uma competencia","onde_na_tela":"Hub Contabil > Competencias > Nova Competencia","dados":"Competencia: 2026-02","resultado_esperado":"Formulario aceita a competencia"},
      {"ordem":2,"acao":"Salvar e conferir o status inicial","onde_na_tela":"Salvar > ver a competencia criada","dados":"-","resultado_esperado":"A competencia 2026-02 e criada com status em_preparacao"}
    ]'::jsonb,
    resultado_esperado = 'A competencia 2026-02 existe, com status inicial em_preparacao, pronta para '
                       || 'receber guias e documentos.',
    observacoes = 'IMPACTO SE FALHAR: sem abrir competencias, o fluxo contabil mensal nao comeca — nao ha '
                || 'onde reunir guias e documentos do mes para enviar a contabilidade.'
  WHERE codigo='HUB-002';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que guias de impostos podem ser vinculadas a uma competencia. Regra: cada guia '
             || 'tem um tipo (INSS, FGTS, IRRF, DARF...), um valor e uma data de vencimento, e pertence a '
             || 'uma competencia. Importa porque as guias sao a parte mais critica do fluxo — sao os '
             || 'impostos que precisam ser pagos no prazo, sob pena de multa.',
    pre_condicoes = 'Precisa existir uma competencia aberta.',
    passos = '[
      {"ordem":1,"acao":"Abrir uma competencia e ir as guias","onde_na_tela":"Hub Contabil > abrir a competencia > aba Guias > Adicionar","dados":"-","resultado_esperado":"Formulario de guia aberto"},
      {"ordem":2,"acao":"Adicionar duas guias de tipos diferentes","onde_na_tela":"Campos Tipo, Valor e Data de vencimento","dados":"Guia 1: INSS, R$ 1.500,00, vence em 20 dias | Guia 2: FGTS, R$ 800,00, vence em 7 dias","resultado_esperado":"As duas guias sao aceitas"},
      {"ordem":3,"acao":"Conferir as guias da competencia","onde_na_tela":"aba Guias","dados":"-","resultado_esperado":"As 2 guias aparecem vinculadas a competencia, com status pendente"}
    ]'::jsonb,
    resultado_esperado = 'A competencia tem 2 guias (INSS e FGTS) vinculadas, cada uma com valor e '
                       || 'vencimento, prontas para acompanhamento de pagamento.',
    observacoes = 'IMPACTO SE FALHAR: sem vincular guias a competencia, os impostos do mes ficam sem '
                || 'controle centralizado — risco de vencimento em aberto e multa.'
  WHERE codigo='HUB-003';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que a competencia avanca pelo fluxo de status (em_preparacao para enviado, e '
             || 'depois para aprovado). Regra: o status controla em que etapa do processo mensal a '
             || 'competencia esta. Importa porque e esse fluxo que da visibilidade — saber se o mes ja '
             || 'foi enviado a contabilidade, se ja voltou aprovado ou se ainda esta sendo preparado.',
    pre_condicoes = 'Precisa existir uma competencia em preparacao.',
    passos = '[
      {"ordem":1,"acao":"Abrir uma competencia em preparacao","onde_na_tela":"Hub Contabil > abrir a competencia","dados":"-","resultado_esperado":"Competencia com status em_preparacao"},
      {"ordem":2,"acao":"Enviar a competencia a contabilidade","onde_na_tela":"Botao Enviar (ou mudar status para enviado)","dados":"Status: enviado | Data de envio: hoje","resultado_esperado":"Status muda para enviado, com a data registrada"},
      {"ordem":3,"acao":"Registrar a aprovacao da contabilidade","onde_na_tela":"Botao Aprovar (ou mudar status para aprovado)","dados":"Status: aprovado | Data de aprovacao: hoje","resultado_esperado":"Status muda para aprovado"}
    ]'::jsonb,
    resultado_esperado = 'A competencia percorre o fluxo: em_preparacao para enviado para aprovado, com as '
                       || 'datas de cada etapa registradas.',
    observacoes = 'IMPACTO SE FALHAR: sem o fluxo de status funcionando, perde-se a visibilidade de em que '
                || 'etapa cada mes esta — ninguem sabe se a competencia foi enviada, se voltou aprovada, '
                || 'ou se travou no meio.'
  WHERE codigo='HUB-004';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que uma contabilidade sem nome e recusada. Regra: nome e NOT NULL. Importa '
             || 'porque uma contabilidade sem nome nao pode ser identificada na hora de escolher para '
             || 'quem enviar as competencias.',
    pre_condicoes = 'Nenhuma.',
    passos = '[
      {"ordem":1,"acao":"Iniciar o cadastro de uma contabilidade","onde_na_tela":"Hub Contabil > Contabilidades > Nova","dados":"-","resultado_esperado":"Formulario aberto"},
      {"ordem":2,"acao":"Deixar o nome vazio e tentar salvar","onde_na_tela":"Campo Nome (vazio) + Salvar","dados":"Nome: (vazio) | CNPJ: 11.222.333/0001-81","resultado_esperado":"O sistema DEVE recusar"}
    ]'::jsonb,
    resultado_esperado = 'A contabilidade sem nome e recusada.',
    observacoes = 'IMPACTO SE FALHAR: contabilidade em branco na lista de parceiros — impossivel saber '
                || 'para quem se esta enviando os documentos do mes.'
  WHERE codigo='HUB-010';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que um status de competencia fora da lista e recusado. Regra: status so aceita '
             || 'os 7 valores do fluxo (em_preparacao, enviado, em_processamento, em_conferencia, '
             || 'aprovado, finalizado, reaberto). Importa porque um status invalido tiraria a competencia '
             || 'do fluxo — ela ficaria num limbo que nenhuma tela sabe tratar.',
    pre_condicoes = 'Acesso ao Hub Contabil.',
    passos = '[
      {"ordem":1,"acao":"Tentar criar (ou atualizar) uma competencia com status fora da lista","onde_na_tela":"Hub Contabil > competencia > campo Status","dados":"Status: arquivado (invalido — nao esta entre os 7 do fluxo)","resultado_esperado":"O sistema DEVE recusar"}
    ]'::jsonb,
    resultado_esperado = 'O status arquivado e recusado. So os 7 status do fluxo sao aceitos.',
    observacoes = 'IMPACTO SE FALHAR: uma competencia com status invalido sairia do fluxo controlado — '
                || 'nao apareceria nos filtros corretos e ninguem saberia em que etapa ela esta.'
  WHERE codigo='HUB-011';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que um tipo de guia fora da lista e recusado. Regra: tipo so aceita os tributos '
             || 'previstos (INSS, FGTS, IRRF, DARF, GRRF, PIS, COFINS, CSLL, ISS, contribuicao sindical, '
             || 'outro). Importa porque o tipo classifica o tributo — um valor livre quebraria relatorios '
             || 'fiscais e o acompanhamento por imposto.',
    pre_condicoes = 'Precisa existir uma competencia para vincular a guia.',
    passos = '[
      {"ordem":1,"acao":"Abrir uma competencia e tentar adicionar uma guia com tipo invalido","onde_na_tela":"Hub Contabil > competencia > aba Guias > Adicionar > campo Tipo","dados":"Tipo: imposto_x (invalido — nao esta na lista de tributos) | Valor: 100 | Vencimento: em 10 dias","resultado_esperado":"O sistema DEVE recusar o tipo fora da lista"}
    ]'::jsonb,
    resultado_esperado = 'A guia com tipo imposto_x e recusada. So os tipos de tributo previstos sao '
                       || 'aceitos.',
    observacoes = 'IMPACTO SE FALHAR: tipo de guia invalido quebraria relatorios fiscais e o '
                || 'acompanhamento por tributo — a guia nao apareceria nos totais do imposto correto.'
  WHERE codigo='HUB-012';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que nao da para abrir a mesma competencia duas vezes no mesmo cliente. Regra: '
             || 'UNIQUE(tenant_id, competencia) — uma competencia 2026-02 por cliente. Importa porque '
             || 'duas competencias do mesmo mes dividiriam guias e documentos entre elas, e ninguem '
             || 'saberia qual e a oficial para enviar a contabilidade.',
    pre_condicoes = 'Precisa existir uma competencia ja aberta (ex.: 2026-06).',
    passos = '[
      {"ordem":1,"acao":"Abrir uma competencia","onde_na_tela":"Hub Contabil > Nova Competencia","dados":"Competencia: 2026-06","resultado_esperado":"Competencia criada"},
      {"ordem":2,"acao":"Tentar abrir a MESMA competencia de novo","onde_na_tela":"Hub Contabil > Nova Competencia","dados":"Competencia: 2026-06 (a mesma)","resultado_esperado":"O sistema DEVE recusar — ja existe"}
    ]'::jsonb,
    resultado_esperado = 'A segunda 2026-06 e recusada. So existe uma competencia por mes em cada cliente.',
    observacoes = 'IMPACTO SE FALHAR: duas competencias do mesmo mes dividiriam as guias e documentos — '
                || 'parte em uma, parte na outra. O envio a contabilidade sairia incompleto, com risco de '
                || 'imposto nao pago.'
  WHERE codigo='HUB-020';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que os dados do Hub de um cliente sao invisiveis para outro. Regra: isolamento '
             || 'multi-tenant. Importa porque o Hub contem informacao fiscal e financeira (valores de '
             || 'impostos, guias, competencias) — das mais sensiveis do sistema.',
    pre_condicoes = 'Dois clientes distintos no sistema.',
    passos = '[
      {"ordem":1,"acao":"No cliente A, abrir uma competencia","onde_na_tela":"Cliente A > Hub Contabil > Nova Competencia","dados":"Competencia: uma competencia identificavel do cliente A","resultado_esperado":"Criada no cliente A"},
      {"ordem":2,"acao":"Entrar como cliente B e procurar","onde_na_tela":"Cliente B > Hub Contabil > Competencias","dados":"Procurar pela competencia do cliente A","resultado_esperado":"NAO aparece para o cliente B"}
    ]'::jsonb,
    resultado_esperado = 'A competencia do cliente A e invisivel no cliente B. Zero vazamento de dados '
                       || 'fiscais entre clientes.',
    observacoes = 'IMPACTO SE FALHAR: exporia informacao fiscal e financeira (valores de impostos, guias) '
                || 'de um cliente a outro — das mais sensiveis do sistema, com implicacoes legais serias. '
                || 'Protecao RLS por tenant.'
  WHERE codigo='HUB-022';

  RAISE NOTICE 'Modulos DOCUMENTOS (12) e HUB CONTABIL (9) detalhados. DETALHAMENTO COMPLETO: todos os modulos do piloto.';
END $d$;

SELECT codigo, left(objetivo,42) AS objetivo, jsonb_array_length(passos) AS passos,
       (observacoes IS NOT NULL) AS impacto
FROM public.qa_casos_teste
WHERE codigo LIKE 'DOC-%' OR codigo LIKE 'HUB-%'
ORDER BY codigo;
