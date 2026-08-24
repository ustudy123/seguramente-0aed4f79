-- =========================================================
-- QA — Benefícios: casos derivados da Análise de Requisitos do módulo
-- (documento YE-DP-BEN-001, Google Doc "YE — Benefícios — Análise de
-- Requisitos", data-base ago/2026).
--
-- ESCOPO DO DOCUMENTO: ciclo completo de benefícios — catálogo (VT,
-- VR/VA, saúde/odonto, seguro, creche, PLR, previdência, flexíveis),
-- elegibilidade por cargo/CCT, adesão/opção com termo, dependentes,
-- cálculo e desconto em folha com incidências parametrizadas,
-- coparticipação, operadoras/faturas com conciliação, manutenção do
-- plano na rescisão (Lei 9.656/98, arts. 30/31), consignado e PLR.
--
-- JÁ COBERTO (referência cruzada, sem duplicar):
--   Opção do VT colhida na admissão .............. ADM-050
--   Descontos no limite do art. 462 (VT 6%) ...... FOLHA-030
--   Verbas do falecido aos dependentes ........... DESL-023
--   Benefício previdenciário (INSS) .............. família AFAST
--   Padrão de assinatura com trilha .............. ADM-070 / DESL-082
--
-- BASE JÁ EXISTENTE no sistema (enxuta — as sondas dirão o quanto vive):
--   beneficios_tipos (categoria, tipo_desconto, percentual_desconto,
--   regras_cargo/vinculo/unidade); beneficios_colaboradores (valor,
--   valor_desconto, status); camada CCT do ponto/folha (ponto_cct_config,
--   folha_cct). NÃO existem: dependentes, operadoras/planos, faturas,
--   termos, manutenção 30/31, PLR, consignado, ponte com a Folha.
--
-- SEM COBERTURA — este arquivo documenta 15 casos novos (família BEN,
-- em Jornada & Rotina › Benefícios): elegibilidade aplicada, VT sem
-- termo, tetos de desconto (6% / PAT), motor de incidências e rubricas,
-- dependentes com regra, manutenção do plano na rescisão, operadoras e
-- faturas conciliadas, proporcionalidade com o Ponto, CCT versionada,
-- termo no módulo Documentos, PLR, consignado, LGPD e portal (tela).
--
-- Rotinas na migration seguinte (mesma entrega).
-- =========================================================

SET lock_timeout = '10s';

DO $doc$
DECLARE v_mod uuid; v_antes int; v_depois int;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos
  WHERE path = 'jornada-rotina/beneficios';
  IF v_mod IS NULL THEN RAISE EXCEPTION 'Módulo jornada-rotina/beneficios não encontrado.'; END IF;
  SELECT count(*) INTO v_antes FROM public.qa_casos_teste WHERE modulo_id = v_mod;

  INSERT INTO public.qa_casos_teste
    (modulo_id, codigo, titulo, tipo, prioridade, status, nivel,
     base_legal, objetivo, pre_condicoes, passos, resultado_esperado, observacoes)
  VALUES

  -- ══════════ A) CATÁLOGO E ELEGIBILIDADE ══════════

  (v_mod, 'BEN-001', 'Elegibilidade por cargo/vínculo/unidade é aplicada, não decorativa',
   'feliz', 'alta', 'aprovado', 'api',
   'CLT art. 458 c/c documento YE-DP-BEN-001, RF-003 (elegibilidade por cargo, porte, estabelecimento e CCT)',
   'O catálogo define QUEM pode receber cada benefício (cargo, vínculo, unidade, CCT) — e essa regra precisa ser aplicada na adesão: conceder benefício a quem não é elegível cria diferenciação sem critério (risco de equiparação) e custo sem controle; negar a quem a CCT garante é passivo direto.',
   'Tipos de benefício com regras de elegibilidade cadastradas no ambiente de teste.',
   '[{"ordem":1,"acao":"Cadastrar benefício restrito a um cargo","resultado_esperado":"Regra registrada no catálogo"},
     {"ordem":2,"acao":"Tentar aderir colaborador de cargo não elegível","resultado_esperado":"Bloqueio ou sinalização — a regra é conferida na adesão"},
     {"ordem":3,"acao":"Aderir colaborador elegível","resultado_esperado":"Adesão registrada normalmente"}]'::jsonb,
   'Regra de elegibilidade cadastrada é regra conferida na porta.',
   'Requisitos YE-DP-BEN-001: RF-003. beneficios_tipos tem regras_cargo/regras_vinculo/regras_unidade — a sonda confere se alguém as LÊ.'),

  -- ══════════ B) VT E VR/VA: TERMO E TETOS ══════════

  (v_mod, 'BEN-010', 'VT sem termo de opção: não concede, não desconta',
   'negativo', 'critica', 'aprovado', 'api',
   'Lei 7.418/85 e Dec. 95.247/87 (VT mediante opção do empregado)',
   'O VT é OPTATIVO: sem o termo de opção (ou com renúncia registrada) não há concessão nem desconto — descontar 6% de quem não optou é desconto ilegal; conceder sem opção documentada perde a prova da natureza não salarial. A adesão de VT precisa carregar o vínculo com o termo assinado.',
   'Fluxo de adesão a benefícios operante no ambiente de teste.',
   '[{"ordem":1,"acao":"Registrar adesão de VT SEM termo de opção","resultado_esperado":"Bloqueio ou pendência de termo — nunca adesão consumada em silêncio"},
     {"ordem":2,"acao":"Registrar a recusa do colaborador","resultado_esperado":"Não opção documentada; sem concessão nem desconto; reopção possível"},
     {"ordem":3,"acao":"Anexar o termo e concluir a adesão","resultado_esperado":"Adesão ativa com o termo vinculado (módulo Documentos)"}]'::jsonb,
   'A opção do VT é documento — sem ele, nem vale, nem desconto.',
   'Requisitos YE-DP-BEN-001: RN-001 / CA-001. A COLETA da opção na admissão é o ADM-050; aqui a cobrança é a trava na adesão do benefício — a sonda confere se existe sequer onde guardar o vínculo com o termo.'),

  (v_mod, 'BEN-011', 'Desconto do VT: o menor entre 6% do salário básico e o custo real',
   'feliz', 'critica', 'aprovado', 'api',
   'Lei 7.418/85, art. 4º, parágrafo único (desconto de até 6% do salário básico, limitado ao custo)',
   'A conta do VT tem dois tetos: o desconto é o MENOR entre 6% do salário básico e o custo real do transporte — passe barato desconta menos que 6%; passe caro desconta 6% e o empregador arca com o excedente. O reajuste salarial recalcula o teto na competência seguinte. Home office dispensa o VT.',
   'Colaboradores com salários e custos de transporte distintos no ambiente de teste.',
   '[{"ordem":1,"acao":"Calcular VT com custo ABAIXO de 6% do salário","resultado_esperado":"Desconto = custo real (não os 6% cheios)"},
     {"ordem":2,"acao":"Calcular VT com custo ACIMA de 6%","resultado_esperado":"Desconto = 6% do salário básico; excedente do empregador"},
     {"ordem":3,"acao":"Cadastrar desconto de VT acima de 6% no catálogo","resultado_esperado":"Recusado ou limitado ao teto legal"}]'::jsonb,
   'Seis por cento é teto, não tarifa — e o custo real pode ser menor.',
   'Requisitos YE-DP-BEN-001: RN-001 / CA-002 / CA-011. O limite na FOLHA é o FOLHA-030; aqui a cobrança é o motor de cálculo do benefício e a trava no catálogo (percentual_desconto aceita qualquer número?).'),

  (v_mod, 'BEN-012', 'VR/VA: desconto limitado (PAT/CCT), uso exclusivo e sem rebate ao empregador',
   'negativo', 'alta', 'aprovado', 'api',
   'Lei 6.321/76 + Dec. 10.854/21 (PAT); Lei 14.442/22 (uso exclusivo; vedação de rebates; multas de R$ 5 mil a R$ 50 mil)',
   'O VR/VA no PAT tem três cercas: a participação do trabalhador é LIMITADA (parâmetro do PAT/CCT), o uso é exclusivo para alimentação, e é VEDADO o rebate/cashback ao empregador na contratação da fornecedora (Lei 14.442/22 — multa de até R$ 50 mil). Desconto acima do limite descaracteriza o benefício e derruba o incentivo fiscal.',
   'Benefício de alimentação configurado no ambiente de teste.',
   '[{"ordem":1,"acao":"Cadastrar VR com desconto acima do limite do PAT/CCT","resultado_esperado":"Recusado ou limitado ao teto parametrizado"},
     {"ordem":2,"acao":"Aplicar o desconto na competência","resultado_esperado":"Dentro do limite, com memória de cálculo"},
     {"ordem":3,"acao":"Conferir o contrato da fornecedora","resultado_esperado":"Sem cláusula de rebate/desconto ao empregador — vedação registrada"}]'::jsonb,
   'O VR alimenta o trabalhador — não o caixa da empresa.',
   'Requisitos YE-DP-BEN-001: RN-003 / CA-003. O limite de desconto do PAT é parâmetro [VAL]; a sonda confere se existe teto parametrizado ou se o percentual é livre.'),

  -- ══════════ C) FOLHA: INCIDÊNCIAS E RUBRICAS ══════════

  (v_mod, 'BEN-020', 'Benefício chega à Folha por rubrica com a incidência parametrizada',
   'feliz', 'critica', 'aprovado', 'api',
   'CLT art. 458; legislação de custeio (INSS/FGTS/IRRF); documento YE-DP-BEN-001, RF-009/RF-010',
   'Cada benefício tem natureza própria: VT e VR (no PAT) não integram a remuneração; benefício mal configurado VIRA salário e gera passivo previdenciário retroativo. O caminho correto: a adesão gera rubricas (desconto do empregado, parcela patronal) com a incidência parametrizada por benefício e competência, e memória de cálculo — nada de lançamento manual solto na folha.',
   'Adesões ativas e fechamento de folha no ambiente de teste.',
   '[{"ordem":1,"acao":"Fechar a competência com adesões ativas","resultado_esperado":"Rubricas de benefício geradas na folha automaticamente (desconto + patronal)"},
     {"ordem":2,"acao":"Conferir a incidência de cada rubrica","resultado_esperado":"INSS/FGTS/IRRF conforme a natureza parametrizada do benefício, com memória"},
     {"ordem":3,"acao":"Alterar a parametrização de incidência","resultado_esperado":"Vale para competências futuras; as fechadas preservam a regra da época"}]'::jsonb,
   'Benefício sem rubrica automática é desconto manual esperando errar.',
   'Requisitos YE-DP-BEN-001: RN-002/RN-004 / CA-004. A sonda confere se existe QUALQUER ponte beneficios_colaboradores → folha — hoje o desconto parece viver só no cadastro.'),

  -- ══════════ D) DEPENDENTES ══════════

  (v_mod, 'BEN-030', 'Dependente entra com regra conferida: idade, parentesco, documento',
   'negativo', 'alta', 'aprovado', 'api',
   'Lei 9.656/98 (dependentes no plano); RIR/IRRF (dependentes na tributação); documento YE-DP-BEN-001, RF-005/RN-007',
   'Dependente é cadastro com consequência dupla: vai para a OPERADORA (vidas e fatura) e reflete no IRRF do titular. A inclusão exige regra conferida — idade-limite, grau de parentesco, documentação — antes de enviar à operadora; dependente fora da regra descoberto na fatura é custo indevido e glosa retroativa.',
   'Estrutura de dependentes por titular no ambiente de teste.',
   '[{"ordem":1,"acao":"Incluir dependente válido (filho, com certidão)","resultado_esperado":"Aceito; refletido no plano e no IRRF quando cabível"},
     {"ordem":2,"acao":"Tentar incluir dependente fora da regra (idade estourada, sem documento)","resultado_esperado":"Bloqueio ou pendência de comprovação — não segue à operadora"},
     {"ordem":3,"acao":"Dependente atinge a idade-limite","resultado_esperado":"Alerta de vencimento antes da exclusão/ajuste"}]'::jsonb,
   'Dependente é vida na fatura e linha no IRRF — entra só com prova.',
   'Requisitos YE-DP-BEN-001: RF-005 / RN-007 / CA-006. A sonda confere se a estrutura de dependentes sequer existe no banco.'),

  -- ══════════ E) SAÚDE: MANUTENÇÃO NA RESCISÃO ══════════

  (v_mod, 'BEN-040', 'Rescisão com plano de saúde: manutenção dos arts. 30/31 calculada e comunicada',
   'alternativo', 'critica', 'aprovado', 'api',
   'Lei 9.656/98, arts. 30 e 31 + RN ANS (manutenção: 1/3 do tempo, mín. 6 e máx. 24 meses; aposentado 10+ anos: vitalício; opção em 30 dias, custo integral)',
   'Demitido sem justa causa que CONTRIBUIU para o plano tem direito de mantê-lo — por 1/3 do tempo de contribuição (mínimo 6, máximo 24 meses), assumindo o custo integral, com opção em ATÉ 30 DIAS da comunicação; aposentado com 10+ anos, vitalício. Perder o prazo de comunicar é a ação judicial mais previsível do pós-rescisão: o sistema deve calcular a elegibilidade, o prazo e o custo, e registrar a opção do ex-empregado.',
   'Desligamento de colaborador com plano de saúde contributário no ambiente de teste.',
   '[{"ordem":1,"acao":"Iniciar rescisão sem justa causa de titular que contribuía","resultado_esperado":"Elegibilidade dos arts. 30/31 verificada; período de manutenção calculado"},
     {"ordem":2,"acao":"Comunicar o ex-empregado","resultado_esperado":"Prazo de 30 dias controlado; custo integral informado; termo gerado"},
     {"ordem":3,"acao":"Registrar a opção (manter/recusar)","resultado_esperado":"Decisão arquivada; vidas na operadora ajustadas conforme a escolha"}]'::jsonb,
   'O plano não morre com o contrato — morre com o prazo de opção perdido.',
   'Requisitos YE-DP-BEN-001: RN-005/RN-006 / CA-005 / RF-013. Nada disso existe hoje — a sonda confere. A baixa das demais verbas é a família DESL.'),

  -- ══════════ F) OPERADORAS E FATURAS ══════════

  (v_mod, 'BEN-042', 'Fatura da operadora só é paga depois de conciliada: vidas, valores, coparticipação',
   'negativo', 'alta', 'aprovado', 'api',
   'Documento YE-DP-BEN-001, RN-013 / CA-007 (fatura paga só após conciliação; divergência gera glosa)',
   'A fatura mensal da operadora é conferida contra a base: vidas ativas × cobradas, mensalidades por faixa, coparticipação por uso. Divergência (vida fantasma de ex-colaborador, dependente excluído ainda cobrado, coparticipação atípica) BLOQUEIA o pagamento automático e vira glosa com ação de conciliação. Pagar fatura às cegas é assinar custo indevido todo mês.',
   'Estrutura de operadoras, movimentações e faturas no ambiente de teste.',
   '[{"ordem":1,"acao":"Importar fatura com as mesmas vidas do sistema","resultado_esperado":"Conciliada; liberada para pagamento"},
     {"ordem":2,"acao":"Importar fatura com vida a mais (ex-colaborador)","resultado_esperado":"Divergência apontada; pagamento bloqueado; glosa sugerida"},
     {"ordem":3,"acao":"Registrar a glosa e o acerto","resultado_esperado":"Trilha da conciliação completa, com ação no Plano de Ação"}]'::jsonb,
   'Fatura confere primeiro, paga depois — nunca o contrário.',
   'Requisitos YE-DP-BEN-001: RF-002/RF-011/RF-012 / RN-013. Não há estrutura de operadoras, movimentações nem faturas hoje — a sonda confere.'),

  -- ══════════ G) PROPORCIONALIDADE E CCT ══════════

  (v_mod, 'BEN-050', 'VT/VR proporcionais aos dias efetivos — o Ponto alimenta o benefício',
   'feliz', 'alta', 'aprovado', 'api',
   'Dec. 95.247/87 (VT por deslocamento efetivo); documento YE-DP-BEN-001, RN-011 / RF-018',
   'VT e VR são concedidos por dia EFETIVO: férias, afastamentos e faltas reduzem a concessão do período (e o desconto correspondente). O Ponto já sabe os dias de cada colaborador na competência — o benefício deve consumir esse dado, não repetir um valor fixo todo mês enquanto o colaborador está afastado há sessenta dias.',
   'Colaborador com afastamento parcial na competência no ambiente de teste.',
   '[{"ordem":1,"acao":"Apurar VT/VR de colaborador que trabalhou o mês inteiro","resultado_esperado":"Concessão cheia pelos dias úteis efetivos"},
     {"ordem":2,"acao":"Apurar com 10 dias de afastamento no mês","resultado_esperado":"Concessão e desconto proporcionais aos dias efetivos"},
     {"ordem":3,"acao":"Conferir a memória","resultado_esperado":"Dias vindos do Ponto, rastreáveis na memória de cálculo"}]'::jsonb,
   'Benefício de ir trabalhar acompanha os dias em que se trabalhou.',
   'Requisitos YE-DP-BEN-001: RN-011 / RF-018. beneficios_colaboradores guarda valor fixo — a sonda confere se algo consome os dias do Ponto.'),

  (v_mod, 'BEN-051', 'Benefício instituído por CCT entra pela vigência, com tabela versionada',
   'feliz', 'media', 'aprovado', 'api',
   'CF art. 7º, XXVI (reconhecimento das convenções coletivas); documento YE-DP-BEN-001, RN-010 / CA-009',
   'A CCT institui e reajusta benefícios (cesta, VR mínimo, seguro de vida obrigatório) por categoria e vigência. O módulo precisa da camada de parametrização por instrumento: benefício/valor valem A PARTIR da vigência da convenção, a tabela anterior fica versionada, e a troca de CCT não reescreve competências fechadas.',
   'Instrumento coletivo com benefício instituído no ambiente de teste.',
   '[{"ordem":1,"acao":"Registrar CCT nova com VR mínimo maior","resultado_esperado":"Valor novo aplicado a partir da vigência"},
     {"ordem":2,"acao":"Consultar competência anterior à vigência","resultado_esperado":"Valor antigo preservado (tabela versionada)"},
     {"ordem":3,"acao":"Conferir colaboradores de outra categoria","resultado_esperado":"Não afetados — a CCT vale por categoria"}]'::jsonb,
   'A convenção manda no benefício — a partir da data dela, para a categoria dela.',
   'Requisitos YE-DP-BEN-001: RN-010 / CA-009. A camada CCT existe para ponto/folha (ponto_cct_config, folha_cct) — a sonda confere se alcança os benefícios.'),

  -- ══════════ H) DOCUMENTOS, PLR, CONSIGNADO, LGPD ══════════

  (v_mod, 'BEN-060', 'Toda adesão gera termo assinado, arquivado no módulo Documentos',
   'feliz', 'alta', 'aprovado', 'api',
   'Lei 7.418/85 (opção do VT por escrito); MP 2.200-2/2001 (assinatura eletrônica); documento YE-DP-BEN-001, RN-012 / RF-017',
   'O termo é a prova do benefício: da opção (ou recusa) do VT, da adesão ao VR/plano com as condições e dependentes, da manutenção dos arts. 30/31. Cada adesão gera o termo, colhe a assinatura com trilha (o padrão da casa) e arquiva no módulo Documentos com metadados — adesão sem termo é benefício sem defesa na fiscalização.',
   'Fluxo de adesão operante no ambiente de teste.',
   '[{"ordem":1,"acao":"Concluir uma adesão","resultado_esperado":"Termo gerado e assinatura colhida com trilha"},
     {"ordem":2,"acao":"Buscar o termo na pasta do colaborador","resultado_esperado":"Arquivado no módulo Documentos, com metadados e versão"},
     {"ordem":3,"acao":"Registrar uma recusa (VT)","resultado_esperado":"Termo de recusa igualmente arquivado — a não opção também é prova"}]'::jsonb,
   'Adesão sem termo arquivado é aposta; com termo, é gestão.',
   'Requisitos YE-DP-BEN-001: RN-012 / CA-010. O padrão de assinatura existe (ADM-070/DESL-082); a sonda confere se a adesão tem onde ancorar o termo.'),

  (v_mod, 'BEN-070', 'PLR sem acordo válido não é tratada como PLR isenta',
   'negativo', 'media', 'aprovado', 'api',
   'Lei 10.101/2000 (PLR: negociação prévia com comissão paritária + sindicato; máx. 2 pagamentos/ano; IR em tabela própria; não integra salário)',
   'A isenção de encargos da PLR é condicionada: acordo PRÉVIO negociado (comissão paritária com sindicato), no máximo dois pagamentos por ano, IR em tabela exclusiva. Pagamento rotulado de PLR sem acordo válido é salário disfarçado — INSS, FGTS e reflexos retroativos. O sistema deve exigir o acordo antes de tratar o pagamento como PLR.',
   'Programa de PLR configurado no ambiente de teste.',
   '[{"ordem":1,"acao":"Registrar pagamento de PLR SEM acordo arquivado","resultado_esperado":"Risco de perda da isenção sinalizado — não passa como PLR isenta em silêncio"},
     {"ordem":2,"acao":"Arquivar o acordo (comissão + sindicato) e pagar","resultado_esperado":"PLR com IR próprio e sem integração salarial"},
     {"ordem":3,"acao":"Tentar o terceiro pagamento no ano","resultado_esperado":"Bloqueio/alerta — o limite é de dois por ano"}]'::jsonb,
   'PLR sem acordo é salário com outro nome — e a Receita sabe.',
   'Requisitos YE-DP-BEN-001: RN-008 / CA-012 / RF-014. Estrutura de PLR não existe hoje — a sonda confere.'),

  (v_mod, 'BEN-071', 'Consignado desconta só até a margem consignável',
   'negativo', 'media', 'aprovado', 'api',
   'Lei 10.820/2003 (empréstimo consignado; margem consignável)',
   'O desconto de consignado em folha tem teto legal: a margem consignável sobre a remuneração disponível. Descontar acima da margem é ilegal e deixa o líquido do colaborador abaixo do mínimo vital — o sistema precisa conhecer a margem, validar cada novo contrato contra ela e bloquear o desconto excedente.',
   'Convênio de consignado configurado no ambiente de teste.',
   '[{"ordem":1,"acao":"Registrar consignado dentro da margem","resultado_esperado":"Desconto aplicado em folha normalmente"},
     {"ordem":2,"acao":"Tentar novo contrato que estoura a margem","resultado_esperado":"Bloqueado ou limitado ao teto, com alerta ao DP"},
     {"ordem":3,"acao":"Salário reduzido (afastamento)","resultado_esperado":"Margem recalculada; desconto ajustado"}]'::jsonb,
   'A margem é o limite do bolso — o sistema segura a caneta.',
   'Requisitos YE-DP-BEN-001: RN-009 / CA-008 / RF-015. Estrutura de consignado/margem não existe hoje — a sonda confere.'),

  (v_mod, 'BEN-080', 'Adesão a plano de saúde é dado sensível: leitura restrita e logada',
   'negativo', 'critica', 'aprovado', 'api',
   'LGPD art. 5º, II e art. 11 (dado de saúde); documento YE-DP-BEN-001, RN-014 / seção 22',
   'A lista de quem tem plano de saúde, com dependentes e valores, é dado de saúde por inferência — e o tráfego com a operadora leva ainda mais (faixas, coparticipação por uso). O acesso deve ser o mínimo necessário (a camada de perfil da casa), com log de consulta; o gestor vê custo agregado, não a vida de cada um.',
   'Adesões de saúde registradas no ambiente de teste.',
   '[{"ordem":1,"acao":"Consultar adesões como usuário comum do tenant","resultado_esperado":"Leitura restrita por perfil — não é vitrine do tenant inteiro"},
     {"ordem":2,"acao":"Acessar como perfil autorizado","resultado_esperado":"Funciona e fica logado (quem, quando, o quê)"},
     {"ordem":3,"acao":"Conferir o tráfego com a operadora","resultado_esperado":"Mínimo indispensável, por canal seguro, sem diagnóstico"}]'::jsonb,
   'Quem tem plano, quem depende de quem — isso é saúde, e saúde é sigilo.',
   'Requisitos YE-DP-BEN-001: RN-014 / seção 22. beneficios_colaboradores tem leitura aberta ao tenant ("Usuários podem ver benefícios do tenant") sem política perfil_restringe_leitura_* — mesma família do FOLHA-090/EPI-041; a sonda confere.'),

  -- ══════════ I) PORTAL ══════════

  (v_mod, 'BEN-090', 'Portal do colaborador: optar, aderir, simular desconto e ver carteirinha',
   'feliz', 'media', 'aprovado', 'e2e',
   'Documento YE-DP-BEN-001, RF-019 (autoatendimento no Portal/App)',
   'O autoatendimento fecha o ciclo: o colaborador vê os benefícios elegíveis, simula o impacto no líquido antes de optar, adere com assinatura, inclui dependentes com upload de documentos e consulta descontos e carteirinhas — cada um vendo apenas o que é seu. Menos fila no DP, mais prova documental.',
   'Portal do colaborador com benefícios habilitados no ambiente de teste.',
   '[{"ordem":1,"acao":"Abrir o portal → benefícios","resultado_esperado":"Elegíveis listados com simulação de desconto no líquido"},
     {"ordem":2,"acao":"Aderir e assinar","resultado_esperado":"Termo assinado; adesão pendente/ativa conforme o fluxo"},
     {"ordem":3,"acao":"Consultar descontos e carteirinha","resultado_esperado":"Somente os próprios dados; histórico visível"}]'::jsonb,
   'O benefício se explica sozinho no portal — e deixa prova ao aderir.',
   'Requisitos YE-DP-BEN-001: RF-019. Caso de tela (Cypress).')

  ON CONFLICT (codigo) DO NOTHING;

  SELECT count(*) INTO v_depois FROM public.qa_casos_teste WHERE modulo_id = v_mod;
  RAISE NOTICE 'BEN (requisitos YE-DP-BEN-001): casos antes=%, depois=% (esperado +15 na primeira execução).', v_antes, v_depois;
