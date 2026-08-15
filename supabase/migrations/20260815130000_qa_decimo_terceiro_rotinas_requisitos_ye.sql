-- ============================================================================
-- QA 13º SALÁRIO — rotinas executáveis dos 17 casos da análise de requisitos
-- YE-DP-13-001 (DEC13-001..071, documentados em 20260815120000).
-- Padrão da casa: testa o que a LEI exige; divergência = falha proposital
-- com diagnóstico. Nenhuma funcionalidade é alterada.
--
-- Contexto estrutural (o que as sondas vão encontrar): o cálculo do 13º
-- vive no React (calcular13 em src/lib/folha/calculos.ts) e o banco
-- (folha_13_calculo) só armazena o resultado — sem CHECK, sem apuração
-- de avos, sem motor de prazos, sem eSocial anual e sem provisão viva.
-- ============================================================================

-- DEC13-001 — avos apurados do vínculo (Lei 4.090, fração ≥ 15 dias)
CREATE OR REPLACE FUNCTION public.qa_caso_dec13_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_aceitou_15m boolean := false; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'Gravar cálculo de 13º com 15 meses trabalhados (impossível — o ano tem 12)';
  r.esperado := 'Recusado — avos vão de 0 a 12 e deveriam sair da data de admissão, não de digitação';
  BEGIN
    INSERT INTO public.folha_13_calculo
      (tenant_id, ano, colaborador_id, colaborador_nome, meses_trabalhados)
    VALUES (public.qa_sandbox_tenant_id(), extract(year from CURRENT_DATE)::int,
            'qa-dec13-001', 'QA Avos Quinze', 15);
    v_aceitou_15m := true;
  EXCEPTION WHEN check_violation OR raise_exception THEN v_aceitou_15m := false; END;

  r.passo_ordem := 2;
  r.passo_acao := 'AUDITORIA (somente leitura): alguém apura os avos a partir da admissão?';
  r.esperado := 'Função que calcule 1/12 por mês com a fração de 15 dias (Lei 4.090, art. 1º)';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%avos%'
         OR (p.prosrc ILIKE '%meses_trabalhados%' AND p.prosrc ILIKE '%data_admissao%'));

  IF v_aceitou_15m OR v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: os avos do 13º são um número DIGITADO — a tela (DecimoTerceiroTab) '
             || 'pede "meses trabalhados" e o banco aceitou até 15 meses (%s; folha_13_calculo não '
             || 'tem CHECK em meses_trabalhados) e nenhuma função apura os avos da data de '
             || 'admissão (%s). A Lei 4.090 manda contar 1/12 por mês com fração ≥ 15 dias: '
             || 'admitido em 10/05 são 8 avos, em 20/05 são 7 — diferença que hoje depende da '
             || 'conta de cabeça do operador. Correção: CHECK meses_trabalhados BETWEEN 0 AND 12 '
             || 'e apuração automática pela admissão (com faltas/afastamentos), digitação só como '
             || 'exceção justificada.',
             CASE WHEN v_aceitou_15m THEN '15 aceito' ELSE 'recusado' END,
             coalesce('há candidatas: ' || v_fns, 'nenhuma função'));
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Avos limitados e apurados por: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- DEC13-002 — faltas injustificadas derrubam o avo do mês (< 15 dias)
CREATE OR REPLACE FUNCTION public.qa_caso_dec13_002()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): as faltas do Ponto chegam à apuração do 13º?';
  r.esperado := 'Mês reduzido a menos de 15 dias por falta INJUSTIFICADA não conta avo; justificada não interfere';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  -- exige menção explícita ao 13º: "falta + avos" solto pega as férias
  -- (ferias_recalcular_periodo aplica o art. 130 e não toca o 13º)
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%falta%'
    AND (p.prosrc ILIKE '%decimo%' OR p.prosrc ILIKE '%13_calculo%');
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: nenhuma função liga as faltas apuradas no Ponto ao 13º — o módulo de '
             || 'jornada materializa faltas dia a dia (ponto_diario) e o 13º nem olha. Um '
             || 'colaborador com 16 faltas injustificadas num mês deveria perder aquele avo '
             || '(mês de serviço exige ≥ 15 dias trabalhados, Lei 4.090 art. 1º §1º); hoje o '
             || '13º sai integral porque os meses são digitados (ver DEC13-001). O efeito '
             || 'perverso é o inverso também: falta JUSTIFICADA não pode derrubar avo, e sem '
             || 'regra nenhuma ninguém garante os dois lados. Correção: apuração de avos '
             || 'consumindo as ocorrências do Ponto, distinguindo justificada de injustificada.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Faltas refletem na apuração via: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- DEC13-003 — afastamentos: maternidade integra, auxílio-doença divide com o INSS
