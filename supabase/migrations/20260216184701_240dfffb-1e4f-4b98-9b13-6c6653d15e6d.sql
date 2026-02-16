-- #5: Trigger para cancelar ações culturais ao desligar colaborador
CREATE OR REPLACE FUNCTION public.cancelar_acoes_cultura_desligamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Se status mudou para 'desligado' ou 'cancelado', cancelar ações pendentes
  IF NEW.status IN ('desligado', 'cancelado') AND OLD.status NOT IN ('desligado', 'cancelado') THEN
    UPDATE public.cultura_acoes
    SET status = 'cancelada',
        observacoes = COALESCE(observacoes, '') || ' [Cancelada automaticamente: colaborador desligado em ' || NOW()::date::text || ']'
    WHERE colaborador_nome = NEW.nome_completo
      AND tenant_id = NEW.tenant_id
      AND status IN ('pendente', 'em_andamento');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cancelar_acoes_cultura_desligamento
BEFORE UPDATE ON public.admissoes
FOR EACH ROW
EXECUTE FUNCTION public.cancelar_acoes_cultura_desligamento();

-- #6: Trigger para reavaliar ações de dia da profissão ao mudar cargo
CREATE OR REPLACE FUNCTION public.reavaliar_acoes_mudanca_cargo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Se cargo mudou, cancelar ações pendentes de dia_profissao
  IF NEW.cargo IS DISTINCT FROM OLD.cargo THEN
    UPDATE public.cultura_acoes
    SET status = 'cancelada',
        observacoes = COALESCE(observacoes, '') || ' [Cancelada: função alterada de "' || COALESCE(OLD.cargo, '?') || '" para "' || COALESCE(NEW.cargo, '?') || '"]'
    WHERE colaborador_nome = NEW.nome_completo
      AND tenant_id = NEW.tenant_id
      AND tipo = 'dia_profissao'
      AND status IN ('pendente', 'em_andamento');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reavaliar_acoes_mudanca_cargo
BEFORE UPDATE ON public.admissoes
FOR EACH ROW
EXECUTE FUNCTION public.reavaliar_acoes_mudanca_cargo();