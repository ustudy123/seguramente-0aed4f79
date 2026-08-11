
-- 1) Função que recalcula agregados de campanhas de entrevista guiada
CREATE OR REPLACE FUNCTION public.recalcular_agregados_entrevista_campanha(p_campanha_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total   integer := 0;
  v_radar   jsonb   := '[]'::jsonb;
  v_ips     numeric;
BEGIN
  IF p_campanha_id IS NULL THEN RETURN; END IF;

  SELECT count(*) INTO v_total
    FROM public.psicossocial_entrevistas e
   WHERE e.campanha_id = p_campanha_id
     AND e.status = 'concluida';

  WITH riscos AS (
    SELECT r->>'risco_nome' AS subject,
           LEAST(100, GREATEST(0,
             COALESCE(NULLIF((r->>'probabilidade')::numeric, 0),
                      CASE WHEN (r->>'presente')::boolean IS FALSE THEN 1 ELSE 0 END)
             *
             COALESCE(NULLIF((r->>'severidade')::numeric, 0),
                      CASE WHEN (r->>'presente')::boolean IS FALSE THEN 1 ELSE 0 END)
             * 4
           )) AS valor
      FROM public.psicossocial_entrevistas e
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(e.resumo_ia->'riscos', '[]'::jsonb)) AS r
     WHERE e.campanha_id = p_campanha_id
       AND e.status = 'concluida'
       AND e.resumo_ia IS NOT NULL
       AND r->>'risco_nome' IS NOT NULL
  ), medias AS (
    SELECT subject, round(avg(valor)) AS value
      FROM riscos
     GROUP BY subject
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('subject', subject, 'value', value, 'fullMark', 100)
                            ORDER BY subject), '[]'::jsonb),
         avg(value)
    INTO v_radar, v_ips
    FROM medias;

  UPDATE public.questionario_psicossocial_campanhas c
     SET total_respostas = v_total,
         radar_data = CASE WHEN jsonb_array_length(COALESCE(v_radar,'[]'::jsonb)) > 0
                           THEN v_radar ELSE c.radar_data END,
         ips_score = CASE WHEN v_ips IS NOT NULL THEN round(100 - v_ips) ELSE c.ips_score END,
         updated_at = now()
   WHERE c.id = p_campanha_id;
END;
$$;

-- 2) Trigger nas entrevistas
CREATE OR REPLACE FUNCTION public.trg_entrevista_agrega_campanha()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recalcular_agregados_entrevista_campanha(COALESCE(NEW.campanha_id, OLD.campanha_id));
  IF TG_OP = 'UPDATE' AND OLD.campanha_id IS DISTINCT FROM NEW.campanha_id THEN
    PERFORM public.recalcular_agregados_entrevista_campanha(OLD.campanha_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS entrevista_agrega_campanha ON public.psicossocial_entrevistas;
CREATE TRIGGER entrevista_agrega_campanha
AFTER INSERT OR UPDATE OR DELETE ON public.psicossocial_entrevistas
FOR EACH ROW EXECUTE FUNCTION public.trg_entrevista_agrega_campanha();

-- 3) Backfill dos agregados
DO $backfill$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT campanha_id FROM public.psicossocial_entrevistas WHERE campanha_id IS NOT NULL LOOP
    BEGIN
      PERFORM public.recalcular_agregados_entrevista_campanha(r.campanha_id);
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'falhou %: %', r.campanha_id, SQLERRM;
    END;
  END LOOP;
END
$backfill$;

-- 4) Backfill do GHE das entrevistas concluídas sem vínculo
WITH camp AS (
  SELECT c.id AS campanha_id, c.empresa_id, c.tenant_id,
         COALESCE(c.ghe_ids, ARRAY[]::uuid[]) AS ghe_ids
    FROM public.questionario_psicossocial_campanhas c
), ghe_pares AS (
  SELECT cm.campanha_id, gc.ghe_id, g.codigo,
         lower(trim(ca.nome)) AS cargo,
         COALESCE(lower(trim(d.nome)), '') AS depto
    FROM public.psicossocial_ghe_cargos gc
    JOIN public.psicossocial_ghe g ON g.id = gc.ghe_id
    JOIN camp cm ON cm.tenant_id = g.tenant_id
                AND (g.empresa_id IS NULL OR cm.empresa_id IS NULL OR g.empresa_id = cm.empresa_id)
    JOIN public.cargos ca ON ca.id = gc.cargo_id
    LEFT JOIN public.departamentos d ON d.id = gc.departamento_id
), alvo AS (
  SELECT DISTINCT ON (e.id) e.id AS entrevista_id,
         COALESCE(gp.ghe_id,
                  CASE WHEN array_length(cm.ghe_ids,1) = 1 THEN cm.ghe_ids[1] END) AS ghe_id
    FROM public.psicossocial_entrevistas e
    JOIN camp cm ON cm.campanha_id = e.campanha_id
    LEFT JOIN public.admissoes a ON a.id = e.colaborador_id
    LEFT JOIN ghe_pares gp ON gp.campanha_id = e.campanha_id
         AND gp.cargo = lower(trim(a.cargo))
         AND (gp.depto = COALESCE(lower(trim(a.departamento)), '') OR gp.depto = '')
   WHERE e.ghe_id_snapshot IS NULL
   ORDER BY e.id, gp.codigo NULLS LAST
)
UPDATE public.psicossocial_entrevistas e
   SET ghe_id_snapshot = alvo.ghe_id
  FROM alvo
 WHERE e.id = alvo.entrevista_id
   AND alvo.ghe_id IS NOT NULL;
