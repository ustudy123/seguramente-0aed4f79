-- =========================================================
-- QA — Folha de Pagamento: casos derivados da Análise de Requisitos
-- do módulo (documento YE-DP-FOLHA-001, Google Doc "YE — Folha de
-- Pagamento — Análise de Requisitos", data-base ago/2026).
--
-- MÉTODO: as 10 regras de negócio (RN-001..010), os 10 critérios de
-- aceite (CA-001..010) e os 12 cenários de teste (seção 25) foram
-- cruzados com o que já existe no motor. A folha NÃO tinha família
-- própria — as telas vivem em Financeiro (Financeiro.tsx e abas) e o
-- cálculo em src/lib/folha/ (calculos.ts, adicionais.ts,
-- horas-extras.ts). Como sempre: os casos descrevem o que a LEI e o
-- documento exigem, não o que o sistema faz hoje.
--
-- JÁ COBERTO EM OUTRAS FAMÍLIAS (referência cruzada, sem duplicar):
--   Apuração de horas/HE/noturno na origem ...... família PONTO (jornada)
--   Férias: remuneração, 1/3, prazos ............ família FERIAS
--   13º: parcelas, encargos, prazos ............. família DEC13
--   Rescisão: verbas, incidências, médias ....... DESL-045/046 e família
--   Anti-duplicidade do eSocial ................. ADM-093/FERIAS-081/
--                                                 DEC13-050/DESL-094
--   Calendário de obrigações do escritório ...... família HCAL (Hub)
--
-- PONTOS BONS já visíveis (as sondas confirmarão): folha_periodos tem
-- UNIQUE(tenant, competência), status com ciclo e RLS por papel
-- (manager+); folha_tabelas_inss/irrf são versionadas por vigência;
-- folha_rubricas tem incidências e UNIQUE de código.
--
-- DIVERGÊNCIAS já visíveis (casos devem falhar e encaminhar):
--   - classificacao_esocial (S-1010) é NULLABLE e nada bloqueia cálculo
--     de rubrica sem incidência definida (CA-001);
--   - rubricas não têm vigência/versionamento (RNF-002);
--   - não há motor do 5º dia útil nem do dia 15 (S-1299) no banco;
--   - encargos patronais (RAT×FAP, terceiros, regime) não existem;
--   - não há folha complementar nem trava de reabertura de competência
--     fechada; conciliação com Ponto/Férias/13º não existe no banco.
--
-- ESTA MIGRATION SÓ DOCUMENTA (módulo novo + 19 casos). Rotinas em
-- leva futura, como nas famílias anteriores.
-- =========================================================

SET lock_timeout = '10s';

-- Módulo próprio, filho de Financeiro (irmão do 13º Salário)
INSERT INTO public.qa_modulos (parent_id, label, path, prioridade_doc, status_doc)
SELECT m.id, 'Folha de Pagamento', 'financeiro/folha-pagamento', 1, 'em_andamento'
FROM public.qa_modulos m
WHERE m.path = 'financeiro'
ON CONFLICT (path) DO NOTHING;

DO $doc$
DECLARE v_mod uuid; v_antes int; v_depois int;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos
  WHERE path = 'financeiro/folha-pagamento';
  IF v_mod IS NULL THEN RAISE EXCEPTION 'Módulo financeiro/folha-pagamento não encontrado.'; END IF;
  SELECT count(*) INTO v_antes FROM public.qa_casos_teste WHERE modulo_id = v_mod;

  INSERT INTO public.qa_casos_teste
    (modulo_id, codigo, titulo, tipo, prioridade, status, nivel,
     base_legal, objetivo, pre_condicoes, passos, resultado_esperado, observacoes)
  VALUES

  -- ══════════ A) RUBRICAS E INCIDÊNCIAS (S-1010) ══════════

  (v_mod, 'FOLHA-001', 'Rubrica sem natureza/incidência do eSocial não entra no cálculo',
   'negativo', 'critica', 'aprovado', 'api',
   'eSocial — S-1010 (tabela de rubricas: natureza e incidências de INSS/FGTS/IRRF)',
   'A rubrica é a menor peça da folha, e cada uma precisa da natureza do eSocial (S-1010) e das incidências definidas ANTES de gerar valor: rubrica sem classificação que entra no cálculo produz base errada de INSS/FGTS/IRRF e evento rejeitado — ou pior, aceito com tributo errado. O documento é explícito (CA-001): sem incidência, o cálculo BLOQUEIA e pede a definição.',
   'Rubrica nova criada sem classificacao_esocial e sem incidências marcadas.',
   '[{"ordem":1,"acao":"Criar rubrica sem natureza do eSocial e sem incidências","resultado_esperado":"Aceita como rascunho, mas sinalizada como incompleta"},
     {"ordem":2,"acao":"Lançar valor com essa rubrica e processar a folha","resultado_esperado":"Cálculo bloqueado citando a rubrica pendente — não processa por cima"},
     {"ordem":3,"acao":"Definir natureza e incidências e reprocessar","resultado_esperado":"Cálculo liberado, com as bases refletindo a definição"}]'::jsonb,
   'Rubrica incompleta trava a folha — nunca tributa no chute.',
   'Requisitos YE-DP-FOLHA-001: RN-001 / CA-001 / cenário "Dado ausente" (seção 25). DIVERGÊNCIA VISÍVEL: folha_rubricas.classificacao_esocial é NULLABLE e nada impede o cálculo. Deve falhar e encaminhar.'),

  (v_mod, 'FOLHA-002', 'Tabela de rubricas versionada: mudança cria vigência, não sobrescreve',
   'alternativo', 'alta', 'aprovado', 'api',
   'Documento YE-DP-FOLHA-001, RNF-002; eSocial S-1010 (vigências de rubrica)',
   'Mudar a incidência de uma rubrica não pode reescrever o passado: a folha de março foi calculada com a regra de março, e reproduzi-la (RNF-007) exige saber qual regra valia lá. A tabela de rubricas precisa de vigência — alteração encerra a versão anterior e abre a nova — e o S-1010 espelha exatamente esse desenho de períodos de validade.',
   'Rubrica ativa usada em folhas passadas; alteração de incidência solicitada.',
   '[{"ordem":1,"acao":"Alterar a incidência de INSS de uma rubrica usada em competências fechadas","resultado_esperado":"Nova vigência criada; a definição antiga preservada com o período dela"},
     {"ordem":2,"acao":"Reproduzir o cálculo de uma competência antiga","resultado_esperado":"Usa a versão vigente NAQUELA competência, não a atual"}]'::jsonb,
   'Rubrica tem história; o recálculo de ontem usa a regra de ontem.',
   'Requisitos YE-DP-FOLHA-001: RNF-002/RNF-007 / seção 23 (parametrização versionada). DIVERGÊNCIA VISÍVEL: folha_rubricas não tem vigência — UPDATE sobrescreve a definição para todas as épocas. As tabelas de INSS/IRRF já são versionadas; falta o mesmo desenho nas rubricas.'),

  -- ══════════ B) ENCARGOS DO EMPREGADO ══════════

  (v_mod, 'FOLHA-010', 'INSS do empregado: tabela progressiva por faixas com teto',
   'feliz', 'critica', 'aprovado', 'e2e',
   'Lei 8.212/1991; tabela progressiva vigente (7,5% a 14%) e teto do salário de contribuição',
   'O INSS do empregado é PROGRESSIVO: cada faixa da tabela vigente tributa só a fatia do salário dentro dela (7,5% a 14%), e acima do teto do salário de contribuição não há mais desconto. Aplicar a alíquota da faixa sobre o salário inteiro — o erro clássico — desconta a mais; ignorar o teto desconta de quem já passou dele.',
   'Vínculos fictícios com salários em faixas diferentes, inclusive acima do teto.',
   '[{"ordem":1,"acao":"Calcular INSS de salário na 2ª faixa","resultado_esperado":"Progressão: 7,5% na fatia da 1ª faixa + alíquota da 2ª só na fatia dela"},
     {"ordem":2,"acao":"Calcular INSS de salário acima do teto","resultado_esperado":"Contribuição limitada ao teto (valor máximo da tabela vigente)"},
     {"ordem":3,"acao":"Conferir a fonte das faixas","resultado_esperado":"folha_tabelas_inss vigente na competência — nunca valor fixo em código"}]'::jsonb,
   'Faixa por faixa até o teto — e a tabela vem do banco, versionada.',
   'Requisitos YE-DP-FOLHA-001: RN-007 / CA-002. calcularINSS existe no React com faixas; o caso confere progressão, teto e uso da tabela versionada. Valores 2026 são [VAL] (seção 30).'),

  (v_mod, 'FOLHA-011', 'IRRF: tabela vigente com redutor da Lei 15.270 e deduções',
   'feliz', 'critica', 'aprovado', 'e2e',
   'Tabela progressiva do IRRF; Lei 15.270/2025 (redutor/faixa de isenção ampliada); deduções legais (dependentes, INSS, pensão)',
   'O IRRF parte da base depois das deduções — INSS do próprio mês, dependentes (valor por dependente da tabela), pensão judicial — e aplica a tabela progressiva vigente COM o redutor da Lei 15.270/2025 (faixa de isenção ampliada). Tabela desatualizada ou redutor esquecido retém imposto de quem a lei isentou — erro que aparece na malha do colaborador, não da empresa.',
   'Vínculos fictícios com e sem dependentes, em faixas distintas, inclusive na faixa isenta ampliada.',
   '[{"ordem":1,"acao":"Calcular IRRF de salário na faixa de isenção ampliada","resultado_esperado":"Imposto zero pelo redutor da Lei 15.270 — não pela tabela antiga"},
     {"ordem":2,"acao":"Calcular com 2 dependentes","resultado_esperado":"Dedução por dependente aplicada antes da tabela"},
     {"ordem":3,"acao":"Conferir a fonte","resultado_esperado":"folha_tabelas_irrf vigente na competência, com o redutor parametrizado"}]'::jsonb,
   'Deduz primeiro, tributa depois — pela tabela e pelo redutor vigentes.',
   'Requisitos YE-DP-FOLHA-001: RN-008 / CA-003. calcularIRRF existe no React; o caso confere deduções, redutor e versionamento. Tabela/redutor são [VAL] (seção 30).'),

  -- ══════════ C) ADICIONAIS E DSR ══════════

  (v_mod, 'FOLHA-020', 'Adicional noturno urbano: 20% e hora reduzida de 52min30s',
   'feliz', 'alta', 'aprovado', 'e2e',
   'CLT, art. 73 e §1º (adicional de 20%; hora noturna de 52min30s entre 22h e 5h)',
   'O noturno urbano tem DUAS vantagens cumulativas: o adicional de 20% e a hora ficta de 52min30s — 7 horas no relógio valem 8 para pagamento. A folha que aplica só o percentual paga a menos; o Ponto apura as horas noturnas (família PONTO cobre a apuração), e a folha precisa aplicar a redução E o adicional sobre elas, com prorrogação após as 5h quando a jornada é integralmente noturna.',
   'Horas noturnas apuradas pelo Ponto para vínculo com jornada 22h-5h.',
   '[{"ordem":1,"acao":"Calcular a folha do vínculo noturno","resultado_esperado":"Horas convertidas pela hora reduzida (÷ 52,5min) E adicional de 20% sobre elas"},
     {"ordem":2,"acao":"Jornada integralmente noturna que avança após as 5h","resultado_esperado":"Prorrogação também com adicional (Súmula 60, II do TST)"},
     {"ordem":3,"acao":"CCT com percentual maior parametrizado","resultado_esperado":"Percentual da convenção aplicado no lugar dos 20%"}]'::jsonb,
   'Hora menor no relógio, valor maior no bolso — os dois efeitos, sempre.',
   'Requisitos YE-DP-FOLHA-001: RN-004 / CA-004. A APURAÇÃO das horas é da família PONTO; aqui se testa o REFLEXO na folha (calcularFolhaMensal já recebe adicionalNoturno com hora reduzida — conferir o efeito fim a fim).'),

  (v_mod, 'FOLHA-021', 'Insalubridade por grau e periculosidade de 30%: laudo manda, prevalência decide',
   'alternativo', 'alta', 'aprovado', 'e2e',
   'CLT, arts. 192 (10/20/40% por grau) e 193, §2º (30% sobre o salário-base; opção pelo mais favorável)',
   'Os adicionais de risco nascem do LAUDO (SST): insalubridade em 10%, 20% ou 40% conforme o grau — sobre base parametrizada, já que mínimo × salário × piso da CCT é controvérsia viva [VAL] — e periculosidade em 30% sobre o salário-base. Quem faz jus aos dois não acumula: opta pelo mais favorável (§2º do art. 193), e o sistema deve calcular os dois e aplicar a prevalência.',
   'Vínculo com laudo de insalubridade grau médio e outro com periculosidade; um terceiro com direito aos dois.',
   '[{"ordem":1,"acao":"Calcular a folha do insalubre grau médio","resultado_esperado":"20% sobre a base parametrizada, citando o laudo de origem"},
     {"ordem":2,"acao":"Calcular a folha do periculoso","resultado_esperado":"30% sobre o salário-base"},
     {"ordem":3,"acao":"Vínculo com os dois direitos","resultado_esperado":"Prevalece o mais favorável — nunca a soma"}]'::jsonb,
   'O laudo define o direito; a prevalência escolhe o maior; a base é parâmetro.',
   'Requisitos YE-DP-FOLHA-001: RN-004/RN-005 / CA-005 / fluxo "Insalubridade/periculosidade" (seção 9). O motor existe em src/lib/folha/adicionais.ts (com prevalência) — o caso confere o fim a fim com laudo do SST. Base da insalubridade é [VAL]/[RCC] (seção 30).'),

  (v_mod, 'FOLHA-022', 'DSR: variáveis refletem no repouso; falta injustificada o derruba',
   'feliz', 'alta', 'aprovado', 'e2e',
   'Lei 605/1949, arts. 6º e 7º (remuneração do repouso; perda pela falta injustificada); Súmula 172 do TST (reflexo das HE)',
   'O repouso semanal remunerado tem dois movimentos que a folha precisa dominar: quem tem variáveis (HE, comissões, adicional noturno) recebe o REFLEXO delas no DSR — média dos dias úteis aplicada aos repousos —, e quem falta sem justificativa na semana PERDE a remuneração do repouso daquela semana. Só o primeiro sem o segundo paga a mais; só o segundo sem o primeiro paga a menos.',
   'Vínculo com horas extras habituais no mês e uma falta injustificada em uma das semanas.',
   '[{"ordem":1,"acao":"Calcular o DSR do mês com variáveis","resultado_esperado":"Reflexo das HE/variáveis nos repousos (variáveis ÷ dias úteis × domingos/feriados)"},
     {"ordem":2,"acao":"Conferir a semana da falta injustificada","resultado_esperado":"DSR daquela semana descontado — perda pela falta (Lei 605, art. 6º)"},
     {"ordem":3,"acao":"Falta justificada por atestado","resultado_esperado":"DSR preservado — justificada não derruba o repouso"}]'::jsonb,
   'Variável reflete, injustificada derruba, justificada preserva.',
   'Requisitos YE-DP-FOLHA-001: RN-006 / cenário "Adicionais" (seção 25). As faltas vêm do Ponto (família PONTO); aqui se testa o efeito no DSR da folha. calcularFolhaMensal já recebe dsr — conferir os dois sentidos.'),

  -- ══════════ D) DESCONTOS ══════════

  (v_mod, 'FOLHA-030', 'Descontos só nos limites do art. 462: VT até 6%, sindical só autorizado',
   'negativo', 'critica', 'aprovado', 'api',
   'CLT, art. 462; Lei 7.418/1985 (VT até 6% do salário-base); Lei 13.467/2017 (contribuição sindical facultativa)',
   'Desconto em folha é exceção, não regra: só o previsto em lei, em instrumento coletivo ou adiantamento — e cada um com seu teto. O VT desconta no máximo 6% do salário-base; a contribuição sindical, desde a reforma, SÓ com autorização expressa do empregado. Lançamento de desconto fora dessas hipóteses tem que ser barrado na entrada, não descoberto na reclamatória.',
   'Vínculo com salário conhecido; lançamentos de desconto de VT acima de 6% e de sindical sem autorização.',
   '[{"ordem":1,"acao":"Lançar desconto de VT de 8% do salário","resultado_esperado":"Recusado ou limitado a 6% — o excedente é custo da empresa"},
     {"ordem":2,"acao":"Lançar desconto sindical sem autorização registrada","resultado_esperado":"Bloqueado — exige a autorização expressa (Lei 13.467)"},
     {"ordem":3,"acao":"Lançar desconto sem amparo (nem lei, nem CCT, nem adiantamento)","resultado_esperado":"Bloqueado citando o art. 462"}]'::jsonb,
   'Todo desconto tem amparo e teto — ou não entra na folha.',
   'Requisitos YE-DP-FOLHA-001: RN-003 / CA-009 / cenário "Desconto" (seção 25). folha_lancamentos aceita qualquer DESCONTO hoje (tipo + valor livres) — as travas devem falhar e encaminhar. Tipos/limites parametrizados [DAE]/[RCC].'),

  -- ══════════ E) PRAZOS E HOLERITE ══════════

  (v_mod, 'FOLHA-040', 'Pagamento até o 5º dia útil, com alerta antes e atraso acusado',
   'feliz', 'critica', 'aprovado', 'api',
   'CLT, art. 459, §1º (pagamento até o 5º dia útil do mês subsequente)',
   'O 5º dia útil é prazo de contagem própria (sábado conta como útil para este fim, domingo e feriado não) e o motor de datas precisa calculá-lo por competência, alertar na aproximação (D-3/2/1) e ACUSAR o pagamento registrado depois dele — atraso salarial habitual é infração e fundamento para rescisão indireta.',
   'Competência fechada com data de pagamento programada; calendário de feriados carregado.',
   '[{"ordem":1,"acao":"Abrir a competência","resultado_esperado":"5º dia útil calculado pelo calendário (sábado conta, domingo/feriado não)"},
     {"ordem":2,"acao":"Aproximar-se do prazo sem pagamento","resultado_esperado":"Alertas D-3/2/1 a DP e Financeiro, prioridade crítica"},
     {"ordem":3,"acao":"Registrar pagamento após o 5º dia útil","resultado_esperado":"Atraso acusado com trilha — nunca aceitação silenciosa"}]'::jsonb,
   'O prazo se calcula sozinho, avisa antes e denuncia depois.',
   'Requisitos YE-DP-FOLHA-001: RN-002 / CA-008 / alerta "Pagamento a vencer" (seção 14). DIVERGÊNCIA VISÍVEL: folha_alertas_prazo é semeada pela TELA com datas aproximadas (dia 7 fixo ≠ 5º dia útil) e nenhuma função calcula o dia útil real. Deve falhar e encaminhar.'),

  (v_mod, 'FOLHA-041', 'Holerite discrimina cada parcela e chega só ao próprio colaborador',
   'feliz', 'alta', 'aprovado', 'e2e',
   'CLT, art. 464 (pagamento contra recibo com discriminação das parcelas); LGPD (acesso ao próprio dado)',
   'O holerite é o recibo legal do pagamento: discrimina TODAS as parcelas — proventos, descontos, bases e encargos — batendo com a memória de cálculo, fica arquivado na pasta do colaborador e acessível SÓ a ele no portal (e aos papéis da folha). Holerite genérico não prova quitação; holerite vazado é incidente de LGPD.',
   'Folha calculada e aprovada para a competência.',
   '[{"ordem":1,"acao":"Gerar os holerites da competência","resultado_esperado":"Cada parcela discriminada (rubrica, referência, valor), batendo com a memória"},
     {"ordem":2,"acao":"Colaborador acessa o portal","resultado_esperado":"Vê e baixa SÓ o próprio holerite"},
     {"ordem":3,"acao":"Conferir o arquivamento","resultado_esperado":"Holerite na pasta Funcionário › Folha › Holerites, com metadados"}]'::jsonb,
   'Tudo discriminado, arquivado, e cada um enxerga só o seu.',
   'Requisitos YE-DP-FOLHA-001: RN-002 / CA-008 / seção 16 / cenário "Permissões insuficientes" (seção 25). folha_itens guarda o cálculo por vínculo — conferir a geração do recibo e o recorte de acesso (par do DEC13-071 e DESL-110).'),

  -- ══════════ F) ENCARGOS PATRONAIS E REGIME ══════════

  (v_mod, 'FOLHA-050', 'Encargos patronais: 20% + RAT×FAP + terceiros, parametrizados por empresa',
   'feliz', 'alta', 'aprovado', 'api',
   'Lei 8.212/1991, art. 22 (patronal de 20%); RAT (1/2/3%) × FAP (0,5-2,0); terceiros/Sistema S por FPAS',
   'A folha não termina no líquido do colaborador: a empresa deve a patronal de 20%, o RAT ajustado pelo FAP (que muda por empresa e por ano) e os terceiros conforme o FPAS da atividade. Esses percentuais são PARÂMETROS por empresa/estabelecimento com vigência — sem eles não há guia da DCTFWeb correta nem provisão de custo confiável.',
   'Empresa fictícia com RAT, FAP e FPAS parametrizados.',
   '[{"ordem":1,"acao":"Calcular os encargos patronais da competência","resultado_esperado":"20% + RAT×FAP + terceiros sobre as bases corretas, com memória"},
     {"ordem":2,"acao":"Alterar o FAP da empresa (novo ano)","resultado_esperado":"Nova vigência de parâmetro; competências antigas preservam o FAP da época"},
     {"ordem":3,"acao":"Conferir o custo total no painel","resultado_esperado":"Custo empregador = salários + encargos patronais, por estabelecimento"}]'::jsonb,
   'O custo real da folha inclui o que o colaborador nunca vê.',
   'Requisitos YE-DP-FOLHA-001: RN-007 / RNF-002. DIVERGÊNCIA VISÍVEL: não existe estrutura de encargos patronais (RAT/FAP/terceiros) no banco — só o INSS do empregado. Deve falhar e encaminhar.'),

  (v_mod, 'FOLHA-051', 'Regime tributário muda os encargos: Simples e desoneração como exceção',
   'alternativo', 'media', 'aprovado', 'api',
   'LC 123/2006 (Simples Nacional — anexos sem patronal sobre a folha); Lei 12.546/2011 (CPRB — desoneração)',
   'O encargo patronal depende do ENQUADRAMENTO: empresa do Simples (na maioria dos anexos) não recolhe a patronal sobre a folha; setor desonerado recolhe CPRB sobre a receita em vez da patronal. O regime é parâmetro por empresa/estabelecimento com vigência — aplicá-lo errado gera ou encargo indevido (custo fantasma) ou guia a menor (autuação).',
   'Empresas fictícias em regimes distintos (Lucro Real, Simples, desonerada).',
   '[{"ordem":1,"acao":"Calcular a folha da empresa do Simples","resultado_esperado":"Sem patronal de 20% sobre a folha (conforme o anexo parametrizado)"},
     {"ordem":2,"acao":"Calcular a folha da empresa desonerada","resultado_esperado":"CPRB sinalizada no lugar da patronal; folha marca a exceção"},
     {"ordem":3,"acao":"Mudar o regime no meio do ano","resultado_esperado":"Nova vigência; competências passadas mantêm o regime da época"}]'::jsonb,
   'O regime da empresa decide o encargo — e fica registrado por vigência.',
   'Requisitos YE-DP-FOLHA-001: RN-009 / RNF-010 / cenário "Regime" (seção 25). Enquadramento é [RCE]/[VAL] (seção 30). Depende do FOLHA-050 (estrutura de encargos patronais).'),

  -- ══════════ G) FECHAMENTO, eSOCIAL E GUIAS ══════════

  (v_mod, 'FOLHA-060', 'Fechamento: S-1200 e S-1210 por vínculo e S-1299 até o dia 15',
   'feliz', 'critica', 'aprovado', 'api',
   'eSocial — S-1200 (remuneração), S-1210 (pagamentos), S-1299 (fechamento dos periódicos, em regra até o dia 15 do mês seguinte)',
   'A competência aprovada vira eventos: S-1200 por vínculo (remuneração por rubrica), S-1210 dos pagamentos e o S-1299 que FECHA os periódicos — em regra até o dia 15 do mês seguinte — e libera a apuração na DCTFWeb. Sem o fechamento, as guias não nascem; fechamento fora do prazo é multa. O motor de prazos vigia o dia 15 com alertas D-5/3/1.',
   'Competência aprovada no ambiente de teste.',
   '[{"ordem":1,"acao":"Fechar a competência","resultado_esperado":"S-1200 por vínculo e S-1210 gerados, conciliados com folha_itens"},
     {"ordem":2,"acao":"Transmitir o S-1299","resultado_esperado":"Fechamento no prazo (até o dia 15), com recibo arquivado"},
     {"ordem":3,"acao":"Aproximar-se do dia 15 sem fechar","resultado_esperado":"Alertas D-5/3/1 a DP e Contador, prioridade crítica"}]'::jsonb,
   'Folha aprovada vira evento; evento fechado vira guia; o dia 15 é vigiado.',
   'Requisitos YE-DP-FOLHA-001: RN-010 / CA-007 / alerta "Fechamento do eSocial" (seção 14). folha_alertas_prazo já tem os tipos esocial_s1200/s1210 (semeados pela tela); a GERAÇÃO dos eventos não existe. A anti-duplicidade da fila é a série ADM-093/DESL-094. Deve falhar e encaminhar.'),

  (v_mod, 'FOLHA-061', 'Guias das obrigações: DARF pela DCTFWeb e FGTS pelo FGTS Digital',
   'alternativo', 'alta', 'aprovado', 'api',
   'DCTFWeb (consolidação das contribuições a partir do eSocial; DARF); Lei 8.036/1990 e FGTS Digital (guia mensal de 8%)',
   'Fechado o eSocial, as guias têm caminhos próprios: a DCTFWeb consolida INSS/IRRF e gera o DARF; o FGTS Digital gera a guia dos 8% sobre a remuneração. As bases precisam BATER com a folha fechada (conciliação), os vencimentos são vigiados e os comprovantes ficam no dossiê da competência — guia paga sem conciliação é conferência que sobrou para a fiscalização fazer.',
   'Competência fechada com S-1299 aceito (simulado).',
   '[{"ordem":1,"acao":"Gerar o DARF da competência","resultado_esperado":"Valores conciliados com os encargos da folha fechada; divergência acusada"},
     {"ordem":2,"acao":"Gerar a guia do FGTS Digital","resultado_esperado":"8% sobre a base de FGTS da folha, por vínculo/estabelecimento"},
     {"ordem":3,"acao":"Anexar os comprovantes","resultado_esperado":"Arquivados em Processo › Folha, vinculados à competência"}]'::jsonb,
   'Guia nasce da folha fechada e volta conciliada para o dossiê.',
   'Requisitos YE-DP-FOLHA-001: RN-010 / CA-006/CA-007 / RF-008. O hub_guias registra guias digitadas à mão (achado do DESL-057) — a GERAÇÃO conciliada não existe. O calendário de envios do escritório é a família HCAL (Hub).'),

  -- ══════════ H) COMPLEMENTAR, REABERTURA E CONCILIAÇÃO ══════════

  (v_mod, 'FOLHA-070', 'Dissídio retroativo gera folha complementar com retificação do eSocial',
   'alternativo', 'media', 'aprovado', 'api',
   'CCT/ACT (reajuste retroativo); eSocial — S-1200 complementar/retificação',
   'Reajuste retroativo de convenção não reabre as folhas pagas: gera folha COMPLEMENTAR — competência própria com as diferenças por vínculo, encargos sobre as diferenças e S-1200 retificado/complementar —, mantendo as originais intactas. Sem a estrutura, o retroativo ou é ignorado (passivo) ou é editado por cima do fechado (trilha destruída).',
   'Competências fechadas; reajuste retroativo de 5% publicado para a categoria.',
   '[{"ordem":1,"acao":"Registrar o reajuste retroativo","resultado_esperado":"Diferenças apuradas por vínculo/competência atingida, com memória própria"},
     {"ordem":2,"acao":"Processar a complementar","resultado_esperado":"Folha complementar vinculada às originais — que permanecem intactas"},
     {"ordem":3,"acao":"Refletir no eSocial","resultado_esperado":"S-1200 retificado/complementar por competência, sem duplicar eventos"}]'::jsonb,
   'O retroativo ganha folha própria; as originais ficam na história.',
   'Requisitos YE-DP-FOLHA-001: RF-010 / CA-010 / cenário "Complementar" (seção 25). Par do DESL-105 (rescisão complementar) e DEC13-033 (complemento do 13º). folha_periodos tem UNIQUE(tenant, competencia) — a complementar precisa de desenho próprio, não de burlar a unicidade.'),

  (v_mod, 'FOLHA-071', 'Competência fechada só reabre com dupla aprovação e recálculo rastreado',
   'excecao', 'alta', 'aprovado', 'api',
   'Documento YE-DP-FOLHA-001, RF-010; RNF-004 (log imutável)',
   'O fechamento é um marco: depois dele, lançamentos, itens e totais da competência ficam imutáveis. Corrigir exige REABRIR com motivo, dupla aprovação e trilha — recalculando, apurando diferenças e retificando o eSocial. Se um UPDATE direto em folha fechada passa, o holerite entregue, o evento transmitido e o banco contam três histórias diferentes.',
   'Competência com status fechado e itens calculados no ambiente de teste.',
   '[{"ordem":1,"acao":"Tentar lançar/alterar valores numa competência FECHADA","resultado_esperado":"Bloqueado — fechado é imutável"},
     {"ordem":2,"acao":"Reabrir com motivo e dupla aprovação","resultado_esperado":"Reabertura registrada (quem, quando, por quê); recálculo liberado"},
     {"ordem":3,"acao":"Fechar de novo após a correção","resultado_esperado":"Diferenças apuradas e eSocial retificado; versões preservadas"}]'::jsonb,
   'Fechado não se edita: reabre com rito ou permanece.',
   'Requisitos YE-DP-FOLHA-001: RF-010 / fluxo "Reabertura" (seção 9). folha_periodos tem o status e o ciclo — falta a TRAVA (nada impede UPDATE em lançamentos/itens de competência fechada). Mesma disciplina de FERIAS-054, DEC13-070 e DESL-106.'),

  (v_mod, 'FOLHA-080', 'Abertura da competência concilia Ponto, Férias, 13º e Afastamentos',
   'feliz', 'alta', 'aprovado', 'api',
   'Documento YE-DP-FOLHA-001, RF-002; CLT (fidelidade da remuneração ao trabalho prestado)',
   'A folha é o destino dos outros módulos: horas e faltas do Ponto, férias do mês, parcela de 13º, afastamentos (15 primeiros dias de auxílio-doença pela empresa) e verbas de rescisão entram por IMPORTAÇÃO conciliada — cada evento com origem rastreável — e divergência entre o apurado lá e o lançado aqui é apontada ANTES do fechamento, não descoberta no holerite errado.',
   'Competência aberta com eventos apurados nos módulos de origem (Ponto fechado, férias gozadas, afastamento no mês).',
   '[{"ordem":1,"acao":"Importar os eventos da competência","resultado_esperado":"Horas, faltas, férias, 13º e afastamentos entram com a origem identificada"},
     {"ordem":2,"acao":"Simular divergência (hora extra apurada no Ponto ausente da folha)","resultado_esperado":"Conciliação aponta a diferença antes do fechamento"},
     {"ordem":3,"acao":"Afastamento por auxílio-doença no mês","resultado_esperado":"15 primeiros dias pela empresa; restante sinalizado como INSS"}]'::jsonb,
   'Tudo que os módulos apuraram chega conciliado — ou a diferença aparece.',
   'Requisitos YE-DP-FOLHA-001: RF-002 / alerta "Divergência" (seção 14) / cenário "Afastamento" (seção 25). DIVERGÊNCIA VISÍVEL: ponto_exportacoes_folha existe para o Ponto, mas não há conciliação automática nem importação dos demais módulos — lançamento é manual. Deve falhar e encaminhar.'),

  (v_mod, 'FOLHA-081', 'Variação atípica da folha é destacada antes do fechamento',
   'alternativo', 'media', 'aprovado', 'api',
   'Documento YE-DP-FOLHA-001, seções 14, 18 e 29 ("folha sem surpresa") [BPR]',
   'Salto de custo entre competências — rubrica que dobrou, colaborador com líquido fora do padrão, encargo destoante — é quase sempre erro de lançamento, e a hora de pegá-lo é ANTES do fechamento, comparando a competência com o histórico. Fechou errado, o custo de corrigir multiplica: reabertura, retificação de eSocial, complementar.',
   'Histórico de competências fechadas; competência atual com lançamento destoante proposital.',
   '[{"ordem":1,"acao":"Processar a competência com o valor destoante","resultado_esperado":"Variação destacada na conferência (rubrica/vínculo apontados, comparativo com o histórico)"},
     {"ordem":2,"acao":"Corrigir e reprocessar","resultado_esperado":"Conferência limpa; fechamento liberado"}]'::jsonb,
   'A surpresa aparece na conferência — nunca no holerite.',
   'Requisitos YE-DP-FOLHA-001: RF-009 / alerta "Variação atípica" (seção 14) / ideia "Folha sem surpresa" (seção 29). [BPR] — sem base legal própria; é prevenção. folha_historico existe como matéria-prima do comparativo.'),

  -- ══════════ I) LGPD E ACESSO ══════════

  (v_mod, 'FOLHA-090', 'Dados da folha restritos por perfil e camada de módulo',
   'negativo', 'alta', 'aprovado', 'api',
   'LGPD (Lei 13.709/2018), arts. 6º, VII e 46; matriz de perfis do documento (seção 6)',
   'A folha concentra a remuneração de toda a empresa. A matriz do documento restringe por papel (DP/RH/contador operam; financeiro vê; gestor só custos da equipe; colaborador NADA além do próprio holerite) e a camada de acesso por perfil (perfil_permite_modulo + políticas RESTRICTIVE) precisa cobrir as tabelas da folha — itens, lançamentos e memórias são tão sensíveis quanto as 20 tabelas já protegidas.',
   'Usuários fictícios de perfis distintos no tenant de teste; folha calculada.',
   '[{"ordem":1,"acao":"Colaborador comum tenta ler folha_itens de colegas","resultado_esperado":"Bloqueado — só papéis da folha (a política atual exige manager+)"},
     {"ordem":2,"acao":"Perfil sem o módulo financeiro habilitado tenta ler a folha","resultado_esperado":"Bloqueado pela camada RESTRICTIVE de perfil (ou exceção documentada na PERFIL-003)"},
     {"ordem":3,"acao":"Usuário de outro tenant","resultado_esperado":"Bloqueado — segregação multitenant"}]'::jsonb,
   'Papel certo, módulo certo, tenant certo — ou a folha não se abre.',
   'Requisitos YE-DP-FOLHA-001: seções 6 e 22 / RNF-005. PONTO BOM: folha_periodos/itens/lancamentos já exigem manager+ (melhor que folha_13_calculo e folha_rescisoes — DEC13-071/DESL-110). O que se confere é a camada de PERFIL por módulo, além do papel.')

  ON CONFLICT (codigo) DO NOTHING;

  -- ---------------------------------------------------------
  -- Referências cruzadas em casos de outras famílias
  -- (só acrescenta às observações, não reescreve)
  -- ---------------------------------------------------------
  UPDATE public.qa_casos_teste SET observacoes = observacoes ||
    ' Requisitos YE-DP-FOLHA-001: o reflexo dos encargos na folha mensal ganhou família própria (FOLHA-010/011 — INSS progressivo e IRRF com redutor).'
  WHERE codigo IN ('DEC13-040','DEC13-041') AND position('YE-DP-FOLHA-001' IN observacoes) = 0;

  UPDATE public.qa_casos_teste SET observacoes = observacoes ||
    ' Requisitos YE-DP-FOLHA-001: o lado FOLHA (reflexo do apurado no cálculo e no DSR) está em FOLHA-020/022.'
  WHERE codigo IN ('DESL-046') AND position('YE-DP-FOLHA-001' IN observacoes) = 0;

  SELECT count(*) INTO v_depois FROM public.qa_casos_teste WHERE modulo_id = v_mod;
  RAISE NOTICE 'Folha de Pagamento: % casos antes, % depois (esperado +19 na primeira execução).', v_antes, v_depois;
END $doc$;
