-- GAP-E1: Trigger que bloqueia inativação de risco Crítico/Alto sem ação vinculada
-- Conformidade: NR-01 Art. 9.3.3 — Riscos não toleráveis exigem controle antes de arquivamento

CREATE OR REPLACE FUNCTION public.bloquear_inativacao_risco_sem_acao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Só verifica quando ativo muda de true para false (arquivamento)
  IF OLD.ativo = true AND NEW.ativo = false THEN
    -- Bloquear apenas riscos Crítico ou Alto sem ação vinculada
    IF OLD.nivel_risco IN ('critico', 'alto') AND OLD.acao_id IS NULL THEN
      RAISE EXCEPTION
        'BLOQUEIO NR-01: O risco "%" é de nível % e não possui ação corretiva vinculada. Para arquivá-lo, vincule primeiro um Plano de Ação. (GAP-E1 / NR-01 / ISO 45003)',
        OLD.titulo, UPPER(OLD.nivel_risco)
      USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_inativacao_sem_acao ON public.gro_riscos;

CREATE TRIGGER trg_bloquear_inativacao_sem_acao
  BEFORE UPDATE OF ativo ON public.gro_riscos
  FOR EACH ROW
  EXECUTE FUNCTION public.bloquear_inativacao_risco_sem_acao();