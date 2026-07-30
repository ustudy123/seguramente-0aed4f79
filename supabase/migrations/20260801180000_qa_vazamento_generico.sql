-- =========================================================
-- QA — Detector genérico de vazamento + relatorio compacto (01/08/2026)
--
-- PROBLEMA 1 — o detector envelhece a cada modulo novo.
-- Duas vezes em tres dias a mesma coisa aconteceu: rotinas novas passaram a
-- escrever em tabelas que o detector nao vigiava. Primeiro admissoes e
-- documento_pastas; depois admissao_documentos. Emendar mais uma linha na
-- lista resolveria hoje e falharia de novo no proximo modulo.
--
-- SOLUCAO: em vez de enumerar tabelas, o detector passa a VARRER todas as
-- tabelas de public que tenham coluna tenant_id, contar linhas no tenant do
-- cercado e comparar contra uma LINHA DE BASE MEDIDA — nao adivinhada.
-- Tabela que nao esteja na linha de base espera zero. Assim, tabela nova
-- entra na vigilancia automaticamente, e manutencao vira excecao.
--
-- A linha de base e capturada por qa_mobiliario_registrar(), que deve ser
-- executada UMA VEZ com o cercado no estado limpo. Ela mede o que existe
-- (as 2 empresas fixas e as pastas delas) e guarda como esperado. Se um dia
-- o mobiliario fixo mudar, roda de novo.
--
-- PROBLEMA 2 — o relatorio nao cabe na tela.
-- As consultas de falha devolviam base_legal e obtido inteiros, o que no
-- editor SQL vira um paredao dificil de copiar. Agora sao duas camadas:
--   qa_relatorio_falhas()  -> compacto, so o essencial, feito para copiar
--   qa_caso_detalhe(codigo) -> o texto completo de UM caso, quando precisar
--
-- SAIDA CURTA POR PADRAO: numa rodada limpa, o detector devolve UMA linha
-- de resumo em vez de cinco. So aparece detalhe quando ha o que investigar.
-- =========================================================

-- ─────────────────────────────────────────────────────────
-- 0) Higiene de travas
--
-- Falhar rapido e melhor que esperar: se outra transacao estiver segurando
-- as tabelas de QA (a bateria agendada por pg_cron chama qa_rodar_bateria,
-- que le qa_casos_teste e, no fim, qa_verifica_vazamento), esta migration
-- devolve erro claro em 5 segundos em vez de disputar trava e cair em
-- deadlock.
SET lock_timeout = '5s';

-- Dependencia: base_legal vem da migration de Desligamento. Declarada aqui
-- para nao depender da ordem de aplicacao — MAS so quando de fato faltar.
-- ALTER TABLE toma AccessExclusiveLock mesmo quando o IF NOT EXISTS nao faz
-- nada, e qa_casos_teste e lida pela bateria: travar a toa foi exatamente a
-- causa do deadlock em 29/07/2026.
DO $dep$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'qa_casos_teste'
      AND column_name  = 'base_legal'
  ) THEN
    ALTER TABLE public.qa_casos_teste ADD COLUMN base_legal text;
    RAISE NOTICE 'Coluna base_legal criada.';
  ELSE
    RAISE NOTICE 'Coluna base_legal ja existe — nenhuma trava tomada.';
  END IF;
END $dep$;

-- ─────────────────────────────────────────────────────────
-- 1) Linha de base do mobiliario fixo
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.qa_mobiliario_fixo (
  tabela        text PRIMARY KEY,
  esperado      bigint NOT NULL,
  registrado_em timestamptz NOT NULL DEFAULT now(),
  motivo        text
);

COMMENT ON TABLE public.qa_mobiliario_fixo IS
  'Linha de base do cercado: quantas linhas cada tabela deve ter quando nada '
  'esta rodando. Medida por qa_mobiliario_registrar() com o cercado limpo, '
  'nunca digitada a mao. Tabela ausente daqui espera zero.';

-- CERCA — mesmo padrao das demais tabelas de QA, definido em
-- 20260717010000_qa_cercas_das_tabelas_qa.sql. RLS sozinha NAO basta: cerca
-- sem regra nega ate para o superadmin, e a propria migration de cercas ja
-- sinaliza esse estado como defeito ("CERCA SEM REGRA"). Como
-- qa_verifica_vazamento roda como invocador, e nao com SECURITY DEFINER,
-- ligar RLS sem politica faria a funcao ler zero linhas e responder
-- "nenhuma linha de base registrada" — quebrada em silencio.
DO $cerca$
BEGIN
  IF to_regprocedure('public.is_superadmin(uuid)') IS NULL THEN
    RAISE EXCEPTION 'is_superadmin(uuid) nao existe. Sem ela nao da para escrever a regra.';
  END IF;

  ALTER TABLE public.qa_mobiliario_fixo ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "QA e ferramenta interna: apenas superadmin"
    ON public.qa_mobiliario_fixo;

  CREATE POLICY "QA e ferramenta interna: apenas superadmin"
    ON public.qa_mobiliario_fixo FOR ALL
    USING (public.is_superadmin(auth.uid()))
    WITH CHECK (public.is_superadmin(auth.uid()));

  RAISE NOTICE 'Cerca fechada em public.qa_mobiliario_fixo (apenas superadmin).';
