-- ============================================================================
-- ONDA 8 (correção) — Competência fechada bloqueia até para gestão (PONTO-193)
--
-- A bateria rodada no AMBIENTE DE TESTE (por um usuário de gestão) reprovou o
-- PONTO-193: uma competência FECHADA aceitou marcação nova sem reabertura. O
-- guard validar_periodo_aberto_ponto abria uma EXCEÇÃO para papéis de gestão
-- (manager/admin/owner/gestor/rh...) — a "válvula" já apontada como risco na
-- trilha de ajustes. Rodando sem sessão (réplica local, auth.uid() nulo) o caso
-- passava; rodando COMO GESTÃO (o caso real do TESTE) a válvula deixava a
-- marcação entrar por baixo dos panos, mudando o espelho já entregue e assinado.
--
-- O QUE FAZ: remove a válvula. Uma competência FECHADA passa a bloquear marcações
-- novas para TODOS. O único caminho para mexer é a REABERTURA FORMAL (PONTO-358),
-- que muda o status para 'reaberto' — e aí o guard naturalmente libera (ele só
-- bloqueia 'fechado'). O gatilho é BEFORE INSERT em ponto_marcacoes, então só
-- afeta marcação NOVA; UPDATE (ex.: desconsiderar) não é tocado.
--
-- GARANTIAS: não altera o motor de saldo, o espelho nem o fechamento. Só fecha a
-- válvula do guard de período. Aditivo (CREATE OR REPLACE) e idempotente.
-- ============================================================================

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
