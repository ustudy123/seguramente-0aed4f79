-- =========================================================
-- QA — Isolamento entre perfis dentro do mesmo cliente
--
-- Recomendação nº 5 do parecer de perfis de acesso (07/08): a suíte já
-- verifica isolamento ENTRE clientes em vários módulos, mas não havia
-- nenhum caso verificando isolamento ENTRE PERFIS dentro do mesmo
-- cliente — exatamente a lacuna corrigida pela camada restritiva de RLS
-- (perfil_restringe_leitura_*) e pelo perfil padrão automático.
--
-- Sem estes casos, qualquer mudança futura — uma política recriada, uma
-- tabela nova de saúde sem a camada, um gatilho derrubado — reabriria o
-- buraco em silêncio. Com eles, a bateria acusa na hora.
--
-- TODAS AS ROTINAS SÃO SOMENTE LEITURA. A PERFIL-004 simula um usuário
-- restrito apenas dentro da própria transação (claims de JWT locais),
-- avalia a função de permissão e desfaz a simulação — nenhum dado é
-- escrito, nenhuma sessão real é afetada.
-- =========================================================

SET lock_timeout = '10s';

-- Módulo de QA próprio para segurança de acesso
INSERT INTO public.qa_modulos (label, path, icone, ordem)
VALUES ('Segurança de Acesso', 'seguranca-acesso', '🔐', 90)
ON CONFLICT (path) DO NOTHING;

INSERT INTO public.qa_modulos (parent_id, label, path)
SELECT m.id, 'Perfis de Acesso', 'seguranca-acesso/perfis'
FROM public.qa_modulos m WHERE m.path = 'seguranca-acesso'
ON CONFLICT (path) DO NOTHING;

