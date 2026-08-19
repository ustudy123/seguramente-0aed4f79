-- ============================================================================
-- YourEyes · PRODUÇÃO · Auditorias de proteção do motor de QA
--
-- O QUE ESTE SCRIPT ENTREGA
--
-- Dez rotinas de auditoria, mais três funções auxiliares que elas usam.
-- São SOMENTE LEITURA: consultam o catálogo do banco (políticas, gatilhos,
-- travas) e respondem a uma pergunta só — "as proteções estão de pé AQUI?".
--
-- Nenhuma delas grava nada. Nenhuma usa o modo de teste, nem os clientes de
-- sandbox. Podem rodar na produção a qualquer hora, inclusive em horário de
-- expediente.
--
-- POR QUE ESTAS, E NÃO O MOTOR INTEIRO
--
-- O motor tem 466 rotinas. As 272 que plantam dado (mesmo revertendo) ficam
-- no ambiente de teste: elas conferem se o banco recusa o inválido, e isso
-- depende só da estrutura — com os dois ambientes alinhados, a resposta é a
-- mesma nos dois. Já as auditorias de proteção só dizem a verdade se rodarem
-- ONDE a proteção precisa existir. Foi assim que descobrimos, nesta semana,
-- que a trava de autoaprovação do ponto não existia na produção.
--
-- AS AUXILIARES VÃO JUNTO, DE PROPÓSITO
-- qa_col_existe, qa_coluna_existe e qa_fns_com são chamadas por algumas
-- destas rotinas. Foi a ausência delas que fez a FERIAS-017 voltar "A rotina
-- quebrou" em 14/08: a rotina foi entregue e as auxiliares não. Rotina de QA
-- meia-entregue produz diagnóstico falso, que é pior que rotina nenhuma.
--
-- SEGURO DE RODAR DUAS VEZES. Só substitui funções; nenhum dado é tocado.
--
-- COMO RODAR: cole o arquivo inteiro no SQL Editor do projeto de PRODUÇÃO.
-- O último resultado é a conferência, com o veredito de cada auditoria.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.qa_col_existe(p_tabela text, p_col_padrao text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT string_agg(table_name || '.' || column_name, ', ')
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND (p_tabela IS NULL OR table_name = p_tabela)
    AND column_name ILIKE p_col_padrao;
$function$

;

CREATE OR REPLACE FUNCTION public.qa_coluna_existe(p_tabela text, p_coluna text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = p_tabela AND column_name = p_coluna);
$function$

;

CREATE OR REPLACE FUNCTION public.qa_fns_com(p_padrao text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT string_agg(p.proname, ', ')
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE p_padrao;
$function$

;

CREATE OR REPLACE FUNCTION public.qa_caso_adm_110()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno; v_rls boolean; v_policies int; v_tem_classificacao boolean;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'Conferir RLS e politicas em public.documentos';
  r.esperado    := 'RLS ligada, com politicas, e classificacao propria para dado de saude';

  SELECT relrowsecurity INTO v_rls FROM pg_class WHERE oid = 'public.documentos'::regclass;
  SELECT count(*) INTO v_policies FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'documentos';

  v_tem_classificacao := public.qa_coluna_existe('documentos','sensivel')
                      OR public.qa_coluna_existe('documentos','classificacao')
                      OR public.qa_coluna_existe('documentos','categoria_acesso');

  IF NOT COALESCE(v_rls,false) OR v_policies = 0 THEN
    r.situacao := 'falhou';
    r.obtido   := format('RLS em public.documentos: %s; politicas: %s. Documento pessoal sem '
               || 'protecao de linha e acessivel a qualquer sessao autenticada.',
               COALESCE(v_rls,false), v_policies);
  ELSIF NOT v_tem_classificacao THEN
    r.situacao := 'falhou';
    r.obtido   := format('RLS ligada com %s politica(s) — a base do acesso esta protegida. '
               || 'PORÉM nao existe nenhuma coluna que classifique o documento como sensivel. '
               || 'RG, comprovante de residencia e ASO recebem o mesmo tratamento de acesso. '
               || 'A LGPD da regime proprio ao dado de saude (art. 5o, II e art. 11), e o '
               || 'ASO admissional entra no sistema como o nono item de uma lista de anexos '
               || 'genericos. Correcao: classificar o documento na origem e diferenciar a '
               || 'politica de acesso por classificacao.', v_policies);
    r.detalhe  := jsonb_build_object('rls', v_rls, 'politicas', v_policies,
                                     'tem_classificacao_de_sensibilidade', false);
  ELSE
    r.situacao := 'passou';
    r.obtido   := format('RLS ligada, %s politica(s), e existe classificacao de sensibilidade.',
                          v_policies);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $function$

;

CREATE OR REPLACE FUNCTION public.qa_caso_emp_050()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_conta boolean; v_trigger boolean;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o total de empregados é derivado dos vínculos ativos?';
  r.esperado := 'total_colaboradores calculado da contagem real, atualizado por movimentação';
  SELECT bool_or(p.prosrc ILIKE '%admissoes%') INTO v_conta
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'recalcular_cota_pcd';
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid = 'public.admissoes'::regclass AND NOT t.tgisinternal
      AND (p.proname ILIKE '%cota%' OR p.prosrc ILIKE '%total_colaboradores%'
           OR p.prosrc ILIKE '%recalcular_cota%')
  ) INTO v_trigger;

  IF coalesce(v_conta, false) AND v_trigger THEN
    r.situacao := 'passou';
    r.obtido := 'O recálculo conta os vínculos reais e dispara nas movimentações de admissão.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: o total de empregados ainda depende de digitação — o recálculo '
             || 'de cota %s conta de admissões e %s gatilho nas movimentações. Enquanto '
             || 'empresa_cadastro.total_colaboradores for número digitado, toda régua legal '
             || 'baseada em headcount (cota PcD, CIPA, SESMT, obrigatoriedade de ponto) herda '
             || 'o erro de digitação. Correção: derivar da contagem de vínculos ativos.',
             CASE WHEN coalesce(v_conta,false) THEN 'JÁ' ELSE 'NÃO' END,
             CASE WHEN v_trigger THEN 'tem' ELSE 'NÃO tem' END);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$

