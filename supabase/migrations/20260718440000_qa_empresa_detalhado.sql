-- =========================================================
-- QA — Módulo EMPRESA DETALHADO (10 casos, padrao aprovado)
-- Bloco Estrutura Organizacional. Segue o modelo de Colaboradores.
--
-- Cada caso: objetivo (regra + porque), pre_condicoes, passos com dados
-- exatos + caminho na tela, resultado_esperado, observacoes (impacto real +
-- correcao). Impacto baseado no objetivo real de cada caso (NR-04/NR-05,
-- integridade de CNPJ, LGPD).
-- =========================================================

DO $d$
DECLARE v_mod uuid;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos WHERE path='estrutura-organizacional/empresa';
  IF v_mod IS NULL THEN RAISE EXCEPTION 'Modulo empresa nao encontrado.'; END IF;

  -- ══ EMP-001: cadastro basico ══
  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que uma empresa pode ser cadastrada com os dados basicos: razao social e CNPJ. '
             || 'Regra: toda empresa precisa de razao social e um CNPJ valido. Importa porque a empresa e '
             || 'a base da estrutura — colaboradores, obras e documentos penduram nela; sem cadastrar '
             || 'empresa, nada mais funciona para aquele cliente.',
    pre_condicoes = 'Usuario logado com permissao de administrador do cliente.',
    passos = '[
      {"ordem":1,"acao":"Abrir o cadastro de empresa","onde_na_tela":"Menu lateral > Empresas (ou Estrutura Organizacional > Empresas) > botao Nova Empresa","dados":"-","resultado_esperado":"Formulario de cadastro de empresa aberto"},
      {"ordem":2,"acao":"Preencher razao social e CNPJ validos","onde_na_tela":"Campos Razao Social e CNPJ","dados":"Razao Social: Empresa Teste Ltda | CNPJ: 11.222.333/0001-81 (valido)","resultado_esperado":"Os campos aceitam os valores"},
      {"ordem":3,"acao":"Salvar","onde_na_tela":"Botao Salvar","dados":"-","resultado_esperado":"Empresa criada e aparece na lista de empresas"}
    ]'::jsonb,
    resultado_esperado = 'A empresa Empresa Teste Ltda existe no sistema com o CNPJ informado e aparece na '
                       || 'lista de empresas do cliente.',
    observacoes = 'IMPACTO SE FALHAR: a empresa e a base de tudo. Sem conseguir cadastra-la, o cliente nao '
                || 'consegue registrar colaboradores, obras nem documentos — bloqueia a implantacao inteira.'
  WHERE codigo='EMP-001';

  -- ══ EMP-002: cadastro com SST (NR-04, NR-05) ══
  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que os dados de SST (grau de risco da NR-04, situacao de SESMT e CIPA da NR-05) '
             || 'sao gravados junto com a empresa. Regra: essas informacoes definem as obrigacoes legais '
             || 'de saude e seguranca da empresa. Importa porque grau de risco e SESMT/CIPA determinam o '
             || 'que a empresa precisa cumprir legalmente — e a razao de ser de um sistema de SST.',
    pre_condicoes = 'Formulario de empresa disponivel, com a secao de SST.',
    passos = '[
      {"ordem":1,"acao":"Abrir nova empresa e ir a secao de SST","onde_na_tela":"Nova Empresa > secao Saude e Seguranca (NR-04/NR-05)","dados":"-","resultado_esperado":"Campos de grau de risco, SESMT e CIPA visiveis"},
      {"ordem":2,"acao":"Preencher os dados de SST","onde_na_tela":"Campos Grau de Risco, Situacao SESMT, Situacao CIPA","dados":"Grau de Risco: 3 | SESMT: terceirizado | CIPA: ativa","resultado_esperado":"Os valores sao aceitos"},
      {"ordem":3,"acao":"Salvar e reabrir a empresa","onde_na_tela":"Salvar > depois abrir a empresa de novo","dados":"-","resultado_esperado":"Os dados de SST foram gravados e aparecem ao reabrir"}
    ]'::jsonb,
    resultado_esperado = 'A empresa e salva com grau de risco 3, SESMT terceirizado e CIPA ativa. Ao reabrir, '
                       || 'os tres dados de SST estao la.',
    observacoes = 'IMPACTO SE FALHAR: se os dados de NR-04/NR-05 nao gravarem, a empresa fica sem a '
                || 'classificacao legal que orienta todas as obrigacoes de SST — o sistema perde a base '
                || 'para gerar programas, treinamentos e exigencias corretas.'
  WHERE codigo='EMP-002';

  -- ══ EMP-003: editar empresa ══
  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que dados de uma empresa existente podem ser editados e a alteracao persiste. '
             || 'Regra: os dados cadastrais sao editaveis (empresas mudam de endereco, telefone, etc). '
             || 'Importa porque dados desatualizados geram documentos e comunicacoes erradas.',
    pre_condicoes = 'Precisa existir uma empresa cadastrada.',
    passos = '[
      {"ordem":1,"acao":"Abrir uma empresa para edicao","onde_na_tela":"Lista de Empresas > clicar na empresa > Editar","dados":"-","resultado_esperado":"Formulario aberto com os dados atuais"},
      {"ordem":2,"acao":"Alterar a razao social","onde_na_tela":"Campo Razao Social","dados":"Novo valor: Empresa Teste Editada Ltda","resultado_esperado":"O campo aceita o novo valor"},
      {"ordem":3,"acao":"Salvar e conferir","onde_na_tela":"Salvar > reabrir a empresa","dados":"-","resultado_esperado":"A razao social nova esta gravada"}
    ]'::jsonb,
    resultado_esperado = 'A razao social e atualizada para o novo valor e persiste ao reabrir a empresa.',
    observacoes = 'IMPACTO SE FALHAR: se a edicao nao persistir, dados desatualizados continuam em '
                || 'documentos e relatorios oficiais da empresa.'
  WHERE codigo='EMP-003';

  -- ══ EMP-010: grau de risco fora de 1-4 ══
  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que um grau de risco fora da faixa 1-4 e recusado. Regra: a NR-04 define grau '
             || 'de risco APENAS de 1 a 4; qualquer outro valor e invalido por lei. Importa porque um grau '
             || 'invalido (0, 5, 9) corromperia a classificacao legal da empresa e os documentos gerados '
             || 'a partir dela.',
    pre_condicoes = 'Formulario de empresa com o campo grau de risco.',
    passos = '[
      {"ordem":1,"acao":"Abrir nova empresa e ir ao grau de risco","onde_na_tela":"Nova Empresa > secao SST > Grau de Risco","dados":"-","resultado_esperado":"Campo grau de risco disponivel"},
      {"ordem":2,"acao":"Tentar informar um grau invalido","onde_na_tela":"Campo Grau de Risco","dados":"Grau de Risco: 9 (invalido — a NR-04 so vai ate 4)","resultado_esperado":"O sistema DEVE recusar o valor"}
    ]'::jsonb,
    resultado_esperado = 'O grau de risco 9 e recusado. So valores de 1 a 4 sao aceitos, conforme a NR-04.',
    observacoes = 'IMPACTO SE FALHAR: grau de risco invalido corrompe a classificacao legal da empresa e '
                || 'os documentos de SST derivados. O banco tem CHECK (1-4) — o caso confirma que segura.'
  WHERE codigo='EMP-010';

  -- ══ EMP-011: SESMT invalido ══
  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que a situacao de SESMT so aceita os valores validos: proprio, terceirizado ou '
             || 'inexistente. Regra: SESMT (servico de seguranca da NR-04) tem essas tres situacoes '
             || 'possiveis. Importa porque um valor livre quebraria relatorios e a logica que depende de '
             || 'saber como a empresa gerencia o SESMT.',
    pre_condicoes = 'Formulario de empresa com o campo situacao SESMT.',
    passos = '[
      {"ordem":1,"acao":"Abrir nova empresa e ir a situacao SESMT","onde_na_tela":"Nova Empresa > secao SST > Situacao SESMT","dados":"-","resultado_esperado":"Campo disponivel"},
      {"ordem":2,"acao":"Tentar um valor fora da lista","onde_na_tela":"Campo Situacao SESMT","dados":"Situacao SESMT: quase (valor invalido)","resultado_esperado":"O sistema DEVE recusar"}
    ]'::jsonb,
    resultado_esperado = 'O valor invalido e recusado. So proprio, terceirizado ou inexistente sao aceitos.',
    observacoes = 'IMPACTO SE FALHAR: situacao de SESMT invalida quebra relatorios de SST e a logica que '
                || 'decide obrigacoes conforme a estrutura de seguranca da empresa.'
  WHERE codigo='EMP-011';

  -- ══ EMP-012: CIPA invalida ══
  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que a situacao de CIPA so aceita valores validos: nao_constituida, '
             || 'em_implantacao ou ativa. Regra: a CIPA (comissao de prevencao da NR-05) tem esses '
             || 'estados. Importa porque o estado da CIPA orienta obrigacoes (eleicao, treinamento) e um '
             || 'valor invalido quebraria essa logica.',
    pre_condicoes = 'Formulario de empresa com o campo situacao CIPA.',
    passos = '[
      {"ordem":1,"acao":"Abrir nova empresa e ir a situacao CIPA","onde_na_tela":"Nova Empresa > secao SST > Situacao CIPA","dados":"-","resultado_esperado":"Campo disponivel"},
      {"ordem":2,"acao":"Tentar um valor fora da lista","onde_na_tela":"Campo Situacao CIPA","dados":"Situacao CIPA: talvez (valor invalido)","resultado_esperado":"O sistema DEVE recusar"}
    ]'::jsonb,
    resultado_esperado = 'O valor invalido e recusado. So nao_constituida, em_implantacao ou ativa sao aceitos.',
    observacoes = 'IMPACTO SE FALHAR: estado de CIPA invalido quebra a logica de obrigacoes da NR-05 '
                || '(quando exigir eleicao, treinamento) e os relatorios relacionados.'
  WHERE codigo='EMP-012';

  -- ══ EMP-013: CNPJ com pontuacao normalizado ══
  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que a trava de CNPJ normaliza a pontuacao: "11.222.333/0001-44" e '
             || '"11222333000144" sao o mesmo numero. Regra: a comparacao de CNPJ deve ignorar pontos, '
             || 'barras e tracos. Importa porque, sem isso, a mesma empresa cadastrada com e sem '
             || 'formatacao passaria como duas — furando a trava de duplicidade.',
    pre_condicoes = 'Precisa existir uma empresa cadastrada com um CNPJ (formatado ou nao).',
    passos = '[
      {"ordem":1,"acao":"Cadastrar uma empresa com CNPJ sem pontuacao","onde_na_tela":"Nova Empresa","dados":"CNPJ: 11222333000144 (sem pontos)","resultado_esperado":"Empresa criada"},
      {"ordem":2,"acao":"Tentar cadastrar outra com o MESMO CNPJ, mas formatado","onde_na_tela":"Nova Empresa","dados":"CNPJ: 11.222.333/0001-44 (mesmo numero, com pontos)","resultado_esperado":"O sistema reconhece como o mesmo CNPJ e trata como duplicata"}
    ]'::jsonb,
    resultado_esperado = 'O sistema entende que os dois CNPJs sao o mesmo numero. A formatacao nao cria uma '
                       || 'empresa distinta.',
    observacoes = 'IMPACTO SE FALHAR: se a normalizacao falhar, a mesma empresa entra duas vezes (uma '
                || 'formatada, uma nao), furando a trava de CNPJ duplicado e duplicando toda a estrutura '
                || 'pendurada nela.'
  WHERE codigo='EMP-013';

  -- ══ EMP-020: CNPJ ativo duplicado proibido ══
  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que duas empresas ATIVAS com o mesmo CNPJ no mesmo cliente sao proibidas. '
             || 'Regra: a trigger prevent_duplicate_active_cnpj impede dois cadastros ativos com o mesmo '
             || 'CNPJ. Importa porque CNPJ ativo duplicado gera confusao fiscal e documentos emitidos para '
             || 'a empresa errada.',
    pre_condicoes = 'Precisa existir uma empresa ativa com um CNPJ conhecido.',
    passos = '[
      {"ordem":1,"acao":"Cadastrar uma empresa ativa com um CNPJ","onde_na_tela":"Nova Empresa","dados":"Razao: Primeira | CNPJ: 11.444.777/0001-61 | Status: ativa","resultado_esperado":"Empresa ativa criada"},
      {"ordem":2,"acao":"Tentar cadastrar OUTRA empresa ativa com o MESMO CNPJ","onde_na_tela":"Nova Empresa","dados":"Razao: Segunda | CNPJ: 11.444.777/0001-61 (mesmo) | Status: ativa","resultado_esperado":"O sistema DEVE recusar o CNPJ ativo duplicado"}
    ]'::jsonb,
    resultado_esperado = 'A segunda empresa ativa com o mesmo CNPJ e recusada. So uma empresa ativa por CNPJ '
                       || 'no cliente.',
    observacoes = 'IMPACTO SE FALHAR: dois cadastros ativos para o mesmo CNPJ confundem qual e a empresa '
                || '"de verdade" — documentos, guias e relatorios podem sair pela empresa errada. A trigger '
                || 'prevent_duplicate_active_cnpj protege; o caso confirma.'
  WHERE codigo='EMP-020';

  -- ══ EMP-021: reativar duplicata proibido ══
  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que nao da para REATIVAR uma empresa cujo CNPJ ja esta ativo em outra. Regra: a '
             || 'mesma protecao de CNPJ ativo unico vale tambem na edicao (UPDATE), nao so na criacao. '
             || 'Importa porque, sem isso, daria para burlar a trava criando a empresa inativa e depois '
             || 'ativando-a.',
    pre_condicoes = 'Precisa existir uma empresa ATIVA com um CNPJ, e uma segunda empresa INATIVA com o '
                  || 'mesmo CNPJ.',
    passos = '[
      {"ordem":1,"acao":"Ter uma empresa ativa e outra inativa com o MESMO CNPJ","onde_na_tela":"Lista de Empresas","dados":"Empresa A: CNPJ X, ativa | Empresa B: CNPJ X, inativa","resultado_esperado":"Uma ativa, uma inativa, mesmo CNPJ"},
      {"ordem":2,"acao":"Tentar ativar a empresa B (a inativa)","onde_na_tela":"Empresa B > Editar > mudar Status para ativa","dados":"Status: de inativa para ativa","resultado_esperado":"O sistema DEVE recusar — ja existe uma ativa com esse CNPJ"}
    ]'::jsonb,
    resultado_esperado = 'A ativacao da segunda empresa e recusada enquanto a primeira com o mesmo CNPJ '
                       || 'estiver ativa. A regra vale no UPDATE, nao so na criacao.',
    observacoes = 'IMPACTO SE FALHAR: se a regra so valesse na criacao, daria para burlar — criar inativa '
                || 'e depois ativar, chegando a duas ativas com o mesmo CNPJ. O caso garante que a edicao '
                || 'tambem e protegida.'
  WHERE codigo='EMP-021';

  -- ══ EMP-022: isolamento ══
  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que uma empresa de um cliente e invisivel para outro cliente. Regra: o '
             || 'isolamento multi-tenant vale para empresas como para tudo. Importa porque ver a empresa '
             || 'de outro cliente exporia dados cadastrais e fiscais de terceiros — violacao de '
             || 'confidencialidade.',
    pre_condicoes = 'Dois clientes distintos no sistema (o teste usa dois ambientes isolados).',
    passos = '[
      {"ordem":1,"acao":"No cliente A, cadastrar uma empresa","onde_na_tela":"Cliente A > Nova Empresa","dados":"Razao: Empresa Secreta do A | CNPJ: 11.222.333/0001-81","resultado_esperado":"Empresa criada no cliente A"},
      {"ordem":2,"acao":"Entrar como cliente B e procurar essa empresa","onde_na_tela":"Cliente B > Empresas > busca","dados":"Buscar pela razao ou CNPJ da empresa do cliente A","resultado_esperado":"A empresa do cliente A NAO aparece para o cliente B"}
    ]'::jsonb,
    resultado_esperado = 'A empresa cadastrada no cliente A e invisivel no cliente B. Zero vazamento entre '
                       || 'clientes.',
    observacoes = 'IMPACTO SE FALHAR: exporia dados cadastrais e fiscais (CNPJ, razao social) de uma '
                || 'empresa para outro cliente — quebra de confidencialidade e risco de LGPD. Protecao RLS '
                || 'por tenant; o caso verifica a cada bateria.'
  WHERE codigo='EMP-022';

  RAISE NOTICE 'Modulo EMPRESA detalhado: 10 casos.';
END $d$;

SELECT codigo, left(objetivo,48) AS objetivo, jsonb_array_length(passos) AS passos,
       (observacoes IS NOT NULL) AS tem_impacto
FROM public.qa_casos_teste WHERE codigo LIKE 'EMP-%' AND modulo_id=(SELECT id FROM public.qa_modulos WHERE path='estrutura-organizacional/empresa')
ORDER BY codigo;
