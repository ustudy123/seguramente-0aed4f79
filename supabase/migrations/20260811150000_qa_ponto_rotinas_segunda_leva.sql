-- =========================================================
-- QA — Ponto: rotinas das frentes de agosto — 2ª leva (11/08)
--
-- Fecha os 7 casos documentados em 20260808200000 que ficaram sem
-- rotina por exigirem cenário completo: atestado cobrindo o dia
-- (PONTO-291), a válvula de empresa no reapurar (PONTO-312), feriado
-- resolvido pela unidade com marcação no dia (PONTO-320..322) e
-- competência apurada para o espelho-resumo (PONTO-330..331).
--
-- Fixture nova: qa_feriado_da_unidade(empresa, data) monta a tabela de
-- feriados, o item na data e o vínculo com a unidade — o cenário RN22
-- completo que a apuração RN23 consome via feriados_da_empresa().
--
-- PONTO-312 é implementado como AUDITORIA DE FONTE (somente leitura):
-- a correção de 04/08 removeu dois padrões perigosos das funções de
-- apuração ("OR empresa_id IS NULL" e o carimbo
-- "COALESCE(p_empresa_id, r.empresa_id)"). A rotina varre o catálogo e
-- acusa se qualquer função de ponto voltar a contê-los — é o alarme
-- contra a reintrodução da válvula que fechava o tenant inteiro.
--
-- NENHUMA CORREÇÃO DE FUNCIONALIDADE. Só rotinas e fixtures qa_*.
-- =========================================================

SET lock_timeout = '10s';

-- Correção do helper da 1ª leva: o status default 'completo' não existe no
-- CHECK de ponto_diario (pendente|regular|atraso|falta|incompleto|
-- ajuste_pendente|justificado) — derrubava as rotinas no insert. Passa a
-- 'regular', e horas_trabalhadas segue como INTERVAL (correção de 08/08).
CREATE OR REPLACE FUNCTION public.qa_ponto_dia(
  p_cpf text, p_nome text, p_data date,
  p_empresa_id uuid DEFAULT NULL,
  p_status text DEFAULT 'regular'
)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.ponto_diario
    (tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
     data, entrada, saida_almoco, retorno_almoco, saida, horas_trabalhadas, status)
  VALUES (public.qa_sandbox_tenant_id(), p_empresa_id, gen_random_uuid(), p_nome, p_cpf,
          p_data, TIME '08:00', TIME '12:00', TIME '13:00', TIME '17:00',
          INTERVAL '8 hours', p_status);
END $$;

-- Fixture: feriado resolvido pela unidade (tabela + item + vínculo RN22).
CREATE OR REPLACE FUNCTION public.qa_feriado_da_unidade(
  p_empresa_id uuid, p_data date, p_nome text DEFAULT '[QA] Feriado de Teste'
)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_t uuid := public.qa_sandbox_tenant_id(); v_tab uuid;
BEGIN
  INSERT INTO public.feriado_tabelas (tenant_id, nome, uf, municipio, ano, ativo)
  VALUES (v_t, p_nome || ' ' || p_data, 'SP', 'São Paulo', EXTRACT(YEAR FROM p_data)::int, true)
  RETURNING id INTO v_tab;
  INSERT INTO public.feriado_tabela_itens (tenant_id, tabela_id, nome, data, recorrente, tipo, ativo)
  VALUES (v_t, v_tab, p_nome, p_data, false, 'feriado', true);
  INSERT INTO public.feriado_tabela_empresas (tenant_id, tabela_id, empresa_id)
  VALUES (v_t, v_tab, p_empresa_id);
  RETURN v_tab;
END $$;

