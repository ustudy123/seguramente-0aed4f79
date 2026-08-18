-- ============================================================================
-- QA FOLHA — rotinas dos casos da análise de requisitos YE-DP-FOLHA-001
-- (FOLHA-001..090, documentados em 20260815180000).
--
-- Dos 19 casos, TREZE são de nível 'api' e ganham rotina aqui:
--   FOLHA-001/002 (rubricas S-1010/vigência), FOLHA-030 (descontos),
--   FOLHA-040 (5º dia útil), FOLHA-050/051 (patronais/regime),
--   FOLHA-060/061 (fechamento/guias), FOLHA-070/071 (complementar/
--   reabertura), FOLHA-080 (conciliação), FOLHA-081 (variação),
--   FOLHA-090 (perfil).
-- Os seis 'e2e' (FOLHA-010/011/020/021/022/041) verificam o cálculo que
-- vive no React (calculos.ts / adicionais.ts / horas-extras.ts) —
-- cobertura do Cypress, como nas famílias anteriores.
--
-- Padrão da casa: testa o que a LEI exige; divergência = falha proposital
-- com diagnóstico. Nenhuma funcionalidade é alterada.
-- ============================================================================

-- FOLHA-001 — rubrica sem natureza/incidência não entra no cálculo
CREATE OR REPLACE FUNCTION public.qa_caso_folha_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_aceitou boolean := false; v_gate text;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao := 'Criar rubrica SEM natureza do eSocial e sem nenhuma incidência definida';
  r.esperado := 'Aceita no máximo como rascunho — jamais utilizável em cálculo';
  BEGIN
    INSERT INTO public.folha_rubricas
      (tenant_id, codigo_interno, descricao, ativa)
    VALUES (v_t, 'QA-F001', 'QA Rubrica Sem Natureza', true);
    v_aceitou := true;
  EXCEPTION WHEN check_violation OR raise_exception OR not_null_violation THEN
    v_aceitou := false; END;

  r.passo_ordem := 2;
  r.passo_acao := 'AUDITORIA: alguém bloqueia o cálculo quando há rubrica sem classificação?';
  r.esperado := 'Função/trava que impeça processar com classificacao_esocial vazia (CA-001)';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_gate
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%classificacao_esocial%';

  IF v_aceitou AND v_gate IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a rubrica nasceu ATIVA sem natureza do eSocial nem incidências — '
             || 'classificacao_esocial é NULLABLE, as incidências têm DEFAULT false (que é '
             || 'uma DEFINIÇÃO, não uma pendência) e nenhuma função confere a classificação '
             || 'antes do cálculo. Rubrica sem S-1010 que entra na folha produz base errada '
             || 'de INSS/FGTS/IRRF e evento rejeitado — ou aceito com tributo errado, que é '
             || 'pior. O CA-001 manda BLOQUEAR o cálculo até definir. Correção: estado '
             || '"incompleta" para rubrica sem classificação + trava no processamento e no '
             || 'lançamento (a tabela distingue default de decisão).';
  ELSIF NOT v_aceitou THEN
    r.situacao := 'passou';
    r.obtido := 'A rubrica sem classificação foi recusada na criação.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Classificação conferida por: %s.', v_gate);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- FOLHA-002 — rubricas versionadas por vigência
