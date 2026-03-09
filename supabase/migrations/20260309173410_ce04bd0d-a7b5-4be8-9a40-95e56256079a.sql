-- Trigger function: atualiza ips_score, ips_classificacao, total_respostas e radar_data
CREATE OR REPLACE FUNCTION public.atualizar_ips_campanha()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total INT;
  v_avg_ips NUMERIC;
  v_classificacao TEXT;
  v_radar JSONB;
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM public.questionario_psicossocial_respostas
  WHERE campanha_id = NEW.campanha_id;

  SELECT ROUND(AVG((indicadores->>'IPS')::numeric))
  INTO v_avg_ips
  FROM public.questionario_psicossocial_respostas
  WHERE campanha_id = NEW.campanha_id
    AND indicadores IS NOT NULL
    AND indicadores->>'IPS' IS NOT NULL;

  v_classificacao := CASE
    WHEN v_avg_ips >= 80 THEN 'saudavel'
    WHEN v_avg_ips >= 65 THEN 'estavel'
    WHEN v_avg_ips >= 50 THEN 'atencao'
    WHEN v_avg_ips >= 35 THEN 'risco'
    ELSE 'critico'
  END;

  SELECT jsonb_agg(
    jsonb_build_object(
      'subject', agg.subject,
      'value', ROUND(agg.avg_val),
      'fullMark', 100
    ) ORDER BY agg.min_ord
  )
  INTO v_radar
  FROM (
    SELECT 
      elem->>'subject' AS subject,
      AVG((elem->>'value')::numeric) AS avg_val,
      MIN(ord) AS min_ord
    FROM public.questionario_psicossocial_respostas r,
         jsonb_array_elements(r.indicadores->'radar') WITH ORDINALITY AS t(elem, ord)
    WHERE r.campanha_id = NEW.campanha_id
      AND r.indicadores IS NOT NULL
      AND r.indicadores->'radar' IS NOT NULL
    GROUP BY elem->>'subject'
  ) agg;

  UPDATE public.questionario_psicossocial_campanhas
  SET 
    total_respostas = v_total,
    ips_score = v_avg_ips,
    ips_classificacao = v_classificacao,
    radar_data = COALESCE(v_radar, radar_data),
    updated_at = now()
  WHERE id = NEW.campanha_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_atualizar_ips_campanha ON public.questionario_psicossocial_respostas;
CREATE TRIGGER trg_atualizar_ips_campanha
  AFTER INSERT ON public.questionario_psicossocial_respostas
  FOR EACH ROW
  EXECUTE FUNCTION public.atualizar_ips_campanha();

-- Recalcular campanhas existentes
DO $$
DECLARE
  v_camp RECORD;
  v_total INT;
  v_avg_ips NUMERIC;
  v_classificacao TEXT;
  v_radar JSONB;
BEGIN
  FOR v_camp IN 
    SELECT DISTINCT campanha_id FROM public.questionario_psicossocial_respostas
  LOOP
    SELECT COUNT(*) INTO v_total
    FROM public.questionario_psicossocial_respostas
    WHERE campanha_id = v_camp.campanha_id;

    SELECT ROUND(AVG((indicadores->>'IPS')::numeric))
    INTO v_avg_ips
    FROM public.questionario_psicossocial_respostas
    WHERE campanha_id = v_camp.campanha_id
      AND indicadores IS NOT NULL
      AND indicadores->>'IPS' IS NOT NULL;

    v_classificacao := CASE
      WHEN v_avg_ips >= 80 THEN 'saudavel'
      WHEN v_avg_ips >= 65 THEN 'estavel'
      WHEN v_avg_ips >= 50 THEN 'atencao'
      WHEN v_avg_ips >= 35 THEN 'risco'
      ELSE 'critico'
    END;

    SELECT jsonb_agg(
      jsonb_build_object(
        'subject', agg.subject,
        'value', ROUND(agg.avg_val),
        'fullMark', 100
      ) ORDER BY agg.min_ord
    )
    INTO v_radar
    FROM (
      SELECT 
        elem->>'subject' AS subject,
        AVG((elem->>'value')::numeric) AS avg_val,
        MIN(ord) AS min_ord
      FROM public.questionario_psicossocial_respostas r,
           jsonb_array_elements(r.indicadores->'radar') WITH ORDINALITY AS t(elem, ord)
      WHERE r.campanha_id = v_camp.campanha_id
        AND r.indicadores IS NOT NULL
        AND r.indicadores->'radar' IS NOT NULL
      GROUP BY elem->>'subject'
    ) agg;

    UPDATE public.questionario_psicossocial_campanhas
    SET 
      total_respostas = v_total,
      ips_score = v_avg_ips,
      ips_classificacao = v_classificacao,
      radar_data = COALESCE(v_radar, radar_data),
      updated_at = now()
    WHERE id = v_camp.campanha_id;
  END LOOP;
END;
$$;