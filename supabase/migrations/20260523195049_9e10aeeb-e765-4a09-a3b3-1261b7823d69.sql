CREATE OR REPLACE FUNCTION public.validar_sequencia_marcacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tem_saida_almoco BOOLEAN;
  v_ultima_marcacao TIMESTAMPTZ;
  v_diff_segundos NUMERIC;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM ponto_marcacoes
    WHERE tenant_id = NEW.tenant_id
      AND colaborador_cpf = NEW.colaborador_cpf
      AND data_marcacao = NEW.data_marcacao
      AND tipo_marcacao = 'saida_almoco'
  ) INTO v_tem_saida_almoco;

  IF NEW.tipo_marcacao = 'retorno_almoco' AND NOT v_tem_saida_almoco THEN
    RAISE EXCEPTION 'Não é possível registrar Retorno Almoço sem Saída Almoço prévia.';
  END IF;

  -- Anti-duplicidade: bloquear registros com menos de 10 minutos do último do mesmo colaborador
  SELECT MAX(hora_marcacao)
  INTO v_ultima_marcacao
  FROM ponto_marcacoes
  WHERE tenant_id = NEW.tenant_id
    AND colaborador_cpf = NEW.colaborador_cpf
    AND data_marcacao = NEW.data_marcacao;

  IF v_ultima_marcacao IS NOT NULL THEN
    v_diff_segundos := EXTRACT(EPOCH FROM (NEW.hora_marcacao - v_ultima_marcacao));
    IF v_diff_segundos < 600 AND v_diff_segundos >= 0 THEN
      RAISE EXCEPTION 'Aguarde pelo menos 10 minutos entre registros de ponto. Último registro há % segundos.', ROUND(v_diff_segundos);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;