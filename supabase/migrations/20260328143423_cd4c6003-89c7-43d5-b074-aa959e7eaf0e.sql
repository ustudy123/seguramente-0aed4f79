-- [GUARDA DE AMBIENTE] Este arquivo é um seed/reparo com DADOS DE PRODUÇÃO
-- (tenants, usuários ou registros específicos). Em um banco novo (staging),
-- essas referências não existem e as inserções falhariam por chave
-- estrangeira, derrubando o `db push`. O conteúdo original segue intacto
-- dentro do bloco abaixo; se alguma referência faltar, o bloco avisa e sai
-- sem aplicar nada — em produção, onde os dados existem, nada muda.
DO $prodseed$
BEGIN
  -- Fix: Atualizar role do usuário tecnico.capanema para 'manager' conforme seu tipo_usuario 'gestor'
  UPDATE public.user_roles 
  SET role = 'manager' 
  WHERE user_id = '0ac509f9-d0a5-4d1d-8df9-afa5aedcadb8' AND role = 'user';

  -- Se não existir, inserir
  INSERT INTO public.user_roles (user_id, role)
  VALUES ('0ac509f9-d0a5-4d1d-8df9-afa5aedcadb8', 'manager')
  ON CONFLICT (user_id, role) DO NOTHING;
EXCEPTION WHEN foreign_key_violation OR not_null_violation OR raise_exception THEN
  RAISE NOTICE 'Seed/reparo de dados de produção ignorado neste ambiente: %', SQLERRM;
END $prodseed$;
