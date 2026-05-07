UPDATE public.empresa_cadastro
SET ativo = false,
    atualizado_por = COALESCE(atualizado_por, 'system-deduplicate')
WHERE id IN (
  '8d7a4a4f-9cba-4772-a294-3eddf0896da5',
  '54613da1-9651-439d-90d1-ac5ba524d95c',
  '3154c186-c250-4772-ba2b-510074dcb023',
  '317f0601-852a-4570-9f4c-9a28c9244ffa',
  '896bd876-8522-4454-87df-0c3f1ecdbdc0',
  '7bfe8aff-6feb-4ec2-9c18-354e52ae8f6a',
  '7e45aae5-996c-4260-bcce-3c6aaf75df97',
  'f71e54e4-c2b6-4179-9b98-f6358628d000',
  '19d061bd-0371-4c0d-84fb-c55df1d6768a',
  '30961736-4e55-4efd-8f1a-ebc0f0b347a4',
  '8f6e8a05-aacb-4242-88d4-7c1dfa7a897f',
  'b803fa9c-4f13-4f89-8b05-9382b633ea83',
  'c9fa6378-737e-4d71-acca-bf622d1e0d87',
  '7d79c81a-6dad-48fb-8c5d-be2c76167bba',
  '4bdb8cde-0d77-4924-a0fd-f51ce202703a',
  '3326bc36-e9a8-4bca-98ec-902b44e055d5',
  'ba260e8a-df33-4027-a3b3-9fd9985b7b21'
);