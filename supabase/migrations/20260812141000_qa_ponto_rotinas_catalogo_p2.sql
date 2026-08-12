-- ============================================================================
-- QA PONTO — 5ª leva (parte 2): catálogo original de conformidade
-- PONTO-110..213 (noturno, DSR/feriados, escalas, banco de horas, auditoria,
-- fechamento, AFD/AEJ) + PONTO-358..362.
-- Mesmo padrão: comportamento exigido pela lei; divergência = falha proposital.
-- ============================================================================

-- PONTO-110 — adicional noturno 20% na janela 22h–5h
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_110()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(5110);
        v_base date := date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::date;
        v_dia date; v_cid uuid; v_not jsonb; v_diu jsonb; v_cpf2 text := public.qa_cpf(5111);
BEGIN
  v_dia := v_base + ((8 - EXTRACT(ISODOW FROM v_base)::int) % 7);
  v_cid := public.qa_ponto_dia_horarios(v_cpf, 'QA Noturno', v_dia, TIME '22:00', TIME '05:00');
  v_not := public.calcular_he_adicional_noturno_dia(v_cid, v_dia);
  v_cid := public.qa_ponto_dia_horarios(v_cpf2, 'QA Diurno', v_dia, TIME '08:00', TIME '17:00');
  v_diu := public.calcular_he_adicional_noturno_dia(v_cid, v_dia);

  r.passo_ordem := 1;
  r.passo_acao := 'Calcular turno 22h–5h (todo noturno) e turno 8h–17h (todo diurno)';
  r.esperado := 'Noturno: minutos na janela com adicional de 20%. Diurno: zero adicional';

  IF coalesce((v_not->>'adicional_noturno_min')::int, 0) > 0
     AND (v_not->>'percentual_adn')::numeric = 20
     AND coalesce((v_diu->>'adicional_noturno_min')::int, 0) = 0 THEN
    r.situacao := 'passou';
    r.obtido := format('Janela correta: turno noturno rendeu %s min de adicional (20%%) e o '
                       || 'diurno rendeu zero.', v_not->>'adicional_noturno_min');
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Janela do art. 73 errada: noturno=%s, diurno=%s (esperado noturno > 0 a '
                       || '20%% e diurno = 0).', v_not::text, v_diu::text);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- PONTO-111 — hora ficta de 52min30s
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_111()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(5112);
        v_base date := date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::date;
        v_dia date; v_cid uuid; v_res jsonb; v_adn int;
BEGIN
  v_dia := v_base + ((8 - EXTRACT(ISODOW FROM v_base)::int) % 7);
  v_cid := public.qa_ponto_dia_horarios(v_cpf, 'QA Ficta', v_dia, TIME '22:00', TIME '05:00');
  v_res := public.calcular_he_adicional_noturno_dia(v_cid, v_dia);
  v_adn := coalesce((v_res->>'adicional_noturno_min')::int, 0);

  r.passo_ordem := 1;
  r.passo_acao := '7 horas de relógio na janela noturna (420 min reais)';
  r.esperado := '480 min apurados — a hora ficta de 52min30s AUMENTA a contagem (420×60÷52,5)';

  IF v_adn = 480 THEN
    r.situacao := 'passou';
    r.obtido := 'A hora ficta foi aplicada: 420 minutos de relógio viraram 480 apurados.';
  ELSIF v_adn = 420 THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a hora ficta NÃO foi aplicada — 420 minutos de relógio ficaram 420. '
             || 'Ignorá-la subdimensiona a jornada noturna em 12,5% (art. 73, §1º).';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Contagem noturna inesperada: %s min (esperado 480 com ficta).', v_adn);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- PONTO-112 — prorrogação da jornada noturna mantém o adicional (Súmula 60, II)
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_112()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(5113);
        v_base date := date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::date;
        v_dia date; v_cid uuid; v_res jsonb; v_adn int;
BEGIN
  v_dia := v_base + ((8 - EXTRACT(ISODOW FROM v_base)::int) % 7);
  v_cid := public.qa_ponto_dia_horarios(v_cpf, 'QA Prorrogação', v_dia, TIME '22:00', TIME '07:00');
  v_res := public.calcular_he_adicional_noturno_dia(v_cid, v_dia);
  v_adn := coalesce((v_res->>'adicional_noturno_min')::int, 0);

  r.passo_ordem := 1;
  r.passo_acao := 'Jornada integralmente noturna prorrogada até as 7h (22h → 7h)';
  r.esperado := 'O adicional alcança TAMBÉM as horas após as 5h (Súmula 60, II, do TST)';

  IF v_adn > 480 THEN
    r.situacao := 'passou';
    r.obtido := format('A prorrogação manteve o adicional: %s min apurados (além dos 480 da janela).', v_adn);
  ELSIF v_adn = 480 THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o adicional CESSOU às 5h — as 2 horas de prorrogação (5h–7h) de uma '
             || 'jornada integralmente noturna ficaram SEM adicional. A Súmula 60, II, do TST '
             || 'manda o adicional acompanhar a prorrogação. O cálculo corta a janela em '
             || '05:00 fixo. Correção: quando a jornada é cumprida integralmente no período '
             || 'noturno, estender o adicional às horas prorrogadas.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Contagem inesperada: %s min.', v_adn);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- PONTO-113 — regime noturno rural
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_113()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o regime noturno RURAL existe (janela, percentual e hora cheia próprios)?';
  r.esperado := 'Lavoura 21h–5h / pecuária 20h–4h, adicional 25%, SEM hora ficta (Lei 5.889/73)';
  v_est := coalesce(public.qa_col_existe(NULL, '%rural%'), public.qa_fns_com('%rural%'));
  IF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: não existe regime rural — o cálculo noturno aplica a regra urbana '
             || '(22h–5h, 20%, ficta) a todo mundo. Trabalhador rural tem janela própria '
             || '(lavoura 21h–5h; pecuária 20h–4h), adicional de 25% e hora CHEIA (sem ficta) '
             || 'pela Lei 5.889/1973. Cliente do agro apuraria errado nos três eixos. Correção: '
             || 'enquadramento urbano/rural no vínculo, com parâmetros por regime.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Regime rural presente: %s.', v_est);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- PONTO-130 — domingo/feriado não compensado é pago em dobro
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_130()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(5130);
        v_base date := date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::date;
        v_dom date; v_cid uuid; v_res jsonb;
