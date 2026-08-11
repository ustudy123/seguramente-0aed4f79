-- SCRIPT DE ENTREGA — QA 2ª leva: Ponto (7 rotinas) + Hub Contábil (8 casos+rotinas) — 11/08
-- Idempotente: pode rodar mais de uma vez. Só cria/recria objetos qa_* e registra casos.
-- Nenhuma tabela, trigger ou funcionalidade do sistema é alterada.

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

-- =========================================================
-- QA — Hub Contábil: 2ª leva — calendário, catálogo e templates (11/08)
--
-- Fecha o que o cabeçalho da revisão de 08/08 (20260808180000) deixou
-- registrado como "próxima leva": as tabelas de apoio com regra própria
-- que ainda não tinham nenhum caso.
--
--   hub_calendario_envios / hub_calendario_status -> o calendário de
--     obrigações mensais da contabilidade (dia-limite 1..31, um status
--     por competência)
--   hub_catalogo_documentos -> o catálogo que diz qual documento cada
--     tipo de processo exige, com obrigatoriedade e retenção
--   hub_checklist_templates -> os modelos que semeiam o checklist dos
--     processos (globais, com tenant nulo, ou do cliente)
--
-- O padrão de leitura se repete: o banco protege parte (CHECK do
-- dia-limite, UNIQUE da competência) e deixa buracos conhecidos da
-- casa — vínculo sem coerência de tenant e listas fechadas que vivem
-- só como texto livre. Onde o sistema diverge do caso, a rotina falha
-- de propósito e o achado vai para o relatório.
--
-- NENHUMA CORREÇÃO DE FUNCIONALIDADE.
-- =========================================================

SET lock_timeout = '10s';

