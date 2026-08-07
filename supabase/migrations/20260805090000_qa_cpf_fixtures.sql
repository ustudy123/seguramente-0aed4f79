-- =========================================================
-- QA — CPF de fixture com dígito verificador válido (31/07/2026)
--
-- MOTIVO: o desenvolvimento passou a validar dígito verificador em
-- usuarios_base e admissoes. Os CPFs inventados que eu usava nas fixtures
-- ('99900001010' e afins) passaram a ser recusados, e 13 rotinas quebraram
-- com "A rotina quebrou" — mascarando o que elas realmente testavam.
--
-- Retorno do time, com razão: "ideal gerar por código em vez de lista fixa".
-- Lista fixa de CPF é frágil por natureza — basta o banco ficar mais
-- rigoroso para toda a suíte parar, e foi exatamente o que aconteceu.
--
-- SOLUÇÃO: qa_cpf(semente) calcula os dois dígitos verificadores pelo
-- algoritmo da Receita Federal. Mesma semente devolve sempre o mesmo CPF,
-- então as fixtures continuam determinísticas e rastreáveis; sementes
-- distintas devolvem CPFs distintos.
--
-- As 14 rotinas abaixo foram regeradas a partir das definições originais,
-- trocando apenas o literal pela chamada — nenhuma outra alteração de
-- lógica. Fizemos isso programaticamente para não introduzir divergência
-- ao reescrever à mão.
-- =========================================================

SET lock_timeout = '10s';

CREATE OR REPLACE FUNCTION public.qa_cpf(p_semente int)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  v_base text;
  v_d    int[];
  v_soma int;
  v_dv1  int;
  v_dv2  int;
  i      int;
BEGIN
  -- Base de 9 dígitos: prefixo 999 mantém a fixture reconhecível como teste.
  v_base := '999' || lpad((abs(p_semente) % 1000000)::text, 6, '0');

  SELECT array_agg(substring(v_base FROM g FOR 1)::int ORDER BY g)
    INTO v_d FROM generate_series(1, 9) g;

  -- 1º dígito: soma dos 9 primeiros por pesos de 10 a 2
  v_soma := 0;
  FOR i IN 1..9 LOOP v_soma := v_soma + v_d[i] * (11 - i); END LOOP;
  v_dv1 := 11 - (v_soma % 11);
  IF v_dv1 >= 10 THEN v_dv1 := 0; END IF;

  -- 2º dígito: soma dos 10 primeiros por pesos de 11 a 2
  v_soma := 0;
  FOR i IN 1..9 LOOP v_soma := v_soma + v_d[i] * (12 - i); END LOOP;
  v_soma := v_soma + v_dv1 * 2;
  v_dv2 := 11 - (v_soma % 11);
  IF v_dv2 >= 10 THEN v_dv2 := 0; END IF;

  RETURN v_base || v_dv1::text || v_dv2::text;
END $$;

COMMENT ON FUNCTION public.qa_cpf(int) IS
  'CPF de fixture com dígito verificador válido, calculado pelo algoritmo da '
  'Receita Federal. Determinístico: mesma semente, mesmo CPF. Prefixo 999 '
  'mantém a fixture reconhecível. Usar SEMPRE isto em rotina de QA — nunca '
  'CPF literal, que quebra quando o banco fica mais rigoroso.';

-- Conferência do algoritmo antes de qualquer rotina depender dele.
DO $conf$
DECLARE v_cpf text; v_d int[]; v_s int; v_dv1 int; v_dv2 int; i int;
BEGIN
  FOR i IN 1..5 LOOP
    v_cpf := public.qa_cpf(i * 1111);
    IF length(v_cpf) <> 11 THEN
      RAISE EXCEPTION 'qa_cpf(%) devolveu % com % dígitos', i*1111, v_cpf, length(v_cpf);
    END IF;
  END LOOP;

  -- revalida o DV de uma amostra pelo mesmo algoritmo, de forma independente
  v_cpf := public.qa_cpf(1010);
  SELECT array_agg(substring(v_cpf FROM g FOR 1)::int ORDER BY g) INTO v_d
    FROM generate_series(1,11) g;
  v_s := 0; FOR i IN 1..9 LOOP v_s := v_s + v_d[i]*(11-i); END LOOP;
  v_dv1 := 11 - (v_s % 11); IF v_dv1 >= 10 THEN v_dv1 := 0; END IF;
  v_s := 0; FOR i IN 1..10 LOOP v_s := v_s + v_d[i]*(12-i); END LOOP;
  v_dv2 := 11 - (v_s % 11); IF v_dv2 >= 10 THEN v_dv2 := 0; END IF;

  IF v_d[10] <> v_dv1 OR v_d[11] <> v_dv2 THEN
    RAISE EXCEPTION 'qa_cpf gerou DV inválido para a semente 1010: %', v_cpf;
  END IF;

  RAISE NOTICE 'qa_cpf conferido. Exemplo: semente 1010 -> %', v_cpf;
END $conf$;

