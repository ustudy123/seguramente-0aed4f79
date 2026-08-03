-- Espelho unificado: retorna o saldo diário (mesma fonte da Apuração)
-- para todos os colaboradores CLT da empresa em uma data específica.
CREATE OR REPLACE FUNCTION public.ponto_saldo_dia_empresa(
  p_tenant_id uuid,
  p_empresa_id uuid,
  p_data date
)
RETURNS TABLE(
  colaborador_cpf text,
  dia date,
  entrada time without time zone,
  saida time without time zone,
  trabalhado_min integer,
  jornada_min integer,
  saldo_min integer,
  protegido boolean,
  equalizacao boolean,
  excedente_retido_min integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comp text := to_char(p_data, 'YYYY-MM');
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT regexp_replace(COALESCE(c.cpf, ''), '\D', '', 'g') AS cpf
    FROM public.colaboradores c
    WHERE c.tenant_id = p_tenant_id
      AND (p_empresa_id IS NULL OR c.empresa_id = p_empresa_id)
      AND COALESCE(c.cpf, '') <> ''
  LOOP
    RETURN QUERY
      SELECT r.cpf, s.dia, s.entrada, s.saida, s.trabalhado_min, s.jornada_min,
             s.saldo_min, s.protegido, s.equalizacao, s.excedente_retido_min
      FROM public.ponto_saldo_dias_competencia(p_tenant_id, r.cpf, v_comp) s
      WHERE s.dia = p_data;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ponto_saldo_dia_empresa(uuid, uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ponto_saldo_dia_empresa(uuid, uuid, date) TO service_role;