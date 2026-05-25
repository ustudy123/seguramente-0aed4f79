DO $$
DECLARE
  r record;
  emp uuid;
  ids uuid[] := ARRAY[
    -- CNPJ 343434 (lixo - 3 empresas vazias)
    '2bb2b654-87a5-41fc-ad39-c8d5f7802aee'::uuid,
    '75e6e5b8-86e4-4355-aa97-765d3b153488'::uuid,
    'de06fb9f-691a-4283-905e-8ffb326ae908'::uuid,
    -- CNPJ 0428363400015 (lixo - sem nome)
    '05e8da55-afbd-4af9-9ec8-a5175081a603'::uuid,
    '8aa18790-5c9d-4827-a288-deb623a7616d'::uuid,
    -- CNPJ 57851243000150 ("3" e "22")
    'cce5e6e3-46f2-4faf-995c-44fd49503c20'::uuid,
    'c4bbc5fa-7c01-49d0-8d50-bbde0165dcc6'::uuid,
    -- CNPJ 64937546000156 ("K" e "4")
    '42e99aa8-8da5-4c9d-bda1-3657616bd21e'::uuid,
    '4b10ab71-e9a4-4812-9527-cdbfc1b549d0'::uuid,
    -- CNPJ 70507279000180 ("TESTE 2" e "21")
    'a04f8359-3396-419f-a464-3bc6aa9ca986'::uuid,
    '3e5b8f9f-051e-4dd3-aad9-aabceee6b994'::uuid,
    -- SANTA LUCIA duplicata vazia (mantém a com razão social)
    '6def1e8d-3607-4f54-b351-de5727ca2e53'::uuid
  ];
BEGIN
  FOREACH emp IN ARRAY ids LOOP
    -- 3 passadas para tolerar FKs entre as próprias tabelas
    FOR i IN 1..3 LOOP
      FOR r IN
        SELECT table_name
        FROM information_schema.columns
        WHERE column_name = 'empresa_id'
          AND table_schema = 'public'
          AND table_name <> 'empresa_cadastro'
      LOOP
        BEGIN
          EXECUTE format('DELETE FROM public.%I WHERE empresa_id = $1', r.table_name) USING emp;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
      END LOOP;
    END LOOP;

    -- Finalmente apaga a empresa em si
    BEGIN
      DELETE FROM public.empresa_cadastro WHERE id = emp;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Falha ao apagar empresa %: %', emp, SQLERRM;
    END;
  END LOOP;
END$$;