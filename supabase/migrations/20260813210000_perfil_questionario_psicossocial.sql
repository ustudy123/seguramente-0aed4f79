-- =====================================================================
-- Respostas do questionário psicossocial entram na camada de perfil
--
-- Achado ao reler o parecer de perfis de acesso (07/08) contra o sistema
-- de hoje: a recomendação nº 1 foi implementada em 11 tabelas, mas
-- DUAS das mais sensíveis do módulo ficaram de fora —
--
--   · questionario_psicossocial_respostas — as respostas INDIVIDUAIS do
--     questionário, ligadas ao colaborador (colaborador_id + respostas
--     em jsonb + indicadores);
--   · questionario_psicossocial_convites — nome, CPF, cargo,
--     departamento e o token de resposta de cada convidado.
--
-- Hoje as duas são liberadas por "Usuários podem ver ... do seu tenant",
-- que só compara o cliente. Qualquer usuário autenticado da empresa —
-- inclusive um colaborador com perfil restrito, que não enxerga o menu
-- de Psicossocial — alcança, pela API, as respostas de saúde mental dos
-- colegas e os tokens dos convites deles. É exatamente o cenário
-- descrito no parecer, sobre o dado mais sensível da base (LGPD art. 11).
--
-- E a rotina que deveria vigiar isso NÃO ENXERGAVA essas tabelas: a
-- PERFIL-003 varre nomes que começam com "psicossocial_", e estas
-- começam com "questionario_". O ponto cego caía justamente sobre o
-- dado mais sensível — a rotina passava dizendo que estava tudo coberto.
--
-- Este arquivo fecha os dois: aplica a camada de perfil nas duas tabelas
-- e corrige o alcance da vigilância.
--
-- O QUE NÃO MUDA
-- O caminho de quem responde o questionário por link/token não passa por
-- aqui: as políticas abaixo são RESTRICTIVE para `authenticated`, e
-- políticas restritivas só valem para os papéis que nomeiam. Quem
-- responde anonimamente (papel anon) e a gravação via função de sistema
-- (service_role) seguem intactos. Escrita também não é tocada — a
-- exposição é de leitura.
-- =====================================================================

SET lock_timeout = '10s';

