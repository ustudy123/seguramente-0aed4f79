-- 1) Serviços ativos visíveis publicamente
DROP POLICY IF EXISTS "Anyone authenticated can view active services" ON public.marketplace_servicos;
CREATE POLICY "Public can view active services"
  ON public.marketplace_servicos FOR SELECT
  TO anon, authenticated
  USING (ativo = true);

GRANT SELECT ON public.marketplace_servicos TO anon;
GRANT SELECT ON public.marketplace_categorias TO anon;
GRANT SELECT ON public.marketplace_pacotes TO anon;
GRANT SELECT ON public.marketplace_escopo_habilitacao TO anon;

-- 2) Visão pública de profissionais (sem PII: sem email/telefone)
CREATE OR REPLACE VIEW public.marketplace_profissionais_publico AS
SELECT
  p.id,
  p.nome_completo,
  p.foto_url,
  p.bio,
  p.formacao_academica,
  p.registro_profissional,
  p.conselho,
  p.uf_registro,
  p.certificacoes,
  p.especialidades,
  p.areas_atuacao,
  p.modalidades_atendimento,
  p.cidade,
  p.estado,
  p.status,
  p.selo_verificado,
  p.nota_media,
  p.total_avaliacoes,
  p.total_servicos_executados,
  p.tem_atestado_capacidade,
  p.created_at
FROM public.marketplace_profissionais p
WHERE p.status = 'ativo';

ALTER VIEW public.marketplace_profissionais_publico SET (security_invoker = off);
GRANT SELECT ON public.marketplace_profissionais_publico TO anon, authenticated;

-- 3) Busca pública por proximidade (sem PII)
CREATE OR REPLACE FUNCTION public.buscar_profissionais_proximos_publico(
  p_lat double precision,
  p_lon double precision,
  p_raio_km double precision DEFAULT 500
)
RETURNS TABLE (
  id uuid,
  nome_completo text,
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
  distancia_km double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.nome_completo,
    p.foto_url,
    p.bio,
    p.registro_profissional,
    p.conselho,
    p.especialidades,
    p.areas_atuacao,
    p.modalidades_atendimento,
    p.cidade,
    p.estado,
    p.status::text,
    p.selo_verificado,
    p.nota_media,
    p.total_avaliacoes,
    p.total_servicos_executados,
    p.tem_atestado_capacidade,
    (6371 * acos(
      LEAST(1, GREATEST(-1,
        cos(radians(p_lat)) * cos(radians(p.latitude)) *
        cos(radians(p.longitude) - radians(p_lon)) +
        sin(radians(p_lat)) * sin(radians(p.latitude))
      ))
    ))::double precision AS distancia_km
  FROM public.marketplace_profissionais p
  WHERE p.status = 'ativo'
    AND p.latitude IS NOT NULL
    AND p.longitude IS NOT NULL
    AND (6371 * acos(
      LEAST(1, GREATEST(-1,
        cos(radians(p_lat)) * cos(radians(p.latitude)) *
        cos(radians(p.longitude) - radians(p_lon)) +
        sin(radians(p_lat)) * sin(radians(p.latitude))
      ))
    )) <= p_raio_km
  ORDER BY p.tem_atestado_capacidade DESC NULLS LAST, distancia_km ASC;
$$;

REVOKE ALL ON FUNCTION public.buscar_profissionais_proximos_publico(double precision, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buscar_profissionais_proximos_publico(double precision, double precision, double precision) TO anon, authenticated;