-- ─────────────────────────────────────────────────────────
-- Rotinas regeradas: apenas o CPF literal virou qa_cpf(semente)
-- ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.qa_caso_adm_002()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
  v_cpf text := public.qa_cpf(200002); v_aceitou boolean := false; v_fmt boolean := false;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Criar admissao concluida com CPF conhecido';
  INSERT INTO public.admissoes (tenant_id, nome_completo, cpf, email, cargo, status, data_admissao)
  VALUES (v_t, '[QA-ADM-002] Primeiro', v_cpf, 'qa.adm002a@sandbox.invalid',
          'Operador', 'concluido', CURRENT_DATE - 100);

  r.passo_ordem := 2;
  r.passo_acao  := 'Tentar segunda admissao ATIVA com o mesmo CPF';
  r.esperado    := 'Recusado — o CPF e a chave do trabalhador no eSocial';
  BEGIN
    INSERT INTO public.admissoes (tenant_id, nome_completo, cpf, email, cargo, status, data_admissao)
    VALUES (v_t, '[QA-ADM-002] Segundo', v_cpf, 'qa.adm002b@sandbox.invalid',
            'Operador', 'concluido', CURRENT_DATE);
    v_aceitou := true;
  EXCEPTION WHEN OTHERS THEN v_aceitou := false;
  END;

  r.passo_ordem := 3;
  r.passo_acao  := 'Tentar com o mesmo CPF formatado com pontuacao';
  BEGIN
    INSERT INTO public.admissoes (tenant_id, nome_completo, cpf, email, cargo, status, data_admissao)
    VALUES (v_t, '[QA-ADM-002] Terceiro', '999.002.000-02', 'qa.adm002c@sandbox.invalid',
            'Operador', 'concluido', CURRENT_DATE);
    v_fmt := true;
  EXCEPTION WHEN OTHERS THEN v_fmt := false;
  END;

  IF NOT v_aceitou AND NOT v_fmt THEN
    r.situacao := 'passou';
    r.obtido   := 'Duplicidade recusada nas duas formas.';
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('Duplicidade de CPF ACEITA em admissoes (sem pontuacao: %s; com '
               || 'pontuacao: %s). Nao ha indice unico protegendo o CPF na tabela admissoes. '
               || 'Duas admissoes ativas para a mesma pessoa produziriam dois vinculos no '
               || 'eSocial, onde o CPF e a chave do trabalhador. Mesma raiz do COLAB-033, ja '
               || 'documentado: a comparacao e sobre a string crua, entao pontuacao diferente '
               || 'vira pessoa diferente. Correcao: normalizar o CPF na escrita e indice unico '
               || 'parcial sobre admissoes ativas — preservando a readmissao, que e legitima.',
               v_aceitou, v_fmt);
    r.detalhe  := jsonb_build_object('aceitou_cpf_cru', v_aceitou, 'aceitou_cpf_formatado', v_fmt);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_adm_003()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
  v_adm uuid; v_n int; v_duplicou boolean := false;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Criar admissao e o checklist de documentos';
  INSERT INTO public.admissoes (tenant_id, nome_completo, cpf, email, cargo, status, data_admissao)
  VALUES (v_t, '[QA-ADM-003] Colaborador', public.qa_cpf(200003), 'qa.adm003@sandbox.invalid',
          'Operador', 'rascunho', CURRENT_DATE)
  RETURNING id INTO v_adm;

  INSERT INTO public.admissao_documentos (admissao_id, tenant_id, nome, tipo, obrigatorio)
  VALUES (v_adm, v_t, 'RG', 'identidade', true),
         (v_adm, v_t, 'CPF', 'identidade', true),
         (v_adm, v_t, 'Exame Admissional', 'saude', true);

  r.passo_ordem := 2;
  r.passo_acao  := 'Reprocessar a criacao do checklist com os mesmos nomes';
  r.esperado    := 'Recusado pelo indice unico — a lista nao dobra';
  BEGIN
    INSERT INTO public.admissao_documentos (admissao_id, tenant_id, nome, tipo, obrigatorio)
    VALUES (v_adm, v_t, 'RG', 'identidade', true);
    v_duplicou := true;
  EXCEPTION WHEN unique_violation THEN v_duplicou := false;
  END;

  SELECT count(*) INTO v_n FROM public.admissao_documentos WHERE admissao_id = v_adm;

  IF NOT v_duplicou AND v_n = 3 THEN
    r.situacao := 'passou';
    r.obtido   := 'Reprocessamento recusado pelo indice admissao_documentos_admissao_nome_uidx. '
               || 'A lista segue com 3 itens. O bug que dobrava o checklist para 18 esta '
               || 'protegido por trava real, nao por disciplina de codigo.';
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('O checklist duplicou: %s item(ns) apos o reprocessamento. O indice '
               || 'unico admissao_documentos_admissao_nome_uidx nao esta segurando, e o upsert '
               || 'do codigo depende dele. Sem o indice, o ON CONFLICT vira decorativo e o bug '
               || 'de lista dobrada volta.', v_n);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_colab_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_alfa uuid := public.qa_empresa('[QA] Alfa');
  v_ids uuid[];
  v_id uuid;
  v_n int;
  v_nomes text[] := ARRAY['[QA-COLAB-010] Conceição Assunção',
                          '[QA-COLAB-010] João Müller',
                          '[QA-COLAB-010] Antônio Nuñez'];
  v_cpfs text[] := ARRAY[public.qa_cpf(1010),public.qa_cpf(1011),public.qa_cpf(1012)];
  i int;
  v_lido text;
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_fixture_limpar('COLAB-010');

  IF v_alfa IS NULL THEN
    r.situacao := 'erro';
    r.obtido   := 'A empresa [QA] Alfa nao existe no cercado. Semeie o cercado antes.';
    RETURN r;
  END IF;

  r.passo_ordem := 1;
  r.passo_acao  := 'Importar planilha com 3 colaboradores novos (CPFs distintos, nomes acentuados)';
  r.esperado    := '3 registros criados, 0 erros';

  FOR i IN 1..3 LOOP
    INSERT INTO public.usuarios_base
      (tenant_id, nome_completo, email_principal, cpf, tipo_usuario, status)
    VALUES (v_t, v_nomes[i], public.qa_fixture_email('COLAB-010', i),
            v_cpfs[i], 'colaborador', 'ativo')
    RETURNING id INTO v_id;
    v_ids := array_append(v_ids, v_id);
  END LOOP;

  IF array_length(v_ids, 1) <> 3 THEN
    r.situacao := 'falhou';
    r.obtido   := 'Esperava 3 pessoas criadas, saiu ' || COALESCE(array_length(v_ids,1), 0) || '.';
    PERFORM public.qa_fixture_limpar('COLAB-010');
    RETURN r;
  END IF;

  r.passo_ordem := 2;
  r.passo_acao  := 'Conferir a acentuacao dos nomes gravados';
  r.esperado    := 'Acentos corretos (UTF-8), sem caractere trocado';

  FOR i IN 1..3 LOOP
    SELECT nome_completo INTO v_lido FROM public.usuarios_base WHERE id = v_ids[i];
    IF v_lido IS DISTINCT FROM v_nomes[i] THEN
      r.situacao := 'falhou';
      r.obtido   := 'Nome voltou diferente do gravado. Esperado "' || v_nomes[i]
                 || '", lido "' || COALESCE(v_lido,'(nulo)') || '". Encoding corrompeu o dado.';
      PERFORM public.qa_fixture_limpar('COLAB-010');
      RETURN r;
    END IF;
  END LOOP;

  r.passo_ordem := 3;
  r.passo_acao  := 'Conferir os vinculos na empresa escolhida';
  r.esperado    := 'Os 3 com vinculo ativo na Alfa';

  FOR i IN 1..3 LOOP
    INSERT INTO public.usuario_vinculos
      (tenant_id, usuario_id, empresa_id, tipo_vinculo, status)
    VALUES (v_t, v_ids[i], v_alfa, 'colaborador', 'ativo');
  END LOOP;

  SELECT count(*) INTO v_n FROM public.usuario_vinculos
  WHERE empresa_id = v_alfa AND usuario_id = ANY(v_ids) AND status = 'ativo';

  IF v_n <> 3 THEN
    r.situacao := 'falhou';
    r.obtido   := 'Esperava 3 vinculos ativos, contei ' || v_n || '.';
    PERFORM public.qa_fixture_limpar('COLAB-010');
    RETURN r;
  END IF;

  r.passo_ordem := 4;
  r.passo_acao  := 'Comparar a estrutura com o cadastro manual do COLAB-001';
  r.esperado    := 'Mesmos campos preenchidos — a importacao nao deixa buraco';

  SELECT count(*) INTO v_n FROM public.usuarios_base
  WHERE id = ANY(v_ids)
    AND cpf IS NOT NULL AND btrim(cpf) <> ''
    AND email_principal IS NOT NULL
    AND nome_completo IS NOT NULL
    AND tipo_usuario = 'colaborador'
    AND status = 'ativo';

  IF v_n = 3 THEN
    r.situacao := 'passou';
    r.obtido   := '3 criados com acentuacao intacta, 3 vinculos ativos e nenhum campo em branco.';
  ELSE
    r.situacao := 'falhou';
    r.obtido   := 'Apenas ' || v_n || ' dos 3 tem a estrutura completa do cadastro manual. '
               || 'A importacao deixou buraco em campo que o cadastro manual preenche.';
  END IF;

  PERFORM public.qa_fixture_limpar('COLAB-010');
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_colab_033()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_cru  text := public.qa_cpf(1033);
  v_fmt  text := '999.000.010-33';
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_fixture_limpar('COLAB-033');

  r.passo_ordem := 1;
  r.passo_acao  := 'Cadastrar pessoa com CPF sem formatacao (' || v_cru || ')';

  INSERT INTO public.usuarios_base
    (tenant_id, nome_completo, email_principal, cpf, tipo_usuario, status)
  VALUES (v_t, '[QA-COLAB-033] Pessoa CPF Cru', public.qa_fixture_email('COLAB-033', 1),
          v_cru, 'colaborador', 'ativo');

  r.passo_ordem := 2;
  r.passo_acao  := 'Cadastrar OUTRA pessoa com o MESMO CPF, agora formatado (' || v_fmt || ')';
  r.esperado    := 'Recusado — mesmos 11 digitos, mesma pessoa';

  BEGIN
    INSERT INTO public.usuarios_base
      (tenant_id, nome_completo, email_principal, cpf, tipo_usuario, status)
    VALUES (v_t, '[QA-COLAB-033] Pessoa CPF Formatado', public.qa_fixture_email('COLAB-033', 2),
            v_fmt, 'colaborador', 'ativo');

    r.situacao := 'falhou';
    r.obtido   := 'ACEITOU. A mesma pessoa existe duas vezes, separada so pela pontuacao do CPF. '
               || 'usuarios_base_cpf_tenant_uidx e sobre a coluna crua e nao enxerga que '
               || regexp_replace(v_fmt,'[^0-9]','','g') || ' = ' || v_cru
               || '. Correcao: normalizar o CPF na escrita (trigger) e reconstruir o indice '
               || 'sobre a forma normalizada.';
    r.detalhe  := jsonb_build_object(
                    'cpf_gravado_1', v_cru,
                    'cpf_gravado_2', v_fmt,
                    'digitos_iguais', regexp_replace(v_fmt,'[^0-9]','','g') = v_cru);
  EXCEPTION
    WHEN unique_violation THEN
      r.situacao := 'passou';
      r.obtido   := 'Recusado com unique_violation. O CPF esta normalizado na escrita.';
    WHEN OTHERS THEN
      r.situacao := 'erro'; r.obtido := 'Erro inesperado'; r.erro_tecnico := SQLERRM;
  END;

  PERFORM public.qa_fixture_limpar('COLAB-033');
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_desl_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_adm uuid; v_status text; v_data date; v_motivo text;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Cadastrar admissao concluida e ativa';
  INSERT INTO public.admissoes
    (tenant_id, nome_completo, cpf, email, cargo, status, data_admissao)
  VALUES (v_t, '[QA-DESL-001] Colaborador', public.qa_cpf(100001),
          'qa.desl001@sandbox.invalid', 'Operador', 'concluido', CURRENT_DATE - 800)
  RETURNING id INTO v_adm;

  r.passo_ordem := 2;
  r.passo_acao  := 'Registrar desligamento com dados validos';
  r.esperado    := 'Persistido, com status desligado';
  UPDATE public.admissoes SET
    status = 'desligado',
    data_desligamento = CURRENT_DATE,
    motivo_desligamento = 'sem_justa_causa',
    dias_aviso_previo = 36,
    tipo_aviso_previo = 'indenizado',
    multa_fgts = true,
    seguro_desemprego_elegivel = true
  WHERE id = v_adm;

  r.passo_ordem := 3;
  r.passo_acao  := 'Reler o registro';
  SELECT status::text, data_desligamento, motivo_desligamento
    INTO v_status, v_data, v_motivo
  FROM public.admissoes WHERE id = v_adm;

  IF v_status = 'desligado' AND v_data = CURRENT_DATE AND v_motivo = 'sem_justa_causa' THEN
    r.situacao := 'passou';
    r.obtido   := 'Desligamento gravado e status atualizado corretamente.';
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('Releitura divergente: status=%s, data=%s, motivo=%s.',
                          v_status, v_data, v_motivo);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_desl_002()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_adm uuid; v_aceitou boolean := false;
  v_motivo_final text; v_data_final date;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Cadastrar admissao e registrar o primeiro desligamento';
  INSERT INTO public.admissoes
    (tenant_id, nome_completo, cpf, email, cargo, status, data_admissao)
  VALUES (v_t, '[QA-DESL-002] Colaborador', public.qa_cpf(100002),
          'qa.desl002@sandbox.invalid', 'Operador', 'concluido', CURRENT_DATE - 900)
  RETURNING id INTO v_adm;

  UPDATE public.admissoes SET
    status = 'desligado', data_desligamento = CURRENT_DATE - 30,
    motivo_desligamento = 'pedido_demissao'
  WHERE id = v_adm;

  r.passo_ordem := 2;
  r.passo_acao  := 'Tentar registrar um SEGUNDO desligamento, com outro motivo e outra data';
  r.esperado    := 'Recusado — o contrato ja esta extinto';
  BEGIN
    UPDATE public.admissoes SET
      data_desligamento = CURRENT_DATE,
      motivo_desligamento = 'sem_justa_causa'
    WHERE id = v_adm;
    v_aceitou := true;
  EXCEPTION WHEN OTHERS THEN v_aceitou := false;
  END;

  r.passo_ordem := 3;
  r.passo_acao  := 'Conferir se o desligamento original sobreviveu';
  SELECT motivo_desligamento, data_desligamento INTO v_motivo_final, v_data_final
  FROM public.admissoes WHERE id = v_adm;

  IF NOT v_aceitou THEN
    r.situacao := 'passou';
    r.obtido   := 'Segundo desligamento recusado pelo banco.';
  ELSIF v_motivo_final = 'pedido_demissao' THEN
    r.situacao := 'falhou';
    r.obtido   := 'A segunda gravacao foi aceita, ainda que o motivo original tenha '
               || 'permanecido. Nao ha trava de duplicidade no banco.';
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('ACEITOU E SOBRESCREVEU. O desligamento original (pedido_demissao '
               || 'em %s) foi substituido por %s em %s, sem trilha. Como o desligamento e '
               || 'um UPDATE na propria linha de admissoes e nao um evento, a segunda '
               || 'gravacao APAGA a primeira: motivo, data, verbas e ASO do desligamento '
               || 'original deixam de existir. Nao ha como auditar o que foi alterado, '
               || 'nem por quem. Correcao sugerida: indice unico parcial impedindo '
               || 'reescrita de admissao ja desligada, e tabela de eventos de '
               || 'desligamento com historico, em vez de colunas na admissao.',
               (CURRENT_DATE - 30), v_motivo_final, v_data_final);
    r.detalhe  := jsonb_build_object('motivo_original','pedido_demissao',
                                     'motivo_apos_segunda_gravacao', v_motivo_final,
                                     'historico_preservado', false);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_desl_003()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_adm uuid; v_cpf text := public.qa_cpf(100003); v_aceitou boolean := false;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Cadastrar colaborador com afastamento ATIVO e sem data de retorno';
  INSERT INTO public.admissoes
    (tenant_id, nome_completo, cpf, email, cargo, status, data_admissao)
  VALUES (v_t, '[QA-DESL-003] Colaborador', v_cpf,
          'qa.desl003@sandbox.invalid', 'Operador', 'concluido', CURRENT_DATE - 1000)
  RETURNING id INTO v_adm;

  INSERT INTO public.afastamentos
    (tenant_id, colaborador_nome, colaborador_cpf, data_inicio, data_fim, status)
  VALUES (v_t, '[QA-DESL-003] Colaborador', v_cpf, CURRENT_DATE - 60, NULL, 'ativo');

  r.passo_ordem := 2;
  r.passo_acao  := 'Tentar dispensa sem justa causa com o contrato suspenso';
  r.esperado    := 'Recusado — CLT art. 476: durante o auxilio-doenca o contrato esta suspenso';
  BEGIN
    UPDATE public.admissoes SET
      status = 'desligado', data_desligamento = CURRENT_DATE,
      motivo_desligamento = 'sem_justa_causa'
    WHERE id = v_adm;
    v_aceitou := true;
  EXCEPTION WHEN OTHERS THEN v_aceitou := false;
  END;

  IF v_aceitou THEN
    r.situacao := 'falhou';
    r.obtido   := 'ACEITOU dispensa imotivada com afastamento ativo e sem retorno formal. '
               || 'O contrato suspenso (CLT art. 476) nao admite dispensa imotivada — o '
               || 'ato e ineficaz e a discussao vira reintegracao. A tela consulta '
               || 'afastamentos, mas o banco nao impede a gravacao por nenhuma outra rota. '
               || 'Correcao sugerida: trigger que recuse desligamento imotivado havendo '
               || 'afastamento ativo, liberando falecimento e termino de contrato a termo.';
  ELSE
    r.situacao := 'passou';
    r.obtido   := 'Recusado pelo banco. A suspensao do contrato e respeitada na escrita.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_desl_004()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_adm uuid; v_aceitou boolean := false;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Cadastrar admissao com inicio no futuro';
  INSERT INTO public.admissoes
    (tenant_id, nome_completo, cpf, email, cargo, status, data_admissao)
  VALUES (v_t, '[QA-DESL-004] Colaborador', public.qa_cpf(100004),
          'qa.desl004@sandbox.invalid', 'Operador', 'concluido', CURRENT_DATE + 30)
  RETURNING id INTO v_adm;

  r.passo_ordem := 2;
  r.passo_acao  := 'Tentar desligar hoje, antes do inicio do contrato';
  r.esperado    := 'Recusado — sem prestacao iniciada nao ha contrato em curso';
  BEGIN
    UPDATE public.admissoes SET
      status = 'desligado', data_desligamento = CURRENT_DATE,
      motivo_desligamento = 'sem_justa_causa'
    WHERE id = v_adm;
    v_aceitou := true;
  EXCEPTION WHEN OTHERS THEN v_aceitou := false;
  END;

  IF v_aceitou THEN
    r.situacao := 'falhou';
    r.obtido   := 'ACEITOU desligamento com data anterior a propria admissao — contrato '
               || 'com duracao negativa. Nada no banco impede. A validacao existe apenas '
               || 'na tela (RNDES02). Correcao sugerida: CHECK garantindo '
               || 'data_desligamento >= data_admissao. Para desistencia antes do inicio o '
               || 'evento correto e cancelamento de admissao, nao desligamento — sao '
               || 'eventos distintos no eSocial.';
  ELSE
    r.situacao := 'passou';
    r.obtido   := 'Recusado pelo banco.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_desl_006()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_adm uuid; v_alheio uuid; v_gravou boolean := false;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Localizar um usuario de OUTRO tenant';
  SELECT id INTO v_alheio FROM public.usuarios_base
  WHERE tenant_id IS DISTINCT FROM v_t LIMIT 1;

  IF v_alheio IS NULL THEN
    r.situacao := 'nao_implementado';
    r.obtido   := 'Nao existe usuario fora do cercado nesta base — o isolamento entre '
               || 'clientes nao pode ser exercitado aqui.';
    RETURN r;
  END IF;

  r.passo_ordem := 2;
  r.passo_acao  := 'Cadastrar admissao no cercado e desliga-la atribuindo a autoria ao usuario alheio';
  r.esperado    := 'Recusado — a autoria do desligamento nao atravessa a fronteira do cliente';
  INSERT INTO public.admissoes
    (tenant_id, nome_completo, cpf, email, cargo, status, data_admissao)
  VALUES (v_t, '[QA-DESL-006] Colaborador', public.qa_cpf(100006),
          'qa.desl006@sandbox.invalid', 'Operador', 'concluido', CURRENT_DATE - 500)
  RETURNING id INTO v_adm;

  BEGIN
    UPDATE public.admissoes SET
      status = 'desligado', data_desligamento = CURRENT_DATE,
      motivo_desligamento = 'sem_justa_causa', desligado_por = v_alheio
    WHERE id = v_adm;
    v_gravou := EXISTS (SELECT 1 FROM public.admissoes
                        WHERE id = v_adm AND desligado_por = v_alheio);
  EXCEPTION WHEN OTHERS THEN v_gravou := false;
  END;

  IF v_gravou THEN
    r.situacao := 'falhou';
    r.obtido   := 'ACEITOU registrar como autor do desligamento um usuario de OUTRO '
               || 'cliente. desligado_por nao valida tenant. A RLS protege a leitura, mas '
               || 'a escrita cruza a fronteira — mesma classe do gap HIER-006 no modulo '
               || 'Empresa. Desligamento e dado pessoal e a autoria compoe a trilha de '
               || 'auditoria: autoria errada compromete a prova. Correcao sugerida: '
               || 'trigger validando que desligado_por pertence ao mesmo tenant da admissao.';
    r.detalhe  := jsonb_build_object('admissao_no_cercado', v_adm, 'autor_de_outro_tenant', v_alheio);
  ELSE
    r.situacao := 'passou';
    r.obtido   := 'Recusado. A autoria respeita a fronteira entre clientes.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_emp_024()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_emp uuid; v_pessoa uuid;
  v_antes int; v_depois int; v_reativada boolean;
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_fixture_limpar('EMP-024');

  r.passo_ordem := 1;
  r.passo_acao  := 'Cadastrar empresa ativa com um colaborador vinculado';
  INSERT INTO public.empresa_cadastro (tenant_id, razao_social, cnpj, ativo)
  VALUES (v_t, '[QA-EMP-024] Empresa Com Vinculo', '11555666000302', true)
  RETURNING id INTO v_emp;

  INSERT INTO public.usuarios_base
    (tenant_id, nome_completo, email_principal, cpf, tipo_usuario, status)
  VALUES (v_t, '[QA-EMP-024] Colaborador', public.qa_fixture_email('EMP-024', 1),
          public.qa_cpf(2401), 'colaborador', 'ativo')
  RETURNING id INTO v_pessoa;

  INSERT INTO public.usuario_vinculos
    (tenant_id, usuario_id, empresa_id, tipo_vinculo, status)
  VALUES (v_t, v_pessoa, v_emp, 'colaborador', 'ativo');

  SELECT count(*) INTO v_antes FROM public.usuario_vinculos WHERE empresa_id = v_emp;

  r.passo_ordem := 2;
  r.passo_acao  := 'Desativar a empresa';
  r.esperado    := 'Aceito, sem destruir nada';
  UPDATE public.empresa_cadastro SET ativo = false WHERE id = v_emp;

  r.passo_ordem := 3;
  r.passo_acao  := 'Reconferir os vinculos';
  SELECT count(*) INTO v_depois FROM public.usuario_vinculos WHERE empresa_id = v_emp;

  IF v_depois <> v_antes THEN
    r.situacao := 'falhou';
    r.obtido   := format('Desativar a empresa alterou os vinculos: %s antes, %s depois. '
               || 'Desativacao esta destruindo dado — e ela e o caminho recomendado '
               || 'para resolver CNPJ duplicado.', v_antes, v_depois);
    PERFORM public.qa_fixture_limpar('EMP-024');
    RETURN r;
  END IF;

  r.passo_ordem := 4;
  r.passo_acao  := 'Reativar a empresa';
  r.esperado    := 'Volta ao estado anterior sem perda';
  UPDATE public.empresa_cadastro SET ativo = true WHERE id = v_emp;
  SELECT ativo INTO v_reativada FROM public.empresa_cadastro WHERE id = v_emp;

  IF v_reativada AND v_depois = v_antes THEN
    r.situacao := 'passou';
    r.obtido   := format('Desativacao reversivel: %s vinculo(s) intacto(s) durante todo '
               || 'o ciclo e empresa reativada sem perda.', v_antes);
  ELSE
    r.situacao := 'falhou';
    r.obtido   := 'A empresa nao voltou ao estado ativo apos a reativacao.';
  END IF;

  PERFORM public.qa_fixture_limpar('EMP-024');
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_emp_025()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_emp uuid; v_pessoa uuid; v_apagou boolean := false;
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_fixture_limpar('EMP-025');

  r.passo_ordem := 1;
  r.passo_acao  := 'Cadastrar empresa com colaborador vinculado';
  INSERT INTO public.empresa_cadastro (tenant_id, razao_social, cnpj, ativo)
  VALUES (v_t, '[QA-EMP-025] Empresa Protegida', '11555666000303', true)
  RETURNING id INTO v_emp;

  INSERT INTO public.usuarios_base
    (tenant_id, nome_completo, email_principal, cpf, tipo_usuario, status)
  VALUES (v_t, '[QA-EMP-025] Colaborador', public.qa_fixture_email('EMP-025', 1),
          public.qa_cpf(2501), 'colaborador', 'ativo')
  RETURNING id INTO v_pessoa;

  INSERT INTO public.usuario_vinculos
    (tenant_id, usuario_id, empresa_id, tipo_vinculo, status)
  VALUES (v_t, v_pessoa, v_emp, 'colaborador', 'ativo');

  r.passo_ordem := 2;
  r.passo_acao  := 'Tentar apagar a empresa';
  r.esperado    := 'Recusado por foreign_key_violation (ON DELETE RESTRICT)';
  BEGIN
    DELETE FROM public.empresa_cadastro WHERE id = v_emp;
    v_apagou := true;
  EXCEPTION
    WHEN foreign_key_violation THEN v_apagou := false;
    WHEN OTHERS THEN
      r.situacao := 'erro'; r.obtido := 'Erro inesperado'; r.erro_tecnico := SQLERRM;
      PERFORM public.qa_fixture_limpar('EMP-025');
      RETURN r;
  END;

  IF v_apagou THEN
    r.situacao := 'falhou';
    r.obtido   := 'APAGOU a empresa que tinha vinculo. O historico do colaborador ficou '
               || 'orfao ou foi em cascata junto. O hook expoe delete() na interface, '
               || 'entao esta e uma rota alcancavel pela tela.';
  ELSE
    r.situacao := 'passou';
    r.obtido   := 'Recusado pelo banco. O ON DELETE RESTRICT protege o historico de '
               || 'pessoa contra exclusao de empresa.';
  END IF;

  PERFORM public.qa_fixture_limpar('EMP-025');
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_emp_060()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_emp uuid; v_admins int; v_vinc int; v_dup int; v_duplicou boolean := false;
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_fixture_limpar('EMP-060');

  r.passo_ordem := 1;
  r.passo_acao  := 'Garantir dois administradores no cercado';
  INSERT INTO public.usuarios_base
    (tenant_id, nome_completo, email_principal, cpf, tipo_usuario, status)
  VALUES
    (v_t, '[QA-EMP-060] Admin Um', public.qa_fixture_email('EMP-060', 1), public.qa_cpf(6001), 'administrador', 'ativo'),
    (v_t, '[QA-EMP-060] Admin Dois', public.qa_fixture_email('EMP-060', 2), public.qa_cpf(6002), 'administrador', 'ativo');

  SELECT count(*) INTO v_admins FROM public.usuarios_base
  WHERE tenant_id = v_t AND tipo_usuario = 'administrador';

  r.passo_ordem := 2;
  r.passo_acao  := 'Cadastrar empresa nova';
  r.esperado    := format('Um vinculo administrador ativo para cada um dos %s admins', v_admins);
  INSERT INTO public.empresa_cadastro (tenant_id, razao_social, cnpj, ativo)
  VALUES (v_t, '[QA-EMP-060] Empresa Nova', '11555666000306', true)
  RETURNING id INTO v_emp;

  r.passo_ordem := 3;
  r.passo_acao  := 'Contar os vinculos criados automaticamente';
  SELECT count(*) INTO v_vinc FROM public.usuario_vinculos
  WHERE empresa_id = v_emp AND tipo_vinculo = 'administrador' AND status = 'ativo';

  IF v_vinc <> v_admins THEN
    r.situacao := 'falhou';
    r.obtido   := format('O tenant tem %s administrador(es), mas a empresa nova recebeu '
               || '%s vinculo(s). Admin sem vinculo nao enxerga a empresa e o problema '
               || 'so aparece quando alguem reclama de acesso.', v_admins, v_vinc);
    PERFORM public.qa_fixture_limpar('EMP-060');
    RETURN r;
  END IF;

  r.passo_ordem := 4;
  r.passo_acao  := 'Tentar criar um vinculo administrador repetido, como a trigger faria num reprocessamento';
  r.esperado    := 'Recusado pelo indice unico — e o que sustenta o ON CONFLICT DO NOTHING';
  BEGIN
    INSERT INTO public.usuario_vinculos
      (tenant_id, usuario_id, empresa_id, tipo_vinculo, status)
    SELECT v_t, ub.id, v_emp, 'administrador', 'ativo'
    FROM public.usuarios_base ub
    WHERE ub.tenant_id = v_t AND ub.tipo_usuario = 'administrador'
    LIMIT 1;
    v_duplicou := true;
  EXCEPTION WHEN unique_violation THEN v_duplicou := false;
  END;

  SELECT count(*) INTO v_dup FROM public.usuario_vinculos
  WHERE empresa_id = v_emp AND tipo_vinculo = 'administrador' AND status = 'ativo';

  IF NOT v_duplicou AND v_dup = v_admins THEN
    r.situacao := 'passou';
    r.obtido   := format('%s administrador(es) vinculado(s) automaticamente, e a tentativa '
               || 'de repetir o vinculo foi recusada pelo indice unico. O ON CONFLICT DO '
               || 'NOTHING da trigger esta apoiado no indice instalado em 15/07/2026 — '
               || 'antes disso era decorativo.', v_admins);
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('Vinculo administrador duplicado foi ACEITO: a contagem foi de %s '
               || 'para %s. O ON CONFLICT DO NOTHING da trigger nao tem indice unico que '
               || 'o sustente e voltou a ser decorativo.', v_admins, v_dup);
  END IF;

  PERFORM public.qa_fixture_limpar('EMP-060');
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_ponto_270()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_sem_trava int; v_lista text; v_real uuid;
  v_ins boolean := false; v_upd boolean := false; v_del_coberto boolean;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Listar tabelas de ponto e jornada sem a trava do cercado';
  r.esperado    := 'Nenhuma';

  SELECT count(*), string_agg(x.tn, ', ' ORDER BY x.tn) INTO v_sem_trava, v_lista
  FROM (
    SELECT col.table_name AS tn
    FROM information_schema.columns col
    JOIN information_schema.tables t
      ON t.table_schema = col.table_schema AND t.table_name = col.table_name
    WHERE col.table_schema = 'public' AND col.column_name = 'tenant_id'
      AND t.table_type = 'BASE TABLE'
      AND (col.table_name LIKE 'ponto\_%' OR col.table_name LIKE 'jornada\_%')
      AND NOT EXISTS (
        SELECT 1 FROM pg_trigger tg
        WHERE tg.tgname = 'qa_guarda_cercado'
          AND tg.tgrelid = ('public.' || quote_ident(col.table_name))::regclass
          AND NOT tg.tgisinternal)
  ) x;

  IF v_sem_trava > 0 THEN
    r.situacao := 'falhou';
    r.obtido   := format('%s tabela(s) do módulo SEM a trava do cercado: %s. Uma rotina de '
               || 'teste com erro de tenant escreveria em ponto de cliente real por esse '
               || 'caminho. Correção: rodar SELECT * FROM qa_instalar_cercas().',
               v_sem_trava, v_lista);
    RETURN r;
  END IF;

  r.passo_ordem := 2;
  r.passo_acao  := 'Tentar INSERT em ponto de tenant REAL, com o modo de teste ligado';
  r.esperado    := 'Bloqueado pela cerca';

  SELECT id INTO v_real FROM public.tenants
  WHERE id IS DISTINCT FROM public.qa_sandbox_tenant_id() LIMIT 1;

  IF v_real IS NULL THEN
    r.situacao := 'passou';
    r.obtido   := 'Todas as tabelas do módulo têm a trava. Não há outro tenant nesta base '
               || 'para exercitar o bloqueio.';
    RETURN r;
  END IF;

  BEGIN
    INSERT INTO public.ponto_marcacoes
      (tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
       tipo_marcacao, hash_marcacao)
    VALUES (v_real, gen_random_uuid(), '[QA-PONTO-270]', public.qa_cpf(27001),
            'entrada', 'qa-teste-cerca');
    v_ins := true;   -- passou: a cerca falhou
  EXCEPTION WHEN OTHERS THEN v_ins := false;
  END;

  r.passo_ordem := 3;
  r.passo_acao  := 'Criar linha NO CERCADO e tentar movê-la para o tenant real';
  r.esperado    := 'Bloqueado pela cerca';
  -- Testar UPDATE assim, e não sobre linha de cliente, é deliberado: se a
  -- cerca falhar, quem se move e uma linha de teste do proprio cercado, e o
  -- funil a descarta. Mirar linha real provaria o mesmo e arriscaria o dado.
  BEGIN
    INSERT INTO public.ponto_marcacoes
      (tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
       tipo_marcacao, hash_marcacao)
    VALUES (public.qa_sandbox_tenant_id(), gen_random_uuid(), '[QA-PONTO-270] Cobaia',
            public.qa_cpf(27002), 'entrada', 'qa-teste-cerca');

    UPDATE public.ponto_marcacoes SET tenant_id = v_real
    WHERE colaborador_nome = '[QA-PONTO-270] Cobaia';
    v_upd := true;   -- passou: a cerca falhou
  EXCEPTION WHEN OTHERS THEN v_upd := false;
  END;

  r.passo_ordem := 4;
  r.passo_acao  := 'Conferir no catalogo se a trava tambem cobre DELETE';
  r.esperado    := 'A trigger declara INSERT, UPDATE e DELETE';
  -- DELETE nao e exercitado contra dado real de proposito: so provaria algo
  -- mirando uma linha de cliente que existisse, e se a cerca falhasse o dado
  -- seria apagado. Aqui a declaracao e verificada no catalogo. tgtype: bit 4
  -- = INSERT, bit 8 = DELETE, bit 16 = UPDATE.
  SELECT bool_and((tg.tgtype & 8) <> 0) INTO v_del_coberto
  FROM pg_trigger tg
  JOIN pg_class c ON c.oid = tg.tgrelid
  WHERE tg.tgname = 'qa_guarda_cercado' AND NOT tg.tgisinternal
    AND (c.relname LIKE 'ponto\_%' OR c.relname LIKE 'jornada\_%');

  IF v_ins OR v_upd OR NOT COALESCE(v_del_coberto, false) THEN
    r.situacao := 'falhou';
    r.obtido   := format('A cerca nao esta segurando o modulo. INSERT em tenant real passou: '
               || '%s. UPDATE movendo linha do cercado para tenant real passou: %s. DELETE '
               || 'declarado na trigger em todas as tabelas: %s. Enquanto qualquer um destes '
               || 'estiver errado, nenhuma rotina de ponto pode ser escrita com seguranca.',
               v_ins, v_upd, COALESCE(v_del_coberto, false));
    r.detalhe  := jsonb_build_object('insert_passou', v_ins, 'update_passou', v_upd,
                                     'delete_coberto', v_del_coberto);
  ELSE
    r.situacao := 'passou';
    r.obtido   := 'Todas as tabelas do modulo tem a trava; INSERT em tenant real e UPDATE '
               || 'movendo linha para fora do cercado foram bloqueados; e a trigger cobre '
               || 'DELETE em todas elas. O cercado esta fechado para escrita de ponto.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_porte_005()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_emp uuid; v_outra uuid; v_conta int; v_nulo_permitido boolean;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Cadastrar duas empresas e povoar admissoes em varios estados';
  INSERT INTO public.empresa_cadastro (tenant_id, razao_social, cnpj, ativo)
  VALUES (v_t, '[QA-PORTE-005] Empresa Alvo', '11555666000331', true) RETURNING id INTO v_emp;
  INSERT INTO public.empresa_cadastro (tenant_id, razao_social, cnpj, ativo)
  VALUES (v_t, '[QA-PORTE-005] Outra Empresa', '11555666000332', true) RETURNING id INTO v_outra;

  INSERT INTO public.admissoes
    (tenant_id, empresa_id, nome_completo, cpf, email, cargo, status, inativo)
  VALUES
    (v_t, v_emp,   '[QA-PORTE-005] Conta 1',   public.qa_cpf(50001), 'p1@sandbox.invalid', 'Operador', 'concluido', false),
    (v_t, v_emp,   '[QA-PORTE-005] Conta 2',   public.qa_cpf(50002), 'p2@sandbox.invalid', 'Operador', 'concluido', false),
    (v_t, v_emp,   '[QA-PORTE-005] Inativa',   public.qa_cpf(50003), 'p3@sandbox.invalid', 'Operador', 'concluido', true),
    (v_t, v_emp,   '[QA-PORTE-005] Em Curso',  public.qa_cpf(50004), 'p4@sandbox.invalid', 'Operador', 'em_analise', false),
    (v_t, v_outra, '[QA-PORTE-005] Vizinha',   public.qa_cpf(50005), 'p5@sandbox.invalid', 'Operador', 'concluido', false);

  r.passo_ordem := 2;
  r.passo_acao  := 'Contar com o mesmo criterio do usePorteEmpresa';
  r.esperado    := 'Exatamente 2 — so concluidas, nao inativas, da propria empresa';
  SELECT count(*) INTO v_conta FROM public.admissoes
  WHERE tenant_id = v_t AND empresa_id = v_emp
    AND status = 'concluido'
    AND (inativo IS NULL OR inativo = false);

  IF v_conta <> 2 THEN
    r.situacao := 'falhou';
    r.obtido   := format('Esperava 2 e contei %s. Inativa, em andamento ou de outra '
               || 'empresa entrou na conta — o porte sai errado e o Plano de Acao do '
               || 'PGR dimensiona estrutura errada.', v_conta);
    RETURN r;
  END IF;

  r.passo_ordem := 3;
  r.passo_acao  := 'Conferir se inativo pode ser NULL no banco';
  r.esperado    := 'A coluna e NOT NULL — o ramo NULL do front e defensivo, nao real';
  SELECT NOT a.attnotnull INTO v_nulo_permitido
  FROM pg_attribute a
  WHERE a.attrelid = 'public.admissoes'::regclass AND a.attname = 'inativo';

  IF v_nulo_permitido THEN
    r.situacao := 'falhou';
    r.obtido   := 'A coluna admissoes.inativo ACEITA NULL. O filtro do front trata NULL '
               || 'como ativo, entao a contagem so esta correta por causa desse ramo — '
               || 'ele passou a ser carga estrutural. Quem simplificar para inativo = '
               || 'false exclui todo registro com NULL e derruba o porte da empresa uma '
               || 'categoria inteira, em silencio.';
  ELSE
    r.situacao := 'passou';
    r.obtido   := 'Contagem correta (2). ACHADO: admissoes.inativo e NOT NULL DEFAULT '
               || 'false, entao o ramo "inativo IS NULL" do usePorteEmpresa protege um '
               || 'estado que o banco ja impede. E codigo defensivo inofensivo hoje, '
               || 'mas o comentario no hook ("pode ser null em registros antigos") '
               || 'descreve uma realidade que nao existe — vale corrigir o comentario '
               || 'ou remover o ramo, para nao induzir a proxima leitura ao erro.';
    r.detalhe  := jsonb_build_object('contagem', v_conta, 'inativo_aceita_null', false);
  END IF;

  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;
-- Conferência: nenhuma rotina de QA pode ter CPF literal
SELECT p.proname AS rotina_com_cpf_literal
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname LIKE 'qa\_caso\_%'
  AND p.prosrc ~ '''999[0-9]{8}'''
ORDER BY 1;