CREATE OR REPLACE FUNCTION public.qa_caso_folha_002()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_vig text; v_hist text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a tabela de rubricas tem vigência/versionamento?';
  r.esperado := 'Alteração de incidência cria vigência nova; o passado preserva a definição da época';
  v_vig := coalesce(public.qa_col_existe('folha_rubricas', 'vigencia%'),
                    public.qa_col_existe('folha_rubricas', '%versao%'));
  SELECT string_agg(DISTINCT t.tgname, ', ') INTO v_hist
  FROM pg_trigger t
  WHERE t.tgrelid = 'public.folha_rubricas'::regclass AND NOT t.tgisinternal
    AND t.tgname NOT ILIKE '%updated_at%' AND t.tgname NOT ILIKE 'qa\_%';

  IF v_vig IS NULL AND v_hist IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: folha_rubricas não tem vigência nem trilha de versão — um UPDATE '
             || 'na incidência vale retroativamente para TODAS as épocas, e nenhum gatilho '
             || 'guarda a definição anterior. A folha de março foi calculada com a regra de '
             || 'março; mudada a rubrica em agosto, a reprodução do cálculo (RNF-007) passa '
             || 'a dar outro resultado e a auditoria não consegue explicar a diferença. O '
             || 'contraste é didático: folha_tabelas_inss/irrf JÁ SÃO versionadas por '
             || 'vigência — falta aplicar o mesmo desenho à tabela que dirige o cálculo '
             || 'inteiro (e que o S-1010 também versiona por período). Correção: vigência '
             || 'na rubrica (ou tabela de vigências filha) + resolução por competência.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Versionamento presente (vigência: %s; trilha: %s).',
                       coalesce(v_vig, '—'), coalesce(v_hist, '—'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- FOLHA-030 — descontos nos limites do art. 462
CREATE OR REPLACE FUNCTION public.qa_caso_folha_030()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_per uuid; v_aceitou boolean := false; v_aut text;
BEGIN
  PERFORM public.qa_modo_ligar();

  INSERT INTO public.folha_periodos (tenant_id, competencia, status)
  VALUES (v_t, '2098-01', 'aberto')
  ON CONFLICT (tenant_id, competencia) DO UPDATE SET status = 'aberto'
  RETURNING id INTO v_per;

  r.passo_ordem := 1;
  r.passo_acao := 'Lançar desconto avulso sem amparo (sem rubrica, texto livre, valor alto)';
  r.esperado := 'Bloqueado — desconto só com amparo do art. 462 (lei, CCT ou adiantamento) e dentro do teto';
  BEGIN
    INSERT INTO public.folha_lancamentos
      (tenant_id, periodo_id, colaborador_id, colaborador_nome,
       rubrica_descricao, tipo, valor, origem)
    VALUES (v_t, v_per, 'qa-folha-030', 'QA Desconto Livre',
            'Desconto avulso sem amparo', 'DESCONTO', 950.00, 'manual');
    v_aceitou := true;
  EXCEPTION WHEN check_violation OR raise_exception OR foreign_key_violation THEN
    v_aceitou := false; END;

  r.passo_ordem := 2;
  r.passo_acao := 'AUDITORIA: existe registro de autorização (desconto sindical) e teto de VT?';
  r.esperado := 'Autorização expressa para sindical; limite de 6% para VT; tipos parametrizados';
  v_aut := coalesce(public.qa_col_existe(NULL, '%autorizacao_desconto%'),
                    public.qa_col_existe(NULL, '%desconto_sindical%'),
                    public.qa_fns_com('%desconto%462%'));

  IF v_aceitou AND v_aut IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o desconto entrou SEM AMPARO — folha_lancamentos aceita DESCONTO '
             || 'com descrição em texto livre, sem rubrica, sem teto e sem vínculo a lei/'
             || 'CCT/adiantamento; não existe registro de autorização para desconto '
             || 'sindical (facultativo desde a Lei 13.467) nem trava de 6% para o VT. O '
             || 'art. 462 é taxativo: desconto fora das hipóteses é devolução em dobro na '
             || 'reclamatória. Correção: lançamento de desconto exige rubrica classificada '
             || '(amparo declarado), teto por tipo (VT 6% do salário-base) e autorização '
             || 'arquivada quando a lei a exigir.';
  ELSIF NOT v_aceitou THEN
    r.situacao := 'passou';
    r.obtido := 'O desconto sem amparo foi recusado no lançamento.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Aceito com estrutura de amparo disponível (%s) — conferir a '
                       || 'obrigatoriedade no fluxo.', v_aut);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- FOLHA-040 — 5º dia útil calculado, vigiado e cobrado
