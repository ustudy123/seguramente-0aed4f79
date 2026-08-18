-- =====================================================================
-- PONTO — ONDA 0: travas legais de risco aberto
-- =====================================================================
-- Seis correções pequenas, sem dependência entre si, que fecham riscos
-- que estão abertos agora. Nenhuma altera cálculo de jornada: todas são
-- de ACESSO (quem lê o quê) ou de VALIDAÇÃO DE CADASTRO (o que pode ser
-- gravado). O saldo, o espelho e a apuração saem daqui idênticos.
--
--   PONTO-396  leitura de ponto restrita ao próprio colaborador (LGPD)
--   PONTO-376  marcação com data/hora no futuro é recusada
--   PONTO-043  tolerância acima do teto legal é recusada no cadastro
--   PONTO-063  CCT com intervalo abaixo do piso de 30 min é recusada
--   PONTO-372  modo "por exceção" exige o acordo anexado
--   PONTO-270  instala a trava do cercado na tabela que ficou de fora
--
-- Mais duas correções na própria régua de QA (a bateria media errado):
--   PONTO-357  falso positivo: casava com o NOME DO PARÂMETRO
--   PONTO-253  veredito correto, mas pedia conferência humana
--
-- PRINCÍPIO DE NÃO-REGRESSÃO adotado nas validações de cadastro:
-- o gatilho valida o que está sendo CRIADO ou EFETIVAMENTE ALTERADO.
-- Registro legado fora da faixa continua editável nos demais campos —
-- só não pode ser gravado ou reafirmado fora da faixa. Os legados são
-- listados na conferência do script de entrega para correção manual.
-- =====================================================================

-- DDL curta em tabela movimentada (CREATE TRIGGER pega lock exclusivo por
-- instantes): teto de espera para nao enfileirar escrita de ponto.
SET lock_timeout = '10s';

-- ---------------------------------------------------------------------
-- PONTO-396 — Colaborador comum lê apenas o próprio ponto
-- ---------------------------------------------------------------------
-- LGPD arts. 6º e 46: jornada, geolocalização e imagem são dado pessoal.
-- Hoje as políticas de leitura param no tenant e no vínculo de empresa,
-- então um colaborador comum lê pela API as marcações dos colegas.
--
-- Usa exatamente o mesmo portão das outras 20 tabelas sensíveis já
-- protegidas (saúde, férias, psicossocial): perfil_permite_modulo, que
-- libera superadmin, papel de gestão para cima, tipo administrador/gestor
-- e perfil com escopo amplo. Quem não passa cai no próprio CPF.
-- Módulos 'ponto' e 'colaboradores' — o segundo pelo mesmo motivo das
-- políticas de férias: quem administra colaboradores amplamente já
-- enxerga esses dados hoje e não pode perder acesso.
DO $ponto396$
DECLARE
  v_tabela text;
BEGIN
  FOREACH v_tabela IN ARRAY ARRAY['ponto_marcacoes', 'ponto_espelhos', 'ponto_diario'] LOOP
    IF to_regclass('public.' || v_tabela) IS NULL THEN
      RAISE NOTICE 'Tabela %s nao existe nesta base: politica ignorada.', v_tabela;
      CONTINUE;
    END IF;

    EXECUTE format(
      'DROP POLICY IF EXISTS perfil_restringe_leitura_%1$s ON public.%1$I', v_tabela);

    EXECUTE format($pol$
      CREATE POLICY perfil_restringe_leitura_%1$s
      ON public.%1$I
      AS RESTRICTIVE
      FOR SELECT
      TO authenticated
      USING (
        public.perfil_permite_modulo(tenant_id, VARIADIC ARRAY['ponto', 'colaboradores'])
        OR regexp_replace(COALESCE(colaborador_cpf, ''), '[^0-9]', '', 'g')
           = public.cpf_do_usuario_logado()
      )
    $pol$, v_tabela);
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'PONTO-396 nao aplicado: %', SQLERRM;
END $ponto396$;

