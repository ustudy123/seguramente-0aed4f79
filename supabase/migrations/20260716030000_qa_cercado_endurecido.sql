-- =========================================================
-- QA — Endurecimento do cercado
--
-- POR QUE ISTO EXISTE:
--
-- A Fase 1 criou qa_assert_sandbox(): uma função que o robô CHAMA antes de
-- escrever. Isso é um cinto de segurança que só funciona se o motorista
-- lembrar de colocar. Se uma rotina de teste esquecer de chamar, nada
-- impede a escrita.
--
-- É exatamente o mesmo defeito do ON CONFLICT DO NOTHING da trigger
-- auto_vincular_admins_nova_empresa: uma guarda que LÊ como proteção e não
-- protege, porque depende de algo que não existe.
--
-- Esta migration inverte isso: em vez do robô prometer se comportar, o
-- BANCO RECUSA. Quando o modo de teste está ligado, qualquer escrita fora
-- do cercado estoura e a transação inteira aborta — não importa o que a
-- rotina do robô mande fazer, nem que ela tenha bug.
--
-- TAMBÉM CORRIGE: as empresas sintéticas nasceram com CNPJ 00.000.000/0001-91
-- e /0002-72. O primeiro é o CNPJ REAL do Banco do Brasil S.A., ativo na
-- Receita Federal. Trocados por 99.999.999/0001-91 e /0002-72 — válidos nos
-- dígitos verificadores (o sistema valida CNPJ em EmpresaDadosBasicos) e
-- obviamente sintéticos.
-- =========================================================

-- ─────────────────────────────────────────────────────────
-- 1) TIRAR O BANCO DO BRASIL DE DENTRO DO SISTEMA
-- ─────────────────────────────────────────────────────────
UPDATE public.empresa_cadastro
SET cnpj = '99999999000191'
WHERE tenant_id = public.qa_sandbox_tenant_id()
  AND cnpj = '00000000000191';

UPDATE public.empresa_cadastro
SET cnpj = '99999999000272'
WHERE tenant_id = public.qa_sandbox_tenant_id()
  AND cnpj = '00000000000272';

-- ─────────────────────────────────────────────────────────
-- 2) O MODO DE TESTE — que morre sozinho
--
-- set_config(..., true) marca a variável como LOCAL: ela existe só dentro
-- da transação atual e some no COMMIT ou no ROLLBACK. Não há como o modo
-- "vazar" e ficar ligado. Não há como esquecer de desligar.
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_modo_ligar()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('app.qa_modo', 'on', true);  -- true = morre com a transação
END $$;

COMMENT ON FUNCTION public.qa_modo_ligar() IS
  'Liga o modo de teste APENAS na transacao atual. A partir daqui, qualquer escrita fora do cercado e recusada pelo banco. Some sozinho no COMMIT/ROLLBACK.';

CREATE OR REPLACE FUNCTION public.qa_modo_ligado()
RETURNS boolean
LANGUAGE sql STABLE
AS $$ SELECT COALESCE(current_setting('app.qa_modo', true), 'off') = 'on' $$;

-- ─────────────────────────────────────────────────────────
-- 3) A TRAVA DE VERDADE
--
-- Custo fora do modo de teste: uma leitura de variável de sessão por linha.
-- Sai antes de qualquer outra coisa. Em produção normal é ruído.
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_bloqueia_fora_do_cercado()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant  uuid;
  v_sandbox uuid;
BEGIN
  -- Fora do modo de teste esta trava não existe.
  IF COALESCE(current_setting('app.qa_modo', true), 'off') <> 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_tenant := (to_jsonb(OLD) ->> 'tenant_id')::uuid;
  ELSE
    v_tenant := (to_jsonb(NEW) ->> 'tenant_id')::uuid;
  END IF;

  v_sandbox := public.qa_sandbox_tenant_id();

  IF v_tenant IS DISTINCT FROM v_sandbox THEN
    RAISE EXCEPTION
      'QA BLOQUEADO: modo de teste ligado. Operacao % em %.% tentou tocar o tenant %. Permitido apenas o cercado (%). Transacao abortada, nada foi gravado.',
      TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME,
      COALESCE(v_tenant::text, '(nulo)'), COALESCE(v_sandbox::text, '(cercado nao existe)');
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;

COMMENT ON FUNCTION public.qa_bloqueia_fora_do_cercado() IS
  'Trava real do robo de QA. NAO depende de a rotina de teste lembrar de chamar nada — o banco recusa sozinho. Inerte fora do modo de teste.';