;

CREATE OR REPLACE FUNCTION public.qa_caso_ferias_015()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_n int; v_lista text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): procurar trava por idade nas funções e constraints de férias';
  r.esperado := 'Nenhuma — a restrição etária do antigo art. 134, §2º foi revogada pela Lei 13.467/2017';

  SELECT count(*), string_agg(p.proname, ', ')
  INTO v_n, v_lista
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname ILIKE '%ferias%'
    AND p.proname NOT LIKE 'qa\_%'  -- as próprias rotinas de QA citam a trava no texto do diagnóstico
    AND (pg_get_functiondef(p.oid) ILIKE '%idade%'
         OR pg_get_functiondef(p.oid) ILIKE '%data_nascimento%');

  IF v_n = 0 THEN
    r.situacao := 'passou';
    r.obtido := 'Nenhuma função de férias condiciona o gozo à idade — o sistema não carrega a trava revogada (erro comum em legados).';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('POSSÍVEL TRAVA ETÁRIA em %s função(ões) de férias: %s. A obrigação de período único para menor de 18/maior de 50 foi REVOGADA pela Lei 13.467/2017 — conferir e remover se for restrição de gozo.', v_n, v_lista);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$

;

CREATE OR REPLACE FUNCTION public.qa_caso_ferias_081()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_unq text; v_trad text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a transmissão tem anti-duplicidade e tradução de rejeição?';
  r.esperado := 'Reenvio corrigido substitui/retifica (nunca duplica) e a rejeição vira instrução clara';
  IF to_regclass('public.esocial_transmissoes') IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'A tabela de transmissões do eSocial não existe nesta base.';
    RETURN r;
  END IF;
  SELECT string_agg(conname, ', ') INTO v_unq
  FROM pg_constraint WHERE conrelid = 'public.esocial_transmissoes'::regclass AND contype = 'u';
  v_trad := coalesce(public.qa_fns_com('%rejeic%'), public.qa_fns_com('%rejeitad%esocial%'));

  IF v_unq IS NULL AND v_trad IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: esocial_transmissoes não tem unicidade (o mesmo evento pode ser '
             || 'gravado/enviado duas vezes) e nenhuma função interpreta rejeições — o retorno '
             || 'técnico chega cru e o reenvio é por conta do operador. Duplicidade no eSocial '
             || 'é passivo criado pela própria correção. Correção: chave natural do evento '
             || '(vínculo + tipo + período) + rotina que traduz a rejeição e conduz a '
             || 'retificação, nunca um clone.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Proteções presentes (unicidade: %s; tradução: %s).',
                       coalesce(v_unq, '—'), coalesce(v_trad, '—'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$

;

CREATE OR REPLACE FUNCTION public.qa_caso_perfil_004()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  c RECORD;
  v_uid uuid;
  v_tenant uuid;
  v_variante text;
  v_claims_antes text;
  v_amplo boolean;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'FUNCIONAL (somente leitura): simular usuário sem acesso amplo à saúde e avaliar a função de permissão';
  r.esperado    := 'perfil_permite_modulo(tenant, atestados) = false para o usuário simulado';

  -- 1º estágio: ATIVO com vínculo cujo perfil não tem saúde ampla.
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
         AND COALESCE(pp.escopo::text, '') <> 'proprio_usuario'
        WHERE v.usuario_id = ub.id AND COALESCE(v.ativo, true) = true
      )
    LIMIT 200
  LOOP
    IF NOT public.has_minimum_role(c.auth_user_id, 'manager'::public.app_role)
       AND NOT public.is_superadmin(c.auth_user_id) THEN
      v_uid := c.auth_user_id; v_tenant := c.tenant_id;
      v_variante := 'perfil_restrito';
      EXIT;
    END IF;
  END LOOP;

  -- 2º estágio: ATIVO comum sem vínculo de perfil (negado por padrão).
  IF v_uid IS NULL THEN
    FOR c IN
      SELECT ub.auth_user_id, ub.tenant_id
      FROM public.usuarios_base ub
      WHERE ub.auth_user_id IS NOT NULL
        AND COALESCE(ub.status::text, 'ativo') = 'ativo'
        AND COALESCE(ub.tipo_usuario::text, '') NOT IN ('administrador', 'gestor')
        AND NOT EXISTS (
          SELECT 1 FROM public.usuario_perfil_vinculos v
          WHERE v.usuario_id = ub.id AND COALESCE(v.ativo, true) = true
        )
      LIMIT 200
    LOOP
      IF NOT public.has_minimum_role(c.auth_user_id, 'manager'::public.app_role)
         AND NOT public.is_superadmin(c.auth_user_id) THEN
        v_uid := c.auth_user_id; v_tenant := c.tenant_id;
        v_variante := 'sem_perfil';
        EXIT;
      END IF;
    END LOOP;
  END IF;

  -- 3º estágio: colaborador de convite pendente/rascunho, sem vínculo.
  -- É a população real de colaboradores hoje (raio-X de 10/08/2026):
  -- a conta existe e a função de permissão já precisa negá-la — quando
  -- a pessoa ativar, a resposta tem que ser a mesma.
  IF v_uid IS NULL THEN
    FOR c IN
      SELECT ub.auth_user_id, ub.tenant_id
      FROM public.usuarios_base ub
      WHERE ub.auth_user_id IS NOT NULL
        AND COALESCE(ub.status::text, 'ativo') <> 'ativo'
        AND COALESCE(ub.tipo_usuario::text, '') NOT IN ('administrador', 'gestor')
        AND NOT EXISTS (
          SELECT 1 FROM public.usuario_perfil_vinculos v
          WHERE v.usuario_id = ub.id AND COALESCE(v.ativo, true) = true
        )
      LIMIT 200
    LOOP
      IF NOT public.has_minimum_role(c.auth_user_id, 'manager'::public.app_role)
         AND NOT public.is_superadmin(c.auth_user_id) THEN
        v_uid := c.auth_user_id; v_tenant := c.tenant_id;
        v_variante := 'convite_pendente';
        EXIT;
      END IF;
    END LOOP;
  END IF;

  IF v_uid IS NULL THEN
    r.situacao := 'nao_implementado';
    r.obtido   := 'Não há usuário sem acesso de gestão para simular — em nenhum status. A base é '
               || '100% administradores/gestores/papéis de gestão. Nada a negar — nada a testar.';
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
    r.obtido   := CASE v_variante
      WHEN 'perfil_restrito' THEN
        'Usuário com perfil restrito (sem saúde em escopo amplo) negado para acesso amplo a atestados, como devido.'
      WHEN 'sem_perfil' THEN
        'Usuário ativo sem vínculo de perfil negado para acesso amplo a atestados (negado por padrão), como devido.'
      ELSE
        'Colaborador com convite pendente negado para acesso amplo a atestados, como devido. '
        || 'Quando colaboradores ativarem a conta (ou receberem perfil), a rotina passa a testá-los automaticamente.'
    END;
  ELSE
    r.situacao := 'falhou';
    r.obtido   := 'Um usuário que NÃO deveria ter acesso amplo a atestados obteve acesso pela função '
               || 'de permissão (variante: ' || v_variante || '). A camada restritiva está deixando passar.';
  END IF;
  r.detalhe := jsonb_build_object('variante', v_variante, 'auth_user_id', v_uid, 'tenant_id', v_tenant);
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $function$

;

CREATE OR REPLACE FUNCTION public.qa_caso_perfil_005()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$

;

CREATE OR REPLACE FUNCTION public.qa_caso_ponto_250()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_total int; v_sem_rls int; v_sem_politica int; v_lista text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'AUDITORIA (somente leitura): RLS e políticas nas tabelas de ponto e jornada';
  r.esperado    := 'Todas com RLS ativa e ao menos uma política';

  SELECT count(*) INTO v_total
  FROM information_schema.columns col
  JOIN information_schema.tables t
    ON t.table_schema = col.table_schema AND t.table_name = col.table_name
  WHERE col.table_schema = 'public' AND col.column_name = 'tenant_id'
    AND t.table_type = 'BASE TABLE'
    AND (col.table_name LIKE 'ponto\_%' OR col.table_name LIKE 'jornada\_%');

  IF v_total = 0 THEN
    r.situacao := 'nao_implementado';
    r.obtido   := 'Nenhuma tabela de ponto ou jornada encontrada nesta base.';
    RETURN r;
  END IF;

  SELECT count(*) INTO v_sem_rls
  FROM information_schema.columns col
  JOIN pg_class c ON c.relname = col.table_name AND c.relkind = 'r'
  WHERE col.table_schema = 'public' AND col.column_name = 'tenant_id'
    AND (col.table_name LIKE 'ponto\_%' OR col.table_name LIKE 'jornada\_%')
    AND NOT c.relrowsecurity;

  SELECT count(*), string_agg(x.tn, ', ' ORDER BY x.tn) INTO v_sem_politica, v_lista
  FROM (
    SELECT DISTINCT col.table_name AS tn
    FROM information_schema.columns col
    WHERE col.table_schema = 'public' AND col.column_name = 'tenant_id'
      AND (col.table_name LIKE 'ponto\_%' OR col.table_name LIKE 'jornada\_%')
      AND NOT EXISTS (SELECT 1 FROM pg_policies p
                      WHERE p.schemaname = 'public' AND p.tablename = col.table_name)
  ) x;

  IF v_sem_rls = 0 AND v_sem_politica = 0 THEN
    r.situacao := 'passou';
    r.obtido   := format('%s tabela(s) do módulo, todas com RLS ativa e política definida.', v_total);
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('De %s tabela(s) do módulo: %s SEM RLS ativa e %s SEM nenhuma política. '
               || 'Sem política, RLS ligada nega tudo; sem RLS, qualquer sessão autenticada lê '
               || 'ponto de qualquer cliente. Dado de ponto revela rotina, presença e '
               || 'localização — é dado pessoal com risco alto. Tabelas sem política: %s',
               v_total, v_sem_rls, v_sem_politica, COALESCE(v_lista, '(nenhuma)'));
    r.detalhe  := jsonb_build_object('tabelas', v_total, 'sem_rls', v_sem_rls,
                                     'sem_politica', v_sem_politica);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $function$

;

CREATE OR REPLACE FUNCTION public.qa_caso_ponto_252()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_tem_trava boolean; v_auto int; v_aprovados int;
BEGIN
  IF to_regclass('public.ponto_ajustes') IS NULL THEN
    r.situacao := 'nao_implementado';
    r.obtido   := 'Tabela ponto_ajustes não existe nesta base.';
    RETURN r;
  END IF;

  r.passo_ordem := 1;
  r.passo_acao  := 'Conferir se existe trava impedindo aprovado_por = colaborador_id';
  r.esperado    := 'CHECK, trigger ou equivalente';

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.ponto_ajustes'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%aprovado_por%'
  ) OR EXISTS (
    SELECT 1 FROM pg_trigger tg
    WHERE tg.tgrelid = 'public.ponto_ajustes'::regclass AND NOT tg.tgisinternal
      AND pg_get_triggerdef(tg.oid) ILIKE '%aprov%'
  ) INTO v_tem_trava;

  r.passo_ordem := 2;
  r.passo_acao  := 'AUDITORIA (somente leitura): ajustes aprovados pelo próprio solicitante';

  SELECT count(*) INTO v_aprovados FROM public.ponto_ajustes WHERE status = 'aprovado';
  SELECT count(*) INTO v_auto FROM public.ponto_ajustes
   WHERE status = 'aprovado' AND aprovado_por IS NOT NULL
     AND aprovado_por = colaborador_id;

  IF v_auto > 0 THEN
    r.situacao := 'falhou';
    r.obtido   := format('%s de %s ajuste(s) aprovado(s) foram APROVADOS PELO PRÓPRIO '
               || 'COLABORADOR (aprovado_por = colaborador_id). Não é risco teórico: já '
               || 'aconteceu. O fluxo de ajuste é o único caminho legítimo de correção da '
               || 'marcação, e auto-aprovação o anula por completo — quem corrige o próprio '
               || 'ponto e homologa sozinho reintroduz a alterabilidade que a Portaria 671 '
               || 'veda. Correção: CHECK impedindo a igualdade, mais revisão dos registros '
               || 'já existentes.', v_auto, v_aprovados);
    r.detalhe  := jsonb_build_object('auto_aprovados', v_auto, 'total_aprovados', v_aprovados,
                                     'tem_trava', v_tem_trava);
  ELSIF NOT v_tem_trava THEN
    r.situacao := 'falhou';
    r.obtido   := format('Nenhuma auto-aprovação encontrada entre %s ajuste(s) aprovado(s) — '
               || 'mas NÃO EXISTE trava impedindo. A regra depende de a tela lembrar de '
               || 'verificar. Pela API ou por SQL direto, um gestor aprova o próprio ajuste '
               || 'sem obstáculo. Correção: CHECK (aprovado_por IS NULL OR aprovado_por <> '
               || 'colaborador_id).', v_aprovados);
    r.detalhe  := jsonb_build_object('auto_aprovados', 0, 'tem_trava', false);
  ELSE
    r.situacao := 'passou';
    r.obtido   := format('Trava presente e nenhuma auto-aprovação entre %s ajuste(s).', v_aprovados);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $function$

