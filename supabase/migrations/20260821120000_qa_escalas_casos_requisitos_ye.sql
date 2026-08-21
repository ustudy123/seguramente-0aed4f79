-- =========================================================
-- QA — Escalas, Banco de Horas e Ausências/Atestados: casos derivados da
-- Análise de Requisitos do módulo (documento YE-DP-ESC-001, Google Doc
-- "YE — Escalas, Banco de Horas e Ausências/Atestados — Análise de
-- Requisitos", data-base ago/2026).
--
-- ESCOPO DO DOCUMENTO: aprofundamento do PONTO — a camada de REGRAS entre
-- as marcações e a Folha: escalas (12x36, 6x1, turnos, revezamento),
-- compensação/banco de horas (regimes e prazos), DSR, adicional noturno,
-- intervalos, ausências legais (CLT art. 473) e atestados médicos.
--
-- JÁ COBERTO (referência cruzada, sem duplicar) — a família PONTO é a
-- mais extensa do motor e este documento a fecha:
--   12x36: ciclo, feriado e prorrogação ......... PONTO-150/151
--   Escala: vigência e troca de parâmetro ....... PONTO-152/153
--   Banco: instrumento, prazos, conversão,
--     limite de 10h, rescisão, acúmulo ......... PONTO-170..175 / 354..356
--   HE: 50%, jornada real, limite de 2h ........ PONTO-090..093
--   Adicional noturno + hora ficta ............. PONTO-110..113
--   Intervalos intra/interjornada .............. PONTO-060..064 / 080
--   DSR: perda por falta, semana sem repouso ... PONTO-132/133
--   HE reflete no DSR (Súmula 172) ............. FOLHA-022
--   Doença >15 dias: empresa 15, INSS 16º ...... AFAST-020..022
--   Ausências do art. 473 (rol e prazos) ....... AFAST-050
--   CID sob sigilo com log de acesso ........... AFAST-080
--   Atestado: registrar e recuperar ............ ATE-001
--
-- BASE JÁ EXISTENTE no sistema (as sondas dirão o quanto vive):
--   ponto_escalas (modalidade, ciclo, acordo_individual_url, cct_act_url)
--   + ponto_escala_atribuicoes; ponto_banco_horas(_config/_movimentacoes)
--   com regimes e exige_acordo; atestados (cid_autorizado, camada perfil)
--   + trg_consolida_atestado + justificar_ponto_por_atestado;
--   ponto_justificativas (requer_anexo); ponto_dsr_competencia.
--
-- SEM COBERTURA — este arquivo documenta 8 casos novos (família ESC, na
-- própria família do Ponto): formalização da 12x36, encaminhamento do
-- atestado longo a Afastamentos, sobreposição de atestados, documento da
-- ausência legal, troca de turno com aprovação, cobertura de escala,
-- extrato de banco no portal (tela) e revezamento de 6 horas.
--
-- Rotinas na migration seguinte (mesma entrega).
-- =========================================================

SET lock_timeout = '10s';

DO $doc$
DECLARE v_mod uuid; v_antes int; v_depois int;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos
  WHERE path = 'jornada-rotina/ponto';
  IF v_mod IS NULL THEN RAISE EXCEPTION 'Módulo jornada-rotina/ponto não encontrado.'; END IF;
  SELECT count(*) INTO v_antes FROM public.qa_casos_teste WHERE modulo_id = v_mod;

  INSERT INTO public.qa_casos_teste
    (modulo_id, codigo, titulo, tipo, prioridade, status, nivel,
     base_legal, objetivo, pre_condicoes, passos, resultado_esperado, observacoes)
  VALUES

  -- ══════════ A) ESCALAS: FORMALIZAÇÃO E LIMITES ══════════

  (v_mod, 'ESC-001', '12x36 só vale com o acordo formal — sem ele, a atribuição é sinalizada',
   'negativo', 'critica', 'aprovado', 'api',
   'CLT art. 59-A (12x36 mediante acordo individual escrito, ACT ou CCT)',
   'A 12x36 não é escolha administrativa: a lei a condiciona a acordo individual ESCRITO, ACT ou CCT. Escala 12x36 aplicada sem a formalização é jornada inválida — na reclamatória, todas as horas além da 8ª viram extra, com reflexos, de todo o período. O sistema deve exigir/sinalizar o acordo na criação e na atribuição da escala.',
   'Cadastro de escalas disponível no ambiente de teste.',
   '[{"ordem":1,"acao":"Criar escala 12x36 SEM anexar acordo (individual/ACT/CCT)","resultado_esperado":"Bloqueio ou sinalização de pendência de formalização — nunca silêncio"},
     {"ordem":2,"acao":"Atribuir a escala a um colaborador","resultado_esperado":"Pendência visível enquanto o acordo não for arquivado"},
     {"ordem":3,"acao":"Anexar o acordo assinado","resultado_esperado":"Escala regularizada; documento guardado no módulo Documentos (RN-014)"}]'::jsonb,
   'Sem papel assinado não há 12x36 — há passivo de hora extra.',
   'Requisitos YE-DP-ESC-001: RN-001 / CA-001 / RF-003. ponto_escalas já tem acordo_individual_url e cct_act_url — a sonda confere se alguém os EXIGE. A apuração do ciclo é o PONTO-150/151.'),

  (v_mod, 'ESC-031', 'Turno ininterrupto de revezamento é de 6 horas, salvo negociação coletiva',
   'negativo', 'alta', 'aprovado', 'api',
   'CF art. 7º, XIV (turno ininterrupto de revezamento: 6h, salvo negociação coletiva)',
   'Revezamento que alterna turnos (dia/noite) em operação contínua tem jornada constitucional de 6 HORAS — só a negociação coletiva pode ampliá-la (o STF admite até 8h por CCT/ACT). Escala de revezamento cadastrada com 8h sem instrumento coletivo é a 7ª e 8ª hora viradas extra todos os dias, para todos os turnos.',
   'Cadastro de escalas com modalidade de revezamento no ambiente de teste.',
   '[{"ordem":1,"acao":"Criar escala de revezamento com jornada de 8h SEM CCT/ACT anexado","resultado_esperado":"Sinalização: acima de 6h exige negociação coletiva"},
     {"ordem":2,"acao":"Anexar o instrumento coletivo","resultado_esperado":"Jornada ampliada aceita, com o fundamento registrado"},
     {"ordem":3,"acao":"Criar revezamento de 6h","resultado_esperado":"Aceita sem exigência — é o padrão constitucional"}]'::jsonb,
   'No revezamento, a 7ª hora só existe com a assinatura do sindicato.',
   'Requisitos YE-DP-ESC-001: RN-012 [OLC]/[RCC]. A sonda confere se a validação existe para a modalidade de revezamento.'),

  -- ══════════ B) ATESTADOS ══════════

  (v_mod, 'ESC-010', 'Atestado acima de 15 dias abona 15 e encaminha a Afastamentos — sem duplicar',
   'alternativo', 'critica', 'aprovado', 'api',
   'Lei 8.213/91, arts. 59-60 (empresa paga os 15 primeiros dias; INSS assume do 16º)',
   'O atestado longo muda de natureza no 16º dia: até 15 dias é abono da empresa; dali em diante é benefício previdenciário — matéria do módulo Afastamentos. O sistema deve fazer a passagem SOZINHO: registrado atestado de 20 dias, abona 15 e cria/encaminha o afastamento correspondente, uma única vez (a duplicidade paga em dobro ou perde o prazo do INSS).',
   'Fluxo de atestados operante no ambiente de teste.',
   '[{"ordem":1,"acao":"Registrar atestado de 20 dias","resultado_esperado":"15 primeiros dias abonados pela empresa"},
     {"ordem":2,"acao":"Conferir o módulo Afastamentos","resultado_esperado":"Afastamento previdenciário criado/encaminhado a partir do 16º dia, vinculado ao atestado"},
     {"ordem":3,"acao":"Registrar o mesmo atestado de novo","resultado_esperado":"Sem duplicar abono nem afastamento"}]'::jsonb,
   'No 16º dia o atestado troca de dono — e o sistema faz a mudança.',
   'Requisitos YE-DP-ESC-001: RN-010 / CA-006 / RF-012. A régua dos 15 dias no lado dos AFASTAMENTOS é o AFAST-020..022; aqui a cobrança é a PONTE a partir do atestado (atestados.afastamento_id existe — a sonda confere quem o preenche).'),

  (v_mod, 'ESC-011', 'Atestados sobrepostos são detectados, não abonados em dobro',
   'negativo', 'alta', 'aprovado', 'api',
   'Documento YE-DP-ESC-001, fluxo alternativo "Atestado sobreposto/duplicado"; RN de integridade (sem abono duplicado)',
   'Dois atestados cobrindo o mesmo período — o mesmo documento reenviado, ou dois médicos para os mesmos dias — não podem abonar em dobro nem confundir a contagem dos 15 dias. O sistema detecta a sobreposição na entrada, sinaliza e mantém o tratamento mais favorável conforme a regra, com o operador decidindo o caso ambíguo.',
   'Atestados registrados no ambiente de teste.',
   '[{"ordem":1,"acao":"Registrar atestado de 01 a 10 do mês","resultado_esperado":"Abonado normalmente"},
     {"ordem":2,"acao":"Registrar outro atestado de 05 a 12 (sobrepõe 6 dias)","resultado_esperado":"Sobreposição detectada e sinalizada — não entra como abono independente"},
     {"ordem":3,"acao":"Conferir a contagem de dias abonados","resultado_esperado":"Cada dia conta UMA vez, inclusive na régua dos 15 dias"}]'::jsonb,
   'O mesmo dia doente não abona duas vezes.',
   'Requisitos YE-DP-ESC-001: fluxo alternativo (seção 9) / validações (seção 13). A tabela atestados não tem exclusão de período — a sonda testa se a sobreposição passa em silêncio. Em afastamentos a regra existe (AFAST-011).'),

  -- ══════════ C) AUSÊNCIAS LEGAIS ══════════

  (v_mod, 'ESC-012', 'Ausência do art. 473 sem documento fica pendente — não abona por fé',
   'negativo', 'alta', 'aprovado', 'api',
   'CLT art. 473 (rol de ausências sem prejuízo do salário, mediante comprovação)',
   'O rol do art. 473 abona a falta, mas mediante COMPROVAÇÃO: certidão de óbito, de casamento, declaração de comparecimento, comprovante de doação de sangue. Sem o documento no prazo, a ausência fica PENDENTE — nem abonada (não há prova) nem descontada às cegas (o prazo de comprovação corre) — e o colaborador é cobrado antes de virar desconto.',
   'Justificativas de ausência configuradas no ambiente de teste.',
   '[{"ordem":1,"acao":"Justificar falta por hipótese do art. 473 SEM anexar documento","resultado_esperado":"Fica pendente de comprovação — o abono não se consuma"},
     {"ordem":2,"acao":"Deixar o prazo de comprovação expirar","resultado_esperado":"Alerta ao colaborador e ao DP antes de qualquer desconto"},
     {"ordem":3,"acao":"Anexar o documento","resultado_esperado":"Abono efetivado; DSR da semana preservado; documento arquivado"}]'::jsonb,
   'O art. 473 abona com prova — sem documento, pendência; nunca desconto silencioso.',
   'Requisitos YE-DP-ESC-001: RN-009 / CA-007 / fluxo alternativo. ponto_justificativas tem requer_anexo — a sonda confere se a exigência é aplicada ou decorativa. O rol e os prazos são o AFAST-050.'),

  -- ══════════ D) OPERAÇÃO DE ESCALA ══════════

  (v_mod, 'ESC-020', 'Troca de turno entre colaboradores: aprovada, registrada e recalculada',
   'alternativo', 'media', 'aprovado', 'api',
   'CLT art. 66 (interjornada) c/c documento YE-DP-ESC-001, RF-013 (troca com aprovação e recálculo)',
   'Trocar o turno de dois colaboradores não é editar duas linhas: a troca precisa de aprovação (gestor), registro (quem trocou com quem, quando) e RECÁLCULO dos envolvidos — a interjornada de 11h e o adicional noturno podem mudar para os dois. Troca informal que viola a interjornada é passivo criado por boa vontade.',
   'Dois colaboradores com escalas atribuídas no ambiente de teste.',
   '[{"ordem":1,"acao":"Solicitar a troca de turno entre dois colaboradores","resultado_esperado":"Registro da solicitação com aprovação do gestor"},
     {"ordem":2,"acao":"Aprovar a troca","resultado_esperado":"Escalas dos dois atualizadas com histórico preservado"},
     {"ordem":3,"acao":"Conferir os reflexos","resultado_esperado":"Interjornada e adicionais recalculados para AMBOS; violação sinalizada antes de consumar"}]'::jsonb,
   'Troca é transação com aprovação — não edição de agenda.',
   'Requisitos YE-DP-ESC-001: RF-013 / fluxo alternativo. Não há estrutura de trocas hoje — a sonda confere. A vigência de atribuição é o PONTO-152.'),

  (v_mod, 'ESC-021', 'Turno sem cobertura é apontado antes do dia, não descoberto no dia',
   'feliz', 'media', 'aprovado', 'api',
   'Documento YE-DP-ESC-001, alerta "Escala sem cobertura" (seção 14) / RF-013',
   'Operação por turnos vive de cobertura: turno previsto sem colaborador atribuído (férias, afastamento, desligamento no meio do ciclo) precisa aparecer ANTES — como alerta ao gestor e ação de cobertura — e não ser descoberto com o posto vazio. O sistema conhece as escalas, as atribuições vigentes e os afastamentos: cruzá-los é o radar.',
   'Escalas com atribuições e um afastamento no meio do ciclo no ambiente de teste.',
   '[{"ordem":1,"acao":"Afastar um colaborador escalado","resultado_esperado":"Turnos futuros dele apontados como descobertos"},
     {"ordem":2,"acao":"Conferir o painel do gestor","resultado_esperado":"Alerta de cobertura com sugestão de troca/realocação"},
     {"ordem":3,"acao":"Cobrir o turno","resultado_esperado":"Alerta encerrado com o registro de quem cobriu"}]'::jsonb,
   'Escala boa é a que avisa o buraco antes do buraco.',
   'Requisitos YE-DP-ESC-001: seção 14 / RF-020. A sonda confere se algum motor cruza atribuições × afastamentos/desligamentos.'),

  -- ══════════ E) TRANSPARÊNCIA ══════════

  (v_mod, 'ESC-030', 'Colaborador vê o próprio saldo e extrato de banco de horas no portal',
   'feliz', 'media', 'aprovado', 'e2e',
   'CLT art. 59 c/c documento YE-DP-ESC-001, RF-017 (transparência do saldo ao colaborador)',
   'Banco de horas sem extrato é fonte de litígio: o colaborador precisa ver, no portal/app, o próprio saldo, os créditos e débitos por período e o prazo de compensação — a mesma fonte que o DP enxerga (PONTO-330). Transparência aqui é prevenção: divergência descoberta no mês é acerto; descoberta na rescisão é processo.',
   'Colaborador com movimentações de banco no ambiente de teste.',
   '[{"ordem":1,"acao":"Abrir o portal do colaborador → banco de horas","resultado_esperado":"Saldo atual, créditos, débitos e prazo de compensação visíveis"},
     {"ordem":2,"acao":"Comparar com o extrato do DP","resultado_esperado":"Mesma fonte, mesmos números"},
     {"ordem":3,"acao":"Conferir outro colaborador","resultado_esperado":"Cada um vê apenas o próprio saldo"}]'::jsonb,
   'O saldo do banco é do colaborador — ele o vê sem pedir.',
   'Requisitos YE-DP-ESC-001: RF-017. Caso de tela (Cypress). O motor do saldo é o PONTO-170..175/330.')

  ON CONFLICT (codigo) DO NOTHING;

  SELECT count(*) INTO v_depois FROM public.qa_casos_teste WHERE modulo_id = v_mod;
  RAISE NOTICE 'ESC (requisitos YE-DP-ESC-001): casos antes=%, depois=% (esperado +8 na primeira execução).', v_antes, v_depois;
