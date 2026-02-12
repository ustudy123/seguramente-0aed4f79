
-- Add geolocation columns to marketplace_profissionais
ALTER TABLE public.marketplace_profissionais
ADD COLUMN latitude double precision,
ADD COLUMN longitude double precision;

-- Create index for geolocation queries
CREATE INDEX idx_marketplace_prof_geo ON public.marketplace_profissionais (latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Haversine distance function (returns km)
CREATE OR REPLACE FUNCTION public.haversine_distance(
  lat1 double precision, lon1 double precision,
  lat2 double precision, lon2 double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT 6371 * 2 * asin(sqrt(
    sin(radians((lat2 - lat1) / 2)) ^ 2 +
    cos(radians(lat1)) * cos(radians(lat2)) *
    sin(radians((lon2 - lon1) / 2)) ^ 2
  ))
$$;

-- Function to search professionals ordered by proximity
CREATE OR REPLACE FUNCTION public.buscar_profissionais_proximos(
  p_lat double precision,
  p_lon double precision,
  p_raio_km double precision DEFAULT 500
)
RETURNS TABLE (
  id uuid,
  nome_completo text,
  email text,
  telefone text,
  foto_url text,
  bio text,
  registro_profissional text,
  conselho text,
  especialidades text[],
  areas_atuacao text[],
  modalidades_atendimento text[],
  cidade text,
  estado text,
  status text,
  selo_verificado boolean,
  nota_media numeric,
  total_avaliacoes integer,
  total_servicos_executados integer,
  tem_atestado_capacidade boolean,
  latitude double precision,
  longitude double precision,
  distancia_km double precision
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    p.id, p.nome_completo, p.email, p.telefone, p.foto_url, p.bio,
    p.registro_profissional, p.conselho, p.especialidades, p.areas_atuacao,
    p.modalidades_atendimento, p.cidade, p.estado, p.status,
    p.selo_verificado, p.nota_media, p.total_avaliacoes,
    p.total_servicos_executados, p.tem_atestado_capacidade,
    p.latitude, p.longitude,
    public.haversine_distance(p_lat, p_lon, p.latitude, p.longitude) AS distancia_km
  FROM public.marketplace_profissionais p
  WHERE p.status = 'ativo'
    AND p.latitude IS NOT NULL
    AND p.longitude IS NOT NULL
    AND public.haversine_distance(p_lat, p_lon, p.latitude, p.longitude) <= p_raio_km
  ORDER BY
    p.tem_atestado_capacidade DESC,
    public.haversine_distance(p_lat, p_lon, p.latitude, p.longitude) ASC
$$;