BEGIN
  -- primeiro domingo do mês passado
  v_dom := v_base + ((7 - EXTRACT(DOW FROM v_base)::int) % 7);
  v_cid := public.qa_ponto_dia_horarios(v_cpf, 'QA Domingo', v_dom, TIME '08:00', TIME '16:00');
  v_res := public.calcular_he_adicional_noturno_dia(v_cid, v_dom);

  r.passo_ordem := 1;
  r.passo_acao := format('Trabalho de jornada NORMAL (8h) num domingo (%s), sem folga compensatória', v_dom);
  r.esperado := 'As 8 horas rendem a dobra (Lei 605/49, art. 9º; Súmula 146) — não zero';

  IF coalesce((v_res->>'he100_min')::int, 0) >= 480 THEN
    r.situacao := 'passou';
    r.obtido := 'O domingo trabalhado sem compensação rendeu a dobra sobre a jornada inteira.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: o domingo trabalhado DENTRO da jornada rendeu %s min a 100%% — o '
             || 'cálculo só dobra o que EXCEDE a jornada (trata domingo como mera HE 100%%). '
             || 'Pela Lei 605/49 e Súmula 146 do TST, o trabalho em domingo/feriado não '
             || 'compensado é pago EM DOBRO por inteiro, jornada normal inclusive. Para '
             || 'feriados já existe a apuração própria (PONTO-320); para DOMINGO sem '
             || 'compensação não existe nada. Correção: detectar domingo sem folga '
             || 'compensatória na semana e dobrar a jornada trabalhada.',
             coalesce((v_res->>'he100_min')::text, '0'));
    r.detalhe := v_res;
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- PONTO-131 — feriado reconhecido pela unidade do colaborador
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_131()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_empA uuid; v_empB uuid; v_cpfA text; v_cpfB text;
        v_dia date := public.qa_dia_util_passado(); v_comp text;
        v_a record; v_b record;
BEGIN
  v_comp := to_char(v_dia, 'YYYY-MM');
  v_empA := public.qa_nova_empresa('QA Feriado Unidade A', '34.028.316/0001-03');
  v_empB := public.qa_nova_empresa('QA Feriado Unidade B', '60.701.190/0001-04');
  v_cpfA := public.qa_ponto_admissao('QA Colab Unidade A', 5131, v_empA);
  v_cpfB := public.qa_ponto_admissao('QA Colab Unidade B', 5132, v_empB);
  PERFORM public.qa_feriado_da_unidade(v_empA, v_dia);   -- feriado SÓ na unidade A
  PERFORM public.qa_ponto_dia(v_cpfA, 'QA Colab Unidade A', v_dia, v_empA);
  PERFORM public.qa_ponto_dia(v_cpfB, 'QA Colab Unidade B', v_dia, v_empB);

  r.passo_ordem := 1;
  r.passo_acao := 'Mesmo dia trabalhado nas unidades A (feriado municipal) e B (dia comum)';
  r.esperado := 'Adicional de feriado APENAS para o colaborador da unidade A';
  SELECT * INTO v_a FROM public.ponto_feriado_adicional_competencia(v_t, v_empA, v_comp) f
   WHERE regexp_replace(f.colaborador_cpf, '[^0-9]', '', 'g') = v_cpfA;
  SELECT * INTO v_b FROM public.ponto_feriado_adicional_competencia(v_t, v_empB, v_comp) f
   WHERE regexp_replace(f.colaborador_cpf, '[^0-9]', '', 'g') = v_cpfB;

  IF coalesce(v_a.qtd_feriados_trabalhados, 0) >= 1 AND v_b.colaborador_cpf IS NULL THEN
    r.situacao := 'passou';
    r.obtido := 'O feriado valeu para a unidade dele e para nenhuma outra.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Abrangência errada: unidade A (com feriado) apurou %s feriado(s) '
             || 'trabalhado(s); unidade B (sem feriado) %s. Feriado municipal vale para a '
             || 'unidade daquele município e para nenhuma outra.',
             coalesce(v_a.qtd_feriados_trabalhados, 0),
             CASE WHEN v_b.colaborador_cpf IS NULL THEN 'nada (correto)' ELSE 'TAMBÉM apurou' END);
  END IF;
  RETURN r;
EXCEPTION WHEN undefined_function THEN
  r.situacao := 'falhou';
  r.obtido := 'A apuração de feriado depende de função que não existe no banco '
           || '(feriado_comportamento — criada direto em produção, nunca versionada). '
           || 'Mesmo achado do PONTO-320/321.';
  r.erro_tecnico := SQLERRM; RETURN r;
WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- PONTO-132 — falta injustificada retira o DSR da semana
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_132()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a falta injustificada desconta o repouso semanal?';
  r.esperado := 'Semana com falta injustificada perde a remuneração do DSR (Lei 605/49, art. 6º)';
  v_fns := public.qa_fns_com('%dsr%');
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: DSR não existe em nenhuma função do banco — nem o desconto por falta '
             || 'injustificada (Lei 605/49, art. 6º), nem o reflexo das horas extras sobre o '
             || 'repouso. A falta hoje só marca o dia; a consequência semanal, frequentemente '
             || 'esquecida pelos sistemas, não é apurada. Correção: apuração semanal de '
             || 'assiduidade alimentando o evento de DSR na exportação para a folha.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('DSR tratado em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- PONTO-133 — semana sem 24h consecutivas de repouso gera alerta
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_133()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): sete dias seguidos de trabalho disparam alerta?';
  r.esperado := 'Semana sem 24h consecutivas de repouso é sinalizada (CLT art. 67)';
  v_fns := coalesce(public.qa_fns_com('%repouso%semanal%'), public.qa_fns_com('%24 horas%consecutiv%'),
                    public.qa_fns_com('%sete dias%'));
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: nada verifica o repouso semanal de 24 horas consecutivas. Colaborador '
             || 'que trabalha sete dias seguidos passa sem aviso — violação autônoma do art. 67, '
             || 'devida mesmo com tudo pago em dobro. Correção: verificação semanal na '
             || 'consolidação com alerta ao gestor.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Verificação presente em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- PONTO-150 — 12x36 apura ciclo de trabalho e folga
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_150()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a apuração entende o ciclo 12x36?';
  r.esperado := 'Dia de 12h no ciclo não gera HE; dia de folga não gera falta (art. 59-A)';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.proname NOT ILIKE '%corrigir%' AND p.proname NOT ILIKE '%copia%'
    AND (p.prosrc ILIKE '%ciclo_horas_trabalho%' OR p.prosrc ILIKE '%12x36%')
    AND (p.proname ILIKE '%saldo%' OR p.proname ILIKE '%apurar%'
         OR p.proname ILIKE '%consolidar%' OR p.proname ILIKE '%calc%');
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a escala guarda os campos de ciclo (ciclo_horas_trabalho/descanso em '
             || 'ponto_escalas), mas NENHUMA apuração os lê. Colaborador 12x36 teria 4 horas de '
             || '"extra" em todo plantão (12h contra jornada de 8h) e "falta" em toda folga de '
             || '36h. A escala tem regime próprio (art. 59-A) e depende de instrumento que a '
             || 'autorize. Correção: apuração por ciclo quando a modalidade da escala for de '
             || 'plantão.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Ciclo tratado em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- PONTO-151 — na 12x36, feriado e prorrogação noturna são compensados
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_151()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a apuração de feriado distingue a escala 12x36?';
  r.esperado := 'Na 12x36 o feriado trabalhado é compensado pela própria escala (art. 59-A, §2º) — sem dobra';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.proname ILIKE '%feriado%'
    AND (p.prosrc ILIKE '%12x36%' OR p.prosrc ILIKE '%ciclo_horas%' OR p.prosrc ILIKE '%plantao%');
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a apuração de feriado trabalhado (PONTO-320) não distingue a escala '
             || '12x36 — aplicaria a dobra a quem tem a compensação embutida por lei (art. '
             || '59-A, §2º: feriados e prorrogação noturna considerados compensados). É a '
             || 'exceção legal expressa: aplicar a regra geral gera PAGAMENTO INDEVIDO. '
             || 'Correção: a apuração de feriado deve pular vínculos em escala de plantão '
             || 'autorizada.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Distinção presente em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- PONTO-152 — troca de escala preserva o histórico de vigência
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_152()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(5152);
        v_d_antigo date := CURRENT_DATE - 30; v_d_novo date := CURRENT_DATE - 5;
        e_antigo record; e_novo record;
BEGIN
  PERFORM public.qa_ponto_escala_tol(v_cpf, 'QA Vigência A', 480, 10, CURRENT_DATE - 60, CURRENT_DATE - 15);
  PERFORM public.qa_ponto_escala_tol(v_cpf, 'QA Vigência B', 360, 10, CURRENT_DATE - 14, NULL);

  r.passo_ordem := 1;
  r.passo_acao := 'Trocar de escala (480 min → 360 min) e consultar a escala de um dia ANTIGO e de um dia NOVO';
  r.esperado := 'O dia antigo responde com a escala antiga; o novo, com a nova';
  SELECT * INTO e_antigo FROM public.ponto_escala_do_dia(
    public.qa_sandbox_tenant_id(), v_cpf, v_cpf, v_d_antigo) LIMIT 1;
  SELECT * INTO e_novo FROM public.ponto_escala_do_dia(
    public.qa_sandbox_tenant_id(), v_cpf, v_cpf, v_d_novo) LIMIT 1;

  IF coalesce(e_antigo.jornada_min, -1) IN (480, 0) AND coalesce(e_novo.jornada_min, -1) IN (360, 0)
     AND NOT (coalesce(e_antigo.jornada_min,0) = 0 AND coalesce(e_novo.jornada_min,0) = 0) THEN
    r.situacao := 'passou';
    r.obtido := 'Cada dia respondeu com a escala vigente na época — o passado ficou com a '
             || 'escala antiga.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Vigência de escala mal resolvida: dia antigo devolveu jornada %s '
             || '(esperado a antiga, 480) e dia novo %s (esperado a nova, 360). Apurar dia '
             || 'antigo com escala nova falsifica o passado.',
             coalesce(e_antigo.jornada_min::text, 'nada'), coalesce(e_novo.jornada_min::text, 'nada'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- PONTO-153 — alteração de parâmetro não altera competência já apurada
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_153()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(5153);
        v_base date := date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::date;
        v_dia date; v_antes int; v_depois int;
BEGIN
  v_dia := v_base + ((8 - EXTRACT(ISODOW FROM v_base)::int) % 7);
  PERFORM public.qa_ponto_escala_tol(v_cpf, 'QA Retroação', 480, 10, v_dia, v_dia);
  PERFORM public.qa_ponto_dia_min(v_cpf, 'QA Retroação', v_dia, 540);  -- +60

  SELECT max(s.saldo_min) INTO v_antes
  FROM public.ponto_saldo_dias_competencia(public.qa_sandbox_tenant_id(), v_cpf,
       to_char(v_dia, 'YYYY-MM')) s WHERE s.dia = v_dia;

  r.passo_ordem := 1;
  r.passo_acao := 'Apurar competência passada, ALTERAR a jornada da escala e reapurar o mesmo dia';
  r.esperado := 'O resultado do dia antigo NÃO muda — parâmetro versionado não retroage';
  UPDATE public.ponto_escalas SET jornada_diaria_minutos = 300
  WHERE tenant_id = public.qa_sandbox_tenant_id() AND nome = 'QA escala ' || v_cpf;

  SELECT max(s.saldo_min) INTO v_depois
  FROM public.ponto_saldo_dias_competencia(public.qa_sandbox_tenant_id(), v_cpf,
       to_char(v_dia, 'YYYY-MM')) s WHERE s.dia = v_dia;

  IF v_antes = v_depois THEN
    r.situacao := 'passou';
    r.obtido := format('O dia antigo manteve o saldo (%s min) após a mudança do parâmetro.', v_antes);
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: mudar a jornada da escala HOJE reescreveu a apuração de um dia '
             || 'do mês PASSADO (saldo foi de %s para %s min). Os parâmetros da escala não são '
             || 'versionados por vigência — a apuração lê sempre o valor atual. Todo espelho '
             || 'antigo muda junto: auditoria vira reescrita da história. Correção: versionar '
             || 'parâmetros com vigência (a estrutura de atribuições por período já existe; '
             || 'falta a escala em si não ser editada em vigor, e sim substituída).',
             coalesce(v_antes::text, '-'), coalesce(v_depois::text, '-'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- PONTO-170 — HE só vai para banco com instrumento vigente
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_170()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(5170);
        v_base date := date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::date;
        v_dia date; v_comp text; v_cred int;
BEGIN
  v_dia := v_base + ((8 - EXTRACT(ISODOW FROM v_base)::int) % 7);
  v_comp := to_char(v_dia, 'YYYY-MM');
  PERFORM public.qa_ponto_escala_tol(v_cpf, 'QA Banco Sem Acordo', 480, 10, v_dia, v_dia);
  PERFORM public.qa_ponto_dia_min(v_cpf, 'QA Banco Sem Acordo', v_dia, 540);  -- +60

  r.passo_ordem := 1;
  r.passo_acao := 'Apurar banco de horas de colaborador SEM nenhum regime/acordo de banco configurado';
  r.esperado := 'A hora extra NÃO entra em banco — sem instrumento (art. 59, §§2º/5º) ela é devida em dinheiro';
  PERFORM public.apurar_banco_horas_colaborador(public.qa_sandbox_tenant_id(), v_cpf, v_comp);
  SELECT creditos_minutos INTO v_cred FROM public.ponto_banco_horas
  WHERE tenant_id = public.qa_sandbox_tenant_id() AND colaborador_cpf = v_cpf AND competencia = v_comp;

  IF v_cred IS NULL OR v_cred = 0 THEN
    r.situacao := 'passou';
    r.obtido := 'Sem instrumento, nenhum crédito foi para o banco.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: %s min de hora extra entraram no BANCO sem existir regime '
             || 'configurado (ponto_banco_horas_config vazio) nem acordo anexado. A apuração '
             || 'credita banco para todo mundo, incondicionalmente. Sem instrumento válido, '
             || 'hora extra é devida em DINHEIRO na competência — mandar para banco sem lastro '
             || 'é postergar pagamento devido. Correção: apurar banco apenas para vínculos com '
             || 'regime vigente; os demais exportam a HE para a folha.', v_cred);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- PONTO-171 — saldo não compensado no prazo vira HE devida
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_171()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_preenche boolean;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o vencimento do saldo é controlado de ponta a ponta?';
  r.esperado := 'Prazo derivado do regime na apuração + conversão automática ao vencer';
  SELECT bool_or(p.prosrc ILIKE '%prazo_compensacao%') INTO v_preenche
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('apurar_banco_horas', 'apurar_banco_horas_colaborador');
  IF NOT coalesce(v_preenche, false) THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO (confirma o PONTO-354): a conversão de saldo vencido existe e funciona, '
             || 'mas nunca dispara porque a apuração jamais grava prazo_compensacao na linha do '
             || 'banco. Vencido o prazo legal (6 meses no acordo individual; 1 ano no coletivo), '
             || 'a compensação deixa de ser possível e a hora vira crédito em dinheiro — hoje o '
             || 'saldo fica pendurado para sempre. Correção: prazo derivado do regime na '
             || 'apuração de cada competência.';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'A apuração grava o prazo e a conversão tem o que converter.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- PONTO-172 — compensação respeita o limite de 10 horas diárias
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_172()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o regime de compensação limita a jornada a 10h/dia?';
  r.esperado := 'Jornada compensatória não pode passar de 10h (art. 59, §2º) — verificação própria';
  v_fns := coalesce(public.qa_fns_com('%600%compensa%'), public.qa_fns_com('%10 horas%'),
                    public.qa_fns_com('%dez horas%'));
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: nenhuma verificação limita a jornada em regime de compensação às 10 '
             || 'horas diárias do art. 59, §2º. O limite é DO REGIME e independe do teto de 2h '
             || 'extras: dia de 11h com banco de horas é irregular mesmo que o saldo compense '
             || 'depois. A configuração de jornada máxima existe (jornada_diaria_max_minutos), '
             || 'mas nada a confronta na apuração do banco. Correção: alerta na consolidação '
             || 'quando o dia em regime de compensação passar de 600 minutos.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Limite verificado em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- PONTO-173 — rescisão com saldo de banco
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_173()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o desligamento liquida o saldo do banco de horas?';
  r.esperado := 'Saldo positivo pago na rescisão sobre a REMUNERAÇÃO DA RESCISÃO (art. 59, §3º)';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%banco_horas%'
    AND (p.prosrc ILIKE '%rescis%' OR p.prosrc ILIKE '%desliga%');
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o desligamento não conversa com o banco de horas — nenhuma função '
             || 'liquida o saldo na rescisão. O art. 59, §3º manda pagar as horas não '
             || 'compensadas calculadas sobre a remuneração DA DATA DA RESCISÃO (não a da '
             || 'época trabalhada). Colaborador desligado com saldo positivo simplesmente '
             || 'perde o registro. Correção: gatilho de desligamento que apura e exporta o '
             || 'saldo final para a rescisão.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Liquidação presente em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- PONTO-174 — habitualidade NÃO invalida o acordo de compensação
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_174()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): alguma rotina invalida o banco por habitualidade de HE?';
  r.esperado := 'Nenhuma — o art. 59-B, parágrafo único (pós-reforma) diz que a habitualidade NÃO descaracteriza';
  v_fns := public.qa_fns_com('%habitual%invalid%');
  IF v_fns IS NULL THEN
    r.situacao := 'passou';
    r.obtido := 'Nenhuma rotina invalida o acordo de compensação por habitualidade — correto '
             || 'pós-reforma (art. 59-B, parágrafo único). Sistema que invalidasse aplicaria '
             || 'direito revogado (antiga Súmula 85, IV).';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: rotina(s) invalidando banco por habitualidade: %s — regra '
             || 'revogada pela Lei 13.467/2017.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- PONTO-175 — reapuração preserva lançamento manual
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_175()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(5175);
        v_base date := date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::date;
        v_dia date; v_comp text; v_banco uuid; v_manual int;
BEGIN
  v_dia := v_base + ((8 - EXTRACT(ISODOW FROM v_base)::int) % 7);
  v_comp := to_char(v_dia, 'YYYY-MM');
  PERFORM public.qa_ponto_escala_tol(v_cpf, 'QA Manual Preservado', 480, 10, v_dia, v_dia);
  PERFORM public.qa_ponto_dia_min(v_cpf, 'QA Manual Preservado', v_dia, 540);
  PERFORM public.apurar_banco_horas_colaborador(public.qa_sandbox_tenant_id(), v_cpf, v_comp);
  SELECT id INTO v_banco FROM public.ponto_banco_horas
  WHERE tenant_id = public.qa_sandbox_tenant_id() AND colaborador_cpf = v_cpf AND competencia = v_comp;
  IF v_banco IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'Não foi possível montar o cenário: a apuração não criou a linha do banco.';
    RETURN r;
  END IF;
  INSERT INTO public.ponto_banco_horas_movimentacoes
    (tenant_id, banco_horas_id, colaborador_cpf, data_referencia, tipo, minutos, descricao, origem)
  VALUES (public.qa_sandbox_tenant_id(), v_banco, v_cpf, v_dia, 'credito', 33,
          'Lançamento manual do gestor (QA)', 'manual');

  r.passo_ordem := 1;
  r.passo_acao := 'Reapurar a competência e conferir o lançamento manual de 33 min';
  r.esperado := 'O manual sobrevive — reapuração regenera só as movimentações automáticas';
  PERFORM public.apurar_banco_horas_colaborador(public.qa_sandbox_tenant_id(), v_cpf, v_comp);
  SELECT count(*) INTO v_manual FROM public.ponto_banco_horas_movimentacoes
  WHERE banco_horas_id = v_banco AND origem = 'manual' AND minutos = 33;

  IF v_manual = 1 THEN
    r.situacao := 'passou';
    r.obtido := 'O lançamento manual sobreviveu à reapuração — só as movimentações automáticas '
             || 'foram regeneradas.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('O lançamento manual %s após a reapuração — regenerar decisão humana '
             || 'registrada apaga autor e justificativa.',
             CASE WHEN v_manual = 0 THEN 'SUMIU' ELSE 'foi duplicado' END);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- PONTO-190 — ajuste cria batida de correção e preserva a original
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_190()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_fantasma boolean;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o caminho de correção por ajuste aprovado funciona no banco?';
  r.esperado := 'Aprovação de correção insere marcação de ajuste (original=false) preservando a fonte';
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'processar_ajuste_ponto'
      AND p.prosrc ILIKE '%data_hora%'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ponto_marcacoes' AND column_name = 'data_hora'
  ) INTO v_fantasma;

  IF v_fantasma THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO (o mesmo do PONTO-357, agora no caso que lhe é próprio): o ÚNICO caminho '
             || 'legítimo de correção — aprovação do ajuste inserindo a batida de correção — '
             || 'está quebrado no banco: processar_ajuste_ponto grava usando colunas que não '
             || 'existem em ponto_marcacoes (data_hora/tipo/origem; a tabela usa data_marcacao/'
             || 'hora_marcacao/tipo_marcacao). Aprovar correção ou inclusão por essa função '
             || 'quebra em execução, ou a tela contorna a função por caminho próprio. '
             || 'Correção: alinhar o INSERT/DELETE ao esquema real.';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'O fluxo de correção por ajuste referencia o esquema real (batida de correção '
             || 'com original preservada).';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- PONTO-191 — cadeia de hash detecta alteração direta
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_191()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_fns text; v_encadeado boolean;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o hash das marcações é encadeado e alguém o confere?';
  r.esperado := 'Hash de cada marcação incorpora o anterior (cadeia) + rotina de verificação da cadeia';
  SELECT bool_or(p.prosrc ILIKE '%anterior%'), string_agg(DISTINCT p.proname, ', ')
    INTO v_encadeado, v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%hash_marcacao%' AND p.prosrc ILIKE '%verific%';

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: cada marcação tem hash próprio, mas (1) o hash NÃO é encadeado — não '
             || 'incorpora o hash da marcação anterior, então remover uma linha inteira não '
             || 'quebra nada — e (2) NENHUMA rotina confere os hashes: um UPDATE direto com a '
             || 'trava desligada, ou feito por quem pode, nunca seria detectado. Encadeamento '
             || 'verificado é o que transforma "não editamos" em prova (registro tipo 7 do '
             || 'AFD). Correção: hash(linha + hash_anterior) + rotina periódica de verificação '
             || 'da cadeia com alerta.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Verificação de hash presente em: %s (encadeado: %s).', v_fns, v_encadeado);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- PONTO-192 — trilha de auditoria não pode ser apagada
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_192()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_cpf text; v_log uuid;
        v_del boolean := false; v_upd boolean := false;
