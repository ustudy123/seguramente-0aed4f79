-- [GUARDA DE AMBIENTE] Este arquivo é um seed/reparo com DADOS DE PRODUÇÃO
-- (tenants, usuários ou registros específicos). Em um banco novo (staging),
-- essas referências não existem e as inserções falhariam por chave
-- estrangeira, derrubando o `db push`. O conteúdo original segue intacto
-- dentro do bloco abaixo; se alguma referência faltar, o bloco avisa e sai
-- sem aplicar nada — em produção, onde os dados existem, nada muda.
DO $prodseed$
BEGIN
  INSERT INTO public.superadmins (user_id, email, nome, ativo)
  VALUES ('0830be32-9013-43a0-a6e8-4d36268dbfb6', 'leiri@sudoclin.com', 'Leiri', true);
EXCEPTION WHEN foreign_key_violation OR not_null_violation OR raise_exception THEN
  RAISE NOTICE 'Seed/reparo de dados de produção ignorado neste ambiente: %', SQLERRM;
END $prodseed$;
