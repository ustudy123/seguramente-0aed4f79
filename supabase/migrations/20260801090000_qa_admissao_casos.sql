-- =========================================================
-- QA — Admissao de colaborador (31/07/2026)
--
-- Mesmo principio do modulo de Desligamento: o caso documenta O QUE A LEI E
-- A PREMISSA DO PRODUTO EXIGEM. Onde o sistema divergir, falha, e a falha e
-- o encaminhamento para o desenvolvimento.
--
-- PREMISSA DE PRODUTO TESTADA AQUI, declarada pelo dono do produto:
--   "Todo documento que sofra upload, ou que seja gerado ou assinado pelo
--    sistema, deve ser arquivado em sua ultima versao (assinada, se for o
--    caso) no modulo Documentos, na respectiva pasta. Sendo referente a
--    colaborador, na pasta especifica daquele colaborador."
--   Objetivo declarado: eliminar o retrabalho do RH de manter e guardar
--   documento em varios lugares.
-- Essa premissa nao tem base legal — e regra de produto, e esta declarada
-- como tal nos casos. O que TEM base legal e a guarda em si e o prazo dela.
--
-- ACHADOS DE CODIGO QUE ORIGINARAM O BLOCO A (lidos em useAdmissoes.ts):
--   1) A sincronizacao com o modulo Documentos EXISTE. O upload grava em
--      admissao_documentos e tambem insere em public.documentos.
--   2) Mas o insert traz "colaborador_id: null" com o comentario
--      "Colaborador ainda nao tem profile", E NAO INFORMA pasta_id — que
--      existe como FK para documento_pastas. O documento chega ao modulo
--      sem pasta e sem dono.
--   3) ColaboradorFolderView agrupa por (doc.colaborador_id || "sem-colaborador").
--      Todo documento vindo de admissao cai no balde "sem-colaborador".
--   4) Nao ha reconciliacao depois. Quando a admissao conclui e o profile e
--      criado, nada volta para preencher colaborador_id nem pasta_id.
--   5) No reenvio, o storage usa upsert:true (arquivo substituido), mas o
--      insert em documentos e protegido por "if (!existingDoc)" — ou seja,
--      o arquivo muda e o registro do modulo Documentos NAO e atualizado.
--      Fica com nome original, tamanho e mime do arquivo antigo.
--   6) A tabela documento_versoes existe e nao e usada por este fluxo.
--
--   Resultado pratico: a premissa e cumprida pela metade. O documento chega
--   ao modulo, o que evita o pior — mas nao chega a pasta do colaborador,
--   que era exatamente o ponto de eliminar retrabalho do RH. Hoje alguem
--   ainda precisa arquivar a mao.
--
--   7) O evento S-2200 NAO EXISTE em nenhum arquivo do repositorio. A
--      admissao nao gera evento de eSocial nenhum — situacao pior que a do
--      desligamento, que ao menos monta o S-2299 em memoria.
--
--   8) "Exame Admissional" e apenas um item da lista de 9 documentos
--      obrigatorios, tratado como anexo generico. Diferente do desligamento,
--      que tem campos estruturados para data, resultado, medico e CRM, a
--      admissao nao estrutura nada do ASO.
--
-- CORRECAO DE FUNDAMENTACAO ENTREGUE ANTES: no DESL-066 citei "NR-07, itens
-- 7.5.19 e 7.5.20" com marca de conferir. O item correto do conteudo do ASO
-- e 7.5.19.1 (Portaria SEPRT 6.734/2020), que exige razao social e CNPJ ou
-- CAEPF da organizacao e o CPF do trabalhador. Corrigido no final deste
-- arquivo.
-- =========================================================

INSERT INTO public.qa_modulos (parent_id, label, path, prioridade_doc, status_doc)
SELECT m.id, 'Admissao', 'estrutura-organizacional/colaboradores/admissao', 1, 'em_andamento'
FROM public.qa_modulos m WHERE m.path = 'estrutura-organizacional/colaboradores'
ON CONFLICT (path) DO NOTHING;

