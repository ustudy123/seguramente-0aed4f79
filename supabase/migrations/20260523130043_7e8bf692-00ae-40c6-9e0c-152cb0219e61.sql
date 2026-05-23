
-- Tabela de auditoria das promoções
CREATE TABLE public.tenant_spinoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_origem_id uuid NOT NULL,
  tenant_destino_id uuid NOT NULL,
  empresa_id uuid NOT NULL,
  executado_por uuid NOT NULL,
  owner_email text NOT NULL,
  owner_user_id uuid,
  status text NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento','concluido','erro')),
  contadores jsonb NOT NULL DEFAULT '{}'::jsonb,
  mensagem_erro text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_spinoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins leem spinoffs" ON public.tenant_spinoffs
  FOR SELECT USING (public.is_superadmin(auth.uid()));

CREATE POLICY "Super admins inserem spinoffs" ON public.tenant_spinoffs
  FOR INSERT WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Super admins atualizam spinoffs" ON public.tenant_spinoffs
  FOR UPDATE USING (public.is_superadmin(auth.uid()));

CREATE TRIGGER trg_tenant_spinoffs_updated
  BEFORE UPDATE ON public.tenant_spinoffs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Dry-run: conta registros que serão migrados (apenas leitura)
CREATE OR REPLACE FUNCTION public.superadmin_spinoff_dry_run(p_empresa_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table record;
  v_count bigint;
  v_total bigint := 0;
  v_result jsonb := '{}'::jsonb;
  v_tenant_origem uuid;
BEGIN
  IF NOT public.is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: apenas super admins';
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
$$;

-- Execução real do spin-off
CREATE OR REPLACE FUNCTION public.superadmin_spinoff_execute(
  p_empresa_id uuid,
  p_novo_tenant_id uuid,
  p_owner_email text,
  p_owner_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table record;
  v_count bigint;
  v_total bigint := 0;
  v_contadores jsonb := '{}'::jsonb;
  v_tenant_origem uuid;
  v_spinoff_id uuid;
  v_vinculos_removidos bigint := 0;
BEGIN
  IF NOT public.is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: apenas super admins';
  END IF;

  SELECT tenant_id INTO v_tenant_origem FROM public.empresa_cadastro WHERE id = p_empresa_id;
  IF v_tenant_origem IS NULL THEN
    RAISE EXCEPTION 'Empresa não encontrada';
  END IF;

  IF v_tenant_origem = p_novo_tenant_id THEN
    RAISE EXCEPTION 'Tenant de origem e destino são iguais';
  END IF;

  -- Registra início
  INSERT INTO public.tenant_spinoffs(
    tenant_origem_id, tenant_destino_id, empresa_id,
    executado_por, owner_email, owner_user_id, status
  ) VALUES (
    v_tenant_origem, p_novo_tenant_id, p_empresa_id,
    auth.uid(), p_owner_email, p_owner_user_id, 'em_andamento'
  ) RETURNING id INTO v_spinoff_id;

  -- Migra registros operacionais em todas as tabelas com tenant_id + empresa_id
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

  -- Migra o próprio registro de empresa_cadastro (limpa grupo e matriz herdados)
  UPDATE public.empresa_cadastro
     SET tenant_id = p_novo_tenant_id,
         grupo_economico_id = NULL,
         matriz_id = NULL
   WHERE id = p_empresa_id;

  v_contadores := v_contadores || jsonb_build_object('empresa_cadastro', 1);
  v_total := v_total + 1;

  -- Remove vínculos antigos: usuários do tenant origem perdem acesso à empresa migrada
  DELETE FROM public.usuario_vinculos
   WHERE tenant_id = v_tenant_origem
     AND empresa_id = p_empresa_id;
  GET DIAGNOSTICS v_vinculos_removidos = ROW_COUNT;

  -- Marca conclusão
  UPDATE public.tenant_spinoffs
     SET status = 'concluido',
         contadores = v_contadores || jsonb_build_object(
           '_total', v_total,
           '_vinculos_origem_removidos', v_vinculos_removidos
         )
   WHERE id = v_spinoff_id;

  RETURN jsonb_build_object(
    'spinoff_id', v_spinoff_id,
    'tenant_origem_id', v_tenant_origem,
    'tenant_destino_id', p_novo_tenant_id,
    'total_registros_migrados', v_total,
    'vinculos_origem_removidos', v_vinculos_removidos,
    'contadores', v_contadores
  );
END;
$$;
