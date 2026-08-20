-- ============================================================================
-- ENTREGA — ONDA 8 (correção): competência fechada bloqueia até para gestão
-- Alvo: função validar_periodo_aberto_ponto (gatilho BEFORE INSERT em ponto_marcacoes)
-- PONTO-193
--
-- A bateria rodada no AMBIENTE DE TESTE (por um usuário de gestão) reprovou o
-- PONTO-193: uma competência FECHADA aceitou marcação nova sem reabertura. O
-- guard validar_periodo_aberto_ponto abria uma EXCEÇÃO para papéis de gestão
-- (manager/admin/owner/gestor/rh...) — a "válvula" já apontada como risco. Sem
-- sessão (auth.uid() nulo) o caso passava; COMO GESTÃO (o caso real do TESTE) a
-- válvula deixava a marcação entrar, mudando o espelho já entregue e assinado.
--
-- O QUE FAZ: remove a válvula. Competência FECHADA passa a bloquear marcação nova
-- para TODOS. O único caminho para mexer é a REABERTURA FORMAL (PONTO-358), que
-- muda o status para 'reaberto' — e o guard naturalmente libera (só bloqueia
-- 'fechado'). Gatilho é BEFORE INSERT, então só afeta marcação NOVA; UPDATE
-- (ex.: desconsiderar) não é tocado.
--
-- GARANTIAS: não altera o motor de saldo, o espelho nem o fechamento. Só fecha a
-- válvula do guard de período. Aditivo (CREATE OR REPLACE) e idempotente.
-- Roda inteiro em UMA transação.
-- ============================================================================

SET lock_timeout = '10s';

CREATE OR REPLACE FUNCTION public.validar_periodo_aberto_ponto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_competencia text;
  v_fechado     boolean;
BEGIN
  v_competencia := to_char(NEW.data_marcacao::date, 'YYYY-MM');

  SELECT EXISTS (
    SELECT 1 FROM public.ponto_fechamentos
    WHERE tenant_id = NEW.tenant_id
      AND competencia = v_competencia
      AND status = 'fechado'
  ) INTO v_fechado;

  -- Competencia fechada e documento entregue e assinado: NAO se altera por baixo
  -- dos panos — nem por gestao. Para mexer, e preciso REABRIR formalmente
  -- (ponto_reabrir_competencia, PONTO-358), que muda o status para 'reaberto' e
  -- gera nova versao do espelho. So entao a marcacao passa (o guard so bloqueia
  -- 'fechado'). Sem valvula de excecao por papel.
  IF v_fechado THEN
    RAISE EXCEPTION
      'Periodo % esta fechado. Nao e possivel registrar marcacoes sem reabertura formal da competencia (reabra em Fechamentos; PONTO-358).', v_competencia
      USING ERRCODE = 'raise_exception';
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.validar_periodo_aberto_ponto() IS
  'Bloqueia marcacao NOVA em competencia fechada para TODOS (sem valvula de excecao por papel de gestao). O caminho para alterar e a reabertura formal (PONTO-358), que muda o status para reaberto. BEFORE INSERT em ponto_marcacoes. PONTO-193.';

-- ---------------------------------------------------------------------------
-- CONFERENCIA — o SQL Editor mostra apenas o ultimo resultado.
-- Esperado: t | t | f | f | OK
--   guarda_ok    : t (a funcao existe)
--   bloqueia_ok  : t (o corpo ainda bloqueia competencia 'fechado')
--   sem_role     : f (o corpo NAO chama mais has_role — valvula removida)
--   sem_burlar   : f (o corpo NAO tem mais a variavel/logica pode_burlar)
-- ---------------------------------------------------------------------------
SELECT
  (to_regprocedure('public.validar_periodo_aberto_ponto()') IS NOT NULL)          AS guarda_ok,
  EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname='public' AND p.proname='validar_periodo_aberto_ponto'
            AND p.prosrc ILIKE '%fechado%' AND p.prosrc ILIKE '%RAISE EXCEPTION%') AS bloqueia_ok,
  EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname='public' AND p.proname='validar_periodo_aberto_ponto'
            AND p.prosrc ILIKE '%has_role%')                                       AS sem_role,
  EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname='public' AND p.proname='validar_periodo_aberto_ponto'
            AND p.prosrc ILIKE '%pode_burlar%')                                    AS sem_burlar,
  CASE WHEN to_regprocedure('public.validar_periodo_aberto_ponto()') IS NOT NULL
        AND EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                    WHERE n.nspname='public' AND p.proname='validar_periodo_aberto_ponto'
                      AND p.prosrc ILIKE '%fechado%' AND p.prosrc ILIKE '%RAISE EXCEPTION%')
        AND NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                    WHERE n.nspname='public' AND p.proname='validar_periodo_aberto_ponto'
                      AND (p.prosrc ILIKE '%has_role%' OR p.prosrc ILIKE '%pode_burlar%'))
       THEN 'OK' ELSE 'CONFERIR' END AS erro_tecnico;