-- ─────────────────────────────────────────────────────────
-- Os casos
-- ─────────────────────────────────────────────────────────
DO $doc$
DECLARE v_mod uuid;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos WHERE path = 'seguranca-acesso/perfis';
  IF v_mod IS NULL THEN RAISE EXCEPTION 'Módulo seguranca-acesso/perfis não criado.'; END IF;

  INSERT INTO public.qa_casos_teste
    (modulo_id, codigo, titulo, tipo, prioridade, status, nivel,
     base_legal, objetivo, pre_condicoes, passos, resultado_esperado)
  VALUES
  (v_mod, 'PERFIL-001', 'Camada restritiva de leitura presente nas tabelas sensíveis',
   'feliz', 'critica', 'aprovado', 'api',
   'LGPD, arts. 46 e 47 (medidas de segurança); art. 11 (dado de saúde)',
   'Garantir que as políticas perfil_restringe_leitura_* continuam existindo, como RESTRICTIVE e sobre SELECT, nas tabelas de dado sensível. É o alarme contra regressão da correção de 08/08.',
   'Camada aplicada pelo script de 08/08/2026.',
   '[{"ordem":1,"acao":"Varredura do catálogo (pg_policies)","resultado_esperado":"As 7 tabelas sensíveis com política perfil_restringe_leitura_* RESTRICTIVE em SELECT"}]',
   'Todas as políticas presentes.'),

  (v_mod, 'PERFIL-002', 'Funções de apoio do controle por perfil existem',
   'feliz', 'critica', 'aprovado', 'api',
   'LGPD, arts. 46 e 47',
   'perfil_permite_modulo, cpf_do_usuario_logado e perfil_padrao_colaborador precisam existir: as políticas dependem delas.',
   'Correções de 08/08/2026 aplicadas.',
   '[{"ordem":1,"acao":"Consultar o catálogo de funções","resultado_esperado":"As três funções presentes"}]',
   'Três funções presentes.'),

  (v_mod, 'PERFIL-003', 'Tabela sensível nova sem a camada de perfil é acusada',
   'negativo', 'alta', 'aprovado', 'api',
   'LGPD, art. 46 (proteção desde a concepção)',
   'Detectar tabela de saúde/psicossocial/documento criada DEPOIS da camada e que ficou sem a política restritiva. É a regressão silenciosa mais provável: mesa nova, ninguém lembra da camada.',
   'Nenhuma.',
   '[{"ordem":1,"acao":"Varredura por padrão de nome (atestad%, %saude%, psicossocial%, documento%) com tenant_id e RLS","resultado_esperado":"Todas com política perfil_restringe_leitura_* ou na lista de exceções documentadas"}]',
   'Nenhuma tabela sensível descoberta sem camada.'),

  (v_mod, 'PERFIL-004', 'Perfil restrito não obtém acesso amplo pela função de permissão',
   'negativo', 'critica', 'aprovado', 'api',
   'LGPD, arts. 46 e 47; art. 11',
   'Teste funcional: simula (na transação, sem escrever nada) um usuário real cujo perfil não inclui o módulo atestados e verifica que perfil_permite_modulo nega; e que o escopo proprio_usuario não concede acesso amplo.',
   'Existir ao menos um usuário com vínculo ativo de perfil sem o módulo atestados em escopo amplo.',
   '[{"ordem":1,"acao":"Simular claims do usuário restrito e avaliar perfil_permite_modulo(tenant, atestados)","resultado_esperado":"false"},{"ordem":2,"acao":"Confirmar que permissão em escopo proprio_usuario não vira acesso amplo","resultado_esperado":"continua false"}]',
   'Função nega acesso amplo ao perfil restrito.'),

  (v_mod, 'PERFIL-005', 'Perfil padrão automático ativo para cadastro sem perfil',
   'feliz', 'alta', 'aprovado', 'api',
   'LGPD, art. 6º, III (necessidade)',
   'Os dois gatilhos do perfil padrão (vincular no cadastro sem perfil; substituir quando um perfil de verdade chega) precisam estar habilitados.',
   'Correção de 08/08/2026 aplicada.',
   '[{"ordem":1,"acao":"Consultar pg_trigger","resultado_esperado":"trigger_vincular_perfil_padrao e trigger_substituir_perfil_padrao habilitados"}]',
   'Dois gatilhos habilitados.')
  ON CONFLICT (codigo) DO NOTHING;
END $doc$;

