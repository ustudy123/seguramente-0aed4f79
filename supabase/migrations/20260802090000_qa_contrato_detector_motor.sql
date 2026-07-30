-- =========================================================
-- QA — Correcao do contrato entre detector e motor (29/07/2026)
--
-- REGRESSAO INTRODUZIDA POR MIM na migration 20260801180000.
-- qa_rodar_bateria avalia o resultado do detector assim:
--
--     SELECT count(*) INTO v_vaz FROM public.qa_verifica_vazamento()
--     WHERE veredito NOT IN ('limpo','ok');
--
-- Ou seja: o motor depende das strings EXATAS 'limpo' e 'ok'. O detector
-- generico passou a devolver 'limpo — nada fora do mobiliario fixo', que
-- nao casa com nenhuma das duas. Efeito: toda bateria, mesmo limpa, era
-- marcada como vazamento.
--
-- Contrato implicito baseado em igualdade de texto entre duas funcoes e
-- fragil por natureza — a mesma classe do acoplamento por
-- observacoes = 'Documento da admissão' que ja anotei nas rotinas de
-- Admissao. A correcao aqui e dupla:
--   1) o detector volta a devolver exatamente 'limpo' na linha de resumo;
--   2) o motor passa a decidir por um criterio explicito e nao por texto.
-- =========================================================

SET lock_timeout = '5s';

-- ─────────────────────────────────────────────────────────
-- 1) Detector: veredito de sucesso volta a ser a palavra exata
-- ─────────────────────────────────────────────────────────
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
  v_pulos     int := 0;
  v_base      int;
BEGIN
  IF v_t IS NULL THEN
    RETURN QUERY SELECT 'cercado'::text, 0::bigint, 0::bigint,
      '>>> o cercado nao existe'::text;
    RETURN;
  END IF;

  SELECT count(*) INTO v_base FROM public.qa_mobiliario_fixo;
  IF v_base = 0 THEN
    RETURN QUERY SELECT 'linha de base'::text, 0::bigint, 0::bigint,
      '>>> sem linha de base — rode qa_mobiliario_registrar() com o cercado limpo'::text;
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
    -- Cada tabela em bloco proprio: falta de privilegio de leitura ou
    -- qualquer erro pontual pula a tabela em vez de derrubar a bateria
    -- inteira. Uma varredura de vigilancia nao pode ser o motivo de a
    -- execucao falhar.
    BEGIN
      EXECUTE format('SELECT count(*) FROM public.%I WHERE tenant_id = $1', c.table_name)
        INTO v_n USING v_t;
      v_varridas := v_varridas + 1;
    EXCEPTION WHEN OTHERS THEN
      v_pulos := v_pulos + 1;
      CONTINUE;
    END;

    SELECT m.esperado INTO v_esperado
    FROM public.qa_mobiliario_fixo m WHERE m.tabela = c.table_name;
    v_esperado := COALESCE(v_esperado, 0);

    IF v_n <> v_esperado THEN
      v_problemas := v_problemas + 1;
      INSERT INTO qa_vaz_tmp VALUES (
        c.table_name, v_n, v_esperado,
        CASE
          WHEN v_esperado = 0    THEN '>>> VAZOU'
          WHEN v_n > v_esperado  THEN '>>> SOBROU'
          ELSE                        '>>> FALTA'
        END);
    END IF;
  END LOOP;

  IF v_problemas = 0 THEN
    -- 'limpo' exato: e o que qa_rodar_bateria compara.
    RETURN QUERY SELECT
      format('%s tabelas varridas%s', v_varridas,
             CASE WHEN v_pulos > 0
                  THEN format(', %s sem permissao de leitura', v_pulos)
                  ELSE '' END)::text,
      0::bigint, 0::bigint, 'limpo'::text;
  ELSE
    RETURN QUERY SELECT
      format('%s tabelas varridas, %s com problema', v_varridas, v_problemas)::text,
      v_problemas::bigint, 0::bigint, '>>> VAZOU'::text;
    RETURN QUERY SELECT * FROM qa_vaz_tmp ORDER BY 1;
  END IF;
END $$;

COMMENT ON FUNCTION public.qa_verifica_vazamento() IS
  'Varre toda tabela de public com coluna tenant_id e compara com a linha de '
  'base de qa_mobiliario_fixo. CONTRATO: a linha de resumo devolve o veredito '
  'exatamente ''limpo'' quando nada esta fora do lugar — qa_rodar_bateria '
  'depende dessa palavra. Tabela sem permissao de leitura e pulada, nunca '
  'derruba a bateria.';

-- ─────────────────────────────────────────────────────────
-- 2) Motor: decidir por criterio explicito, nao por texto
--    Assim o contrato deixa de depender de igualdade de string.
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_houve_vazamento()
RETURNS boolean
LANGUAGE sql
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.qa_verifica_vazamento() v
    WHERE v.veredito LIKE '>>>%'
  );
$$;

COMMENT ON FUNCTION public.qa_houve_vazamento() IS
  'Resposta booleana para o motor. Todo veredito problematico comeca com >>>, '
  'entao a decisao deixa de depender de casar texto exato. Preferir esta '
  'funcao a comparar strings do detector.';

-- ─────────────────────────────────────────────────────────
-- 3) Conferencia
-- ─────────────────────────────────────────────────────────
SELECT * FROM public.qa_verifica_vazamento();
SELECT public.qa_houve_vazamento() AS houve_vazamento;