BEGIN
  v_cpf := public.qa_ponto_admissao('QA Trilha', 5192);
  PERFORM public.qa_ponto_marca(v_cpf, 'QA Trilha', CURRENT_DATE - 1, TIME '09:00', 'entrada');
  SELECT id INTO v_log FROM public.ponto_audit_log
  WHERE tenant_id = public.qa_sandbox_tenant_id() ORDER BY created_at DESC LIMIT 1;
  IF v_log IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'A marcação não gerou registro na trilha (ponto_audit_log vazio para o cercado) '
             || '— trilha incompleta.';
    RETURN r;
  END IF;

  r.passo_ordem := 1;
  r.passo_acao := 'Tentar APAGAR e ALTERAR um registro da trilha de auditoria';
  r.esperado := 'Ambos bloqueados — trilha que se apaga não é trilha';
  BEGIN
    DELETE FROM public.ponto_audit_log WHERE id = v_log;
    v_del := NOT EXISTS (SELECT 1 FROM public.ponto_audit_log WHERE id = v_log);
  EXCEPTION WHEN OTHERS THEN v_del := false; END;
  BEGIN
    UPDATE public.ponto_audit_log SET acao = 'adulterado' WHERE id = v_log;
    v_upd := true;
  EXCEPTION WHEN OTHERS THEN v_upd := false; END;

  IF NOT v_del AND NOT v_upd THEN
    r.situacao := 'passou';
    r.obtido := 'A trilha recusou exclusão e alteração — registro imutável (append-only).';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('A trilha foi %s — auditoria que se edita não prova nada.',
             CASE WHEN v_del AND v_upd THEN 'APAGADA e ALTERADA'
                  WHEN v_del THEN 'APAGADA' ELSE 'ALTERADA' END);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- PONTO-193 — competência fechada não aceita alteração
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_193()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_cpf text;
        v_mes date := date_trunc('month', CURRENT_DATE - INTERVAL '3 months')::date;
        v_fech uuid; v_bloqueou boolean := false;
