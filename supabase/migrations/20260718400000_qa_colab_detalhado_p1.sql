-- =========================================================
-- QA — Colaboradores DETALHADOS (modulo completo, padrao aprovado)
-- Parte 1 de 2: COLAB-002, 011, 012, 020, 022, 023, 024
-- (COLAB-001 e 021 ja foram detalhados no arquivo 20260718360000)
--
-- Cada caso: objetivo (regra + porque), pre_condicoes, passos com dados
-- exatos e caminho na tela, resultado_esperado e observacoes (impacto real
-- se falhar + correcao sugerida). Impacto baseado no objetivo real do caso.
-- =========================================================

DO $d$
DECLARE v_mod uuid;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos WHERE path='estrutura-organizacional/colaboradores';
  IF v_mod IS NULL THEN RAISE EXCEPTION 'Modulo colaboradores nao encontrado.'; END IF;

  -- ══ COLAB-002: busca por nome e CPF ══
  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que a busca de colaborador funciona pelos dois identificadores que o RH usa no '
             || 'dia a dia: nome (parcial) e CPF (com ou sem formatacao). Regra: a busca deve normalizar o '
             || 'CPF, entao "111.222.333-44" e "11122233344" encontram a mesma pessoa. Importa porque o RH '
             || 'localiza gente o tempo todo; se a busca falha, ele nao acha o colaborador para editar, '
             || 'desligar ou consultar.',
    pre_condicoes = 'Precisa existir um colaborador cadastrado com nome e CPF conhecidos para buscar.',
    passos = '[
      {"ordem":1,"acao":"Abrir a lista de colaboradores","onde_na_tela":"Menu lateral > Colaboradores","dados":"-","resultado_esperado":"Lista de colaboradores exibida com campo de busca no topo"},
      {"ordem":2,"acao":"Buscar por parte do nome","onde_na_tela":"Campo de busca (topo da lista)","dados":"Digitar: Testonildo","resultado_esperado":"O colaborador cujo nome contem Testonildo aparece nos resultados"},
      {"ordem":3,"acao":"Buscar pelo CPF sem formatacao","onde_na_tela":"Campo de busca","dados":"Digitar: 99900000188","resultado_esperado":"O mesmo colaborador aparece"},
      {"ordem":4,"acao":"Buscar pelo CPF com formatacao","onde_na_tela":"Campo de busca","dados":"Digitar: 999.000.001-88","resultado_esperado":"O mesmo colaborador aparece (a busca normaliza a pontuacao)"}
    ]'::jsonb,
    resultado_esperado = 'O colaborador e encontrado pelas 3 vias: nome parcial, CPF limpo e CPF formatado. '
                       || 'A busca por CPF ignora pontos e tracos.',
    observacoes = 'IMPACTO SE FALHAR: o RH nao localiza o colaborador. Se a busca por CPF nao normalizar, '
                || 'digitar o CPF com pontos (como aparece no documento) nao acha ninguem — o RH acha que a '
                || 'pessoa nao existe e pode cadastrar de novo, gerando duplicata.'
  WHERE codigo='COLAB-002';

  -- ══ COLAB-011: so campos obrigatorios ══
  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que o cadastro minimo (so os campos obrigatorios) e aceito, provando que os '
             || 'campos opcionais sao de fato opcionais. Regra: nome e email bastam; CPF, telefone, '
             || 'endereco e demais podem ficar em branco. Importa porque nem sempre o RH tem todos os '
             || 'dados na hora da admissao — precisa poder cadastrar com o minimo e completar depois.',
    pre_condicoes = 'Nenhuma alem de ter o formulario de cadastro disponivel.',
    passos = '[
      {"ordem":1,"acao":"Abrir novo colaborador","onde_na_tela":"Menu > Colaboradores > Novo Colaborador","dados":"-","resultado_esperado":"Formulario aberto"},
      {"ordem":2,"acao":"Preencher SO nome e email, deixar o resto em branco","onde_na_tela":"Campos Nome e Email","dados":"Nome: Ana Minima Teste | Email: ana.minima@exemplo.com.br | (sem CPF, sem telefone, sem endereco)","resultado_esperado":"O formulario aceita sem exigir os campos opcionais"},
      {"ordem":3,"acao":"Salvar","onde_na_tela":"Botao Salvar","dados":"-","resultado_esperado":"Colaborador criado com sucesso mesmo sem os opcionais"}
    ]'::jsonb,
    resultado_esperado = 'O colaborador Ana Minima Teste e criado apenas com nome e email. Os campos opcionais '
                       || 'ficam vazios e isso nao impede o cadastro.',
    observacoes = 'IMPACTO SE FALHAR: se o sistema exigir campos que deveriam ser opcionais, o RH nao '
                || 'consegue admitir alguem quando falta um dado (ex.: endereco ainda nao informado) — '
                || 'trava a admissao por burocracia desnecessaria.'
  WHERE codigo='COLAB-011';

  -- ══ COLAB-012: duas empresas ══
  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que a mesma pessoa pode ter vinculo em duas empresas do mesmo cliente. Regra: '
             || 'um grupo economico com varias empresas pode ter o mesmo funcionario atuando em mais de '
             || 'uma; cada atuacao e um vinculo separado. Importa porque e comum em grupos — o gestor que '
             || 'responde por duas empresas do grupo, por exemplo.',
    pre_condicoes = 'Precisam existir DUAS empresas cadastradas no mesmo cliente (ex.: Alfa e Beta).',
    passos = '[
      {"ordem":1,"acao":"Cadastrar a pessoa e vincular a primeira empresa","onde_na_tela":"Novo Colaborador > secao Vinculo","dados":"Nome: Multi Empresa Teste | CPF: 999.000.006-92 | Empresa: Alfa | Tipo: colaborador","resultado_esperado":"Colaborador criado com vinculo na Alfa"},
      {"ordem":2,"acao":"No mesmo colaborador, adicionar um segundo vinculo","onde_na_tela":"Ficha do colaborador > Vinculos > Adicionar vinculo","dados":"Empresa: Beta | Tipo: colaborador | Status: ativo","resultado_esperado":"O segundo vinculo e aceito"},
      {"ordem":3,"acao":"Conferir os vinculos da pessoa","onde_na_tela":"Ficha do colaborador > aba Vinculos","dados":"-","resultado_esperado":"A pessoa tem 2 vinculos ativos: um na Alfa, um na Beta"}
    ]'::jsonb,
    resultado_esperado = 'Uma unica pessoa (mesmo CPF) com exatamente 2 vinculos ativos, um em cada empresa. '
                       || 'Nao foram criadas duas pessoas.',
    observacoes = 'IMPACTO SE FALHAR: se o sistema recusar o segundo vinculo, um funcionario que atua em '
                || 'duas empresas do grupo nao pode ser registrado corretamente — ou o RH cria uma pessoa '
                || 'duplicada (CPF repetido) para contornar, sujando a base.'
  WHERE codigo='COLAB-012';

  -- ══ COLAB-020: CPF duplicado recusado ══
  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que cadastrar um CPF ja existente no mesmo cliente e recusado, E que o erro e '
             || 'legivel para o RH. Regra: dentro de um cliente, o CPF identifica unicamente a pessoa — '
             || 'nao pode haver dois cadastros com o mesmo CPF. Importa porque CPF duplicado gera pessoas '
             || 'fantasma, confunde folha e relatorios.',
    pre_condicoes = 'Precisa existir um colaborador ja cadastrado com um CPF conhecido.',
    passos = '[
      {"ordem":1,"acao":"Cadastrar um colaborador com um CPF","onde_na_tela":"Novo Colaborador","dados":"Nome: Primeiro | CPF: 529.982.247-25","resultado_esperado":"Cadastrado com sucesso"},
      {"ordem":2,"acao":"Tentar cadastrar OUTRA pessoa com o MESMO CPF","onde_na_tela":"Novo Colaborador","dados":"Nome: Segundo (pessoa diferente) | CPF: 529.982.247-25 (mesmo do primeiro)","resultado_esperado":"O sistema DEVE recusar"},
      {"ordem":3,"acao":"Ler a mensagem de erro","onde_na_tela":"Mensagem exibida ao salvar","dados":"-","resultado_esperado":"Mensagem clara, ex.: CPF ja cadastrado neste cliente"}
    ]'::jsonb,
    resultado_esperado = 'O segundo cadastro e recusado com uma mensagem legivel. So existe uma pessoa com '
                       || 'aquele CPF no cliente.',
    observacoes = 'IMPACTO SE FALHAR: CPF duplicado cria duas fichas para a mesma pessoa. A folha pode '
                || 'pagar duas vezes, relatorios de SST contam a pessoa em dobro, e o eSocial rejeita. '
                || 'Esta protecao existe no banco (indice unico) — o caso confirma que segue de pe.'
  WHERE codigo='COLAB-020';

  -- ══ COLAB-022: campo obrigatorio vazio ══
  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que o sistema nao deixa criar uma pessoa sem a identidade minima (nome). '
             || 'Regra: nome e obrigatorio (NOT NULL no banco). Importa porque uma pessoa sem nome e um '
             || 'registro inutil que polui a base e quebra telas que esperam exibir o nome.',
    pre_condicoes = 'Nenhuma.',
    passos = '[
      {"ordem":1,"acao":"Abrir novo colaborador","onde_na_tela":"Menu > Colaboradores > Novo Colaborador","dados":"-","resultado_esperado":"Formulario aberto"},
      {"ordem":2,"acao":"Deixar o nome em branco e tentar salvar","onde_na_tela":"Campo Nome (vazio) + botao Salvar","dados":"Nome: (vazio) | Email: alguem@exemplo.com.br","resultado_esperado":"O sistema DEVE recusar e sinalizar que o nome e obrigatorio"}
    ]'::jsonb,
    resultado_esperado = 'O cadastro e recusado. Nenhuma pessoa sem nome e criada.',
    observacoes = 'IMPACTO SE FALHAR: uma pessoa sem nome aparece em branco nas listas, relatorios e '
                || 'vinculos — o RH nao sabe quem e, e telas que exibem o nome podem quebrar.'
  WHERE codigo='COLAB-022';

  -- ══ COLAB-023: email duplicado ══
  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que um e-mail ja em uso no cliente nao pode ser reutilizado por outra pessoa. '
             || 'Regra: o e-mail e a chave de acesso (login e convite) do colaborador; duas pessoas com o '
             || 'mesmo e-mail geram ambiguidade de identidade. Importa porque o login e o convite dependem '
             || 'do e-mail ser unico.',
    pre_condicoes = 'Precisa existir um colaborador ja cadastrado com um e-mail conhecido.',
    passos = '[
      {"ordem":1,"acao":"Cadastrar um colaborador com um e-mail","onde_na_tela":"Novo Colaborador","dados":"Nome: Dono do Email | Email: repetido@exemplo.com.br","resultado_esperado":"Cadastrado"},
      {"ordem":2,"acao":"Tentar cadastrar OUTRA pessoa com o MESMO e-mail","onde_na_tela":"Novo Colaborador","dados":"Nome: Outra Pessoa | Email: repetido@exemplo.com.br (mesmo do primeiro)","resultado_esperado":"O sistema DEVE recusar"}
    ]'::jsonb,
    resultado_esperado = 'O segundo cadastro e RECUSADO. So uma pessoa usa aquele e-mail no cliente. '
                       || 'ACHADO ATUAL: o banco ACEITA e-mail duplicado — nao ha restricao unica em '
                       || 'email_principal. Duas pessoas podem acabar com o mesmo login.',
    observacoes = 'IMPACTO SE FALHAR (e falha hoje): com dois colaboradores no mesmo e-mail, o convite e o '
                || 'login ficam ambiguos — o sistema nao sabe qual pessoa autenticar. CORRECAO SUGERIDA: '
                || 'criar indice unico em (tenant_id, lower(email_principal)) onde email nao e nulo, apos '
                || 'checar duplicatas existentes.'
  WHERE codigo='COLAB-023';

  -- ══ COLAB-024: isolamento entre clientes ══
  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que um colaborador de um cliente e completamente invisivel para outro cliente. '
             || 'Regra: cada cliente (tenant) so enxerga os seus proprios dados — a fronteira multi-tenant '
             || 'e absoluta. Importa porque vazamento aqui e um incidente de LGPD: dados pessoais de uma '
             || 'empresa apareceriam para outra.',
    pre_condicoes = 'Precisam existir dois clientes distintos no sistema (o teste usa dois ambientes de '
                  || 'teste isolados).',
    passos = '[
      {"ordem":1,"acao":"No cliente A, cadastrar um colaborador","onde_na_tela":"Cliente A > Novo Colaborador","dados":"Nome: Secreto do Cliente A | CPF: 999.000.001-88","resultado_esperado":"Cadastrado no cliente A"},
      {"ordem":2,"acao":"Entrar como cliente B e buscar esse colaborador","onde_na_tela":"Cliente B > Colaboradores > busca","dados":"Buscar pelo nome ou CPF do colaborador do cliente A","resultado_esperado":"O colaborador do cliente A NAO aparece para o cliente B"}
    ]'::jsonb,
    resultado_esperado = 'O colaborador cadastrado no cliente A e invisivel no cliente B. A busca no cliente '
                       || 'B nao retorna nada. Zero vazamento entre clientes.',
    observacoes = 'IMPACTO SE FALHAR: seria um vazamento de dados pessoais entre clientes — incidente '
                || 'grave de LGPD, com risco legal e de reputacao. Esta protecao (RLS por tenant) e a mais '
                || 'critica do sistema; o caso a verifica a cada bateria.'
  WHERE codigo='COLAB-024';

  RAISE NOTICE 'COLAB parte 1 detalhada: 002, 011, 012, 020, 022, 023, 024.';
END $d$;

SELECT codigo, left(objetivo, 55) AS objetivo_inicio,
       jsonb_array_length(passos) AS qtd_passos
FROM public.qa_casos_teste
WHERE codigo IN ('COLAB-002','COLAB-011','COLAB-012','COLAB-020','COLAB-022','COLAB-023','COLAB-024')
ORDER BY codigo;