-- ─────────────────────────────────────────────────────────
-- DOCUMENTAÇÃO
-- ─────────────────────────────────────────────────────────
DO $doc$
DECLARE v_mod uuid; v_antes int; v_depois int;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos WHERE path = 'documentos-governanca/hub-contabil';
  IF v_mod IS NULL THEN RAISE EXCEPTION 'Módulo documentos-governanca/hub-contabil não encontrado.'; END IF;
  SELECT count(*) INTO v_antes FROM public.qa_casos_teste WHERE modulo_id = v_mod;

  INSERT INTO public.qa_casos_teste
    (modulo_id, codigo, titulo, tipo, prioridade, status, nivel,
     objetivo, pre_condicoes, passos, resultado_esperado, observacoes)
  VALUES

  (v_mod, 'HCAL-001', 'Calendário de envios: item mensal com status por competência',
   'feliz', 'media', 'aprovado', 'api',
   'O calendário lista o que precisa ser enviado à contabilidade todo mês (folha, guias, eventos), cada item com dia-limite. O status materializa o andamento por competência — um por item/competência, com quem concluiu e quando.',
   'Cercado disponível.',
   '[{"ordem":1,"acao":"Criar item de calendário com dia-limite 5","resultado_esperado":"Item gravado"},
     {"ordem":2,"acao":"Marcar a competência corrente como concluída","resultado_esperado":"Status gravado com autor e data"}]'::jsonb,
   'Item e status gravados e relidos por inteiro.',
   NULL),

  (v_mod, 'HCAL-010', 'Dia-limite fora de 1..31 é recusado',
   'negativo', 'media', 'aprovado', 'api',
   'O CHECK do dia-limite é a única proteção estrutural do calendário — dia 32 ou dia 0 não existe em mês nenhum. Este caso a protege contra regressão.',
   'Cercado disponível.',
   '[{"ordem":1,"acao":"Criar item com dia-limite 32","resultado_esperado":"Recusado pelo CHECK"},
     {"ordem":2,"acao":"Criar item com dia-limite 0","resultado_esperado":"Recusado"}]'::jsonb,
   'Só entram dias de 1 a 31.',
   NULL),

  (v_mod, 'HCAL-011', 'Uma competência, um status — a duplicata é barrada',
   'negativo', 'media', 'aprovado', 'api',
   'O UNIQUE (tenant, calendário, competência) impede dois status para o mesmo item no mesmo mês — sem ele, um item poderia constar concluído e pendente ao mesmo tempo.',
   'Item de calendário com status na competência corrente.',
   '[{"ordem":1,"acao":"Inserir segundo status para o mesmo item e competência","resultado_esperado":"Recusado pelo UNIQUE"}]'::jsonb,
   'A duplicata não entra.',
   NULL),

  (v_mod, 'HCAL-012', 'Status não pode apontar calendário de outro cliente',
   'negativo', 'alta', 'aprovado', 'api',
   'A FK de calendario_id não olha tenant: um status do cliente A pode apontar item de calendário do cliente B — e o andamento de um cliente contaminaria o painel do outro. Mesma família de FER-004, MCHK-011 e PROC-011.',
   'Cercados 1 e 2; item de calendário no cercado 2.',
   '[{"ordem":1,"acao":"Inserir status no tenant 1 apontando calendário do tenant 2","resultado_esperado":"Recusado — status e calendário do mesmo tenant"}]'::jsonb,
   'Vínculo cruzando tenants não entra.',
   'Mesmo remédio dos demais: gatilho de coerência de tenant.'),

  (v_mod, 'HCAT-001', 'Catálogo: documento exigido por tipo de processo',
   'feliz', 'media', 'aprovado', 'api',
   'O catálogo parametriza qual documento cada tipo de processo exige (ex.: admissão pede contrato e ficha de registro), com obrigatoriedade, assinatura e prazo de retenção. É o que alimenta o checklist automático do processo.',
   'Cercado disponível.',
   '[{"ordem":1,"acao":"Cadastrar documento do catálogo para o tipo admissao, obrigatório, com retenção de 5 anos","resultado_esperado":"Item gravado com tipo de processo, obrigatoriedade e retenção"}]'::jsonb,
   'Catálogo gravado e relido por inteiro.',
   NULL),

  (v_mod, 'HCAT-010', 'Obrigatoriedade e retenção sem faixa',
   'negativo', 'media', 'aprovado', 'api',
   'obrigatoriedade é texto livre (sem lista fechada) e prazo_retencao_anos aceita negativo. Obrigatoriedade inventada quebra o semeador de checklist em silêncio; retenção negativa é um prazo que venceu antes de existir.',
   'Cercado disponível.',
   '[{"ordem":1,"acao":"Cadastrar item com obrigatoriedade = talvez","resultado_esperado":"Recusado — lista fechada (obrigatorio/opcional/condicional)"},
     {"ordem":2,"acao":"Cadastrar item com retenção de -5 anos","resultado_esperado":"Recusado — retenção é não negativa"}]'::jsonb,
   'Só entram obrigatoriedades previstas e retenção não negativa.',
   'Provável ACHADO nos dois passos — mesma família de OBRG-020 (texto livre) e das faixas sem CHECK. Correção: CHECK de lista e CHECK (prazo_retencao_anos >= 0).'),

  (v_mod, 'HTPL-001', 'Template de checklist global convive com o do cliente',
   'feliz', 'media', 'aprovado', 'api',
   'Os templates semeiam o checklist dos processos por tipo. Com tenant nulo o template é GLOBAL (vale para todos); com tenant, é do cliente. O caso grava o do cliente e confere o contrato do global por leitura — escrever configuração global de dentro de um teste contaminaria todos os clientes, e a cerca do cercado impede exatamente isso.',
   'Cercado disponível.',
   '[{"ordem":1,"acao":"Criar template do cliente para o tipo ferias","resultado_esperado":"Gravado com tenant do cercado"},
     {"ordem":2,"acao":"Tentar criar template GLOBAL (tenant nulo) de dentro do teste","resultado_esperado":"Bloqueado pela cerca do cercado — teste não escreve configuração de todos os clientes"},
     {"ordem":3,"acao":"Conferir o contrato do global por catálogo","resultado_esperado":"tenant_id anulável — o modelo global existe"}]'::jsonb,
   'Cliente grava; global é protegido da escrita de teste e o contrato existe.',
   NULL),

  (v_mod, 'HTPL-010', 'Tipo do template precisa casar com os tipos de processo',
   'negativo', 'media', 'aprovado', 'api',
   'hub_processos.tipo é enum fechado (admissao, demissao, ferias...), mas o tipo do template é texto livre. Template com tipo inventado nunca é semeado em processo nenhum — vira configuração morta que a tela lista e o processo ignora.',
   'Cercado disponível.',
   '[{"ordem":1,"acao":"Criar template com tipo = processo_inventado","resultado_esperado":"Recusado — o tipo precisa existir no enum hub_processo_tipo"}]'::jsonb,
   'Só entram tipos que o processo reconhece.',
   'Provável ACHADO. Correção: converter a coluna para o enum ou CHECK contra os rótulos do enum.')

  ON CONFLICT (codigo) DO NOTHING;

  SELECT count(*) INTO v_depois FROM public.qa_casos_teste WHERE modulo_id = v_mod;
  RAISE NOTICE '2ª leva Hub: módulo tinha % casos, agora tem % (+%).', v_antes, v_depois, v_depois - v_antes;
