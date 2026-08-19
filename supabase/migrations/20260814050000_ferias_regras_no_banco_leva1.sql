-- =====================================================================
-- Férias: as regras que a lei trata como teto duro passam a viver no banco
--
-- Item 2 da conferência (docs/conferencia_ferias_requisitos.md), primeira
-- leva. O motor de regras existe e é bem-feito — mas roda no NAVEGADOR.
-- Os dados entram por três portas (tela, importação em massa e API) e só
-- a primeira passa por ele. Uma planilha importada com fracionamento
-- inválido entra sem resistência.
--
-- ESCOLHA DAS REGRAS DESTA LEVA
--
-- O diagnóstico rodado na produção em 14/08 (docs/script_diagnostico_
-- ferias_regras.sql) mediu, sobre 31 períodos e 19 solicitações, quantos
-- registros violariam cada regra HOJE:
--
--   art. 130 (dias × faltas) .................... 0  → entra como trava
--   fracionamento 14+5+5 ........................ 0  → entra como trava
--   abono acima de 10 dias ...................... 0  → entra como trava
--   solicitação acima do saldo .................. 3  → FICA DE FORA
--   chave do período por vínculo ................ 0  → FICA DE FORA
--
-- Só vira trava dura o que a base já cumpre. Trava que nasce violada ou
-- se recusa a ser criada, ou trava a operação do dia seguinte por causa
-- de registro velho que ninguém pode mais corrigir.
--
-- POR QUE AS DUAS DE FORA FICARAM DE FORA
--
--   • Solicitação acima do saldo: 3 dos 19 registros da produção pedem
--     mais dias do que o saldo. Antes de travar é preciso olhar os três
--     — pode ser saldo desatualizado, e não pedido indevido. Travar
--     agora impediria a correção justamente deles.
--
--   • Chave do período por vínculo: mudar a chave única exige mudar
--     junto o `onConflict` de duas telas (importação e programação). Na
--     produção, script e publicação são gestos separados: entre um e
--     outro, a importação quebraria. Como o diagnóstico mostrou ZERO
--     CPFs com vínculo em mais de uma empresa, o defeito é latente, não
--     ativo — e merece entrega própria, com ordem explícita.
--
-- CADA TRAVA É APLICADA EM BLOCO PRÓPRIO, com aviso em vez de aborto:
-- se algum registro tiver mudado desde o diagnóstico, a trava daquele
-- item não nasce e o script continua, dizendo o motivo.
-- =====================================================================

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

-- ─────────────────────────────────────────────────────────────────────
-- Conferência
-- ─────────────────────────────────────────────────────────────────────
DO $verifica$
DECLARE v_n int := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger
              WHERE tgrelid = 'public.ferias_periodos_aquisitivos'::regclass
                AND tgname = 'trg_ferias_deriva_dias_direito' AND NOT tgisinternal)
  THEN v_n := v_n + 1; END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint
              WHERE conrelid = 'public.ferias_programacao'::regclass
                AND conname = 'ferias_prog_fracionamento_clt')
  THEN v_n := v_n + 1; END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint
              WHERE conrelid = 'public.ferias_programacao'::regclass
                AND conname = 'ferias_prog_abono_teto')
  THEN v_n := v_n + 1; END IF;

  IF v_n < 3 THEN
    RAISE EXCEPTION 'Primeira leva das regras de férias incompleta: % de 3.', v_n;
  END IF;
  RAISE NOTICE 'OK: as 3 travas da primeira leva estão no banco.';
END $verifica$;
