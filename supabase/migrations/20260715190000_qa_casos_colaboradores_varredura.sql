-- =========================================================
-- QA — Colaboradores: o que a varredura da base provou (jul/2026)
--
-- Três sessões documentaram um "bug de duplicação de colaborador por
-- reimportação de planilha, causado por CPF não normalizado". A varredura
-- mediu a base real. NENHUMA das duas hipóteses sobreviveu.
--
--   CPF duplicado só por formatação ....... 0 ocorrências
--   Pares (empresa, pessoa) duplicados .... 136
--   Pessoas envolvidas nos 136 ............ 5
--
-- Cinco pessoas em 129 empresas. Planilha duplica MUITAS pessoas em UMA
-- empresa. O dado é o inverso exato. Não é importação, e não é colaborador.
--
-- Quem são os 136:
--
--   Marina (gestor)   69 empresas x 2 vínculos = 138
--   Maike  (gestor)   61 empresas x 2 vínculos = 122
--   Cassiano (gestor)  2 empresas x 2          =   4
--   Alexandre (auditor) 1 empresa x 2          =   2
--   João (administrador) 3 empresas x 2        =   6
--
-- Todos os 136 pares têm exatamente 2 vínculos. Nunca 3. Assinatura de
-- rotina que rodou DUAS vezes, não de erro humano acumulado.
--
-- Marina e Maike: primeira cópia em 26/05 ~21:10, segunda em 12/06 15:04 —
-- 130 vínculos no MESMO MINUTO. Ambas tipo_usuario = 'gestor'. A trigger
-- auto_vincular_admins_nova_empresa só vincula 'administrador', e nenhuma
-- migration do repositório cria vínculo de gestor em massa.
--
--   => A rotina que gerou 130 das 136 duplicatas NÃO EXISTE NO REPOSITÓRIO.
--      Foi rodada direto no SQL Editor. É o caminho de escrita que não
--      deixa rastro, não passa por review e não tem guarda. A duplicação
--      não veio do produto — veio da operação.
--
-- Alexandre (auditor): 2 vínculos com 22 SEGUNDOS de diferença. Isso é
-- duplo clique na tela. É o único dos cinco que é bug de produto, e prova
-- que a tela também escreve sem guarda (ver COLAB-037).
--
-- João (administrador): 3 pares com tipo_vinculo DIFERENTE —
-- 'administrador' + 'colaborador', um deles com observação "Vínculo criado
-- automaticamente ao cadastrar a empresa" (a trigger). Isso NÃO é duplicata:
-- é o dono da conta que também é funcionário. Papel duplo legítimo.
--
--   => A CHAVE DO ÍNDICE MUDA. Tem que incluir tipo_vinculo:
--
--   CREATE UNIQUE INDEX usuario_vinculos_vigente_uidx
--     ON public.usuario_vinculos(empresa_id, usuario_id, tipo_vinculo)
--     WHERE status IN ('ativo','pendente','suspenso');
--
--      Sem tipo_vinculo na chave, o caso do João quebra: ou a tela recusa
--      o dono como colaborador, ou o ON CONFLICT DO NOTHING da trigger
--      engole o vínculo em silêncio. A regra "não duplicar CPF na empresa"
--      vale POR PAPEL — ninguém é colaborador duas vezes na mesma empresa.
--
-- Achado colateral que segue de pé: o ON CONFLICT DO NOTHING da trigger é
-- no-op sem índice único. A guarda foi escrita e é decorativa desde maio.
-- Criar o índice não restringe a trigger — faz a linha significar o que o
-- autor quis dizer.
-- =========================================================

