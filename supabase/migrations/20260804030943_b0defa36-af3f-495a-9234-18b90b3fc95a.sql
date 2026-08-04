CREATE OR REPLACE FUNCTION public.ponto_excedente_pendentes(p_tenant_id uuid, p_competencia text)
RETURNS TABLE(
  colaborador_cpf text,
  colaborador_nome text,
  dia date,
  trabalhado_min integer,
  jornada_min integer,
  excedente_retido_min integer,
  motivo_ajuste text,
  dias_parado integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  r RECORD;
BEGIN
  IF auth.uid() IS NOT NULL
     AND public.get_user_tenant_id() IS DISTINCT FROM p_tenant_id
     AND NOT public.is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  FOR r IN
    SELECT DISTINCT b.colaborador_cpf AS cpf
    FROM public.ponto_banco_horas b
    WHERE b.tenant_id = p_tenant_id AND b.competencia = p_competencia
  LOOP
    BEGIN
      RETURN QUERY
      SELECT
        r.cpf,
        (SELECT d.colaborador_nome FROM public.ponto_diario d
          WHERE d.tenant_id = p_tenant_id
            AND regexp_replace(d.colaborador_cpf, '[^0-9]', '', 'g') = regexp_replace(r.cpf, '[^0-9]', '', 'g')
            AND d.data = s.dia LIMIT 1),
        s.dia,
        s.trabalhado_min,
        s.jornada_min,
        s.excedente_retido_min,
        (SELECT COALESCE(a.motivo, a.observacao) FROM public.ponto_ajustes a
          WHERE a.tenant_id = p_tenant_id
            AND regexp_replace(a.colaborador_cpf, '[^0-9]', '', 'g') = regexp_replace(r.cpf, '[^0-9]', '', 'g')
            AND a.data_referencia = s.dia AND a.status = 'aprovado'
          ORDER BY a.created_at DESC LIMIT 1),
        GREATEST(0, (CURRENT_DATE - s.dia))::int
      FROM public.ponto_saldo_dias_competencia(p_tenant_id, r.cpf, p_competencia) s
      WHERE s.excedente_retido_min > 0
        AND NOT EXISTS (
          SELECT 1 FROM public.ponto_excedente_decisao x
          WHERE x.tenant_id = p_tenant_id
            AND regexp_replace(x.colaborador_cpf, '[^0-9]', '', 'g') = regexp_replace(r.cpf, '[^0-9]', '', 'g')
            AND x.dia = s.dia
        );
    EXCEPTION WHEN OTHERS THEN
      -- Colaborador sem escala/config válida não pode derrubar a fila inteira.
      CONTINUE;
    END;
  END LOOP;
END;
$fn$;