CREATE OR REPLACE FUNCTION public.qa_caso_dec13_003()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_fns text; v_tab text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): os afastamentos entram na apuração do 13º com o efeito de cada tipo?';
  r.esperado := 'Maternidade conta na apuração patronal; auxílio-doença gera abono anual pelo INSS no período do benefício';
  v_tab := public.qa_col_existe('afastamentos', 'tipo%');
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%afastamento%'
    AND (p.prosrc ILIKE '%decimo%' OR p.prosrc ILIKE '%13_calculo%' OR p.prosrc ILIKE '%avos%');
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: o módulo de afastamentos existe e é tipado (%s), mas nenhuma '
             || 'função o consulta ao apurar o 13º. Os efeitos são opostos por tipo: '
             || 'licença-maternidade INTEGRA a apuração patronal; auxílio-doença divide — '
             || 'empregador paga os avos trabalhados e o INSS paga o abono anual do período de '
             || 'benefício (Decreto 3.048, art. 120). Sem o cruzamento, ou a empresa paga 13º '
             || 'de período que é do INSS (paga a mais) ou corta período de maternidade (paga '
             || 'a menos e responde por isso). Correção: apuração por tipo de afastamento, com '
             || 'marcação para validação contábil [VAL] nos casos divididos.',
             coalesce(v_tab, 'tabela afastamentos'));
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Afastamentos tratados na apuração via: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- DEC13-020 — base com médias das variáveis (Decreto 57.155; Súmulas 45/148/253)
CREATE OR REPLACE FUNCTION public.qa_caso_dec13_020()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_flag text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a marcação incide_13 das rubricas alimenta alguma média?';
  r.esperado := 'Rubricas com incide_13 = true compõem a média das variáveis na base do 13º';
  v_flag := public.qa_col_existe('folha_rubricas', 'incide_13');
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%incide_13%';
  IF v_flag IS NOT NULL AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO (metade boa, metade decorativa): a parametrização EXISTE — '
             || 'folha_rubricas.incide_13 diz exatamente quais rubricas compõem a base do 13º, '
             || 'o desenho certo do Decreto 57.155 — mas NENHUMA função a consulta: a "média de '
             || 'variáveis" do cálculo é um único número digitado na tela (media_variaveis), '
             || 'sem memória de qual rubrica entrou nem de que período. Horas extras habituais, '
             || 'adicional noturno e comissões integram a base por lei (Súmulas 45/148/253) e '
             || 'hoje dependem de o operador calcular a média fora do sistema. Correção: média '
             || 'automática dos lançamentos do ano filtrados por incide_13, com a composição '
             || 'gravada na memória de cálculo.';
  ELSIF v_flag IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'O campo incide_13 não existe mais em folha_rubricas.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Médias calculadas a partir de incide_13 em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- DEC13-021 — base de médias incompleta alerta antes do fechamento
CREATE OR REPLACE FUNCTION public.qa_caso_dec13_021()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): algum motor confere a completude do ano antes do fechamento?';
  r.esperado := 'Competência sem variáveis lançadas gera alerta ANTES do cálculo, não diferença depois';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%folha_alertas_prazo%';
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a tabela de alertas da folha (folha_alertas_prazo) é alimentada só '
             || 'pela TELA — nenhuma função do banco gera ou confere alerta algum, e não '
             || 'existe verificação de base incompleta em lugar nenhum. Quem não abrir a aba '
             || 'de alertas no mês certo não é avisado de nada, e um 13º calculado com '
             || 'competências sem variáveis lançadas sai menor em silêncio — diferença que '
             || 'vira passivo (seção 14 do documento pede alerta de "base de médias '
             || 'incompleta" com prioridade média antes do fechamento). Correção: rotina '
             || 'agendada (pg_cron, como as demais do projeto) conferindo lançamentos do '
             || 'ano × vínculos com variável habitual e registrando o alerta.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Alertas gerados/conferidos no banco por: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- DEC13-030 — 1ª parcela: 50% entre 1º/02 e 30/11 (Lei 4.749)
