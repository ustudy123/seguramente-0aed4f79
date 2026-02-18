
-- 1. Trigger: Cancelar atribuições e marcar progresso como cancelado ao desligar colaborador
CREATE OR REPLACE FUNCTION public.cancelar_trilhas_desligamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'desligado' AND OLD.status != 'desligado' THEN
    -- Remover atribuições pendentes
    DELETE FROM public.trilha_atribuicoes
    WHERE colaborador_nome = NEW.nome_completo
      AND tenant_id = NEW.tenant_id;

    -- Marcar progresso em andamento como cancelado
    UPDATE public.trilha_progresso
    SET status = 'cancelado',
        updated_at = now()
    WHERE colaborador_nome = NEW.nome_completo
      AND tenant_id = NEW.tenant_id
      AND status IN ('pendente', 'em_andamento');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cancelar_trilhas_desligamento
BEFORE UPDATE ON public.admissoes
FOR EACH ROW
EXECUTE FUNCTION public.cancelar_trilhas_desligamento();

-- 2. Trigger: Reavaliar atribuições de trilhas por cargo quando cargo muda
CREATE OR REPLACE FUNCTION public.reavaliar_trilhas_mudanca_cargo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.cargo IS DISTINCT FROM OLD.cargo THEN
    -- Remover atribuições que foram feitas por cargo antigo (campo tipo = 'cargo')
    DELETE FROM public.trilha_atribuicoes
    WHERE colaborador_nome = NEW.nome_completo
      AND tenant_id = NEW.tenant_id
      AND tipo = 'cargo';
    
    -- Atribuir trilhas do novo cargo automaticamente
    INSERT INTO public.trilha_atribuicoes (tenant_id, trilha_id, colaborador_id, colaborador_nome, tipo, valor_referencia)
    SELECT ta.tenant_id, ta.trilha_id, ta.colaborador_id, NEW.nome_completo, 'cargo', NEW.cargo
    FROM public.trilha_atribuicoes ta
    WHERE ta.tenant_id = NEW.tenant_id
      AND ta.tipo = 'cargo'
      AND ta.valor_referencia = NEW.cargo
    LIMIT 0; -- No auto-assign for now, just cleanup old ones
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reavaliar_trilhas_mudanca_cargo
BEFORE UPDATE ON public.admissoes
FOR EACH ROW
EXECUTE FUNCTION public.reavaliar_trilhas_mudanca_cargo();
