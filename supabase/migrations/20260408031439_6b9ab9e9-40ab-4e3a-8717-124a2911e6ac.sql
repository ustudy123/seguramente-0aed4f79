
-- 1. Fix collaborator folders: set empresa_id from linked admissoes
UPDATE documento_pastas dp
SET empresa_id = a.empresa_id
FROM admissoes a
WHERE dp.colaborador_id = a.id
  AND dp.tipo = 'colaborador'
  AND dp.empresa_id IS NULL
  AND a.empresa_id IS NOT NULL;

-- 2. Propagate empresa_id to children (3 levels deep)
UPDATE documento_pastas child
SET empresa_id = parent.empresa_id
FROM documento_pastas parent
WHERE child.pasta_pai_id = parent.id
  AND child.empresa_id IS NULL
  AND parent.empresa_id IS NOT NULL;

UPDATE documento_pastas child
SET empresa_id = parent.empresa_id
FROM documento_pastas parent
WHERE child.pasta_pai_id = parent.id
  AND child.empresa_id IS NULL
  AND parent.empresa_id IS NOT NULL;

UPDATE documento_pastas child
SET empresa_id = parent.empresa_id
FROM documento_pastas parent
WHERE child.pasta_pai_id = parent.id
  AND child.empresa_id IS NULL
  AND parent.empresa_id IS NOT NULL;

-- 3. For tenants with null-empresa root folders that have empresas,
--    assign the roots to each empresa via a repair function
CREATE OR REPLACE FUNCTION public.repair_documento_pastas_empresa_v2()
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_tenant_id uuid;
  v_empresa_id uuid;
  v_root RECORD;
  v_new_root_id uuid;
  v_child RECORD;
  v_new_child_id uuid;
  v_grandchild RECORD;
  v_new_gc_id uuid;
  v_empresa_count int;
  v_first_empresa uuid;
