
CREATE OR REPLACE FUNCTION public.atualizar_estoque_epi()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Reduzir estoque na entrega (movimentação é registrada pelo app)
    UPDATE public.epis 
    SET quantidade_estoque = quantidade_estoque - NEW.quantidade
    WHERE id = NEW.epi_id;
    
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'devolvido' AND OLD.status = 'ativa' THEN
    -- Aumentar estoque na devolução
    UPDATE public.epis 
    SET quantidade_estoque = quantidade_estoque + NEW.quantidade
    WHERE id = NEW.epi_id;
  END IF;
  
  RETURN NEW;
END;
$function$;