DO $seed$
DECLARE
  v_mod uuid;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos
  WHERE path = 'estrutura-organizacional/colaboradores';

  IF v_mod IS NULL THEN
    RAISE EXCEPTION 'Módulo estrutura-organizacional/colaboradores não encontrado.';
  END IF;

  INSERT INTO public.qa_casos_teste
    (modulo_id, codigo, titulo, tipo, prioridade, status, nivel, objetivo, pre_condicoes, passos, resultado_esperado, observacoes)
  VALUES

  (v_mod, 'COLAB-029', 'Papel duplo na mesma empresa é permitido (dono que também é colaborador)',
   'alternativo', 'critica', 'aprovado', 'api',
   'A regra de não duplicar vale por PAPEL, não por pessoa. O dono da conta pode ser administrador e colaborador da mesma empresa — são funções distintas, não duplicata.',
   'Empresa A recém-cadastrada. A trigger auto_vincular_admins_nova_empresa já criou o vínculo administrador do dono.',
   '[{"ordem":1,"acao":"Conferir o vínculo criado pela trigger","resultado_esperado":"1 vínculo tipo administrador, observação: Vínculo criado automaticamente ao cadastrar a empresa"},
     {"ordem":2,"acao":"Cadastrar a MESMA pessoa como colaboradora da empresa A","resultado_esperado":"Aceito — papel diferente, não é duplicata"},
     {"ordem":3,"acao":"Contar vínculos vigentes de (empresa A, pessoa)","resultado_esperado":"2 — um administrador, um colaborador"},
     {"ordem":4,"acao":"Tentar cadastrar a pessoa como colaboradora DE NOVO na empresa A","resultado_esperado":"Recusado — este sim é duplicata: mesmo papel, mesma empresa"},
     {"ordem":5,"acao":"Listar colaboradores da empresa A","resultado_esperado":"A pessoa aparece UMA vez, no papel de colaborador"}]'::jsonb,
   'Chave de unicidade é (empresa, pessoa, papel). Papéis diferentes convivem; papel repetido não.',
   'CASO REAL, medido na base: 3 dos 136 pares duplicados são exatamente isto (administrador + colaborador). Não são bug — são o motivo de tipo_vinculo entrar na chave do índice. Sem ele, este caso quebra silenciosamente: o ON CONFLICT DO NOTHING da trigger engoliria o segundo vínculo sem erro.'),

  (v_mod, 'COLAB-037', 'Duplo clique no cadastro não cria dois vínculos',
   'negativo', 'alta', 'aprovado', 'e2e',
   'A tela é caminho de escrita sem guarda. Submissão dupla em segundos gera vínculo duplicado.',
   'Formulário de vínculo preenchido, ainda não submetido.',
   '[{"ordem":1,"acao":"Clicar em salvar duas vezes em sequência rápida (< 2s)","resultado_esperado":"O botão desabilita na primeira submissão"},
     {"ordem":2,"acao":"Contar vínculos vigentes de (empresa, pessoa, papel)","resultado_esperado":"Exatamente 1"},
     {"ordem":3,"acao":"Repetir com a rede lenta (throttle 3G)","resultado_esperado":"Continua 1 — a proteção não depende da latência"}]'::jsonb,
   'Uma submissão, um vínculo, independente de quantos cliques.',
   'CASO REAL, medido na base: um usuário auditor tem 2 vínculos criados com 22 SEGUNDOS de diferença, mesmo papel, mesma empresa. É duplo clique. Botão desabilitado resolve o sintoma; o índice único do COLAB-025 resolve a causa — a tela escreve sem nenhuma trava no banco.')

  ON CONFLICT (codigo) DO NOTHING;

  -- COLAB-033: o CPF está inocente. A varredura não achou UMA ocorrência.
  UPDATE public.qa_casos_teste
  SET observacoes = 'HIPÓTESE DERRUBADA (jul/2026). Este caso acusava a falta de normalização de CPF como provável causa-raiz do bug de duplicação. A varredura da base retornou ZERO CPFs que dupliquem só por formatação — usuarios_base_cpf_tenant_uidx sempre protegeu a pessoa. A duplicação nunca foi da PESSOA, era do VÍNCULO (ver COLAB-025). Normalizar CPF continua valendo como higiene preventiva, mas rebaixado de crítico para médio: é porta que está fechada, não porta arrombada.',
      prioridade = 'media'
  WHERE codigo = 'COLAB-033';

  -- COLAB-034: sem CPF é design, não buraco. A regra estava mal escrita.
  UPDATE public.qa_casos_teste
  SET observacoes = 'REFORMULADO (jul/2026) após medir a base: 20 pessoas sem CPF, sendo 18 administrador e 2 gestor. ZERO colaboradores. Não é buraco — é design: usuário de sistema não tem por que ter CPF, e o índice parcial WHERE cpf IS NOT NULL está correto. A regra não é "sem CPF duplica livre", é "tipo_usuario = colaborador exige CPF". Hoje isso se cumpre. O caso deve testar a REGRA (colaborador sem CPF é recusado), não o buraco imaginário.'
  WHERE codigo = 'COLAB-034';

  -- COLAB-025 e COLAB-027: a chave ganha tipo_vinculo. Terceira correção,
  -- e desta vez com número da base atrás, não leitura de schema.
  UPDATE public.qa_casos_teste
  SET observacoes = 'GAP ESTRUTURAL CONFIRMADO NA BASE: 136 pares (empresa, pessoa) com vínculo vigente duplicado, todos com exatamente 2. CHAVE CORRIGIDA (3a versão) — CREATE UNIQUE INDEX usuario_vinculos_vigente_uidx ON usuario_vinculos(empresa_id, usuario_id, tipo_vinculo) WHERE status IN (ativo, pendente, suspenso). tipo_vinculo entrou na chave porque 3 dos 136 pares são papel duplo legítimo (COLAB-029) e seriam bloqueados indevidamente. Histórico das correções: v1 propunha (empresa, pessoa) WHERE status = ativo — errado duas vezes (predicado e chave). Criar o índice exige limpar 133 duplicatas antes. A trigger auto_vincular_admins_nova_empresa já tem ON CONFLICT DO NOTHING, que é no-op hoje e passa a funcionar assim que o índice existir.'
  WHERE codigo IN ('COLAB-025','COLAB-027');

  RAISE NOTICE 'Varredura aplicada: CPF inocentado, chave do índice corrigida para (empresa, pessoa, papel).';
END $seed$;