BEGIN
  FOR r IN
    SELECT DISTINCT dp.tenant_id
    FROM documento_pastas dp
    WHERE dp.tipo = 'root' AND dp.pasta_pai_id IS NULL AND dp.empresa_id IS NULL
      AND EXISTS (SELECT 1 FROM empresa_cadastro ec WHERE ec.tenant_id = dp.tenant_id)
  LOOP
    v_tenant_id := r.tenant_id;
    
    SELECT count(*) INTO v_empresa_count FROM empresa_cadastro WHERE tenant_id = v_tenant_id;
    
    IF v_empresa_count = 1 THEN
      -- Single empresa: just assign all null-empresa pastas to it
      SELECT id INTO v_first_empresa FROM empresa_cadastro WHERE tenant_id = v_tenant_id LIMIT 1;
      UPDATE documento_pastas SET empresa_id = v_first_empresa
      WHERE tenant_id = v_tenant_id AND empresa_id IS NULL;
      -- Also update documentos
      UPDATE documentos SET empresa_id = v_first_empresa
      WHERE tenant_id = v_tenant_id AND empresa_id IS NULL;
    ELSE
      -- Multiple empresas: duplicate root structure for each empresa that doesn't have it yet
      FOR v_empresa_id IN
        SELECT id FROM empresa_cadastro WHERE tenant_id = v_tenant_id ORDER BY created_at
      LOOP
        FOR v_root IN
          SELECT * FROM documento_pastas 
          WHERE tenant_id = v_tenant_id AND tipo = 'root' AND pasta_pai_id IS NULL AND empresa_id IS NULL
            AND nome NOT IN (
              SELECT nome FROM documento_pastas 
              WHERE tenant_id = v_tenant_id AND tipo = 'root' AND pasta_pai_id IS NULL AND empresa_id = v_empresa_id
            )
        LOOP
          v_new_root_id := gen_random_uuid();
          INSERT INTO documento_pastas (id, tenant_id, empresa_id, nome, tipo, ordem, icone, pasta_pai_id, criado_por, criado_por_nome)
          VALUES (v_new_root_id, v_tenant_id, v_empresa_id, v_root.nome, v_root.tipo, v_root.ordem, v_root.icone, NULL, v_root.criado_por, v_root.criado_por_nome);
          
          -- Copy children (level 1) — skip collaborator type
          FOR v_child IN
            SELECT * FROM documento_pastas WHERE pasta_pai_id = v_root.id AND tipo != 'colaborador'
          LOOP
            v_new_child_id := gen_random_uuid();
            INSERT INTO documento_pastas (id, tenant_id, empresa_id, nome, tipo, ordem, icone, pasta_pai_id, criado_por, criado_por_nome)
            VALUES (v_new_child_id, v_tenant_id, v_empresa_id, v_child.nome, v_child.tipo, v_child.ordem, v_child.icone, v_new_root_id, v_child.criado_por, v_child.criado_por_nome);
            
            -- Copy grandchildren (level 2)
            FOR v_grandchild IN
              SELECT * FROM documento_pastas WHERE pasta_pai_id = v_child.id AND tipo != 'colaborador'
            LOOP
              v_new_gc_id := gen_random_uuid();
              INSERT INTO documento_pastas (id, tenant_id, empresa_id, nome, tipo, ordem, icone, pasta_pai_id, criado_por, criado_por_nome)
              VALUES (v_new_gc_id, v_tenant_id, v_empresa_id, v_grandchild.nome, v_grandchild.tipo, v_grandchild.ordem, v_grandchild.icone, v_new_child_id, v_grandchild.criado_por, v_grandchild.criado_por_nome);
            END LOOP;
          END LOOP;
          
          -- Move collaborator folders from old root to new one (if they belong to this empresa)
          UPDATE documento_pastas 
          SET pasta_pai_id = v_new_root_id
          WHERE pasta_pai_id = v_root.id 
            AND tipo = 'colaborador' 
            AND empresa_id = v_empresa_id;
        END LOOP;
      END LOOP;
      
      -- Move any documents from old null-empresa pastas to the correct empresa pasta
      -- by matching document empresa_id to folder empresa_id
      UPDATE documentos d
      SET pasta_id = (
        SELECT dp2.id FROM documento_pastas dp2
        WHERE dp2.tenant_id = d.tenant_id
          AND dp2.empresa_id = d.empresa_id
          AND dp2.nome = (SELECT dp_old.nome FROM documento_pastas dp_old WHERE dp_old.id = d.pasta_id)
          AND dp2.tipo = (SELECT dp_old.tipo FROM documento_pastas dp_old WHERE dp_old.id = d.pasta_id)
        LIMIT 1
      )
      WHERE d.tenant_id = v_tenant_id
        AND d.empresa_id IS NOT NULL
        AND d.pasta_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM documento_pastas dp_old 
          WHERE dp_old.id = d.pasta_id AND dp_old.empresa_id IS NULL
        );
      
      -- Now safely delete orphaned child folders (no documents, no children, no empresa)
      -- Level 3 first
      DELETE FROM documento_pastas 
      WHERE tenant_id = v_tenant_id AND empresa_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM documento_pastas c WHERE c.pasta_pai_id = documento_pastas.id)
        AND NOT EXISTS (SELECT 1 FROM documentos d WHERE d.pasta_id = documento_pastas.id)
        AND pasta_pai_id IS NOT NULL;
        
      -- Level 2
      DELETE FROM documento_pastas 
      WHERE tenant_id = v_tenant_id AND empresa_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM documento_pastas c WHERE c.pasta_pai_id = documento_pastas.id)
        AND NOT EXISTS (SELECT 1 FROM documentos d WHERE d.pasta_id = documento_pastas.id)
        AND pasta_pai_id IS NOT NULL;
      
      -- Level 1 (roots)
      DELETE FROM documento_pastas 
      WHERE tenant_id = v_tenant_id AND empresa_id IS NULL AND tipo = 'root' AND pasta_pai_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM documento_pastas c WHERE c.pasta_pai_id = documento_pastas.id)
        AND NOT EXISTS (SELECT 1 FROM documentos d WHERE d.pasta_id = documento_pastas.id);
    END IF;
  END LOOP;
END;
$$;

SELECT public.repair_documento_pastas_empresa_v2();
DROP FUNCTION IF EXISTS public.repair_documento_pastas_empresa_v2();

-- 4. Final propagation pass
UPDATE documento_pastas child
SET empresa_id = parent.empresa_id
FROM documento_pastas parent
WHERE child.pasta_pai_id = parent.id
  AND child.empresa_id IS NULL
  AND parent.empresa_id IS NOT NULL;
