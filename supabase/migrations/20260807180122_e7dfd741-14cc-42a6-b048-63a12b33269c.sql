CREATE OR REPLACE FUNCTION public.ponto_fechar_competencia_banco(
  p_tenant_id uuid,
  p_empresa_id uuid,
  p_competencia text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_comp_seguinte text := to_char(to_date(p_competencia || '-01','YYYY-MM-DD') + interval '1 month','YYYY-MM');
  v_n integer := 0;
  r RECORD;
  v_atual int;
BEGIN
  FOR r IN
    SELECT id, colaborador_cpf, saldo_anterior_minutos, creditos_minutos, debitos_minutos, compensados_minutos
    FROM public.ponto_banco_horas
    WHERE tenant_id = p_tenant_id
      AND competencia = p_competencia
      AND (p_empresa_id IS NULL OR empresa_id = p_empresa_id)
  LOOP
    -- RN29: o resultado positivo do ciclo foi pago como HE no espelho -> não transita.
    -- Apenas o resultado negativo é transferido para a competência seguinte.
    v_atual := LEAST(
      COALESCE(r.saldo_anterior_minutos,0)
      + COALESCE(r.creditos_minutos,0)
      - COALESCE(r.debitos_minutos,0)
      - COALESCE(r.compensados_minutos,0), 0);

    UPDATE public.ponto_banco_horas
       SET saldo_atual_minutos = v_atual,
           convertido_extras = true,
           updated_at = now()
     WHERE id = r.id;

    UPDATE public.ponto_banco_horas b
       SET saldo_anterior_minutos = v_atual,
           saldo_atual_minutos = v_atual
                                 + COALESCE(b.creditos_minutos,0)
                                 - COALESCE(b.debitos_minutos,0)
                                 - COALESCE(b.compensados_minutos,0),
           updated_at = now()
     WHERE b.tenant_id = p_tenant_id
       AND b.competencia = v_comp_seguinte
       AND regexp_replace(COALESCE(b.colaborador_cpf,''),'[^0-9]','','g')
           = regexp_replace(COALESCE(r.colaborador_cpf,''),'[^0-9]','','g');

    v_n := v_n + 1;
  END LOOP;

  UPDATE public.ponto_espelhos e
     SET total_horas_extras_50_minutos = GREATEST(0, COALESCE(e.banco_horas_saldo_minutos,0))
                                          - COALESCE(e.total_horas_extras_100_minutos,0)
   WHERE e.tenant_id = p_tenant_id
     AND e.competencia = p_competencia
     AND (p_empresa_id IS NULL OR e.empresa_id = p_empresa_id)
     AND COALESCE(e.banco_horas_saldo_minutos,0) > 0
     AND COALESCE(e.total_horas_extras_50_minutos,0) = 0
     AND COALESCE(e.total_horas_extras_100_minutos,0) = 0;

  RETURN v_n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ponto_fechar_competencia_banco(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ponto_fechar_competencia_banco(uuid, uuid, text) TO service_role;

-- Reconstrução da cadeia de saldos a partir das movimentações.
DO $$
DECLARE
  c RECORD;
  b RECORD;
  v_ant int;
  v_cred int;
  v_deb int;
  v_comp int;
  v_atual int;
  v_fechado boolean;
  v_first boolean;
BEGIN
  FOR c IN
    SELECT DISTINCT tenant_id, regexp_replace(COALESCE(colaborador_cpf,''),'[^0-9]','','g') AS cpf
    FROM public.ponto_banco_horas
  LOOP
    v_first := true;
    v_ant := 0;
    FOR b IN
      SELECT id, competencia, empresa_id, saldo_anterior_minutos
      FROM public.ponto_banco_horas
      WHERE tenant_id = c.tenant_id
        AND regexp_replace(COALESCE(colaborador_cpf,''),'[^0-9]','','g') = c.cpf
      ORDER BY competencia
    LOOP
      SELECT COALESCE(SUM(minutos) FILTER (WHERE tipo='credito'),0),
             COALESCE(SUM(minutos) FILTER (WHERE tipo='debito'),0),
             COALESCE(SUM(minutos) FILTER (WHERE tipo='compensacao'),0)
        INTO v_cred, v_deb, v_comp
      FROM public.ponto_banco_horas_movimentacoes
      WHERE banco_horas_id = b.id;

      IF v_first THEN
        v_ant := COALESCE(b.saldo_anterior_minutos, 0);
        v_first := false;
      END IF;

      v_atual := v_ant + v_cred - v_deb - v_comp;

      SELECT EXISTS (
        SELECT 1 FROM public.ponto_fechamentos f
        WHERE f.tenant_id = c.tenant_id
          AND f.competencia = b.competencia
          AND f.status = 'fechado'
          AND (f.empresa_id IS NOT DISTINCT FROM b.empresa_id OR f.empresa_id IS NULL)
      ) INTO v_fechado;

      IF v_fechado THEN
        v_atual := LEAST(v_atual, 0);
      END IF;

      UPDATE public.ponto_banco_horas
         SET saldo_anterior_minutos = v_ant,
             creditos_minutos = v_cred,
             debitos_minutos = v_deb,
             compensados_minutos = v_comp,
             saldo_atual_minutos = v_atual,
             convertido_extras = v_fechado,
             updated_at = now()
       WHERE id = b.id;

      v_ant := v_atual;
    END LOOP;
  END LOOP;
END $$;