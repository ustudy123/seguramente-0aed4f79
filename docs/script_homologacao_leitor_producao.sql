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
-- ANTES DE RODAR — DOIS CAMINHOS, e o mais comum não pede senha nenhuma:
--
--   JÁ EXISTE o usuário e você só quer reaplicar as permissões (é o caso de
--   quem já rodou este script antes): NÃO MEXA EM NADA. Cole o arquivo como
--   está. A senha atual é PRESERVADA e as permissões são reconfirmadas.
--
--   É A PRIMEIRA VEZ, ou você quer TROCAR a senha de propósito: escolha uma
--   e troque no lugar indicado. Mínimo de 12 caracteres; pode usar qualquer
--   caractere, inclusive @ e dois-pontos.
--
-- Por que o padrão passou a ser preservar: trocar a senha aqui sem trocar o
-- secret PRODUCAO_DB_PASSWORD no GitHub quebra a esteira — e o erro aparece
-- só dez minutos depois, na corrida seguinte, falando de autenticação. Quem
-- só precisa de uma permissão nova não deveria correr esse risco.
--
-- SEGURO DE RODAR QUANTAS VEZES QUISER: sem senha informada, nada além das
-- permissões é tocado.
--
-- A role termina em _v2 de propósito: a credencial da role anterior ficou
-- retida no cache do Session pooler mesmo depois de várias trocas de senha.
-- Uma identidade nova força o Supavisor a criar um registro de autenticação
-- novo, sem ampliar os privilégios da esteira.
--
-- COMO RODAR: cole o arquivo inteiro no SQL Editor do projeto de PRODUÇÃO.
-- ============================================================================

DO $cria$
DECLARE
  -- ⬇⬇⬇  Só mexa aqui se for CRIAR o usuário ou TROCAR a senha de propósito.
  --      Deixando como está, a senha atual é preservada.  ⬇⬇⬇
  v_senha text := 'TROQUE_ESTA_SENHA_POR_UMA_SUA';

  v_existe  boolean;
  v_trocar  boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'homologacao_leitor_v2')
    INTO v_existe;

  -- "Ainda tem cara de marcador" = ninguém quis trocar a senha.
  --
  -- A verificação NÃO compara com o texto exato do marcador de propósito: quem
  -- substitui costuma trocar todas as ocorrências de uma vez, e aí a própria
  -- verificação passaria a comparar a senha nova com ela mesma.
  v_trocar := NOT (v_senha ILIKE '%troque%');

  IF v_trocar AND length(v_senha) < 12 THEN
    RAISE EXCEPTION 'A senha informada tem menos de 12 caracteres.';
  END IF;

  IF NOT v_existe AND NOT v_trocar THEN
    RAISE EXCEPTION 'O usuário homologacao_leitor_v2 não existe e nenhuma senha '
                    'foi informada. Para criá-lo, defina uma senha na linha indicada.';
  END IF;

  IF NOT v_existe THEN
    EXECUTE format('CREATE ROLE homologacao_leitor_v2 LOGIN PASSWORD %L', v_senha);
    RAISE NOTICE 'Usuário homologacao_leitor_v2 criado.';
  ELSIF v_trocar THEN
    EXECUTE format('ALTER ROLE homologacao_leitor_v2 LOGIN PASSWORD %L', v_senha);
    RAISE NOTICE 'Senha de homologacao_leitor_v2 TROCADA. Atualize também o '
                 'secret PRODUCAO_DB_PASSWORD no GitHub, senão a esteira para '
                 'de conectar.';
  ELSE
    RAISE NOTICE 'Usuário homologacao_leitor_v2 já existia; senha PRESERVADA, '
                 'só as permissões foram reconfirmadas.';
  END IF;

  -- Somente leitura, e nada além disso.
  -- pg_read_all_data é papel de sistema do PostgreSQL: dá SELECT em tudo e
  -- NENHUMA permissão de escrita. Não há como conceder escrita por engano aqui.
  EXECUTE 'GRANT pg_read_all_data TO homologacao_leitor_v2';
  EXECUTE 'GRANT USAGE ON SCHEMA public TO homologacao_leitor_v2';

  -- ISENÇÃO DE RLS — e por que ela é NECESSÁRIA, não conveniente.
  --
  -- pg_read_all_data dá SELECT em tudo, mas NÃO isenta das políticas de
  -- segurança por linha. A própria documentação do PostgreSQL avisa disso e
  -- recomenda BYPASSRLS para papéis que recebem pg_read_all_data.
  --
  -- Sem isso, a primeira cópia de dados falhou 236 vezes com
  --
  --     ERROR: permission denied for function get_user_tenant_id
  --
  -- porque ler uma tabela protegida faz o banco AVALIAR a política, que chama
  -- essas funções auxiliares. E o risco pior não é a falha: é o sucesso
  -- parcial. Com as funções liberadas mas a política valendo, a leitura
  -- devolveria só as linhas visíveis para um usuário sem sessão — quase
  -- nenhuma — e a cópia terminaria "bem", com um espelho vazio que ninguém
  -- perceberia estar vazio.
  --
  -- Isenção de leitura NÃO é permissão de escrita: o papel continua sem poder
  -- alterar coisa alguma. O que muda é que ele passa a enxergar todos os
  -- inquilinos, que é exatamente o que um espelho da produção precisa.
  BEGIN
    EXECUTE 'ALTER ROLE homologacao_leitor_v2 BYPASSRLS';
    RAISE NOTICE 'Isenção de RLS concedida.';
  EXCEPTION WHEN insufficient_privilege OR OTHERS THEN
    RAISE NOTICE 'Não foi possível conceder BYPASSRLS (%). A esteira vai '
                 'reprovar na conferência de linhas se a cópia vier '
                 'incompleta — que é o que se quer que aconteça.', SQLERRM;
  END;

  -- Garantia explícita: nada de criar objeto no banco.
  EXECUTE 'REVOKE CREATE ON SCHEMA public FROM homologacao_leitor_v2';
  EXECUTE 'REVOKE ALL ON DATABASE postgres FROM homologacao_leitor_v2';
  EXECUTE 'GRANT CONNECT ON DATABASE postgres TO homologacao_leitor_v2';