END $cerca$;

CREATE OR REPLACE FUNCTION public.qa_mobiliario_registrar()
RETURNS TABLE(tabela text, esperado bigint)
LANGUAGE plpgsql
AS $$
DECLARE
  v_t uuid := public.qa_sandbox_tenant_id();
  c   record;
  v_n bigint;
BEGIN
  IF v_t IS NULL THEN
    RAISE EXCEPTION 'Cercado nao existe. Nao da para medir a linha de base.';
  END IF;

  DELETE FROM public.qa_mobiliario_fixo;

  FOR c IN
    SELECT col.table_name
    FROM information_schema.columns col
    JOIN information_schema.tables t
      ON t.table_schema = col.table_schema AND t.table_name = col.table_name
    WHERE col.table_schema = 'public'
      AND col.column_name  = 'tenant_id'
      AND t.table_type     = 'BASE TABLE'
      AND col.table_name NOT LIKE 'qa\_%'
    ORDER BY col.table_name
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE tenant_id = $1', c.table_name)
      INTO v_n USING v_t;

    IF v_n > 0 THEN
      INSERT INTO public.qa_mobiliario_fixo (tabela, esperado, motivo)
      VALUES (c.table_name, v_n, 'Medido com o cercado em repouso');
    END IF;
  END LOOP;

  RETURN QUERY
  SELECT m.tabela, m.esperado FROM public.qa_mobiliario_fixo m ORDER BY m.tabela;
END $$;

COMMENT ON FUNCTION public.qa_mobiliario_registrar() IS
  'Executar UMA VEZ com o cercado limpo, e novamente sempre que o mobiliario '
  'fixo mudar. Mede o estado de repouso e o grava como linha de base.';

-- ─────────────────────────────────────────────────────────
-- 2) Detector generico
-- ─────────────────────────────────────────────────────────
-- O tipo de retorno pode diferir da versao anterior (nomes das colunas OUT),
-- e CREATE OR REPLACE nao permite isso. DROP primeiro, sem risco: a funcao
-- nao guarda estado, so le.
DROP FUNCTION IF EXISTS public.qa_verifica_vazamento();

CREATE OR REPLACE FUNCTION public.qa_verifica_vazamento()
RETURNS TABLE(o_que text, encontrado bigint, esperado bigint, veredito text)
LANGUAGE plpgsql
AS $$
DECLARE
  v_t         uuid := public.qa_sandbox_tenant_id();
  c           record;
  v_n         bigint;
  v_esperado  bigint;
  v_varridas  int := 0;
  v_problemas int := 0;
  v_base      int;
BEGIN
  IF v_t IS NULL THEN
    RETURN QUERY SELECT 'cercado'::text, 0::bigint, 0::bigint,
      '>>> O cercado nao existe — nao ha o que verificar'::text;
    RETURN;
  END IF;

  SELECT count(*) INTO v_base FROM public.qa_mobiliario_fixo;
  IF v_base = 0 THEN
    RETURN QUERY SELECT 'linha de base'::text, 0::bigint, 0::bigint,
      '>>> Nenhuma linha de base registrada. Rode SELECT * FROM qa_mobiliario_registrar() com o cercado limpo.'::text;
    RETURN;
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS qa_vaz_tmp
    (o_que text, encontrado bigint, esperado bigint, veredito text) ON COMMIT DROP;
  DELETE FROM qa_vaz_tmp;

  FOR c IN
    SELECT col.table_name
    FROM information_schema.columns col
    JOIN information_schema.tables t
      ON t.table_schema = col.table_schema AND t.table_name = col.table_name
    WHERE col.table_schema = 'public'
      AND col.column_name  = 'tenant_id'
      AND t.table_type     = 'BASE TABLE'
      AND col.table_name NOT LIKE 'qa\_%'
    ORDER BY col.table_name
  LOOP
    v_varridas := v_varridas + 1;

    EXECUTE format('SELECT count(*) FROM public.%I WHERE tenant_id = $1', c.table_name)
      INTO v_n USING v_t;

    SELECT m.esperado INTO v_esperado
    FROM public.qa_mobiliario_fixo m WHERE m.tabela = c.table_name;
    v_esperado := COALESCE(v_esperado, 0);

    IF v_n <> v_esperado THEN
      v_problemas := v_problemas + 1;
      INSERT INTO qa_vaz_tmp VALUES (
        c.table_name, v_n, v_esperado,
        CASE
          WHEN v_esperado = 0 THEN '>>> VAZOU — rotina deixou dado nesta tabela'
          WHEN v_n > v_esperado THEN '>>> SOBROU alem do mobiliario fixo'
          ELSE '>>> FALTA — alguma rotina apagou mobiliario fixo'
        END);
    END IF;
  END LOOP;

  IF v_problemas = 0 THEN
    RETURN QUERY SELECT
      format('%s tabelas varridas', v_varridas)::text,
      0::bigint, 0::bigint,
      'limpo — nada fora do mobiliario fixo'::text;
  ELSE
    RETURN QUERY SELECT
      format('%s tabelas varridas, %s com problema', v_varridas, v_problemas)::text,
      v_problemas::bigint, 0::bigint,
      '>>> VER LINHAS ABAIXO'::text;
    RETURN QUERY SELECT * FROM qa_vaz_tmp ORDER BY 1;
  END IF;
