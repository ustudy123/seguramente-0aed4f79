-- ============================================================================
-- YourEyes · PRODUÇÃO · Férias entram na camada de perfil
--
-- O QUE ESTE SCRIPT RESOLVE
--
-- Hoje, na produção, qualquer usuário autenticado com vínculo à empresa
-- alcança pela API os dados de férias de TODOS os colegas — e a tabela de
-- solicitações guarda salario_base, valor_ferias, valor_terco e
-- valor_total_bruto. Na prática: salário de colega exposto a quem tiver login.
--
-- Depois deste script:
--   • quem administra férias (superadmin, gestor para cima, tipo
--     administrador/gestor, ou perfil com o módulo Férias ou Colaboradores em
--     escopo amplo) continua vendo tudo, exatamente como hoje;
--   • todo o resto passa a ver apenas as próprias linhas, pelo CPF.
--
-- O QUE NÃO MUDA
--   • Escrita: as políticas são de LEITURA. Ninguém perde a capacidade de
--     lançar, aprovar ou calcular.
--   • Assinatura do aviso por link público: a página lê por função de borda,
--     e política RESTRICTIVE só vale para o papel que ela nomeia
--     (`authenticated`). O link segue funcionando para quem não tem sessão.
--   • Telas: nada a publicar no Lovable por causa deste script.
--
-- SEGURO DE RODAR DUAS VEZES. Nenhum dado é alterado — só políticas de
-- leitura e três rotinas de QA.
--
-- COMO RODAR: cole o arquivo inteiro no SQL Editor do projeto de PRODUÇÃO e
-- execute. O editor mostra apenas o ÚLTIMO resultado — é a conferência, com
-- uma linha por tabela e a coluna `erro_tecnico` quando algo não foi aplicado.
-- ============================================================================

SET lock_timeout = '10s';

DO $rls$
DECLARE
  r RECORD;
  v_ok int := 0;
  v_falhou int := 0;
  -- Quem administra férias. Aceita os dois módulos pela ressalva acima.
  c_admin CONSTANT text :=
    $a$public.perfil_permite_modulo(tenant_id, 'ferias', 'colaboradores')$a$;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      -- Período aquisitivo: dias de direito, saldo e faltas consideradas.
      ('ferias_periodos_aquisitivos', 'perfil_restringe_leitura_ferias_periodos',
       $p$regexp_replace(COALESCE(colaborador_cpf, ''), '[^0-9]', '', 'g')
          = public.cpf_do_usuario_logado()$p$),

      -- Programação: datas pretendidas de cada subperíodo e abono.
      ('ferias_programacao', 'perfil_restringe_leitura_ferias_programacao',
       $p$regexp_replace(COALESCE(colaborador_cpf, ''), '[^0-9]', '', 'g')
          = public.cpf_do_usuario_logado()$p$),

      -- Solicitações: a mais sensível — salário-base e valores apurados.
      ('ferias_solicitacoes', 'perfil_restringe_leitura_ferias_solicitacoes',
       $p$regexp_replace(COALESCE(colaborador_cpf, ''), '[^0-9]', '', 'g')
          = public.cpf_do_usuario_logado()$p$),

      -- Cálculo da folha de férias: remuneração, bases e memória.
      ('folha_ferias_calculo', 'perfil_restringe_leitura_folha_ferias_calculo',
       $p$regexp_replace(COALESCE(colaborador_cpf, ''), '[^0-9]', '', 'g')
          = public.cpf_do_usuario_logado()$p$),

      -- Links de assinatura: carregam salário-base e o token do documento.
      ('ferias_assinatura_links', 'perfil_restringe_leitura_ferias_assinatura',
       $p$regexp_replace(COALESCE(colaborador_cpf, ''), '[^0-9]', '', 'g')
          = public.cpf_do_usuario_logado()$p$),

      -- Histórico: guarda antes/depois das solicitações, com os valores.
      -- Não tem CPF próprio; a dona do dado é a solicitação de origem.
      ('ferias_historico', 'perfil_restringe_leitura_ferias_historico',
       $p$EXISTS (
            SELECT 1 FROM public.ferias_solicitacoes s
            WHERE s.id = ferias_historico.solicitacao_id
              AND regexp_replace(COALESCE(s.colaborador_cpf, ''), '[^0-9]', '', 'g')
                  = public.cpf_do_usuario_logado())$p$),

      -- Vínculo familiar: liga duas pessoas pelo nome e CPF. Cada uma
      -- enxerga os pares de que participa.
      ('ferias_vinculo_familiar', 'perfil_restringe_leitura_ferias_vinculo_familiar',
       $p$public.cpf_do_usuario_logado() IN (
            regexp_replace(COALESCE(cpf_a, ''), '[^0-9]', '', 'g'),
            regexp_replace(COALESCE(cpf_b, ''), '[^0-9]', '', 'g'))$p$)
    ) AS t(tabela, politica, predicado_proprio)
  LOOP
    BEGIN
      IF to_regclass('public.' || r.tabela) IS NULL THEN
        RAISE NOTICE 'Tabela % não existe nesta base; pulada.', r.tabela;
        CONTINUE;
      END IF;

      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.politica, r.tabela);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (%s OR %s)',
        r.politica, r.tabela, c_admin, r.predicado_proprio);
      v_ok := v_ok + 1;
      RAISE NOTICE 'Camada de perfil aplicada em %.', r.tabela;
    EXCEPTION WHEN OTHERS THEN
      v_falhou := v_falhou + 1;
      RAISE NOTICE 'ATENÇÃO: % ficou sem a camada de perfil: %', r.tabela, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '% tabela(s) de férias com leitura condicionada ao perfil (% falha(s)).',
    v_ok, v_falhou;