CREATE OR REPLACE FUNCTION public.qa_caso_dec13_030()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_check text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o prazo legal do 13º tem lugar no controle de prazos da folha?';
  r.esperado := 'Tipos de alerta contemplando as parcelas do 13º (1ª até 30/11; 2ª até 20/12)';
  SELECT pg_get_constraintdef(c.oid) INTO v_check
  FROM pg_constraint c
  WHERE c.conrelid = 'public.folha_alertas_prazo'::regclass
    AND c.contype = 'c' AND pg_get_constraintdef(c.oid) ILIKE '%tipo%';
  IF v_check IS NULL OR (v_check NOT ILIKE '%13%' AND v_check NOT ILIKE '%decimo%') THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: o controle de prazos da folha não conhece o 13º — o CHECK de '
             || 'folha_alertas_prazo só admite tipos mensais (%s): não há onde registrar '
             || '"1ª parcela até 30/11" nem "2ª até 20/12", e a tela que semeia os alertas '
             || 'gera datas aproximadas mês a mês, nunca as datas da Lei 4.749. Pagar a 1ª '
             || 'parcela fora da janela (1º/02 a 30/11) é infração mesmo com o valor certo, '
             || 'e é o risco nº 1 do módulo (seção 26). Correção: tipos decimo_primeira e '
             || 'decimo_segunda no CHECK + semeadura anual das duas datas com alertas '
             || 'D-30/15/7 e D-15/7/3.', coalesce(v_check, 'constraint ausente'));
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Prazos do 13º contemplados no controle: %s.', v_check);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- DEC13-031 — 2ª parcela até 20/12 com antecipação por dia não útil
CREATE OR REPLACE FUNCTION public.qa_caso_dec13_031()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_feriados text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): existe motor de datas que antecipe prazo em dia não útil?';
  r.esperado := '20/12 em fim de semana/feriado desloca a data-alvo para o dia útil ANTERIOR';
  v_feriados := CASE WHEN to_regclass('public.feriados') IS NOT NULL THEN 'feriados' END;
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%feriado%'
    AND (p.prosrc ILIKE '%util%' OR p.prosrc ILIKE '%antecip%')
    AND (p.prosrc ILIKE '%folha%' OR p.prosrc ILIKE '%decimo%' OR p.prosrc ILIKE '%prazo%');
  IF v_feriados IS NOT NULL AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o calendário EXISTE (tabela feriados, nacional e por município) e '
             || 'nenhum motor de prazos da folha o consulta — não há função que desloque uma '
             || 'data-alvo para o dia útil anterior. O prazo do 13º anda sempre para TRÁS '
             || '(20/12 no sábado paga-se na sexta 19; pagar na segunda 22 é atraso com multa), '
             || 'diferente de prazos tributários que às vezes prorrogam — por isso a regra '
             || 'precisa ser do prazo, não um utilitário genérico. Correção: função de data-alvo '
             || 'com antecipação consultando feriados, usada pelos alertas do DEC13-030 '
             || '(RNF-003 do documento).';
  ELSIF v_feriados IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'A tabela de feriados não existe mais nesta base.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Motor de antecipação presente: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- DEC13-032 — adiantamento nas férias baixa na apuração e deduz na 2ª
