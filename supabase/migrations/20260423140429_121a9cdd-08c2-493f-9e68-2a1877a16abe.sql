-- 1) Derrubar índices/constraints UNIQUE antigos
ALTER TABLE public.departamentos DROP CONSTRAINT IF EXISTS departamentos_tenant_id_nome_key;
ALTER TABLE public.cargos DROP CONSTRAINT IF EXISTS cargos_tenant_id_nome_key;
DROP INDEX IF EXISTS public.departamentos_tenant_id_nome_key;
DROP INDEX IF EXISTS public.cargos_tenant_id_nome_key;
DROP INDEX IF EXISTS public.departamentos_tenant_empresa_nome_key;
DROP INDEX IF EXISTS public.cargos_tenant_empresa_nome_key;

-- 2) Limpar espaços extras
UPDATE public.departamentos SET nome = TRIM(nome) WHERE nome <> TRIM(nome);
UPDATE public.cargos SET nome = TRIM(nome) WHERE nome <> TRIM(nome);

-- 3) Mesclar duplicatas de DEPARTAMENTOS
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    WITH ranked AS (
      SELECT id,
             FIRST_VALUE(id) OVER (PARTITION BY tenant_id, COALESCE(empresa_id::text, 'NULL'), LOWER(nome) ORDER BY created_at) AS keeper_id,
             ROW_NUMBER() OVER (PARTITION BY tenant_id, COALESCE(empresa_id::text, 'NULL'), LOWER(nome) ORDER BY created_at) AS rn
      FROM public.departamentos
    )
    SELECT id AS loser_id, keeper_id FROM ranked WHERE rn > 1
  LOOP
    UPDATE public.cargos SET departamento_id = rec.keeper_id WHERE departamento_id = rec.loser_id;
    UPDATE public.metas SET departamento_id = rec.keeper_id WHERE departamento_id = rec.loser_id;
    UPDATE public.metas SET setor_id = rec.keeper_id WHERE setor_id = rec.loser_id;
    UPDATE public.estrategia_organograma SET departamento_id = rec.keeper_id WHERE departamento_id = rec.loser_id;
    DELETE FROM public.departamentos WHERE id = rec.loser_id;
  END LOOP;
END $$;

-- 4) Mesclar duplicatas de CARGOS
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    WITH ranked AS (
      SELECT id,
             FIRST_VALUE(id) OVER (PARTITION BY tenant_id, COALESCE(empresa_id::text, 'NULL'), LOWER(nome) ORDER BY created_at) AS keeper_id,
             ROW_NUMBER() OVER (PARTITION BY tenant_id, COALESCE(empresa_id::text, 'NULL'), LOWER(nome) ORDER BY created_at) AS rn
      FROM public.cargos
    )
    SELECT id AS loser_id, keeper_id FROM ranked WHERE rn > 1
  LOOP
    UPDATE public.estrategia_organograma SET cargo_id = rec.keeper_id WHERE cargo_id = rec.loser_id;
    UPDATE public.colaborador_condicoes_especiais SET cargo_id = rec.keeper_id WHERE cargo_id = rec.loser_id;
    UPDATE public.funcao_treinamento_evidencias SET cargo_id = rec.keeper_id WHERE cargo_id = rec.loser_id;
    UPDATE public.funcao_atividades SET cargo_id = rec.keeper_id WHERE cargo_id = rec.loser_id;
    UPDATE public.funcao_competencias SET cargo_id = rec.keeper_id WHERE cargo_id = rec.loser_id;
    UPDATE public.funcao_epis SET cargo_id = rec.keeper_id WHERE cargo_id = rec.loser_id;
    UPDATE public.funcao_cets SET cargo_id = rec.keeper_id WHERE cargo_id = rec.loser_id;
    UPDATE public.funcao_epi_vinculacoes SET cargo_id = rec.keeper_id WHERE cargo_id = rec.loser_id;
    DELETE FROM public.cargos WHERE id = rec.loser_id;
  END LOOP;