-- ---------------------------------------------------------------------
-- PONTO-376 — Marcação no futuro é recusada
-- ---------------------------------------------------------------------
-- Portaria MTP 671/2021: o registro precisa refletir fielmente o momento
-- da marcação. Hoje data e hora vêm do cliente sem validação temporal —
-- por API ou SQL grava-se o ponto de amanhã.
--
-- Duas escolhas deliberadas:
--  (1) só a marcação ORIGINAL passa pela trava. Ajuste e abono aprovados
--      por gestor são atos administrativos e podem se referir a dia
--      planejado; barrá-los quebraria a aprovação de "dia inteiro".
--  (2) o relógio de referência é o de São Paulo, que é o mesmo que o
--      sistema já usa para carimbar o ponto (registrar_ponto_externo_cpf),
--      com folga para o adiantamento do relógio do dispositivo.
CREATE OR REPLACE FUNCTION public.ponto_bloquear_marcacao_futura()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_agora   timestamp := timezone('America/Sao_Paulo', now());
  v_marcada timestamp;
  -- Folga para latência e relógio do dispositivo levemente adiantado.
  -- Acima disso o certo é recusar e avisar: gravar hora errada em
  -- silêncio é pior que recusar com mensagem.
  v_folga   interval := interval '5 minutes';
BEGIN
  IF COALESCE(NEW.marcacao_original, true) IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  IF NEW.data_marcacao IS NULL OR NEW.hora_marcacao IS NULL THEN
    RETURN NEW;
  END IF;

  v_marcada := NEW.data_marcacao + NEW.hora_marcacao;

  IF v_marcada > v_agora + v_folga THEN
    RAISE EXCEPTION
      'Marcacao de ponto no futuro nao e aceita: informada %, agora %. Confira o relogio do dispositivo.',
      to_char(v_marcada, 'DD/MM/YYYY HH24:MI'),
      to_char(v_agora,  'DD/MM/YYYY HH24:MI');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ponto_bloquear_marcacao_futura ON public.ponto_marcacoes;
CREATE TRIGGER trg_ponto_bloquear_marcacao_futura
BEFORE INSERT ON public.ponto_marcacoes
FOR EACH ROW
EXECUTE FUNCTION public.ponto_bloquear_marcacao_futura();

-- ---------------------------------------------------------------------
-- PONTO-043 — Tolerância acima do teto legal é recusada
-- ---------------------------------------------------------------------
-- CLT art. 58, §1º: até 5 minutos por marcação, até 10 no dia.
-- Súmula 449 do TST: nem a negociação coletiva amplia esse teto.
-- Reduzir é permitido — zero inclusive, e é escolha válida (PONTO-352).
CREATE OR REPLACE FUNCTION public.ponto_validar_tolerancia_escala()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR NEW.tolerancia_minutos IS DISTINCT FROM OLD.tolerancia_minutos THEN
    IF NEW.tolerancia_minutos IS NOT NULL
       AND (NEW.tolerancia_minutos < 0 OR NEW.tolerancia_minutos > 5) THEN
      RAISE EXCEPTION
        'Tolerancia por marcacao deve ficar entre 0 e 5 minutos (CLT art. 58, §1º; Sumula 449 do TST veda ampliar, inclusive por norma coletiva). Valor recusado: %.',
        NEW.tolerancia_minutos;
    END IF;
  END IF;

  IF TG_OP = 'INSERT'
     OR NEW.tolerancia_diaria_minutos IS DISTINCT FROM OLD.tolerancia_diaria_minutos THEN
    IF NEW.tolerancia_diaria_minutos IS NOT NULL
       AND (NEW.tolerancia_diaria_minutos < 0 OR NEW.tolerancia_diaria_minutos > 10) THEN
      RAISE EXCEPTION
        'Tolerancia diaria deve ficar entre 0 e 10 minutos (CLT art. 58, §1º; Sumula 449 do TST). Valor recusado: %.',
        NEW.tolerancia_diaria_minutos;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ponto_validar_tolerancia_escala ON public.ponto_escalas;
CREATE TRIGGER trg_ponto_validar_tolerancia_escala
BEFORE INSERT OR UPDATE ON public.ponto_escalas
FOR EACH ROW
EXECUTE FUNCTION public.ponto_validar_tolerancia_escala();

