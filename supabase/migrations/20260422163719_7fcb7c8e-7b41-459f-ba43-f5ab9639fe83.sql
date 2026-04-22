-- Fix triggers that reference non-existent column "colaborador_nome" in trilha_atribuicoes.
-- The actual column in trilha_atribuicoes is "alvo_nome" (with tipo_alvo).

CREATE OR REPLACE FUNCTION public.cancelar_trilhas_desligamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'desligado' AND OLD.status != 'desligado' THEN
    -- Remover atribuições pendentes do colaborador desligado
    DELETE FROM public.trilha_atribuicoes
    WHERE alvo_nome = NEW.nome_completo
      AND tenant_id = NEW.tenant_id
      AND tipo_alvo = 'individual';

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
$function$;

CREATE OR REPLACE FUNCTION public.reavaliar_trilhas_mudanca_cargo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.cargo IS DISTINCT FROM OLD.cargo THEN
    -- Limpar atribuições antigas vinculadas ao cargo anterior
    DELETE FROM public.trilha_atribuicoes
    WHERE alvo_nome = OLD.cargo
      AND tenant_id = NEW.tenant_id
      AND tipo_alvo = 'cargo';
  END IF;
  RETURN NEW;
END;
$function$;