;

CREATE OR REPLACE FUNCTION public.qa_caso_ponto_383()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_unq text; v_nsr text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): reimportar o mesmo AFD duplicaria marcações?';
  r.esperado := 'Trava de duplicidade: NSR único por equipamento ou unicidade do arquivo importado';

  SELECT string_agg(conname, ', ') INTO v_unq
  FROM pg_constraint
  WHERE conrelid = 'public.ponto_repc_importacoes'::regclass AND contype = 'u';
  v_nsr := public.qa_col_existe('ponto_marcacoes', '%nsr%');

  IF v_unq IS NULL AND v_nsr IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: não há trava de reimportação — ponto_repc_importacoes não tem unicidade '
             || 'de arquivo e a marcação não guarda NSR (a chave natural de deduplicação do AFD). '
             || 'Repetir um upload após falha no meio duplica batidas, dobra pares e suja a '
             || 'apuração. Correção: NSR na marcação + unicidade (equipamento, NSR), tornando o '
             || 'reprocessamento idempotente.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Trava de duplicidade presente (unicidade: %s; NSR: %s).',
                       coalesce(v_unq, '—'), coalesce(v_nsr, '—'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$

;

CREATE OR REPLACE FUNCTION public.qa_caso_ponto_396()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_propria boolean;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): as políticas de leitura restringem ao PRÓPRIO colaborador?';
  r.esperado := 'Política de SELECT em ponto_marcacoes/ponto_espelhos filtrando pelo CPF/usuário do leitor';

  SELECT bool_or(qual ILIKE '%cpf%' OR qual ILIKE '%auth.uid%' OR qual ILIKE '%proprio%')
    INTO v_propria
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('ponto_marcacoes', 'ponto_espelhos')
    AND cmd IN ('SELECT', 'ALL');

  IF NOT coalesce(v_propria, false) THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: nenhuma política de leitura de ponto_marcacoes ou ponto_espelhos '
             || 'restringe ao próprio colaborador — os filtros existentes param no tenant e no '
             || 'vínculo de empresa. Traduzindo: um colaborador comum, pela API, lê as marcações '
             || 'e espelhos DOS COLEGAS da empresa inteira (horários, atrasos, geolocalização). '
             || 'Dado de jornada é dado pessoal (LGPD): o titular vê o seu; gestor/DP veem '
             || 'conforme o papel. Correção: política que limite o perfil colaborador ao '
             || 'próprio CPF, mantendo o acesso amplo apenas para papéis de gestão.';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'Leitura restrita ao próprio colaborador (com exceção controlada por papel).';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$

