CREATE OR REPLACE FUNCTION public.superadmin_spinoff_dry_run(p_empresa_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_table record;
  v_count bigint;
  v_total bigint := 0;
  v_result jsonb := '{}'::jsonb;
  v_tenant_origem uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.is_superadmin(auth.uid()) OR public.has_minimum_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores, donos e super admins';
  END IF;

  SELECT tenant_id INTO v_tenant_origem FROM public.empresa_cadastro WHERE id = p_empresa_id;
  IF v_tenant_origem IS NULL THEN
    RAISE EXCEPTION 'Empresa não encontrada';
  END IF;

  FOR v_table IN
    SELECT c1.table_name
    FROM information_schema.columns c1
    JOIN information_schema.columns c2
      ON c1.table_schema = c2.table_schema AND c1.table_name = c2.table_name
    JOIN information_schema.tables t
      ON t.table_schema = c1.table_schema AND t.table_name = c1.table_name
    WHERE c1.table_schema = 'public'
      AND c1.column_name = 'tenant_id'
      AND c2.column_name = 'empresa_id'
      AND t.table_type = 'BASE TABLE'
      AND c1.table_name <> 'tenant_spinoffs'
    ORDER BY c1.table_name
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM public.%I WHERE tenant_id = $1 AND empresa_id = $2',
      v_table.table_name
    ) INTO v_count USING v_tenant_origem, p_empresa_id;

    IF v_count > 0 THEN
      v_result := v_result || jsonb_build_object(v_table.table_name, v_count);
      v_total := v_total + v_count;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'tenant_origem_id', v_tenant_origem,
    'empresa_id', p_empresa_id,
    'total_registros', v_total,
    'por_tabela', v_result
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.superadmin_spinoff_execute(p_empresa_id uuid, p_novo_tenant_id uuid, p_owner_email text, p_owner_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_table record;
  v_count bigint;
  v_total bigint := 0;
  v_contadores jsonb := '{}'::jsonb;
  v_tenant_origem uuid;
  v_spinoff_id uuid;
  v_vinculos_removidos bigint := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.is_superadmin(auth.uid()) OR public.has_minimum_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores, donos e super admins';
  END IF;

  SELECT tenant_id INTO v_tenant_origem FROM public.empresa_cadastro WHERE id = p_empresa_id;
  IF v_tenant_origem IS NULL THEN
    RAISE EXCEPTION 'Empresa não encontrada';
  END IF;

  IF v_tenant_origem = p_novo_tenant_id THEN
    RAISE EXCEPTION 'Tenant de origem e destino são iguais';
  END IF;

  INSERT INTO public.tenant_spinoffs(
    tenant_origem_id, tenant_destino_id, empresa_id,
    executado_por, owner_email, owner_user_id, status
  ) VALUES (
    v_tenant_origem, p_novo_tenant_id, p_empresa_id,
    auth.uid(), p_owner_email, p_owner_user_id, 'em_andamento'
  ) RETURNING id INTO v_spinoff_id;

  FOR v_table IN
    SELECT c1.table_name
    FROM information_schema.columns c1
    JOIN information_schema.columns c2
      ON c1.table_schema = c2.table_schema AND c1.table_name = c2.table_name
    JOIN information_schema.tables t
      ON t.table_schema = c1.table_schema AND t.table_name = c1.table_name
    WHERE c1.table_schema = 'public'
      AND c1.column_name = 'tenant_id'
      AND c2.column_name = 'empresa_id'
      AND t.table_type = 'BASE TABLE'
      AND c1.table_name NOT IN ('tenant_spinoffs','empresa_cadastro','usuario_vinculos')
    ORDER BY c1.table_name
  LOOP
    EXECUTE format(
      'UPDATE public.%I SET tenant_id = $1 WHERE tenant_id = $2 AND empresa_id = $3',
      v_table.table_name
    ) USING p_novo_tenant_id, v_tenant_origem, p_empresa_id;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN
      v_contadores := v_contadores || jsonb_build_object(v_table.table_name, v_count);
      v_total := v_total + v_count;
    END IF;
  END LOOP;

  UPDATE public.empresa_cadastro
     SET tenant_id = p_novo_tenant_id,
         grupo_economico_id = NULL,
         matriz_id = NULL
   WHERE id = p_empresa_id;

  v_contadores := v_contadores || jsonb_build_object('empresa_cadastro', 1);
  v_total := v_total + 1;

  DELETE FROM public.usuario_vinculos
   WHERE tenant_id = v_tenant_origem
     AND empresa_id = p_empresa_id;
  GET DIAGNOSTICS v_vinculos_removidos = ROW_COUNT;

  UPDATE public.tenant_spinoffs
     SET status = 'concluido',
         contadores = v_contadores || jsonb_build_object(
           '_total', v_total,
           '_vinculos_origem_removidos', v_vinculos_removidos
         )
   WHERE id = v_spinoff_id;

  RETURN jsonb_build_object(
    'tenant_origem_id', v_tenant_origem,
    'tenant_destino_id', p_novo_tenant_id,
    'empresa_id', p_empresa_id,
    'total_registros_migrados', v_total,
    'vinculos_origem_removidos', v_vinculos_removidos,
    'contadores', v_contadores
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.superadmin_spinoff_dry_run_multi(p_empresa_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_table record;
  v_count bigint;
  v_total bigint := 0;
  v_result jsonb := '{}'::jsonb;
  v_tenant_origem uuid;
  v_tenants_distintos int;
  v_empresas_detalhe jsonb := '[]'::jsonb;
  v_emp record;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.is_superadmin(auth.uid()) OR public.has_minimum_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores, donos e super admins';
  END IF;

  IF p_empresa_ids IS NULL OR array_length(p_empresa_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Nenhuma empresa informada';
  END IF;

  SELECT count(DISTINCT tenant_id) INTO v_tenants_distintos
    FROM public.empresa_cadastro WHERE id = ANY(p_empresa_ids);

  IF v_tenants_distintos = 0 THEN
    RAISE EXCEPTION 'Empresas não encontradas';
  END IF;
  IF v_tenants_distintos > 1 THEN
    RAISE EXCEPTION 'Todas as empresas devem pertencer ao mesmo tenant de origem';
  END IF;

  SELECT tenant_id INTO v_tenant_origem
    FROM public.empresa_cadastro WHERE id = ANY(p_empresa_ids) LIMIT 1;

  FOR v_emp IN
    SELECT id, razao_social, nome_fantasia, cnpj, matriz_id, tipo_unidade
      FROM public.empresa_cadastro WHERE id = ANY(p_empresa_ids)
  LOOP
    v_empresas_detalhe := v_empresas_detalhe || jsonb_build_object(
      'id', v_emp.id,
      'razao_social', v_emp.razao_social,
      'nome_fantasia', v_emp.nome_fantasia,
      'cnpj', v_emp.cnpj,
      'tipo_unidade', v_emp.tipo_unidade,
      'matriz_id', v_emp.matriz_id,
      'matriz_selecionada', v_emp.matriz_id IS NOT NULL AND v_emp.matriz_id = ANY(p_empresa_ids)
    );
  END LOOP;

  FOR v_table IN
    SELECT c1.table_name
    FROM information_schema.columns c1
    JOIN information_schema.columns c2
      ON c1.table_schema = c2.table_schema AND c1.table_name = c2.table_name
    JOIN information_schema.tables t
      ON t.table_schema = c1.table_schema AND t.table_name = c1.table_name
    WHERE c1.table_schema = 'public'
      AND c1.column_name = 'tenant_id'
      AND c2.column_name = 'empresa_id'
      AND t.table_type = 'BASE TABLE'
      AND c1.table_name <> 'tenant_spinoffs'
    ORDER BY c1.table_name
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM public.%I WHERE tenant_id = $1 AND empresa_id = ANY($2)',
      v_table.table_name
    ) INTO v_count USING v_tenant_origem, p_empresa_ids;

    IF v_count > 0 THEN
      v_result := v_result || jsonb_build_object(v_table.table_name, v_count);
      v_total := v_total + v_count;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'tenant_origem_id', v_tenant_origem,
    'empresa_ids', to_jsonb(p_empresa_ids),
    'empresas', v_empresas_detalhe,
    'total_empresas', array_length(p_empresa_ids, 1),
    'total_registros', v_total,
    'por_tabela', v_result
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.superadmin_spinoff_execute_multi(p_empresa_ids uuid[], p_novo_tenant_id uuid, p_owner_email text, p_owner_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_table record;
  v_count bigint;
  v_total bigint := 0;
  v_contadores jsonb := '{}'::jsonb;
  v_tenant_origem uuid;
  v_tenants_distintos int;
  v_spinoff_id uuid;
  v_vinculos_removidos bigint := 0;
  v_emp_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.is_superadmin(auth.uid()) OR public.has_minimum_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores, donos e super admins';
  END IF;

  IF p_empresa_ids IS NULL OR array_length(p_empresa_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Nenhuma empresa informada';
  END IF;

  SELECT count(DISTINCT tenant_id) INTO v_tenants_distintos
    FROM public.empresa_cadastro WHERE id = ANY(p_empresa_ids);
  IF v_tenants_distintos = 0 THEN
    RAISE EXCEPTION 'Empresas não encontradas';
  END IF;
  IF v_tenants_distintos > 1 THEN
    RAISE EXCEPTION 'Todas as empresas devem pertencer ao mesmo tenant de origem';
  END IF;

  SELECT tenant_id INTO v_tenant_origem
    FROM public.empresa_cadastro WHERE id = ANY(p_empresa_ids) LIMIT 1;

  IF v_tenant_origem = p_novo_tenant_id THEN
    RAISE EXCEPTION 'Tenant de origem e destino são iguais';
  END IF;

  FOREACH v_emp_id IN ARRAY p_empresa_ids LOOP
    INSERT INTO public.tenant_spinoffs(
      tenant_origem_id, tenant_destino_id, empresa_id,
      executado_por, owner_email, owner_user_id, status
    ) VALUES (
      v_tenant_origem, p_novo_tenant_id, v_emp_id,
      auth.uid(), p_owner_email, p_owner_user_id, 'em_andamento'
    ) RETURNING id INTO v_spinoff_id;
  END LOOP;

  FOR v_table IN
    SELECT c1.table_name
    FROM information_schema.columns c1
    JOIN information_schema.columns c2
      ON c1.table_schema = c2.table_schema AND c1.table_name = c2.table_name
    JOIN information_schema.tables t
      ON t.table_schema = c1.table_schema AND t.table_name = c1.table_name
    WHERE c1.table_schema = 'public'
      AND c1.column_name = 'tenant_id'
      AND c2.column_name = 'empresa_id'
      AND t.table_type = 'BASE TABLE'
      AND c1.table_name NOT IN ('tenant_spinoffs','empresa_cadastro','usuario_vinculos')
    ORDER BY c1.table_name
  LOOP
    EXECUTE format(
      'UPDATE public.%I SET tenant_id = $1 WHERE tenant_id = $2 AND empresa_id = ANY($3)',
      v_table.table_name
    ) USING p_novo_tenant_id, v_tenant_origem, p_empresa_ids;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN
      v_contadores := v_contadores || jsonb_build_object(v_table.table_name, v_count);
      v_total := v_total + v_count;
    END IF;
  END LOOP;

  UPDATE public.empresa_cadastro
     SET tenant_id = p_novo_tenant_id,
         grupo_economico_id = NULL,
         matriz_id = CASE
           WHEN matriz_id = ANY(p_empresa_ids) THEN matriz_id
           ELSE NULL
         END
   WHERE id = ANY(p_empresa_ids);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_contadores := v_contadores || jsonb_build_object('empresa_cadastro', v_count);
  v_total := v_total + v_count;

  DELETE FROM public.usuario_vinculos
   WHERE tenant_id = v_tenant_origem
     AND empresa_id = ANY(p_empresa_ids);
  GET DIAGNOSTICS v_vinculos_removidos = ROW_COUNT;

  UPDATE public.tenant_spinoffs
     SET status = 'concluido',
         contadores = v_contadores || jsonb_build_object(
           '_total', v_total,
           '_vinculos_origem_removidos', v_vinculos_removidos,
           '_empresas_no_lote', array_length(p_empresa_ids, 1)
         )
   WHERE tenant_destino_id = p_novo_tenant_id
     AND empresa_id = ANY(p_empresa_ids)
     AND status = 'em_andamento';

  RETURN jsonb_build_object(
    'tenant_origem_id', v_tenant_origem,
    'tenant_destino_id', p_novo_tenant_id,
    'total_empresas_migradas', array_length(p_empresa_ids, 1),
    'total_registros_migrados', v_total,
    'vinculos_origem_removidos', v_vinculos_removidos,
    'contadores', v_contadores
  );
END;
$function$;