-- ---------------------------------------------------------------------
-- PONTO-063 — CCT não pode furar o piso de 30 minutos de intervalo
-- ---------------------------------------------------------------------
-- CLT art. 611-A, III: a negociação coletiva pode reduzir o intervalo,
-- mas 30 minutos é piso absoluto.
CREATE OR REPLACE FUNCTION public.ponto_validar_intervalo_cct()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR NEW.intervalo_minimo_min IS DISTINCT FROM OLD.intervalo_minimo_min THEN
    IF NEW.intervalo_minimo_min IS NOT NULL AND NEW.intervalo_minimo_min < 30 THEN
      RAISE EXCEPTION
        'Intervalo minimo por norma coletiva nao pode ficar abaixo de 30 minutos (CLT art. 611-A, III). Valor recusado: %.',
        NEW.intervalo_minimo_min;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ponto_validar_intervalo_cct ON public.ponto_cct_config;
CREATE TRIGGER trg_ponto_validar_intervalo_cct
BEFORE INSERT OR UPDATE ON public.ponto_cct_config
FOR EACH ROW
EXECUTE FUNCTION public.ponto_validar_intervalo_cct();

-- ---------------------------------------------------------------------
-- PONTO-372 — Registro por exceção exige o acordo anexado
-- ---------------------------------------------------------------------
-- CLT art. 74, §4º: o registro por exceção depende de acordo individual
-- escrito ou instrumento coletivo. A coluna do documento já existia;
-- faltava a obrigatoriedade.
CREATE OR REPLACE FUNCTION public.ponto_validar_acordo_excecao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR NEW.modo_apuracao IS DISTINCT FROM OLD.modo_apuracao
     OR NEW.ponto_excecao_acordo_url IS DISTINCT FROM OLD.ponto_excecao_acordo_url THEN
    IF COALESCE(NEW.modo_apuracao, '') = 'por_excecao'
       AND btrim(COALESCE(NEW.ponto_excecao_acordo_url, '')) = '' THEN
      RAISE EXCEPTION
        'Registro por excecao exige o acordo anexado (CLT art. 74, §4º): preencha o documento autorizador antes de ativar o modo.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ponto_validar_acordo_excecao ON public.ponto_configuracao;
CREATE TRIGGER trg_ponto_validar_acordo_excecao
BEFORE INSERT OR UPDATE ON public.ponto_configuracao
FOR EACH ROW
EXECUTE FUNCTION public.ponto_validar_acordo_excecao();

-- ---------------------------------------------------------------------
-- PONTO-270 — Instala a trava do cercado na tabela que ficou de fora
-- ---------------------------------------------------------------------
-- ponto_entrega_conferencia era a única das 30 tabelas do módulo sem a
-- proteção que impede rotina de teste de escrever em tenant real.
DO $ponto270$
BEGIN
  PERFORM 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'qa_instalar_cercas';
  IF NOT FOUND THEN
    RAISE NOTICE 'Motor de QA nao instalado nesta base: cercas ignoradas.';
    RETURN;
  END IF;
  PERFORM * FROM public.qa_instalar_cercas();
  RAISE NOTICE 'Cercas do cercado de teste reinstaladas.';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Nao foi possivel instalar as cercas: %', SQLERRM;
END $ponto270$;

-- =====================================================================
-- CORREÇÕES NA RÉGUA DE QA
-- =====================================================================

