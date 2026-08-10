-- [GUARDA DE AMBIENTE] Este arquivo é um seed/reparo com DADOS DE PRODUÇÃO
-- (tenants, usuários ou registros específicos). Em um banco novo (staging),
-- essas referências não existem e as inserções falhariam por chave
-- estrangeira, derrubando o `db push`. O conteúdo original segue intacto
-- dentro do bloco abaixo; se alguma referência faltar, o bloco avisa e sai
-- sem aplicar nada — em produção, onde os dados existem, nada muda.
DO $prodseed$
BEGIN
  -- Buscar o ID do usuário leiri (leiri@sudoclin.com) e adicionar como superadmin
  DO $$
  DECLARE
      v_user_id UUID;
  BEGIN
      -- Buscar o ID do usuário pelo email
      SELECT id INTO v_user_id
      FROM auth.users
      WHERE email = 'leiri@sudoclin.com';
      
      -- Se não encontrar, tentar buscar por parte do email
      IF v_user_id IS NULL THEN
          SELECT id INTO v_user_id
          FROM auth.users
          WHERE email ILIKE '%leiri%';
      END IF;
      
      -- Inserir na tabela superadmins se encontrou o usuário
      IF v_user_id IS NOT NULL THEN
          INSERT INTO public.superadmins (user_id, email, nome, ativo)
          VALUES (v_user_id, 'leiri@sudoclin.com', 'Leiri', true)
          ON CONFLICT (user_id) 
          DO UPDATE SET ativo = true, email = EXCLUDED.email, nome = EXCLUDED.nome;
          
          RAISE NOTICE 'Usuário leiri (ID: %) adicionado/atualizado como superadmin', v_user_id;
      ELSE
          RAISE EXCEPTION 'Usuário leiri@sudoclin.com não encontrado na tabela auth.users';
      END IF;
  END $$;
EXCEPTION WHEN foreign_key_violation OR not_null_violation OR raise_exception THEN
  RAISE NOTICE 'Seed/reparo de dados de produção ignorado neste ambiente: %', SQLERRM;
END $prodseed$;