END $$;

-- 5) Criar novos índices UNIQUE incluindo empresa_id
CREATE UNIQUE INDEX departamentos_tenant_empresa_nome_key
  ON public.departamentos (tenant_id, COALESCE(empresa_id, '00000000-0000-0000-0000-000000000000'::uuid), LOWER(nome));

CREATE UNIQUE INDEX cargos_tenant_empresa_nome_key
  ON public.cargos (tenant_id, COALESCE(empresa_id, '00000000-0000-0000-0000-000000000000'::uuid), LOWER(nome));

-- 6) Sincronizar departamentos faltantes (DISTINCT ON normaliza variações de case)
INSERT INTO public.departamentos (tenant_id, empresa_id, nome, ativo)
SELECT DISTINCT ON (tenant_id, empresa_id, LOWER(nome_norm))
       tenant_id, empresa_id, nome_norm, true
FROM (
  SELECT a.tenant_id, a.empresa_id, TRIM(a.departamento) AS nome_norm
  FROM public.admissoes a
  WHERE a.departamento IS NOT NULL
    AND TRIM(a.departamento) <> ''
    AND a.empresa_id IS NOT NULL
) src
WHERE NOT EXISTS (
  SELECT 1 FROM public.departamentos d
  WHERE d.tenant_id = src.tenant_id
    AND d.empresa_id = src.empresa_id
    AND LOWER(d.nome) = LOWER(src.nome_norm)
);

-- 7) Sincronizar cargos faltantes
WITH cargo_dept AS (
  SELECT a.tenant_id, a.empresa_id, TRIM(a.cargo) AS cargo_nome, TRIM(a.departamento) AS dept_nome,
         ROW_NUMBER() OVER (PARTITION BY a.tenant_id, a.empresa_id, LOWER(TRIM(a.cargo)) ORDER BY COUNT(*) DESC) AS rn
  FROM public.admissoes a
  WHERE a.cargo IS NOT NULL AND TRIM(a.cargo) <> '' AND a.empresa_id IS NOT NULL
  GROUP BY a.tenant_id, a.empresa_id, TRIM(a.cargo), TRIM(a.departamento)
)
INSERT INTO public.cargos (tenant_id, empresa_id, nome, departamento_id, ativo)
SELECT cp.tenant_id, cp.empresa_id, cp.cargo_nome,
       (SELECT d.id FROM public.departamentos d
        WHERE d.tenant_id = cp.tenant_id AND d.empresa_id = cp.empresa_id
          AND LOWER(d.nome) = LOWER(cp.dept_nome) LIMIT 1),
       true
FROM cargo_dept cp
WHERE cp.rn = 1
  AND NOT EXISTS (
    SELECT 1 FROM public.cargos c
    WHERE c.tenant_id = cp.tenant_id
      AND c.empresa_id = cp.empresa_id
      AND LOWER(c.nome) = LOWER(cp.cargo_nome)
  );

-- 8) Vincular departamento_id em cargos sem vinculação
UPDATE public.cargos c
SET departamento_id = sub.dept_id
FROM (
  SELECT DISTINCT ON (a.tenant_id, a.empresa_id, LOWER(TRIM(a.cargo)))
         a.tenant_id, a.empresa_id, TRIM(a.cargo) AS cargo_nome, d.id AS dept_id
  FROM public.admissoes a
  JOIN public.departamentos d
    ON d.tenant_id = a.tenant_id
   AND d.empresa_id = a.empresa_id
   AND LOWER(d.nome) = LOWER(TRIM(a.departamento))
  WHERE a.cargo IS NOT NULL AND a.departamento IS NOT NULL
) sub
WHERE c.tenant_id = sub.tenant_id
  AND c.empresa_id = sub.empresa_id
  AND LOWER(c.nome) = LOWER(sub.cargo_nome)
  AND c.departamento_id IS NULL;