CREATE OR REPLACE FUNCTION public.qa_caso_folha_040()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): alguém calcula o 5º dia útil de verdade?';
  r.esperado := 'Motor de dias úteis (sábado conta, domingo/feriado não) alimentando o prazo do art. 459';
  -- procura pelo prazo de PAGAMENTO em dias úteis — cuidado com os parentes
  -- falsos: "media_utilizada" contém "dia_util", e a equalização do Ponto
  -- conta dias úteis para outra finalidade (jornada, não prazo do art. 459)
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%quinto%'
         OR ((p.prosrc ILIKE '%dia_util%' OR p.prosrc ILIKE '%dias_uteis%')
             AND (p.prosrc ILIKE '%pagamento%' OR p.prosrc ILIKE '%folha_alertas%')))
    AND p.proname NOT ILIKE '%noturno%' AND p.proname NOT ILIKE '%equalizacao%';

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o 5º dia útil não é calculado em lugar nenhum — a tela de alertas '
             || 'semeia o prazo de pagamento como DIA 7 FIXO ("aprox 5º útil", literalmente '
             || 'no código), sem olhar sábados, domingos nem a tabela feriados. Nos meses em '
             || 'que o 5º dia útil cai no dia 5 ou 6, o alerta chega DEPOIS do prazo legal — '
             || 'um vigia que acorda atrasado. E não há registro de pagamento × limite para '
             || 'acusar o atraso (art. 459, §1º). Correção: função de dias úteis (sábado '
             || 'conta para este fim; domingo/feriado não) alimentando folha_alertas_prazo '
             || 'com a data real, alertas D-3/2/1 e atraso acusado com trilha. Terceiro '
             || 'módulo pedindo o mesmo motor de datas (DEC13-031, DESL-015).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Motor de dias úteis presente: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- FOLHA-050 — encargos patronais (RAT×FAP, terceiros)
