
-- LIMPEZA GERAL com CASCADE para resolver FK constraints
-- Usar TRUNCATE ... CASCADE em todas as tabelas operacionais

DO $$
DECLARE
  tenants_deletar UUID[] := ARRAY[
    '69daf9d5-5d5d-422b-9672-2cf0909bc7a7',
    'c6149912-981a-468f-8b6d-e508f962bef3',
    'cd9fe557-ce3e-49be-ad08-ae59b4afb4e1',
    'f03cef5b-a079-4163-b192-db09979fa899',
    '65a9eefe-65f6-43c9-af43-718d82a94de2',
    'c9d49d9a-44eb-4a78-8ab8-9e1485863ee2'
  ];
  all_tenants UUID[] := ARRAY[
    '69daf9d5-5d5d-422b-9672-2cf0909bc7a7',
    'c6149912-981a-468f-8b6d-e508f962bef3',
    'cd9fe557-ce3e-49be-ad08-ae59b4afb4e1',
    'f03cef5b-a079-4163-b192-db09979fa899',
    '65a9eefe-65f6-43c9-af43-718d82a94de2',
    'c9d49d9a-44eb-4a78-8ab8-9e1485863ee2',
    '299779a8-1cd2-4ffe-9462-78181426cd1a',
    'e6c322c8-aa93-42c0-8cdb-263f704621e9',
    'bc7f5f0f-27ea-457a-9608-b6d36ce0abeb'
  ];
  t UUID;
  rec RECORD;
BEGIN
  -- Para cada tabela pública com tenant_id, deletar dados de todos os tenants
  FOR rec IN 
    SELECT c.table_name 
    FROM information_schema.columns c
    JOIN information_schema.tables t ON t.table_name = c.table_name AND t.table_schema = c.table_schema
    WHERE c.table_schema = 'public' 
      AND c.column_name = 'tenant_id'
      AND t.table_type = 'BASE TABLE'
      AND c.table_name NOT IN ('tenants', 'profiles', 'user_roles', 'superadmins')
  LOOP
    BEGIN
      EXECUTE format('DELETE FROM public.%I WHERE tenant_id = ANY($1)', rec.table_name) USING all_tenants;
    EXCEPTION WHEN foreign_key_violation THEN
      NULL; -- will be handled in second pass
    END;
  END LOOP;

  -- Second pass for any remaining FK issues
  FOR rec IN 
    SELECT c.table_name 
    FROM information_schema.columns c
    JOIN information_schema.tables t ON t.table_name = c.table_name AND t.table_schema = c.table_schema
    WHERE c.table_schema = 'public' 
      AND c.column_name = 'tenant_id'
      AND t.table_type = 'BASE TABLE'
      AND c.table_name NOT IN ('tenants', 'profiles', 'user_roles', 'superadmins')
  LOOP
    BEGIN
      EXECUTE format('DELETE FROM public.%I WHERE tenant_id = ANY($1)', rec.table_name) USING all_tenants;
    EXCEPTION WHEN foreign_key_violation THEN
      NULL;
    END;
  END LOOP;

  -- Third pass
  FOR rec IN 
    SELECT c.table_name 
    FROM information_schema.columns c
    JOIN information_schema.tables t ON t.table_name = c.table_name AND t.table_schema = c.table_schema
    WHERE c.table_schema = 'public' 
      AND c.column_name = 'tenant_id'
      AND t.table_type = 'BASE TABLE'
      AND c.table_name NOT IN ('tenants', 'profiles', 'user_roles', 'superadmins')
  LOOP
    BEGIN
      EXECUTE format('DELETE FROM public.%I WHERE tenant_id = ANY($1)', rec.table_name) USING all_tenants;
    EXCEPTION WHEN foreign_key_violation THEN
      RAISE NOTICE 'Still FK issue on %', rec.table_name;
    END;
  END LOOP;

  -- Deletar profiles e user_roles dos tenants removidos
  FOREACH t IN ARRAY tenants_deletar LOOP
    DELETE FROM user_roles WHERE user_id IN (SELECT user_id FROM profiles WHERE tenant_id = t);
    DELETE FROM profiles WHERE tenant_id = t;
    DELETE FROM tenants WHERE id = t;
  END LOOP;
END;
$$;

-- Limpar programa validador
DELETE FROM programa_validador_documento_links;
DELETE FROM programa_validador_documentos;
DELETE FROM programa_validador_historico;
DELETE FROM programa_validador_contratos;
DELETE FROM programa_validador_clientes;

-- Limpar landing leads
DELETE FROM landing_leads;
