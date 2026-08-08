-- =====================================================================
-- A rotina de QA achou o que devia: 11 tabelas fora da camada
--
-- Primeira execução da bateria PERFIL em produção (08/08):
--   PERFIL-003 falhou listando 11 tabelas de padrão sensível sem a
--   camada de perfil — a base real tem mais tabelas que o ambiente de
--   teste onde a camada foi desenhada. É exatamente o tipo de achado
--   para o qual a rotina existe.
--   PERFIL-004 deu erro: a busca do usuário de teste avaliava o papel
--   (has_minimum_role) usuário a usuário sobre a base inteira — em
--   produção, com milhares de usuários, isso estoura o tempo.
--
-- Este arquivo fecha os dois:
--
-- 1) TRIAGEM DAS 11 — quatro guardam dado pessoal identificável e
--    RECEBEM a camada:
--      afastamentos_saude          CID e afastamento de uma pessoa
--      alertas_saude               alerta de saúde nominal
--      psicossocial_entrevistas_evidencias  evidência de entrevista
--      psicossocial_participacoes  quem participou da campanha (CPF)
--    As outras sete são organizacionais — catálogo de riscos, GHE por
--    cargo, índice agregado, inventário, plano de ação por GHE e o
--    responsável técnico do programa (profissional, não trabalhador) —
--    e entram como EXCEÇÕES DOCUMENTADAS da rotina, cada uma com o
--    porquê no comentário abaixo.
--
-- 2) PERFIL-004 reescrita: primeiro seleciona poucos candidatos por
--    critérios baratos de SQL, depois confere o papel só nesses. E o
--    erro técnico, se houver, sai no relatório.
-- =====================================================================

SET lock_timeout = '10s';

-- 1) CAMADA NAS QUATRO TABELAS QUE FALTAVAM ----------------------------
DO $rls$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('afastamentos_saude', 'perfil_restringe_leitura_afastamentos_saude',
       $p$public.perfil_permite_modulo(tenant_id, 'atestados', 'sst')
          OR EXISTS (
               SELECT 1 FROM public.afastamentos af
               WHERE af.id = afastamento_id
                 AND regexp_replace(COALESCE(af.colaborador_cpf, ''), '[^0-9]', '', 'g')
                     = public.cpf_do_usuario_logado())$p$),

      ('alertas_saude', 'perfil_restringe_leitura_alertas_saude',
       $p$public.perfil_permite_modulo(tenant_id, 'atestados', 'sst')
          OR EXISTS (
               SELECT 1 FROM public.admissoes a
               WHERE a.id = colaborador_id
                 AND regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g')
                     = public.cpf_do_usuario_logado())$p$),

      ('psicossocial_entrevistas_evidencias', 'perfil_restringe_leitura_psico_entrev_evid',
       $p$public.perfil_permite_modulo(tenant_id, 'psicossocial')
          OR EXISTS (
               SELECT 1 FROM public.psicossocial_entrevistas e
               JOIN public.admissoes a ON a.id = e.colaborador_id
               WHERE e.id = entrevista_id
                 AND regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g')
                     = public.cpf_do_usuario_logado())$p$),

      ('psicossocial_participacoes', 'perfil_restringe_leitura_psico_participacoes',
       $p$public.perfil_permite_modulo(tenant_id, 'psicossocial')
          OR regexp_replace(COALESCE(colaborador_cpf, ''), '[^0-9]', '', 'g')
             = public.cpf_do_usuario_logado()$p$)
    ) AS t(tabela, politica, predicado)
  LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.politica, r.tabela);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (%s)',
        r.politica, r.tabela, r.predicado);
      RAISE NOTICE 'Camada de perfil aplicada em %.', r.tabela;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'ATENÇÃO: % ficou sem a camada: %', r.tabela, SQLERRM;
    END;
  END LOOP;
END $rls$;