;

-- ============================================================================
-- CONFERÊNCIA — roda as dez auditorias e mostra o veredito de cada uma
--
-- 'passou'            → a proteção está de pé na produção
-- 'falhou'            → a proteção NÃO está; o texto diz o quê e o porquê
-- 'nao_implementado'  → o recurso auditado ainda não existe (não é defeito)
-- 'erro'              → a rotina quebrou; o motivo vem em erro_tecnico
-- ============================================================================
WITH r AS MATERIALIZED (
  SELECT 'ADM-110'    AS caso, public.qa_caso_adm_110()    AS v
  UNION ALL SELECT 'EMP-050',    public.qa_caso_emp_050()
  UNION ALL SELECT 'FERIAS-015', public.qa_caso_ferias_015()
  UNION ALL SELECT 'FERIAS-081', public.qa_caso_ferias_081()
  UNION ALL SELECT 'PERFIL-004', public.qa_caso_perfil_004()
  UNION ALL SELECT 'PERFIL-005', public.qa_caso_perfil_005()
  UNION ALL SELECT 'PONTO-250',  public.qa_caso_ponto_250()
  UNION ALL SELECT 'PONTO-252',  public.qa_caso_ponto_252()
  UNION ALL SELECT 'PONTO-383',  public.qa_caso_ponto_383()
  UNION ALL SELECT 'PONTO-396',  public.qa_caso_ponto_396()
)
SELECT caso,
       (v).situacao::text AS situacao,
       left((v).obtido, 220) AS obtido,
       coalesce((v).erro_tecnico, '') AS erro_tecnico
FROM r
ORDER BY CASE (v).situacao::text
           WHEN 'falhou' THEN 1 WHEN 'erro' THEN 2
           WHEN 'nao_implementado' THEN 3 ELSE 4 END, caso;
