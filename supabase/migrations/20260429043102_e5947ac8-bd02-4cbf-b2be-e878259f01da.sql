CREATE OR REPLACE FUNCTION public.validar_sequencia_marcacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tem_entrada BOOLEAN;
  v_tem_saida_almoco BOOLEAN;
  v_tem_retorno_almoco BOOLEAN;
BEGIN
  SELECT
    EXISTS(SELECT 1 FROM ponto_marcacoes WHERE tenant_id = NEW.tenant_id AND colaborador_cpf = NEW.colaborador_cpf AND data_marcacao = NEW.data_marcacao AND tipo_marcacao = 'entrada'),
    EXISTS(SELECT 1 FROM ponto_marcacoes WHERE tenant_id = NEW.tenant_id AND colaborador_cpf = NEW.colaborador_cpf AND data_marcacao = NEW.data_marcacao AND tipo_marcacao = 'saida_almoco'),
    EXISTS(SELECT 1 FROM ponto_marcacoes WHERE tenant_id = NEW.tenant_id AND colaborador_cpf = NEW.colaborador_cpf AND data_marcacao = NEW.data_marcacao AND tipo_marcacao = 'retorno_almoco')
  INTO v_tem_entrada, v_tem_saida_almoco, v_tem_retorno_almoco;

  -- Regra de negócio: marcações faltantes (ex: Saída sem Entrada) são permitidas
  -- e devem ser tratadas pelo RH via módulo de ajustes. Mantemos apenas validações
  -- estruturais leves para almoço, mas sem bloquear o registro principal.
  IF NEW.tipo_marcacao = 'retorno_almoco' AND NOT v_tem_saida_almoco THEN
    RAISE EXCEPTION 'Não é possível registrar Retorno Almoço sem Saída Almoço prévia.';
  END IF;

  RETURN NEW;
END;
$function$;