DO $doc$
DECLARE v_mod uuid; v_antes int; v_depois int;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos
  WHERE path = 'estrutura-organizacional/colaboradores/admissao';
  IF v_mod IS NULL THEN RAISE EXCEPTION 'Modulo de admissao nao criado.'; END IF;
  SELECT count(*) INTO v_antes FROM public.qa_casos_teste WHERE modulo_id = v_mod;

  INSERT INTO public.qa_casos_teste
    (modulo_id, codigo, titulo, tipo, prioridade, status, nivel,
     base_legal, objetivo, pre_condicoes, passos, resultado_esperado, observacoes)
  VALUES

  -- ═══════════════════════════════════════════════════════
  -- A) ARQUIVAMENTO UNICO — a premissa do produto
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'ADM-100', 'Documento enviado na admissao chega ao modulo Documentos',
   'feliz', 'critica', 'aprovado', 'api',
   'Premissa de produto (sem base legal): arquivamento unico no modulo Documentos. '
   'A guarda em si tem fundamento — CLT, art. 41 (registro de empregados) e '
   'CLT, art. 630, §4o (exibicao a fiscalizacao).',
   'Primeiro degrau da premissa: o arquivo nao pode ficar so na admissao.',
   'Admissao aberta com a lista de documentos obrigatorios gerada.',
   '[{"ordem":1,"acao":"Enviar o RG na aba Admissoes","resultado_esperado":"Registro criado em admissao_documentos com status enviado"},
     {"ordem":2,"acao":"Consultar public.documentos pelo storage_path","resultado_esperado":"Existe registro correspondente no modulo Documentos"},
     {"ordem":3,"acao":"Conferir nome_original, tamanho e mime_type","resultado_esperado":"Coerentes com o arquivo enviado"}]'::jsonb,
   'O documento existe nos dois lugares, com metadados coerentes.',
   'IMPLEMENTADO. A sincronizacao existe em useAdmissoes.ts. Este caso protege o que ja funciona: uma refatoracao que remova o bloco de sincronizacao quebraria a premissa inteira em silencio.'),

  (v_mod, 'ADM-101', 'Documento da admissao e arquivado na PASTA do colaborador',
   'excecao', 'critica', 'aprovado', 'api',
   'Premissa de produto: documento referente a colaborador vai para a pasta '
   'especifica daquele colaborador. Sem base legal — e regra de organizacao '
   'interna, cujo proposito declarado e eliminar retrabalho do RH.',
   'Coracao da premissa. Chegar ao modulo sem chegar a pasta nao resolve o '
   'problema que a premissa se propos a resolver.',
   'Documento enviado na aba Admissoes.',
   '[{"ordem":1,"acao":"Consultar o registro em public.documentos","resultado_esperado":"pasta_id preenchido"},
     {"ordem":2,"acao":"Conferir a qual pasta aponta","resultado_esperado":"Pasta do tipo colaborador correspondente aquela pessoa"},
     {"ordem":3,"acao":"Abrir o modulo Documentos na visao por colaborador","resultado_esperado":"O documento aparece sob o nome do colaborador, nao em avulsos"}]'::jsonb,
   'O documento nasce arquivado no lugar certo, sem intervencao do RH.',
   'DIVERGENCIA CONFIRMADA: o insert em documentos NAO informa pasta_id, embora a coluna exista como FK para documento_pastas. O documento chega ao modulo sem pasta. Deve falhar.'),

  (v_mod, 'ADM-102', 'Documento da admissao e vinculado ao colaborador',
   'excecao', 'critica', 'aprovado', 'api',
   'Premissa de produto: identificacao do documento com o titular. Apoia a '
   'guarda exigida pela CLT, art. 41, paragrafo unico, e o direito de acesso '
   'do titular previsto na LGPD, Lei 13.709/2018, art. 18, II.',
   'Sem vinculo estruturado, localizar os documentos de uma pessoa depende de '
   'busca por texto — e o RH volta a manter controle proprio.',
   'Documento enviado na aba Admissoes.',
   '[{"ordem":1,"acao":"Consultar colaborador_id no registro de documentos","resultado_esperado":"Preenchido"},
     {"ordem":2,"acao":"Agrupar documentos por colaborador na tela","resultado_esperado":"O documento aparece sob a pessoa certa"},
     {"ordem":3,"acao":"Contar documentos sem colaborador_id no tenant","resultado_esperado":"Zero"}]'::jsonb,
   'Todo documento de pessoa tem dono identificado por chave, nao por texto.',
   'DIVERGENCIA CONFIRMADA E DELIBERADA: o codigo grava colaborador_id: null com o comentario "Colaborador ainda nao tem profile". A justificativa e real — na admissao a pessoa ainda nao virou profile. Mas a consequencia e que ColaboradorFolderView agrupa por (colaborador_id || "sem-colaborador") e TODO documento de admissao cai no balde "sem-colaborador". O problema nao e o null no momento do upload; e nao existir o passo seguinte — ver ADM-103.'),

  (v_mod, 'ADM-103', 'Concluida a admissao, os documentos sao reconciliados com o colaborador',
   'excecao', 'critica', 'aprovado', 'api',
   'Premissa de produto: arquivamento unico e definitivo. Apoia CLT, art. 41 '
   '(manutencao do registro) e LGPD, art. 6o, I (finalidade).',
   'O null do ADM-102 so e aceitavel se houver um momento em que ele deixa de '
   'ser null. Esse momento e a conclusao da admissao, quando o profile nasce.',
   'Admissao com documentos enviados, avancada ate a conclusao.',
   '[{"ordem":1,"acao":"Concluir a admissao e criar o colaborador","resultado_esperado":"Profile criado"},
     {"ordem":2,"acao":"Reconsultar os documentos daquela admissao","resultado_esperado":"colaborador_id preenchido com o novo profile"},
     {"ordem":3,"acao":"Conferir pasta_id","resultado_esperado":"Apontando para a pasta do colaborador, criada se ainda nao existia"},
     {"ordem":4,"acao":"Abrir a pasta do colaborador no modulo Documentos","resultado_esperado":"Os 9 documentos da admissao estao la"}]'::jsonb,
   'A conclusao da admissao fecha o ciclo e arquiva tudo no lugar definitivo.',
   'GAP TOTAL: nao existe nenhuma reconciliacao. Nada, em momento algum, volta para preencher colaborador_id ou pasta_id dos documentos ja enviados. E o passo que faltou para a premissa se cumprir — e sem ele, o RH continua tendo que arquivar a mao, que e exatamente o retrabalho que a premissa queria eliminar. Correcao sugerida: rotina disparada na conclusao da admissao, mais uma funcao de reconciliacao retroativa para o passivo ja acumulado, no espirito da reconciliar_pastas_todas_empresas() que ja existe no produto.'),

  (v_mod, 'ADM-104', 'Reenvio de documento atualiza o registro no modulo Documentos',
   'excecao', 'alta', 'aprovado', 'api',
   'Premissa de produto: arquivar a ULTIMA versao. Documento desatualizado '
   'apresentado a fiscalizacao equivale a documento ausente — CLT, art. 630, §4o.',
   'A premissa fala em ultima versao. Se o arquivo muda e o registro nao, o '
   'modulo Documentos passa a descrever um arquivo que nao existe mais.',
   'Documento ja enviado uma vez.',
   '[{"ordem":1,"acao":"Reenviar o mesmo documento com arquivo diferente (outro nome, outro tamanho)","resultado_esperado":"Arquivo substituido no storage"},
     {"ordem":2,"acao":"Consultar o registro em documentos","resultado_esperado":"nome_original, tamanho e mime_type ATUALIZADOS"},
     {"ordem":3,"acao":"Conferir a data de atualizacao","resultado_esperado":"Refletindo o reenvio"}]'::jsonb,
   'O registro descreve sempre o arquivo que esta la.',
   'DIVERGENCIA CONFIRMADA: o storage usa upsert:true e substitui o arquivo, mas o insert em documentos e protegido por "if (!existingDoc)" — encontrando registro com o mesmo storage_path, ele nao insere NEM atualiza. O resultado e um registro que descreve o arquivo antigo apontando para um arquivo novo. Metadado e arquivo divergem, e nada avisa.'),

  (v_mod, 'ADM-105', 'Substituicao de documento preserva a versao anterior',
   'alternativo', 'alta', 'aprovado', 'api',
   'Premissa de produto: guardar a ultima versao NAO implica destruir as '
   'anteriores. Apoia CLT, art. 41 e o dever de comprovacao historica; a '
   'tabela documento_versoes existe justamente para isso.',
   'Reenvio destrutivo impede reconstituir o que foi apresentado e quando.',
   'Documento ja enviado.',
   '[{"ordem":1,"acao":"Reenviar o documento","resultado_esperado":"Nova versao registrada em documento_versoes"},
     {"ordem":2,"acao":"Consultar o historico do documento","resultado_esperado":"Versao anterior recuperavel, com autor e data"},
     {"ordem":3,"acao":"Conferir o arquivo antigo no storage","resultado_esperado":"Ainda acessivel ou explicitamente descartado com registro"}]'::jsonb,
   'Existe trilha de versoes, nao apenas o estado atual.',
   'GAP: documento_versoes existe no schema mas nao e alimentada por este fluxo. O upsert:true no storage sobrescreve o arquivo fisico — a versao anterior deixa de existir, sem registro de que existiu. Mesma classe do DESL-002, onde o segundo desligamento apaga o primeiro: o produto guarda ESTADO, nao HISTORICO, em mais de um lugar.'),

  (v_mod, 'ADM-106', 'Documento arquivado herda o tenant da admissao, nao o do usuario',
   'excecao', 'critica', 'aprovado', 'api',
   'LGPD, Lei 13.709/2018, arts. 46 e 47 — seguranca e prevencao de acesso '
   'indevido; regra de isolamento multi-tenant do produto.',
   'Gestor vinculado a mais de um cliente pode ter tenant principal diferente '
   'do tenant da admissao que esta operando.',
   'Usuario com vinculo em dois tenants.',
   '[{"ordem":1,"acao":"Operar uma admissao do tenant B estando com tenant principal A","resultado_esperado":"Documento gravado com tenant_id do B"},
     {"ordem":2,"acao":"Conferir a visibilidade para a equipe do tenant B","resultado_esperado":"Documento visivel para quem deve ve-lo"},
     {"ordem":3,"acao":"Conferir que nao vazou para o tenant A","resultado_esperado":"Invisivel no A"}]'::jsonb,
   'O documento pertence ao cliente da admissao, sempre.',
   'IMPLEMENTADO, e com cicatriz: o codigo busca o tenant_id na propria admissao em vez de usar o do usuario, com comentario dizendo que usar o tenant errado "gravava docs invisiveis para a equipe". Ou seja, ja aconteceu. Caso de protecao para um bug ja corrigido.'),

  (v_mod, 'ADM-107', 'ASO admissional e arquivado como documento de saude, nao como anexo generico',
   'excecao', 'critica', 'aprovado', 'api',
   'NR-07, item 7.5.19.1 (conteudo do ASO) e item 7.6 (guarda dos registros do '
   'PCMSO); LGPD, Lei 13.709/2018, art. 5o, II — dado referente a saude e dado '
   'pessoal SENSIVEL, com regime de tratamento e acesso proprio',
   'ASO nao pode ter o mesmo tratamento de um comprovante de residencia. O '
   'regime de acesso, retencao e sigilo e diferente por norma e por lei.',
   'Admissao com Exame Admissional enviado.',
   '[{"ordem":1,"acao":"Enviar o Exame Admissional","resultado_esperado":"Arquivado com classificacao de documento de saude ocupacional"},
     {"ordem":2,"acao":"Conferir a pasta de destino","resultado_esperado":"Pasta de saude ocupacional do colaborador, distinta dos documentos pessoais"},
     {"ordem":3,"acao":"Conferir quem consegue abrir","resultado_esperado":"Acesso restrito conforme o papel, diferente do acesso a RG e CPF"}]'::jsonb,
   'Dado de saude e arquivado e protegido conforme sua natureza.',
   'GAP: "Exame Admissional" e apenas o nono item de uma lista de anexos genericos, com tipo "saude" mas sem tratamento diferente de destino nem de acesso. Some-se a isso o ADM-101 e o ADM-102: ele nao vai nem para pasta nem para dono. Documento medico sensivel termina num balde compartilhado chamado "sem-colaborador".'),

  (v_mod, 'ADM-108', 'Nao ha documento orfao entre storage e modulo Documentos',
   'excecao', 'alta', 'aprovado', 'api',
   'LGPD, Lei 13.709/2018, arts. 15 e 16 — termino do tratamento e eliminacao '
   'dos dados quando cessa a finalidade; art. 37 — registro das operacoes',
   'Arquivo em storage sem registro correspondente nao tem dono, prazo de '
   'retencao nem quem responda por ele.',
   'Base com admissoes em varios estagios.',
   '[{"ordem":1,"acao":"Contar registros em admissao_documentos com arquivo_url preenchido","resultado_esperado":"Numero conhecido"},
     {"ordem":2,"acao":"Contar registros correspondentes em public.documentos","resultado_esperado":"Mesmo numero"},
     {"ordem":3,"acao":"Listar as diferencas","resultado_esperado":"Nenhuma"}]'::jsonb,
   'Todo arquivo enviado tem registro nos dois lados.',
   'AUDITORIA. Mede o passivo real: quantos documentos ja enviados nao chegaram ao modulo. A sincronizacao so passou a existir em determinado momento do desenvolvimento; documentos anteriores a isso provavelmente nunca foram sincronizados e ninguem sabe quantos sao.'),

  -- ═══════════════════════════════════════════════════════
  -- B) EXAME ADMISSIONAL — NR-07
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'ADM-060', 'Exame admissional e realizado ANTES do inicio das atividades',
   'excecao', 'critica', 'aprovado', 'e2e',
   'NR-07, item 7.5.8, I (Portaria SEPRT 6.734/2020) — "no exame admissional: '
   'ser realizado antes que o empregado assuma suas atividades"; CLT, art. 168, I',
   'A norma nao fixa antecedencia minima, mas e categorica quanto a ordem: '
   'primeiro o exame, depois as atividades. Admitir e examinar depois inverte '
   'a logica de prevencao.',
   'Admissao com data de inicio definida.',
   '[{"ordem":1,"acao":"Informar exame admissional com data POSTERIOR ao inicio das atividades","resultado_esperado":"Bloqueado ou alertado de forma destacada"},
     {"ordem":2,"acao":"Informar exame na mesma data do inicio","resultado_esperado":"Aceito — a norma exige anterioridade a assuncao das atividades, nao a admissao"},
     {"ordem":3,"acao":"Concluir admissao sem exame algum","resultado_esperado":"Bloqueado — o exame e obrigatorio"}]'::jsonb,
   'Nenhum colaborador assume atividades sem exame admissional previo.',
   'GAP: o sistema trata o Exame Admissional como anexo obrigatorio da lista, sem NENHUMA data estruturada para comparar com o inicio das atividades. Nao ha como verificar a ordem cronologica exigida pelo item 7.5.8, I. Compare com o desligamento, que estrutura data, resultado, medico e CRM: a admissao, onde a exigencia e mais rigida, estrutura menos.'),

  (v_mod, 'ADM-061', 'ASO admissional registra os dados exigidos pela norma',
   'excecao', 'critica', 'aprovado', 'e2e',
   'NR-07, item 7.5.19.1 (Portaria SEPRT 6.734/2020) — o ASO deve conter razao '
   'social e CNPJ ou CAEPF da organizacao, nome e CPF do trabalhador, os riscos '
   'ocupacionais, a conclusao quanto a aptidao, e nome, CRM e assinatura do '
   'medico responsavel',
   'Anexar PDF nao e registrar. Sem dado estruturado nao ha como cruzar '
   'validade, aptidao ou conferir o proximo periodico.',
   'Admissao com exame admissional.',
   '[{"ordem":1,"acao":"Enviar apenas o PDF do ASO","resultado_esperado":"O sistema exige tambem os dados estruturados"},
     {"ordem":2,"acao":"Conferir os campos exigidos","resultado_esperado":"Data, conclusao de aptidao, medico responsavel e CRM"},
     {"ordem":3,"acao":"Conferir se o CPF do trabalhador consta","resultado_esperado":"Presente — o item 7.5.19.1 passou a exigir CPF no lugar do numero de identidade"}]'::jsonb,
   'O ASO admissional e registro estruturado, nao apenas um anexo.',
   'GAP. NOTA DE FUNDAMENTACAO: no DESL-066 eu citei "itens 7.5.19 e 7.5.20" com marca de conferir. O item correto e 7.5.19.1, conforme a Portaria SEPRT 6.734/2020 — corrigido no bloco final desta migration.'),

  (v_mod, 'ADM-062', 'Exames complementares anteriores sao aproveitaveis em ate 90 dias',
   'alternativo', 'media', 'aprovado', 'e2e',
   'NR-07, item 7.5.17 — "No exame admissional, a criterio do medico responsavel, '
   'poderao ser aceitos exames complementares realizados nos 90 dias anteriores, '
   'exceto quando definidos prazos diferentes nos Anexos desta NR"',
   'Evitar repeticao desnecessaria de exame, dentro do que a norma autoriza.',
   'Candidato com exames complementares recentes.',
   '[{"ordem":1,"acao":"Informar exame complementar realizado ha 60 dias","resultado_esperado":"Aproveitavel, a criterio medico"},
     {"ordem":2,"acao":"Informar exame realizado ha 91 dias","resultado_esperado":"Nao aproveitavel"},
     {"ordem":3,"acao":"Conferir se ha anexos da NR com prazo proprio","resultado_esperado":"O prazo do Anexo especifico prevalece sobre os 90 dias"}]'::jsonb,
   'A janela de 90 dias e respeitada, com prevalencia dos prazos dos Anexos.',
   'NAO IMPLEMENTADO — o sistema nao registra exames complementares separadamente. Note que a decisao e do MEDICO ("a criterio do medico responsavel"), entao o sistema deve informar a possibilidade e registrar a decisao, nunca decidir sozinho.'),

  (v_mod, 'ADM-063', 'ASO com conclusao inapto impede a admissao para aquela funcao',
   'excecao', 'critica', 'aprovado', 'e2e',
   'CLT, art. 168, caput e §5o; NR-07, item 7.5.8, I — a finalidade do exame '
   'admissional e verificar aptidao para a funcao ANTES do inicio; admitir '
   'trabalhador declarado inapto contraria a propria finalidade da norma',
   'A conclusao do ASO tem consequencia. Se nao tiver, o exame vira formalidade.',
   'Admissao com ASO concluindo inapto para a funcao pretendida.',
   '[{"ordem":1,"acao":"Registrar ASO com conclusao inapto","resultado_esperado":"Admissao bloqueada para aquela funcao, com alerta"},
     {"ordem":2,"acao":"Registrar apto com restricoes","resultado_esperado":"Permitido, com as restricoes registradas e visiveis"},
     {"ordem":3,"acao":"Conferir se as restricoes chegam ao gestor da area","resultado_esperado":"Visiveis para quem vai alocar a pessoa"}]'::jsonb,
   'A conclusao do ASO governa a admissao e a alocacao.',
   'GAP: nao ha campo de conclusao no fluxo de admissao — logo, nao ha consequencia possivel. O passo 3 e o mais negligenciado: restricao registrada que nao chega a quem escala a pessoa e restricao que nao existe na pratica.'),

  -- ═══════════════════════════════════════════════════════
  -- C) eSOCIAL
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'ADM-090', 'Admissao gera evento S-2200 ate o dia anterior ao inicio das atividades',
   'feliz', 'critica', 'aprovado', 'api',
   'Manual de Orientacao do eSocial (MOS), evento S-2200 — Cadastramento Inicial '
   'do Vinculo e Admissao/Ingresso de Trabalhador, cujo prazo de envio e ate o dia '
   'imediatamente anterior ao do inicio das atividades; Decreto 8.373/2014; '
   'CLT, art. 41 (registro de empregados)',
   'A admissao e o unico evento do eSocial com prazo ANTERIOR ao fato. Perder o '
   'prazo nao se corrige depois.',
   'Admissao concluida de trabalhador celetista.',
   '[{"ordem":1,"acao":"Concluir a admissao","resultado_esperado":"Evento S-2200 gerado e enfileirado"},
     {"ordem":2,"acao":"Conferir a data limite calculada","resultado_esperado":"Dia imediatamente anterior ao inicio das atividades"},
     {"ordem":3,"acao":"Admissao cuja data de inicio ja passou","resultado_esperado":"Alerta de prazo perdido, com destaque"}]'::jsonb,
   'O evento e gerado e o prazo anterior ao inicio e controlado.',
   'GAP TOTAL: S-2200 nao aparece em NENHUM arquivo do repositorio. A admissao nao gera evento de eSocial algum. Situacao pior que a do desligamento, que ao menos monta o S-2299 em memoria. Aqui nao existe nem o objeto. E, das duas pontas do vinculo, esta e a de prazo mais rigido: o desligamento tem 10 dias depois, a admissao tem que ser ANTES.'),

  (v_mod, 'ADM-091', 'Admissao preliminar usa o evento S-2190 quando cabivel',
   'alternativo', 'media', 'aprovado', 'api',
   'MOS, evento S-2190 — Admissao Preliminar, utilizavel quando nao ha tempo habil '
   'para o envio do S-2200 completo antes do inicio das atividades, com posterior '
   'complementacao',
   'Existe caminho previsto para a admissao de ultima hora. Nao oferece-lo empurra '
   'o usuario para o descumprimento do prazo.',
   'Admissao com inicio iminente e cadastro incompleto.',
   '[{"ordem":1,"acao":"Iniciar admissao para comeco no dia seguinte, sem dados completos","resultado_esperado":"O sistema oferece a admissao preliminar"},
     {"ordem":2,"acao":"Conferir o prazo de complementacao","resultado_esperado":"Controlado e cobravel"}]'::jsonb,
   'A admissao preliminar e oferecida e sua complementacao e cobrada.',
   'GAP TOTAL, decorrente do ADM-090. Depende da decisao de produto sobre integracao com eSocial: se o produto nao pretende transmitir, este caso vira rascunho. Se pretende, o S-2190 e parte necessaria do conjunto.'),

  -- ═══════════════════════════════════════════════════════
  -- D) REGISTRO E PRAZOS
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'ADM-001', 'Registro do empregado contem os dados exigidos em lei',
   'feliz', 'alta', 'aprovado', 'e2e',
   'CLT, art. 41 — obrigatoriedade do registro de empregados; paragrafo unico: '
   'devem constar a qualificacao civil ou profissional, os dados relativos a '
   'admissao, duracao e efetividade do trabalho, ferias, acidentes e demais '
   'circunstancias de protecao ao trabalhador',
   'O registro e obrigacao legal autonoma, independente do eSocial.',
   'Admissao concluida.',
   '[{"ordem":1,"acao":"Conferir qualificacao civil","resultado_esperado":"Nome, CPF, data de nascimento e filiacao registrados"},
     {"ordem":2,"acao":"Conferir dados da admissao","resultado_esperado":"Data de inicio, cargo, salario e jornada"},
     {"ordem":3,"acao":"Conferir vinculacao a empresa e ao estabelecimento","resultado_esperado":"Definidos"}]'::jsonb,
   'O registro atende ao paragrafo unico do art. 41.',
   'Vale conferir campo a campo contra o art. 41 e contra o leiaute do S-2200: sao listas parecidas mas nao identicas, e o sistema precisa satisfazer as duas.'),

  (v_mod, 'ADM-002', 'CPF do candidato e unico e nao duplica colaborador existente',
   'negativo', 'critica', 'aprovado', 'api',
   'CLT, art. 41 (unicidade do registro); MOS — o CPF e a chave do trabalhador '
   'no eSocial, e duplicidade gera inconsistencia no evento',
   'Duas admissoes para a mesma pessoa produzem dois vinculos no eSocial.',
   'Colaborador ja cadastrado.',
   '[{"ordem":1,"acao":"Iniciar admissao com CPF ja existente e ativo","resultado_esperado":"Bloqueado ou alertado antes de prosseguir"},
     {"ordem":2,"acao":"Repetir com o CPF formatado de outra forma","resultado_esperado":"Reconhecido como a mesma pessoa"},
     {"ordem":3,"acao":"CPF de pessoa ja desligada","resultado_esperado":"Permitido — readmissao e legitima"}]'::jsonb,
   'A unicidade e por pessoa, e readmissao continua possivel.',
   'Conecta diretamente com COLAB-033 (CPF formatado tratado como pessoa diferente) e COLAB-034, ja documentados no modulo de Colaboradores. O passo 3 e a contraprova que impede a correcao de virar trava excessiva.'),

  (v_mod, 'ADM-003', 'Documentos obrigatorios sao gerados uma unica vez por admissao',
   'negativo', 'alta', 'aprovado', 'api',
   'Regra de produto (sem base legal): consistencia do checklist.',
   'Reprocessar a criacao da admissao nao pode dobrar a lista de pendencias.',
   'Nenhuma.',
   '[{"ordem":1,"acao":"Criar admissao","resultado_esperado":"9 documentos obrigatorios na lista"},
     {"ordem":2,"acao":"Reprocessar o mesmo fluxo","resultado_esperado":"Continua 9, sem duplicar"}]'::jsonb,
   'O checklist nao duplica em reprocessamento.',
   'IMPLEMENTADO e com cicatriz documentada no proprio codigo: era insert puro e dobrava a lista para 18. Hoje e upsert ancorado no indice admissao_documentos_admissao_nome_uidx. Caso de protecao — o comentario no codigo conta a historia, mas comentario nao roda.'),

  -- ═══════════════════════════════════════════════════════
  -- E) AS DUAS ROTAS DE CADASTRO
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'ADM-010', 'Cadastro rapido e admissao completa produzem colaborador equivalente',
   'alternativo', 'critica', 'aprovado', 'api',
   'CLT, art. 41 — o registro exigido em lei e um so, independente da tela usada '
   'para cria-lo',
   'Duas portas de entrada para o mesmo cadastro so se justificam se a saida for '
   'a mesma. Diferenca silenciosa cria duas classes de colaborador.',
   'Nenhuma.',
   '[{"ordem":1,"acao":"Cadastrar pela aba Ativos (rota enxuta)","resultado_esperado":"Colaborador criado"},
     {"ordem":2,"acao":"Cadastrar outro pela aba Admissoes (rota completa)","resultado_esperado":"Colaborador criado"},
     {"ordem":3,"acao":"Comparar os dois registros","resultado_esperado":"Mesmas tabelas alimentadas, mesmos campos estruturais, mesmos vinculos"},
     {"ordem":4,"acao":"Conferir o que a rota enxuta NAO preenche","resultado_esperado":"Lista conhecida e documentada, nao surpresa"}]'::jsonb,
   'As duas rotas convergem para o mesmo registro, com diferencas conhecidas.',
   'O passo 4 e o objetivo real deste caso: hoje ninguem sabe exatamente o que a rota enxuta deixa de preencher. Ate mapear isso, nao da para saber se um colaborador cadastrado rapidamente esta apto a gerar S-2200, a receber ASO ou a entrar na apuracao de ponto.'),

  (v_mod, 'ADM-011', 'Colaborador da rota enxuta pode ser completado depois sem duplicar',
   'alternativo', 'critica', 'aprovado', 'api',
   'CLT, art. 41 (unicidade do registro)',
   'Fluxo real: cadastro rapido para destravar operacao, admissao completa depois.',
   'Colaborador criado pela rota enxuta.',
   '[{"ordem":1,"acao":"Iniciar admissao completa para a mesma pessoa","resultado_esperado":"O sistema reconhece o cadastro existente e o COMPLETA"},
     {"ordem":2,"acao":"Conferir a contagem de colaboradores","resultado_esperado":"Um, nao dois"},
     {"ordem":3,"acao":"Conferir vinculos, ponto e documentos","resultado_esperado":"Preservados — o id da pessoa nao mudou"}]'::jsonb,
   'Completar o cadastro nao cria pessoa nova.',
   'RISCO ALTO e diretamente ligado a investigacao de duplicacao de colaboradores ja feita neste sistema. O passo 3 e o mesmo cuidado do COLAB-032: se o fluxo apagar e recriar em vez de atualizar no lugar, o id muda e todo o historico vinculado fica orfao.'),

  (v_mod, 'ADM-012', 'Rota enxuta tambem alimenta o checklist de documentos',
   'alternativo', 'media', 'aprovado', 'api',
   'Premissa de produto: arquivamento unico vale para as duas rotas.',
   'Se so a rota completa gera checklist, o colaborador da rota enxuta nunca tem '
   'documentacao cobrada.',
   'Colaborador criado pela rota enxuta.',
   '[{"ordem":1,"acao":"Conferir se ha registros em admissao_documentos","resultado_esperado":"Checklist criado tambem por esta rota"},
     {"ordem":2,"acao":"Conferir a pendencia de documentos obrigatorios","resultado_esperado":"Visivel em algum lugar para o RH"}]'::jsonb,
   'As duas rotas geram a mesma exigencia documental.',
   'PARCIAL: ColaboradorForm.tsx faz insert em admissao_documentos, entao alguma coisa acontece. Falta conferir se e a lista completa dos 9 obrigatorios ou um subconjunto, e se a pendencia aparece para o RH em algum painel.'),

  -- ═══════════════════════════════════════════════════════
  -- F) RETENCAO E PRIVACIDADE
  -- ═══════════════════════════════════════════════════════

  (v_mod, 'ADM-110', 'Documento pessoal e acessivel apenas por quem tem funcao para isso',
   'negativo', 'critica', 'aprovado', 'api',
   'LGPD, Lei 13.709/2018, art. 6o, III (necessidade) e art. 46 (seguranca); '
   'documento de saude e dado sensivel — art. 5o, II e art. 11',
   'RG, CPF, certidao e ASO nao tem o mesmo publico interno.',
   'Documentos de admissao arquivados.',
   '[{"ordem":1,"acao":"Acessar como usuario sem papel de RH","resultado_esperado":"Sem acesso aos documentos pessoais"},
     {"ordem":2,"acao":"Acessar o ASO como usuario de RH sem funcao de saude ocupacional","resultado_esperado":"Acesso restrito ou negado, por ser dado sensivel"},
     {"ordem":3,"acao":"Tentar abrir por URL assinada compartilhada","resultado_esperado":"Expira e nao concede acesso permanente"}]'::jsonb,
   'O acesso segue a necessidade da funcao, com regime proprio para saude.',
   'O bucket e privado e o acesso e por URL assinada, o que atende o passo 3. Os passos 1 e 2 dependem da RLS de public.documentos e precisam ser verificados — em especial a distincao entre documento comum e documento de saude, que hoje nao existe como classificacao.'),

  (v_mod, 'ADM-111', 'Admissao cancelada nao deixa documentos pessoais para tras',
   'excecao', 'alta', 'aprovado', 'api',
   'LGPD, Lei 13.709/2018, art. 15, I e III (termino do tratamento) e art. 16 '
   '(eliminacao apos o termino), ressalvadas as hipoteses de guarda obrigatoria',
   'Candidato que nao foi admitido teve documentos pessoais coletados para uma '
   'finalidade que deixou de existir.',
   'Admissao com documentos enviados e depois cancelada.',
   '[{"ordem":1,"acao":"Cancelar a admissao","resultado_esperado":"O sistema define o destino dos documentos ja enviados"},
     {"ordem":2,"acao":"Conferir storage e modulo Documentos","resultado_esperado":"Eliminados, ou retidos com prazo e justificativa registrados"},
     {"ordem":3,"acao":"Conferir se ha registro da operacao","resultado_esperado":"Registrado, conforme art. 37"}]'::jsonb,
   'O termino da finalidade tem consequencia definida e auditavel.',
   'GAP PROVAVEL, e amplificado pelo ADM-102: como o documento fica sem colaborador_id e sem pasta, nao ha nem como localizar o conjunto de documentos de uma admissao cancelada para elimina-lo. A falta de vinculo deixa de ser inconveniencia de organizacao e vira obstaculo ao cumprimento da LGPD.')

  ON CONFLICT (codigo) DO NOTHING;

  SELECT count(*) INTO v_depois FROM public.qa_casos_teste WHERE modulo_id = v_mod;
  RAISE NOTICE 'Modulo Admissao: % casos antes, % depois (+%).', v_antes, v_depois, v_depois - v_antes;