CREATE OR REPLACE FUNCTION public.qa_caso_dec13_032()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_opcao text; v_fns text; v_ponte text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a opção adiantar_13 das férias chega ao módulo do 13º?';
  r.esperado := 'Adiantamento pago no gozo aparece na apuração anual como 1ª parcela JÁ PAGA';
  v_opcao := public.qa_col_existe('ferias_programacao', 'adiantar_13');
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%adiantar_13%';
  v_ponte := coalesce(public.qa_col_existe('folha_13_calculo', '%adiant%'),
                      public.qa_col_existe('folha_13_calculo', '%ferias%'),
                      public.qa_col_existe('folha_13_calculo', '%origem%'));
  IF v_opcao IS NOT NULL AND v_fns IS NULL AND v_ponte IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a opção existe SÓ do lado das férias — ferias_programacao.adiantar_13 '
             || 'é gravada e o cálculo de férias a soma no líquido (FERIAS-035 cobre esse '
             || 'lado), mas o módulo do 13º nunca fica sabendo: nenhuma função lê adiantar_13 '
             || 'e folha_13_calculo não tem campo que registre adiantamento pago fora da '
             || 'rodada (valor_primeira_parcela é digitado). Consequência prática: quem '
             || 'recebeu a 1ª parcela nas férias de julho entra na rodada de novembro e '
             || 'RECEBE DE NOVO — e a 2ª parcela deduz os 50% teóricos, não o valor real. '
             || 'Correção: baixa automática na apuração anual (origem + valor + data do '
             || 'adiantamento) e dedução pelo valor efetivamente pago.';
  ELSIF v_opcao IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'O campo adiantar_13 não existe mais em ferias_programacao.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Ponte férias→13º presente (funções: %s; campos: %s).',
                       coalesce(v_fns, '—'), coalesce(v_ponte, '—'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- DEC13-033 — dedução do adiantamento e diferenças posteriores
CREATE OR REPLACE FUNCTION public.qa_caso_dec13_033()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_aceitou_p3 boolean := false; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'Gravar cálculo com parcela = 3 (só existem 1ª e 2ª)';
  r.esperado := 'Recusado — o 13º tem duas parcelas; "3" só faria sentido como complemento estruturado';
  BEGIN
    INSERT INTO public.folha_13_calculo
      (tenant_id, ano, colaborador_id, colaborador_nome, parcela)
    VALUES (public.qa_sandbox_tenant_id(), extract(year from CURRENT_DATE)::int,
            'qa-dec13-033', 'QA Parcela Tres', 3);
    v_aceitou_p3 := true;
  EXCEPTION WHEN check_violation OR raise_exception THEN v_aceitou_p3 := false; END;

  r.passo_ordem := 2;
  r.passo_acao := 'AUDITORIA (somente leitura): diferença apurada depois da 2ª parcela tem tratamento?';
  r.esperado := 'Complemento/estorno com vínculo à apuração original e reflexo no eSocial';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%complemento%13%' OR p.prosrc ILIKE '%13%complemento%'
         OR (p.prosrc ILIKE '%13_calculo%' AND (p.prosrc ILIKE '%estorno%' OR p.prosrc ILIKE '%diferen%')));

  IF v_aceitou_p3 OR v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: parcela é INT sem CHECK (parcela = 3 foi %s) e não existe '
             || 'estrutura de complemento — variável lançada depois da 2ª parcela (comissão de '
             || 'dezembro, HE da virada) não tem para onde ir: ou o operador edita o cálculo '
             || 'pago (sem trilha — ver DEC13-070) ou a diferença morre esquecida, e ambos '
             || 'erram. A dedução do adiantamento também é frágil: valor_primeira_parcela é '
             || 'digitado, não lido do pagamento real. Correção: CHECK parcela IN (1,2) + '
             || 'registro de complemento/estorno vinculado à apuração original (CA-005 e '
             || 'cenário "Diferença" da seção 25).',
             CASE WHEN v_aceitou_p3 THEN 'aceita' ELSE 'recusada' END);
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Parcelas restritas e diferenças tratadas por: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- DEC13-040 — INSS só na 2ª parcela, em cálculo separado
CREATE OR REPLACE FUNCTION public.qa_caso_dec13_040()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_aceitou boolean := false; v_vig text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'Gravar 1ª parcela com INSS retido (R$ 500) — a lei manda reter só na 2ª';
  r.esperado := 'Recusado — adiantamento não sofre INSS; a retenção acontece na quitação';
  BEGIN
    INSERT INTO public.folha_13_calculo
      (tenant_id, ano, colaborador_id, colaborador_nome, parcela, valor_inss, base_inss)
    VALUES (public.qa_sandbox_tenant_id(), extract(year from CURRENT_DATE)::int,
            'qa-dec13-040', 'QA INSS Primeira', 1, 500, 3000);
    v_aceitou := true;
  EXCEPTION WHEN check_violation OR raise_exception THEN v_aceitou := false; END;

  r.passo_ordem := 2;
  r.passo_acao := 'AUDITORIA: a tabela de INSS é versionada por vigência?';
  r.esperado := 'folha_tabelas_inss com vigência (RNF-002) — o ponto bom do desenho atual';
  v_vig := public.qa_col_existe('folha_tabelas_inss', 'vigencia_inicio');

  IF v_aceitou THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: o banco aceitou 1ª parcela com INSS retido — nenhum CHECK impede '
             || 'encargo no adiantamento (parcela = 1 com valor_inss = 500 entrou). O cálculo do '
             || 'React até faz certo (1ª sem descontos, 2ª com INSS em base separada da folha '
             || 'do mês, progressão própria de faixas), mas a regra vive SÓ na tela: qualquer '
             || 'escrita direta, importação ou ajuste manual grava o ilegal sem resistência. '
             || 'O versionamento das tabelas está correto (%s). Correção: CHECK '
             || '(parcela = 2 OR (valor_inss = 0 AND valor_irrf = 0)) — a regra legal morando '
             || 'no banco, não só no formulário.',
             coalesce('vigência presente: ' || v_vig, 'vigência AUSENTE'));
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Encargo na 1ª parcela recusado; tabelas com vigência (%s).',
                       coalesce(v_vig, '—'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- DEC13-041 — IRRF exclusivo na fonte, na 2ª parcela
CREATE OR REPLACE FUNCTION public.qa_caso_dec13_041()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_aceitou boolean := false; v_vig text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'Gravar 1ª parcela com IRRF retido (R$ 300) — tributação do 13º é exclusiva da 2ª';
  r.esperado := 'Recusado — o IRRF do 13º nasce na quitação, sobre o valor integral, apartado do mês';
  BEGIN
    INSERT INTO public.folha_13_calculo
      (tenant_id, ano, colaborador_id, colaborador_nome, parcela, valor_irrf, base_irrf)
    VALUES (public.qa_sandbox_tenant_id(), extract(year from CURRENT_DATE)::int,
            'qa-dec13-041', 'QA IRRF Primeira', 1, 300, 4000);
    v_aceitou := true;
  EXCEPTION WHEN check_violation OR raise_exception THEN v_aceitou := false; END;

  r.passo_ordem := 2;
  r.passo_acao := 'AUDITORIA: a tabela de IRRF é versionada por vigência?';
  r.esperado := 'folha_tabelas_irrf com vigência e deduções parametrizadas';
  v_vig := public.qa_col_existe('folha_tabelas_irrf', 'vigencia_inicio');

  IF v_aceitou THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO (par do DEC13-040, aqui pelo imposto): 1ª parcela com IRRF entrou '
             || 'sem resistência — a exclusividade na fonte (RIR/2018, art. 700: apura na 2ª '
             || 'parcela sobre o valor integral, sem somar aos rendimentos do mês) existe só no '
             || 'cálculo do React. O detalhe que agrava: base_irrf digitável permite também '
             || 'somar o 13º ao salário de dezembro numa base só, mudando a faixa dos dois — o '
             || 'erro clássico. Tabelas versionadas: %s. Correção: mesmo CHECK do DEC13-040 '
             || 'cobrindo valor_irrf, e memória de cálculo registrando a base apartada.',
             coalesce(v_vig, 'vigência AUSENTE'));
  ELSE
    r.situacao := 'passou';
    r.obtido := format('IRRF na 1ª parcela recusado; tabelas com vigência (%s).',
                       coalesce(v_vig, '—'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- DEC13-042 — FGTS de 8% nas duas parcelas, por competência
CREATE OR REPLACE FUNCTION public.qa_caso_dec13_042()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_aceitou boolean := false; v_comp text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'Gravar cálculo com base de FGTS MAIOR que o bruto (base 10.000 para bruto 3.000)';
  r.esperado := 'Recusado — a base do FGTS de cada parcela é fração do bruto, nunca mais que ele';
  BEGIN
    INSERT INTO public.folha_13_calculo
      (tenant_id, ano, colaborador_id, colaborador_nome, parcela,
       valor_bruto, base_fgts, valor_fgts)
    VALUES (public.qa_sandbox_tenant_id(), extract(year from CURRENT_DATE)::int,
            'qa-dec13-042', 'QA FGTS Inflado', 2, 3000, 10000, 800);
    v_aceitou := true;
  EXCEPTION WHEN check_violation OR raise_exception THEN v_aceitou := false; END;

  r.passo_ordem := 2;
  r.passo_acao := 'AUDITORIA: o depósito de cada parcela tem competência registrada para a guia?';
  r.esperado := 'FGTS da 1ª na competência do adiantamento; da 2ª na competência da quitação';
  v_comp := coalesce(public.qa_col_existe('folha_13_calculo', '%competencia%'),
                     public.qa_col_existe('folha_13_calculo', '%data_pagamento%'));

  IF v_aceitou OR v_comp IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: o cálculo do React reparte a base certa (1ª: metade; 2ª: '
             || 'diferença — 8%% exatos no total, Lei 8.036 art. 15), mas o banco não sustenta '
             || 'a regra: base_fgts inflada além do bruto foi %s e NÃO HÁ campo de competência '
             || 'nem data de pagamento em folha_13_calculo (%s) — sem eles não se monta a guia '
             || 'de cada parcela nem se prova o depósito na competência devida, que é '
             || 'exatamente o que o FGTS Digital confere. Correção: CHECK base_fgts <= '
             || 'valor_bruto + colunas de competência/data de pagamento por parcela.',
             CASE WHEN v_aceitou THEN 'aceita' ELSE 'recusada' END,
             coalesce('há: ' || v_comp, 'nenhum campo'));
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Base consistente e competência registrada (%s).', v_comp);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- DEC13-050 — eSocial: S-1200 anual e S-1210 sem duplicidade
CREATE OR REPLACE FUNCTION public.qa_caso_dec13_050()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_unq text; v_anual text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a folha anual do 13º tem eventos e anti-duplicidade?';
  r.esperado := 'S-1200 (apuração anual) e S-1210 (pagamentos) gerados, com unicidade por competência';
  IF to_regclass('public.esocial_transmissoes') IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'A tabela de transmissões do eSocial não existe nesta base.';
    RETURN r;
  END IF;
  SELECT string_agg(conname, ', ') INTO v_unq
  FROM pg_constraint WHERE conrelid = 'public.esocial_transmissoes'::regclass AND contype = 'u';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_anual
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%S-1200%' OR p.prosrc ILIKE '%S1200%' OR p.prosrc ILIKE '%anual%13%');

  IF v_unq IS NULL AND v_anual IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO (terceiro da série ADM-093/FERIAS-081, agora pela folha ANUAL): o 13º '
             || 'não gera evento nenhum — nenhuma função monta o S-1200 da competência anual '
             || 'nem o S-1210 dos pagamentos das parcelas, e esocial_transmissoes segue sem '
             || 'unicidade (mesmo evento gravável duas vezes). A competência anual tem regra '
             || 'própria de retificação e prazo; sem os eventos, o 13º pago não existe para o '
             || 'governo — e a DCTFWeb de dezembro não fecha com a folha. Correção: geração '
             || 'dos dois eventos no fechamento (apuração e pagamento), chave natural '
             || '(vínculo + tipo + competência anual) e tradução de rejeição em instrução, '
             || 'nunca reenvio às cegas.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Proteções presentes (unicidade: %s; eventos anuais: %s).',
                       coalesce(v_unq, '—'), coalesce(v_anual, '—'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- DEC13-051 — provisão do 13º viva, competência a competência
CREATE OR REPLACE FUNCTION public.qa_caso_dec13_051()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_tab text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a provisão do 13º é alimentada por algum motor?';
  r.esperado := '1/12 + encargos por competência e vínculo ativo, baixada contra os pagamentos';
  v_tab := CASE WHEN to_regclass('public.folha_provisoes') IS NOT NULL THEN 'folha_provisoes' END;
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%folha_provisoes%';
  IF v_tab IS NOT NULL AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a tabela existe (folha_provisoes, com tipo, encargos e reversão — '
             || 'desenho certo) e NENHUMA função a alimenta: a provisão do 13º é lançada à '
             || 'mão, quando alguém lembra. Provisão por regime de competência não é enfeite '
             || 'contábil — o custo nasce 1/12 por mês (CA-009), admissões e desligamentos a '
             || 'ajustam, e o contador precisa conciliar provisionado × pago no fim do ano '
             || '(seção 20). À mão, ela desalinha da folha no primeiro mês esquecido e o '
             || 'balancete de dezembro leva o susto do ano inteiro de uma vez. Correção: '
             || 'rotina mensal (pg_cron) provisionando por vínculo ativo e baixando contra '
             || 'os pagamentos das parcelas.';
  ELSIF v_tab IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'A tabela folha_provisoes não existe mais nesta base.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Provisão alimentada por: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- DEC13-060 — rescisão: proporcional pago, justa causa perde, adiantamento concilia
CREATE OR REPLACE FUNCTION public.qa_caso_dec13_060()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_aceitou boolean := false; v_ponte text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'Gravar rescisão POR JUSTA CAUSA pagando 13º proporcional de R$ 1.000';
  r.esperado := 'Recusado — na dispensa por justa causa o 13º proporcional é perdido';
  BEGIN
    INSERT INTO public.folha_rescisoes
      (tenant_id, colaborador_id, colaborador_nome, tipo_rescisao,
       data_desligamento, decimo_terceiro_proporcional)
    VALUES (public.qa_sandbox_tenant_id(), 'qa-dec13-060', 'QA Justa Causa Com 13',
            'DISPENSA_COM_JUSTA_CAUSA', CURRENT_DATE, 1000);
    v_aceitou := true;
  EXCEPTION WHEN check_violation OR raise_exception THEN v_aceitou := false; END;

  r.passo_ordem := 2;
  r.passo_acao := 'AUDITORIA: a rescisão concilia com o módulo do 13º (adiantamento pago, rodada anual)?';
  r.esperado := 'Adiantamento deduzido nas verbas e vínculo desligado fora da rodada de novembro/dezembro';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_ponte
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%folha_rescisoes%' AND p.prosrc ILIKE '%13_calculo%';

  IF v_aceitou OR v_ponte IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: a rescisão tem o campo certo (decimo_terceiro_proporcional) e '
             || 'nenhuma regra por trás — justa causa com 13º proporcional de R$ 1.000 foi '
             || '%s (o cálculo correto vive só no React, calcularRescisao), e nenhuma função '
             || 'liga folha_rescisoes a folha_13_calculo (%s): adiantamento pago nas férias '
             || 'não é conferido nas verbas, e o desligado pode reaparecer na rodada anual. '
             || 'A exceção da culpa recíproca (50%%, Súmula 14) é o DESL-035. Correção: '
             || 'validação motivo × verba no banco e conciliação rescisão ↔ apuração anual '
             || 'do 13º nos dois sentidos.',
             CASE WHEN v_aceitou THEN 'aceito' ELSE 'recusado' END,
             coalesce('há: ' || v_ponte, 'nenhuma'));
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Justa causa sem 13º garantida e conciliação presente (%s).', v_ponte);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- DEC13-070 — cálculo fechado só reabre com rito
CREATE OR REPLACE FUNCTION public.qa_caso_dec13_070()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_id uuid; v_alterou boolean := false; v_trg text;
BEGIN
  INSERT INTO public.folha_13_calculo
    (tenant_id, ano, colaborador_id, colaborador_nome, parcela,
     valor_bruto, total_liquido, status)
  VALUES (public.qa_sandbox_tenant_id(), extract(year from CURRENT_DATE)::int,
          'qa-dec13-070', 'QA Pago Editado', 2, 3000, 2500, 'pago')
  RETURNING id INTO v_id;

  r.passo_ordem := 1;
  r.passo_acao := 'Editar diretamente o valor bruto de um cálculo com status PAGO';
  r.esperado := 'Bloqueado — valor pago só muda por reabertura com motivo, dupla aprovação e diferença';
  BEGIN
    UPDATE public.folha_13_calculo SET valor_bruto = 9999 WHERE id = v_id;
    SELECT (valor_bruto = 9999) INTO v_alterou FROM public.folha_13_calculo WHERE id = v_id;
  EXCEPTION WHEN check_violation OR raise_exception THEN v_alterou := false; END;

  r.passo_ordem := 2;
  r.passo_acao := 'AUDITORIA: existe trilha de alteração na tabela do 13º?';
  r.esperado := 'Gatilho de auditoria registrando antes/depois (RNF-004: log imutável)';
  SELECT string_agg(DISTINCT t.tgname, ', ') INTO v_trg
  FROM pg_trigger t
  -- a cerca do sandbox de QA (qa_guarda_cercado) não é trilha de auditoria
  WHERE t.tgrelid = 'public.folha_13_calculo'::regclass AND NOT t.tgisinternal
    AND t.tgname NOT ILIKE '%updated_at%' AND t.tgname NOT ILIKE 'qa\_%';

  IF v_alterou AND v_trg IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: um cálculo PAGO foi editado em silêncio — o valor bruto mudou de 3.000 '
             || 'para 9.999 sem bloqueio, sem justificativa, sem aprovação e sem trilha (o único '
             || 'gatilho da tabela é o de updated_at, que não guarda o valor anterior). Nem o '
             || 'status tem CHECK: qualquer texto vale. Recibo entregue dizendo um valor e banco '
             || 'dizendo outro é exatamente o cenário que a auditoria trabalhista procura, e a '
             || 'reabertura com rito (motivo + dupla aprovação + diferença como complemento/'
             || 'estorno) é o RF-007 do documento. Correção: trava de UPDATE para status pago/'
             || 'fechado + trilha append-only com antes/depois + fluxo de reabertura. Mesma '
             || 'disciplina do FERIAS-054.';
  ELSIF NOT v_alterou THEN
    r.situacao := 'passou';
    r.obtido := 'A edição direta do cálculo pago foi recusada.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Alteração registrada em trilha (%s) — conferir se guarda antes/depois.', v_trg);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- DEC13-071 — remuneração do 13º restrita por perfil
CREATE OR REPLACE FUNCTION public.qa_caso_dec13_071()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_restr int; v_proprio int;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): as políticas de folha_13_calculo separam o próprio do alheio?';
  r.esperado := 'Colaborador lê só o próprio cálculo; folha da equipe restrita por perfil (camada RESTRICTIVE)';
  SELECT count(*) INTO v_restr
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'folha_13_calculo'
    AND permissive = 'RESTRICTIVE';
  SELECT count(*) INTO v_proprio
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'folha_13_calculo'
    AND (qual ILIKE '%auth.uid%' OR qual ILIKE '%usuario%' OR qual ILIKE '%colaborador%uid%');

  IF v_restr = 0 AND v_proprio = 0 THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: folha_13_calculo tem UMA política, e ela é só de tenant — qualquer '
             || 'usuário autenticado da empresa, inclusive o colaborador comum, lê a folha de '
             || '13º INTEIRA: salário-base, médias e líquido de todos os colegas. Remuneração '
             || 'é dado pessoal com acesso mínimo (LGPD art. 6º VII e seção 6 do documento: '
             || 'colaborador vê só o próprio), e a tabela está FORA da camada '
             || 'perfil_restringe_leitura_* que protege as 20 tabelas sensíveis do sistema — '
             || 'a folha de férias (folha_ferias_calculo) já tem a dela, o 13º ficou sem. '
             || 'Correção: política RESTRICTIVE via perfil_permite_modulo (padrão PERFIL-003) '
             || '+ regra de "próprio registro" para o colaborador.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Camadas presentes (restritivas: %s; separação do próprio: %s políticas).',
                       v_restr, v_proprio);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- Registro no motor
INSERT INTO public.qa_implementacoes (codigo, funcao_sql, ativo) VALUES
  ('DEC13-001','qa_caso_dec13_001',true), ('DEC13-002','qa_caso_dec13_002',true),
  ('DEC13-003','qa_caso_dec13_003',true), ('DEC13-020','qa_caso_dec13_020',true),
  ('DEC13-021','qa_caso_dec13_021',true), ('DEC13-030','qa_caso_dec13_030',true),
  ('DEC13-031','qa_caso_dec13_031',true), ('DEC13-032','qa_caso_dec13_032',true),
  ('DEC13-033','qa_caso_dec13_033',true), ('DEC13-040','qa_caso_dec13_040',true),
  ('DEC13-041','qa_caso_dec13_041',true), ('DEC13-042','qa_caso_dec13_042',true),
  ('DEC13-050','qa_caso_dec13_050',true), ('DEC13-051','qa_caso_dec13_051',true),
  ('DEC13-060','qa_caso_dec13_060',true), ('DEC13-070','qa_caso_dec13_070',true),
  ('DEC13-071','qa_caso_dec13_071',true)
ON CONFLICT (codigo) DO UPDATE SET funcao_sql = EXCLUDED.funcao_sql, ativo = true;
