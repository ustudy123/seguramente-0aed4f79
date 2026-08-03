-- 1) Tabelas nomeadas/numeradas de feriados
CREATE TABLE IF NOT EXISTS public.feriado_tabelas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_user_tenant_id(),
  numero integer,
  nome text NOT NULL,
  uf text,
  municipio text,
  codigo_ibge text,
  ano integer,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feriado_tabelas TO authenticated;
GRANT ALL ON public.feriado_tabelas TO service_role;
ALTER TABLE public.feriado_tabelas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant manage feriado_tabelas" ON public.feriado_tabelas
  FOR ALL TO authenticated
  USING (tenant_id = public.current_user_tenant_id())
  WITH CHECK (tenant_id = public.current_user_tenant_id());

CREATE UNIQUE INDEX IF NOT EXISTS uq_feriado_tabelas_numero
  ON public.feriado_tabelas(tenant_id, numero, COALESCE(ano, 0));

-- Numeração automática por tenant
CREATE OR REPLACE FUNCTION public.feriado_tabela_set_numero()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.numero IS NULL THEN
    SELECT COALESCE(MAX(numero), 0) + 1 INTO NEW.numero
      FROM public.feriado_tabelas WHERE tenant_id = NEW.tenant_id;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_feriado_tabela_numero ON public.feriado_tabelas;
CREATE TRIGGER trg_feriado_tabela_numero
  BEFORE INSERT OR UPDATE ON public.feriado_tabelas
  FOR EACH ROW EXECUTE FUNCTION public.feriado_tabela_set_numero();

