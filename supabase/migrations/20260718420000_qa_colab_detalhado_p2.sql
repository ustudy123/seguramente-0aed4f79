-- =========================================================
-- QA — Colaboradores DETALHADOS · Parte 2 de 2
-- COLAB-025, 026, 027, 028, 029, 035, 036
-- Os casos de vinculo, suspensao e desligamento — os mais sutis do modulo.
-- Guardam a regra do indice unico de vinculo (a correcao ja aplicada em jul).
-- =========================================================

DO $d$
DECLARE v_mod uuid;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos WHERE path='estrutura-organizacional/colaboradores';
  IF v_mod IS NULL THEN RAISE EXCEPTION 'Modulo colaboradores nao encontrado.'; END IF;

  -- ══ COLAB-025: segundo vinculo ativo na MESMA empresa recusado ══
  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que a mesma pessoa NAO pode ter dois vinculos ativos na MESMA empresa. Regra: '
             || 'dentro de uma empresa, o CPF e chave unica de vinculo vigente — a pessoa nao pode figurar '
             || 'duas vezes ativa no mesmo lugar. Importa porque vinculo duplicado dobra a pessoa na folha '
             || 'e nos relatorios daquela empresa. Esta e a regra que o indice unico de vinculo (criado em '
             || 'jul/2026) protege.',
    pre_condicoes = 'Precisa existir uma empresa e uma pessoa ja com vinculo ativo nela.',
    passos = '[
      {"ordem":1,"acao":"Cadastrar a pessoa com vinculo ativo na empresa Alfa","onde_na_tela":"Novo Colaborador > Vinculo","dados":"Nome: Vinculo Unico Teste | CPF: 999.000.010-05 | Empresa: Alfa | Tipo: colaborador | Status: ativo","resultado_esperado":"Vinculo ativo criado na Alfa"},
      {"ordem":2,"acao":"Tentar adicionar um SEGUNDO vinculo ativo na MESMA Alfa, mesmo tipo","onde_na_tela":"Ficha do colaborador > Vinculos > Adicionar","dados":"Empresa: Alfa (a mesma) | Tipo: colaborador (o mesmo) | Status: ativo","resultado_esperado":"O sistema DEVE recusar o vinculo duplicado"}
    ]'::jsonb,
    resultado_esperado = 'O segundo vinculo ativo na mesma empresa e RECUSADO. A pessoa mantem exatamente 1 '
                       || 'vinculo vigente na Alfa. O indice unico segura.',
    observacoes = 'IMPACTO SE FALHAR: vinculo duplicado faz a folha processar a pessoa duas vezes na mesma '
                || 'empresa e a conta em dobro em relatorios de SST. Foi um problema real (133 duplicatas '
                || 'encontradas e corrigidas em jul/2026). Este caso guarda a correcao — falha na hora se o '
                || 'indice unico for removido.'
  WHERE codigo='COLAB-025';

  -- ══ COLAB-026: mesma pessoa em empresas DIFERENTES permitido ══
  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar a contraparte da regra: entre empresas DIFERENTES do mesmo cliente, nao ha '
             || 'restricao — a mesma pessoa pode ter vinculo ativo em cada uma. Regra: o limite de "um '
             || 'vinculo" vale por empresa, nao por pessoa. Importa para nao restringir demais: seria '
             || 'errado impedir alguem de atuar em duas empresas do grupo.',
    pre_condicoes = 'Precisam existir duas empresas (Alfa e Beta) no mesmo cliente.',
    passos = '[
      {"ordem":1,"acao":"Criar a pessoa com vinculo ativo na Alfa","onde_na_tela":"Novo Colaborador > Vinculo","dados":"Nome: Duas Empresas OK | CPF: 999.000.011-96 | Empresa: Alfa | Status: ativo","resultado_esperado":"Vinculo na Alfa criado"},
      {"ordem":2,"acao":"Adicionar vinculo ativo na Beta (empresa diferente)","onde_na_tela":"Ficha > Vinculos > Adicionar","dados":"Empresa: Beta | Status: ativo","resultado_esperado":"O vinculo na Beta e ACEITO (empresa diferente, sem restricao)"}
    ]'::jsonb,
    resultado_esperado = 'A pessoa tem 2 vinculos ativos, um na Alfa e um na Beta. O indice unico NAO barra '
                       || 'vinculos em empresas diferentes.',
    observacoes = 'IMPACTO SE FALHAR: se o sistema barrar por engano, um funcionario de duas empresas do '
                || 'grupo nao poderia ser registrado corretamente. Confirma que o indice unico e preciso '
                || '(barra so a MESMA empresa, nao qualquer segundo vinculo).'
  WHERE codigo='COLAB-026';

  -- ══ COLAB-027: vinculo suspenso ainda ocupa a vaga ══
  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que um vinculo SUSPENSO ainda ocupa a vaga: nao da para criar um novo vinculo '
             || 'ativo na mesma empresa enquanto o suspenso existe. Regra: suspensao e medida disciplinar '
             || 'sobre um vinculo vigente — a pessoa continua vinculada, so temporariamente afastada. '
             || 'Importa porque suspenso nao e desligado; a vaga ainda e dela.',
    pre_condicoes = 'Precisa existir uma pessoa com vinculo na empresa, com esse vinculo em status suspenso.',
    passos = '[
      {"ordem":1,"acao":"Criar a pessoa com vinculo na Alfa e coloca-lo como suspenso","onde_na_tela":"Ficha do colaborador > Vinculo > Status","dados":"Nome: Suspenso Teste | CPF: 999.000.012-87 | Empresa: Alfa | Status: suspenso","resultado_esperado":"Vinculo existe, em status suspenso"},
      {"ordem":2,"acao":"Tentar criar um NOVO vinculo ativo na mesma Alfa para a mesma pessoa","onde_na_tela":"Ficha > Vinculos > Adicionar","dados":"Empresa: Alfa | Status: ativo","resultado_esperado":"O sistema DEVE recusar — o vinculo suspenso ainda ocupa a vaga"}
    ]'::jsonb,
    resultado_esperado = 'O novo vinculo ativo e RECUSADO enquanto ha um vinculo suspenso na mesma empresa. '
                       || 'Suspenso conta como vigente para a regra de unicidade.',
    observacoes = 'IMPACTO SE FALHAR: se permitir, a pessoa teria um vinculo suspenso E um ativo na mesma '
                || 'empresa ao mesmo tempo — situacao incoerente que confunde folha (paga o ativo enquanto '
                || 'o suspenso deveria estar bloqueado) e distorce o headcount.'
  WHERE codigo='COLAB-027';

  -- ══ COLAB-028: fim da suspensao devolve a ativo sem colisao ══
  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que, ao terminar a suspensao, o vinculo volta a ativo sem erro. Regra: o indice '
             || 'unico nao pode transformar o retorno da suspensao em uma falsa colisao — voltar de '
             || 'suspenso para ativo e uma transicao valida do MESMO vinculo, nao a criacao de um novo. '
             || 'Importa porque a pessoa precisa poder retornar ao trabalho sem travar.',
    pre_condicoes = 'Precisa existir uma pessoa com vinculo suspenso na empresa (sem outro vinculo ativo la).',
    passos = '[
      {"ordem":1,"acao":"Ter a pessoa com vinculo suspenso na Alfa","onde_na_tela":"Ficha > Vinculo","dados":"Nome: Retorno Suspensao | CPF: 999.000.013-78 | Empresa: Alfa | Status: suspenso","resultado_esperado":"Vinculo suspenso existe"},
      {"ordem":2,"acao":"Mudar o status do MESMO vinculo de suspenso para ativo","onde_na_tela":"Ficha > Vinculo > alterar Status","dados":"Status: de suspenso para ativo","resultado_esperado":"O vinculo volta a ativo sem erro de duplicidade"}
    ]'::jsonb,
    resultado_esperado = 'O vinculo transita de suspenso para ativo com sucesso. A pessoa fica com 1 vinculo '
                       || 'ativo na Alfa. Nenhum erro de colisao no indice unico.',
    observacoes = 'IMPACTO SE FALHAR: se o retorno da suspensao desse erro de duplicidade, a pessoa nao '
                || 'conseguiria voltar ao trabalho pelo sistema — o RH ficaria travado. Este caso prova que '
                || 'a regra de unicidade distingue "novo vinculo" de "mudanca de status do mesmo vinculo".'
  WHERE codigo='COLAB-028';

  -- ══ COLAB-029: papel duplo permitido (dono + colaborador) ══
  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que a mesma pessoa pode ter dois PAPEIS diferentes na mesma empresa (ex.: dono '
             || 'que tambem e colaborador). Regra: a unicidade vale por PAPEL (tipo de vinculo), nao por '
             || 'pessoa — dono e colaborador sao vinculos de tipos diferentes, entao coexistem. Importa '
             || 'porque em pequenas empresas o socio muitas vezes tambem trabalha como funcionario.',
    pre_condicoes = 'Precisa existir uma empresa e uma pessoa que sera vinculada com dois papeis.',
    passos = '[
      {"ordem":1,"acao":"Criar a pessoa com vinculo de dono na Alfa","onde_na_tela":"Novo Colaborador > Vinculo","dados":"Nome: Dono e Funcionario | CPF: 999.000.014-69 | Empresa: Alfa | Tipo: dono | Status: ativo","resultado_esperado":"Vinculo de dono criado"},
      {"ordem":2,"acao":"Adicionar um segundo vinculo, tipo colaborador, na mesma Alfa","onde_na_tela":"Ficha > Vinculos > Adicionar","dados":"Empresa: Alfa (a mesma) | Tipo: colaborador (papel diferente) | Status: ativo","resultado_esperado":"ACEITO — papel diferente, mesmo sendo a mesma empresa"}
    ]'::jsonb,
    resultado_esperado = 'A pessoa tem 2 vinculos ativos na Alfa: um como dono, um como colaborador. A '
                       || 'unicidade barra papel repetido, nao papeis diferentes.',
    observacoes = 'IMPACTO SE FALHAR: se barrasse, o socio que tambem e funcionario nao poderia ter os dois '
                || 'papeis registrados — comum em pequenas empresas. Prova que o indice unico e por '
                || '(empresa + pessoa + TIPO), nao so (empresa + pessoa).'
  WHERE codigo='COLAB-029';

  -- ══ COLAB-035: desligamento preserva a pessoa e o historico ══
  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que desligar um colaborador encerra o vinculo mas NAO apaga a pessoa nem seu '
             || 'historico. Regra: desligamento muda o status do vinculo para inativo/desligado; a pessoa '
             || 'e todo o seu historico (documentos, ferias, ponto) permanecem. Importa porque o historico '
             || 'tem valor legal e pode ser necessario apos o desligamento (processos, readmissao).',
    pre_condicoes = 'Precisa existir uma pessoa com vinculo ativo e algum historico associado.',
    passos = '[
      {"ordem":1,"acao":"Ter uma pessoa com vinculo ativo na Alfa","onde_na_tela":"Ficha do colaborador","dados":"Nome: Desligado Teste | CPF: 999.000.015-50 | Empresa: Alfa | Status: ativo","resultado_esperado":"Colaborador ativo com vinculo"},
      {"ordem":2,"acao":"Desligar o colaborador","onde_na_tela":"Ficha > acao Desligar (ou mudar status do vinculo)","dados":"Status do vinculo: desligado/inativo | Data de desligamento: hoje","resultado_esperado":"Vinculo encerrado"},
      {"ordem":3,"acao":"Conferir que a pessoa ainda existe","onde_na_tela":"Colaboradores > filtro Desligados (ou busca)","dados":"Buscar a pessoa desligada","resultado_esperado":"A pessoa continua no sistema, com vinculo inativo e historico intacto"}
    ]'::jsonb,
    resultado_esperado = 'A pessoa continua existindo apos o desligamento, com o vinculo em status '
                       || 'desligado. O historico nao foi apagado. Ela pode ser encontrada nos desligados.',
    observacoes = 'IMPACTO SE FALHAR: se o desligamento apagasse a pessoa, perderia-se historico com valor '
                || 'legal (documentos, ferias, ponto) — problema em auditoria, processo trabalhista ou '
                || 'readmissao. Desligar deve ser encerrar, nunca deletar.'
  WHERE codigo='COLAB-035';

  -- ══ COLAB-036: readmissao reaproveita a pessoa ══
  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que readmitir alguem reaproveita a pessoa existente em vez de criar uma segunda '
             || 'com o mesmo CPF. Regra: a constraint de CPF unico impede duplicar a pessoa; readmissao e '
             || 'um novo vinculo (ou reativacao) sobre a MESMA pessoa. Importa porque criar uma segunda '
             || 'ficha para quem volta fragmenta o historico da pessoa em dois cadastros.',
    pre_condicoes = 'Precisa existir uma pessoa que foi desligada (vinculo inativo), com CPF conhecido.',
    passos = '[
      {"ordem":1,"acao":"Ter uma pessoa desligada no sistema","onde_na_tela":"Colaboradores > Desligados","dados":"Nome: Readmitido Teste | CPF: 999.000.016-41 | vinculo: desligado","resultado_esperado":"Pessoa existe, desligada"},
      {"ordem":2,"acao":"Readmitir usando o MESMO CPF","onde_na_tela":"Novo Colaborador (ou acao Readmitir) com o CPF existente","dados":"CPF: 999.000.016-41 (o mesmo da pessoa desligada)","resultado_esperado":"O sistema reconhece o CPF e reaproveita a pessoa, criando um novo vinculo ativo — NAO uma segunda pessoa"},
      {"ordem":3,"acao":"Conferir que ha so uma pessoa com aquele CPF","onde_na_tela":"Busca pelo CPF","dados":"Buscar 999.000.016-41","resultado_esperado":"Retorna UMA pessoa, agora com vinculo ativo e o historico anterior preservado"}
    ]'::jsonb,
    resultado_esperado = 'Existe UMA unica pessoa com aquele CPF, agora readmitida (vinculo ativo). O '
                       || 'historico da passagem anterior continua ligado a ela. Nenhuma segunda ficha foi '
                       || 'criada.',
    observacoes = 'IMPACTO SE FALHAR: se a readmissao criasse uma segunda pessoa com o mesmo CPF, o '
                || 'historico ficaria partido em dois cadastros — o tempo de casa, documentos e registros '
                || 'anteriores se desconectariam. A constraint de CPF unico e o que forca o reaproveitamento.'
  WHERE codigo='COLAB-036';

  RAISE NOTICE 'COLAB parte 2 detalhada: 025, 026, 027, 028, 029, 035, 036.';
END $d$;

SELECT codigo, left(objetivo,50) AS objetivo, jsonb_array_length(passos) AS passos,
       (observacoes IS NOT NULL) AS tem_impacto
FROM public.qa_casos_teste
WHERE codigo IN ('COLAB-025','COLAB-026','COLAB-027','COLAB-028','COLAB-029','COLAB-035','COLAB-036')
ORDER BY codigo;
