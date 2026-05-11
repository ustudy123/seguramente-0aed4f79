CREATE OR REPLACE FUNCTION public.gerar_alertas_ponto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tipo TEXT;
  v_titulo TEXT;
  v_descricao TEXT;
BEGIN
  IF NEW.status = 'falta' THEN
    v_tipo := 'falta';
    v_titulo := 'Falta registrada';
    v_descricao := 'Colaborador ' || NEW.colaborador_nome || ' registrou falta em ' || NEW.data::TEXT;
  ELSIF NEW.status = 'atraso' THEN
    v_tipo := 'atraso';
    v_titulo := 'Atraso registrado';
    v_descricao := 'Colaborador ' || NEW.colaborador_nome || ' registrou atraso em ' || NEW.data::TEXT;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.ponto_alertas (
    tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
    tipo, titulo, descricao, data_referencia, severidade, empresa_id
  ) VALUES (
    NEW.tenant_id, NEW.colaborador_id, NEW.colaborador_nome, NEW.colaborador_cpf,
    v_tipo, v_titulo, v_descricao, NEW.data,
    CASE WHEN v_tipo = 'falta' THEN 'alta' ELSE 'media' END,
    NEW.empresa_id
  )
  ON CONFLICT (tenant_id, colaborador_cpf, tipo, data_referencia)
  WHERE resolvido = FALSE
  DO NOTHING;

  RETURN NEW;
END;
$function$;
