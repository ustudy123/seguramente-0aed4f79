CREATE OR REPLACE FUNCTION gerar_alertas_ponto()
RETURNS TRIGGER AS $$
DECLARE
  v_horas_trab_min INT;
  v_anterior_saida TIME;
  v_interjornada_min INT;
BEGIN
  v_horas_trab_min := COALESCE(EXTRACT(EPOCH FROM NEW.horas_trabalhadas)::INT / 60, 0);

  IF v_horas_trab_min > 600 THEN
    INSERT INTO public.ponto_alertas (tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf, tipo, severidade, titulo, descricao, data_referencia)
    VALUES (NEW.tenant_id, NEW.empresa_id, NEW.colaborador_id, NEW.colaborador_nome, NEW.colaborador_cpf,
      'excesso_jornada', 'alta',
      'Excesso de jornada: ' || NEW.colaborador_nome,
      'Jornada de ' || (v_horas_trab_min / 60) || 'h ' || (v_horas_trab_min % 60) || 'min em ' || NEW.data::TEXT,
      NEW.data)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_horas_trab_min > 360 AND COALESCE(NEW.intervalo_intrajornada_minutos, 0) < 60 AND COALESCE(NEW.intervalo_intrajornada_minutos, 0) > 0 THEN
    INSERT INTO public.ponto_alertas (tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf, tipo, severidade, titulo, descricao, data_referencia)
    VALUES (NEW.tenant_id, NEW.empresa_id, NEW.colaborador_id, NEW.colaborador_nome, NEW.colaborador_cpf,
      'intervalo_suprimido', 'alta',
      'Intervalo intrajornada insuficiente: ' || NEW.colaborador_nome,
      'Intervalo de apenas ' || NEW.intervalo_intrajornada_minutos || 'min em ' || NEW.data::TEXT || '. Minimo legal: 60min.',
      NEW.data)
    ON CONFLICT DO NOTHING;
  END IF;

  IF NEW.entrada IS NOT NULL THEN
    SELECT saida INTO v_anterior_saida
    FROM public.ponto_diario
    WHERE tenant_id = NEW.tenant_id
      AND colaborador_cpf = NEW.colaborador_cpf
      AND data = NEW.data - 1
      AND saida IS NOT NULL;

    IF v_anterior_saida IS NOT NULL THEN
      v_interjornada_min := EXTRACT(EPOCH FROM (('24:00:00'::TIME - v_anterior_saida) + NEW.entrada))::INT / 60;
      IF v_interjornada_min < 660 THEN
        INSERT INTO public.ponto_alertas (tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf, tipo, severidade, titulo, descricao, data_referencia)
        VALUES (NEW.tenant_id, NEW.empresa_id, NEW.colaborador_id, NEW.colaborador_nome, NEW.colaborador_cpf,
          'interjornada_insuficiente', 'critica',
          'Interjornada < 11h: ' || NEW.colaborador_nome,
          'Descanso de apenas ' || (v_interjornada_min / 60) || 'h ' || (v_interjornada_min % 60) || 'min entre ' || (NEW.data - 1)::TEXT || ' e ' || NEW.data::TEXT,
          NEW.data)
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END IF;

  IF NEW.status = 'incompleto' THEN
    INSERT INTO public.ponto_alertas (tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf, tipo, severidade, titulo, descricao, data_referencia)
    VALUES (NEW.tenant_id, NEW.empresa_id, NEW.colaborador_id, NEW.colaborador_nome, NEW.colaborador_cpf,
      'falta_marcacao', 'media',
      'Marcacao incompleta: ' || NEW.colaborador_nome,
      'Registro incompleto em ' || NEW.data::TEXT,
      NEW.data)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;