BEGIN
  v_cpf := public.qa_ponto_admissao('QA Fechado', 5193, NULL, v_mes - 30);
  INSERT INTO public.ponto_fechamentos (tenant_id, competencia, status, data_fechamento)
  VALUES (public.qa_sandbox_tenant_id(), to_char(v_mes, 'YYYY-MM'), 'fechado', now())
  RETURNING id INTO v_fech;

  r.passo_ordem := 1;
  r.passo_acao := format('Tentar marcar ponto em competência FECHADA (%s), sem privilégio', to_char(v_mes, 'YYYY-MM'));
  r.esperado := 'Recusado — documento entregue e assinado não se altera';
  BEGIN
    PERFORM public.qa_ponto_marca(v_cpf, 'QA Fechado', v_mes + 2, TIME '08:00', 'entrada');
    v_bloqueou := false;
  EXCEPTION WHEN OTHERS THEN v_bloqueou := true; END;

  DELETE FROM public.ponto_fechamentos WHERE id = v_fech;  -- não poluir os demais casos

  IF v_bloqueou THEN
    r.situacao := 'passou';
    r.obtido := 'A competência fechada recusou a marcação. Nota de risco: o gatilho abre '
             || 'exceção para papéis de gestão (a "válvula" já apontada na trilha de ajustes) '
             || '— a reabertura formal do PONTO-358 é o caminho correto.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := 'A competência FECHADA aceitou marcação nova sem reabertura — o espelho já '
             || 'entregue muda por baixo dos panos.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- PONTO-194 — falha no fechamento não deixa espelho parcial
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_194()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a geração de espelhos do fechamento é atômica no banco?';
  r.esperado := 'Falha no meio não deixa competência com espelhos de metade dos colaboradores';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%ponto_espelhos%' AND p.prosrc ILIKE '%INSERT%';
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: nenhuma função do banco GERA os espelhos — eles nascem por um caminho '
             || 'de tela/edge que o banco não conhece, gravando linha a linha em '
             || 'ponto_espelhos. Sem uma função transacional, falha no meio deixa espelho '
             || 'parcial (metade dos colaboradores com documento, metade sem) — pior que '
             || 'ausente, porque parece completo. Correção: geração dos espelhos da '
             || 'competência numa função única (tudo-ou-nada) chamada pelo fechamento.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Geração transacional presente em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- PONTO-210/211/212 — AFD e AEJ
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_210()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_nsr text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o AFD tem numeração sequencial (NSR) sem lacunas?';
  r.esperado := 'NSR sequencial por registro — é o que demonstra que nada foi removido';
  v_nsr := public.qa_col_existe('ponto_marcacoes', '%nsr%');
  v_fns := public.qa_fns_com('%nsr%');
  IF v_nsr IS NULL AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o NSR não existe — nem coluna na marcação, nem geração em função '
             || 'alguma. Sem numeração sequencial de registro, o AFD gerado na exportação '
             || 'improvisa números na hora (auditoria de conformidade já apontou o leiaute '
             || 'fora do padrão) e NADA demonstra que nenhum registro foi removido. É o '
             || 'requisito central do arquivo-fonte da Portaria 671. Correção: NSR atribuído '
             || 'na gravação da marcação, sequencial por origem, imutável.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('NSR presente (coluna: %s; funções: %s).', coalesce(v_nsr,'—'), coalesce(v_fns,'—'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_ponto_211()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o AEJ existe?';
  r.esperado := 'Arquivo Eletrônico de Jornada gerado pelo programa de tratamento (Portaria 671)';
  v_fns := coalesce(public.qa_fns_com('%aej%'), public.qa_col_existe(NULL, '%aej%'));
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO (confirma a auditoria de conformidade): o AEJ não existe em lugar '
             || 'nenhum do banco — nem função, nem coluna, nem tabela. É a saída OBRIGATÓRIA '
             || 'do programa de tratamento na Portaria 671 (substituiu AFDT/ACJEF) e a peça '
             || 'que a fiscalização pede junto com o AFD. Correção: gerador de AEJ no leiaute '
             || 'vigente, assinado, a partir da apuração da competência.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('AEJ presente: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_ponto_212()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_val text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a importação de AFD detecta lacuna de NSR?';
  r.esperado := 'Arquivo com sequência quebrada é recusado POR INTEIRO';
  v_val := coalesce(public.qa_fns_com('%lacuna%'), public.qa_fns_com('%sequencial%nsr%'),
                    public.qa_fns_com('%nsr%sequencia%'));
  IF v_val IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: sem NSR no modelo (PONTO-210) e sem validação de integridade na '
             || 'importação (PONTO-382), a lacuna de sequência nem é DETECTÁVEL — um AFD com '
             || 'registros removidos entraria inteiro e viraria prova adulterada no acervo. '
             || 'Correção: validar a sequência de NSR na importação e recusar o arquivo '
             || 'completo em caso de lacuna, com relatório.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Validação de lacuna presente em: %s.', v_val);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- PONTO-213 — sistema alternativo exige autorização coletiva
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_213()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_aceitou boolean := false;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'Configurar registro por link externo SEM instrumento coletivo anexado';
  r.esperado := 'Recusado ou condicionado — REP-A exige norma coletiva; sem ela, o app precisa das formalidades do REP-P';
  BEGIN
    INSERT INTO public.ponto_configuracao (tenant_id, modo_registro)
    VALUES (public.qa_sandbox_tenant_id(), 'link_externo');
    v_aceitou := true;
  EXCEPTION WHEN check_violation OR raise_exception OR unique_violation THEN
    v_aceitou := false;
  END;

  IF v_aceitou THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o modo de registro por link externo foi ativado sem NENHUM documento '
             || 'de autorização — nem instrumento coletivo (REP-A), nem os requisitos formais '
             || 'de REP-P (registro INPI, certificado, comprovante, NSR — ver PONTO-210/380). '
             || 'Operar registro alternativo sem lastro formal invalida o controle perante a '
             || 'Portaria 671. Correção: condicionar o modo à evidência documental, como no '
             || 'registro por exceção (PONTO-372).';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'O modo alternativo sem autorização foi recusado.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- PONTO-358 — reabertura formal de competência
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_358()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): existe reabertura FORMAL de competência fechada?';
  r.esperado := 'Reabertura com motivo, alçada e trilha; novo fechamento gera NOVA versão do espelho';
  v_fns := coalesce(public.qa_fns_com('%reabr%'), public.qa_fns_com('%reabert%'));
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: não existe reabertura formal. O que existe é a válvula do gatilho '
             || '(papéis de gestão marcam em competência fechada sem rito — PONTO-193). Erro '
             || 'legítimo descoberto depois precisa de saída FORMAL: reabrir com motivo e '
             || 'alçada registrados, recalcular, e o espelho ganhar NOVA VERSÃO — o documento '
             || 'que o colaborador cientificou não pode ser regravado por cima. Correção: '
             || 'fluxo de reabertura com estado próprio no fechamento e versionamento do '
             || 'espelho.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Reabertura formal presente em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- PONTO-359 — extração dos comprovantes das últimas 48 horas
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_359()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o trabalhador consegue extrair os comprovantes de um período?';
  r.esperado := 'Extração dos comprovantes (janela mínima de 48h) pelo próprio colaborador';
  v_est := coalesce(public.qa_fns_com('%comprovante%'), NULL);
  IF v_est IS NULL OR to_regclass('public.ponto_comprovantes') IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: depende do comprovante existir como documento (PONTO-380) — hoje é um '
             || 'boolean na marcação, então não há o que extrair. Quando o comprovante '
             || 'nascer, a extração por período (janela mínima de 48h, direito do trabalhador '
             || 'no REP-P) é uma função de listagem restrita ao próprio CPF.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Extração presente: %s.', v_est);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- PONTO-360 — certificado de assinatura perto de vencer
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_360()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o certificado de assinatura digital é gerenciado?';
  r.esperado := 'Cadastro do certificado (ICP-Brasil) com vigência e alerta de vencimento';
  v_est := coalesce(public.qa_col_existe(NULL, '%certificado_digital%'),
                    public.qa_col_existe(NULL, '%icp%'),
                    public.qa_fns_com('%icp-brasil%'), public.qa_fns_com('%p7s%'));
  IF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: não existe gestão de certificado digital — nem cadastro, nem vigência, '
             || 'nem alerta. Consequência dupla: (1) AFD/AEJ não têm COM QUE ser assinados '
             || '(a auditoria de conformidade já apontou a ausência de assinatura ICP-Brasil); '
             || '(2) quando a assinatura existir, um certificado vencido paralisa a emissão '
             || 'dos artefatos exatamente na hora da fiscalização. Correção: cadastro do '
             || 'certificado por empresa com vencimento vigiado (alerta com antecedência '
             || 'parametrizada).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Gestão de certificado presente: %s.', v_est);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- PONTO-361 — exportação para a folha com grandezas e naturezas corretas
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_361()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a exportação para a folha é gerada por função auditável?';
  r.esperado := 'Eventos com grandeza real (horas, valores) e natureza correta (vencimento/desconto/indenização)';
  v_fns := public.qa_fns_com('%exportacoes_folha%');
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a exportação para a folha não tem função no banco — a tabela '
             || 'ponto_exportacoes_folha guarda um jsonb montado pela tela, sem regra '
             || 'verificável de composição. Não há como garantir grandezas reais (o DSR nem é '
             || 'apurado — PONTO-132; o excesso de HE é cortado — PONTO-092) nem naturezas '
             || 'corretas (vencimento × desconto × indenizatória). É onde o ponto vira '
             || 'dinheiro: zero afirmativo aqui é dívida silenciosa. Correção: função de '
             || 'composição do pacote a partir da apuração fechada, com memória.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Composição auditável presente em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- PONTO-362 — enumeração de CPFs em link compartilhado é bloqueada
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_362()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): tentativas seguidas de CPFs diferentes no mesmo link são contidas?';
  r.esperado := 'Bloqueio temporário e registro do padrão de enumeração';
  v_est := coalesce(public.qa_col_existe('ponto_links', '%tentativa%'),
                    public.qa_col_existe('ponto_links', '%bloque%'));
  IF v_est IS NULL THEN
    SELECT string_agg(p.proname, ', ') INTO v_est
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
      AND p.proname ILIKE '%ponto%' AND p.prosrc ILIKE '%tentativ%'
      AND (p.prosrc ILIKE '%link%' OR p.prosrc ILIKE '%token%');
  END IF;
  IF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: as funções do link compartilhado (registrar_ponto_externo_cpf e '
             || 'afins) não guardam tentativas nem aplicam bloqueio — CPFs em sequência no '
             || 'mesmo link (padrão clássico de enumeração para descobrir CPFs válidos da '
             || 'empresa e marcar por terceiros) passam sem registro nem contenção. Correção: '
             || 'contador de tentativas frustradas por link/IP com bloqueio temporário e '
             || 'evento na trilha.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Contenção presente: %s.', v_est);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- Registro no motor