END $doc$;

-- ─────────────────────────────────────────────────────────
-- ROTINAS
-- ─────────────────────────────────────────────────────────

-- ══ HCAL-001 ══
CREATE OR REPLACE FUNCTION public.qa_caso_hcal_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_cal uuid; s record; v_comp text := to_char(CURRENT_DATE, 'YYYY-MM');
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1; r.passo_acao := 'Criar item de calendário com dia-limite 5';
  r.esperado := 'Item gravado';
  INSERT INTO public.hub_calendario_envios (tenant_id, titulo, tipo, categoria, dia_limite)
  VALUES (v_t, '[QA-HCAL] Enviar espelhos de ponto', 'envio', 'folha', 5)
  RETURNING id INTO v_cal;

  r.passo_ordem := 2; r.passo_acao := 'Marcar a competência corrente como concluída';
  r.esperado := 'Status gravado com autor e data';
  INSERT INTO public.hub_calendario_status
    (tenant_id, calendario_id, competencia, status, concluido_por, concluido_em)
  VALUES (v_t, v_cal, v_comp, 'concluido', '[QA] Agente', now());

  SELECT * INTO s FROM public.hub_calendario_status
  WHERE calendario_id = v_cal AND competencia = v_comp;
  IF s.status = 'concluido' AND s.concluido_por IS NOT NULL AND s.concluido_em IS NOT NULL THEN
    r.situacao := 'passou'; r.obtido := 'Item e status gravados por inteiro, com autor e data.';
  ELSE
    r.situacao := 'falhou'; r.obtido := 'O status não persistiu como gravado.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ HCAL-010 ══
CREATE OR REPLACE FUNCTION public.qa_caso_hcal_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1; r.passo_acao := 'Criar item com dia-limite 32';
  r.esperado := 'Recusado pelo CHECK (1..31)';
  BEGIN
    INSERT INTO public.hub_calendario_envios (tenant_id, titulo, tipo, categoria, dia_limite)
    VALUES (v_t, '[QA-HCAL] Dia 32', 'envio', 'folha', 32);
    r.situacao := 'falhou'; r.obtido := 'ACEITOU dia-limite 32 — dia que não existe em mês nenhum.';
    RETURN r;
  EXCEPTION WHEN check_violation THEN
    r.obtido := 'Recusado 32.';
  END;

  r.passo_ordem := 2; r.passo_acao := 'Criar item com dia-limite 0';
  r.esperado := 'Recusado';
  BEGIN
    INSERT INTO public.hub_calendario_envios (tenant_id, titulo, tipo, categoria, dia_limite)
    VALUES (v_t, '[QA-HCAL] Dia 0', 'envio', 'folha', 0);
    r.situacao := 'falhou'; r.obtido := 'Recusou 32 mas ACEITOU 0.';
  EXCEPTION WHEN check_violation THEN
    r.situacao := 'passou'; r.obtido := 'Só entram dias de 1 a 31 — o CHECK segue de pé.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ HCAL-011 ══
