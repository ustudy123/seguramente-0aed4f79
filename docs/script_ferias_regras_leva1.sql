-- ============================================================================
-- YourEyes · PRODUÇÃO · Regras de férias no banco — primeira leva
--
-- O QUE ESTE SCRIPT FAZ
--
-- O motor de regras de férias existe e é bem-feito, mas roda no NAVEGADOR.
-- Os dados entram por três portas — a tela, a importação em massa e a API —
-- e só a primeira passa por ele. Este script leva ao banco as três regras
-- que a lei trata como teto duro, para valerem por qualquer caminho.
--
--   1. Art. 130  — os dias de direito passam a ser DERIVADOS das faltas
--   2. Art. 134 §1º — fracionamento 14+5+5 vira recusa
--   3. Art. 143  — abono acima de 10 dias vira recusa
--
-- POR QUE SÓ ESTAS TRÊS
--
-- O diagnóstico rodado na sua produção mediu, sobre 31 períodos e 19
-- solicitações, quantos registros violariam cada regra HOJE. Estas três
-- deram ZERO: a base já as cumpre, então travar não quebra nada.
--
-- Duas ficaram de fora de propósito:
--   • solicitação acima do saldo — 3 dos 19 registros violam; travar agora
--     impediria justamente a correção deles;
--   • chave do período por vínculo — exige mudar a tela junto, e entre o
--     script e a publicação a importação quebraria. Deu zero casos hoje:
--     é defeito latente, e merece entrega própria.
--
-- SEGURO DE RODAR DUAS VEZES. Cada trava é aplicada em bloco próprio: se
-- algum registro tiver mudado desde o diagnóstico, aquela trava não nasce e
-- o script continua, dizendo o motivo — em vez de abortar tudo.
--
-- ATENÇÃO À ORDEM: rode este script ANTES de publicar no Lovable. A
-- publicação traz a gravação de quem aprovou as férias, que não depende
-- deste script, mas o inverso também vale — não há travamento entre os dois.
--
-- COMO RODAR: cole o arquivo inteiro no SQL Editor do projeto de PRODUÇÃO.
-- O último resultado é a conferência.
-- ============================================================================

SET lock_timeout = '10s';

-- ─────────────────────────────────────────────────────────────────────
-- 1) Art. 130 — os dias de direito passam a ser DERIVADOS das faltas
--
-- A função com a escala (30/24/18/12/0) já existia e está correta; o que
-- faltava era obrigar o dado gravado a passar por ela. Uma trava do tipo
-- CHECK não serviria aqui: a escala depende do método configurado por
-- empresa ('clt_faltas' × 'proporcional_avos'), e CHECK não consulta
-- outra tabela. Por isso é um gatilho que DERIVA, em vez de recusar —
-- assim a importação em massa também passa a obedecer, sem quebrar.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ferias_deriva_dias_direito()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_metodo text;
BEGIN
  SELECT metodo_calculo INTO v_metodo
    FROM public.ferias_config
   WHERE tenant_id = NEW.tenant_id
     AND empresa_id IS NOT DISTINCT FROM NEW.empresa_id
   LIMIT 1;

  IF v_metodo IS NULL THEN
    SELECT metodo_calculo INTO v_metodo
      FROM public.ferias_config
     WHERE tenant_id = NEW.tenant_id AND empresa_id IS NULL
     LIMIT 1;
  END IF;

  -- Fora do regime da escala (avos), o cálculo é outro: não mexer.
  IF COALESCE(v_metodo, 'clt_faltas') <> 'clt_faltas' THEN
    RETURN NEW;
  END IF;

  NEW.dias_direito :=
    public.ferias_dias_por_faltas_clt(COALESCE(NEW.faltas_consideradas, 0));

  NEW.dias_saldo :=
    GREATEST(0, COALESCE(NEW.dias_direito, 0) - COALESCE(NEW.dias_gozados, 0));

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_ferias_deriva_dias_direito ON public.ferias_periodos_aquisitivos;
CREATE TRIGGER trg_ferias_deriva_dias_direito
  BEFORE INSERT OR UPDATE OF faltas_consideradas, dias_gozados, dias_direito, empresa_id
  ON public.ferias_periodos_aquisitivos
  FOR EACH ROW EXECUTE FUNCTION public.ferias_deriva_dias_direito();