DO $rls$
DECLARE
  r RECORD;
  v_ok int := 0;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      -- Respostas individuais: quem tem o módulo, ou o próprio avaliado.
      ('questionario_psicossocial_respostas',
       'perfil_restringe_leitura_questionario_respostas',
       $p$public.perfil_permite_modulo(tenant_id, 'psicossocial')
          OR EXISTS (
               SELECT 1 FROM public.admissoes a
               WHERE a.id = colaborador_id
                 AND regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g')
                     = public.cpf_do_usuario_logado())$p$),

      -- Convites: trazem nome, CPF, cargo, departamento e o token.
      ('questionario_psicossocial_convites',
       'perfil_restringe_leitura_questionario_convites',
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
      v_ok := v_ok + 1;
      RAISE NOTICE 'Camada de perfil aplicada em %.', r.tabela;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'ATENÇÃO: % ficou sem a camada de perfil: %', r.tabela, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '% tabela(s) do questionário com leitura condicionada ao perfil.', v_ok;
END $rls$;

-- ─────────────────────────────────────────────────────────────────────
-- A vigilância passa a enxergar o prefixo "questionario_"
-- Trocar 'psicossocial\_%' por '%psicossocial%' é a correção do ponto
-- cego. A campanha entra como exceção documentada: ela guarda o desenho
-- do ciclo (nome, período, instrumento), não pessoa.
-- ─────────────────────────────────────────────────────────────────────
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
        -- Era 'psicossocial\_%', que deixava de fora
        -- questionario_psicossocial_respostas e _convites — as duas mais
        -- sensíveis do módulo. Ponto cego corrigido em 13/08.
        OR c.table_name LIKE '%psicossocial%'
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
        'psicossocial_riscos',               -- catálogo de riscos ("nome" é o nome do risco)
        -- ACRESCENTADA EM 13/08, com a ampliação do alcance:
        'questionario_psicossocial_campanhas' -- desenho do ciclo (nome, período,
                                              -- instrumento); não guarda pessoa
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

-- ─────────────────────────────────────────────────────────────────────
-- Conferência
-- ─────────────────────────────────────────────────────────────────────
DO $verifica$
DECLARE v_n int;
BEGIN
  SELECT count(*) INTO v_n
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('questionario_psicossocial_respostas', 'questionario_psicossocial_convites')
    AND policyname LIKE 'perfil_restringe_leitura_%'
    AND permissive = 'RESTRICTIVE'
    AND cmd = 'SELECT';

  IF v_n < 2 THEN
    RAISE EXCEPTION 'Camada de perfil incompleta no questionário psicossocial: % de 2.', v_n;
  END IF;
  RAISE NOTICE 'OK: respostas e convites do questionário psicossocial condicionados ao perfil.';
END $verifica$;

-- =====================================================================
-- PERFIL-001 vigiava uma lista de 7 tabelas — a camada já cobre 13
--
-- A rotina foi escrita em 08/08 com as 7 tabelas daquele momento. No
-- mesmo dia mais 4 entraram (afastamentos_saude, alertas_saude,
-- psicossocial_entrevistas_evidencias, psicossocial_participacoes), e
-- hoje entram as 2 do questionário. A lista nunca acompanhou.
--
-- Na prática ela dizia "camada presente em todas as tabelas sensíveis"
-- conferindo pouco mais da metade. Se alguém removesse a política de
-- uma das 6 não vigiadas, esta rotina continuaria verde — só a PERFIL-003
-- acusaria, e por um caminho indireto. Guarda que não cobre o que
-- promete é pior que guarda nenhuma: dá falsa tranquilidade.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.qa_caso_perfil_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_faltando text;
  v_erradas text;
  v_total int;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'AUDITORIA (somente leitura): políticas perfil_restringe_leitura_* no catálogo';
  r.esperado    := '13 tabelas sensíveis com política RESTRICTIVE de SELECT';

  SELECT string_agg(t.tabela, ', ' ORDER BY t.tabela), count(*) INTO v_faltando, v_total
  FROM (VALUES
    -- 08/08, primeira leva
    ('atestados'), ('eventos_saude'), ('documentos'), ('admissao_documentos'),
    ('psicossocial_entrevistas'), ('psicossocial_entrevistas_mensagens'),
    ('psicossocial_alertas'),
    -- 08/08, complemento
    ('afastamentos_saude'), ('alertas_saude'),
    ('psicossocial_entrevistas_evidencias'), ('psicossocial_participacoes'),
    -- 13/08, o questionário — respostas individuais e convites com CPF
    ('questionario_psicossocial_respostas'), ('questionario_psicossocial_convites')
  ) AS t(tabela)
  WHERE to_regclass('public.' || t.tabela) IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename = t.tabela
        AND p.policyname LIKE 'perfil_restringe_leitura_%'
    );

  -- Existir não basta: precisa ser RESTRICTIVE e valer para SELECT.
  SELECT string_agg(p.tablename || ' (' || p.permissive || '/' || p.cmd || ')', ', ')
    INTO v_erradas
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND p.policyname LIKE 'perfil_restringe_leitura_%'
    AND (p.permissive <> 'RESTRICTIVE' OR p.cmd NOT IN ('SELECT', 'ALL'));

  IF v_faltando IS NULL AND v_erradas IS NULL THEN
    r.situacao := 'passou';
    r.obtido   := 'Camada restritiva presente e correta nas 13 tabelas sensíveis.';
  ELSE
    r.situacao := 'falhou';
    r.obtido   := 'A camada de perfil regrediu. '
      || COALESCE('Sem política: ' || v_faltando || '. ', '')
      || COALESCE('Política com forma errada: ' || v_erradas || '. ', '')
      || 'Sem ela, qualquer usuário autenticado do cliente volta a alcançar, pela API, '
      || 'dados de saúde e documentos de todos os colegas.';
    r.detalhe := jsonb_build_object('sem_politica', v_faltando, 'forma_errada', v_erradas);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;