CREATE OR REPLACE FUNCTION public.qa_caso_hcal_011()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_cal uuid; v_comp text := to_char(CURRENT_DATE, 'YYYY-MM');
BEGIN
  PERFORM public.qa_modo_ligar();
  INSERT INTO public.hub_calendario_envios (tenant_id, titulo, tipo, categoria, dia_limite)
  VALUES (v_t, '[QA-HCAL] Sem Duplicata', 'envio', 'guias', 10) RETURNING id INTO v_cal;
  INSERT INTO public.hub_calendario_status (tenant_id, calendario_id, competencia, status)
  VALUES (v_t, v_cal, v_comp, 'pendente');

  r.passo_ordem := 1;
  r.passo_acao := 'Inserir segundo status para o mesmo item e competência';
  r.esperado := 'Recusado pelo UNIQUE (tenant, calendário, competência)';
  BEGIN
    INSERT INTO public.hub_calendario_status (tenant_id, calendario_id, competencia, status)
    VALUES (v_t, v_cal, v_comp, 'concluido');
    r.situacao := 'falhou';
    r.obtido := 'ACEITOU dois status para a mesma competência — o item pode constar concluído e pendente ao mesmo tempo.';
  EXCEPTION WHEN unique_violation THEN
    r.situacao := 'passou'; r.obtido := 'Uma competência, um status — duplicata barrada pelo UNIQUE.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ HCAL-012 ══
CREATE OR REPLACE FUNCTION public.qa_caso_hcal_012()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t1 uuid := public.qa_sandbox_tenant_id();
        v_t2 uuid := public.qa_sandbox2_tenant_id(); v_cal_t2 uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  IF v_t2 IS NULL THEN r.situacao := 'erro'; r.obtido := '2o cercado nao existe.'; RETURN r; END IF;
  INSERT INTO public.hub_calendario_envios (tenant_id, titulo, tipo, categoria, dia_limite)
  VALUES (v_t2, '[QA-HCAL] Calendario do Cliente B', 'envio', 'folha', 15) RETURNING id INTO v_cal_t2;

  r.passo_ordem := 1;
  r.passo_acao := 'Inserir status no tenant 1 apontando calendário do tenant 2';
  r.esperado := 'Recusado — status e calendário do mesmo tenant';
  BEGIN
    INSERT INTO public.hub_calendario_status (tenant_id, calendario_id, competencia, status)
    VALUES (v_t1, v_cal_t2, to_char(CURRENT_DATE, 'YYYY-MM'), 'pendente');
    r.situacao := 'falhou';
    r.obtido := 'STATUS CRUZANDO TENANTS ACEITO: o andamento do cliente A ficou preso a item de calendário do cliente B. Mesma família de FER-004, MCHK-011 e PROC-011 — mesmo remédio, gatilho de coerência de tenant.';
  EXCEPTION WHEN OTHERS THEN
    r.situacao := 'passou'; r.obtido := 'Vínculo cruzando tenants recusado: ' || SQLERRM;
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ HCAT-001 ══
CREATE OR REPLACE FUNCTION public.qa_caso_hcat_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); c record;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1;
  r.passo_acao := 'Cadastrar documento do catálogo para o tipo admissao, obrigatório, retenção de 5 anos';
  r.esperado := 'Item gravado com tipo de processo, obrigatoriedade e retenção';
  INSERT INTO public.hub_catalogo_documentos
    (tenant_id, nome, processo_tipo, obrigatoriedade, requer_assinatura, prazo_retencao_anos, ordem)
  VALUES (v_t, '[QA-HCAT] Contrato de Trabalho', 'admissao', 'obrigatorio', true, 5, 1)
  RETURNING * INTO c;

  IF c.processo_tipo::text = 'admissao' AND c.obrigatoriedade = 'obrigatorio' AND c.prazo_retencao_anos = 5 THEN
    r.situacao := 'passou'; r.obtido := 'Catálogo gravado e relido por inteiro.';
  ELSE
    r.situacao := 'falhou'; r.obtido := 'O item do catálogo não persistiu como gravado.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ HCAT-010 ══