-- ---------------------------------------------------------------------
-- FIXTURE qa_ponto_escala_tol — separa as DUAS tolerâncias
-- ---------------------------------------------------------------------
-- Defeito latente que a trava do PONTO-043 revelou: o fixture gravava o
-- MESMO número em tolerancia_minutos (por marcação, teto legal 5) e em
-- tolerancia_diaria_minutos (por dia, teto legal 10). As dez rotinas que
-- o usam passam 10 — que é o teto DIÁRIO; nenhuma delas quer 10 por
-- marcação, valor que a lei não admite.
--
-- Passa a derivar a tolerância por marcação do teto legal, mantendo a
-- diária como veio. O caso PONTO-043, que semeia 30 para provar a
-- recusa, continua sendo recusado — agora pela regra diária (30 > 10).
--
-- A ASSINATURA FICA IDÊNTICA de propósito: acrescentar um parâmetro, ainda
-- que opcional, cria uma SOBRECARGA em vez de substituir, e as dez chamadas
-- de seis argumentos passam a ser ambíguas.
CREATE OR REPLACE FUNCTION public.qa_ponto_escala_tol(
  p_cpf text, p_nome text, p_jornada_min integer, p_tol_min integer,
  p_data_inicio date, p_data_fim date
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.ponto_escalas
    (tenant_id, nome, tipo, modalidade, jornada_diaria_minutos,
     jornada_semanal_minutos, intervalo_intrajornada_minutos,
     tolerancia_minutos, tolerancia_diaria_minutos,
     hora_entrada_padrao, hora_saida_padrao,
     equalizacao_mensal_ativa, carga_semanal_contratada_min, ativa)
  VALUES (public.qa_sandbox_tenant_id(), 'QA escala ' || p_cpf, 'fixa', 'fixa',
          p_jornada_min, p_jornada_min * 5, 60,
          LEAST(p_tol_min, 5), p_tol_min,
          TIME '08:00', TIME '17:00',
          false, p_jornada_min * 5, true)
  RETURNING id INTO v_id;

  INSERT INTO public.ponto_escala_atribuicoes
    (tenant_id, escala_id, colaborador_id, colaborador_nome, colaborador_cpf,
     data_inicio, data_fim, ativa)
  VALUES (public.qa_sandbox_tenant_id(), v_id, p_cpf, p_nome, p_cpf,
          p_data_inicio, p_data_fim, true);
  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------
-- PONTO-350 — Rotina dependente da hora do dia (corrige intermitência)
-- ---------------------------------------------------------------------
-- A rotina cravava batidas às 08:00, 08:01 e 12:00 de HOJE. Com a trava
-- do PONTO-376 no lugar, rodar a bateria antes do meio-dia faz a batida
-- das 12:00 cair no futuro e ser recusada — o caso acusaria "trava
-- demais" de manhã e passaria à tarde.
--
-- O que o caso mede é a janela anti-repique, que compara com a marcação
-- anterior do MESMO dia e independe da data. Ancorar o cenário em ontem
-- preserva integralmente o que ele testa e o torna determinístico.
DO $qa350$
BEGIN
  IF to_regclass('public.qa_retorno') IS NULL THEN
    RAISE NOTICE 'Motor de QA nao instalado: qa_caso_ponto_350 ignorado.';
    RETURN;
  END IF;

  EXECUTE $body350$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_350()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $fn$
DECLARE
  r public.qa_retorno;
  v_cpf text;
  v_data date := CURRENT_DATE - 1;   -- ancora em dia passado: ver nota da migration
  v_bloqueou_dupla boolean := false;
  v_bloqueou_saida_repique boolean := false;
  v_aceitou_depois boolean := false;
BEGIN
  v_cpf := public.qa_ponto_admissao('QA Toque Duplo', 3501);

  r.passo_ordem := 1;
  r.passo_acao := 'Registrar entrada às 08:00:00 e tentar NOVA entrada às 08:00:30 (mesmo minuto)';
  r.esperado := 'A segunda batida é recusada como repique do mesmo toque';

  PERFORM public.qa_ponto_marca(v_cpf, 'QA Toque Duplo', v_data, TIME '08:00:00', 'entrada');
  BEGIN
    PERFORM public.qa_ponto_marca(v_cpf, 'QA Toque Duplo', v_data, TIME '08:00:30', 'entrada');
  EXCEPTION WHEN OTHERS THEN
    v_bloqueou_dupla := true;
  END;

  r.passo_ordem := 2;
  r.passo_acao := 'Tentar SAÍDA às 08:01:00 (ainda dentro da janela do repique)';
  r.esperado := 'Também recusada — o dedo que escorrega não fecha a jornada em 1 minuto';
  BEGIN
    PERFORM public.qa_ponto_marca(v_cpf, 'QA Toque Duplo', v_data, TIME '08:01:00', 'saida');
  EXCEPTION WHEN OTHERS THEN
    v_bloqueou_saida_repique := true;
  END;

  r.passo_ordem := 3;
  r.passo_acao := 'Registrar saída legítima às 12:00';
  r.esperado := 'Aceita normalmente — a proteção não pode travar a jornada real';
  BEGIN
    PERFORM public.qa_ponto_marca(v_cpf, 'QA Toque Duplo', v_data, TIME '12:00:00', 'saida');
    v_aceitou_depois := true;
  EXCEPTION WHEN OTHERS THEN
    v_aceitou_depois := false;
  END;

  IF v_bloqueou_dupla AND v_bloqueou_saida_repique AND v_aceitou_depois THEN
    r.situacao := 'passou';
    r.obtido := 'O repique no mesmo minuto foi recusado (entrada E saída), e a batida legítima '
             || 'posterior entrou normalmente. A janela anti-toque-duplo está ativa no banco.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Proteção incompleta: repique de entrada %s, repique de saída %s, batida '
             || 'legítima depois %s. Duas batidas no mesmo minuto viram duas marcações no AFD e '
             || 'sujam a apuração. Correção: janela anti-toque-duplo no gatilho de marcação.',
             CASE WHEN v_bloqueou_dupla THEN 'BLOQUEADO' ELSE 'ACEITO' END,
             CASE WHEN v_bloqueou_saida_repique THEN 'BLOQUEADO' ELSE 'ACEITO' END,
             CASE WHEN v_aceitou_depois THEN 'aceita' ELSE 'RECUSADA (trava demais)' END);
    r.detalhe := jsonb_build_object('bloqueou_entrada_dupla', v_bloqueou_dupla,
                                    'bloqueou_saida_repique', v_bloqueou_saida_repique,
                                    'aceitou_batida_legitima', v_aceitou_depois);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $fn$;
  $body350$;

  RAISE NOTICE 'qa_caso_ponto_350 ancorado em dia passado (determinismo).';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Nao foi possivel ajustar qa_caso_ponto_350: %', SQLERRM;