-- ─────────────────────────────────────────────────────────────────────
-- 2) Art. 134 §1º — fracionamento
--
-- Fracionou (dois ou três períodos): um precisa ter 14 dias ou mais e
-- nenhum pode ter menos de 5. Não fracionou (um período só): sem piso —
-- a lei não exige mínimo de quem tira tudo de uma vez.
--
-- LEAST/GREATEST ignoram NULL no PostgreSQL, e o NULLIF zera o
-- subperíodo não usado para que ele não entre como "menor de 5".
-- ─────────────────────────────────────────────────────────────────────
DO $frac$
BEGIN
  ALTER TABLE public.ferias_programacao
    DROP CONSTRAINT IF EXISTS ferias_prog_fracionamento_clt;

  ALTER TABLE public.ferias_programacao
    ADD CONSTRAINT ferias_prog_fracionamento_clt CHECK (
      (CASE WHEN COALESCE(p1_dias, 0) > 0 THEN 1 ELSE 0 END
     + CASE WHEN COALESCE(p2_dias, 0) > 0 THEN 1 ELSE 0 END
     + CASE WHEN COALESCE(p3_dias, 0) > 0 THEN 1 ELSE 0 END) <= 1
      OR (
        GREATEST(COALESCE(p1_dias, 0), COALESCE(p2_dias, 0), COALESCE(p3_dias, 0)) >= 14
        AND LEAST(NULLIF(COALESCE(p1_dias, 0), 0),
                  NULLIF(COALESCE(p2_dias, 0), 0),
                  NULLIF(COALESCE(p3_dias, 0), 0)) >= 5
      )
    );
  RAISE NOTICE 'Trava do fracionamento (art. 134, §1º) aplicada.';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ATENÇÃO: trava do fracionamento NAO aplicada: %. '
               'Rode o diagnóstico (item 3) e corrija os registros antes.', SQLERRM;
END $frac$;

-- ─────────────────────────────────────────────────────────────────────
-- 3) Art. 143 — teto do abono pecuniário
--
-- O teto absoluto é de 10 dias (1/3 de 30). O limite RELATIVO (1/3 do
-- direito de quem tem menos de 30 dias por faltas) depende do período
-- aquisitivo, que está em outra tabela — CHECK não consulta outra
-- tabela, então essa parte segue no motor da tela, que já a avalia.
-- Aqui fica o teto que nenhuma situação pode ultrapassar.
-- ─────────────────────────────────────────────────────────────────────
DO $abono$
BEGIN
  ALTER TABLE public.ferias_programacao
    DROP CONSTRAINT IF EXISTS ferias_prog_abono_teto;

  ALTER TABLE public.ferias_programacao
    ADD CONSTRAINT ferias_prog_abono_teto CHECK (
      COALESCE(abono_vender, false) = false OR COALESCE(abono_dias, 0) <= 10
    );
  RAISE NOTICE 'Trava do teto do abono (art. 143) aplicada.';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ATENÇÃO: trava do abono NAO aplicada: %. '
               'Rode o diagnóstico (item 4) e corrija os registros antes.', SQLERRM;
END $abono$;

-- ============================================================================
-- CONFERÊNCIA — é o único resultado que o editor mostra
-- ============================================================================
WITH esperado AS MATERIALIZED (
  SELECT * FROM (VALUES
    (1, 'Art. 130 — dias derivados das faltas', 'trigger',
     'trg_ferias_deriva_dias_direito', 'ferias_periodos_aquisitivos'),
    (2, 'Art. 134 §1º — fracionamento 14+5+5', 'check',
     'ferias_prog_fracionamento_clt', 'ferias_programacao'),
    (3, 'Art. 143 — abono no teto de 10 dias', 'check',
     'ferias_prog_abono_teto', 'ferias_programacao')
  ) AS t(ordem, regra, tipo, objeto, tabela)
)
SELECT
  e.regra,
  CASE
    WHEN e.tipo = 'trigger' AND EXISTS (
      SELECT 1 FROM pg_trigger g
      WHERE g.tgrelid = ('public.' || e.tabela)::regclass
        AND g.tgname = e.objeto AND NOT g.tgisinternal) THEN 'ok'
    WHEN e.tipo = 'check' AND EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = ('public.' || e.tabela)::regclass
        AND c.conname = e.objeto) THEN 'ok'
    ELSE 'FALTA'
  END AS situacao,
  CASE
    WHEN e.tipo = 'trigger' AND EXISTS (
      SELECT 1 FROM pg_trigger g
      WHERE g.tgrelid = ('public.' || e.tabela)::regclass
        AND g.tgname = e.objeto AND NOT g.tgisinternal) THEN ''
    WHEN e.tipo = 'check' AND EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = ('public.' || e.tabela)::regclass
        AND c.conname = e.objeto) THEN ''
    ELSE 'nao aplicada — algum registro da base viola a regra; rode o '
         || 'script_diagnostico_ferias_regras.sql e corrija antes'
  END AS erro_tecnico
FROM esperado e

UNION ALL

SELECT 'Camada de perfil em Férias (não pode ter regredido)',
       CASE WHEN count(*) = 7 THEN 'ok' ELSE 'FALTA' END,
       CASE WHEN count(*) = 7 THEN '' ELSE count(*)::text || ' de 7 políticas' END
FROM pg_policies
WHERE schemaname = 'public'
  AND permissive = 'RESTRICTIVE' AND cmd = 'SELECT'
  AND policyname LIKE 'perfil_restringe_leitura_%'
  AND tablename IN ('ferias_periodos_aquisitivos','ferias_programacao',
                    'ferias_solicitacoes','folha_ferias_calculo',
                    'ferias_assinatura_links','ferias_historico',
                    'ferias_vinculo_familiar')
ORDER BY 1;
