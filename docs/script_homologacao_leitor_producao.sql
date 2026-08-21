-- ============================================================================
-- YourEyes · PRODUÇÃO · Usuário SOMENTE LEITURA para abastecer a homologação
--
-- POR QUE ISTO EXISTE
--
-- A homologação vai ser abastecida por uma esteira no GitHub, que precisa ler a
-- ESTRUTURA da produção. Para isso ela precisa de uma credencial — e a regra da
-- casa é clara: a produção NUNCA é alterada por esteira.
--
-- A saída é dar à esteira uma credencial que, por construção, NÃO CONSEGUE
-- escrever. Este script cria um usuário de banco com permissão apenas de
-- leitura. Mesmo que a credencial vaze, ninguém altera nada da produção com
-- ela: o banco recusa qualquer escrita, não é uma promessa de configuração.
--
-- ANTES DE RODAR: escolha uma senha e troque no lugar indicado, na linha
-- abaixo. Mínimo de 12 caracteres; pode usar QUALQUER caractere, inclusive @ e
-- dois-pontos. (As primeiras versões da esteira montavam um endereço de
-- conexão à mão e pediam senha "sem símbolos" por causa disso; hoje a senha
-- viaja em separado, por PGPASSWORD, e a restrição deixou de existir.)
--
-- SEGURO DE RODAR DUAS VEZES: se o usuário já existir, a senha é atualizada e
-- as permissões reconfirmadas.
--
-- IMPORTANTE APÓS TROCAR A SENHA: o Session pooler do Supabase (Supavisor)
-- pode levar alguns minutos para reconhecer a nova credencial. Nesse intervalo,
-- o GitHub pode mostrar "password authentication failed" mesmo com a senha
-- correta. NÃO troque a senha de novo: aguarde a sincronização e execute a
-- esteira novamente. Trocas sucessivas reiniciam essa janela.
--
-- COMO RODAR: cole o arquivo inteiro no SQL Editor do projeto de PRODUÇÃO.
-- ============================================================================

DO $cria$
DECLARE
  -- ⬇⬇⬇  TROQUE AQUI, e só aqui  ⬇⬇⬇
  v_senha text := 'TROQUE_ESTA_SENHA_POR_UMA_SUA';
BEGIN
  -- A verificação NÃO compara com o texto do marcador de propósito: quem
  -- substitui costuma trocar todas as ocorrências de uma vez, e aí a própria
  -- verificação passaria a comparar a senha nova com ela mesma, travando o
  -- script de quem fez tudo certo. Confere o que importa: se ainda tem cara de
  -- marcador, e se tem tamanho de senha.
  IF v_senha ILIKE '%troque%' OR length(v_senha) < 12 THEN
    RAISE EXCEPTION 'Defina uma senha própria (mínimo 12 caracteres) na linha indicada.';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'homologacao_leitor') THEN
    EXECUTE format('ALTER ROLE homologacao_leitor LOGIN PASSWORD %L', v_senha);
    RAISE NOTICE 'Usuário homologacao_leitor já existia; senha atualizada.';
  ELSE
    EXECUTE format('CREATE ROLE homologacao_leitor LOGIN PASSWORD %L', v_senha);
    RAISE NOTICE 'Usuário homologacao_leitor criado.';
  END IF;

  -- Somente leitura, e nada além disso.
  -- pg_read_all_data é papel de sistema do PostgreSQL: dá SELECT em tudo e
  -- NENHUMA permissão de escrita. Não há como conceder escrita por engano aqui.
  EXECUTE 'GRANT pg_read_all_data TO homologacao_leitor';
  EXECUTE 'GRANT USAGE ON SCHEMA public TO homologacao_leitor';

  -- Garantia explícita: nada de criar objeto no banco.
  EXECUTE 'REVOKE CREATE ON SCHEMA public FROM homologacao_leitor';
  EXECUTE 'REVOKE ALL ON DATABASE postgres FROM homologacao_leitor';
  EXECUTE 'GRANT CONNECT ON DATABASE postgres TO homologacao_leitor';
END $cria$;

-- ============================================================================
-- CONFERÊNCIA
-- ============================================================================
SELECT
  'Usuário criado' AS item,
  CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'homologacao_leitor')
       THEN 'ok' ELSE 'FALTA' END AS situacao,
  'é com ele que a esteira lê a estrutura' AS observacao

UNION ALL
SELECT 'Consegue entrar (LOGIN)',
       CASE WHEN EXISTS (SELECT 1 FROM pg_roles
                          WHERE rolname = 'homologacao_leitor' AND rolcanlogin)
            THEN 'ok' ELSE 'FALTA' END,
       'sem isto a esteira não conecta'

UNION ALL
SELECT 'É somente leitura',
       CASE WHEN EXISTS (SELECT 1 FROM pg_auth_members m
                          JOIN pg_roles r ON r.oid = m.roleid
                          JOIN pg_roles u ON u.oid = m.member
                         WHERE u.rolname = 'homologacao_leitor'
                           AND r.rolname = 'pg_read_all_data')
            THEN 'ok' ELSE 'FALTA' END,
       'o banco recusa qualquer escrita deste usuário'

UNION ALL
SELECT 'NÃO é superusuário',
       CASE WHEN NOT EXISTS (SELECT 1 FROM pg_roles
                              WHERE rolname = 'homologacao_leitor'
                                AND (rolsuper OR rolcreatedb OR rolcreaterole))
            THEN 'ok' ELSE 'PERIGO' END,
       'não cria banco, não cria usuário, não administra'

ORDER BY 1;
