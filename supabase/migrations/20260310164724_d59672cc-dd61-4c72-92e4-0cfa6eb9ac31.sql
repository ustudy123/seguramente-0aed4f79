-- Adicionar colunas para índices derivados na tabela de campanhas
ALTER TABLE public.questionario_psicossocial_campanhas
ADD COLUMN IF NOT EXISTS irps_score NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS ibo_score NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS ibd_score NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS irec_score NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS icop_score NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS inot_score NUMERIC(5,2);

COMMENT ON COLUMN public.questionario_psicossocial_campanhas.irps_score IS 'IRP-S: Índice de Risco Psicossocial (0-100, ponderado)';
COMMENT ON COLUMN public.questionario_psicossocial_campanhas.ibo_score IS 'IBO-S: Índice de Burnout Organizacional (0-100, ponderado)';
COMMENT ON COLUMN public.questionario_psicossocial_campanhas.ibd_score IS 'IBD-S: Índice de Boreout (0-100, ponderado)';
COMMENT ON COLUMN public.questionario_psicossocial_campanhas.irec_score IS 'IREC-S: Índice de Recuperação (0-100, ponderado)';
COMMENT ON COLUMN public.questionario_psicossocial_campanhas.icop_score IS 'ICOP-S: Índice de Clareza Organizacional de Papéis (0-100, ponderado)';
COMMENT ON COLUMN public.questionario_psicossocial_campanhas.inot_score IS 'INOT-S: Índice de Risco do Trabalho Noturno (0-100)';

-- Atualizar trigger para agregar índices derivados
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
  v_avg_irps NUMERIC;
  v_avg_ibo NUMERIC;
  v_avg_ibd NUMERIC;
  v_avg_irec NUMERIC;
  v_avg_icop NUMERIC;
  v_avg_inot NUMERIC;
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM public.questionario_psicossocial_respostas
  WHERE campanha_id = NEW.campanha_id;

  SELECT 
    ROUND(AVG((indicadores->>'IPS')::numeric)),
    ROUND(AVG((indicadores->>'IRP_S')::numeric)),
    ROUND(AVG((indicadores->>'IBO_S')::numeric)),
    ROUND(AVG((indicadores->>'IBD_S')::numeric)),
    ROUND(AVG((indicadores->>'IREC_S')::numeric)),
    ROUND(AVG((indicadores->>'ICOP_S')::numeric)),
    ROUND(AVG((indicadores->>'INOT_S')::numeric))
  INTO v_avg_ips, v_avg_irps, v_avg_ibo, v_avg_ibd, v_avg_irec, v_avg_icop, v_avg_inot
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
    irps_score = v_avg_irps,
    ibo_score = v_avg_ibo,
    ibd_score = v_avg_ibd,
    irec_score = v_avg_irec,
    icop_score = v_avg_icop,
    inot_score = v_avg_inot,
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

-- Recalcular campanhas existentes com novos índices
DO $$
DECLARE
  v_camp RECORD;
  v_total INT;
  v_avg_ips NUMERIC;
  v_classificacao TEXT;
  v_radar JSONB;
  v_avg_irps NUMERIC;
  v_avg_ibo NUMERIC;
  v_avg_ibd NUMERIC;
  v_avg_irec NUMERIC;
  v_avg_icop NUMERIC;
  v_avg_inot NUMERIC;
BEGIN
  FOR v_camp IN 
    SELECT DISTINCT campanha_id FROM public.questionario_psicossocial_respostas
  LOOP
    SELECT COUNT(*) INTO v_total
    FROM public.questionario_psicossocial_respostas
    WHERE campanha_id = v_camp.campanha_id;

    SELECT 
      ROUND(AVG((indicadores->>'IPS')::numeric)),
      ROUND(AVG((indicadores->>'IRP_S')::numeric)),
      ROUND(AVG((indicadores->>'IBO_S')::numeric)),
      ROUND(AVG((indicadores->>'IBD_S')::numeric)),
      ROUND(AVG((indicadores->>'IREC_S')::numeric)),
      ROUND(AVG((indicadores->>'ICOP_S')::numeric)),
      ROUND(AVG((indicadores->>'INOT_S')::numeric))
    INTO v_avg_ips, v_avg_irps, v_avg_ibo, v_avg_ibd, v_avg_irec, v_avg_icop, v_avg_inot
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
      irps_score = v_avg_irps,
      ibo_score = v_avg_ibo,
      ibd_score = v_avg_ibd,
      irec_score = v_avg_irec,
      icop_score = v_avg_icop,
      inot_score = v_avg_inot,
      updated_at = now()
    WHERE id = v_camp.campanha_id;
  END LOOP;
END;
$$;