-- 2) Itens da tabela
CREATE TABLE IF NOT EXISTS public.feriado_tabela_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_user_tenant_id(),
  tabela_id uuid NOT NULL REFERENCES public.feriado_tabelas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  data date,
  recorrente boolean NOT NULL DEFAULT false,
  dia smallint,
  mes smallint,
  tipo text NOT NULL DEFAULT 'feriado' CHECK (tipo IN ('feriado','facultativo')),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_feriado_item_data CHECK (
    (recorrente = true AND dia BETWEEN 1 AND 31 AND mes BETWEEN 1 AND 12)
    OR (recorrente = false AND data IS NOT NULL)
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feriado_tabela_itens TO authenticated;
GRANT ALL ON public.feriado_tabela_itens TO service_role;
ALTER TABLE public.feriado_tabela_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant manage feriado_tabela_itens" ON public.feriado_tabela_itens
  FOR ALL TO authenticated
  USING (tenant_id = public.current_user_tenant_id())
  WITH CHECK (tenant_id = public.current_user_tenant_id());

CREATE INDEX IF NOT EXISTS idx_feriado_itens_tabela ON public.feriado_tabela_itens(tabela_id);
CREATE INDEX IF NOT EXISTS idx_feriado_itens_mes_dia ON public.feriado_tabela_itens(mes, dia) WHERE ativo = true;

CREATE OR REPLACE FUNCTION public.feriado_item_before()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.recorrente = false AND NEW.data IS NOT NULL THEN
    NEW.dia := EXTRACT(DAY FROM NEW.data)::smallint;
    NEW.mes := EXTRACT(MONTH FROM NEW.data)::smallint;
  ELSIF NEW.recorrente = true THEN
    NEW.data := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_feriado_item_before ON public.feriado_tabela_itens;
CREATE TRIGGER trg_feriado_item_before
  BEFORE INSERT OR UPDATE ON public.feriado_tabela_itens
  FOR EACH ROW EXECUTE FUNCTION public.feriado_item_before();

-- 3) Vínculo tabela <-> filiais/empresas (reaproveitamento)
CREATE TABLE IF NOT EXISTS public.feriado_tabela_empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_user_tenant_id(),
  tabela_id uuid NOT NULL REFERENCES public.feriado_tabelas(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresa_cadastro(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tabela_id, empresa_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feriado_tabela_empresas TO authenticated;
GRANT ALL ON public.feriado_tabela_empresas TO service_role;
ALTER TABLE public.feriado_tabela_empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant manage feriado_tabela_empresas" ON public.feriado_tabela_empresas
  FOR ALL TO authenticated
  USING (tenant_id = public.current_user_tenant_id())
  WITH CHECK (tenant_id = public.current_user_tenant_id());

CREATE INDEX IF NOT EXISTS idx_feriado_tab_emp_empresa ON public.feriado_tabela_empresas(empresa_id);

-- 4) Duplicar tabela para outro ano
CREATE OR REPLACE FUNCTION public.feriado_tabela_duplicar(p_tabela_id uuid, p_ano integer, p_nome text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new uuid; v_tenant uuid;
BEGIN
  v_tenant := public.current_user_tenant_id();

  INSERT INTO public.feriado_tabelas (tenant_id, nome, uf, municipio, codigo_ibge, ano, descricao, ativo)
  SELECT t.tenant_id,
         COALESCE(p_nome, t.nome || ' (' || COALESCE(p_ano::text, 'cópia') || ')'),
         t.uf, t.municipio, t.codigo_ibge, p_ano, t.descricao, true
  FROM public.feriado_tabelas t
  WHERE t.id = p_tabela_id AND t.tenant_id = v_tenant
  RETURNING id INTO v_new;

  IF v_new IS NULL THEN
    RAISE EXCEPTION 'Tabela de feriados não encontrada.';
  END IF;

  INSERT INTO public.feriado_tabela_itens (tenant_id, tabela_id, nome, data, recorrente, dia, mes, tipo, ativo)
  SELECT i.tenant_id, v_new, i.nome,
         CASE WHEN i.recorrente THEN NULL
              WHEN p_ano IS NOT NULL AND i.data IS NOT NULL
                THEN make_date(p_ano, i.mes::int, i.dia::int)
              ELSE i.data END,
         i.recorrente, i.dia, i.mes, i.tipo, i.ativo
  FROM public.feriado_tabela_itens i
  WHERE i.tabela_id = p_tabela_id AND i.tenant_id = v_tenant;

  RETURN v_new;
END; $$;

GRANT EXECUTE ON FUNCTION public.feriado_tabela_duplicar(uuid, integer, text) TO authenticated;

-- 5) feriado_do_dia considera a tabela vinculada à filial (prioridade máxima)
CREATE OR REPLACE FUNCTION public.feriado_do_dia(p_tenant_id uuid, p_colaborador_id uuid, p_data date)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uf TEXT; v_cidade TEXT; v_nome TEXT; v_emp uuid;
BEGIN
  v_emp := public.ponto_empresa_do_colaborador(p_colaborador_id);

  SELECT ec.estado, ec.cidade INTO v_uf, v_cidade
  FROM public.empresa_cadastro ec
  WHERE ec.id = v_emp;

  -- Prioridade 0: tabela nomeada vinculada à filial
  IF v_emp IS NOT NULL THEN
    SELECT i.nome INTO v_nome
    FROM public.feriado_tabela_itens i
    JOIN public.feriado_tabelas t ON t.id = i.tabela_id
    JOIN public.feriado_tabela_empresas v ON v.tabela_id = t.id
    WHERE i.ativo = true AND i.tipo = 'feriado'
      AND t.ativo = true
      AND t.tenant_id = p_tenant_id
      AND v.empresa_id = v_emp
      AND (t.ano IS NULL OR t.ano = EXTRACT(YEAR FROM p_data)::int)
      AND (
        (i.recorrente = true
          AND i.dia = EXTRACT(DAY FROM p_data)::smallint
          AND i.mes = EXTRACT(MONTH FROM p_data)::smallint)
        OR (i.recorrente = false AND i.data = p_data)
      )
    LIMIT 1;

    IF v_nome IS NOT NULL THEN
      RETURN v_nome;
    END IF;
  END IF;

  SELECT f.nome INTO v_nome
  FROM public.feriados f
  WHERE f.ativo = true AND f.tipo = 'feriado'
    AND (f.tenant_id IS NULL OR f.tenant_id = p_tenant_id)
    AND (
      (f.recorrente = true
        AND f.dia = EXTRACT(DAY FROM p_data)::smallint
        AND f.mes = EXTRACT(MONTH FROM p_data)::smallint)
      OR (f.recorrente = false AND f.data = p_data)
    )
    AND (
      f.abrangencia = 'nacional'
      OR (f.abrangencia = 'filial' AND v_emp IS NOT NULL AND f.empresa_id = v_emp)
      OR (f.abrangencia = 'estadual' AND v_uf IS NOT NULL AND upper(f.uf) = upper(v_uf))
      OR (f.abrangencia = 'municipal' AND v_uf IS NOT NULL AND v_cidade IS NOT NULL
          AND upper(f.uf) = upper(v_uf)
          AND upper(btrim(f.municipio)) = upper(btrim(v_cidade)))
    )
  ORDER BY CASE f.abrangencia
             WHEN 'filial' THEN 1 WHEN 'municipal' THEN 2 WHEN 'estadual' THEN 3 ELSE 4 END
  LIMIT 1;

  RETURN v_nome;
END;
$$;