-- ─────────────────────────────────────────────────────────
-- PERFIL-001 — camada restritiva presente
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_caso_perfil_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_faltando text;
  v_erradas text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'AUDITORIA (somente leitura): políticas perfil_restringe_leitura_* no catálogo';
  r.esperado    := '7 tabelas sensíveis com política RESTRICTIVE de SELECT';

  SELECT string_agg(t.tabela, ', ') INTO v_faltando
  FROM (VALUES
    ('atestados'), ('eventos_saude'), ('documentos'), ('admissao_documentos'),
    ('psicossocial_entrevistas'), ('psicossocial_entrevistas_mensagens'),
    ('psicossocial_alertas')
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
    r.obtido   := 'Camada restritiva presente e correta em todas as tabelas sensíveis.';
  ELSE
    r.situacao := 'falhou';
    r.obtido   := 'A camada de perfil regrediu. '
      || COALESCE('Sem política: ' || v_faltando || '. ', '')
      || COALESCE('Política com forma errada: ' || v_erradas || '. ', '')
      || 'Sem ela, qualquer usuário autenticado do cliente volta a alcançar, pela API, '
      || 'dados de saúde e documentos de todos os colegas.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- ─────────────────────────────────────────────────────────
-- PERFIL-002 — funções de apoio existem
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_caso_perfil_002()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_faltando text := '';
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'AUDITORIA (somente leitura): funções do controle por perfil';
  r.esperado    := 'perfil_permite_modulo, cpf_do_usuario_logado e perfil_padrao_colaborador presentes';

  IF to_regprocedure('public.perfil_permite_modulo(uuid, text[])') IS NULL THEN
    v_faltando := v_faltando || 'perfil_permite_modulo ';
  END IF;
  IF to_regprocedure('public.cpf_do_usuario_logado()') IS NULL THEN
    v_faltando := v_faltando || 'cpf_do_usuario_logado ';
  END IF;
  IF to_regprocedure('public.perfil_padrao_colaborador(uuid)') IS NULL THEN
    v_faltando := v_faltando || 'perfil_padrao_colaborador ';
  END IF;

  IF v_faltando = '' THEN
    r.situacao := 'passou';
    r.obtido   := 'As três funções existem.';
  ELSE
    r.situacao := 'falhou';
    r.obtido   := 'Função(ões) ausente(s): ' || v_faltando
      || '— as políticas restritivas dependem delas; sem a função, a política que a chama '
      || 'passa a NEGAR tudo (efeito visível) ou foi derrubada junto (efeito silencioso).';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- ─────────────────────────────────────────────────────────
-- PERFIL-003 — tabela sensível nova sem a camada
-- ─────────────────────────────────────────────────────────
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
      -- exceções conscientes: catálogos sem dado pessoal identificável
      AND c.table_name NOT IN ('psicossocial_dimensoes', 'psicossocial_ghe',
                               'psicossocial_consentimentos')
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
      || 'perfil_restringe_leitura_<tabela>; se for catálogo sem dado pessoal, adicionar à '
      || 'lista de exceções desta rotina com justificativa.';
    r.detalhe := jsonb_build_object('tabelas', v_lista);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- ─────────────────────────────────────────────────────────
-- PERFIL-004 — perfil restrito não obtém acesso amplo (funcional)
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_caso_perfil_004()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_uid uuid;
  v_tenant uuid;
  v_claims_antes text;
  v_amplo boolean;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'FUNCIONAL (somente leitura): simular usuário de perfil restrito e avaliar a função de permissão';
  r.esperado    := 'perfil_permite_modulo(tenant, atestados) = false para o usuário restrito';

  -- Um usuário REAL com vínculo ativo cujo perfil NÃO tem 'atestados'
  -- em escopo amplo, e que não seja administrador/gestor nem tenha papel
  -- manager+ (senão a função libera pela hierarquia, corretamente).
  SELECT ub.auth_user_id, ub.tenant_id INTO v_uid, v_tenant
  FROM public.usuarios_base ub
  JOIN public.usuario_perfil_vinculos v
    ON v.usuario_id = ub.id AND COALESCE(v.ativo, true) = true
  WHERE ub.auth_user_id IS NOT NULL
    AND COALESCE(ub.status::text, 'ativo') = 'ativo'
    AND COALESCE(ub.tipo_usuario::text, '') NOT IN ('administrador', 'gestor')
    AND NOT public.has_minimum_role(ub.auth_user_id, 'manager'::public.app_role)
    AND NOT EXISTS (
      SELECT 1 FROM public.perfil_permissoes pp
      WHERE pp.perfil_id = v.perfil_id
        AND COALESCE(pp.ativo, true) = true
        AND pp.modulo IN ('atestados', 'sst')
        AND COALESCE(pp.escopo, 'empresa') <> 'proprio_usuario'
    )
  LIMIT 1;

  IF v_uid IS NULL THEN
    r.situacao := 'nao_implementado';
    r.obtido   := 'Nenhum usuário com perfil restrito (sem atestados amplo) encontrado nesta '
               || 'base para o teste funcional. Crie um perfil sem o módulo de saúde e vincule '
               || 'a um usuário de teste.';
    RETURN r;
  END IF;

  -- Simulação local à transação: troca as claims, avalia, restaura.
  v_claims_antes := current_setting('request.jwt.claims', true);
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', v_uid, 'role', 'authenticated')::text,
                     true);

  v_amplo := public.perfil_permite_modulo(v_tenant, 'atestados');

  PERFORM set_config('request.jwt.claims', COALESCE(v_claims_antes, ''), true);

  IF v_amplo IS FALSE THEN
    r.situacao := 'passou';
    r.obtido   := 'Usuário de perfil restrito negado para acesso amplo a atestados, como devido.';
  ELSE
    r.situacao := 'falhou';
    r.obtido   := 'Um usuário cujo perfil NÃO inclui o módulo de atestados obteve acesso amplo '
               || 'pela função de permissão. A camada restritiva de RLS está deixando passar — '
               || 'os atestados de todos os colegas voltaram a ficar alcançáveis pela API.';
    r.detalhe  := jsonb_build_object('auth_user_id', v_uid, 'tenant_id', v_tenant);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- ─────────────────────────────────────────────────────────
