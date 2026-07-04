
-- 1. Geofence columns on empresa_cadastro
ALTER TABLE public.empresa_cadastro
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS raio_geofence_metros integer DEFAULT 150,
  ADD COLUMN IF NOT EXISTS geofence_ativo boolean DEFAULT false;

-- 2. Geofence columns on filiais (opcional; sobrepõe a matriz quando definido)
ALTER TABLE public.filiais
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS raio_geofence_metros integer,
  ADD COLUMN IF NOT EXISTS geofence_ativo boolean DEFAULT false;

-- 3. Ponto marcações — resultado do cálculo
ALTER TABLE public.ponto_marcacoes
  ADD COLUMN IF NOT EXISTS distancia_metros numeric,
  ADD COLUMN IF NOT EXISTS dentro_cerca boolean,
  ADD COLUMN IF NOT EXISTS geofence_ref text;

-- 4. Trigger: calcula distância e dentro_cerca no insert
CREATE OR REPLACE FUNCTION public.calc_ponto_geofence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_filial_nome text;
  v_lat numeric;
  v_lon numeric;
  v_raio integer;
  v_ref text;
  v_dist_km double precision;
BEGIN
  -- Sem coordenadas na batida, nada a fazer
  IF NEW.latitude IS NULL OR NEW.longitude IS NULL THEN
    RETURN NEW;
  END IF;

  -- Buscar filial do colaborador (por nome) na mesma empresa
  SELECT a.filial INTO v_filial_nome
    FROM public.admissoes a
   WHERE a.id = NEW.colaborador_id
   LIMIT 1;

  IF v_filial_nome IS NOT NULL THEN
    SELECT f.latitude, f.longitude,
           COALESCE(f.raio_geofence_metros, 150),
           'filial:' || f.id::text
      INTO v_lat, v_lon, v_raio, v_ref
      FROM public.filiais f
     WHERE f.tenant_id = NEW.tenant_id
       AND (NEW.empresa_id IS NULL OR f.empresa_id = NEW.empresa_id)
       AND f.nome = v_filial_nome
       AND f.geofence_ativo = true
       AND f.latitude IS NOT NULL
       AND f.longitude IS NOT NULL
     LIMIT 1;
  END IF;

  -- Fallback para empresa_cadastro
  IF v_lat IS NULL AND NEW.empresa_id IS NOT NULL THEN
    SELECT e.latitude, e.longitude,
           COALESCE(e.raio_geofence_metros, 150),
           'empresa:' || e.id::text
      INTO v_lat, v_lon, v_raio, v_ref
      FROM public.empresa_cadastro e
     WHERE e.id = NEW.empresa_id
       AND e.geofence_ativo = true
       AND e.latitude IS NOT NULL
       AND e.longitude IS NOT NULL
     LIMIT 1;
  END IF;

  IF v_lat IS NULL THEN
    RETURN NEW; -- geofence inativo ou sem referência
  END IF;

  v_dist_km := public.haversine_distance(NEW.latitude::double precision, NEW.longitude::double precision, v_lat::double precision, v_lon::double precision);
  NEW.distancia_metros := round((v_dist_km * 1000)::numeric, 1);
  NEW.dentro_cerca := NEW.distancia_metros <= v_raio;
  NEW.geofence_ref := v_ref;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ponto_geofence ON public.ponto_marcacoes;
CREATE TRIGGER trg_ponto_geofence
  BEFORE INSERT ON public.ponto_marcacoes
  FOR EACH ROW EXECUTE FUNCTION public.calc_ponto_geofence();