END $rls$;

-- ─────────────────────────────────────────────────────────────────────
-- A vigilância passa a enxergar o módulo Férias
--
-- PERFIL-003 varre tabelas de padrão sensível sem a camada de perfil.
-- Férias não estava no padrão — por isso o módulo inteiro ficou fora sem
-- que a rotina acusasse nada. Mesmo ponto cego que o questionário
-- psicossocial teve em 13/08, e a correção é a mesma: ampliar o alcance
-- e declarar as exceções.
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
        OR c.table_name LIKE '%psicossocial%'
        -- ACRESCENTADO EM 14/08: o módulo Férias guarda salário-base e
        -- valores apurados por pessoa. Ficou fora da camada desde o
        -- início porque não casava com nenhum padrão vigiado.
        OR c.table_name LIKE 'ferias%'
        OR c.table_name LIKE 'folha\_ferias%'
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
        'questionario_psicossocial_campanhas',-- desenho do ciclo; não guarda pessoa
        -- ACRESCENTADA EM 14/08, com a entrada do módulo Férias:
        'ferias_config'                       -- percentuais de encargo da EMPRESA
                                              -- (INSS patronal, RAT/FAP, FGTS);
                                              -- parâmetro, não pessoa
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
-- PERFIL-001 passa a vigiar 20 tabelas (eram 13)
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_caso_perfil_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_faltando text;
  v_erradas text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'AUDITORIA (somente leitura): políticas perfil_restringe_leitura_* no catálogo';
  r.esperado    := '20 tabelas sensíveis com política RESTRICTIVE de SELECT';

  SELECT string_agg(t.tabela, ', ' ORDER BY t.tabela) INTO v_faltando
  FROM (VALUES
    -- 08/08, primeira leva
    ('atestados'), ('eventos_saude'), ('documentos'), ('admissao_documentos'),
    ('psicossocial_entrevistas'), ('psicossocial_entrevistas_mensagens'),
    ('psicossocial_alertas'),
    -- 08/08, complemento
    ('afastamentos_saude'), ('alertas_saude'),
    ('psicossocial_entrevistas_evidencias'), ('psicossocial_participacoes'),
    -- 13/08, o questionário — respostas individuais e convites com CPF
    ('questionario_psicossocial_respostas'), ('questionario_psicossocial_convites'),
    -- 14/08, o módulo Férias — salário-base e valores por pessoa
    ('ferias_periodos_aquisitivos'), ('ferias_programacao'), ('ferias_solicitacoes'),
    ('folha_ferias_calculo'), ('ferias_assinatura_links'), ('ferias_historico'),
    ('ferias_vinculo_familiar')
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
    r.obtido   := 'Camada restritiva presente e correta nas 20 tabelas sensíveis.';
  ELSE
    r.situacao := 'falhou';
    r.obtido   := 'A camada de perfil regrediu. '
      || COALESCE('Sem política: ' || v_faltando || '. ', '')
      || COALESCE('Política com forma errada: ' || v_erradas || '. ', '')
      || 'Sem ela, qualquer usuário autenticado do cliente volta a alcançar, pela API, '
      || 'dados de saúde, documentos e salário de todos os colegas.';
    r.detalhe := jsonb_build_object('sem_politica', v_faltando, 'forma_errada', v_erradas);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- FERIAS-017 era falso negativo
--
-- A rotina procurava vínculo familiar por NOME DE COLUNA ('%familiar%',
-- '%conjuge%'). O recurso existe como TABELA PRÓPRIA
-- (ferias_vinculo_familiar, com tela e com a regra do art. 136 §1º no
-- motor de programação), e as colunas se chamam cpf_a/cpf_b/grau — nada
-- casava. A rotina acusava ausência de algo que está pronto.
--
-- Rotina que acusa o que não existe treina a equipe a ignorar o relatório.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_017()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o cadastro registra vínculo familiar entre colaboradores?';
  r.esperado := 'Familiares na mesma empresa sinalizados para a preferência de coincidência';

  -- Procura, nesta ordem: tabela dedicada, coluna com o padrão, função.
  v_est := CASE WHEN to_regclass('public.ferias_vinculo_familiar') IS NOT NULL
                THEN 'tabela ferias_vinculo_familiar' END;
  v_est := COALESCE(v_est,
                    public.qa_col_existe(NULL, '%conjuge%'),
                    public.qa_col_existe(NULL, '%familiar%'),
                    public.qa_fns_com('%familiar%ferias%'));

  IF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: nenhum campo liga colaboradores da mesma família — a preferência do '
             || 'art. 136, §1º (familiares na mesma empresa tirarem férias juntos, se não '
             || 'prejudicar o serviço) não tem como ser sinalizada na programação. É direito '
             || 'informativo, não bloqueante. Correção: vínculo familiar no cadastro + aviso '
             || 'de coincidência na programação.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Vínculo familiar presente: %s. A regra do art. 136, §1º é avaliada na '
                    || 'programação como informativo.', v_est);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ============================================================================