END $qa350$;

-- ---------------------------------------------------------------------
-- PONTO-357 — Falso positivo: a busca casava com o nome do parâmetro
-- ---------------------------------------------------------------------
-- A rotina procurava o texto 'ajuste_id' em qualquer lugar do código de
-- processar_ajuste_ponto e encontrava o PARÂMETRO p_ajuste_id, acusando
-- coluna fantasma que não existe. Verificado: a função grava em colunas
-- reais (tenant_id, colaborador_*, data_marcacao, hora_marcacao,
-- tipo_marcacao, marcacao_original, created_by, hash_marcacao).
--
-- Passa a extrair a LISTA DE COLUNAS dos INSERT em ponto_marcacoes e a
-- conferir cada nome contra o esquema — sem depender de palavra solta.
DO $qa357$
BEGIN
  IF to_regclass('public.qa_retorno') IS NULL THEN
    RAISE NOTICE 'Motor de QA nao instalado: qa_caso_ponto_357 ignorado.';
    RETURN;
  END IF;

  EXECUTE $body357$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_357()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $fn$
DECLARE
  r public.qa_retorno;
  v_cpf text; v_ajuste_id uuid;
  v_status_pend text; v_status_final text;
  v_antes text; v_depois text;
  v_motivo_visivel boolean := false;
  v_col_fantasma text;