CREATE OR REPLACE FUNCTION public.qa_caso_folha_050()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_rat text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): os encargos patronais têm estrutura?';
  r.esperado := 'Patronal 20% + RAT×FAP + terceiros parametrizados por empresa, com vigência';
  -- os pedaços existem espalhados: empresa_cadastro.fap_atual/historico é o
  -- MONITORAMENTO do FAP (SST) e ferias_config.encargo_rat_fap/terceiros é o
  -- provisionamento de FÉRIAS — nada disso calcula a patronal da competência
  v_rat := coalesce(public.qa_col_existe('empresa_cadastro', 'fap_%'),
                    public.qa_col_existe('ferias_config', 'encargo_%'));
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%patronal%'
    AND (p.prosrc ILIKE '%folha_itens%' OR p.prosrc ILIKE '%folha_periodos%'
         OR p.prosrc ILIKE '%competencia%');

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO (peças espalhadas, motor ausente): os INSUMOS até existem — '
             || 'o FAP da empresa é monitorado pelo SST (empresa_cadastro.fap_atual, '
             || 'alimentado por afastamentos_fap) e as férias provisionam com '
             || 'encargo_rat_fap/terceiros parametrizados (ferias_config) — mas NENHUMA '
             || 'função calcula a contribuição patronal da COMPETÊNCIA: 20%% + RAT×FAP + '
             || 'terceiros/FPAS sobre a base da folha não são apurados em lugar nenhum '
             || '(só o INSS do empregado, no React). Sem os patronais, a DCTFWeb não tem o '
             || 'que consolidar e o custo real da folha (~26,8%%+ acima do bruto) não '
             || 'aparece em painel nenhum. Estrutura encontrada: %s. Correção: parâmetros '
             || 'patronais por empresa/estabelecimento com vigência + apuração na '
             || 'competência, reaproveitando o FAP que o SST já mantém.',
             coalesce(v_rat, 'nenhuma'));
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Cálculo patronal presente (funções: %s; parâmetros: %s).',
                       v_fns, coalesce(v_rat, '—'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- FOLHA-051 — regime tributário muda os encargos
CREATE OR REPLACE FUNCTION public.qa_caso_folha_051()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_reg text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o regime tributário da empresa existe e é consumido?';
  r.esperado := 'Regime (Real/Presumido/Simples/CPRB) por empresa, com vigência, decidindo os patronais';
  v_reg := coalesce(public.qa_col_existe(NULL, '%regime_tributario%'),
                    public.qa_col_existe('empresa_cadastro', '%regime%'),
                    public.qa_col_existe(NULL, '%desoneracao%'),
                    public.qa_col_existe(NULL, '%simples_nacional%'));
  v_fns := coalesce(public.qa_fns_com('%regime%tribut%'), public.qa_fns_com('%cprb%'));

  IF v_reg IS NULL AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o regime tributário não existe no sistema — nenhuma coluna guarda '
             || 'o enquadramento (Lucro Real/Presumido, Simples Nacional, desoneração/CPRB) '
             || 'e nenhuma função o consulta. O regime decide o encargo patronal: empresa '
             || 'do Simples (maioria dos anexos) não recolhe a patronal sobre a folha; '
             || 'setor desonerado recolhe CPRB sobre a receita. Numa plataforma '
             || 'multiempresa, tratar todo mundo como Lucro Real erra o custo de quase '
             || 'todos os clientes pequenos. Encadeado ao FOLHA-050: primeiro a estrutura '
             || 'patronal, depois o regime que a module — ambos por empresa/estabelecimento '
             || 'com vigência ([RCE]/[VAL], seção 30).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Regime presente (campos: %s; funções: %s).',
                       coalesce(v_reg, '—'), coalesce(v_fns, '—'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- FOLHA-060 — fechamento: S-1200/S-1210/S-1299 até o dia 15
CREATE OR REPLACE FUNCTION public.qa_caso_folha_060()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_fns text; v_tipos text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o fechamento da competência gera os eventos periódicos?';
  r.esperado := 'S-1200 por vínculo, S-1210 dos pagamentos e S-1299 até o dia 15, com prazo vigiado';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%S-1299%' OR p.prosrc ILIKE '%S1299%'
         OR p.prosrc ILIKE '%S-1200%' OR p.prosrc ILIKE '%S1200%');
  SELECT pg_get_constraintdef(c.oid) INTO v_tipos
  FROM pg_constraint c
  WHERE c.conrelid = 'public.folha_alertas_prazo'::regclass
    AND c.contype = 'c' AND pg_get_constraintdef(c.oid) ILIKE '%s1200%';

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO (metade boa, metade ausente): o controle de prazos JÁ CONHECE '
             || 'os eventos (folha_alertas_prazo tem os tipos esocial_s1200/s1210 no CHECK'
             || '%s), mas a GERAÇÃO não existe: nenhuma função monta S-1200 por vínculo, '
             || 'S-1210 dos pagamentos ou o S-1299 que FECHA os periódicos — e é o '
             || 'fechamento que libera a DCTFWeb. O alerta, além disso, é semeado pela tela '
             || 'com dia 15 fixo só quando alguém abre a aba. Sem os eventos, a folha '
             || 'inteira não existe para o governo — mesmo vazio já achado no 13º '
             || '(DEC13-050) e no desligamento (DESL-091/093). Correção: geração dos três '
             || 'eventos no fechamento aprovado + fila com anti-duplicidade (série '
             || 'ADM-093/DESL-094) + dia 15 vigiado por rotina, não por visita à tela.',
             CASE WHEN v_tipos IS NOT NULL THEN '' ELSE ' — mas o CHECK não os lista mais' END);
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Geração dos periódicos presente: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- FOLHA-061 — guias: DARF (DCTFWeb) e FGTS Digital conciliados
CREATE OR REPLACE FUNCTION public.qa_caso_folha_061()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): as guias tributárias nascem conciliadas com a folha?';
  r.esperado := 'DARF consolidado pela DCTFWeb e guia do FGTS Digital, com bases batendo com a competência fechada';
  v_est := coalesce(public.qa_fns_com('%dctf%'), public.qa_fns_com('%darf%'),
                    public.qa_col_existe(NULL, '%dctf%'),
                    public.qa_fns_com('%fgts%'));

  IF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: DCTFWeb e FGTS Digital não existem no banco — nenhuma função ou '
             || 'coluna trata DARF, consolidação ou guia de FGTS mensal. O que há é o '
             || 'hub_guias do Hub Contábil: registro GENÉRICO digitado à mão (mesmo achado '
             || 'do DESL-057 na guia rescisória), que anota a guia mas não a GERA da folha '
             || 'fechada nem CONCILIA os valores — a diferença entre a guia paga e o '
             || 'encargo apurado fica para a fiscalização encontrar. Correção: após o '
             || 'fechamento (FOLHA-060), gerar as guias com as bases da competência, acusar '
             || 'divergência na conciliação e arquivar comprovantes vinculados. O '
             || 'CALENDÁRIO dos envios é da família HCAL — aqui é o CONTEÚDO da guia.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Estrutura de guias presente: %s.', v_est);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- FOLHA-070 — folha complementar (dissídio retroativo)