END $$;

COMMENT ON FUNCTION public.qa_verifica_vazamento() IS
  'Varre TODA tabela de public com coluna tenant_id e compara com a linha de '
  'base de qa_mobiliario_fixo. Tabela nova entra na vigilancia sozinha — nao '
  'precisa mais estender esta funcao a cada modulo. Rodada limpa devolve uma '
  'unica linha de resumo.';

-- ─────────────────────────────────────────────────────────
-- 3) Relatorio compacto, feito para copiar
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_relatorio_falhas(p_modulo text DEFAULT NULL)
RETURNS TABLE(codigo text, prio text, situacao text, achado text)
LANGUAGE sql STABLE
AS $$
  SELECT r.codigo,
         left(ct.prioridade::text, 4)                AS prio,
         left(r.situacao::text, 6)                   AS situacao,
         left(regexp_replace(COALESCE(r.obtido,''), '\s+', ' ', 'g'), 110) AS achado
  FROM public.qa_resultados r
  JOIN public.qa_casos_teste ct ON ct.codigo = r.codigo
  JOIN public.qa_modulos m      ON m.id = ct.modulo_id
  WHERE r.execucao_id = (
          SELECT e.id FROM public.qa_execucoes e
          WHERE p_modulo IS NULL OR e.modulo_path = p_modulo
          ORDER BY e.iniciada_em DESC LIMIT 1)
    AND r.situacao IN ('falhou','erro')
  ORDER BY CASE ct.prioridade WHEN 'critica' THEN 1 WHEN 'alta' THEN 2
                              WHEN 'media' THEN 3 ELSE 4 END, r.codigo;
$$;

COMMENT ON FUNCTION public.qa_relatorio_falhas(text) IS
  'Relatorio enxuto da ultima bateria: quatro colunas estreitas, feitas para '
  'copiar do editor SQL sem virar paredao. Para o texto completo de um caso, '
  'usar qa_caso_detalhe(codigo).';

CREATE OR REPLACE FUNCTION public.qa_caso_detalhe(p_codigo text)
RETURNS TABLE(campo text, conteudo text)
LANGUAGE sql STABLE
AS $$
  SELECT 'codigo',      ct.codigo             FROM public.qa_casos_teste ct WHERE ct.codigo = p_codigo
  UNION ALL SELECT 'titulo',     ct.titulo    FROM public.qa_casos_teste ct WHERE ct.codigo = p_codigo
  UNION ALL SELECT 'prioridade', ct.prioridade::text FROM public.qa_casos_teste ct WHERE ct.codigo = p_codigo
  UNION ALL SELECT 'nivel',      ct.nivel     FROM public.qa_casos_teste ct WHERE ct.codigo = p_codigo
  UNION ALL SELECT 'base_legal', COALESCE(ct.base_legal,'(regra de produto, sem base legal)')
                                              FROM public.qa_casos_teste ct WHERE ct.codigo = p_codigo
  UNION ALL SELECT 'objetivo',   COALESCE(ct.objetivo,'') FROM public.qa_casos_teste ct WHERE ct.codigo = p_codigo
  UNION ALL SELECT 'achado', COALESCE((
              SELECT r.obtido FROM public.qa_resultados r
              JOIN public.qa_execucoes e ON e.id = r.execucao_id
              WHERE r.codigo = p_codigo
              ORDER BY e.iniciada_em DESC LIMIT 1),
            '(sem execucao registrada)')
  ORDER BY 1;
$$;

COMMENT ON FUNCTION public.qa_caso_detalhe(text) IS
  'Abre UM caso em formato vertical: cada campo numa linha. Serve para levar '
  'o achado completo, com fundamentacao, para o card do desenvolvimento.';

-- ─────────────────────────────────────────────────────────
-- 4) Primeira medicao da linha de base
--    Roda agora porque o cercado esta comprovadamente limpo — a ultima
--    verificacao devolveu limpo nas cinco tabelas antigas.
-- ─────────────────────────────────────────────────────────
SELECT * FROM public.qa_mobiliario_registrar();

-- Conferencia imediata: deve devolver uma unica linha de resumo.
SELECT * FROM public.qa_verifica_vazamento();