CREATE OR REPLACE FUNCTION public.qa_caso_hcat_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_livre boolean := false; v_neg boolean := false;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1; r.passo_acao := 'Cadastrar item com obrigatoriedade = talvez';
  r.esperado := 'Recusado — lista fechada (obrigatorio/opcional/condicional)';
  BEGIN
    INSERT INTO public.hub_catalogo_documentos (tenant_id, nome, processo_tipo, obrigatoriedade, ordem)
    VALUES (v_t, '[QA-HCAT] Obrigatoriedade Livre', 'admissao', 'talvez', 90);
    v_livre := true;
  EXCEPTION WHEN check_violation THEN v_livre := false;
  END;

  r.passo_ordem := 2; r.passo_acao := 'Cadastrar item com retenção de -5 anos';
  r.esperado := 'Recusado — retenção é não negativa';
  BEGIN
    INSERT INTO public.hub_catalogo_documentos (tenant_id, nome, processo_tipo, obrigatoriedade, prazo_retencao_anos, ordem)
    VALUES (v_t, '[QA-HCAT] Retencao Negativa', 'admissao', 'obrigatorio', -5, 91);
    v_neg := true;
  EXCEPTION WHEN check_violation THEN v_neg := false;
  END;

  IF NOT v_livre AND NOT v_neg THEN
    r.situacao := 'passou'; r.obtido := 'Obrigatoriedade fora da lista e retenção negativa recusadas.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('ACEITOU o que não devia (obrigatoriedade livre: %s; retenção negativa: %s). '
      || 'Obrigatoriedade é texto sem lista fechada — valor inventado quebra o semeador de checklist '
      || 'em silêncio; retenção negativa é prazo que venceu antes de existir. Correção: CHECK de '
      || 'lista (obrigatorio/opcional/condicional) e CHECK (prazo_retencao_anos >= 0).', v_livre, v_neg);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ HTPL-001 ══
CREATE OR REPLACE FUNCTION public.qa_caso_htpl_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_cliente uuid; v_global_bloqueado boolean := false; v_anulavel boolean;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1;
  r.passo_acao := 'Criar template do cliente para o tipo ferias';
  r.esperado := 'Gravado com tenant do cercado';
  INSERT INTO public.hub_checklist_templates (tenant_id, tipo, item, obrigatorio, ordem)
  VALUES (v_t, 'ferias', '[QA-HTPL] Conferencia interna do cliente', false, 91)
  RETURNING id INTO v_cliente;

  r.passo_ordem := 2;
  r.passo_acao := 'Tentar criar template GLOBAL (tenant nulo) de dentro do teste';
  r.esperado := 'Bloqueado pela cerca do cercado';
  BEGIN
    INSERT INTO public.hub_checklist_templates (tenant_id, tipo, item, obrigatorio, ordem)
    VALUES (NULL, 'ferias', '[QA-HTPL] Global indevido', true, 90);
    v_global_bloqueado := false;
  EXCEPTION WHEN OTHERS THEN
    v_global_bloqueado := true;
  END;

  r.passo_ordem := 3;
  r.passo_acao := 'Conferir o contrato do global por catálogo';
  r.esperado := 'tenant_id anulável — o modelo global existe';
  SELECT (is_nullable = 'YES') INTO v_anulavel
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'hub_checklist_templates'
    AND column_name = 'tenant_id';

  IF v_cliente IS NOT NULL AND v_global_bloqueado AND COALESCE(v_anulavel, false) THEN
    r.situacao := 'passou';
    r.obtido := 'Template do cliente gravado; a cerca impediu o teste de escrever configuração global (proteção correta); o contrato global (tenant nulo) existe no schema.';
  ELSIF NOT v_global_bloqueado THEN
    r.situacao := 'falhou';
    r.obtido := 'O TESTE CONSEGUIU ESCREVER TEMPLATE GLOBAL: uma rotina de QA gravou configuração que vale para TODOS os clientes — a cerca do cercado não cobre escrita com tenant nulo nesta tabela.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Template do cliente: %s; tenant_id anulável: %s.', v_cliente IS NOT NULL, v_anulavel);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ HTPL-010 ══