END $doc$;

-- ── Referências cruzadas (sem duplicar cobertura) ──
DO $xref$
BEGIN
  UPDATE public.qa_casos_teste SET observacoes = coalesce(observacoes,'') ||
    ' | Requisitos YE-DP-BEN-001: a coleta da opção do VT na admissão segue aqui; a trava na adesão do benefício e o termo arquivado são o BEN-010/BEN-060.'
  WHERE codigo = 'ADM-050' AND position('YE-DP-BEN-001' IN coalesce(observacoes,'')) = 0;

  UPDATE public.qa_casos_teste SET observacoes = coalesce(observacoes,'') ||
    ' | Requisitos YE-DP-BEN-001: o limite de desconto na folha (art. 462; VT 6%) segue aqui; o motor de cálculo do benefício (menor entre 6% e custo) é o BEN-011.'
  WHERE codigo = 'FOLHA-030' AND position('YE-DP-BEN-001' IN coalesce(observacoes,'')) = 0;

  UPDATE public.qa_casos_teste SET observacoes = coalesce(observacoes,'') ||
    ' | Requisitos YE-DP-BEN-001: na rescisão, além das verbas, o plano de saúde tem a manutenção dos arts. 30/31 da Lei 9.656/98 — caso BEN-040 (prazo de opção de 30 dias, custo integral).'
  WHERE codigo = 'DESL-082' AND position('YE-DP-BEN-001' IN coalesce(observacoes,'')) = 0;

  RAISE NOTICE 'Referências cruzadas YE-DP-BEN-001 registradas (ADM-050, FOLHA-030, DESL-082).';
END $xref$;
