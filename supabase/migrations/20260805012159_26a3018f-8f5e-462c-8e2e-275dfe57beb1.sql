CREATE OR REPLACE FUNCTION public.justificar_ponto_por_atestado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_data_inicio date;
  v_data_fim date;
  v_dia date;
BEGIN
  IF NEW.data_inicio_afastamento IS NULL THEN
    RETURN NEW;
  END IF;

  -- Atestado por horas reduz apenas a jornada do dia inicial. A consolidação
  -- específica já é executada por trg_consolida_atestado; jamais expandir
  -- dias_afastamento como se fosse um atestado de dia inteiro.
  IF COALESCE(NEW.unidade_afastamento, 'dias') = 'horas' THEN
    RETURN NEW;
  END IF;

  v_data_inicio := NEW.data_inicio_afastamento::date;
  v_data_fim := COALESCE(
    NEW.data_fim_afastamento::date,
    v_data_inicio + GREATEST(COALESCE(NEW.dias_afastamento, 1), 1) - 1
  );

  UPDATE public.ponto_diario
  SET status = 'justificado',
      observacao = COALESCE(observacao, '') || ' [Atestado médico - ' || COALESCE(NEW.profissional_nome, 'N/I') || ' - CID: ' || COALESCE(NEW.cid_codigo, 'N/I') || ']'
  WHERE tenant_id = NEW.tenant_id
    AND regexp_replace(colaborador_cpf, '[^0-9]', '', 'g') = regexp_replace(NEW.colaborador_cpf, '[^0-9]', '', 'g')
    AND data BETWEEN v_data_inicio AND v_data_fim
    AND status IN ('falta', 'atraso', 'incompleto');

  v_dia := v_data_inicio;
  WHILE v_dia <= v_data_fim LOOP
    INSERT INTO public.ponto_diario (
      tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
      data, status, observacao, horas_trabalhadas, tipo_dia
    ) VALUES (
      NEW.tenant_id,
      COALESCE(NEW.colaborador_id, gen_random_uuid()),
      NEW.colaborador_nome,
      NEW.colaborador_cpf,
      v_dia,
      'justificado',
      'Atestado médico - ' || COALESCE(NEW.profissional_nome, 'N/I') || ' - ' || COALESCE(NEW.dias_afastamento::text, '1') || ' dia(s)',
      interval '0',
      'atestado'
    )
    ON CONFLICT (tenant_id, colaborador_cpf, data) DO UPDATE
    SET status = 'justificado',
        observacao = EXCLUDED.observacao,
        tipo_dia = 'atestado'
    WHERE ponto_diario.status IN ('falta', 'atraso', 'incompleto');

    v_dia := v_dia + 1;
  END LOOP;

  RETURN NEW;
END;
$function$;

DO $repair$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT d.tenant_id, d.colaborador_cpf, d.data
    FROM public.ponto_diario d
    WHERE d.tipo_dia = 'atestado'
      AND EXISTS (
        SELECT 1
        FROM public.ponto_marcacoes m
        WHERE m.tenant_id = d.tenant_id
          AND regexp_replace(m.colaborador_cpf, '[^0-9]', '', 'g') = regexp_replace(d.colaborador_cpf, '[^0-9]', '', 'g')
          AND m.data_marcacao = d.data
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.atestados a
        WHERE a.tenant_id = d.tenant_id
          AND regexp_replace(a.colaborador_cpf, '[^0-9]', '', 'g') = regexp_replace(d.colaborador_cpf, '[^0-9]', '', 'g')
          AND COALESCE(a.unidade_afastamento, 'dias') = 'dias'
          AND a.data_inicio_afastamento <= d.data
          AND COALESCE(a.data_fim_afastamento, a.data_inicio_afastamento) >= d.data
      )
  LOOP
    PERFORM public.consolidar_ponto_diario_manual(r.tenant_id, r.colaborador_cpf, r.data);
  END LOOP;
END;
$repair$;