CREATE OR REPLACE FUNCTION public.qa_caso_htpl_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1; r.passo_acao := 'Criar template com tipo = processo_inventado';
  r.esperado := 'Recusado — o tipo precisa existir no enum hub_processo_tipo';
  BEGIN
    INSERT INTO public.hub_checklist_templates (tenant_id, tipo, item, obrigatorio, ordem)
    VALUES (v_t, 'processo_inventado', '[QA-HTPL] Item orfao', true, 95);
    r.situacao := 'falhou';
    r.obtido := 'ACEITOU template com tipo que nenhum processo reconhece — configuração morta que a '
      || 'tela lista e o semeador de checklist nunca usa. hub_processos.tipo é enum fechado; o tipo '
      || 'do template é texto livre. Correção: converter a coluna para o enum ou CHECK contra os rótulos.';
  EXCEPTION WHEN check_violation OR invalid_text_representation THEN
    r.situacao := 'passou'; r.obtido := 'Tipo fora do enum recusado.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ─────────────────────────────────────────────────────────
-- Ligar caso <-> rotina e rodar a bateria do módulo
-- ─────────────────────────────────────────────────────────
INSERT INTO public.qa_implementacoes (codigo, funcao_sql, ativo) VALUES
  ('HCAL-001', 'qa_caso_hcal_001', true),
  ('HCAL-010', 'qa_caso_hcal_010', true),
  ('HCAL-011', 'qa_caso_hcal_011', true),
  ('HCAL-012', 'qa_caso_hcal_012', true),
  ('HCAT-001', 'qa_caso_hcat_001', true),
  ('HCAT-010', 'qa_caso_hcat_010', true),
  ('HTPL-001', 'qa_caso_htpl_001', true),
  ('HTPL-010', 'qa_caso_htpl_010', true)
ON CONFLICT (codigo) DO UPDATE SET funcao_sql = EXCLUDED.funcao_sql, ativo = true;

DO $roda$
BEGIN
  PERFORM public.qa_rodar_bateria('manual', 'documentos-governanca/hub-contabil');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Bateria não rodou agora (%). As rotinas ficam registradas e entram na próxima execução agendada.', SQLERRM;
END $roda$;

-- ─────────────────────────────────────────────────────────
-- CONFERÊNCIA (única saída visível no SQL Editor)
-- ─────────────────────────────────────────────────────────
SELECT i.codigo,
       CASE WHEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                         WHERE n.nspname='public' AND p.proname = i.funcao_sql)
            THEN 'ok — rotina instalada' ELSE 'ERRO — função ausente' END AS situacao,
       NULL::text AS erro_tecnico
FROM public.qa_implementacoes i
WHERE i.codigo IN ('PONTO-291','PONTO-312','PONTO-320','PONTO-321','PONTO-322','PONTO-330','PONTO-331',
                   'HCAL-001','HCAL-010','HCAL-011','HCAL-012','HCAT-001','HCAT-010','HTPL-001','HTPL-010')
ORDER BY i.codigo;