-- ─────────────────────────────────────────────────────────
-- 4) ONDE A TRAVA FICA — e o registro explícito disso
--
-- Regra: toda tabela que um caso de teste toque PRECISA estar aqui.
-- Os 23 casos de Colaboradores tocam três.
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.qa_tabelas_protegidas (
  tabela       text PRIMARY KEY,
  motivo       text NOT NULL,
  protegida_em timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.qa_tabelas_protegidas IS
  'Tabelas onde a trava do cercado esta instalada. Ao documentar um modulo novo, toda tabela que ele tocar entra aqui ANTES da primeira rotina rodar.';

DO $trava$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT * FROM (VALUES
      ('usuarios_base',     'A pessoa. Casos COLAB-001, 020, 021, 023, 033, 034, 035, 036.'),
      ('usuario_vinculos',  'O vinculo. Casos COLAB-012, 025, 026, 027, 028, 029, 037.'),
      ('empresa_cadastro',  'A empresa. Cercado precisa de Alfa e Beta para o COLAB-026.')
    ) AS x(tabela, motivo)
  LOOP
    IF to_regclass('public.' || t.tabela) IS NULL THEN
      RAISE EXCEPTION 'Tabela public.% nao existe.', t.tabela;
    END IF;

    EXECUTE format('DROP TRIGGER IF EXISTS qa_guarda_cercado ON public.%I', t.tabela);
    EXECUTE format(
      'CREATE TRIGGER qa_guarda_cercado
         BEFORE INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.qa_bloqueia_fora_do_cercado()',
      t.tabela);

    INSERT INTO public.qa_tabelas_protegidas (tabela, motivo)
    VALUES (t.tabela, t.motivo)
    ON CONFLICT (tabela) DO UPDATE SET motivo = EXCLUDED.motivo;

    RAISE NOTICE 'Trava instalada em public.%', t.tabela;
  END LOOP;
END $trava$;

-- ─────────────────────────────────────────────────────────
-- 5) O DETECTOR — porque toda prevenção tem furo
--
-- A trava impede. Isto CONFERE depois. Se alguma bateria criou qualquer
-- coisa fora do cercado, aparece aqui e a execucao e marcada contaminada.
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_verifica_contaminacao(p_execucao_id uuid)
RETURNS TABLE(tabela text, linhas_fora_do_cercado bigint)
LANGUAGE plpgsql
AS $$
DECLARE
  v_ini timestamptz;
  v_fim timestamptz;
  v_sandbox uuid;
  t record;
  n bigint;
BEGIN
  SELECT iniciada_em, COALESCE(terminada_em, now())
    INTO v_ini, v_fim
  FROM public.qa_execucoes WHERE id = p_execucao_id;

  IF v_ini IS NULL THEN
    RAISE EXCEPTION 'Execucao % nao encontrada.', p_execucao_id;
  END IF;

  v_sandbox := public.qa_sandbox_tenant_id();

  FOR t IN SELECT qtp.tabela FROM public.qa_tabelas_protegidas qtp LOOP
    EXECUTE format(
      'SELECT count(*) FROM public.%I
        WHERE created_at >= $1 AND created_at <= $2 AND tenant_id IS DISTINCT FROM $3',
      t.tabela)
    INTO n USING v_ini, v_fim, v_sandbox;

    IF n > 0 THEN
      tabela := t.tabela;
      linhas_fora_do_cercado := n;
      RETURN NEXT;
    END IF;
  END LOOP;
END $$;

COMMENT ON FUNCTION public.qa_verifica_contaminacao(uuid) IS
  'Roda DEPOIS de cada bateria. Se voltar qualquer linha, algo escapou do cercado e a bateria e invalida. Prevencao falha em silencio; deteccao nao.';

-- ─────────────────────────────────────────────────────────
-- 6) PROVA — a trava funciona? Testa a si mesma e desfaz.
-- ─────────────────────────────────────────────────────────
DO $prova$
DECLARE
  v_outro  uuid;
  v_pegou  boolean := false;
BEGIN
  SELECT id INTO v_outro FROM public.tenants
  WHERE slug <> 'qa-sandbox' AND ativo LIMIT 1;

  IF v_outro IS NULL THEN
    RAISE NOTICE 'PROVA PULADA: nao ha outro tenant para tentar invadir.';
    RETURN;
  END IF;

  BEGIN
    PERFORM public.qa_modo_ligar();
    -- Tentativa deliberada de escrever num cliente real. Tem que ser recusada.
    INSERT INTO public.empresa_cadastro (tenant_id, razao_social, nome_fantasia)
    VALUES (v_outro, '[QA] INVASAO QUE NAO PODE ACONTECER', '[QA] INVASAO');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%QA BLOQUEADO%' THEN
      v_pegou := true;
    ELSE
      RAISE;
    END IF;
  END;

  IF v_pegou THEN
    RAISE NOTICE 'PROVA OK: a trava recusou uma escrita num tenant real.';
  ELSE
    RAISE EXCEPTION 'PROVA FALHOU: a trava DEIXOU passar escrita fora do cercado. Nao rode robo nenhum.';
  END IF;
END $prova$;

-- ─────────────────────────────────────────────────────────
-- Conferência
-- ─────────────────────────────────────────────────────────
SELECT 'Banco do Brasil removido' AS item,
       CASE WHEN EXISTS (SELECT 1 FROM public.empresa_cadastro WHERE cnpj = '00000000000191')
            THEN '>>> AINDA PRESENTE' ELSE 'sim — nenhum CNPJ do BB na base' END AS valor
UNION ALL
SELECT 'CNPJ do cercado agora',
       (SELECT string_agg(cnpj, ', ' ORDER BY cnpj) FROM public.empresa_cadastro
        WHERE tenant_id = public.qa_sandbox_tenant_id())
UNION ALL
SELECT 'travas instaladas',
       (SELECT count(*)::text FROM pg_trigger WHERE tgname = 'qa_guarda_cercado' AND NOT tgisinternal)
       || ' de ' || (SELECT count(*)::text FROM public.qa_tabelas_protegidas)
UNION ALL
SELECT 'modo de teste esta desligado agora?',
       CASE WHEN public.qa_modo_ligado() THEN '>>> LIGADO — ERRADO' ELSE 'sim, desligado' END
UNION ALL
SELECT 'detector instalado',
       COALESCE(to_regprocedure('public.qa_verifica_contaminacao(uuid)')::text, '>>> FALHOU');
