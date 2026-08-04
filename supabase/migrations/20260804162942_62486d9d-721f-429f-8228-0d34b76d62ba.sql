CREATE OR REPLACE FUNCTION public.ponto_excedente_decidir(p_tenant_id uuid, p_colaborador_cpf text, p_dia date, p_decisao text, p_justificativa text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cpf text := regexp_replace(COALESCE(p_colaborador_cpf, ''), '[^0-9]', '', 'g');
  v_nome text;
  v_empresa uuid;
  v_motivo text;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF public.get_user_tenant_id() IS DISTINCT FROM p_tenant_id
       OR NOT public.has_minimum_role(auth.uid(), 'manager') THEN
      RAISE EXCEPTION 'Sem permissão';
    END IF;
  END IF;

  IF p_decisao NOT IN ('liberado', 'irregularidade') THEN
    RAISE EXCEPTION 'Decisão inválida: use liberado ou irregularidade';
  END IF;

  IF COALESCE(trim(p_justificativa), '') = '' THEN
    RAISE EXCEPTION 'Justificativa é obrigatória (art. 61 CLT)';
  END IF;

  SELECT d.colaborador_nome, d.empresa_id INTO v_nome, v_empresa
  FROM public.ponto_diario d
  WHERE d.tenant_id = p_tenant_id
    AND regexp_replace(d.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf
    AND d.data = p_dia
  LIMIT 1;

  SELECT a.motivo INTO v_motivo
  FROM public.ponto_ajustes a
  WHERE a.tenant_id = p_tenant_id
    AND regexp_replace(a.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf
    AND a.data_referencia = p_dia
    AND a.status = 'aprovado'
  ORDER BY a.created_at DESC
  LIMIT 1;

  INSERT INTO public.ponto_excedente_decisao AS x (
    tenant_id, empresa_id, colaborador_cpf, colaborador_nome, dia,
    decisao, justificativa, motivo_ajuste, decidido_por, decidido_em
  ) VALUES (
    p_tenant_id, v_empresa, v_cpf, v_nome, p_dia,
    p_decisao, trim(p_justificativa), v_motivo, auth.uid(), now()
  )
  ON CONFLICT (tenant_id, colaborador_cpf, dia) DO UPDATE SET
    decisao = EXCLUDED.decisao,
    justificativa = EXCLUDED.justificativa,
    motivo_ajuste = EXCLUDED.motivo_ajuste,
    decidido_por = EXCLUDED.decidido_por,
    decidido_em = now();
END;
$function$;