BEGIN
  v_cpf := public.qa_ponto_admissao('QA Rejeicao Ajuste', 3571);
  PERFORM public.qa_ponto_marca(v_cpf, 'QA Rejeicao Ajuste', CURRENT_DATE - 3, TIME '08:00', 'entrada');
  PERFORM public.qa_ponto_marca(v_cpf, 'QA Rejeicao Ajuste', CURRENT_DATE - 3, TIME '17:00', 'saida');

  SELECT string_agg(hora_marcacao::text, '|' ORDER BY hora_marcacao) INTO v_antes
  FROM public.ponto_marcacoes
  WHERE tenant_id = public.qa_sandbox_tenant_id()
    AND colaborador_cpf = v_cpf AND data_marcacao = CURRENT_DATE - 3;

  INSERT INTO public.ponto_ajustes
    (tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
     data_referencia, tipo_ajuste, motivo, status, hora_original, hora_solicitada)
  VALUES (public.qa_sandbox_tenant_id(), gen_random_uuid(), 'QA Rejeicao Ajuste', v_cpf,
          CURRENT_DATE - 3, 'correcao', 'QA: rejeicao deve deixar o dia intacto', 'pendente',
          TIME '08:00', TIME '07:30')
  RETURNING id INTO v_ajuste_id;

  r.passo_ordem := 1;
  r.passo_acao := 'Rejeitar o ajuste e conferir que o dia nao mudou';
  r.esperado := 'Status rejeitado, motivo visivel, marcacoes originais intactas';

  v_status_pend := 'ajuste_pendente';
  UPDATE public.ponto_ajustes
     SET status = 'rejeitado', observacao_aprovador = 'QA: rejeitado para teste'
   WHERE id = v_ajuste_id;

  SELECT status::text INTO v_status_final FROM public.ponto_ajustes WHERE id = v_ajuste_id;

  SELECT string_agg(hora_marcacao::text, '|' ORDER BY hora_marcacao) INTO v_depois
  FROM public.ponto_marcacoes
  WHERE tenant_id = public.qa_sandbox_tenant_id()
    AND colaborador_cpf = v_cpf AND data_marcacao = CURRENT_DATE - 3;

  SELECT (observacao_aprovador IS NOT NULL AND btrim(observacao_aprovador) <> '')
    INTO v_motivo_visivel
  FROM public.ponto_ajustes WHERE id = v_ajuste_id;

  r.passo_ordem := 2;
  r.passo_acao := 'AUDITORIA (somente leitura): o fluxo de APROVACAO grava em colunas reais?';
  r.esperado := 'Toda coluna citada nos INSERT em ponto_marcacoes existe na tabela';

  -- Extrai a lista de colunas de cada INSERT INTO public.ponto_marcacoes (...)
  -- e confere nome a nome. Nao usa busca por palavra solta: o parametro
  -- p_ajuste_id ja produziu falso positivo por esse caminho.
  WITH src AS (
    SELECT p.prosrc AS s
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'processar_ajuste_ponto'
    LIMIT 1
  ),
  listas AS (
    SELECT (regexp_matches(s, 'INSERT\s+INTO\s+public\.ponto_marcacoes\s*\(([^)]*)\)', 'gi'))[1] AS cols
    FROM src
  ),
  colunas AS (
    -- btrim padrao so tira espaco: a lista do INSERT vem com quebra de
    -- linha e tabulacao, entao a limpeza precisa cobrir todo espaco em branco.
    SELECT DISTINCT regexp_replace(unnest(string_to_array(cols, ',')), '\s', '', 'g') AS col
    FROM listas
  )
  SELECT string_agg(col, ', ' ORDER BY col) INTO v_col_fantasma
  FROM colunas
  WHERE col <> ''
    AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns ic
      WHERE ic.table_schema = 'public'
        AND ic.table_name = 'ponto_marcacoes'
        AND ic.column_name = colunas.col
    );

  IF v_status_final = 'rejeitado' AND v_antes IS NOT DISTINCT FROM v_depois
     AND v_motivo_visivel AND v_col_fantasma IS NULL THEN
    r.situacao := 'passou';
    r.obtido := 'Rejeicao integra: o ajuste ficou rejeitado, o motivo ficou registrado e as '
             || 'marcacoes originais nao mudaram um segundo. A aprovacao grava em colunas que '
             || 'existem — conferido pela lista de colunas do INSERT, nao por busca de texto.';
  ELSIF v_col_fantasma IS NOT NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: processar_ajuste_ponto grava em coluna(s) inexistente(s) em '
             || 'ponto_marcacoes: %s. Aprovar um ajuste por essa funcao quebra em execucao.',
             v_col_fantasma);
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('A rejeicao nao ficou integra (status %s; marcacoes antes %s, depois %s; '
             || 'motivo visivel: %s).', COALESCE(v_status_final,'?'), COALESCE(v_antes,'-'),
             COALESCE(v_depois,'-'), v_motivo_visivel);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $fn$;
  $body357$;

  RAISE NOTICE 'qa_caso_ponto_357 corrigido (falso positivo removido).';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Nao foi possivel corrigir qa_caso_ponto_357: %', SQLERRM;
END $qa357$;

