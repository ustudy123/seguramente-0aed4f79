-- =========================================================
-- QA — PADRÃO DE CASO DE TESTE DETALHADO (referência)
--
-- Corrige uma falha real: os casos estavam rasos demais para um humano
-- entender e um dev corrigir. Este arquivo estabelece o PADRAO de um caso
-- bem detalhado, aplicado a 2 casos de Colaboradores como referencia:
--   - COLAB-001 (um caminho feliz)
--   - COLAB-021 (um achado — CPF invalido)
--
-- O que muda: o campo 'passos' (JSONB) passa a carregar, em cada passo:
--   ordem        — numero do passo
--   acao         — o que fazer, em linguagem clara
--   dados        — os VALORES exatos a usar (o que preencher)
--   onde_na_tela — o caminho na interface (menu > botao > campo)
--   resultado_esperado — o que deve acontecer naquele passo
-- E os campos do caso ganham profundidade:
--   objetivo      — o que o caso verifica E POR QUE importa (a regra)
--   pre_condicoes — o que precisa existir antes de comecar
--   resultado_esperado — o criterio final de aprovacao
--   observacoes   — o impacto no negocio se este caso falhar
--
-- Depois de aprovado este padrao, ele se replica nos demais modulos.
-- =========================================================

DO $enriquece$
DECLARE v_mod uuid;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos WHERE path='estrutura-organizacional/colaboradores';
  IF v_mod IS NULL THEN RAISE EXCEPTION 'Modulo colaboradores nao encontrado.'; END IF;

  -- ─────────────────────────────────────────────────────
  -- COLAB-001 — caminho feliz, agora DETALHADO
  -- ─────────────────────────────────────────────────────
  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que um colaborador novo pode ser cadastrado e vinculado a uma empresa. '
             || 'Regra: todo colaborador precisa de nome e email; o vinculo liga a pessoa a uma empresa '
             || 'com um tipo (colaborador, estagiario, etc). Importa porque este e o fluxo de entrada de '
             || 'toda pessoa no sistema — se falhar, ninguem consegue ser admitido.',
    pre_condicoes = 'Precisa existir pelo menos uma empresa cadastrada no cliente (ex.: a empresa "Alfa"). '
                  || 'O usuario logado precisa ter permissao de RH ou gestor.',
    passos = '[
      {
        "ordem": 1,
        "acao": "Abrir o cadastro de novo colaborador",
        "onde_na_tela": "Menu lateral > Colaboradores > botao \"Novo Colaborador\" (canto superior direito)",
        "dados": "-",
        "resultado_esperado": "Abre o formulario de cadastro com os campos vazios"
      },
      {
        "ordem": 2,
        "acao": "Preencher os dados basicos do colaborador",
        "onde_na_tela": "Campos \"Nome completo\" e \"Email\" do formulario",
        "dados": "Nome: Maria Aparecida Teste | Email: maria.teste@exemplo.com.br | CPF: 529.982.247-25 (valido)",
        "resultado_esperado": "Os campos aceitam os valores sem erro de validacao"
      },
      {
        "ordem": 3,
        "acao": "Vincular o colaborador a uma empresa",
        "onde_na_tela": "Secao \"Vinculo\" > campo \"Empresa\" (selecionar) e \"Tipo de vinculo\"",
        "dados": "Empresa: Alfa | Tipo de vinculo: colaborador | Status: ativo",
        "resultado_esperado": "A empresa aparece na lista e pode ser selecionada"
      },
      {
        "ordem": 4,
        "acao": "Salvar o cadastro",
        "onde_na_tela": "Botao \"Salvar\" no rodape do formulario",
        "dados": "-",
        "resultado_esperado": "Mensagem de sucesso; o colaborador aparece na lista com 1 vinculo ativo"
      }
    ]'::jsonb,
    resultado_esperado = 'O colaborador Maria Aparecida Teste existe no sistema, com exatamente 1 vinculo '
                       || 'ativo na empresa Alfa, tipo colaborador. Consultando a lista de colaboradores, '
                       || 'ele aparece. O CPF valido foi aceito.',
    observacoes = 'IMPACTO SE FALHAR: e o fluxo de entrada de pessoas no sistema. Se quebrar, o RH nao '
                || 'consegue admitir ninguem — bloqueia a operacao inteira do cliente.'
  WHERE codigo = 'COLAB-001';

  -- ─────────────────────────────────────────────────────
  -- COLAB-021 — o achado (CPF invalido), agora DETALHADO
  -- ─────────────────────────────────────────────────────
  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que o sistema NAO aceita um CPF matematicamente invalido. '
             || 'Regra: o CPF tem digitos verificadores que seguem um calculo; "111.111.111-11" tem o '
             || 'formato certo mas e invalido. Importa porque CPF invalido contamina eSocial, relatorios '
             || 'de SST e a identificacao legal do trabalhador — pode gerar multa e retrabalho.',
    pre_condicoes = 'Precisa existir uma empresa para vincular o colaborador. '
                  || 'Este teste tenta cadastrar com um CPF proposital invalido.',
    passos = '[
      {
        "ordem": 1,
        "acao": "Abrir o cadastro de novo colaborador",
        "onde_na_tela": "Menu lateral > Colaboradores > botao \"Novo Colaborador\"",
        "dados": "-",
        "resultado_esperado": "Formulario de cadastro aberto"
      },
      {
        "ordem": 2,
        "acao": "Preencher nome e email validos, mas um CPF INVALIDO",
        "onde_na_tela": "Campos \"Nome\", \"Email\" e \"CPF\"",
        "dados": "Nome: Joao CPF Invalido | Email: joao.cpf@exemplo.com.br | CPF: 111.111.111-11 (invalido de proposito)",
        "resultado_esperado": "Ao sair do campo CPF, a tela DEVERIA mostrar erro \"CPF invalido\""
      },
      {
        "ordem": 3,
        "acao": "Tentar salvar o cadastro mesmo com o CPF invalido",
        "onde_na_tela": "Botao \"Salvar\"",
        "dados": "-",
        "resultado_esperado": "O sistema DEVE recusar e nao gravar o colaborador com CPF invalido"
      }
    ]'::jsonb,
    resultado_esperado = 'O cadastro e RECUSADO. O colaborador com CPF "111.111.111-11" NAO deve existir no '
                       || 'banco. ACHADO ATUAL: o banco aceita — a validacao de CPF so existe no front-end '
                       || '(a funcao validar_cpf nao esta aplicada como trigger na tabela usuarios_base). '
                       || 'Por importacao de planilha ou API, um CPF invalido entra sem barreira.',
    observacoes = 'IMPACTO SE FALHAR (e falha hoje): CPF invalido no banco quebra integracao com eSocial '
                || '(rejeicao pela Receita), gera erro em relatorios legais de SST e compromete a '
                || 'identificacao do trabalhador. CORRECAO SUGERIDA: aplicar validar_cpf() como trigger '
                || 'BEFORE INSERT OR UPDATE em usuarios_base, reusando a logica que ja existe no front.'
  WHERE codigo = 'COLAB-021';

  RAISE NOTICE 'COLAB-001 e COLAB-021 enriquecidos com o padrao detalhado.';
END $enriquece$;

-- Mostra o antes/depois: um caso detalhado por completo
SELECT codigo, jsonb_pretty(passos) AS passos_detalhados
FROM public.qa_casos_teste WHERE codigo = 'COLAB-021';