-- PERFIL-005 — perfil padrão automático ativo
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_caso_perfil_005()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_qtd int;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'AUDITORIA (somente leitura): gatilhos do perfil padrão';
  r.esperado    := 'trigger_vincular_perfil_padrao e trigger_substituir_perfil_padrao habilitados';

  SELECT count(*) INTO v_qtd
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  WHERE t.tgname IN ('trigger_vincular_perfil_padrao', 'trigger_substituir_perfil_padrao')
    AND t.tgenabled <> 'D';

  IF v_qtd = 2 THEN
    r.situacao := 'passou';
    r.obtido   := 'Os dois gatilhos do perfil padrão estão habilitados.';
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('%s de 2 gatilho(s) habilitado(s). Sem eles, usuário criado sem perfil '
               || 'volta ao limbo (entra e não vê nada) e o perfil automático deixa de ceder '
               || 'lugar ao perfil escolhido pelo RH.', v_qtd);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- ─────────────────────────────────────────────────────────
-- Ligar caso <-> rotina e rodar a bateria do módulo
-- ─────────────────────────────────────────────────────────
INSERT INTO public.qa_implementacoes (codigo, funcao_sql, ativo) VALUES
  ('PERFIL-001', 'qa_caso_perfil_001', true),
  ('PERFIL-002', 'qa_caso_perfil_002', true),
  ('PERFIL-003', 'qa_caso_perfil_003', true),
  ('PERFIL-004', 'qa_caso_perfil_004', true),
  ('PERFIL-005', 'qa_caso_perfil_005', true)
ON CONFLICT (codigo) DO UPDATE SET funcao_sql = EXCLUDED.funcao_sql, ativo = true;

DO $roda$
BEGIN
  PERFORM public.qa_rodar_bateria('manual', 'seguranca-acesso/perfis');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Bateria não rodou agora (%). As rotinas ficam registradas e entram na próxima execução agendada.', SQLERRM;
END $roda$;


-- =====================================================================
-- CONFERÊNCIA — rode junto
-- =====================================================================

-- 1) Os 5 casos registrados e ligados às rotinas?
SELECT c.codigo, c.titulo, i.funcao_sql, i.ativo
FROM public.qa_casos_teste c
JOIN public.qa_implementacoes i ON i.codigo = c.codigo
WHERE c.codigo LIKE 'PERFIL-%'
ORDER BY c.codigo;

-- 2) Resultado de cada rotina, agora:
SELECT 'PERFIL-001' AS caso, (public.qa_caso_perfil_001()).situacao, (public.qa_caso_perfil_001()).obtido
UNION ALL
SELECT 'PERFIL-002', (public.qa_caso_perfil_002()).situacao, (public.qa_caso_perfil_002()).obtido
UNION ALL
SELECT 'PERFIL-003', (public.qa_caso_perfil_003()).situacao, (public.qa_caso_perfil_003()).obtido
UNION ALL
SELECT 'PERFIL-004', (public.qa_caso_perfil_004()).situacao, (public.qa_caso_perfil_004()).obtido
UNION ALL
SELECT 'PERFIL-005', (public.qa_caso_perfil_005()).situacao, (public.qa_caso_perfil_005()).obtido
ORDER BY 1;
