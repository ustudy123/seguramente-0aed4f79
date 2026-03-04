
-- =============================================
-- 1. TRIGGER: Atestado aprovado → justifica ausência no ponto
--    When atestado has afastamento dates, mark ponto_diario as "justificado"
-- =============================================

CREATE OR REPLACE FUNCTION public.justificar_ponto_por_atestado()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_data_inicio DATE;
  v_data_fim DATE;
  v_dia DATE;
BEGIN
  -- Only process assistencial atestados with afastamento dates
  IF NEW.data_inicio_afastamento IS NULL THEN
    RETURN NEW;
  END IF;

  v_data_inicio := NEW.data_inicio_afastamento::DATE;
  v_data_fim := COALESCE(NEW.data_fim_afastamento::DATE, v_data_inicio + COALESCE(NEW.dias_afastamento, 1) - 1);

  -- Update existing ponto_diario records to "justificado"
  UPDATE public.ponto_diario
  SET status = 'justificado',
      observacao = COALESCE(observacao, '') || ' [Atestado médico - ' || COALESCE(NEW.profissional_nome, 'N/I') || ' - CID: ' || COALESCE(NEW.cid_codigo, 'N/I') || ']'
  WHERE tenant_id = NEW.tenant_id
    AND colaborador_cpf = NEW.colaborador_cpf
    AND data >= v_data_inicio
    AND data <= v_data_fim
    AND status IN ('falta', 'atraso', 'incompleto');

  -- Create ponto_diario records for days that don't exist yet
  v_dia := v_data_inicio;
  WHILE v_dia <= v_data_fim LOOP
    INSERT INTO public.ponto_diario (
      tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
      data, status, observacao, horas_trabalhadas
    ) VALUES (
      NEW.tenant_id,
      COALESCE(NEW.colaborador_id, gen_random_uuid()),
      NEW.colaborador_nome,
      NEW.colaborador_cpf,
      v_dia,
      'justificado',
      'Atestado médico - ' || COALESCE(NEW.profissional_nome, 'N/I') || ' - ' || COALESCE(NEW.dias_afastamento::TEXT, '?') || ' dia(s)',
      INTERVAL '0'
    )
    ON CONFLICT (tenant_id, colaborador_cpf, data) DO UPDATE
    SET status = 'justificado',
        observacao = EXCLUDED.observacao
    WHERE ponto_diario.status IN ('falta', 'atraso', 'incompleto');

    v_dia := v_dia + 1;
  END LOOP;

  RETURN NEW;
END;
$function$;

-- Trigger on INSERT and UPDATE of atestados
DROP TRIGGER IF EXISTS trigger_justificar_ponto_atestado ON public.atestados;
CREATE TRIGGER trigger_justificar_ponto_atestado
  AFTER INSERT OR UPDATE ON public.atestados
  FOR EACH ROW
  WHEN (NEW.data_inicio_afastamento IS NOT NULL)
  EXECUTE FUNCTION justificar_ponto_por_atestado();


-- =============================================
-- 2. TRIGGER: Férias → suspender exigência de marcação
--    When ferias_assinatura_links status = 'assinado', 
--    mark vacation days as "ferias" in ponto_diario
-- =============================================

CREATE OR REPLACE FUNCTION public.registrar_ferias_no_ponto()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_dia DATE;
  v_data_inicio DATE;
  v_data_fim DATE;
BEGIN
  -- Only process when status changes to 'assinado'
  IF NEW.status != 'assinado' THEN
    RETURN NEW;
  END IF;
  
  -- Skip if old status was already 'assinado' (no re-process)
  IF TG_OP = 'UPDATE' AND OLD.status = 'assinado' THEN
    RETURN NEW;
  END IF;

  v_data_inicio := NEW.data_inicio_ferias;
  v_data_fim := NEW.data_fim_ferias;

  IF v_data_inicio IS NULL OR v_data_fim IS NULL THEN
    RETURN NEW;
  END IF;

  v_dia := v_data_inicio;
  WHILE v_dia <= v_data_fim LOOP
    INSERT INTO public.ponto_diario (
      tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
      data, status, observacao, horas_trabalhadas
    ) VALUES (
      NEW.tenant_id,
      gen_random_uuid(),
      NEW.colaborador_nome,
      NEW.colaborador_cpf,
      v_dia,
      'justificado',
      'Férias - ' || NEW.dias_ferias || ' dias (' || NEW.data_inicio_ferias::TEXT || ' a ' || NEW.data_fim_ferias::TEXT || ')',
      INTERVAL '0'
    )
    ON CONFLICT (tenant_id, colaborador_cpf, data) DO UPDATE
    SET status = 'justificado',
        observacao = EXCLUDED.observacao;

    v_dia := v_dia + 1;
  END LOOP;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_registrar_ferias_ponto ON public.ferias_assinatura_links;
CREATE TRIGGER trigger_registrar_ferias_ponto
  AFTER INSERT OR UPDATE ON public.ferias_assinatura_links
  FOR EACH ROW
  EXECUTE FUNCTION registrar_ferias_no_ponto();