-- 2) PERFIL-003 COM AS EXCEÇÕES DOCUMENTADAS ---------------------------
-- Cada exceção tem o porquê. Tabela nova legítima entra AQUI com
-- justificativa — nunca silenciando a rotina.
CREATE OR REPLACE FUNCTION public.qa_caso_perfil_003()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_lista text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'AUDITORIA (somente leitura): tabelas de padrão sensível sem a camada de perfil';
  r.esperado    := 'Nenhuma tabela sensível descoberta sem política perfil_restringe_leitura_*';

  SELECT string_agg(x.table_name, ', ' ORDER BY x.table_name) INTO v_lista
  FROM (
    SELECT DISTINCT c.table_name
    FROM information_schema.columns c
    JOIN pg_class pc ON pc.relname = c.table_name AND pc.relkind = 'r'
    JOIN pg_namespace pn ON pn.oid = pc.relnamespace AND pn.nspname = 'public'
    WHERE c.table_schema = 'public'
      AND c.column_name = 'tenant_id'
      AND (c.table_name LIKE 'atestado%'
        OR c.table_name LIKE '%\_saude%'
        OR c.table_name LIKE 'psicossocial\_%'
        OR c.table_name IN ('documentos', 'admissao_documentos'))
      AND c.table_name NOT IN (
        -- EXCEÇÕES DOCUMENTADAS (triagem de 08/08/2026):
        'psicossocial_dimensoes',            -- catálogo de dimensões, sem dado pessoal
        'psicossocial_ghe',                  -- grupos homogêneos, organizacional
        'psicossocial_ghe_cargos',           -- relação GHE x cargo, organizacional
        'psicossocial_consentimentos',       -- registro anônimo por hash de sessão
        'psicossocial_evidencias',           -- evidência de risco organizacional, sem pessoa
        'psicossocial_indice_confiabilidade',-- índice agregado (contagens), sem pessoa
        'psicossocial_inventario_riscos',    -- inventário organizacional de riscos
        'psicossocial_plano_acao',           -- plano de ação por GHE, organizacional
        'psicossocial_responsavel_tecnico',  -- dados do RT do programa (profissional que
                                             -- assina o documento, não trabalhador avaliado)
        'psicossocial_riscos'                -- catálogo de riscos ("nome" é o nome do risco)
      )
      AND NOT EXISTS (
        SELECT 1 FROM pg_policies p
        WHERE p.schemaname = 'public'
          AND p.tablename = c.table_name
          AND p.policyname LIKE 'perfil_restringe_leitura_%'
      )
  ) x;

  IF v_lista IS NULL THEN
    r.situacao := 'passou';
    r.obtido   := 'Nenhuma tabela de padrão sensível sem a camada de perfil.';
  ELSE
    r.situacao := 'falhou';
    r.obtido   := 'Tabela(s) de padrão sensível SEM a camada de perfil: ' || v_lista
      || '. Se a tabela guarda dado pessoal identificável, aplicar a política '
      || 'perfil_restringe_leitura_<tabela>; se for organizacional, adicionar à lista de '
      || 'exceções desta rotina com justificativa.';
    r.detalhe := jsonb_build_object('tabelas', v_lista);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- 3) PERFIL-004 EFICIENTE ----------------------------------------------
-- Poucos candidatos por SQL barato; o papel (has_minimum_role) só é
-- conferido nesses poucos. Em base grande, a versão anterior estourava
-- o tempo avaliando o papel de usuário em usuário.
CREATE OR REPLACE FUNCTION public.qa_caso_perfil_004()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  c RECORD;
  v_uid uuid;
  v_tenant uuid;
  v_claims_antes text;
  v_amplo boolean;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'FUNCIONAL (somente leitura): simular usuário de perfil restrito e avaliar a função de permissão';
  r.esperado    := 'perfil_permite_modulo(tenant, atestados) = false para o usuário restrito';

  -- Até 25 candidatos pelos critérios baratos; o papel é conferido só
  -- aqui dentro, um a um, e paramos no primeiro que serve.
  FOR c IN
    SELECT ub.auth_user_id, ub.tenant_id
    FROM public.usuarios_base ub
    WHERE ub.auth_user_id IS NOT NULL
      AND COALESCE(ub.status::text, 'ativo') = 'ativo'
      AND COALESCE(ub.tipo_usuario::text, '') NOT IN ('administrador', 'gestor')
      AND EXISTS (
        SELECT 1 FROM public.usuario_perfil_vinculos v
        WHERE v.usuario_id = ub.id AND COALESCE(v.ativo, true) = true
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_perfil_vinculos v
        JOIN public.perfil_permissoes pp
          ON pp.perfil_id = v.perfil_id
         AND COALESCE(pp.ativo, true) = true
         AND pp.modulo IN ('atestados', 'sst')
         AND COALESCE(pp.escopo, 'empresa') <> 'proprio_usuario'
        WHERE v.usuario_id = ub.id AND COALESCE(v.ativo, true) = true
      )
    LIMIT 25
  LOOP
    IF NOT public.has_minimum_role(c.auth_user_id, 'manager'::public.app_role)
       AND NOT public.is_superadmin(c.auth_user_id) THEN
      v_uid := c.auth_user_id;
      v_tenant := c.tenant_id;
      EXIT;
    END IF;
  END LOOP;

  IF v_uid IS NULL THEN
    r.situacao := 'nao_implementado';
    r.obtido   := 'Nenhum usuário com perfil restrito (sem atestados amplo) encontrado entre os '
               || 'candidatos. Crie um perfil sem o módulo de saúde e vincule a um usuário de teste.';
    RETURN r;
  END IF;

  v_claims_antes := current_setting('request.jwt.claims', true);
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', v_uid, 'role', 'authenticated')::text,
                     true);

  BEGIN
    v_amplo := public.perfil_permite_modulo(v_tenant, 'atestados');
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claims', COALESCE(v_claims_antes, ''), true);
    RAISE;
  END;

  PERFORM set_config('request.jwt.claims', COALESCE(v_claims_antes, ''), true);

  IF v_amplo IS FALSE THEN
    r.situacao := 'passou';
    r.obtido   := 'Usuário de perfil restrito negado para acesso amplo a atestados, como devido.';
  ELSE
    r.situacao := 'falhou';
    r.obtido   := 'Um usuário cujo perfil NÃO inclui o módulo de atestados obteve acesso amplo '
               || 'pela função de permissão. A camada restritiva está deixando passar.';
    r.detalhe  := jsonb_build_object('auth_user_id', v_uid, 'tenant_id', v_tenant);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;
