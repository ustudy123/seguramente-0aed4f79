-- =========================================================
-- QA — EPI (Gestão, Estoque e Entrega): casos derivados da Análise de
-- Requisitos do módulo (documento YE-DP-EPI-001, Google Doc "YE — EPI —
-- Análise de Requisitos", data-base ago/2026).
--
-- ESCOPO DO DOCUMENTO: o módulo de EPI JÁ EXISTE no YE — esta análise
-- consolida. Catálogo por CA (busca CAEPI, validade do CA); estoque por
-- unidade/tamanho/local (multi-almoxarifado, FEFO, sem saldo negativo);
-- entrada por NF (XML, OCR de DANFE com revisão, manual); entrega com
-- leitura facial (biometria = dado sensível, LGPD art. 5º II e 11) e
-- recibo com assinatura eletrônica avançada (Lei 14.063/2020;
-- MP 2.200-2/2001 art. 10 §2º; STJ REsp 2.159.442/PR); baixa de estoque
-- SÓ após a assinatura (RN-005); guarda no módulo Documentos (RN-012);
-- devolução na rescisão/afastamento (RN-014); kit de admissão (RF-020);
-- troca periódica (RF-016); EPI eficaz → S-2240 (RF-017); reposição via
-- Plano de Ação (RF-018). Prazos de guarda e antecedências são [VAL].
--
-- JÁ COBERTO (referência cruzada, sem duplicar):
--   Entrega baixa o estoque .................... EPI-001 (marco)
--   Trava de CA vigente na entrega + ficha ..... SST-011
--   EPI eficaz alimenta o S-2240 ............... SST-031
--   Neutralização do adicional por EPI ......... SST-050
--   Assinatura eletrônica com trilha (padrão) .. ADM-070 / DESL-082
--
-- BASE JÁ EXISTENTE no sistema (as sondas dirão o quanto vive):
--   epi_tipos (ca_numero, ca_validade, estoque_minimo,
--   periodicidade_troca_dias, controla_tamanho); epi_tamanhos;
--   epis (data_validade); epi_locais_estoque + epi_estoque_local
--   (quantidade_minima, tamanho); epi_movimentacoes; epi_notas_fiscais
--   (chave_acesso, origem xml|manual) + epi_nf_itens; epi_entregas
--   (assinatura_url, ip_address, user_agent, signed_at,
--   liveness_detected, liveness_data); trigger atualizar_estoque_epi.
--
-- SEM COBERTURA — este arquivo documenta 16 casos novos (família EPI,
-- em Saúde Ocupacional › EPI): catálogo por CA com validade vigiada,
-- estoque sem saldo negativo, FEFO, estoque mínimo → Plano de Ação,
-- entrada por NF íntegra, importação com revisão humana, item vencido
-- não sai, biometria protegida (LGPD), recibo assinado com trilha,
-- baixa só após assinatura, guarda no módulo Documentos, troca
-- periódica, kit de admissão, devolução na rescisão/afastamento.
--
-- ESTA MIGRATION SÓ DOCUMENTA. Rotinas em leva futura.
-- =========================================================

SET lock_timeout = '10s';

DO $doc$
DECLARE v_mod uuid; v_antes int; v_depois int;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos
  WHERE path = 'saude-ocupacional/epi';
  IF v_mod IS NULL THEN RAISE EXCEPTION 'Módulo saude-ocupacional/epi não encontrado.'; END IF;
  SELECT count(*) INTO v_antes FROM public.qa_casos_teste WHERE modulo_id = v_mod;

  INSERT INTO public.qa_casos_teste
    (modulo_id, codigo, titulo, tipo, prioridade, status, nivel,
     base_legal, objetivo, pre_condicoes, passos, resultado_esperado, observacoes)
  VALUES

  -- ══════════ A) CATÁLOGO E CA ══════════

  (v_mod, 'EPI-010', 'Catálogo por CA: buscar o CA preenche o cadastro e traz a validade oficial',
   'feliz', 'alta', 'aprovado', 'api',
   'NR-6 (todo EPI comercializado precisa de CA válido; consulta pública CAEPI)',
   'O CA é a identidade do EPI: informado o número, o sistema busca os dados oficiais (equipamento, fabricante, validade do certificado) e preenche o cadastro — digitação manual só como exceção. Cadastro digitado errado é ficha de entrega errada, e ficha errada não prova proteção em juízo.',
   'Catálogo de tipos de EPI disponível no ambiente de teste.',
   '[{"ordem":1,"acao":"Informar um número de CA no cadastro do tipo","resultado_esperado":"Dados do CA (equipamento, fabricante, validade) trazidos automaticamente da base oficial"},
     {"ordem":2,"acao":"Informar CA inexistente","resultado_esperado":"Cadastro apontado como não confirmado — não passa como válido em silêncio"},
     {"ordem":3,"acao":"Salvar o tipo","resultado_esperado":"ca_numero e ca_validade gravados e rastreáveis"}]'::jsonb,
   'CA digitado vira CA conferido — a fonte é a base oficial.',
   'Requisitos YE-DP-EPI-001: RF-001/RF-002 (busca CAEPI). epi_tipos já tem ca_numero e ca_validade; a BUSCA automática, a sonda confere.'),

  (v_mod, 'EPI-011', 'Validade do CA é vigiada: aviso antes de vencer, alerta no vencido',
   'negativo', 'critica', 'aprovado', 'api',
   'NR-6 (EPI só protege juridicamente com CA válido na data da entrega)',
   'Um CA vence e ninguém percebe: todo o estoque daquele tipo vira sucata jurídica de uma vez. O catálogo precisa vigiar ca_validade — avisar com antecedência ([VAL]) que o CA vai vencer, e marcar o tipo vencido de forma visível. A trava na ENTREGA é o SST-011; aqui o caso cobra o radar no CATÁLOGO, antes de chegar ao balcão.',
   'Tipo de EPI com CA próximo do vencimento no ambiente de teste.',
   '[{"ordem":1,"acao":"Cadastrar tipo com CA vencendo em 30 dias","resultado_esperado":"Alerta de renovação/recompra disparado com antecedência"},
     {"ordem":2,"acao":"Deixar o CA vencer","resultado_esperado":"Tipo sinalizado VENCIDO no catálogo e nos painéis — nunca silêncio"},
     {"ordem":3,"acao":"Atualizar o CA (renovação)","resultado_esperado":"Nova validade registrada com histórico da anterior"}]'::jsonb,
   'CA vencido no catálogo é recall — o sistema avisa antes.',
   'Requisitos YE-DP-EPI-001: RN-002 / RF-003. ca_validade existe em epi_tipos; a sonda do SST-011 já constatou que NADA a confere — aqui a cobrança é o monitoramento proativo.'),

  -- ══════════ B) ESTOQUE ══════════

  (v_mod, 'EPI-020', 'Estoque por tamanho e por local nunca fica negativo',
   'negativo', 'critica', 'aprovado', 'api',
   'Documento YE-DP-EPI-001, RN-003 (saldo negativo é proibido; estoque por unidade, tamanho e local)',
   'O estoque é por combinação tipo × tamanho × local — e a regra de ouro é que nenhuma saída pode deixar saldo negativo: entregar o que não existe é ficha de papel sem lastro físico. A baixa deve conferir o saldo da combinação exata (bota 42 do almoxarifado A, não "botas em geral").',
   'Estoque por tamanho/local com saldos conhecidos no ambiente de teste.',
   '[{"ordem":1,"acao":"Tentar entregar quantidade maior que o saldo do tamanho/local","resultado_esperado":"Operação bloqueada — saldo insuficiente apontado"},
     {"ordem":2,"acao":"Entregar dentro do saldo","resultado_esperado":"Baixa na combinação exata (tipo, tamanho, local), com movimentação registrada"},
     {"ordem":3,"acao":"Conferir o saldo após concorrência (duas entregas simultâneas)","resultado_esperado":"Controle otimista impede baixa dupla — saldo jamais negativo"}]'::jsonb,
   'Saldo negativo não existe no mundo físico — nem no sistema.',
   'Requisitos YE-DP-EPI-001: RN-003 / RF-006. O trigger atualizar_estoque_epi subtrai SEM conferir saldo e não há CHECK >= 0 — a sonda testa se o negativo passa.'),

  (v_mod, 'EPI-021', 'Saída respeita o FEFO: vence primeiro, sai primeiro',
   'feliz', 'media', 'aprovado', 'api',
   'Documento YE-DP-EPI-001, RN-004 (FEFO — first expire, first out)',
   'EPIs têm validade própria (além do CA): luvas ressecam, filtros saturam. A saída deve priorizar o lote que vence primeiro (FEFO), senão o estoque novo sai enquanto o antigo apodrece na prateleira — e vira perda ou, pior, entrega de item vencido.',
   'Dois lotes do mesmo tipo/tamanho com validades diferentes no ambiente de teste.',
   '[{"ordem":1,"acao":"Registrar entrega sem escolher lote","resultado_esperado":"O lote de validade mais próxima é sugerido/baixado primeiro"},
     {"ordem":2,"acao":"Forçar lote mais novo com o antigo ainda válido","resultado_esperado":"Aviso de quebra de FEFO — decisão consciente, registrada"},
     {"ordem":3,"acao":"Conferir o relatório de validade do estoque","resultado_esperado":"Lotes ordenados por vencimento, com os críticos destacados"}]'::jsonb,
   'A prateleira gira pelo vencimento, não pela chegada.',
   'Requisitos YE-DP-EPI-001: RN-004. epis.data_validade existe por item; ordenação FEFO na saída, a sonda confere.'),

  (v_mod, 'EPI-022', 'Estoque mínimo atingido vira reposição no Plano de Ação',
   'feliz', 'alta', 'aprovado', 'api',
   'Documento YE-DP-EPI-001, RF-018 (reposição/compra disparada via Plano de Ação)',
   'Estoque mínimo é parâmetro, não decoração: quando o saldo de um tipo/tamanho/local cruza o mínimo, o sistema abre a ação de reposição no módulo Plano de Ação — com o item, o saldo e o local. Ficar sem EPI em estoque é parar a operação (sem EPI o colaborador não pode trabalhar, NR-6).',
   'Tipo com estoque_minimo definido e saldo próximo do limite no ambiente de teste.',
   '[{"ordem":1,"acao":"Baixar o saldo até cruzar o mínimo","resultado_esperado":"Ação de reposição criada no Plano de Ação com item, saldo e local"},
     {"ordem":2,"acao":"Cruzar o mínimo de novo com ação aberta","resultado_esperado":"Sem duplicar — a ação existente é referenciada"},
     {"ordem":3,"acao":"Registrar a entrada da compra","resultado_esperado":"Saldo recomposto; ação concluída com evidência"}]'::jsonb,
   'O mínimo é o gatilho de compra — automático e sem duplicar.',
   'Requisitos YE-DP-EPI-001: RF-018 / RN-006. estoque_minimo (epi_tipos) e quantidade_minima (epi_estoque_local) existem; a PONTE com o Plano de Ação, a sonda confere.'),

  -- ══════════ C) ENTRADA POR NOTA FISCAL ══════════

  (v_mod, 'EPI-030', 'Entrada por NF: chave íntegra, sem nota duplicada, itens conciliados com o estoque',
   'feliz', 'alta', 'aprovado', 'api',
   'Documento YE-DP-EPI-001, RF-007/RF-008 (entrada por XML de NF-e; chave de acesso de 44 dígitos)',
   'A entrada de estoque nasce da NF: importado o XML, os itens são conciliados com o catálogo (qual item da nota é qual tipo/tamanho do estoque) e a entrada movimenta o saldo. A chave de acesso tem 44 dígitos e é única — a mesma nota lançada duas vezes dobra o estoque no papel.',
   'NF de compra de EPIs disponível para lançamento no ambiente de teste.',
   '[{"ordem":1,"acao":"Importar a NF (XML)","resultado_esperado":"Cabeçalho (chave 44 dígitos, fornecedor, emissão) e itens carregados para conciliação"},
     {"ordem":2,"acao":"Tentar importar a MESMA chave de novo","resultado_esperado":"Bloqueado — nota já lançada, sem dobrar estoque"},
     {"ordem":3,"acao":"Concluir a conciliação dos itens","resultado_esperado":"Entradas geradas por tipo/tamanho/local, movimentação amarrada à NF"}]'::jsonb,
   'Uma nota, uma entrada — com a chave como trava.',
   'Requisitos YE-DP-EPI-001: RF-007/RF-008. epi_notas_fiscais (chave_acesso) e epi_nf_itens (movimentacao_id) existem; unicidade da chave e validação dos 44 dígitos, a sonda confere.'),

  (v_mod, 'EPI-031', 'DANFE por foto/OCR com baixa confiança para na revisão humana',
   'alternativo', 'media', 'aprovado', 'e2e',
   'Documento YE-DP-EPI-001, RF-009 (OCR de DANFE com nível de confiança e revisão)',
   'Nem toda entrada chega em XML: a foto do DANFE passa por OCR/IA, e o que a máquina leu com baixa confiança NÃO entra direto no estoque — para na mesa de um humano. Quantidade lida errada vira estoque fantasma; a revisão é o cinto de segurança da importação.',
   'Tela de entrada por imagem de DANFE no ambiente de teste.',
   '[{"ordem":1,"acao":"Enviar foto de DANFE legível","resultado_esperado":"Itens extraídos com nível de confiança visível por campo"},
     {"ordem":2,"acao":"Enviar imagem ruim (baixa confiança)","resultado_esperado":"Entrada retida para revisão humana antes de movimentar estoque"},
     {"ordem":3,"acao":"Revisar, corrigir e aprovar","resultado_esperado":"Entrada efetivada com o revisor registrado na trilha"}]'::jsonb,
   'O que a máquina não leu com certeza, um humano confirma.',
   'Requisitos YE-DP-EPI-001: RF-009 / cenário "Nota por foto" (seção de cenários). Hoje epi_notas_fiscais.origem só aceita xml|manual — o fluxo OCR não existe. Caso de tela (Cypress).'),

  -- ══════════ D) ENTREGA, ASSINATURA E BIOMETRIA ══════════

  (v_mod, 'EPI-040', 'Item vencido não sai do almoxarifado',
   'negativo', 'critica', 'aprovado', 'api',
   'NR-6 (EPI em condições de uso; item vencido não protege)',
   'Além do CA (SST-011), o ITEM tem validade própria — e item vencido no estoque não pode ser entregue: a entrega deve ser bloqueada, o lote sinalizado para descarte/segregação. Entregar protetor vencido é igual a não entregar, com a agravante de parecer que entregou.',
   'Lote de EPI com data_validade vencida no estoque de teste.',
   '[{"ordem":1,"acao":"Tentar registrar entrega de lote vencido","resultado_esperado":"Bloqueada — validade do item é condição da saída"},
     {"ordem":2,"acao":"Conferir o painel de estoque","resultado_esperado":"Lote vencido segregado/sinalizado para descarte, fora do saldo entregável"},
     {"ordem":3,"acao":"Entregar de lote válido","resultado_esperado":"Sai normalmente, respeitando o FEFO (EPI-021)"}]'::jsonb,
   'Vencido não veste ninguém — sai do saldo entregável, não do almoxarifado.',
   'Requisitos YE-DP-EPI-001: RN-001 / CA de bloqueio de vencidos. epis.data_validade e epi_entregas.data_validade existem; a TRAVA na entrega, a sonda confere.'),

  (v_mod, 'EPI-041', 'Biometria facial da entrega é dado sensível: acesso mínimo, base legal e log',
   'negativo', 'critica', 'aprovado', 'api',
   'LGPD art. 5º, II (biometria = dado sensível) e art. 11 (tratamento restrito); documento YE-DP-EPI-001, RNF de privacidade (template protegido, RIPD, fluxo alternativo)',
   'A entrega com leitura facial guarda dado biométrico — a categoria mais sensível da LGPD. Isso exige: base legal documentada, acesso restrito (nem todo usuário do tenant pode ler o material biométrico), registro de quem consultou, e um FLUXO ALTERNATIVO digno para quem não consente (a recusa não pode impedir o colaborador de receber o EPI).',
   'Entregas com verificação facial registradas no ambiente de teste.',
   '[{"ordem":1,"acao":"Consultar uma entrega como usuário comum do tenant","resultado_esperado":"Dados biométricos (liveness, foto) NÃO expostos — camada de perfil restringe"},
     {"ordem":2,"acao":"Acessar como perfil autorizado","resultado_esperado":"Acesso funciona e fica LOGADO (quem, quando, qual registro)"},
     {"ordem":3,"acao":"Registrar entrega de colaborador que não consente com a biometria","resultado_esperado":"Fluxo alternativo (assinatura sem face) disponível — EPI entregue do mesmo jeito"}]'::jsonb,
   'Rosto é dado sensível: pouca gente vê, tudo fica logado, e ninguém fica sem EPI por recusar.',
   'Requisitos YE-DP-EPI-001: RNF de privacidade / RIPD. epi_entregas guarda liveness_data e foto_entrega_url, e a leitura é aberta ao tenant ("Usuários podem ver entregas de EPI do seu tenant") SEM política perfil_restringe_leitura_* — a sonda confere a lacuna (mesma família do FOLHA-090).'),

  (v_mod, 'EPI-042', 'Recibo de entrega com assinatura eletrônica avançada e trilha completa',
   'feliz', 'alta', 'aprovado', 'api',
   'Lei 14.063/2020 (assinatura avançada); MP 2.200-2/2001, art. 10, §2º (validade entre as partes); STJ REsp 2.159.442/PR (validade probatória)',
   'A ficha/recibo de EPI é prova documental: a assinatura eletrônica avançada precisa da trilha que a sustenta em juízo — quem assinou, quando (carimbo de tempo), de onde (IP, dispositivo) e a integridade do documento (hash). Sem a trilha, a assinatura vira imagem colada num PDF.',
   'Entrega registrada aguardando assinatura no ambiente de teste.',
   '[{"ordem":1,"acao":"Colher a assinatura do colaborador na entrega","resultado_esperado":"Assinatura gravada com signed_at, IP e dispositivo"},
     {"ordem":2,"acao":"Conferir a evidência","resultado_esperado":"Trilha completa recuperável (hash/carimbo/identificação) — padrão de ADM-070/DESL-082"},
     {"ordem":3,"acao":"Emitir a ficha de EPI do colaborador","resultado_esperado":"Histórico completo de entregas com as assinaturas, pronto para fiscalização"}]'::jsonb,
   'Assinatura que não se prova é papel em branco.',
   'Requisitos YE-DP-EPI-001: RN-011 / RF-013. epi_entregas já tem assinatura_url, ip_address, user_agent e signed_at — a sonda confere se a trilha é obrigatória ou opcional. Assinatura qualificada ICP-Brasil é opcional no documento.'),

  (v_mod, 'EPI-043', 'A baixa de estoque só acontece DEPOIS da assinatura — antes é reserva',
   'negativo', 'alta', 'aprovado', 'api',
   'Documento YE-DP-EPI-001, RN-005 (baixa condicionada à assinatura; reserva e estorno)',
   'A regra de ouro do fluxo: registrar a entrega RESERVA o item; a baixa definitiva só ocorre com a assinatura do colaborador. Entrega não assinada em prazo é estornada — o item volta ao saldo. Baixar antes de assinar cria o pior dos mundos: estoque sem item e ficha sem prova.',
   'Fluxo de entrega com etapa de assinatura no ambiente de teste.',
   '[{"ordem":1,"acao":"Registrar a entrega (antes da assinatura)","resultado_esperado":"Item RESERVADO — saldo disponível reduzido, baixa definitiva pendente"},
     {"ordem":2,"acao":"Colher a assinatura","resultado_esperado":"Baixa definitiva efetivada, movimentação amarrada à entrega assinada"},
     {"ordem":3,"acao":"Deixar a assinatura expirar","resultado_esperado":"Reserva estornada — item de volta ao saldo, entrega cancelada com rastro"}]'::jsonb,
   'Sem assinatura não há baixa — há reserva com prazo.',
   'Requisitos YE-DP-EPI-001: RN-005. HOJE o trigger atualizar_estoque_epi baixa no INSERT da entrega, ANTES de qualquer assinatura (signed_at nem existia no fluxo do trigger) — a sonda documenta a divergência.'),

  (v_mod, 'EPI-044', 'Ficha e recibo assinados moram no módulo Documentos, pelo prazo da casa',
   'feliz', 'media', 'aprovado', 'api',
   'Documento YE-DP-EPI-001, RN-012 (guarda nativa no módulo Documentos; prazo de guarda é parâmetro [VAL])',
   'A ficha de EPI assinada não fica solta num bucket: ela é arquivada no módulo Documentos, na pasta do colaborador, e respeita o prazo de guarda configurado (parâmetro da casa — a obrigação trabalhista pede guarda longa). Documento que a fiscalização pede e ninguém acha é documento que não existe.',
   'Entrega assinada com ficha emitida no ambiente de teste.',
   '[{"ordem":1,"acao":"Concluir uma entrega assinada","resultado_esperado":"Ficha/recibo arquivado no módulo Documentos, pasta do colaborador"},
     {"ordem":2,"acao":"Buscar a ficha pela pasta do colaborador","resultado_esperado":"Documento localizável com metadados (tipo, data, assinatura)"},
     {"ordem":3,"acao":"Conferir a política de guarda","resultado_esperado":"Prazo de guarda parametrizado aplicado — nada é descartado antes"}]'::jsonb,
   'A ficha tem endereço fixo: a pasta do colaborador no módulo Documentos.',
   'Requisitos YE-DP-EPI-001: RN-012 / RF-014. A estrutura de pastas por colaborador existe (gerar_estrutura_padrao_pastas); a ponte entrega→Documentos, a sonda confere.'),

  -- ══════════ E) CICLO DE VIDA ══════════

  (v_mod, 'EPI-050', 'Troca periódica: o EPI tem vida útil e o sistema cobra a substituição',
   'feliz', 'media', 'aprovado', 'api',
   'NR-6 (substituir imediatamente quando danificado ou extraviado; vida útil conforme fabricante); documento YE-DP-EPI-001, RF-016 [RCC]',
   'Cada tipo de EPI tem periodicidade de troca (vida útil): entregue hoje, o sistema calcula quando vence o uso e cobra a substituição — sem esperar o colaborador pedir. Protetor auricular com a espuma vencida protege tanto quanto nenhum; a troca proativa é a diferença entre gestão e almoxarifado.',
   'Tipo com periodicidade_troca_dias definida e entrega registrada no ambiente de teste.',
   '[{"ordem":1,"acao":"Registrar entrega de tipo com troca a cada 180 dias","resultado_esperado":"Data prevista de troca calculada na entrega"},
     {"ordem":2,"acao":"Aproximar-se do vencimento do uso","resultado_esperado":"Substituição pendente apontada (colaborador × item), com antecedência [VAL]"},
     {"ordem":3,"acao":"Registrar a troca","resultado_esperado":"Novo ciclo iniciado; item anterior recolhido/baixado com rastro"}]'::jsonb,
   'EPI não é vitalício — o sistema conta os dias de uso.',
   'Requisitos YE-DP-EPI-001: RF-016 (regra configurável por cliente [RCC]). periodicidade_troca_dias existe em epi_tipos e data_devolucao_prevista em epi_entregas; o MOTOR que vigia e cobra, a sonda confere.'),

  (v_mod, 'EPI-051', 'Kit de admissão: função de risco gera a entrega inicial automaticamente',
   'feliz', 'media', 'aprovado', 'api',
   'NR-6 c/c NR-1 (fornecimento antes do início da exposição); documento YE-DP-EPI-001, RF-020',
   'Admitido para função com riscos, o colaborador precisa do kit ANTES do primeiro dia de exposição: o sistema deriva da função (PGR/ficha por função) os EPIs exigidos e abre a entrega inicial como pendência da admissão — ninguém começa a trabalhar desprotegido porque o RH esqueceu o capacete.',
   'Função com EPIs exigidos mapeados; admissão em andamento no ambiente de teste.',
   '[{"ordem":1,"acao":"Concluir admissão em função com EPIs exigidos","resultado_esperado":"Kit inicial gerado como pendência de entrega (tipos e tamanhos a colher)"},
     {"ordem":2,"acao":"Registrar as entregas do kit","resultado_esperado":"Pendência baixada; fichas assinadas por item"},
     {"ordem":3,"acao":"Tentar ativar colaborador com kit pendente","resultado_esperado":"Pendência visível no painel — exposição sem EPI nunca passa em silêncio"}]'::jsonb,
   'Função de risco admite com o kit na mão — automático, não de memória.',
   'Requisitos YE-DP-EPI-001: RF-020. epi_tipos.obrigatorio_para_funcoes existe; a geração automática do kit na admissão, a sonda confere. A ficha por função é o SST-011.'),

  (v_mod, 'EPI-052', 'Rescisão e afastamento cobram a devolução dos EPIs — sem reter direitos',
   'alternativo', 'alta', 'aprovado', 'api',
   'Documento YE-DP-EPI-001, RN-014 (checklist de devolução; a pendência NÃO impede verbas nem homologação)',
   'No desligamento (e no afastamento longo), os EPIs em posse do colaborador entram num checklist de devolução: o que volta é recebido e reintegrado/descartado, o que não volta é registrado. O equilíbrio é fino: a empresa cobra a devolução, mas a pendência NÃO pode reter verbas rescisórias nem travar a homologação — desconto só nos limites da lei (CLT art. 462, com acordo).',
   'Colaborador com EPIs ativos entrando em desligamento no ambiente de teste.',
   '[{"ordem":1,"acao":"Iniciar o desligamento","resultado_esperado":"Checklist de devolução gerado com os EPIs em posse (entregas ativas)"},
     {"ordem":2,"acao":"Registrar devolução parcial","resultado_esperado":"Devolvidos reintegrados/descartados conforme estado; não devolvidos registrados"},
     {"ordem":3,"acao":"Concluir a rescisão com pendência de devolução","resultado_esperado":"Rescisão SEGUE (verbas e prazos intactos); pendência documentada para tratativa"}]'::jsonb,
   'A empresa cobra o capacete de volta — mas nunca segurando o acerto.',
   'Requisitos YE-DP-EPI-001: RN-014 / RF-015. epi_entregas tem data_devolucao_prevista/efetiva e o trigger devolve ao saldo no status devolvido; o CHECKLIST no desligamento/afastamento, a sonda confere. Prazos da rescisão são o DESL-030s.'),

  (v_mod, 'EPI-060', 'Modo offline no almoxarifado: registra sem rede, sincroniza sem duplicar',
   'alternativo', 'media', 'aprovado', 'e2e',
   'Documento YE-DP-EPI-001, RNF de disponibilidade (operação offline no ponto de entrega)',
   'O balcão do almoxarifado nem sempre tem rede — e a entrega não pode esperar o wi-fi. O registro offline guarda a operação localmente (com a assinatura) e sincroniza quando a rede volta, sem duplicar movimentação nem perder assinatura. Conflito de saldo na sincronização é apontado, não engolido.',
   'Ponto de entrega operando sem conexão no ambiente de teste.',
   '[{"ordem":1,"acao":"Registrar entrega sem rede","resultado_esperado":"Operação guardada localmente com assinatura colhida"},
     {"ordem":2,"acao":"Restabelecer a conexão","resultado_esperado":"Sincronização automática — movimentação única, sem duplicar"},
     {"ordem":3,"acao":"Sincronizar com saldo divergente","resultado_esperado":"Conflito apontado para conciliação humana — saldo jamais negativo"}]'::jsonb,
   'Sem rede a entrega acontece; com rede ela se acerta — uma vez só.',
   'Requisitos YE-DP-EPI-001: RNF de operação offline. Caso de tela/PWA (Cypress) — o motor confere apenas os efeitos (unicidade de movimentação).')

  ON CONFLICT (codigo) DO NOTHING;

  SELECT count(*) INTO v_depois FROM public.qa_casos_teste WHERE modulo_id = v_mod;
  RAISE NOTICE 'EPI (requisitos YE-DP-EPI-001): casos antes=%, depois=% (esperado +16 na primeira execução).', v_antes, v_depois;