CREATE OR REPLACE FUNCTION public.qa_caso_folha_070()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_col text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a folha complementar tem onde existir?';
  r.esperado := 'Competência complementar vinculada à original, com diferenças por vínculo e retificação do eSocial';
  v_col := coalesce(public.qa_col_existe('folha_periodos', '%complementar%'),
                    public.qa_col_existe('folha_periodos', '%tipo%'),
                    public.qa_col_existe('folha_periodos', '%origem%'));
  v_fns := coalesce(public.qa_fns_com('%complementar%'), public.qa_fns_com('%dissidio%'));

  IF v_col IS NULL AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a folha complementar não tem onde viver — folha_periodos só tem a '
             || 'competência YYYY-MM com UNIQUE(tenant, competencia): não há tipo '
             || '(normal/complementar), não há vínculo a uma competência de origem e '
             || 'nenhuma função apura diferenças de dissídio. A unicidade, correta para a '
             || 'folha normal, IMPEDE a complementar por desenho: reajuste retroativo da '
             || 'CCT ou vira edição da competência fechada (trilha destruída) ou fica de '
             || 'fora (passivo). Terceiro módulo com o mesmo vazio (DEC13-033, DESL-105). '
             || 'Correção: tipo de período + referência à competência-mãe (a unicidade '
             || 'passa a valer por tenant+competência+tipo) + apuração das diferenças com '
             || 'S-1200 retificado/complementar.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Estrutura presente (campos: %s; funções: %s).',
                       coalesce(v_col, '—'), coalesce(v_fns, '—'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- FOLHA-071 — competência fechada só reabre com rito
CREATE OR REPLACE FUNCTION public.qa_caso_folha_071()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_per uuid; v_lancou boolean := false; v_reabriu boolean := false;
BEGIN
  PERFORM public.qa_modo_ligar();

  INSERT INTO public.folha_periodos (tenant_id, competencia, status, data_fechamento)
  VALUES (v_t, '2098-02', 'fechado', CURRENT_DATE)
  ON CONFLICT (tenant_id, competencia) DO UPDATE SET status = 'fechado'
  RETURNING id INTO v_per;

  r.passo_ordem := 1;
  r.passo_acao := 'Lançar valor novo numa competência com status FECHADO';
  r.esperado := 'Bloqueado — fechado é imutável; correção só por reabertura com rito';
  BEGIN
    INSERT INTO public.folha_lancamentos
      (tenant_id, periodo_id, colaborador_id, colaborador_nome,
       rubrica_descricao, tipo, valor, origem)
    VALUES (v_t, v_per, 'qa-folha-071', 'QA Fechado Editado',
            'Lançamento pós-fechamento', 'PROVENTO', 1234.56, 'manual');
    v_lancou := true;
  EXCEPTION WHEN check_violation OR raise_exception THEN v_lancou := false; END;

  r.passo_ordem := 2;
  r.passo_acao := 'Reabrir a competência com um UPDATE simples de status, sem motivo nem aprovação';
  r.esperado := 'Bloqueado — reabertura exige motivo, dupla aprovação e trilha';
  BEGIN
    UPDATE public.folha_periodos SET status = 'aberto', data_fechamento = NULL
    WHERE id = v_per;
    v_reabriu := true;
  EXCEPTION WHEN check_violation OR raise_exception THEN v_reabriu := false; END;

  IF v_lancou OR v_reabriu THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: o fechamento é decorativo — lançamento novo em competência '
             || 'FECHADA foi %s e a reabertura por UPDATE simples (sem motivo, sem '
             || 'aprovação, sem trilha além do fechado_por original) foi %s. O status '
             || 'existe e o ciclo existe, mas nenhum gatilho os DEFENDE: holerite entregue, '
             || 'evento transmitido e banco podem contar três histórias. Correção: gatilho '
             || 'que rejeite INSERT/UPDATE/DELETE em lançamentos e itens de competência '
             || 'fechada + fluxo de reabertura com motivo e dupla aprovação registrados '
             || '(disciplina de FERIAS-054, DEC13-070 e DESL-106 — quarto módulo).',
             CASE WHEN v_lancou THEN 'ACEITO' ELSE 'recusado' END,
             CASE WHEN v_reabriu THEN 'ACEITA' ELSE 'recusada' END);
  ELSE
    r.situacao := 'passou';
    r.obtido := 'Competência fechada imutável e reabertura direta bloqueada.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- FOLHA-080 — conciliação com os módulos de origem