-- ══ PONTO-291: ausência amparada não vira falta na materialização ══
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_291()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_cpf text; v_dia date := public.qa_dia_util_passado(); v_status text;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_cpf := public.qa_ponto_admissao('[QA-PONTO] Amparado', 29101);

  r.passo_ordem := 1;
  r.passo_acao := format('Registrar atestado cobrindo o dia útil %s e materializar', v_dia);
  r.esperado := 'Linha criada com status de ausência amparada, sem virar falta';
  INSERT INTO public.atestados
    (tenant_id, colaborador_nome, colaborador_cpf, tipo, data_emissao,
     profissional_nome, profissional_registro,
     data_inicio_afastamento, data_fim_afastamento, unidade_afastamento)
  VALUES (v_t, '[QA-PONTO] Amparado', v_cpf, 'assistencial', v_dia,
          '[QA] Dr. Teste', 'CRM-QA-0001', v_dia, v_dia, 'dias');

  PERFORM public.ponto_materializar_faltas(v_dia, v_dia, v_t);

  SELECT status INTO v_status FROM public.ponto_diario
  WHERE tenant_id = v_t AND colaborador_cpf = v_cpf AND data = v_dia
  ORDER BY created_at DESC LIMIT 1;

  IF v_status IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'A materialização não criou linha nem para o dia amparado — o atestado sumiu junto com a falta (ver PONTO-290).';
  ELSIF v_status = 'falta' THEN
    r.situacao := 'falhou';
    r.obtido := 'O DIA COM ATESTADO VIROU FALTA: a materialização é um gerador cego de débito — desconta ausência amparada pela CLT art. 473. O colaborador com atestado válido perderia remuneração e DSR.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Dia amparado materializado com status %s — a falta não engoliu o atestado.', v_status);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ PONTO-312: a válvula de empresa não pode voltar (auditoria de fonte) ══
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_312()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_n int; v_lista text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): varrer as funções de ponto atrás dos dois padrões removidos em 04/08';
  r.esperado := 'Nenhuma função com "OR empresa_id IS NULL" nem com o carimbo "COALESCE(p_empresa_id, r.empresa_id)"';

  SELECT count(*), string_agg(p.proname, ', ' ORDER BY p.proname)
  INTO v_n, v_lista
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname LIKE 'ponto\_%'
    AND p.prokind = 'f'
    AND (pg_get_functiondef(p.oid) ILIKE '%= p_empresa_id OR%empresa_id IS NULL%'
         OR pg_get_functiondef(p.oid) ILIKE '%COALESCE(p_empresa_id, r.empresa_id)%');

  IF v_n = 0 THEN
    r.situacao := 'passou';
    r.obtido := 'Nenhuma função de ponto contém a válvula de escape nem o carimbo de empresa. A correção de 04/08 (fechamento por empresa) segue de pé.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('A VÁLVULA VOLTOU em %s função(ões): %s. Com ela, colaborador sem empresa entra na apuração de TODAS as empresas e o reapurar reatribui a empresa de quem já tem — o defeito que exigiu migration de reparo em 04/08.', v_n, v_lista);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ PONTO-320: feriado trabalhado sem folga rende adicional de 100% ══
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_320()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_emp uuid; v_cpf text; v_dia date := public.qa_dia_util_passado();
        v_comp text; a record;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_comp := to_char(v_dia, 'YYYY-MM');
  v_emp := public.qa_nova_empresa('[QA-RN23] Unidade Feriado', '11222333032001');
  v_cpf := public.qa_ponto_admissao('[QA-RN23] Trabalhou no Feriado', 32001, v_emp);
  PERFORM public.qa_feriado_da_unidade(v_emp, v_dia);
  PERFORM public.qa_ponto_dia(v_cpf, '[QA-RN23] Trabalhou no Feriado', v_dia, v_emp);

  r.passo_ordem := 1;
  r.passo_acao := format('Apurar o adicional de feriado da competência %s (feriado trabalhado em %s, sem folga)', v_comp, v_dia);
  r.esperado := 'Minutos trabalhados no feriado com adicional de 100%';

  SELECT * INTO a FROM public.ponto_feriado_adicional_competencia(v_t, v_emp, v_comp) f
  WHERE regexp_replace(f.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf;

  IF a.colaborador_cpf IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'O FERIADO TRABALHADO NÃO APARECEU NA APURAÇÃO DO ADICIONAL — a Lei 605/1949 art. 9º exige a dobra e o cálculo não enxergou o dia (feriado da unidade + marcação presentes no cercado).';
  ELSIF COALESCE(a.minutos_adicional_100, 0) > 0 AND COALESCE(a.qtd_feriados_trabalhados, 0) >= 1 THEN
    r.situacao := 'passou';
    r.obtido := format('Feriado trabalhado sem compensação rendeu %s minuto(s) com adicional de 100%%, pronto para a folha, sem lançamento manual.', a.minutos_adicional_100);
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('O feriado apareceu mas SEM adicional: qtd=%s, trabalhados=%s, adicional_100=%s. Trabalho em feriado não compensado tem de dobrar (Súmula 146 do TST).',
      a.qtd_feriados_trabalhados, a.minutos_trabalhados, a.minutos_adicional_100);
  END IF;
  RETURN r;
EXCEPTION
  WHEN undefined_function THEN
    r.situacao := 'falhou';
    r.obtido := 'A APURAÇÃO RN23 QUEBRA NESTE BANCO: ' || SQLERRM || '. A função de apoio '
      || 'feriado_comportamento não existe em NENHUMA migration do repositório — foi criada '
      || 'por fora, direto no banco (mesmo precedente de feriados e ponto_diario.tipo_dia). '
      || 'Qualquer ambiente montado a partir das migrations fica com o adicional de feriado '
      || 'inoperante. Correção: trazer a função para o repositório com CREATE OR REPLACE.';
    r.erro_tecnico := SQLERRM;
    RETURN r;
  WHEN OTHERS THEN
    r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ PONTO-321: folga compensatória afasta a dobra ══
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_321()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_emp uuid; v_cpf text; v_dia date := public.qa_dia_util_passado();
        v_comp text; v_colab uuid := gen_random_uuid(); a record;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_comp := to_char(v_dia, 'YYYY-MM');
  v_emp := public.qa_nova_empresa('[QA-RN23] Unidade Compensada', '11222333032102');
  v_cpf := public.qa_ponto_admissao('[QA-RN23] Compensou a Folga', 32101, v_emp);
  PERFORM public.qa_feriado_da_unidade(v_emp, v_dia);
  PERFORM public.qa_ponto_dia(v_cpf, '[QA-RN23] Compensou a Folga', v_dia, v_emp);

  r.passo_ordem := 1;
  r.passo_acao := 'Registrar a folga compensatória do feriado trabalhado';
  r.esperado := 'Registro aceito, vinculando feriado, colaborador e dia da folga';
  INSERT INTO public.feriado_folga_compensatoria
    (tenant_id, colaborador_id, colaborador_cpf, data_feriado, data_folga)
  VALUES (v_t, v_colab, v_cpf, v_dia, v_dia + 7);

  r.passo_ordem := 2;
  r.passo_acao := 'Apurar o adicional da competência com a folga registrada';
  r.esperado := 'O feriado compensado sai do cálculo do adicional (art. 9º, parte final)';
  SELECT * INTO a FROM public.ponto_feriado_adicional_competencia(v_t, v_emp, v_comp) f
  WHERE regexp_replace(f.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf;

  IF a.colaborador_cpf IS NULL OR COALESCE(a.minutos_adicional_100, 0) = 0 THEN
    r.situacao := 'passou';
    r.obtido := format('Compensou, não dobra: com a folga registrada, o adicional zerou (dias compensados: %s).', COALESCE(a.dias_compensados, 0));
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('A FOLGA REGISTRADA NÃO AFASTOU A DOBRA: adicional_100 = %s minuto(s) mesmo com compensação. Pagaria em dobro E daria a folga — duas vezes a mesma hora.', a.minutos_adicional_100);
  END IF;
  RETURN r;
EXCEPTION
  WHEN undefined_function THEN
    r.situacao := 'falhou';
    r.obtido := 'A APURAÇÃO RN23 QUEBRA NESTE BANCO: ' || SQLERRM || '. A função de apoio '
      || 'feriado_comportamento não existe em NENHUMA migration do repositório — foi criada '
      || 'por fora, direto no banco (mesmo precedente de feriados e ponto_diario.tipo_dia). '
      || 'Qualquer ambiente montado a partir das migrations fica com o adicional de feriado '
      || 'inoperante. Correção: trazer a função para o repositório com CREATE OR REPLACE.';
    r.erro_tecnico := SQLERRM;
    RETURN r;
  WHEN OTHERS THEN
    r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ PONTO-322: adicional não entra no saldo do banco ══
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_322()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_emp uuid; v_cpf text; v_dia date := public.qa_dia_util_passado();
        v_comp text; v_saldo_antes bigint; v_saldo_depois bigint; v_tmp int;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_comp := to_char(v_dia, 'YYYY-MM');
  v_emp := public.qa_nova_empresa('[QA-RN23] Unidade Saldo', '11222333032203');
  v_cpf := public.qa_ponto_admissao('[QA-RN23] Saldo Intacto', 32201, v_emp);
  PERFORM public.qa_feriado_da_unidade(v_emp, v_dia);
  PERFORM public.qa_ponto_dia(v_cpf, '[QA-RN23] Saldo Intacto', v_dia, v_emp);

  r.passo_ordem := 1;
  r.passo_acao := 'Comparar o saldo do banco antes e depois de apurar o adicional';
  r.esperado := 'Idêntico — o adicional é verba de folha, não crédito de compensação';

  SELECT COALESCE(sum(s.saldo_min), 0) INTO v_saldo_antes
  FROM public.ponto_saldo_dias_competencia(v_t, v_cpf, v_comp) s;

  SELECT COALESCE(sum(f.minutos_adicional_100), 0) INTO v_tmp
  FROM public.ponto_feriado_adicional_competencia(v_t, v_emp, v_comp) f;

  SELECT COALESCE(sum(s.saldo_min), 0) INTO v_saldo_depois
  FROM public.ponto_saldo_dias_competencia(v_t, v_cpf, v_comp) s;

  IF v_saldo_antes = v_saldo_depois THEN
    r.situacao := 'passou';
    r.obtido := format('Saldo do banco intacto (%s min) antes e depois da apuração do adicional — a mesma hora não vira verba e crédito ao mesmo tempo.', v_saldo_antes);
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('A APURAÇÃO DO ADICIONAL MEXEU NO SALDO: %s min antes, %s min depois. O colaborador receberia em dobro E folgaria pelas mesmas horas.', v_saldo_antes, v_saldo_depois);
  END IF;
  RETURN r;
EXCEPTION
  WHEN undefined_function THEN
    r.situacao := 'falhou';
    r.obtido := 'A APURAÇÃO RN23 QUEBRA NESTE BANCO: ' || SQLERRM || '. A função de apoio '
      || 'feriado_comportamento não existe em NENHUMA migration do repositório — foi criada '
      || 'por fora, direto no banco (mesmo precedente de feriados e ponto_diario.tipo_dia). '
      || 'Qualquer ambiente montado a partir das migrations fica com o adicional de feriado '
      || 'inoperante. Correção: trazer a função para o repositório com CREATE OR REPLACE.';
    r.erro_tecnico := SQLERRM;
    RETURN r;
  WHEN OTHERS THEN
    r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ PONTO-330: espelho-resumo e banco de horas contam a mesma história ══
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_330()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_cpf text; v_dia date := public.qa_dia_util_passado();
        v_comp text; e record; v_trab bigint; v_saldo bigint;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_comp := to_char(v_dia, 'YYYY-MM');
  v_cpf := public.qa_ponto_admissao('[QA-PONTO] Espelhado', 33001);
  PERFORM public.qa_ponto_dia(v_cpf, '[QA-PONTO] Espelhado', v_dia);

  r.passo_ordem := 1;
  r.passo_acao := 'Gerar o espelho-resumo e comparar com a soma dia a dia do banco de horas';
  r.esperado := 'Totais de horas e saldo idênticos — as duas telas dizem a mesma coisa';

  SELECT * INTO e FROM public.ponto_espelho_resumo(v_t, v_cpf, v_comp);
  SELECT COALESCE(sum(s.trabalhado_min), 0), COALESCE(sum(s.saldo_min), 0)
  INTO v_trab, v_saldo
  FROM public.ponto_saldo_dias_competencia(v_t, v_cpf, v_comp) s;

  IF e.dias_com_registro IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'O espelho-resumo voltou vazio para uma competência com registro — a regressão do espelho zerado de 07/2026.';
  ELSIF COALESCE(e.total_trabalhado_min, 0) = v_trab AND COALESCE(e.saldo_min, 0) = v_saldo THEN
    r.situacao := 'passou';
    r.obtido := format('Espelho e banco de horas batem: %s min trabalhados, saldo %s min — mesma fonte, mesma história.', v_trab, v_saldo);
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('ESPELHO E BANCO DIVERGEM: espelho diz %s min / saldo %s; a soma dia a dia diz %s min / saldo %s. Duas telas, duas verdades — o defeito que o espelho-resumo veio corrigir.',
      e.total_trabalhado_min, e.saldo_min, v_trab, v_saldo);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ PONTO-331: o que o modelo não apura não sai como zero afirmativo ══
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_331()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_cols text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): conferir que o espelho-resumo não devolve os campos órfãos como zero';
  r.esperado := 'Sem colunas de HE 50/100 nem adicional noturno na saída — ausente é honesto, zero é declaração falsa';

  SELECT pg_get_function_result(p.oid) INTO v_cols
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'ponto_espelho_resumo'
  LIMIT 1;

  IF v_cols IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'A função ponto_espelho_resumo não existe — o espelho voltou a somar as colunas órfãs?';
  ELSIF v_cols ILIKE '%extras%' OR v_cols ILIKE '%noturno%' THEN
    r.situacao := 'falhou';
    r.obtido := 'O ESPELHO VOLTOU A DEVOLVER CAMPOS QUE O MODELO NÃO APURA (' || v_cols || '). '
      || 'A apuração atual não separa HE 50%/100% nem adicional noturno: devolvê-los seria '
      || 'imprimir zero afirmativo num documento que o colaborador assina — declaração falsa. '
      || 'A tela marca esses campos como não apurados; a função não pode reintroduzi-los.';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'O espelho-resumo devolve apenas o que o modelo realmente apura. O que não é apurado fica marcado como tal na tela, nunca como 0h00.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ─────────────────────────────────────────────────────────
-- Ligar caso <-> rotina e rodar a bateria do módulo
-- ─────────────────────────────────────────────────────────
INSERT INTO public.qa_implementacoes (codigo, funcao_sql, ativo) VALUES
  ('PONTO-291', 'qa_caso_ponto_291', true),
  ('PONTO-312', 'qa_caso_ponto_312', true),
  ('PONTO-320', 'qa_caso_ponto_320', true),
  ('PONTO-321', 'qa_caso_ponto_321', true),
  ('PONTO-322', 'qa_caso_ponto_322', true),
  ('PONTO-330', 'qa_caso_ponto_330', true),
  ('PONTO-331', 'qa_caso_ponto_331', true)
ON CONFLICT (codigo) DO UPDATE SET funcao_sql = EXCLUDED.funcao_sql, ativo = true;

DO $roda$
BEGIN
  PERFORM public.qa_rodar_bateria('manual', 'jornada-rotina/ponto');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Bateria não rodou agora (%). As rotinas ficam registradas e entram na próxima execução agendada.', SQLERRM;
END $roda$;
