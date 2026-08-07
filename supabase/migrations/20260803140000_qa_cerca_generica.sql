-- =========================================================
-- QA — Cerca genérica do cercado (31/07/2026)
--
-- ACHADO: a trava qa_guarda_cercado estava instalada em 8 tabelas, de uma
-- lista escrita a mao dentro de um VALUES na migration de 16/07. O sistema
-- tem 298 tabelas com tenant_id. As 29 tabelas de ponto — ponto_marcacoes,
-- ponto_diario, ponto_banco_horas, ponto_fechamentos e as demais — nao
-- tinham protecao nenhuma.
--
-- E o mesmo problema de lista estatica que o detector de vazamento tinha,
-- porem do lado da PREVENCAO, que e o lado que importa mais: o detector
-- avisa depois que o dado vazou; a trava impede antes. Escrever rotina de
-- ponto sem fechar isto seria aceitar que um erro de tenant numa rotina de
-- teste grave marcacao em ponto de cliente real.
--
-- CUSTO MEDIDO ANTES DE DECIDIR, e nao suposto:
--   50.000 inserts sem trava .... 381 ms
--   50.000 inserts com trava .... 470 ms
--   diferenca ................... 1,8 microssegundo por linha
-- Num insert puro, sem indice, FK ou RLS — ou seja, o pior caso relativo.
-- Numa importacao de 10 mil colaboradores, 18 ms. Aceitavel.
--
-- DESENHO: em vez de enumerar tabelas, instala a trava em TODA tabela de
-- public com coluna tenant_id. Tabela nova entra na protecao sozinha,
-- bastando rodar qa_instalar_cercas() de novo — e o qa_cercas_faltando()
-- avisa quando isso e necessario.
-- =========================================================

SET lock_timeout = '10s';

-- ─────────────────────────────────────────────────────────
-- 1) Instalador
-- ─────────────────────────────────────────────────────────
-- DROP antes: os nomes das colunas de retorno mudaram, e CREATE OR REPLACE
-- nao permite alterar o tipo de retorno.
DROP FUNCTION IF EXISTS public.qa_instalar_cercas();

CREATE OR REPLACE FUNCTION public.qa_instalar_cercas()
RETURNS TABLE(nome_tabela text, acao text)
LANGUAGE plpgsql
AS $$
DECLARE
  c        record;
  v_tinha  boolean;
  v_novas  int := 0;
  v_ja     int := 0;
BEGIN
  IF to_regprocedure('public.qa_bloqueia_fora_do_cercado()') IS NULL THEN
    RAISE EXCEPTION 'qa_bloqueia_fora_do_cercado() nao existe — rode as migrations do cercado antes.';
  END IF;

  FOR c IN
    SELECT col.table_name
    FROM information_schema.columns col
    JOIN information_schema.tables t
      ON t.table_schema = col.table_schema AND t.table_name = col.table_name
    WHERE col.table_schema = 'public'
      AND col.column_name  = 'tenant_id'
      AND t.table_type     = 'BASE TABLE'
      AND col.table_name NOT LIKE 'qa\_%'   -- as tabelas do proprio QA ficam de fora
    ORDER BY col.table_name
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_trigger tg
      WHERE tg.tgname = 'qa_guarda_cercado'
        AND tg.tgrelid = ('public.' || quote_ident(c.table_name))::regclass
        AND NOT tg.tgisinternal
    ) INTO v_tinha;

    IF NOT v_tinha THEN
      EXECUTE format(
        'CREATE TRIGGER qa_guarda_cercado
           BEFORE INSERT OR UPDATE OR DELETE ON public.%I
           FOR EACH ROW EXECUTE FUNCTION public.qa_bloqueia_fora_do_cercado()',
        c.table_name);
      v_novas := v_novas + 1;
      nome_tabela := c.table_name; acao := 'trava instalada'; RETURN NEXT;
    ELSE
      v_ja := v_ja + 1;
    END IF;

    -- ON CONFLICT nomeando a coluna colidiria com o parametro de saida.
    INSERT INTO public.qa_tabelas_protegidas AS p (tabela, motivo)
    SELECT c.table_name, 'Cerca generica: tabela tem tenant_id'
    WHERE NOT EXISTS (SELECT 1 FROM public.qa_tabelas_protegidas x
                      WHERE x.tabela = c.table_name);
  END LOOP;

  nome_tabela := format('%s tabela(s) ja protegida(s), %s nova(s)', v_ja, v_novas);
  acao        := 'resumo';
  RETURN NEXT;
END $$;

COMMENT ON FUNCTION public.qa_instalar_cercas() IS
  'Instala qa_guarda_cercado em toda tabela de public com coluna tenant_id. '
  'Substitui a lista escrita a mao. Rodar novamente sempre que tabelas novas '
  'forem criadas — ou deixar que qa_cercas_faltando() avise.';

-- ─────────────────────────────────────────────────────────
-- 2) Vigia da propria cerca
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_cercas_faltando()
RETURNS TABLE(tabela text)
LANGUAGE sql STABLE
AS $$
  SELECT col.table_name::text
  FROM information_schema.columns col
  JOIN information_schema.tables t
    ON t.table_schema = col.table_schema AND t.table_name = col.table_name
  WHERE col.table_schema = 'public'
    AND col.column_name  = 'tenant_id'
    AND t.table_type     = 'BASE TABLE'
    AND col.table_name NOT LIKE 'qa\_%'
    AND NOT EXISTS (
      SELECT 1 FROM pg_trigger tg
      WHERE tg.tgname = 'qa_guarda_cercado'
        AND tg.tgrelid = ('public.' || quote_ident(col.table_name))::regclass
        AND NOT tg.tgisinternal)
  ORDER BY 1;
$$;

COMMENT ON FUNCTION public.qa_cercas_faltando() IS
  'Tabelas com tenant_id que NAO tem a trava do cercado. Deve devolver vazio. '
  'Qualquer linha aqui e caminho por onde uma rotina de teste com erro de '
  'tenant escreveria em dado de cliente real.';

-- ─────────────────────────────────────────────────────────
-- 3) Instalar agora
-- ─────────────────────────────────────────────────────────
SELECT nome_tabela AS resultado FROM public.qa_instalar_cercas() WHERE acao = 'resumo';

-- ─────────────────────────────────────────────────────────
-- 4) Conferencia: nao pode sobrar tabela sem trava
-- ─────────────────────────────────────────────────────────
DO $confere$
DECLARE v_faltam int; v_total int;
BEGIN
  SELECT count(*) INTO v_faltam FROM public.qa_cercas_faltando();
  SELECT count(*) INTO v_total  FROM public.qa_tabelas_protegidas;

  IF v_faltam = 0 THEN
    RAISE NOTICE 'OK: % tabela(s) protegida(s), nenhuma descoberta.', v_total;
  ELSE
    RAISE WARNING '% tabela(s) ainda SEM trava do cercado.', v_faltam;
  END IF;
END $confere$;

-- Confirma que as tabelas de ponto entraram
SELECT count(*) FILTER (WHERE tabela LIKE 'ponto\_%')   AS tabelas_de_ponto_protegidas,
       count(*) FILTER (WHERE tabela LIKE 'jornada\_%') AS tabelas_de_jornada_protegidas,
       count(*)                                          AS total_protegidas
FROM public.qa_tabelas_protegidas;

SELECT * FROM public.qa_cercas_faltando();