END $cria$;

-- ============================================================================
-- CONFERÊNCIA
-- ============================================================================
SELECT
  'Usuário criado' AS item,
  CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'homologacao_leitor_v2')
       THEN 'ok' ELSE 'FALTA' END AS situacao,
  'é com ele que a esteira lê a estrutura' AS observacao

UNION ALL
SELECT 'Consegue entrar (LOGIN)',
       CASE WHEN EXISTS (SELECT 1 FROM pg_roles
                          WHERE rolname = 'homologacao_leitor_v2' AND rolcanlogin)
            THEN 'ok' ELSE 'FALTA' END,
       'sem isto a esteira não conecta'

UNION ALL
SELECT 'É somente leitura',
       CASE WHEN EXISTS (SELECT 1 FROM pg_auth_members m
                          JOIN pg_roles r ON r.oid = m.roleid
                          JOIN pg_roles u ON u.oid = m.member
                         WHERE u.rolname = 'homologacao_leitor_v2'
                           AND r.rolname = 'pg_read_all_data')
            THEN 'ok' ELSE 'FALTA' END,
       'o banco recusa qualquer escrita deste usuário'

UNION ALL
SELECT 'Isento de RLS (lê todos os inquilinos)',
       CASE WHEN EXISTS (SELECT 1 FROM pg_roles
                          WHERE rolname = 'homologacao_leitor_v2' AND rolbypassrls)
            THEN 'ok' ELSE 'FALTA' END,
       'sem isto a cópia vem vazia, e vem em silêncio'

UNION ALL
SELECT 'NÃO é superusuário',
       CASE WHEN NOT EXISTS (SELECT 1 FROM pg_roles
                              WHERE rolname = 'homologacao_leitor_v2'
                                AND (rolsuper OR rolcreatedb OR rolcreaterole))
            THEN 'ok' ELSE 'PERIGO' END,
       'não cria banco, não cria usuário, não administra'

ORDER BY 1;