END $doc$;

-- ─────────────────────────────────────────────────────────
-- Correcao de fundamentacao do DESL-066, confirmada em 31/07/2026
-- ─────────────────────────────────────────────────────────
UPDATE public.qa_casos_teste
SET base_legal = 'NR-07, item 7.5.19.1 (Portaria SEPRT 6.734/2020) — o ASO deve conter '
      || 'razao social e CNPJ ou CAEPF da organizacao, nome e CPF do trabalhador, os '
      || 'riscos ocupacionais, a conclusao quanto a aptidao, e nome, CRM e assinatura '
      || 'do medico responsavel; CLT, art. 168, §5o',
    observacoes = observacoes || ' | FUNDAMENTACAO CONFIRMADA 31/07/2026: a citacao '
      || 'anterior ("itens 7.5.19 e 7.5.20") estava marcada para conferir. O item '
      || 'correto do conteudo do ASO e 7.5.19.1. O achado do caso nao muda — apenas '
      || 'passa a ter a citacao exata.'
WHERE codigo = 'DESL-066';

-- Retrato do modulo
SELECT ct.nivel, ct.prioridade::text AS prioridade, count(*) AS casos
FROM public.qa_casos_teste ct
JOIN public.qa_modulos m ON m.id = ct.modulo_id
WHERE m.path = 'estrutura-organizacional/colaboradores/admissao'
GROUP BY ct.nivel, ct.prioridade
ORDER BY ct.nivel,
  CASE ct.prioridade WHEN 'critica' THEN 1 WHEN 'alta' THEN 2 WHEN 'media' THEN 3 ELSE 4 END;

-- Gaps ja confirmados por leitura de codigo
SELECT ct.codigo, ct.prioridade::text AS prioridade, ct.titulo, ct.base_legal
FROM public.qa_casos_teste ct
JOIN public.qa_modulos m ON m.id = ct.modulo_id
WHERE m.path = 'estrutura-organizacional/colaboradores/admissao'
  AND (ct.observacoes LIKE '%DIVERGENCIA CONFIRMADA%' OR ct.observacoes LIKE '%GAP TOTAL%')
ORDER BY CASE ct.prioridade WHEN 'critica' THEN 1 WHEN 'alta' THEN 2 ELSE 3 END, ct.codigo;