CREATE OR REPLACE FUNCTION public.qa_caso_folha_080()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_ponte text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): os eventos dos módulos chegam conciliados à folha?';
  r.esperado := 'Importação com origem rastreável (Ponto, Férias, 13º, Afastamentos) e divergência acusada';
  v_ponte := CASE WHEN to_regclass('public.ponto_exportacoes_folha') IS NOT NULL
                  THEN 'ponto_exportacoes_folha' END;
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%ponto_exportacoes_folha%'
         OR (p.prosrc ILIKE '%folha_lancamentos%' AND p.prosrc ILIKE '%concilia%'));

  IF v_ponte IS NOT NULL AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a ponte existe SÓ do lado do Ponto — ponto_exportacoes_folha '
             || 'guarda a apuração exportada, mas nenhuma função a importa para '
             || 'folha_lancamentos nem concilia o apurado com o lançado; Férias, 13º e '
             || 'Afastamentos nem ponte têm. Na prática o DP redigita na folha o que o '
             || 'Ponto apurou — e a hora extra que ficar de fora não é acusada por '
             || 'ninguém: o holerite sai menor e ninguém sabe. A origem "manual" domina '
             || 'folha_lancamentos. Correção: importação por competência com origem '
             || 'rastreável (modulo + referência) + conciliação apurado × lançado '
             || 'acusando diferença ANTES do fechamento (alerta da seção 14).';
  ELSIF v_ponte IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'A tabela ponto_exportacoes_folha não existe mais nesta base.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Conciliação presente: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- FOLHA-081 — variação atípica antes do fechamento