END $doc$;

-- ── Referências cruzadas (sem duplicar cobertura) ──
DO $xref$
BEGIN
  UPDATE public.qa_casos_teste SET observacoes = observacoes ||
    ' | Requisitos YE-DP-EPI-001: a família EPI ganhou 16 casos novos (EPI-010..060) — este caso segue dono da baixa de estoque na entrega; a regra nova RN-005 (baixa só após assinatura) é o EPI-043.'
  WHERE codigo = 'EPI-001' AND position('YE-DP-EPI-001' IN observacoes) = 0;

  UPDATE public.qa_casos_teste SET observacoes = observacoes ||
    ' | Requisitos YE-DP-EPI-001: segue dono da TRAVA de CA vigente na entrega e da ficha por função; o monitoramento da validade no catálogo é o EPI-011, e o bloqueio de ITEM vencido é o EPI-040.'
  WHERE codigo = 'SST-011' AND position('YE-DP-EPI-001' IN observacoes) = 0;

  UPDATE public.qa_casos_teste SET observacoes = observacoes ||
    ' | Requisitos YE-DP-EPI-001 (RF-017): o EPI eficaz informado no S-2240 nasce das entregas da família EPI — este caso segue dono do evento.'
  WHERE codigo = 'SST-031' AND position('YE-DP-EPI-001' IN observacoes) = 0;

  UPDATE public.qa_casos_teste SET observacoes = observacoes ||
    ' | Requisitos YE-DP-EPI-001: a neutralização do adicional por EPI eficaz segue aqui; a gestão da entrega/ficha que a sustenta é a família EPI (EPI-040..044).'
  WHERE codigo = 'SST-050' AND position('YE-DP-EPI-001' IN observacoes) = 0;

  UPDATE public.qa_casos_teste SET observacoes = observacoes ||
    ' | Requisitos YE-DP-EPI-001: o padrão de assinatura eletrônica com trilha vale também para o recibo de EPI (EPI-042).'
  WHERE codigo IN ('ADM-070','DESL-082') AND position('YE-DP-EPI-001' IN observacoes) = 0;

  RAISE NOTICE 'Referências cruzadas YE-DP-EPI-001 registradas (EPI-001, SST-011/031/050, ADM-070, DESL-082).';
END $xref$;
