CREATE OR REPLACE FUNCTION public.popular_checklist_hub_processo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.hub_processo_checklist (
    tenant_id, processo_id, item, descricao, obrigatorio, ordem, preenchido_automaticamente
  )
  SELECT DISTINCT ON (t.item)
    NEW.tenant_id,
    NEW.id,
    t.item,
    t.descricao,
    t.obrigatorio,
    t.ordem,
    true
  FROM public.hub_checklist_templates t
  WHERE t.tipo = NEW.tipo::text
    AND t.ativo = true
    AND (t.tenant_id = NEW.tenant_id OR t.tenant_id IS NULL)
  ORDER BY t.item, t.tenant_id NULLS LAST;

  RETURN NEW;
END;
$function$;