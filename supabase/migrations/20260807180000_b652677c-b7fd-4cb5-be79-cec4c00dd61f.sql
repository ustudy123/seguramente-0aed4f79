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
  v_ant int;
  v_atual int;
BEGIN
  FOR r IN
    SELECT id, colaborador_cpf, saldo_anterior_minutos, debitos_minutos, compensados_minutos
    FROM public.ponto_banco_horas
    WHERE tenant_id = p_tenant_id
      AND competencia = p_competencia
      AND (p_empresa_id IS NULL OR empresa_id = p_empresa_id)
  LOOP
    -- RN29: saldo positivo foi pago como HE no espelho -> zera.
    v_ant := LEAST(COALESCE(r.saldo_anterior_minutos,0), 0);
    v_atual := v_ant - COALESCE(r.debitos_minutos,0) - COALESCE(r.compensados_minutos,0);
    v_atual := LEAST(v_atual, 0);

    UPDATE public.ponto_banco_horas
       SET saldo_anterior_minutos = v_ant,
           creditos_minutos = 0,
           saldo_atual_minutos = v_atual,
           convertido_extras = true,
           updated_at = now()
     WHERE id = r.id;

    -- Origem única do Saldo Anterior da competência seguinte.
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

  -- RN28 (rede de segurança): espelho com saldo positivo e HE zeradas.
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

-- Reprocessa o fechamento já feito de 2026-07 (todas as empresas com fechamento fechado).
DO $$
DECLARE f RECORD;
BEGIN
  FOR f IN SELECT tenant_id, empresa_id, competencia
             FROM public.ponto_fechamentos
            WHERE status = 'fechado'
  LOOP
    PERFORM public.ponto_fechar_competencia_banco(f.tenant_id, f.empresa_id, f.competencia);
  END LOOP;
END $$;