CREATE OR REPLACE FUNCTION public.qa_caso_folha_081()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_hist text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a competência é comparada com o histórico antes de fechar?';
  r.esperado := 'Variação atípica (custo, rubrica, vínculo) destacada na conferência do fechamento';
  v_hist := CASE WHEN to_regclass('public.folha_historico') IS NOT NULL
                 THEN 'folha_historico' END;
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%folha_historico%' OR p.prosrc ILIKE '%variacao%'
         OR p.prosrc ILIKE '%atipic%');

  IF v_hist IS NOT NULL AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a matéria-prima existe (folha_historico guarda as competências) e '
             || 'ninguém a compara — nenhuma função confronta a competência atual com o '
             || 'histórico para destacar salto de custo, rubrica que dobrou ou líquido fora '
             || 'do padrão. É [BPR], não obrigação legal — mas é a diferença entre pegar o '
             || 'zero a mais NA CONFERÊNCIA e pegá-lo na reabertura com retificação de '
             || 'eSocial e complementar (a "folha sem surpresa" da seção 29). Correção: '
             || 'conferência de fechamento com comparativo por rubrica/vínculo e limiar '
             || 'parametrizável de variação.';
  ELSIF v_hist IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'A tabela folha_historico não existe mais nesta base.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Comparativo presente: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- FOLHA-090 — folha restrita por papel e por perfil
CREATE OR REPLACE FUNCTION public.qa_caso_folha_090()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_leitura_aberta int; v_restr int;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): quem consegue LER os itens da folha?';
  r.esperado := 'Leitura restrita aos papéis da folha; colaborador só o próprio holerite; camada de perfil presente';
  SELECT count(*) INTO v_leitura_aberta
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'folha_itens'
    AND cmd IN ('SELECT','ALL') AND permissive = 'PERMISSIVE'
    AND qual NOT ILIKE '%has_minimum_role%' AND qual NOT ILIKE '%auth.uid%';
  SELECT count(*) INTO v_restr
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'folha_itens'
    AND permissive = 'RESTRICTIVE';

  IF v_leitura_aberta > 0 AND v_restr = 0 THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a ESCRITA da folha é bem defendida (manager+ para gerenciar — '
             || 'melhor que o 13º e a rescisão), mas a LEITURA está aberta: a política '
             || '"Usuários podem ver itens do tenant" entrega folha_itens INTEIRA — '
             || 'salário, descontos e líquido de todos — a QUALQUER usuário autenticado da '
             || 'empresa, colaborador comum incluído. É exatamente o cenário "colaborador '
             || 'tenta ver a folha da equipe" que a seção 25 manda bloquear, e a tabela '
             || 'está fora da camada perfil_restringe_leitura_*. Correção: leitura por '
             || 'papel (manager+) OU restrita ao próprio registro (colaborador vê só o '
             || 'seu item/holerite) + política RESTRICTIVE via perfil_permite_modulo — '
             || 'fechando a série DEC13-071/DESL-110 no módulo mais denso de remuneração.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Leitura defendida (políticas abertas: %s; restritivas: %s).',
                       v_leitura_aberta, v_restr);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- Registro no motor
INSERT INTO public.qa_implementacoes (codigo, funcao_sql, ativo) VALUES
  ('FOLHA-001','qa_caso_folha_001',true), ('FOLHA-002','qa_caso_folha_002',true),
  ('FOLHA-030','qa_caso_folha_030',true), ('FOLHA-040','qa_caso_folha_040',true),
  ('FOLHA-050','qa_caso_folha_050',true), ('FOLHA-051','qa_caso_folha_051',true),
  ('FOLHA-060','qa_caso_folha_060',true), ('FOLHA-061','qa_caso_folha_061',true),
  ('FOLHA-070','qa_caso_folha_070',true), ('FOLHA-071','qa_caso_folha_071',true),
  ('FOLHA-080','qa_caso_folha_080',true), ('FOLHA-081','qa_caso_folha_081',true),
  ('FOLHA-090','qa_caso_folha_090',true)
ON CONFLICT (codigo) DO UPDATE SET funcao_sql = EXCLUDED.funcao_sql, ativo = true;
