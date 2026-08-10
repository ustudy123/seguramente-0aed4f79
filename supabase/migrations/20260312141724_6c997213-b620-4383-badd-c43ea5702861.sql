-- [GUARDA DE AMBIENTE] Este arquivo é um seed/reparo com DADOS DE PRODUÇÃO
-- (tenants, usuários ou registros específicos). Em um banco novo (staging),
-- essas referências não existem e as inserções falhariam por chave
-- estrangeira, derrubando o `db push`. O conteúdo original segue intacto
-- dentro do bloco abaixo; se alguma referência faltar, o bloco avisa e sai
-- sem aplicar nada — em produção, onde os dados existem, nada muda.
DO $prodseed$
BEGIN
  -- Criar profile para leiri@sudoclin.com vinculado ao tenant da NUERNBERG & BARROS
  INSERT INTO public.profiles (user_id, tenant_id, nome_completo)
  VALUES ('47bdf32c-ff41-4762-980b-8f62751b8315', '299779a8-1cd2-4ffe-9462-78181426cd1a', 'Leiri');

  -- Atribuir role de user
  INSERT INTO public.user_roles (user_id, role)
  VALUES ('47bdf32c-ff41-4762-980b-8f62751b8315', 'user');
EXCEPTION WHEN foreign_key_violation OR not_null_violation OR raise_exception THEN
  RAISE NOTICE 'Seed/reparo de dados de produção ignorado neste ambiente: %', SQLERRM;
END $prodseed$;