-- ---------------------------------------------------------------------
-- PONTO-253 — Deixa de pedir conferência humana e passa a conferir
-- ---------------------------------------------------------------------
-- O veredito estava certo, mas terminava com "CONFIRA a coluna citada".
-- Agora a própria rotina verifica o que importa: existe o parâmetro de
-- retenção da geolocalização (dado acessório) E existe rotina que
-- executa o expurgo — configuração sem executor é decoração.
DO $qa253$
BEGIN
  IF to_regclass('public.qa_retorno') IS NULL THEN
    RAISE NOTICE 'Motor de QA nao instalado: qa_caso_ponto_253 ignorado.';
    RETURN;
  END IF;

  EXECUTE $body253$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_253()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $fn$
DECLARE
  r public.qa_retorno;
  v_param_geo boolean; v_executor text;
  v_com_geo int; v_geo_antiga int; v_total int; v_mais_antiga date;
BEGIN
  IF to_regclass('public.ponto_marcacoes') IS NULL THEN
    r.situacao := 'nao_implementado';
    r.obtido   := 'Tabela ponto_marcacoes nao existe nesta base.';
    RETURN r;
  END IF;

  r.passo_ordem := 1;
  r.passo_acao  := 'Conferir o parametro de retencao do dado ACESSORIO (geolocalizacao)';
  r.esperado    := 'Coluna de prazo especifica da geolocalizacao no cadastro de retencao';

  v_param_geo := public.qa_coluna_existe('ponto_retencao_config', 'geolocalizacao_dias');

  r.passo_ordem := 2;
  r.passo_acao  := 'Conferir que existe rotina que EXECUTA o expurgo';
  r.esperado    := 'Funcao de expurgo da geolocalizacao presente — parametro sem executor e decoracao';

  SELECT string_agg(p.proname, ', ' ORDER BY p.proname) INTO v_executor
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind = 'f'
    AND p.proname IN ('ponto_expurgar_geolocalizacao', 'ponto_expurgar_registros');

  r.passo_ordem := 3;
  r.passo_acao  := 'AUDITORIA (somente leitura): ha geolocalizacao retida ha mais de um ano';

  SELECT count(*),
         count(*) FILTER (WHERE latitude IS NOT NULL OR longitude IS NOT NULL),
         count(*) FILTER (WHERE (latitude IS NOT NULL OR longitude IS NOT NULL)
                            AND data_marcacao < CURRENT_DATE - 365),
         min(data_marcacao)
    INTO v_total, v_com_geo, v_geo_antiga, v_mais_antiga
  FROM public.ponto_marcacoes;

  IF v_param_geo AND v_executor IS NOT NULL AND v_geo_antiga = 0 THEN
    r.situacao := 'passou';
    r.obtido   := format('Retencao do dado acessorio conferida: ponto_retencao_config.'
               || 'geolocalizacao_dias define o prazo e %s executa o expurgo. Nenhuma '
               || 'geolocalizacao retida ha mais de um ano (%s com geo, de %s; mais antiga em %s).',
               v_executor, v_com_geo, v_total, COALESCE(v_mais_antiga::text, '-'));
  ELSIF NOT v_param_geo THEN
    r.situacao := 'falhou';
    r.obtido   := 'ACHADO: nao existe parametro de retencao especifico da geolocalizacao '
               || '(ponto_retencao_config.geolocalizacao_dias). Dado acessorio sem prazo proprio '
               || 'fica guardado pelo prazo do registro de jornada, que e muito maior.';
  ELSIF v_executor IS NULL THEN
    r.situacao := 'falhou';
    r.obtido   := 'ACHADO: o prazo de retencao da geolocalizacao existe, mas NENHUMA rotina '
               || 'executa o expurgo — configuracao decorativa. O dado acessorio fica guardado '
               || 'para sempre, independentemente do que o cadastro diz.';
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('ACHADO: %s marcacao(oes) com geolocalizacao retida ha mais de um ano '
               || '(mais antiga em %s). O expurgo existe mas nao esta alcancando esses registros.',
               v_geo_antiga, COALESCE(v_mais_antiga::text, '-'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $fn$;
  $body253$;

  RAISE NOTICE 'qa_caso_ponto_253 corrigido (ressalva substituida por verificacao).';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Nao foi possivel corrigir qa_caso_ponto_253: %', SQLERRM;
END $qa253$;