INSERT INTO public.qa_implementacoes (codigo, funcao_sql, ativo) VALUES
  ('PONTO-110','qa_caso_ponto_110',true), ('PONTO-111','qa_caso_ponto_111',true),
  ('PONTO-112','qa_caso_ponto_112',true), ('PONTO-113','qa_caso_ponto_113',true),
  ('PONTO-130','qa_caso_ponto_130',true), ('PONTO-131','qa_caso_ponto_131',true),
  ('PONTO-132','qa_caso_ponto_132',true), ('PONTO-133','qa_caso_ponto_133',true),
  ('PONTO-150','qa_caso_ponto_150',true), ('PONTO-151','qa_caso_ponto_151',true),
  ('PONTO-152','qa_caso_ponto_152',true), ('PONTO-153','qa_caso_ponto_153',true),
  ('PONTO-170','qa_caso_ponto_170',true), ('PONTO-171','qa_caso_ponto_171',true),
  ('PONTO-172','qa_caso_ponto_172',true), ('PONTO-173','qa_caso_ponto_173',true),
  ('PONTO-174','qa_caso_ponto_174',true), ('PONTO-175','qa_caso_ponto_175',true),
  ('PONTO-190','qa_caso_ponto_190',true), ('PONTO-191','qa_caso_ponto_191',true),
  ('PONTO-192','qa_caso_ponto_192',true), ('PONTO-193','qa_caso_ponto_193',true),
  ('PONTO-194','qa_caso_ponto_194',true), ('PONTO-210','qa_caso_ponto_210',true),
  ('PONTO-211','qa_caso_ponto_211',true), ('PONTO-212','qa_caso_ponto_212',true),
  ('PONTO-213','qa_caso_ponto_213',true), ('PONTO-358','qa_caso_ponto_358',true),
  ('PONTO-359','qa_caso_ponto_359',true), ('PONTO-360','qa_caso_ponto_360',true),
  ('PONTO-361','qa_caso_ponto_361',true), ('PONTO-362','qa_caso_ponto_362',true)
ON CONFLICT (codigo) DO UPDATE SET funcao_sql = EXCLUDED.funcao_sql, ativo = true;
