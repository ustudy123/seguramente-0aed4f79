-- 1) Novas colunas
ALTER TABLE public.feriados
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresa_cadastro(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS recorrente boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dia smallint,
  ADD COLUMN IF NOT EXISTS mes smallint,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 2) Abrangência passa a aceitar 'filial'
ALTER TABLE public.feriados DROP CONSTRAINT IF EXISTS feriados_abrangencia_check;
ALTER TABLE public.feriados ADD CONSTRAINT feriados_abrangencia_check
  CHECK (abrangencia = ANY (ARRAY['nacional','estadual','municipal','filial']));

-- 3) Data opcional para feriados recorrentes (dia/mes bastam)
ALTER TABLE public.feriados ALTER COLUMN data DROP NOT NULL;

-- 4) Normalização + validação (trigger, não CHECK, por depender de estado)
CREATE OR REPLACE FUNCTION public.feriados_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();

  -- Deriva dia/mês a partir da data quando não informados
  IF NEW.data IS NOT NULL THEN
    NEW.dia := COALESCE(NEW.dia, EXTRACT(DAY FROM NEW.data)::smallint);
    NEW.mes := COALESCE(NEW.mes, EXTRACT(MONTH FROM NEW.data)::smallint);
  END IF;

  IF NEW.recorrente THEN
    IF NEW.dia IS NULL OR NEW.mes IS NULL THEN
      RAISE EXCEPTION 'Feriado recorrente exige dia e mês.';
    END IF;
    IF NEW.dia < 1 OR NEW.dia > 31 OR NEW.mes < 1 OR NEW.mes > 12 THEN
      RAISE EXCEPTION 'Dia/mês inválidos para feriado recorrente.';
    END IF;
  ELSIF NEW.data IS NULL THEN
    RAISE EXCEPTION 'Feriado não recorrente exige a data.';
  END IF;

  IF NEW.abrangencia = 'filial' AND NEW.empresa_id IS NULL THEN
    RAISE EXCEPTION 'Feriado de filial exige a unidade (empresa_id).';
  END IF;

  IF NEW.abrangencia <> 'filial' THEN
    NEW.empresa_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_feriados_before_write ON public.feriados;
CREATE TRIGGER trg_feriados_before_write
  BEFORE INSERT OR UPDATE ON public.feriados
  FOR EACH ROW EXECUTE FUNCTION public.feriados_before_write();

-- Backfill dia/mes dos registros existentes
UPDATE public.feriados SET dia = EXTRACT(DAY FROM data)::smallint,
                           mes = EXTRACT(MONTH FROM data)::smallint
 WHERE data IS NOT NULL AND (dia IS NULL OR mes IS NULL);

-- 5) Índices de busca
CREATE INDEX IF NOT EXISTS idx_feriados_empresa ON public.feriados(empresa_id) WHERE empresa_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_feriados_mes_dia ON public.feriados(mes, dia) WHERE ativo = true;

-- 6) Grants (idempotentes)
GRANT SELECT ON public.feriados TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feriados TO authenticated;
GRANT ALL ON public.feriados TO service_role;

-- 7) feriado_do_dia agora entende filial e recorrência
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