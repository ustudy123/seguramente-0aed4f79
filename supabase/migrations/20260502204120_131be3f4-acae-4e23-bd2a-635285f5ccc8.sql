-- [GUARDA DE AMBIENTE] Este arquivo é um seed/reparo com DADOS DE PRODUÇÃO
-- (tenants, usuários ou registros específicos). Em um banco novo (staging),
-- essas referências não existem e as inserções falhariam por chave
-- estrangeira, derrubando o `db push`. O conteúdo original segue intacto
-- dentro do bloco abaixo; se alguma referência faltar, o bloco avisa e sai
-- sem aplicar nada — em produção, onde os dados existem, nada muda.
DO $prodseed$
BEGIN
  -- Step 1: Insert into usuarios_base
  WITH new_user AS (
    INSERT INTO public.usuarios_base (
      tenant_id,
      auth_user_id,
      nome_completo,
      email_principal,
      telefone_principal,
      tipo_usuario,
      status,
      email_validado,
      origem_cadastro
    )
    SELECT 
      'a9b23784-5e5c-4f54-a71c-f1168e02771b', 
      'd63756f7-4866-4a80-8793-b33456bdde6a', 
      'Maria do Testes', 
      'canalmeuestudo@gmail.com', 
      '46999337504', 
      'administrador', 
      'ativo', 
      true, 
      'manual_fix'
    RETURNING id
  )
  -- Step 2: Link to Administrador Master profile
  INSERT INTO public.usuario_perfil_vinculos (
    tenant_id,
    usuario_id,
    perfil_id,
    ativo,
    is_perfil_principal
  )
  SELECT 
    'a9b23784-5e5c-4f54-a71c-f1168e02771b',
    (SELECT id FROM new_user),
    'be97db43-0bf0-48e9-aeb3-dc3be05ccdc3',
    true,
    true;
EXCEPTION WHEN foreign_key_violation OR not_null_violation OR raise_exception THEN
  RAISE NOTICE 'Seed/reparo de dados de produção ignorado neste ambiente: %', SQLERRM;
END $prodseed$;
