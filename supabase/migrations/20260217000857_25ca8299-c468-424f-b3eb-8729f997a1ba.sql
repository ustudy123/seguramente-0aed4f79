-- Fix the trigger function that references invalid enum value "cancelado"
CREATE OR REPLACE FUNCTION public.cancelar_acoes_cultura_desligamento()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Se status mudou para 'desligado', cancelar ações pendentes
  IF NEW.status = 'desligado' AND OLD.status != 'desligado' THEN
    UPDATE public.cultura_acoes
    SET status = 'cancelada',
        observacoes = COALESCE(observacoes, '') || ' [Cancelada automaticamente: colaborador desligado em ' || NOW()::date::text || ']'
    WHERE colaborador_nome = NEW.nome_completo
      AND tenant_id = NEW.tenant_id
      AND status IN ('pendente', 'em_andamento');
  END IF;
  RETURN NEW;
END;
$function$;

-- Also fix the reavaliar_acoes_mudanca_cargo trigger that might have similar issues
CREATE OR REPLACE FUNCTION public.reavaliar_acoes_mudanca_cargo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;