-- CONFERÊNCIA — é o único resultado que o editor mostra
--
-- Leia a coluna `situacao`. Tudo "ok" significa que os dados de férias
-- passaram a respeitar o perfil de acesso.
-- ============================================================================
WITH esperado AS MATERIALIZED (
  SELECT * FROM (VALUES
    ('ferias_solicitacoes',          'salário-base e valores apurados por pessoa'),
    ('ferias_periodos_aquisitivos',  'dias de direito, saldo e faltas'),
    ('ferias_programacao',           'datas pretendidas e abono'),
    ('folha_ferias_calculo',         'remuneração, bases e memória de cálculo'),
    ('ferias_assinatura_links',      'salário-base e token do documento'),
    ('ferias_historico',             'antes/depois das solicitações'),
    ('ferias_vinculo_familiar',      'nome e CPF de familiares')
  ) AS t(tabela, conteudo)
)
SELECT
  e.tabela AS item,
  CASE WHEN p.policyname IS NOT NULL THEN 'ok' ELSE 'FALTA' END AS situacao,
  CASE WHEN p.policyname IS NOT NULL THEN ''
       ELSE 'sem a camada de perfil — ' || e.conteudo || ' seguem visíveis a toda a empresa'
  END AS erro_tecnico
FROM esperado e
LEFT JOIN pg_policies p
  ON p.schemaname = 'public'
 AND p.tablename = e.tabela
 AND p.policyname LIKE 'perfil_restringe_leitura_%'
 AND p.permissive = 'RESTRICTIVE'
 AND p.cmd = 'SELECT'

UNION ALL

SELECT 'Vigilância PERFIL-001 (20 tabelas)',
       (public.qa_caso_perfil_001()).situacao::text,
       CASE WHEN (public.qa_caso_perfil_001()).situacao::text = 'passou' THEN ''
            ELSE left((public.qa_caso_perfil_001()).obtido, 200) END

UNION ALL

SELECT 'Vigilância PERFIL-003 (padrão sensível)',
       (public.qa_caso_perfil_003()).situacao::text,
       CASE WHEN (public.qa_caso_perfil_003()).situacao::text = 'passou' THEN ''
            ELSE left((public.qa_caso_perfil_003()).obtido, 200) END

UNION ALL

SELECT 'FERIAS-017 (falso negativo corrigido)',
       (public.qa_caso_ferias_017()).situacao::text,
       CASE WHEN (public.qa_caso_ferias_017()).situacao::text = 'passou' THEN ''
            ELSE left((public.qa_caso_ferias_017()).obtido, 200) END
ORDER BY 1;
