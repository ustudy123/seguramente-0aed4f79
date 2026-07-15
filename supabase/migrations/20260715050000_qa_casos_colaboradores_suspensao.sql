-- =========================================================
-- QA — Colaboradores: suspensão é vínculo VIGENTE
--
-- Regra de negócio confirmada (jul/2026):
--   "Suspenso é aplicado para um colaborador que TEM vínculo ativo e está
--    sofrendo medida disciplinar (advertências seguidas por suspensão).
--    Ao concluir o período de suspensão volta a ficar ativo.
--    Há também o colaborador que teve vínculo encerrado e posteriormente
--    poderá trabalhar novamente, gerando um NOVO vínculo."
--
-- Consequência direta: 'suspenso' NÃO é um vínculo extinto. É o mesmo
-- vínculo, vigente, num estado disciplinar temporário (CLT art. 474 —
-- suspensão disciplinar não passa de 30 dias corridos, sob pena de ser
-- considerada rescisão injusta; o contrato permanece em vigor).
--
-- Isso INVALIDA o predicado proposto em COLAB-025:
--
--   WHERE status = 'ativo'          ← ERRADO
--
-- Com esse predicado o índice não indexa a linha suspensa. Duas falhas
-- encadeadas, e a segunda é pior que a primeira:
--
--   1) PERMITE a duplicata: pessoa suspensa na empresa A + novo vínculo
--      ativo na empresa A → só 1 linha indexada → passa. A pessoa fica
--      duas vezes no quadro da empresa A. É exatamente o que a regra proíbe.
--
--   2) VIRA BOMBA-RELÓGIO: quando a suspensão termina e o vínculo volta
--      a 'ativo', aí sim viram 2 linhas indexadas → unique violation. O
--      erro estoura no RETORNO DA SUSPENSÃO, semanas depois, longe da
--      causa. O colaborador não consegue voltar. Quem debugar vai olhar
--      para o fluxo de retorno, que está correto.
--
-- Predicado correto — a fronteira é VIGENTE x EXTINTO, não ativo x resto:
--
--   CREATE UNIQUE INDEX usuario_vinculos_vigente_uidx
--     ON public.usuario_vinculos(empresa_id, usuario_id)
--     WHERE status IN ('ativo','pendente','suspenso');
--
--   vigente → ativo, pendente, suspenso   (a pessoa é do quadro da empresa)
--   extinto → encerrado, revogado, expirado (readmissão gera vínculo NOVO)
--
-- Com ele: suspenso→ativo não altera o conjunto indexado (ambos dentro),
-- então o retorno da suspensão nunca colide. E a readmissão do COLAB-036
-- segue livre, porque o vínculo velho fica 'encerrado', fora do índice.
--
-- EM ABERTO: 'pendente', 'revogado' e 'expirado' são leitura minha, não
-- confirmação do cliente. A varredura mede os dois predicados antes de
-- qualquer índice ser criado.
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

  (v_mod, 'COLAB-027', 'Vínculo suspenso ainda ocupa a vaga: novo vínculo ativo é recusado',
   'negativo', 'critica', 'aprovado', 'api',
   'Suspensão é medida disciplinar sobre um vínculo vigente. A pessoa continua sendo colaboradora da empresa, então não pode ser cadastrada de novo enquanto estiver suspensa.',
   'COLAB-001 executado. Vínculo da pessoa na empresa A movido para status suspenso (medida disciplinar).',
   '[{"ordem":1,"acao":"Confirmar que o vínculo da pessoa na empresa A está suspenso","resultado_esperado":"1 vínculo, status suspenso"},
     {"ordem":2,"acao":"Tentar criar um novo vínculo ATIVO da mesma pessoa na MESMA empresa A","resultado_esperado":"Recusado — a pessoa já é colaboradora desta empresa, ainda que suspensa"},
     {"ordem":3,"acao":"Ler a mensagem exibida","resultado_esperado":"Erro em português distinguindo suspensão de desligamento: a pessoa possui vínculo vigente (suspenso), não encerrado"},
     {"ordem":4,"acao":"Contar vínculos vigentes de (empresa A, pessoa)","resultado_esperado":"Exatamente 1"},
     {"ordem":5,"acao":"Repetir pela importação de planilha, com o CPF da pessoa suspensa na empresa A","resultado_esperado":"Recusado ou consolidado em 1 — a planilha não é rota alternativa"}]'::jsonb,
   'Enquanto o vínculo estiver vigente (ativo, pendente ou suspenso), a vaga daquela pessoa na empresa está ocupada.',
   'Corrige o predicado do COLAB-025. Índice apenas em status = ativo deixaria este caso passar: a linha suspensa não seria indexada. A fronteira é VIGENTE x EXTINTO. Suspensão disciplinar (CLT art. 474) mantém o contrato em vigor — não é desligamento.'),

  (v_mod, 'COLAB-028', 'Fim da suspensão devolve o vínculo a ativo sem colisão',
   'alternativo', 'critica', 'aprovado', 'api',
   'Provar que o índice único não transforma o retorno da suspensão em erro — a falha mais cara seria o colaborador não conseguir voltar.',
   'COLAB-027 executado: pessoa com vínculo suspenso na empresa A e nenhuma duplicata criada.',
   '[{"ordem":1,"acao":"Concluído o período disciplinar, mover o vínculo de suspenso para ativo","resultado_esperado":"Aceito — sem unique violation"},
     {"ordem":2,"acao":"Contar vínculos vigentes de (empresa A, pessoa)","resultado_esperado":"Exatamente 1, agora ativo"},
     {"ordem":3,"acao":"Conferir que é o MESMO vínculo, não um novo","resultado_esperado":"Mesmo id, mesma data_inicio — a suspensão não rompeu o contrato"},
     {"ordem":4,"acao":"Conferir o histórico em usuario_audit_log","resultado_esperado":"Transição ativo→suspenso→ativo registrada no mesmo vínculo"}]'::jsonb,
   'A suspensão é um estado do vínculo, não uma interrupção dele. O retorno é um UPDATE, não um INSERT.',
   'Este caso é a razão de o predicado ser vigente e não ativo. Com WHERE status = ativo, suspenso→ativo ADICIONA linha ao índice: se alguém tivesse duplicado durante a suspensão, o erro estouraria aqui — no retorno, longe da causa. Com o predicado vigente, o conjunto indexado não muda na transição e o retorno é sempre limpo.')

  ON CONFLICT (codigo) DO NOTHING;

  -- COLAB-025 nasceu com o predicado errado. A regra do cliente corrigiu.
  UPDATE public.qa_casos_teste
  SET observacoes = 'GAP ESTRUTURAL: usuario_vinculos não tem índice único (só _usuario_idx, _empresa_idx, _tenant_idx, todos comuns). Hoje nada impede a duplicata. Correção proposta — PREDICADO CORRIGIDO em jul/2026 após confirmação da regra: CREATE UNIQUE INDEX usuario_vinculos_vigente_uidx ON usuario_vinculos(empresa_id, usuario_id) WHERE status IN (ativo, pendente, suspenso). A versão anterior deste caso propunha WHERE status = ativo, que estava ERRADA: deixava passar duplicata durante suspensão e estourava no retorno (ver COLAB-027 e COLAB-028). Chave por empresa_id preserva COLAB-026; predicado parcial preserva a readmissão do COLAB-036. Passo 4 é essencial: a regra tem que valer nas duas rotas de entrada.'
  WHERE codigo = 'COLAB-025';

  RAISE NOTICE 'Suspensão documentada como vínculo vigente (COLAB-027, COLAB-028); predicado do COLAB-025 corrigido.';
END $seed$;