END $doc$;

-- ── Referências cruzadas (sem duplicar cobertura) ──
DO $xref$
BEGIN
  UPDATE public.qa_casos_teste SET observacoes = coalesce(observacoes,'') ||
    ' | Requisitos YE-DP-ESC-001: a apuração da 12x36 segue aqui; a FORMALIZAÇÃO (acordo escrito/ACT/CCT, art. 59-A) é o ESC-001.'
  WHERE codigo IN ('PONTO-150','PONTO-151') AND position('YE-DP-ESC-001' IN coalesce(observacoes,'')) = 0;

  UPDATE public.qa_casos_teste SET observacoes = coalesce(observacoes,'') ||
    ' | Requisitos YE-DP-ESC-001: os regimes, prazos e a conversão do banco de horas seguem donos aqui (RN-002/RN-008 do documento); o extrato no portal do colaborador é o ESC-030.'
  WHERE codigo IN ('PONTO-170','PONTO-171','PONTO-354','PONTO-355') AND position('YE-DP-ESC-001' IN coalesce(observacoes,'')) = 0;

  UPDATE public.qa_casos_teste SET observacoes = coalesce(observacoes,'') ||
    ' | Requisitos YE-DP-ESC-001: a perda do DSR por falta injustificada (RN-007) segue aqui; o reflexo da HE no DSR (Súmula 172) é o FOLHA-022.'
  WHERE codigo = 'PONTO-132' AND position('YE-DP-ESC-001' IN coalesce(observacoes,'')) = 0;

  UPDATE public.qa_casos_teste SET observacoes = coalesce(observacoes,'') ||
    ' | Requisitos YE-DP-ESC-001 (RN-007/CA-011): segue dono do reflexo das variáveis no DSR (Súmula 172).'
  WHERE codigo = 'FOLHA-022' AND position('YE-DP-ESC-001' IN coalesce(observacoes,'')) = 0;

  UPDATE public.qa_casos_teste SET observacoes = coalesce(observacoes,'') ||
    ' | Requisitos YE-DP-ESC-001 (RN-010): segue dono da régua empresa 15 dias / INSS 16º; a ponte a partir do ATESTADO é o ESC-010.'
  WHERE codigo = 'AFAST-020' AND position('YE-DP-ESC-001' IN coalesce(observacoes,'')) = 0;

  UPDATE public.qa_casos_teste SET observacoes = coalesce(observacoes,'') ||
    ' | Requisitos YE-DP-ESC-001 (RN-009): segue dono do rol e prazos do art. 473; a exigência do documento comprobatório é o ESC-012.'
  WHERE codigo = 'AFAST-050' AND position('YE-DP-ESC-001' IN coalesce(observacoes,'')) = 0;

  UPDATE public.qa_casos_teste SET observacoes = coalesce(observacoes,'') ||
    ' | Requisitos YE-DP-ESC-001 (RN-013): o sigilo do CID com log de acesso vale também para os atestados do fluxo de abono — a folha usa período e validade, nunca o diagnóstico.'
  WHERE codigo = 'AFAST-080' AND position('YE-DP-ESC-001' IN coalesce(observacoes,'')) = 0;

  UPDATE public.qa_casos_teste SET observacoes = coalesce(observacoes,'') ||
    ' | Requisitos YE-DP-ESC-001: o registro básico segue aqui; a família ESC cobre encaminhamento >15 dias (ESC-010) e sobreposição (ESC-011).'
  WHERE codigo = 'ATE-001' AND position('YE-DP-ESC-001' IN coalesce(observacoes,'')) = 0;

  RAISE NOTICE 'Referências cruzadas YE-DP-ESC-001 registradas (PONTO-150/151/170/171/354/355/132, FOLHA-022, AFAST-020/050/080, ATE-001).';
END $xref$;
