CREATE OR REPLACE FUNCTION public.reapurar_banco_horas_competencias(
  p_tenant_id uuid,
  p_empresa_id uuid DEFAULT NULL,
  p_desde text DEFAULT NULL,
  p_ate text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_has_access boolean := false;
  v_total int := 0;
  v_alterados int := 0;
  v_detalhes jsonb := '[]'::jsonb;
  v_antes int;
  v_depois int;
  r RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.usuarios_base ub
    WHERE ub.auth_user_id = v_uid AND ub.tenant_id = p_tenant_id AND ub.status = 'ativo'
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    SELECT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = v_uid AND p.tenant_id = p_tenant_id
    ) INTO v_has_access;
  END IF;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Sem acesso a este tenant';
  END IF;

  IF NOT public.has_minimum_role(v_uid, 'manager'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas gestor/RH pode reapurar o banco de horas';
  END IF;

  FOR r IN
    SELECT bh.id, bh.colaborador_cpf, bh.colaborador_nome, bh.competencia, bh.empresa_id,
           bh.saldo_atual_minutos
    FROM public.ponto_banco_horas bh
    WHERE bh.tenant_id = p_tenant_id
      AND bh.colaborador_cpf IS NOT NULL
      AND (p_empresa_id IS NULL OR bh.empresa_id = p_empresa_id OR bh.empresa_id IS NULL)
      AND bh.competencia ~ '^\d{4}-\d{2}$'
      AND (p_desde IS NULL OR bh.competencia >= p_desde)
      AND (p_ate IS NULL OR bh.competencia <= p_ate)
    ORDER BY bh.competencia, bh.colaborador_nome
  LOOP
    v_antes := COALESCE(r.saldo_atual_minutos, 0);

    BEGIN
      PERFORM public.apurar_banco_horas_colaborador(
        p_tenant_id, r.colaborador_cpf, r.competencia, COALESCE(p_empresa_id, r.empresa_id)
      );
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;

    SELECT COALESCE(saldo_atual_minutos, 0) INTO v_depois
    FROM public.ponto_banco_horas WHERE id = r.id;

    v_total := v_total + 1;

    IF v_depois IS DISTINCT FROM v_antes THEN
      v_alterados := v_alterados + 1;
      v_detalhes := v_detalhes || jsonb_build_object(
        'colaborador_nome', r.colaborador_nome,
        'colaborador_cpf', r.colaborador_cpf,
        'competencia', r.competencia,
        'saldo_antes_minutos', v_antes,
        'saldo_depois_minutos', v_depois,
        'diferenca_minutos', v_depois - v_antes
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'registros_processados', v_total,
    'registros_ajustados', v_alterados,
    'detalhes', v_detalhes
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.reapurar_banco_horas_competencias(uuid, uuid, text, text) TO authenticated;