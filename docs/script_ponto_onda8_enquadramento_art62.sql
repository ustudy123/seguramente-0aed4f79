-- ============================================================================
-- ENTREGA — ONDA 8 (parte 1): enquadramento do art. 62 + teletrabalho
-- Alvos: admissoes (+art62_inciso, +art62_documento, +teletrabalho_modalidade,
--        +dispensado_ponto) + ponto_art62_dispensa, ponto_sync_enquadramento_art62
-- PONTO-373 / PONTO-374
--
-- O cadastro nao tinha enquadramento do art. 62: gestor, externo e teletrabalhista
-- por producao eram tratados como controlados, e a materializacao de faltas gerava
-- FALTA para quem a lei DISPENSA de marcar. E o teletrabalho nao distinguia JORNADA
-- de PRODUCAO (Lei 14.442/2022): so producao dispensa. Passam a existir o
-- enquadramento no vinculo, a regra da dispensa e o gatilho que zera bate_ponto do
-- dispensado (a materializacao ja pula bate_ponto=false — dispensa respeitada sem
-- tocar no motor). Teletrabalho por jornada NAO e dispensado.
--
-- GARANTIAS: nao altera o calculo de saldo, o espelho nem o fechamento. Aditivo e
-- idempotente. Roda inteiro em UMA transacao.
-- ============================================================================

SET lock_timeout = '10s';
ALTER TABLE public.admissoes ADD COLUMN IF NOT EXISTS art62_inciso            text;
ALTER TABLE public.admissoes ADD COLUMN IF NOT EXISTS art62_documento         text;
ALTER TABLE public.admissoes ADD COLUMN IF NOT EXISTS teletrabalho_modalidade text;
ALTER TABLE public.admissoes ADD COLUMN IF NOT EXISTS dispensado_ponto        boolean NOT NULL DEFAULT false;

DO $chk$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid='public.admissoes'::regclass AND conname='admissoes_art62_inciso_chk') THEN
    ALTER TABLE public.admissoes
      ADD CONSTRAINT admissoes_art62_inciso_chk
      CHECK (art62_inciso IS NULL OR art62_inciso IN ('I','II','III'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid='public.admissoes'::regclass AND conname='admissoes_teletrabalho_modalidade_chk') THEN
    ALTER TABLE public.admissoes
      ADD CONSTRAINT admissoes_teletrabalho_modalidade_chk
      CHECK (teletrabalho_modalidade IS NULL OR teletrabalho_modalidade IN ('jornada','producao'));
  END IF;
END $chk$;

COMMENT ON COLUMN public.admissoes.art62_inciso IS
  'Enquadramento no art. 62 da CLT que dispensa o controle de jornada: I (atividade externa incompativel), II (cargo de gestao/confianca), III (teletrabalho por producao/tarefa). NULL = sujeito a controle.';
COMMENT ON COLUMN public.admissoes.teletrabalho_modalidade IS
  'Modalidade de teletrabalho (Lei 14.442/2022): producao/tarefa (dispensa controle, art. 62 III) ou jornada (CONTINUA sujeito a controle). NULL = nao aplicavel.';
COMMENT ON COLUMN public.admissoes.dispensado_ponto IS
  'Dispensa de controle de ponto resolvida pela regra do art. 62 (ponto_art62_dispensa). Teletrabalho por jornada nunca fica dispensado.';

-- (2) A regra da dispensa ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.ponto_art62_dispensa(
  p_inciso     text,
  p_modalidade text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  -- Dispensa de controle so quando ha inciso do art. 62 (I/II/III) E a modalidade
  -- NAO e teletrabalho por jornada. Teletrabalho por jornada permanece controlado
  -- (Lei 14.442/2022) ainda que alguem informe o inciso III.
  SELECT COALESCE(p_inciso, '') IN ('I','II','III')
         AND COALESCE(p_modalidade, '') <> 'jornada';
$$;

COMMENT ON FUNCTION public.ponto_art62_dispensa(text, text) IS
  'Regra da dispensa de controle do art. 62: verdadeiro quando ha inciso (I/II/III) e a modalidade nao e teletrabalho por jornada (que continua controlado). PONTO-373/374.';

-- (3) Coerência do vínculo (dispensado -> nao bate ponto) ---------------------
CREATE OR REPLACE FUNCTION public.ponto_sync_enquadramento_art62()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Resolve a dispensa pela regra do art. 62.
  NEW.dispensado_ponto := public.ponto_art62_dispensa(NEW.art62_inciso, NEW.teletrabalho_modalidade);

  -- Dispensado nao materializa falta: zera bate_ponto (o motor ja pula esses).
  -- Teletrabalho por jornada NAO e dispensado — permanece como esta (controlado).
  IF NEW.dispensado_ponto THEN
    NEW.bate_ponto := false;
  END IF;

  RETURN NEW;
END;
$$;

DO $trg$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
                 WHERE tgname='trg_ponto_enquadramento_art62'
                   AND tgrelid='public.admissoes'::regclass AND NOT tgisinternal) THEN
    CREATE TRIGGER trg_ponto_enquadramento_art62
      BEFORE INSERT OR UPDATE OF art62_inciso, teletrabalho_modalidade, dispensado_ponto
      ON public.admissoes
      FOR EACH ROW EXECUTE FUNCTION public.ponto_sync_enquadramento_art62();
  END IF;
END $trg$;

COMMENT ON FUNCTION public.ponto_sync_enquadramento_art62() IS
  'Resolve dispensado_ponto pela regra do art. 62 e, quando dispensa, zera bate_ponto para a materializacao de faltas respeitar a dispensa sem tocar no motor. PONTO-373.';

-- ---------------------------------------------------------------------------
-- CONFERENCIA — o SQL Editor mostra apenas o ultimo resultado.
-- Esperado: t | t | t | t | t | OK
--   art62_ok        : t (admissoes.art62_inciso)
--   teletrabalho_ok : t (admissoes.teletrabalho_modalidade)
--   dispensado_ok   : t (admissoes.dispensado_ponto)
--   regra_ok        : t (ponto_art62_dispensa — III/jornada NAO dispensa)
--   gatilho_ok      : t (trigger trg_ponto_enquadramento_art62)
-- ---------------------------------------------------------------------------
SELECT
  (public.qa_col_existe('admissoes','%art62%') IS NOT NULL)                         AS art62_ok,
  (public.qa_col_existe('admissoes','%teletrabalho%') IS NOT NULL)                  AS teletrabalho_ok,
  (public.qa_col_existe('admissoes','%dispensado_ponto%') IS NOT NULL)              AS dispensado_ok,
  (public.ponto_art62_dispensa('II',NULL) AND NOT public.ponto_art62_dispensa('III','jornada')) AS regra_ok,
  EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_ponto_enquadramento_art62'
          AND tgrelid='public.admissoes'::regclass AND NOT tgisinternal)            AS gatilho_ok,
  CASE WHEN public.qa_col_existe('admissoes','%art62%') IS NOT NULL
        AND public.qa_col_existe('admissoes','%teletrabalho%') IS NOT NULL
        AND public.qa_col_existe('admissoes','%dispensado_ponto%') IS NOT NULL
        AND public.ponto_art62_dispensa('II',NULL)
        AND NOT public.ponto_art62_dispensa('III','jornada')
        AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_ponto_enquadramento_art62'
                    AND tgrelid='public.admissoes'::regclass AND NOT tgisinternal)
       THEN 'OK' ELSE 'CONFERIR' END AS erro_tecnico;
