-- ============================================================================
-- ENTREGA — BANCADA DE QA NA PRODUCAO — parte 13 de 15
-- Ponto (2 de 3)
--
-- POR QUE ESTA TRILHA EXISTE
-- A bancada de testes tem tres camadas: a ROTINA (uma funcao), o CASO
-- DOCUMENTADO (linha em qa_casos_teste) e a PONTE que liga uma a outra
-- (qa_implementacoes). Rotina e estrutura; caso e ponte sao dados. As tres
-- nasceram em migrations, que so alcancam o ambiente de teste — nunca a
-- producao. Resultado medido: a producao documenta 568 casos e executa 268,
-- enquanto o projeto documenta 822 e executa 565.
--
-- Esta trilha leva as tres camadas para a producao. A homologacao herda na
-- proxima copia (as tabelas do motor de QA sao copiadas de la na integra).
--
-- GARANTIAS
--   - Idempotente: rodar duas vezes nao duplica nem quebra.
--   - NAO altera nenhuma regra de negocio. So a bancada que as verifica.
--   - Modulo resolvido pelo CAMINHO, nao pelo identificador interno (os
--     identificadores diferem entre ambientes).
--   - A ponte so e criada quando a rotina existe de fato no destino.
--   - Cada rotina entra em bloco proprio: falha de uma vira NOTICE, nao
--     aborta o arquivo.
--   - O cercado (tenant isolado onde os testes rodam) JA existe na producao —
--     esta trilha nao mexe nele, nem em dado de cliente.
-- Roda inteiro em UMA transacao.
-- ============================================================================

SET lock_timeout = '10s';

-- (1) ROTINAS — 58 funcoes de teste.

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_213()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_aceitou boolean := false;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'Configurar registro por link externo SEM instrumento coletivo anexado';
  r.esperado := 'Recusado ou condicionado — REP-A exige norma coletiva; sem ela, o app precisa das formalidades do REP-P';
  BEGIN
    INSERT INTO public.ponto_configuracao (tenant_id, modo_registro)
    VALUES (public.qa_sandbox_tenant_id(), 'link_externo');
    v_aceitou := true;
  EXCEPTION WHEN check_violation OR raise_exception OR unique_violation THEN
    v_aceitou := false;
  END;

  IF v_aceitou THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o modo de registro por link externo foi ativado sem NENHUM documento '
             || 'de autorização — nem instrumento coletivo (REP-A), nem os requisitos formais '
             || 'de REP-P (registro INPI, certificado, comprovante, NSR — ver PONTO-210/380). '
             || 'Operar registro alternativo sem lastro formal invalida o controle perante a '
             || 'Portaria 671. Correção: condicionar o modo à evidência documental, como no '
             || 'registro por exceção (PONTO-372).';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'O modo alternativo sem autorização foi recusado.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_213()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_213 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
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
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_250()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_250 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_251()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_nullable boolean; v_sem_prazo int; v_expirado_ativo int;
  v_total int; v_muito_curto int; v_colisoes int; v_achados text := '';
BEGIN
  IF to_regclass('public.ponto_links') IS NULL THEN
    r.situacao := 'nao_implementado';
    r.obtido   := 'Tabela ponto_links não existe nesta base.';
    RETURN r;
  END IF;

  r.passo_ordem := 1;
  r.passo_acao  := 'Conferir se data_expiracao é obrigatória no schema';
  r.esperado    := 'NOT NULL — link sem prazo não pode existir';

  SELECT NOT a.attnotnull INTO v_nullable
  FROM pg_attribute a
  WHERE a.attrelid = 'public.ponto_links'::regclass AND a.attname = 'data_expiracao';

  r.passo_ordem := 2;
  r.passo_acao  := 'AUDITORIA (somente leitura): links ativos sem prazo ou já vencidos';

  SELECT count(*) INTO v_total FROM public.ponto_links;
  SELECT count(*) INTO v_sem_prazo FROM public.ponto_links
   WHERE ativo IS TRUE AND data_expiracao IS NULL;
  SELECT count(*) INTO v_expirado_ativo FROM public.ponto_links
   WHERE ativo IS TRUE AND data_expiracao IS NOT NULL AND data_expiracao < now();

  r.passo_ordem := 3;
  r.passo_acao  := 'Conferir o que o banco consegue afirmar sobre o token';
  -- Entropia depende de COMO o valor é gerado e não é verificável aqui.
  -- O banco só enxerga duas coisas: colisão (denunciaria gerador fraco) e
  -- comprimento absurdo. O limiar de 12 é conservador: abaixo disso o token
  -- é inseguro sob qualquer alfabeto. A verificação do gerador é revisão de
  -- código, registrada no caso e não simulável em SQL.
  SELECT count(*) INTO v_muito_curto FROM public.ponto_links WHERE length(token) < 12;
  SELECT count(*) INTO v_colisoes FROM (
    SELECT token FROM public.ponto_links GROUP BY token HAVING count(*) > 1
  ) x;

  IF COALESCE(v_nullable, false) THEN
    v_achados := v_achados || 'data_expiracao aceita NULO no schema; ';
  END IF;
  IF v_sem_prazo > 0 THEN
    v_achados := v_achados || format('%s link(s) ATIVO(S) sem prazo nenhum; ', v_sem_prazo);
  END IF;
  IF v_expirado_ativo > 0 THEN
    v_achados := v_achados || format('%s ativo(s) com prazo já vencido; ', v_expirado_ativo);
  END IF;
  IF v_muito_curto > 0 THEN
    v_achados := v_achados || format('%s token(s) com menos de 12 caracteres; ', v_muito_curto);
  END IF;
  IF v_colisoes > 0 THEN
    v_achados := v_achados || format('%s token(s) REPETIDO(S) — indício de gerador fraco; ', v_colisoes);
  END IF;

  IF v_achados = '' THEN
    r.situacao := 'passou';
    r.obtido   := format('%s link(s): prazo obrigatório no schema, nenhum ativo sem prazo ou '
               || 'vencido, nenhuma colisão de token.', v_total);
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('De %s link(s): %s Link de marcação é credencial distribuída por '
               || 'mensagem: sem prazo obrigatório vira acesso permanente ao ponto do '
               || 'colaborador. Correção: data_expiracao NOT NULL com prazo padrão curto, e '
               || 'rotina que desative os vencidos em vez de depender de a consulta lembrar '
               || 'de filtrar por data. NOTA SOBRE ENTROPIA: verificada por revisão de código '
               || 'em 31/07/2026 — crypto.randomUUID() truncado em 16 hexadecimais, cerca de '
               || '60 bits. Adequada. Não é achado.', v_total, v_achados);
    r.detalhe  := jsonb_build_object('schema_aceita_sem_prazo', v_nullable,
                                     'ativos_sem_prazo', v_sem_prazo,
                                     'ativos_vencidos', v_expirado_ativo,
                                     'tokens_muito_curtos', v_muito_curto,
                                     'colisoes', v_colisoes);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_251()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_251 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
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
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_252()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_252 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_253()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_param_geo boolean; v_executor text;
  v_com_geo int; v_geo_antiga int; v_total int; v_mais_antiga date;
BEGIN
  IF to_regclass('public.ponto_marcacoes') IS NULL THEN
    r.situacao := 'nao_implementado';
    r.obtido   := 'Tabela ponto_marcacoes nao existe nesta base.';
    RETURN r;
  END IF;

  r.passo_ordem := 1;
  r.passo_acao  := 'Conferir o parametro de retencao do dado ACESSORIO (geolocalizacao)';
  r.esperado    := 'Coluna de prazo especifica da geolocalizacao no cadastro de retencao';

  v_param_geo := public.qa_coluna_existe('ponto_retencao_config', 'geolocalizacao_dias');

  r.passo_ordem := 2;
  r.passo_acao  := 'Conferir que existe rotina que EXECUTA o expurgo';
  r.esperado    := 'Funcao de expurgo da geolocalizacao presente — parametro sem executor e decoracao';

  SELECT string_agg(p.proname, ', ' ORDER BY p.proname) INTO v_executor
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind = 'f'
    AND p.proname IN ('ponto_expurgar_geolocalizacao', 'ponto_expurgar_registros');

  r.passo_ordem := 3;
  r.passo_acao  := 'AUDITORIA (somente leitura): ha geolocalizacao retida ha mais de um ano';

  SELECT count(*),
         count(*) FILTER (WHERE latitude IS NOT NULL OR longitude IS NOT NULL),
         count(*) FILTER (WHERE (latitude IS NOT NULL OR longitude IS NOT NULL)
                            AND data_marcacao < CURRENT_DATE - 365),
         min(data_marcacao)
    INTO v_total, v_com_geo, v_geo_antiga, v_mais_antiga
  FROM public.ponto_marcacoes;

  IF v_param_geo AND v_executor IS NOT NULL AND v_geo_antiga = 0 THEN
    r.situacao := 'passou';
    r.obtido   := format('Retencao do dado acessorio conferida: ponto_retencao_config.'
               || 'geolocalizacao_dias define o prazo e %s executa o expurgo. Nenhuma '
               || 'geolocalizacao retida ha mais de um ano (%s com geo, de %s; mais antiga em %s).',
               v_executor, v_com_geo, v_total, COALESCE(v_mais_antiga::text, '-'));
  ELSIF NOT v_param_geo THEN
    r.situacao := 'falhou';
    r.obtido   := 'ACHADO: nao existe parametro de retencao especifico da geolocalizacao '
               || '(ponto_retencao_config.geolocalizacao_dias). Dado acessorio sem prazo proprio '
               || 'fica guardado pelo prazo do registro de jornada, que e muito maior.';
  ELSIF v_executor IS NULL THEN
    r.situacao := 'falhou';
    r.obtido   := 'ACHADO: o prazo de retencao da geolocalizacao existe, mas NENHUMA rotina '
               || 'executa o expurgo — configuracao decorativa. O dado acessorio fica guardado '
               || 'para sempre, independentemente do que o cadastro diz.';
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('ACHADO: %s marcacao(oes) com geolocalizacao retida ha mais de um ano '
               || '(mais antiga em %s). O expurgo existe mas nao esta alcancando esses registros.',
               v_geo_antiga, COALESCE(v_mais_antiga::text, '-'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_253()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_253 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_270()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_sem_trava int; v_lista text; v_real uuid;
  v_ins boolean := false; v_upd boolean := false; v_del_coberto boolean;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Listar tabelas de ponto e jornada sem a trava do cercado';
  r.esperado    := 'Nenhuma';

  SELECT count(*), string_agg(x.tn, ', ' ORDER BY x.tn) INTO v_sem_trava, v_lista
  FROM (
    SELECT col.table_name AS tn
    FROM information_schema.columns col
    JOIN information_schema.tables t
      ON t.table_schema = col.table_schema AND t.table_name = col.table_name
    WHERE col.table_schema = 'public' AND col.column_name = 'tenant_id'
      AND t.table_type = 'BASE TABLE'
      AND (col.table_name LIKE 'ponto\_%' OR col.table_name LIKE 'jornada\_%')
      AND NOT EXISTS (
        SELECT 1 FROM pg_trigger tg
        WHERE tg.tgname = 'qa_guarda_cercado'
          AND tg.tgrelid = ('public.' || quote_ident(col.table_name))::regclass
          AND NOT tg.tgisinternal)
  ) x;

  IF v_sem_trava > 0 THEN
    r.situacao := 'falhou';
    r.obtido   := format('%s tabela(s) do módulo SEM a trava do cercado: %s. Uma rotina de '
               || 'teste com erro de tenant escreveria em ponto de cliente real por esse '
               || 'caminho. Correção: rodar SELECT * FROM qa_instalar_cercas().',
               v_sem_trava, v_lista);
    RETURN r;
  END IF;

  r.passo_ordem := 2;
  r.passo_acao  := 'Tentar INSERT em ponto de tenant REAL, com o modo de teste ligado';
  r.esperado    := 'Bloqueado pela cerca';

  -- Fora dos DOIS cercados. O vizinho 'qa-sandbox-2' é permitido pela trava
  -- de propósito (existe para exercitar isolamento entre cercados); tomá-lo
  -- por cliente real fazia o teste acusar defeito onde não havia.
  SELECT t.id INTO v_real
  FROM public.tenants t
  WHERE t.id IS DISTINCT FROM public.qa_sandbox_tenant_id()
    AND COALESCE(t.slug, '') <> 'qa-sandbox-2'
  LIMIT 1;

  IF v_real IS NULL THEN
    r.situacao := 'passou';
    r.obtido   := 'Todas as tabelas do módulo têm a trava. Não há tenant fora dos cercados '
               || 'nesta base para exercitar o bloqueio — o passo fica inaplicável, não '
               || 'aprovado por omissão.';
    RETURN r;
  END IF;

  BEGIN
    INSERT INTO public.ponto_marcacoes
      (tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
       tipo_marcacao, hash_marcacao)
    VALUES (v_real, gen_random_uuid(), '[QA-PONTO-270]', public.qa_cpf(27001),
            'entrada', 'qa-teste-cerca');
    v_ins := true;   -- passou: a cerca falhou
  EXCEPTION WHEN OTHERS THEN v_ins := false;
  END;

  r.passo_ordem := 3;
  r.passo_acao  := 'Criar linha NO CERCADO e tentar movê-la para o tenant real';
  r.esperado    := 'Bloqueado pela cerca';
  -- Testar UPDATE assim, e não sobre linha de cliente, é deliberado: se a
  -- cerca falhar, quem se move e uma linha de teste do proprio cercado, e o
  -- funil a descarta. Mirar linha real provaria o mesmo e arriscaria o dado.
  BEGIN
    INSERT INTO public.ponto_marcacoes
      (tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
       tipo_marcacao, hash_marcacao)
    VALUES (public.qa_sandbox_tenant_id(), gen_random_uuid(), '[QA-PONTO-270] Cobaia',
            public.qa_cpf(27002), 'entrada', 'qa-teste-cerca');

    UPDATE public.ponto_marcacoes SET tenant_id = v_real
    WHERE colaborador_nome = '[QA-PONTO-270] Cobaia';
    v_upd := true;   -- passou: a cerca falhou
  EXCEPTION WHEN OTHERS THEN v_upd := false;
  END;

  r.passo_ordem := 4;
  r.passo_acao  := 'Conferir no catalogo se a trava tambem cobre DELETE';
  r.esperado    := 'A trigger declara INSERT, UPDATE e DELETE';
  SELECT bool_and((tg.tgtype & 8) <> 0) INTO v_del_coberto
  FROM pg_trigger tg
  JOIN pg_class c ON c.oid = tg.tgrelid
  WHERE tg.tgname = 'qa_guarda_cercado' AND NOT tg.tgisinternal
    AND (c.relname LIKE 'ponto\_%' OR c.relname LIKE 'jornada\_%');

  IF v_ins OR v_upd OR NOT COALESCE(v_del_coberto, false) THEN
    r.situacao := 'falhou';
    r.obtido   := format('A cerca nao esta segurando o modulo. INSERT em tenant real passou: '
               || '%s. UPDATE movendo linha do cercado para tenant real passou: %s. DELETE '
               || 'declarado na trigger em todas as tabelas: %s. Enquanto qualquer um destes '
               || 'estiver errado, nenhuma rotina de ponto pode ser escrita com seguranca.',
               v_ins, v_upd, COALESCE(v_del_coberto, false));
    r.detalhe  := jsonb_build_object('insert_passou', v_ins, 'update_passou', v_upd,
                                     'delete_coberto', v_del_coberto,
                                     'tenant_usado_como_real', v_real);
  ELSE
    r.situacao := 'passou';
    r.obtido   := 'Todas as tabelas do modulo tem a trava; INSERT em tenant real e UPDATE '
               || 'movendo linha para fora do cercado foram bloqueados; e a trigger cobre '
               || 'DELETE em todas elas. O cercado esta fechado para escrita de ponto.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_270()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_270 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_271()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_total int; v_consagradas int; v_lista text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'Conferir se as tabelas do módulo entram na varredura do detector';
  r.esperado    := 'Todas têm tenant_id, portanto são varridas automaticamente';

  SELECT count(*) INTO v_total
  FROM information_schema.columns col
  JOIN information_schema.tables t
    ON t.table_schema = col.table_schema AND t.table_name = col.table_name
  WHERE col.table_schema = 'public' AND col.column_name = 'tenant_id'
    AND t.table_type = 'BASE TABLE'
    AND (col.table_name LIKE 'ponto\_%' OR col.table_name LIKE 'jornada\_%');

  r.passo_ordem := 2;
  r.passo_acao  := 'Conferir se alguma tabela do módulo virou mobiliário fixo por engano';
  r.esperado    := 'Nenhuma — o cercado não deve ter ponto permanente';

  IF to_regclass('public.qa_mobiliario_fixo') IS NULL THEN
    r.situacao := 'nao_implementado';
    r.obtido   := 'qa_mobiliario_fixo não existe — o detector genérico não foi instalado.';
    RETURN r;
  END IF;

  SELECT count(*), string_agg(m.tabela || ' (' || m.esperado || ')', ', ' ORDER BY m.tabela)
    INTO v_consagradas, v_lista
  FROM public.qa_mobiliario_fixo m
  WHERE m.tabela LIKE 'ponto\_%' OR m.tabela LIKE 'jornada\_%';

  IF v_consagradas = 0 THEN
    r.situacao := 'passou';
    r.obtido   := format('%s tabela(s) do módulo na varredura do detector, nenhuma com '
               || 'linha permanente no cercado.', v_total);
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('%s tabela(s) do módulo foram gravadas como MOBILIÁRIO FIXO: %s. '
               || 'Isso significa que havia dado de ponto no cercado quando a linha de base '
               || 'foi medida, e esse resíduo passou a ser considerado esperado — o detector '
               || 'nunca mais vai reclamar dele. Correção: limpar o cercado e rodar '
               || 'SELECT * FROM qa_mobiliario_registrar() de novo.',
               v_consagradas, v_lista);
    r.detalhe  := jsonb_build_object('tabelas_do_modulo', v_total,
                                     'consagradas_por_engano', v_consagradas);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_271()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_271 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_290()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_emp uuid; v_cpf text; v_dia date := public.qa_dia_util_passado();
        v_n int; v_res jsonb;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_emp := public.qa_empresa_com_ponto('[QA-PONTO] Unidade Com Ponto', '11222333029001');
  v_cpf := public.qa_ponto_admissao('[QA-PONTO] Faltante Materializado', 29001, v_emp);

  r.passo_ordem := 1;
  r.passo_acao := format('Materializar o dia útil %s numa empresa que adota controle, sem nenhuma marcação do colaborador', v_dia);
  r.esperado := 'Linha criada em ponto_diario — o dia sem batida passa a existir';
  v_res := public.ponto_materializar_faltas(v_dia, v_dia, v_t);

  SELECT count(*) INTO v_n FROM public.ponto_diario
  WHERE tenant_id = v_t AND colaborador_cpf = v_cpf AND data = v_dia;
  IF v_n = 0 THEN
    r.situacao := 'falhou';
    r.obtido := format('O DIA SEM BATIDA CONTINUA SEM EXISTIR: a materialização não criou linha para %s (retorno: %s). '
      'É a reabertura do caso de 13/07 — a falta que não desconta porque nunca é vista.', v_dia, v_res::text);
    RETURN r;
  END IF;

  r.passo_ordem := 2;
  r.passo_acao := 'Materializar um período inteiramente no futuro';
  r.esperado := 'Ignorado — não existe falta em dia que não aconteceu';
  v_res := public.ponto_materializar_faltas(CURRENT_DATE + 1, CURRENT_DATE + 5, v_t);
  SELECT count(*) INTO v_n FROM public.ponto_diario
  WHERE tenant_id = v_t AND colaborador_cpf = v_cpf AND data > CURRENT_DATE;
  IF v_n = 0 THEN
    r.situacao := 'passou';
    r.obtido := 'O dia sem batida foi materializado e o futuro ficou de fora.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('%s linha(s) criadas em datas futuras — falta antecipada não existe.', v_n);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_290()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_290 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_291()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_cpf text; v_dia date := public.qa_dia_util_passado(); v_status text;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_cpf := public.qa_ponto_admissao('[QA-PONTO] Amparado', 29101);

  r.passo_ordem := 1;
  r.passo_acao := format('Registrar atestado cobrindo o dia útil %s e materializar', v_dia);
  r.esperado := 'Linha criada com status de ausência amparada, sem virar falta';
  INSERT INTO public.atestados
    (tenant_id, colaborador_nome, colaborador_cpf, tipo, data_emissao,
     profissional_nome, profissional_registro,
     data_inicio_afastamento, data_fim_afastamento, unidade_afastamento)
  VALUES (v_t, '[QA-PONTO] Amparado', v_cpf, 'assistencial', v_dia,
          '[QA] Dr. Teste', 'CRM-QA-0001', v_dia, v_dia, 'dias');

  PERFORM public.ponto_materializar_faltas(v_dia, v_dia, v_t);

  SELECT status INTO v_status FROM public.ponto_diario
  WHERE tenant_id = v_t AND colaborador_cpf = v_cpf AND data = v_dia
  ORDER BY created_at DESC LIMIT 1;

  IF v_status IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'A materialização não criou linha nem para o dia amparado — o atestado sumiu junto com a falta (ver PONTO-290).';
  ELSIF v_status = 'falta' THEN
    r.situacao := 'falhou';
    r.obtido := 'O DIA COM ATESTADO VIROU FALTA: a materialização é um gerador cego de débito — desconta ausência amparada pela CLT art. 473. O colaborador com atestado válido perderia remuneração e DSR.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Dia amparado materializado com status %s — a falta não engoliu o atestado.', v_status);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_291()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_291 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_292()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_emp uuid; v_cpf text; v_dia date := public.qa_dia_util_passado(); v_n int;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_emp := public.qa_empresa_com_ponto('[QA-PONTO] Unidade Idempotente', '11222333029201');
  v_cpf := public.qa_ponto_admissao('[QA-PONTO] Idempotente', 29201, v_emp);
  PERFORM public.ponto_materializar_faltas(v_dia, v_dia, v_t);

  r.passo_ordem := 1;
  r.passo_acao := 'Rodar a materialização de novo sobre o mesmo dia';
  r.esperado := 'Nenhuma linha nova — rodar N vezes produz o estado de rodar uma';
  PERFORM public.ponto_materializar_faltas(v_dia, v_dia, v_t);
  PERFORM public.ponto_materializar_faltas(v_dia, v_dia, v_t);

  SELECT count(*) INTO v_n FROM public.ponto_diario
  WHERE tenant_id = v_t AND colaborador_cpf = v_cpf AND data = v_dia;
  IF v_n = 1 THEN
    r.situacao := 'passou'; r.obtido := 'Três execuções, uma linha — a rotina diária é segura de repetir.';
  ELSIF v_n = 0 THEN
    r.situacao := 'falhou'; r.obtido := 'A materialização não criou linha nenhuma (ver PONTO-290).';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('%s linhas para o mesmo dia — a rotina duplica quando repetida.', v_n);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_292()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_292 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_293()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_emp uuid; v_emp_fora uuid; v_cpf text; v_cpf_fora text;
        v_comp text := to_char(CURRENT_DATE, 'YYYY-MM'); v_antes int; v_depois int; v_fora int;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_emp := public.qa_empresa_com_ponto('[QA-PONTO] Unidade Diagnosticada', '11222333029301');
  v_cpf := public.qa_ponto_admissao('[QA-PONTO] Diagnosticado', 29301,
                                    v_emp, date_trunc('month', CURRENT_DATE)::date);

  -- Empresa que NÃO adota controle: não pode aparecer no diagnóstico.
  v_emp_fora := public.qa_nova_empresa('[QA-PONTO] Unidade Sem Ponto', '11222333029302');
  v_cpf_fora := public.qa_ponto_admissao('[QA-PONTO] Fora do Regime', 29302,
                                         v_emp_fora, date_trunc('month', CURRENT_DATE)::date);

  r.passo_ordem := 1; r.passo_acao := 'Rodar o diagnóstico com os dias sem linha';
  r.esperado := 'O colaborador da empresa que adota controle aparece na lista';
  SELECT count(*) INTO v_antes
  FROM public.ponto_dias_nao_materializados(v_t, v_comp) d
  WHERE regexp_replace(d.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf;

  IF v_antes = 0 THEN
    IF date_trunc('month', CURRENT_DATE)::date > CURRENT_DATE - 1 THEN
      r.situacao := 'passou';
      r.obtido := 'Competência sem dia útil vivido — nada a materializar, diagnóstico vazio é o correto.';
      RETURN r;
    END IF;
    r.situacao := 'falhou';
    r.obtido := 'O DIAGNÓSTICO NÃO ENXERGA O BURACO: colaborador de empresa que adota controle, com dias úteis sem linha, não aparece em ponto_dias_nao_materializados.';
    RETURN r;
  END IF;

  r.passo_ordem := 2;
  r.passo_acao := 'Conferir que a empresa SEM controle de jornada ficou de fora';
  r.esperado := 'Não aparece — quem não adota controle não gera falta';
  SELECT count(*) INTO v_fora
  FROM public.ponto_dias_nao_materializados(v_t, v_comp) d
  WHERE regexp_replace(d.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf_fora;

  IF v_fora > 0 THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: colaborador de empresa que NÃO adota controle de jornada aparece no '
             || 'diagnóstico. Materializar isso criaria falta para quem nunca esteve no controle '
             || '— na produção de 13/08 eram 11.788 pessoas nessa situação, em 1.387 empresas '
             || 'sem uma única batida.';
    RETURN r;
  END IF;

  r.passo_ordem := 3; r.passo_acao := 'Materializar o mês e rodar o diagnóstico de novo';
  r.esperado := 'O colaborador do regime sai da lista';
  PERFORM public.ponto_materializar_faltas(date_trunc('month', CURRENT_DATE)::date, CURRENT_DATE - 1, v_t);
  SELECT count(*) INTO v_depois
  FROM public.ponto_dias_nao_materializados(v_t, v_comp) d
  WHERE regexp_replace(d.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf;

  IF v_depois = 0 THEN
    r.situacao := 'passou';
    r.obtido := 'Diagnóstico acusou o buraco de quem está no regime, ignorou quem não está, e '
             || 'silenciou depois da materialização.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Após materializar, o colaborador continua na lista com %s dia(s) — ou a '
                    || 'materialização não cobriu, ou o diagnóstico não bate com ela.', v_depois);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_293()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_293 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_300()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_cpf text; v_comp text := to_char(CURRENT_DATE - 7, 'YYYY-MM');
        v_dup int; v_lista text;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_cpf := public.qa_ponto_admissao('[QA-PONTO] Um Dia Por Data', 30001);
  PERFORM public.qa_ponto_dia(v_cpf, '[QA-PONTO] Um Dia Por Data', public.qa_dia_util_passado());

  r.passo_ordem := 1;
  r.passo_acao := 'Apurar a competência e procurar datas repetidas na saída';
  r.esperado := 'Nenhuma data aparece mais de uma vez';
  SELECT count(*), string_agg(x.dia::text, ', ') INTO v_dup, v_lista
  FROM (
    SELECT s.dia FROM public.ponto_saldo_dias_competencia(v_t, v_cpf, v_comp) s
    GROUP BY s.dia HAVING count(*) > 1
  ) x;

  IF v_dup = 0 THEN
    r.situacao := 'passou';
    r.obtido := 'Um dia civil, uma linha de apuração — a garantia do invólucro está de pé.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('DATA DUPLICADA NA APURAÇÃO (%s): o dia debita o colaborador duas vezes — a regressão do caso Adriana (débito de 3h40 inexistente).', v_lista);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_300()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_300 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_301()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_cpf text; v_comp text := to_char(CURRENT_DATE - 7, 'YYYY-MM'); v_dif int;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_cpf := public.qa_ponto_admissao('[QA-PONTO] Intocado', 30101);
  PERFORM public.qa_ponto_dia(v_cpf, '[QA-PONTO] Intocado', public.qa_dia_util_passado());

  r.passo_ordem := 1;
  r.passo_acao := 'Comparar a apuração pública com a bruta num período sem duplicatas';
  r.esperado := 'Idênticas, linha a linha — o invólucro só age quando há duplicata';
  SELECT count(*) INTO v_dif FROM (
    SELECT * FROM public.ponto_saldo_dias_competencia(v_t, v_cpf, v_comp)
    EXCEPT
    SELECT * FROM public.ponto_saldo_dias_competencia_bruto(v_t, v_cpf, v_comp)
  ) x;

  IF v_dif = 0 THEN
    r.situacao := 'passou';
    r.obtido := 'Sem duplicata, a saída pública é idêntica à bruta — a correção foi cirúrgica como prometido.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('%s linha(s) diferentes entre a função pública e a bruta num período SEM duplicatas — o invólucro está alterando dias que deveria deixar em paz.', v_dif);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_301()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_301 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_310()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_emp_a uuid; v_emp_b uuid; v_cpf_a text; v_cpf_b text;
        v_comp text := to_char(CURRENT_DATE - 7, 'YYYY-MM');
        v_a_na_a int; v_b_na_a int; v_a_na_b int; v_b_na_b int;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_emp_a := public.qa_nova_empresa('[QA-PONTO] Empresa A', '11222333031001');
  v_emp_b := public.qa_nova_empresa('[QA-PONTO] Empresa B', '11222333031102');
  v_cpf_a := public.qa_ponto_admissao('[QA-PONTO] Da Empresa A', 31001, v_emp_a);
  v_cpf_b := public.qa_ponto_admissao('[QA-PONTO] Da Empresa B', 31002, v_emp_b);
  PERFORM public.qa_ponto_dia(v_cpf_a, '[QA-PONTO] Da Empresa A', public.qa_dia_util_passado(), v_emp_a);
  PERFORM public.qa_ponto_dia(v_cpf_b, '[QA-PONTO] Da Empresa B', public.qa_dia_util_passado(), v_emp_b);

  r.passo_ordem := 1; r.passo_acao := 'Apurar o espelho-resumo filtrando pela empresa A';
  r.esperado := 'Só o colaborador da A na saída';
  SELECT count(*) FILTER (WHERE regexp_replace(e.colaborador_cpf,'[^0-9]','','g') = v_cpf_a),
         count(*) FILTER (WHERE regexp_replace(e.colaborador_cpf,'[^0-9]','','g') = v_cpf_b)
  INTO v_a_na_a, v_b_na_a
  FROM public.ponto_espelho_resumo_empresa(v_t, v_emp_a, v_comp) e;

  r.passo_ordem := 2; r.passo_acao := 'Apurar pela empresa B';
  r.esperado := 'Só o da B — sem interseção';
  SELECT count(*) FILTER (WHERE regexp_replace(e.colaborador_cpf,'[^0-9]','','g') = v_cpf_a),
         count(*) FILTER (WHERE regexp_replace(e.colaborador_cpf,'[^0-9]','','g') = v_cpf_b)
  INTO v_a_na_b, v_b_na_b
  FROM public.ponto_espelho_resumo_empresa(v_t, v_emp_b, v_comp) e;

  IF v_a_na_a = 1 AND v_b_na_a = 0 AND v_b_na_b = 1 AND v_a_na_b = 0 THEN
    r.situacao := 'passou';
    r.obtido := 'Cada empresa apura o próprio pessoal, e mais ninguém.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('VAZAMENTO ENTRE EMPRESAS DO MESMO TENANT: na apuração da A, colaborador A %sx e B %sx; na da B, A %sx e B %sx. Fechar a empresa A não pode arrastar gente da B — é a regressão do caso "fecha pra todas as empresas".',
      v_a_na_a, v_b_na_a, v_a_na_b, v_b_na_b);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_310()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_310 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_311()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_emp_a uuid; v_emp_b uuid; v_cpf text; v_resolvida uuid;
        v_comp text := to_char(CURRENT_DATE - 7, 'YYYY-MM'); v_na_a int; v_na_b int;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_emp_a := public.qa_nova_empresa('[QA-PONTO] Cadastro A', '11222333031203');
  v_emp_b := public.qa_nova_empresa('[QA-PONTO] Cadastro B', '11222333031304');
  v_cpf := public.qa_ponto_admissao('[QA-PONTO] Sem Empresa Na Linha', 31101, v_emp_a);
  -- Linha de ponto SEM empresa preenchida — o cenário da válvula de escape.
  PERFORM public.qa_ponto_dia(v_cpf, '[QA-PONTO] Sem Empresa Na Linha', public.qa_dia_util_passado(), NULL);

  r.passo_ordem := 1; r.passo_acao := 'Resolver a empresa do CPF pelo cadastro';
  r.esperado := 'A empresa da admissão (A), não qualquer uma';
  v_resolvida := public.ponto_empresa_do_cpf(v_t, v_cpf);
  IF v_resolvida IS DISTINCT FROM v_emp_a THEN
    r.situacao := 'falhou';
    r.obtido := format('ponto_empresa_do_cpf devolveu %s (esperado a empresa A da admissão).', coalesce(v_resolvida::text, 'nulo'));
    RETURN r;
  END IF;

  r.passo_ordem := 2;
  r.passo_acao := 'Apurar pela empresa A e pela empresa B';
  r.esperado := 'O colaborador aparece na A (empresa do cadastro) e nunca na B';
  SELECT count(*) INTO v_na_a
  FROM public.ponto_espelho_resumo_empresa(v_t, v_emp_a, v_comp) e
  WHERE regexp_replace(e.colaborador_cpf,'[^0-9]','','g') = v_cpf;
  SELECT count(*) INTO v_na_b
  FROM public.ponto_espelho_resumo_empresa(v_t, v_emp_b, v_comp) e
  WHERE regexp_replace(e.colaborador_cpf,'[^0-9]','','g') = v_cpf;

  IF v_na_a >= 1 AND v_na_b = 0 THEN
    r.situacao := 'passou';
    r.obtido := 'Linha sem empresa foi resolvida pelo cadastro: entra na A, nunca na B.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Colaborador sem empresa na linha: %sx na apuração da A e %sx na da B. A válvula "OR empresa_id IS NULL" — que punha todo mundo em todas — não pode voltar.', v_na_a, v_na_b);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_311()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_311 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_312()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_n int; v_lista text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): varrer as funções de ponto atrás dos dois padrões removidos em 04/08';
  r.esperado := 'Nenhuma função com "OR empresa_id IS NULL" nem com o carimbo "COALESCE(p_empresa_id, r.empresa_id)"';

  SELECT count(*), string_agg(p.proname, ', ' ORDER BY p.proname)
  INTO v_n, v_lista
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname LIKE 'ponto\_%'
    AND p.prokind = 'f'
    AND (pg_get_functiondef(p.oid) ILIKE '%= p_empresa_id OR%empresa_id IS NULL%'
         OR pg_get_functiondef(p.oid) ILIKE '%COALESCE(p_empresa_id, r.empresa_id)%');

  IF v_n = 0 THEN
    r.situacao := 'passou';
    r.obtido := 'Nenhuma função de ponto contém a válvula de escape nem o carimbo de empresa. A correção de 04/08 (fechamento por empresa) segue de pé.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('A VÁLVULA VOLTOU em %s função(ões): %s. Com ela, colaborador sem empresa entra na apuração de TODAS as empresas e o reapurar reatribui a empresa de quem já tem — o defeito que exigiu migration de reparo em 04/08.', v_n, v_lista);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_312()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_312 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_320()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_emp uuid; v_cpf text; v_dia date := public.qa_dia_util_passado();
        v_comp text; a record;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_comp := to_char(v_dia, 'YYYY-MM');
  v_emp := public.qa_nova_empresa('[QA-RN23] Unidade Feriado', '11222333032001');
  v_cpf := public.qa_ponto_admissao('[QA-RN23] Trabalhou no Feriado', 32001, v_emp);
  PERFORM public.qa_feriado_da_unidade(v_emp, v_dia);
  PERFORM public.qa_ponto_dia(v_cpf, '[QA-RN23] Trabalhou no Feriado', v_dia, v_emp);

  r.passo_ordem := 1;
  r.passo_acao := format('Apurar o adicional de feriado da competência %s (feriado trabalhado em %s, sem folga)', v_comp, v_dia);
  r.esperado := 'Minutos trabalhados no feriado com adicional de 100%';

  SELECT * INTO a FROM public.ponto_feriado_adicional_competencia(v_t, v_emp, v_comp) f
  WHERE regexp_replace(f.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf;

  IF a.colaborador_cpf IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'O FERIADO TRABALHADO NÃO APARECEU NA APURAÇÃO DO ADICIONAL — a Lei 605/1949 art. 9º exige a dobra e o cálculo não enxergou o dia (feriado da unidade + marcação presentes no cercado).';
  ELSIF COALESCE(a.minutos_adicional_100, 0) > 0 AND COALESCE(a.qtd_feriados_trabalhados, 0) >= 1 THEN
    r.situacao := 'passou';
    r.obtido := format('Feriado trabalhado sem compensação rendeu %s minuto(s) com adicional de 100%%, pronto para a folha, sem lançamento manual.', a.minutos_adicional_100);
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('O feriado apareceu mas SEM adicional: qtd=%s, trabalhados=%s, adicional_100=%s. Trabalho em feriado não compensado tem de dobrar (Súmula 146 do TST).',
      a.qtd_feriados_trabalhados, a.minutos_trabalhados, a.minutos_adicional_100);
  END IF;
  RETURN r;
EXCEPTION
  WHEN undefined_function THEN
    r.situacao := 'falhou';
    r.obtido := 'A APURAÇÃO RN23 QUEBRA NESTE BANCO: ' || SQLERRM || '. A função de apoio '
      || 'feriado_comportamento não existe em NENHUMA migration do repositório — foi criada '
      || 'por fora, direto no banco (mesmo precedente de feriados e ponto_diario.tipo_dia). '
      || 'Qualquer ambiente montado a partir das migrations fica com o adicional de feriado '
      || 'inoperante. Correção: trazer a função para o repositório com CREATE OR REPLACE.';
    r.erro_tecnico := SQLERRM;
    RETURN r;
  WHEN OTHERS THEN
    r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_320()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_320 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_321()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_emp uuid; v_cpf text; v_dia date := public.qa_dia_util_passado();
        v_comp text; v_colab uuid := gen_random_uuid(); a record;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_comp := to_char(v_dia, 'YYYY-MM');
  v_emp := public.qa_nova_empresa('[QA-RN23] Unidade Compensada', '11222333032102');
  v_cpf := public.qa_ponto_admissao('[QA-RN23] Compensou a Folga', 32101, v_emp);
  PERFORM public.qa_feriado_da_unidade(v_emp, v_dia);
  PERFORM public.qa_ponto_dia(v_cpf, '[QA-RN23] Compensou a Folga', v_dia, v_emp);

  r.passo_ordem := 1;
  r.passo_acao := 'Registrar a folga compensatória do feriado trabalhado';
  r.esperado := 'Registro aceito, vinculando feriado, colaborador e dia da folga';
  INSERT INTO public.feriado_folga_compensatoria
    (tenant_id, colaborador_id, colaborador_cpf, data_feriado, data_folga)
  VALUES (v_t, v_colab, v_cpf, v_dia, v_dia + 7);

  r.passo_ordem := 2;
  r.passo_acao := 'Apurar o adicional da competência com a folga registrada';
  r.esperado := 'O feriado compensado sai do cálculo do adicional (art. 9º, parte final)';
  SELECT * INTO a FROM public.ponto_feriado_adicional_competencia(v_t, v_emp, v_comp) f
  WHERE regexp_replace(f.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf;

  IF a.colaborador_cpf IS NULL OR COALESCE(a.minutos_adicional_100, 0) = 0 THEN
    r.situacao := 'passou';
    r.obtido := format('Compensou, não dobra: com a folga registrada, o adicional zerou (dias compensados: %s).', COALESCE(a.dias_compensados, 0));
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('A FOLGA REGISTRADA NÃO AFASTOU A DOBRA: adicional_100 = %s minuto(s) mesmo com compensação. Pagaria em dobro E daria a folga — duas vezes a mesma hora.', a.minutos_adicional_100);
  END IF;
  RETURN r;
EXCEPTION
  WHEN undefined_function THEN
    r.situacao := 'falhou';
    r.obtido := 'A APURAÇÃO RN23 QUEBRA NESTE BANCO: ' || SQLERRM || '. A função de apoio '
      || 'feriado_comportamento não existe em NENHUMA migration do repositório — foi criada '
      || 'por fora, direto no banco (mesmo precedente de feriados e ponto_diario.tipo_dia). '
      || 'Qualquer ambiente montado a partir das migrations fica com o adicional de feriado '
      || 'inoperante. Correção: trazer a função para o repositório com CREATE OR REPLACE.';
    r.erro_tecnico := SQLERRM;
    RETURN r;
  WHEN OTHERS THEN
    r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_321()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_321 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_322()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_emp uuid; v_cpf text; v_dia date := public.qa_dia_util_passado();
        v_comp text; v_saldo_antes bigint; v_saldo_depois bigint; v_tmp int;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_comp := to_char(v_dia, 'YYYY-MM');
  v_emp := public.qa_nova_empresa('[QA-RN23] Unidade Saldo', '11222333032203');
  v_cpf := public.qa_ponto_admissao('[QA-RN23] Saldo Intacto', 32201, v_emp);
  PERFORM public.qa_feriado_da_unidade(v_emp, v_dia);
  PERFORM public.qa_ponto_dia(v_cpf, '[QA-RN23] Saldo Intacto', v_dia, v_emp);

  r.passo_ordem := 1;
  r.passo_acao := 'Comparar o saldo do banco antes e depois de apurar o adicional';
  r.esperado := 'Idêntico — o adicional é verba de folha, não crédito de compensação';

  SELECT COALESCE(sum(s.saldo_min), 0) INTO v_saldo_antes
  FROM public.ponto_saldo_dias_competencia(v_t, v_cpf, v_comp) s;

  SELECT COALESCE(sum(f.minutos_adicional_100), 0) INTO v_tmp
  FROM public.ponto_feriado_adicional_competencia(v_t, v_emp, v_comp) f;

  SELECT COALESCE(sum(s.saldo_min), 0) INTO v_saldo_depois
  FROM public.ponto_saldo_dias_competencia(v_t, v_cpf, v_comp) s;

  IF v_saldo_antes = v_saldo_depois THEN
    r.situacao := 'passou';
    r.obtido := format('Saldo do banco intacto (%s min) antes e depois da apuração do adicional — a mesma hora não vira verba e crédito ao mesmo tempo.', v_saldo_antes);
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('A APURAÇÃO DO ADICIONAL MEXEU NO SALDO: %s min antes, %s min depois. O colaborador receberia em dobro E folgaria pelas mesmas horas.', v_saldo_antes, v_saldo_depois);
  END IF;
  RETURN r;
EXCEPTION
  WHEN undefined_function THEN
    r.situacao := 'falhou';
    r.obtido := 'A APURAÇÃO RN23 QUEBRA NESTE BANCO: ' || SQLERRM || '. A função de apoio '
      || 'feriado_comportamento não existe em NENHUMA migration do repositório — foi criada '
      || 'por fora, direto no banco (mesmo precedente de feriados e ponto_diario.tipo_dia). '
      || 'Qualquer ambiente montado a partir das migrations fica com o adicional de feriado '
      || 'inoperante. Correção: trazer a função para o repositório com CREATE OR REPLACE.';
    r.erro_tecnico := SQLERRM;
    RETURN r;
  WHEN OTHERS THEN
    r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_322()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_322 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_330()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_cpf text; v_dia date := public.qa_dia_util_passado();
        v_comp text; e record; v_trab bigint; v_saldo bigint;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_comp := to_char(v_dia, 'YYYY-MM');
  v_cpf := public.qa_ponto_admissao('[QA-PONTO] Espelhado', 33001);
  PERFORM public.qa_ponto_dia(v_cpf, '[QA-PONTO] Espelhado', v_dia);

  r.passo_ordem := 1;
  r.passo_acao := 'Gerar o espelho-resumo e comparar com a soma dia a dia do banco de horas';
  r.esperado := 'Totais de horas e saldo idênticos — as duas telas dizem a mesma coisa';

  SELECT * INTO e FROM public.ponto_espelho_resumo(v_t, v_cpf, v_comp);
  SELECT COALESCE(sum(s.trabalhado_min), 0), COALESCE(sum(s.saldo_min), 0)
  INTO v_trab, v_saldo
  FROM public.ponto_saldo_dias_competencia(v_t, v_cpf, v_comp) s;

  IF e.dias_com_registro IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'O espelho-resumo voltou vazio para uma competência com registro — a regressão do espelho zerado de 07/2026.';
  ELSIF COALESCE(e.total_trabalhado_min, 0) = v_trab AND COALESCE(e.saldo_min, 0) = v_saldo THEN
    r.situacao := 'passou';
    r.obtido := format('Espelho e banco de horas batem: %s min trabalhados, saldo %s min — mesma fonte, mesma história.', v_trab, v_saldo);
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('ESPELHO E BANCO DIVERGEM: espelho diz %s min / saldo %s; a soma dia a dia diz %s min / saldo %s. Duas telas, duas verdades — o defeito que o espelho-resumo veio corrigir.',
      e.total_trabalhado_min, e.saldo_min, v_trab, v_saldo);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_330()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_330 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_331()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_cols text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): conferir que o espelho-resumo não devolve os campos órfãos como zero';
  r.esperado := 'Sem colunas de HE 50/100 nem adicional noturno na saída — ausente é honesto, zero é declaração falsa';

  SELECT pg_get_function_result(p.oid) INTO v_cols
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'ponto_espelho_resumo'
  LIMIT 1;

  IF v_cols IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'A função ponto_espelho_resumo não existe — o espelho voltou a somar as colunas órfãs?';
  ELSIF v_cols ILIKE '%extras%' OR v_cols ILIKE '%noturno%' THEN
    r.situacao := 'falhou';
    r.obtido := 'O ESPELHO VOLTOU A DEVOLVER CAMPOS QUE O MODELO NÃO APURA (' || v_cols || '). '
      || 'A apuração atual não separa HE 50%/100% nem adicional noturno: devolvê-los seria '
      || 'imprimir zero afirmativo num documento que o colaborador assina — declaração falsa. '
      || 'A tela marca esses campos como não apurados; a função não pode reintroduzi-los.';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'O espelho-resumo devolve apenas o que o modelo realmente apura. O que não é apurado fica marcado como tal na tela, nunca como 0h00.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_331()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_331 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_340()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_cpf text; v_origem text;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_cpf := public.qa_cpf(34001);

  r.passo_ordem := 1; r.passo_acao := 'Registrar batida comum, sem informar origem';
  r.esperado := 'origem_marcacao = O (original), pelo DEFAULT';
  INSERT INTO public.ponto_marcacoes
    (tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
     data_marcacao, hora_marcacao, tipo_marcacao, hash_marcacao)
  VALUES (v_t, gen_random_uuid(), '[QA-PONTO] Batida Comum', v_cpf,
          CURRENT_DATE - 1, TIME '08:00', 'entrada', encode(sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'hex'))
  RETURNING origem_marcacao INTO v_origem;

  IF v_origem <> 'O' THEN
    r.situacao := 'falhou';
    r.obtido := format('Batida comum nasceu com origem %s (esperado O).', v_origem);
    RETURN r;
  END IF;

  r.passo_ordem := 2; r.passo_acao := 'Gravar marcação de ajuste com origem A';
  r.esperado := 'origem_marcacao = A aceita e persistida';
  INSERT INTO public.ponto_marcacoes
    (tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
     data_marcacao, hora_marcacao, tipo_marcacao, hash_marcacao,
     marcacao_original, origem_marcacao)
  VALUES (v_t, gen_random_uuid(), '[QA-PONTO] Batida Comum', v_cpf,
          CURRENT_DATE - 1, TIME '08:05', 'entrada', encode(sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'hex'),
          false, 'A')
  RETURNING origem_marcacao INTO v_origem;

  IF v_origem = 'A' THEN
    r.situacao := 'passou';
    r.obtido := 'Batida nasce O; ajuste é rotulado A e não se disfarça de original.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Ajuste gravado com origem %s (esperado A).', v_origem);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_340()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_340 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_341()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_origem text;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1; r.passo_acao := 'Gravar marcação com origem_marcacao = X';
  r.esperado := 'Recusado pelo CHECK (só O/A/P/E/I)';
  BEGIN
    INSERT INTO public.ponto_marcacoes
      (tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
       data_marcacao, hora_marcacao, tipo_marcacao, hash_marcacao, origem_marcacao)
    VALUES (v_t, gen_random_uuid(), '[QA-PONTO] Origem Inventada', public.qa_cpf(34101),
            CURRENT_DATE - 1, TIME '08:00', 'entrada',
            encode(sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'hex'), 'X');
    r.situacao := 'falhou';
    r.obtido := 'ACEITOU origem X — fora da lista O/A/P/E/I, quebraria a geração do AEJ.';
    RETURN r;
  EXCEPTION WHEN check_violation THEN
    r.obtido := 'Recusada a origem X.';
  END;

  r.passo_ordem := 2; r.passo_acao := 'Gravar marcação com origem nula';
  r.esperado := 'Recusado (NOT NULL) ou normalizado para um valor válido da lista';
  BEGIN
    INSERT INTO public.ponto_marcacoes
      (tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
       data_marcacao, hora_marcacao, tipo_marcacao, hash_marcacao, origem_marcacao)
    VALUES (v_t, gen_random_uuid(), '[QA-PONTO] Origem Nula', public.qa_cpf(34102),
            CURRENT_DATE - 1, TIME '08:00', 'entrada',
            encode(sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'hex'), NULL)
    RETURNING origem_marcacao INTO v_origem;

    IF v_origem IN ('O','A','P','E','I') THEN
      r.situacao := 'passou';
      r.obtido := format('Origem nula normalizada para %s antes de gravar — a marcação nunca fica sem origem, proteção equivalente à recusa.', v_origem);
    ELSE
      r.situacao := 'falhou';
      r.obtido := format('Marcação gravada com origem %s — o AEJ exige a origem de toda marcação tratada.', coalesce(v_origem, 'NULA'));
    END IF;
  EXCEPTION WHEN not_null_violation THEN
    r.situacao := 'passou'; r.obtido := 'Origem nula recusada pelo NOT NULL.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_341()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_341 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_350()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_cpf text;
  v_data date := CURRENT_DATE - 1;   -- ancora em dia passado: ver nota da migration
  v_bloqueou_dupla boolean := false;
  v_bloqueou_saida_repique boolean := false;
  v_aceitou_depois boolean := false;
BEGIN
  v_cpf := public.qa_ponto_admissao('QA Toque Duplo', 3501);

  r.passo_ordem := 1;
  r.passo_acao := 'Registrar entrada às 08:00:00 e tentar NOVA entrada às 08:00:30 (mesmo minuto)';
  r.esperado := 'A segunda batida é recusada como repique do mesmo toque';

  PERFORM public.qa_ponto_marca(v_cpf, 'QA Toque Duplo', v_data, TIME '08:00:00', 'entrada');
  BEGIN
    PERFORM public.qa_ponto_marca(v_cpf, 'QA Toque Duplo', v_data, TIME '08:00:30', 'entrada');
  EXCEPTION WHEN OTHERS THEN
    v_bloqueou_dupla := true;
  END;

  r.passo_ordem := 2;
  r.passo_acao := 'Tentar SAÍDA às 08:01:00 (ainda dentro da janela do repique)';
  r.esperado := 'Também recusada — o dedo que escorrega não fecha a jornada em 1 minuto';
  BEGIN
    PERFORM public.qa_ponto_marca(v_cpf, 'QA Toque Duplo', v_data, TIME '08:01:00', 'saida');
  EXCEPTION WHEN OTHERS THEN
    v_bloqueou_saida_repique := true;
  END;

  r.passo_ordem := 3;
  r.passo_acao := 'Registrar saída legítima às 12:00';
  r.esperado := 'Aceita normalmente — a proteção não pode travar a jornada real';
  BEGIN
    PERFORM public.qa_ponto_marca(v_cpf, 'QA Toque Duplo', v_data, TIME '12:00:00', 'saida');
    v_aceitou_depois := true;
  EXCEPTION WHEN OTHERS THEN
    v_aceitou_depois := false;
  END;

  IF v_bloqueou_dupla AND v_bloqueou_saida_repique AND v_aceitou_depois THEN
    r.situacao := 'passou';
    r.obtido := 'O repique no mesmo minuto foi recusado (entrada E saída), e a batida legítima '
             || 'posterior entrou normalmente. A janela anti-toque-duplo está ativa no banco.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Proteção incompleta: repique de entrada %s, repique de saída %s, batida '
             || 'legítima depois %s. Duas batidas no mesmo minuto viram duas marcações no AFD e '
             || 'sujam a apuração. Correção: janela anti-toque-duplo no gatilho de marcação.',
             CASE WHEN v_bloqueou_dupla THEN 'BLOQUEADO' ELSE 'ACEITO' END,
             CASE WHEN v_bloqueou_saida_repique THEN 'BLOQUEADO' ELSE 'ACEITO' END,
             CASE WHEN v_aceitou_depois THEN 'aceita' ELSE 'RECUSADA (trava demais)' END);
    r.detalhe := jsonb_build_object('bloqueou_entrada_dupla', v_bloqueou_dupla,
                                    'bloqueou_saida_repique', v_bloqueou_saida_repique,
                                    'aceitou_batida_legitima', v_aceitou_depois);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_350()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_350 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_351()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_cpf text;
  v_data date := CURRENT_DATE - 1;
  v_retro_entrou boolean := false;
  v_msg_recusa text;
  v_seq text;
  v_horas text;
BEGIN
  v_cpf := public.qa_ponto_admissao('QA Retroativa', 3511);

  r.passo_ordem := 1;
  r.passo_acao := 'Lançar por ajuste a marcação das 12:00 (rotulada entrada) num dia de ontem';
  r.esperado := 'Aceita — é a única do dia, nada a reordenar';
  PERFORM public.qa_ponto_marca(v_cpf, 'QA Retroativa', v_data, TIME '12:00', 'entrada', false);

  r.passo_ordem := 2;
  r.passo_acao := 'Lançar RETROATIVAMENTE a marcação das 08:00 — pelo relógio, ela vira a entrada '
               || 'e a das 12:00 vira saída';
  r.esperado := 'A retroativa entra e os rótulos são reordenados pelo relógio, sem tocar nos horários';
  BEGIN
    PERFORM public.qa_ponto_marca(v_cpf, 'QA Retroativa', v_data, TIME '08:00', 'saida', false);
    v_retro_entrou := true;
  EXCEPTION WHEN OTHERS THEN
    v_msg_recusa := SQLERRM;
  END;

  SELECT string_agg(tipo_marcacao, '>' ORDER BY hora_marcacao),
         string_agg(hora_marcacao::text, '>' ORDER BY hora_marcacao)
    INTO v_seq, v_horas
  FROM public.ponto_marcacoes
  WHERE tenant_id = public.qa_sandbox_tenant_id()
    AND colaborador_cpf = v_cpf AND data_marcacao = v_data;

  IF v_retro_entrou AND v_seq = 'entrada>saida' AND v_horas = '08:00:00>12:00:00' THEN
    r.situacao := 'passou';
    r.obtido := 'A retroativa entrou e o dia foi reencaixado pelo relógio: entrada 08:00, saída '
             || '12:00, nenhum horário alterado.';
  ELSIF NOT v_retro_entrou THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: a inclusão retroativa foi RECUSADA por inteiro. O gatilho de '
             || 'inserção chama a reordenação automática de rótulos '
             || '(ponto_reordena_tipos_dia), mas a reordenação esbarra na trava de imutabilidade '
             || 'da própria marcação (ponto_bloquear_update_marcacao) porque ninguém liga o '
             || 'contexto de retificação (app.ponto_retificacao) antes de reordenar. Resultado: '
             || 'toda retroativa que exija reordenar rótulos falha com "%s" — o RH não consegue '
             || 'completar o dia por ajuste. Correção: o reordenador automático deve executar '
             || 'dentro do contexto de retificação (é alteração de RÓTULO, não de horário — a '
             || 'Portaria 671 protege o horário registrado).', coalesce(v_msg_recusa, '?'));
    r.detalhe := jsonb_build_object('recusa', v_msg_recusa, 'sequencia', v_seq,
                                    'horarios', v_horas);
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('A retroativa entrou mas o dia ficou incoerente: sequência %s | horários %s '
             || '(esperado entrada>saida em 08:00>12:00). Rótulo errado contamina a apuração do '
             || 'dia inteiro.', coalesce(v_seq, 'vazio'), coalesce(v_horas, 'vazio'));
    r.detalhe := jsonb_build_object('sequencia', v_seq, 'horarios', v_horas);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_351()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_351 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_352()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_cpf text := public.qa_cpf(3521);
  v_base date := date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::date;
  v_dia date;
  v_tol_lida int;
  v_saldo int;
BEGIN
  -- primeira segunda-feira do mês passado
  v_dia := v_base + ((8 - EXTRACT(ISODOW FROM v_base)::int) % 7);

  r.passo_ordem := 1;
  r.passo_acao := 'Cadastrar escala com tolerância diária ZERO e ler de volta';
  r.esperado := 'O zero é aceito e devolvido como zero — não vira "usar padrão de 10"';

  PERFORM public.qa_ponto_escala_tol(v_cpf, 'QA Tolerância Zero', 480, 0, v_dia, v_dia);
  SELECT e.tolerancia_min INTO v_tol_lida
  FROM public.ponto_escala_do_dia(public.qa_sandbox_tenant_id(), v_cpf, NULL::uuid, v_dia) e;

  IF coalesce(v_tol_lida, -1) <> 0 THEN
    r.situacao := 'falhou';
    r.obtido := format('A escala foi gravada com tolerância 0, mas a leitura devolveu %s. '
             || 'Zero está sendo tratado como "não configurado". Correção: distinguir 0 de NULL.',
             coalesce(v_tol_lida::text, 'NULL'));
    RETURN r;
  END IF;

  r.passo_ordem := 2;
  r.passo_acao := format('Dia com 471 min trabalhados (9 min a menos que a jornada de 480), tolerância 0, em %s', v_dia);
  r.esperado := 'Com tolerância zero, o saldo do dia é -9 min — cada minuto conta';

  PERFORM public.qa_ponto_dia_min(v_cpf, 'QA Tolerância Zero', v_dia, 471);
  SELECT s.saldo_min INTO v_saldo
  FROM public.ponto_saldo_dias_competencia(public.qa_sandbox_tenant_id(), v_cpf,
                                           to_char(v_dia, 'YYYY-MM')) s
  WHERE s.dia = v_dia;

  IF v_saldo = -9 THEN
    r.situacao := 'passou';
    r.obtido := 'Tolerância zero aceita e aplicada: os 9 minutos faltantes viraram débito de -9.';
  ELSIF v_saldo = 0 THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a tolerância configurada como ZERO foi IGNORADA — o dia com 9 minutos '
             || 'faltantes fechou com saldo 0. Causa: a apuração de saldo tem um perdão fixo de '
             || '10 minutos gravado no código (ponto_saldo_dias_competencia e a função _bruto '
             || 'aplicam "abs(saldo) <= 10 → 0" incondicionalmente), por cima do que a escala '
             || 'diz. Empresa que adota tolerância menor que a legal não consegue: o piso '
             || 'efetivo do sistema é 10 min. Correção: usar a tolerância da escala '
             || '(tolerancia_diaria_minutos) no lugar do 10 fixo, mantendo 10 apenas como teto '
             || 'padrão quando nada foi configurado.';
    r.detalhe := jsonb_build_object('saldo_obtido', v_saldo, 'saldo_esperado', -9,
                                    'tolerancia_configurada', 0);
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Saldo inesperado: %s min (esperado -9 com tolerância zero). '
             || 'A apuração não está seguindo nem a configuração nem o padrão de 10.',
             coalesce(v_saldo::text, 'sem linha'));
    r.detalhe := jsonb_build_object('saldo_obtido', v_saldo);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_352()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_352 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_353()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_cpf text := public.qa_cpf(3531);
  v_base date := date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::date;
  v_d1 date; v_d2 date;
  v_s1 int; v_s2 int;
BEGIN
  v_d1 := v_base + ((8 - EXTRACT(ISODOW FROM v_base)::int) % 7);  -- segunda-feira
  v_d2 := v_d1 + 1;                                               -- terça-feira

  PERFORM public.qa_ponto_escala_tol(v_cpf, 'QA Fronteira Teto', 480, 10, v_d1, v_d2);
  PERFORM public.qa_ponto_dia_min(v_cpf, 'QA Fronteira Teto', v_d1, 490);  -- +10 min
  PERFORM public.qa_ponto_dia_min(v_cpf, 'QA Fronteira Teto', v_d2, 491);  -- +11 min

  r.passo_ordem := 1;
  r.passo_acao := format('Apurar dois dias com jornada de 480: %s com 490 min e %s com 491 min', v_d1, v_d2);
  r.esperado := 'Exatos +10 min: saldo 0 (dentro do teto). +11 min: saldo +11 INTEIRO, não só o excedente';

  SELECT max(s.saldo_min) FILTER (WHERE s.dia = v_d1),
         max(s.saldo_min) FILTER (WHERE s.dia = v_d2)
    INTO v_s1, v_s2
  FROM public.ponto_saldo_dias_competencia(public.qa_sandbox_tenant_id(), v_cpf,
                                           to_char(v_d1, 'YYYY-MM')) s;

  IF v_s1 = 0 AND v_s2 = 11 THEN
    r.situacao := 'passou';
    r.obtido := 'Fronteira exata correta: +10 min fechou em 0 (dentro do teto do art. 58, §1º) '
             || 'e +11 min computou os 11 inteiros — estourou o teto, conta tudo, não só o excedente.';
  ELSIF v_s1 = 0 AND v_s2 = 1 THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: no dia com +11 min o sistema computou apenas 1 min (o excedente). '
             || 'O art. 58, §1º manda: ultrapassado o teto de 10 min, computa-se TODA a variação '
             || '(os 11 minutos), não só o que passou do teto. Correção: quando |saldo| > teto, '
             || 'manter o saldo integral.';
    r.detalhe := jsonb_build_object('saldo_d1', v_s1, 'saldo_d2', v_s2);
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Fronteira errada: +10 min rendeu saldo %s (esperado 0) e +11 min rendeu %s '
             || '(esperado 11). O teto diário do art. 58, §1º não está sendo aplicado no ponto exato.',
             coalesce(v_s1::text, 'sem linha'), coalesce(v_s2::text, 'sem linha'));
    r.detalhe := jsonb_build_object('saldo_d1', v_s1, 'saldo_d2', v_s2);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_353()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_353 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_354()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_cpf text := public.qa_cpf(3541);
  v_apuracao_preenche boolean;
  v_convertido boolean;
  v_mov int;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a apuração do banco preenche o prazo de compensação?';
  r.esperado := 'apurar_banco_horas* deriva prazo_compensacao da configuração do regime (6m/12m)';

  SELECT bool_or(p.prosrc ILIKE '%prazo_compensacao%') INTO v_apuracao_preenche
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('apurar_banco_horas', 'apurar_banco_horas_colaborador');

  r.passo_ordem := 2;
  r.passo_acao := 'Semear saldo de 120 min com prazo vencido ontem e rodar a conversão automática';
  r.esperado := 'O saldo vencido vira hora extra: convertido_extras = true + movimentação de conversão';

  INSERT INTO public.ponto_banco_horas
    (tenant_id, colaborador_id, colaborador_nome, colaborador_cpf, tipo,
     competencia, saldo_anterior_minutos, creditos_minutos, debitos_minutos,
     compensados_minutos, saldo_atual_minutos, convertido_extras, prazo_compensacao)
  VALUES (public.qa_sandbox_tenant_id(), v_cpf, 'QA Vencimento Banco', v_cpf, 'mensal',
          to_char(CURRENT_DATE - INTERVAL '1 month', 'YYYY-MM'), 0, 120, 0, 0, 120,
          false, CURRENT_DATE - 1);

  PERFORM public.converter_banco_horas_vencido();

  SELECT b.convertido_extras,
         (SELECT count(*) FROM public.ponto_banco_horas_movimentacoes m
           WHERE m.banco_horas_id = b.id AND m.tipo = 'conversao_he')
    INTO v_convertido, v_mov
  FROM public.ponto_banco_horas b
  WHERE b.tenant_id = public.qa_sandbox_tenant_id() AND b.colaborador_cpf = v_cpf;

  IF NOT coalesce(v_convertido, false) OR coalesce(v_mov, 0) = 0 THEN
    r.situacao := 'falhou';
    r.obtido := format('A conversão de saldo vencido não funcionou nem com o prazo semeado à mão '
             || '(convertido=%s, movimentações=%s). O saldo que passa do prazo legal precisa virar '
             || 'hora extra a pagar.', coalesce(v_convertido::text, 'NULL'), coalesce(v_mov, 0));
  ELSIF NOT coalesce(v_apuracao_preenche, false) THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o mecanismo de conversão existe e funciona QUANDO o prazo está na linha '
             || '(o teste semeou o prazo à mão e o saldo foi convertido) — mas a APURAÇÃO nunca '
             || 'preenche prazo_compensacao. A configuração do regime até guarda '
             || 'prazo_compensacao_dias (ponto_banco_horas_config), só que nenhuma função de '
             || 'apuração a consulta. Resultado prático: nenhum saldo tem vencimento, a conversão '
             || 'automática nunca encontra o que converter, e saldos de banco individual passam '
             || 'dos 6 meses do art. 59, §5º (ou dos 12 meses do §2º) sem virar hora extra. '
             || 'Correção: ao apurar a competência, gravar prazo_compensacao = fim da competência '
             || '+ prazo_compensacao_dias do regime vigente.';
    r.detalhe := jsonb_build_object('conversao_funciona', true,
                                    'apuracao_preenche_prazo', false);
  ELSE
    r.situacao := 'passou';
    r.obtido := 'A apuração deriva o prazo do regime e a conversão de saldo vencido funciona.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_354()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_354 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_355()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): existe rotina que alerte vencimento próximo do banco?';
  r.esperado := 'Alguma função gera alerta (ponto_alertas) sobre prazo/vencimento do banco de horas';

  SELECT string_agg(p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname NOT LIKE 'qa\_%'  -- as rotinas de QA citam os termos no diagnóstico
    AND p.prosrc ILIKE '%ponto_alertas%'
    AND (p.prosrc ILIKE '%venc%' OR p.prosrc ILIKE '%prazo%');

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: nenhuma função do banco gera alerta de vencimento de saldo. O gerador de '
             || 'alertas de ponto (gerar_alertas_ponto) só conhece falta e atraso. Sem aviso '
             || 'antecipado, o RH só descobre o saldo vencido quando ele já virou passivo de hora '
             || 'extra (art. 59, §5º) — e o PONTO-354 mostra que nem essa conversão dispara hoje. '
             || 'Correção: rotina periódica que, X dias antes de prazo_compensacao, crie alerta em '
             || 'ponto_alertas com a ação sugerida (programar compensação ou pagar).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Alerta de vencimento presente em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_355()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_355 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_356()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_col_existe boolean;
  v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o limite de acúmulo configurado é aplicado em algum lugar?';
  r.esperado := 'A apuração compara o saldo com limite_acumulo_horas e trata/alerta o excedente';

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ponto_banco_horas_config'
      AND column_name = 'limite_acumulo_horas'
  ) INTO v_col_existe;

  IF NOT v_col_existe THEN
    r.situacao := 'nao_implementado';
    r.obtido := 'A configuração nem tem campo de limite de acúmulo nesta base.';
    RETURN r;
  END IF;

  SELECT string_agg(p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%limite_acumulo%';

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o campo limite_acumulo_horas existe na configuração do banco '
             || '(ponto_banco_horas_config), mas NENHUMA função o consulta. É configuração '
             || 'decorativa: o gestor define um teto de acúmulo, o colaborador passa dele, e nada '
             || 'acontece — nem alerta, nem retenção, nem conversão do excedente. Correção: na '
             || 'apuração da competência, comparar saldo_atual_minutos com o limite do regime e '
             || 'gerar alerta/tratamento do excedente.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Limite de acúmulo aplicado em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_356()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_356 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_357()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_cpf text; v_ajuste_id uuid;
  v_status_pend text; v_status_final text;
  v_antes text; v_depois text;
  v_motivo_visivel boolean := false;
  v_col_fantasma text;
BEGIN
  v_cpf := public.qa_ponto_admissao('QA Rejeicao Ajuste', 3571);
  PERFORM public.qa_ponto_marca(v_cpf, 'QA Rejeicao Ajuste', CURRENT_DATE - 3, TIME '08:00', 'entrada');
  PERFORM public.qa_ponto_marca(v_cpf, 'QA Rejeicao Ajuste', CURRENT_DATE - 3, TIME '17:00', 'saida');

  SELECT string_agg(hora_marcacao::text, '|' ORDER BY hora_marcacao) INTO v_antes
  FROM public.ponto_marcacoes
  WHERE tenant_id = public.qa_sandbox_tenant_id()
    AND colaborador_cpf = v_cpf AND data_marcacao = CURRENT_DATE - 3;

  INSERT INTO public.ponto_ajustes
    (tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
     data_referencia, tipo_ajuste, motivo, status, hora_original, hora_solicitada)
  VALUES (public.qa_sandbox_tenant_id(), gen_random_uuid(), 'QA Rejeicao Ajuste', v_cpf,
          CURRENT_DATE - 3, 'correcao', 'QA: rejeicao deve deixar o dia intacto', 'pendente',
          TIME '08:00', TIME '07:30')
  RETURNING id INTO v_ajuste_id;

  r.passo_ordem := 1;
  r.passo_acao := 'Rejeitar o ajuste e conferir que o dia nao mudou';
  r.esperado := 'Status rejeitado, motivo visivel, marcacoes originais intactas';

  v_status_pend := 'ajuste_pendente';
  UPDATE public.ponto_ajustes
     SET status = 'rejeitado', observacao_aprovador = 'QA: rejeitado para teste'
   WHERE id = v_ajuste_id;

  SELECT status::text INTO v_status_final FROM public.ponto_ajustes WHERE id = v_ajuste_id;

  SELECT string_agg(hora_marcacao::text, '|' ORDER BY hora_marcacao) INTO v_depois
  FROM public.ponto_marcacoes
  WHERE tenant_id = public.qa_sandbox_tenant_id()
    AND colaborador_cpf = v_cpf AND data_marcacao = CURRENT_DATE - 3;

  SELECT (observacao_aprovador IS NOT NULL AND btrim(observacao_aprovador) <> '')
    INTO v_motivo_visivel
  FROM public.ponto_ajustes WHERE id = v_ajuste_id;

  r.passo_ordem := 2;
  r.passo_acao := 'AUDITORIA (somente leitura): o fluxo de APROVACAO grava em colunas reais?';
  r.esperado := 'Toda coluna citada nos INSERT em ponto_marcacoes existe na tabela';

  -- Extrai a lista de colunas de cada INSERT INTO public.ponto_marcacoes (...)
  -- e confere nome a nome. Nao usa busca por palavra solta: o parametro
  -- p_ajuste_id ja produziu falso positivo por esse caminho.
  WITH src AS (
    SELECT p.prosrc AS s
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'processar_ajuste_ponto'
    LIMIT 1
  ),
  listas AS (
    SELECT (regexp_matches(s, 'INSERT\s+INTO\s+public\.ponto_marcacoes\s*\(([^)]*)\)', 'gi'))[1] AS cols
    FROM src
  ),
  colunas AS (
    -- btrim padrao so tira espaco: a lista do INSERT vem com quebra de
    -- linha e tabulacao, entao a limpeza precisa cobrir todo espaco em branco.
    SELECT DISTINCT regexp_replace(unnest(string_to_array(cols, ',')), '\s', '', 'g') AS col
    FROM listas
  )
  SELECT string_agg(col, ', ' ORDER BY col) INTO v_col_fantasma
  FROM colunas
  WHERE col <> ''
    AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns ic
      WHERE ic.table_schema = 'public'
        AND ic.table_name = 'ponto_marcacoes'
        AND ic.column_name = colunas.col
    );

  IF v_status_final = 'rejeitado' AND v_antes IS NOT DISTINCT FROM v_depois
     AND v_motivo_visivel AND v_col_fantasma IS NULL THEN
    r.situacao := 'passou';
    r.obtido := 'Rejeicao integra: o ajuste ficou rejeitado, o motivo ficou registrado e as '
             || 'marcacoes originais nao mudaram um segundo. A aprovacao grava em colunas que '
             || 'existem — conferido pela lista de colunas do INSERT, nao por busca de texto.';
  ELSIF v_col_fantasma IS NOT NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: processar_ajuste_ponto grava em coluna(s) inexistente(s) em '
             || 'ponto_marcacoes: %s. Aprovar um ajuste por essa funcao quebra em execucao.',
             v_col_fantasma);
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('A rejeicao nao ficou integra (status %s; marcacoes antes %s, depois %s; '
             || 'motivo visivel: %s).', COALESCE(v_status_final,'?'), COALESCE(v_antes,'-'),
             COALESCE(v_depois,'-'), v_motivo_visivel);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_357()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_357 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_358()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): existe reabertura FORMAL de competência fechada?';
  r.esperado := 'Reabertura com motivo, alçada e trilha; novo fechamento gera NOVA versão do espelho';
  v_fns := coalesce(public.qa_fns_com('%reabr%'), public.qa_fns_com('%reabert%'));
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: não existe reabertura formal. O que existe é a válvula do gatilho '
             || '(papéis de gestão marcam em competência fechada sem rito — PONTO-193). Erro '
             || 'legítimo descoberto depois precisa de saída FORMAL: reabrir com motivo e '
             || 'alçada registrados, recalcular, e o espelho ganhar NOVA VERSÃO — o documento '
             || 'que o colaborador cientificou não pode ser regravado por cima. Correção: '
             || 'fluxo de reabertura com estado próprio no fechamento e versionamento do '
             || 'espelho.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Reabertura formal presente em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_358()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_358 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_359()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o trabalhador consegue extrair os comprovantes de um período?';
  r.esperado := 'Extração dos comprovantes (janela mínima de 48h) pelo próprio colaborador';
  v_est := coalesce(public.qa_fns_com('%comprovante%'), NULL);
  IF v_est IS NULL OR to_regclass('public.ponto_comprovantes') IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: depende do comprovante existir como documento (PONTO-380) — hoje é um '
             || 'boolean na marcação, então não há o que extrair. Quando o comprovante '
             || 'nascer, a extração por período (janela mínima de 48h, direito do trabalhador '
             || 'no REP-P) é uma função de listagem restrita ao próprio CPF.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Extração presente: %s.', v_est);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_359()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_359 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_360()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o certificado de assinatura digital é gerenciado?';
  r.esperado := 'Cadastro do certificado (ICP-Brasil) com vigência e alerta de vencimento';
  v_est := coalesce(public.qa_col_existe(NULL, '%certificado_digital%'),
                    public.qa_col_existe(NULL, '%icp%'),
                    public.qa_fns_com('%icp-brasil%'), public.qa_fns_com('%p7s%'));
  IF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: não existe gestão de certificado digital — nem cadastro, nem vigência, '
             || 'nem alerta. Consequência dupla: (1) AFD/AEJ não têm COM QUE ser assinados '
             || '(a auditoria de conformidade já apontou a ausência de assinatura ICP-Brasil); '
             || '(2) quando a assinatura existir, um certificado vencido paralisa a emissão '
             || 'dos artefatos exatamente na hora da fiscalização. Correção: cadastro do '
             || 'certificado por empresa com vencimento vigiado (alerta com antecedência '
             || 'parametrizada).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Gestão de certificado presente: %s.', v_est);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_360()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_360 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_361()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a exportação para a folha é gerada por função auditável?';
  r.esperado := 'Eventos com grandeza real (horas, valores) e natureza correta (vencimento/desconto/indenização)';
  v_fns := public.qa_fns_com('%exportacoes_folha%');
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a exportação para a folha não tem função no banco — a tabela '
             || 'ponto_exportacoes_folha guarda um jsonb montado pela tela, sem regra '
             || 'verificável de composição. Não há como garantir grandezas reais (o DSR nem é '
             || 'apurado — PONTO-132; o excesso de HE é cortado — PONTO-092) nem naturezas '
             || 'corretas (vencimento × desconto × indenizatória). É onde o ponto vira '
             || 'dinheiro: zero afirmativo aqui é dívida silenciosa. Correção: função de '
             || 'composição do pacote a partir da apuração fechada, com memória.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Composição auditável presente em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_361()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_361 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_362()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): tentativas seguidas de CPFs diferentes no mesmo link são contidas?';
  r.esperado := 'Bloqueio temporário e registro do padrão de enumeração';
  v_est := coalesce(public.qa_col_existe('ponto_links', '%tentativa%'),
                    public.qa_col_existe('ponto_links', '%bloque%'));
  IF v_est IS NULL THEN
    SELECT string_agg(p.proname, ', ') INTO v_est
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
      AND p.proname ILIKE '%ponto%' AND p.prosrc ILIKE '%tentativ%'
      AND (p.prosrc ILIKE '%link%' OR p.prosrc ILIKE '%token%');
  END IF;
  IF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: as funções do link compartilhado (registrar_ponto_externo_cpf e '
             || 'afins) não guardam tentativas nem aplicam bloqueio — CPFs em sequência no '
             || 'mesmo link (padrão clássico de enumeração para descobrir CPFs válidos da '
             || 'empresa e marcar por terceiros) passam sem registro nem contenção. Correção: '
             || 'contador de tentativas frustradas por link/IP com bloqueio temporário e '
             || 'evento na trilha.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Contenção presente: %s.', v_est);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_362()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_362 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_370()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): existe estrutura de obrigatoriedade por estabelecimento?';
  r.esperado := 'Coluna/função que registre a contagem de trabalhadores e sinalize o controle obrigatório (art. 74, §2º)';

  v_est := coalesce(public.qa_col_existe(NULL, '%obrigator%ponto%'), '')
        || coalesce(public.qa_col_existe(NULL, '%controle%obrigat%'), '')
        || coalesce(public.qa_fns_com('%74%§2%'), '')
        || coalesce(public.qa_fns_com('%obrigatoriedade%jornada%'), '');

  IF v_est = '' THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o sistema não tem nenhuma noção de obrigatoriedade do controle por '
             || 'estabelecimento — não conta os 20 trabalhadores do art. 74, §2º, não sinaliza '
             || 'quem é obrigado e trata todo cliente igual. Consequência: cliente obrigado sem '
             || 'controle ativo não recebe aviso algum, e a Súmula 338 joga a jornada alegada '
             || 'pelo empregado contra ele. Correção: contagem por estabelecimento + sinalização '
             || 'de obrigatoriedade no cadastro, com alerta quando cruzar o limite.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Estrutura de obrigatoriedade encontrada: %s.', v_est);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_370()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_370 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_371()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_flag text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a configuração distingue empresa que optou por NÃO controlar?';
  r.esperado := 'Flag de controle ativo/facultativo por empresa ou estabelecimento';

  SELECT string_agg(column_name, ', ') INTO v_flag
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'ponto_configuracao'
    AND (column_name ILIKE '%ativo%' OR column_name ILIKE '%facultativ%'
         OR column_name ILIKE '%habilitad%');

  IF v_flag IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: ponto_configuracao não tem flag de controle ativo/facultativo. Empresa '
             || 'com menos de 20 trabalhadores que NÃO adota controle é tratada igual às demais: '
             || 'a materialização gera falta em todo dia útil sem marcação (PONTO-290) e o painel '
             || 'enche de pendências indevidas. Correção: flag por empresa/estabelecimento que '
             || 'desligue a exigência de marcação (e, ligada, aplique o padrão legal completo).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Flag de controle presente: %s.', v_flag);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_371()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_371 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_372()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_aceitou boolean := false;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'Ativar modo_apuracao = por_excecao SEM anexar o acordo (ponto_excecao_acordo_url vazio)';
  r.esperado := 'Recusado — o art. 74, §4º exige acordo individual escrito ou instrumento coletivo';

  BEGIN
    INSERT INTO public.ponto_configuracao (tenant_id, modo_apuracao, ponto_excecao_acordo_url)
    VALUES (public.qa_sandbox_tenant_id(), 'por_excecao', NULL);
    v_aceitou := true;
  EXCEPTION WHEN check_violation OR not_null_violation OR raise_exception THEN
    v_aceitou := false;
  END;

  IF v_aceitou THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o banco ACEITOU o modo "registro por exceção" sem documento autorizador '
             || '— a coluna ponto_excecao_acordo_url existe (bom sinal), mas nada obriga a '
             || 'preenchê-la. Registro por exceção sem acordo escrito é controle inválido perante '
             || 'o art. 74, §4º. Correção: CHECK/trigger exigindo o acordo anexado (URL não vazia) '
             || 'sempre que modo_apuracao = por_excecao.';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'O modo por exceção sem documento foi recusado — a exigência do §4º está no banco.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_372()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_372 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_373()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): existe enquadramento do art. 62 no cadastro?';
  r.esperado := 'Campo que marque o vínculo como dispensado de controle (externo/gestão/tele por produção)';

  v_est := coalesce(public.qa_col_existe(NULL, '%dispensado_ponto%'), '')
        || coalesce(public.qa_col_existe(NULL, '%controle_jornada%'), '')
        || coalesce(public.qa_col_existe(NULL, '%art62%'), '')
        || coalesce(public.qa_col_existe(NULL, '%cargo_confianca%'), '');

  IF v_est = '' THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: não existe campo de enquadramento do art. 62. Gestor, externo e '
             || 'teletrabalhista por produção são tratados como controlados: a materialização '
             || 'gera falta para quem a lei dispensa de marcar. Correção: flag de dispensa de '
             || 'controle no vínculo (com o inciso e o documento de enquadramento), respeitada '
             || 'pela materialização de faltas e pelos alertas.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Enquadramento presente: %s.', v_est);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_373()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_373 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_374()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o cadastro distingue teletrabalho por JORNADA de por PRODUÇÃO?';
  r.esperado := 'Campo de modalidade de teletrabalho (Lei 14.442/2022) — só produção/tarefa dispensa controle';

  v_est := coalesce(public.qa_col_existe(NULL, '%teletrabalho%'), '')
        || coalesce(public.qa_col_existe(NULL, '%remoto%'), '')
        || coalesce(public.qa_col_existe(NULL, '%home_office%'), '');

  IF v_est = '' THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: nenhuma tabela registra a modalidade de teletrabalho. Sem distinguir '
             || 'jornada de produção/tarefa (Lei 14.442/2022), o sistema não sabe quem DEVE '
             || 'continuar marcando remoto — risco nos dois sentidos: cobrar de quem é dispensado '
             || 'ou dispensar quem é controlado. Correção: modalidade no contrato/vínculo, '
             || 'amarrada à exigência de marcação.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Modalidade de teletrabalho presente: %s.', v_est);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_374()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_374 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_375()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): algo detecta controle de fato sobre dispensado do art. 62?';
  r.esperado := 'Alerta de descaracterização quando um dispensado acumula marcações reais';

  v_fns := public.qa_fns_com('%descaracteriza%');

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: nenhuma rotina detecta descaracterização do art. 62 (dispensado com '
             || 'marcações de fato). Na Justiça, o controle de fato derruba a exclusão e traz '
             || 'as horas extras do período inteiro. Depende do enquadramento do PONTO-373 '
             || 'existir primeiro; com ele, a detecção é um cruzamento simples: dispensado + '
             || 'marcações recorrentes → alerta a RH/Jurídico.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Detecção presente em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_375()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_375 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_376()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_cpf text;
  v_amanha boolean := false;
  v_hora_futura boolean := false;
BEGIN
  v_cpf := public.qa_ponto_admissao('QA Marcação Futura', 3760);

  r.passo_ordem := 1;
  r.passo_acao := 'Inserir marcação com DATA de amanhã';
  r.esperado := 'Recusada — ninguém registra o ponto de amanhã';
  BEGIN
    PERFORM public.qa_ponto_marca(v_cpf, 'QA Marcação Futura', CURRENT_DATE + 1, TIME '08:00', 'entrada');
    v_amanha := true;   -- aceitou (achado)
  EXCEPTION WHEN OTHERS THEN
    v_amanha := false;  -- recusou (correto)
  END;

  r.passo_ordem := 2;
  r.passo_acao := 'Inserir marcação de HOJE com hora futura (23:59)';
  r.esperado := 'Recusada ou registrada com a hora do servidor — nunca a hora informada no futuro';
  IF localtime < TIME '23:00' THEN
    BEGIN
      PERFORM public.qa_ponto_marca(v_cpf, 'QA Marcação Futura', CURRENT_DATE, TIME '23:59', 'entrada');
      v_hora_futura := true;
    EXCEPTION WHEN OTHERS THEN
      v_hora_futura := false;
    END;
  END IF;

  IF NOT v_amanha AND NOT v_hora_futura THEN
    r.situacao := 'passou';
    r.obtido := 'Data futura e hora futura foram recusadas — o carimbo de tempo não aceita futuro.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: o banco ACEITOU marcação futura (data de amanhã: %s; hora futura '
             || 'hoje: %s). Data e hora vêm do cliente sem validação temporal — por API ou SQL, '
             || 'grava-se o ponto de amanhã, corrompendo a fidelidade que a Portaria 671 exige. '
             || 'Correção: recusar data/hora posteriores ao relógio do servidor no gatilho de '
             || 'inserção (com folga mínima para latência).',
             CASE WHEN v_amanha THEN 'ACEITA' ELSE 'recusada' END,
             CASE WHEN v_hora_futura THEN 'ACEITA' ELSE 'recusada/não testada' END);
    r.detalhe := jsonb_build_object('data_futura_aceita', v_amanha,
                                    'hora_futura_aceita', v_hora_futura);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_376()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_376 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_377()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): algo detecta uniformidade de marcações?';
  r.esperado := 'Rotina que sinalize espelho "britânico" (horários idênticos por período prolongado)';

  v_fns := coalesce(public.qa_fns_com('%britanic%'), public.qa_fns_com('%uniformidade%'));

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: nada detecta marcações uniformes. Um mês de batidas cravadas no mesmo '
             || 'minuto passa sem aviso — e a Súmula 338, III, do TST considera esses registros '
             || 'INVÁLIDOS como prova, invertendo a presunção a favor do empregado. O gerador de '
             || 'alertas (gerar_alertas_ponto) só conhece falta e atraso. Correção: verificação '
             || 'periódica de variância das marcações por colaborador, com alerta quando a '
             || 'uniformidade passar do limiar.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Detecção de uniformidade presente em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_377()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_377 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_378()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_col text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a marcação registra se nasceu on-line ou off-line?';
  r.esperado := 'Coluna de status on/off-line em ponto_marcacoes (a Portaria 671 exige a identificação no AFD)';

  SELECT string_agg(column_name, ', ') INTO v_col
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'ponto_marcacoes'
    AND (column_name ILIKE '%offline%' OR column_name ILIKE '%online%'
         OR column_name ILIKE '%sincroniz%');

  IF v_col IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: ponto_marcacoes não guarda o status on/off-line nem o momento da '
             || 'sincronização. Se a marcação offline for implementada, não haverá como '
             || 'distinguir a hora da batida da hora do envio — e o AFD do REP-P precisa '
             || 'identificar o status. Correção: colunas de status de origem (on/off-line) e '
             || 'de timestamp de sincronização, preservando a hora da batida como a oficial.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Status de origem presente: %s.', v_col);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_378()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_378 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_379()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): existe monitoração da Hora Legal Brasileira?';
  r.esperado := 'Rotina que confira o relógio contra a HBL e alerte desvio acima da tolerância';

  v_fns := coalesce(public.qa_fns_com('%hora legal%'), public.qa_fns_com('%hora_legal%'),
                    public.qa_fns_com('%observatorio%'), public.qa_fns_com('%ntp%'));

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: nenhuma rotina monitora o relógio contra a Hora Legal Brasileira. O '
             || 'carimbo das marcações depende do relógio do servidor sem verificação — a '
             || 'Portaria 671 exige o REP-P sincronizado com a HBL (Observatório Nacional). '
             || 'Correção: verificação periódica do desvio com tolerância parametrizada, alerta '
             || 'imediato e registro do evento na trilha.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Monitoração presente em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_379()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_379 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_380()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_tab boolean; v_nsr text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o comprovante existe como documento com conteudo minimo?';
  r.esperado := 'Comprovante com empregador, trabalhador, data/hora e NSR, vinculado a marcacao';

  v_tab := to_regclass('public.ponto_comprovantes') IS NOT NULL;
  v_nsr := public.qa_col_existe('ponto_marcacoes', '%nsr%');

  IF v_tab AND v_nsr IS NOT NULL THEN
    r.situacao := 'passou';
    r.obtido := format('Comprovante existe como documento (ponto_comprovantes) e a marcacao '
             || 'carrega o NSR que o identifica (%s).', v_nsr);
  ELSIF NOT v_tab AND v_nsr IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o comprovante hoje e so um boolean (ponto_marcacoes.comprovante_gerado) '
             || '— nao existe o documento em si, e a marcacao tambem nao tem NSR. O comprovante '
             || 'e o recibo legal do trabalhador na Portaria 671.';
  ELSIF NOT v_tab THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO PARCIAL: o NSR ja existe na marcacao, mas o comprovante continua sendo '
             || 'apenas um boolean — nao existe a tabela do documento com identificacao do '
             || 'empregador, do trabalhador, data/hora e NSR. Metade do requisito nao e o '
             || 'requisito: sem o artefato, nao ha o que entregar ao trabalhador.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := 'ACHADO PARCIAL: a tabela de comprovantes existe, mas a marcacao nao carrega NSR '
             || '— o comprovante nao consegue identificar a qual registro se refere.';
  END IF;
  r.detalhe := jsonb_build_object('tabela_comprovantes', v_tab, 'coluna_nsr', v_nsr);
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_380()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_380 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_381()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): existe vigilância do prazo de 48h do comprovante?';
  r.esperado := 'Alerta preventivo antes das 48h e crítico ao estourar (REP-P, Portaria 671)';

  v_fns := public.qa_fns_com('%comprovante%48%');

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: nada vigia o prazo de 48 horas do comprovante do REP-P. Como o '
             || 'comprovante em si ainda não existe como documento (PONTO-380), o prazo legal '
             || 'de disponibilização não tem nem o que ser medido. Correção: após o comprovante '
             || 'existir, rotina periódica que alerte antes das 48h e escale ao estourar, com '
             || 'ação no Plano de Ação.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Vigilância do prazo presente em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_381()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_381 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_382()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text; v_cols text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a importação de AFD valida integridade no banco?';
  r.esperado := 'Validação de CRC-16, SHA-256 encadeado e assinatura, com quarentena do arquivo inválido';

  v_fns := coalesce(public.qa_fns_com('%crc%'), public.qa_fns_com('%quarentena%'));
  SELECT string_agg(column_name, ', ') INTO v_cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'ponto_repc_importacoes'
    AND column_name IN ('status', 'erros', 'registros_rejeitados');

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: a tabela de importações (ponto_repc_importacoes) tem os campos '
             || 'certos (%s), mas NENHUMA função do banco valida integridade de AFD — nada de '
             || 'CRC-16 (tipos 1-5), cadeia SHA-256 (tipo 7), assinatura .p7s ou quarentena. Se '
             || 'a validação existir só na tela, importação por API entra sem conferência, e '
             || 'arquivo corrompido contamina a base probatória. Correção: validação no banco '
             || '(ou edge function) com quarentena do arquivo reprovado e relatório de '
             || 'inconsistências.', coalesce(v_cols, 'nenhum'));
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Validação de integridade presente em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_382()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_382 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_383()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_unq text; v_nsr_origem text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): reimportar o mesmo AFD duplicaria marcacoes?';
  r.esperado := 'Unicidade do arquivo importado E chave natural do registro de origem (equipamento + NSR do AFD)';

  SELECT string_agg(conname, ', ') INTO v_unq
  FROM pg_constraint
  WHERE conrelid = 'public.ponto_repc_importacoes'::regclass AND contype = 'u';

  -- O NSR proprio (ponto_marcacoes.nsr) e gerado pelo YourEyes na gravacao:
  -- nao serve para deduplicar arquivo de terceiro. A chave natural do AFD
  -- importado e o NSR DE ORIGEM somado ao equipamento que o emitiu.
  v_nsr_origem := coalesce(public.qa_col_existe('ponto_marcacoes', '%nsr_origem%'),
                           public.qa_col_existe('ponto_marcacoes', '%nsr_afd%'),
                           public.qa_col_existe('ponto_marcacoes', '%equipamento%'));

  IF v_unq IS NOT NULL AND v_nsr_origem IS NOT NULL THEN
    r.situacao := 'passou';
    r.obtido := format('Reprocessamento idempotente: unicidade do arquivo (%s) e chave natural do '
             || 'registro de origem (%s).', v_unq, v_nsr_origem);
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: nao ha trava de reimportacao. Unicidade do arquivo em '
             || 'ponto_repc_importacoes: %s. Chave do registro de origem na marcacao: %s. '
             || 'Atencao: o NSR proprio da marcacao, criado nesta onda, e gerado pelo YourEyes na '
             || 'gravacao e NAO serve para deduplicar AFD de terceiro — para isso e preciso '
             || 'guardar o NSR que veio no arquivo e o equipamento que o emitiu. Repetir um upload '
             || 'apos falha no meio duplica batidas e suja a apuracao.',
             coalesce(v_unq, 'nenhuma'), coalesce(v_nsr_origem, 'nenhuma'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_383()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_383 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_384()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): ajustes de relógio (tipo 4) e eventos sensíveis (tipo 6) do AFD têm onde morar?';
  r.esperado := 'Estrutura para os registros não-marcação do AFD, visíveis na trilha';

  v_est := coalesce(public.qa_col_existe(NULL, '%ajuste_relogio%'), '')
        || coalesce(public.qa_col_existe(NULL, '%evento_sensivel%'), '')
        || coalesce(public.qa_fns_com('%tipo 4%relogio%'), '');

  IF v_est = '' THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: não existe estrutura para os registros tipo 4 (ajuste do relógio do '
             || 'equipamento) e tipo 6 (eventos sensíveis) do AFD — numa importação, esses '
             || 'registros seriam descartados. Um relógio ajustado perto de uma marcação suspeita '
             || 'é exatamente o que a fiscalização procura na trilha. Correção: importar e expor '
             || 'esses registros na trilha de auditoria do equipamento.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Estrutura presente: %s.', v_est);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_384()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_384 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_385()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_cpf text := public.qa_cpf(3850);
  v_base date := date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::date;
  v_d1 date;
  v_r1 text; v_r2 text;
  v_comp text;
  v_fonte int; v_res jsonb; v_id uuid;
BEGIN
  v_d1 := v_base + ((8 - EXTRACT(ISODOW FROM v_base)::int) % 7);
  v_comp := to_char(v_d1, 'YYYY-MM');

  r.passo_ordem := 1;
  r.passo_acao := 'Apurar a mesma competencia duas vezes (determinismo)';
  r.esperado := 'Resultados identicos — mesma fonte + mesmos parametros = mesma conta';

  PERFORM public.qa_ponto_escala_tol(v_cpf, 'QA Memoria', 480, 10, v_d1, v_d1);
  PERFORM public.qa_ponto_marca(v_cpf, 'QA Memoria', v_d1, TIME '08:00', 'entrada');
  PERFORM public.qa_ponto_marca(v_cpf, 'QA Memoria', v_d1, TIME '17:00', 'saida');
  PERFORM public.consolidar_ponto_diario_manual(v_t, v_cpf, v_d1);

  SELECT string_agg(dia::text || ':' || coalesce(saldo_min::text,'n'), '|' ORDER BY dia) INTO v_r1
  FROM public.ponto_saldo_dias_competencia(v_t, v_cpf, v_comp);
  SELECT string_agg(dia::text || ':' || coalesce(saldo_min::text,'n'), '|' ORDER BY dia) INTO v_r2
  FROM public.ponto_saldo_dias_competencia(v_t, v_cpf, v_comp);

  r.passo_ordem := 2;
  r.passo_acao := 'Gravar a memoria de calculo e conferir fonte + resultado';
  r.esperado := 'Uma linha com as marcacoes-fonte e o resultado apurado, refazivel';

  IF to_regclass('public.ponto_memoria_calculo') IS NULL
     OR public.qa_fns_com('%registrar_memoria_calculo%') IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: nao existe memoria de calculo — nenhuma tabela/funcao registra, por '
             || 'competencia, a fonte usada e o resultado. Sem memoria, o auditor nao refaz o '
             || 'calculo e a empresa nao explica o espelho ao colaborador.';
    RETURN r;
  END IF;

  v_id := public.ponto_registrar_memoria_calculo(v_t, v_cpf, v_comp);
  SELECT fonte_marcacoes, resultado INTO v_fonte, v_res
  FROM public.ponto_memoria_calculo
  WHERE tenant_id = v_t AND colaborador_cpf = v_cpf AND competencia = v_comp;

  IF v_r1 IS DISTINCT FROM v_r2 THEN
    r.situacao := 'falhou';
    r.obtido := 'A MESMA apuracao, duas vezes, deu resultados diferentes — a conta nao e '
             || 'deterministica, o que inviabiliza auditoria.';
    r.detalhe := jsonb_build_object('rodada1', v_r1, 'rodada2', v_r2);
  ELSIF v_id IS NULL OR v_fonte IS NULL OR v_fonte = 0 OR v_res IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: a memoria de calculo existe mas nao guardou a fonte/resultado '
             || '(marcacoes-fonte: %s, resultado: %s). Uma memoria sem fonte nao refaz a conta.',
             COALESCE(v_fonte::text,'nulo'), COALESCE(v_res::text,'nulo'));
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Apuracao deterministica e memoria gravada: %s marcacao(oes)-fonte e '
             || 'resultado %s. O auditor refaz a conta a partir da fonte.', v_fonte, v_res::text);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_385()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_385 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_386()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_src text; v_usa_vigencia boolean; v_alerta text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): quem consome ponto_cct_config filtra pela vigência?';
  r.esperado := 'A apuração escolhe o instrumento vigente NA DATA apurada (vigencia_inicio/fim)';

  SELECT prosrc INTO v_src
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'calcular_he_adicional_noturno_dia';

  IF v_src IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'A tabela ponto_cct_config existe (com vigencia_inicio/fim), mas nenhuma função '
             || 'de apuração a consome — os parâmetros da CCT são decorativos no banco.';
    RETURN r;
  END IF;

  v_usa_vigencia := v_src ILIKE '%vigencia%';
  v_alerta := public.qa_fns_com('%cct%venc%');

  IF NOT v_usa_vigencia THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: calcular_he_adicional_noturno_dia consome ponto_cct_config SEM filtrar '
             || 'pela vigência (vigencia_inicio/vigencia_fim existem na tabela e não aparecem na '
             || 'função). Reapurar uma competência antiga aplica a convenção atual — percentuais '
             || 'errados retroativos. Correção: escolher o instrumento cuja vigência cobre a DATA '
             || 'apurada; alertar sobreposição e vencimento (60/30 dias), que hoje também não '
             || 'existe.';
  ELSIF v_alerta IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'A apuração filtra pela vigência (correto), mas não existe alerta de instrumento '
             || 'coletivo a vencer (60/30 dias) nem de vigências sobrepostas. Correção: rotina '
             || 'periódica de vigilância das vigências de ponto_cct_config.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Vigência respeitada na apuração e vigilância presente em: %s.', v_alerta);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_386()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_386 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_387()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_confere boolean;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o fechamento confere a situação dos espelhos?';
  r.esperado := 'Fechar competência exige espelhos confirmados/assinados (ou recusa formalizada)';

  SELECT bool_or(p.prosrc ILIKE '%espelho%' AND (p.prosrc ILIKE '%confirmad%'
              OR p.prosrc ILIKE '%assinatur%' OR p.prosrc ILIKE '%status%'))
    INTO v_confere
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname ILIKE '%fechar%' AND p.proname NOT LIKE 'qa\_%';

  IF NOT coalesce(v_confere, false) THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: nenhuma função de fechamento confere os espelhos. A tabela '
             || 'ponto_espelhos tem status, data_confirmacao e assinatura_hash — mas o '
             || 'fechamento (ponto_fechar_competencia_banco) só transita saldos, sem checar se o '
             || 'colaborador viu e assinou. Espelho sem ciência enfraquece a prova (Súmula 338). '
             || 'Correção: fechamento bloqueado (ou com justificativa formal) enquanto houver '
             || 'espelho pendente de confirmação.';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'O fechamento confere a situação dos espelhos antes de concluir.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_387()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_387 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_388()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_confere boolean;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o fechamento trava com pendência crítica aberta?';
  r.esperado := 'Ajustes pendentes, lacunas sem justificativa e falhas de integridade impedem fechar';

  SELECT bool_or(p.prosrc ILIKE '%pendente%')
    INTO v_confere
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname ILIKE '%fechar%' AND p.proname NOT LIKE 'qa\_%';

  IF NOT coalesce(v_confere, false) THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o fechamento não verifica pendências. Com ajuste pendente de aprovação '
             || 'ou lacuna sem justificativa, a competência fecha por cima e manda o dado errado '
             || 'para a folha — e o PONTO-193 mostra que depois de fechada não se mexe. Correção: '
             || 'lista de pendências críticas bloqueantes no fechamento (ajustes pendentes, dias '
             || 'incompletos sem tratamento, falha de integridade).';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'O fechamento verifica pendências antes de concluir.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_388()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_388 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_389()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_link text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): alerta de ponto consegue virar ação no Plano de Ação?';
  r.esperado := 'Vínculo estrutural entre ponto_alertas e o módulo Plano de Ação (5W2H com origem)';

  v_link := coalesce(public.qa_col_existe('ponto_alertas', '%plano%'), '')
         || coalesce(public.qa_col_existe(NULL, '%alerta_ponto%'), '');
  IF v_link = '' THEN
    SELECT coalesce(string_agg(p.proname, ', '), '') INTO v_link
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
      AND p.prosrc ILIKE '%ponto_alertas%' AND p.prosrc ILIKE '%plano%acao%';
  END IF;

  IF v_link = '' THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: não há ponte entre os alertas do ponto e o Plano de Ação — nem coluna '
             || 'de vínculo, nem função que crie a ação. O documento de requisitos faz dessa '
             || 'integração o coração preventivo do módulo (ação 5W2H nascendo do alerta, com '
             || 'origem navegável). Correção: função que converta alerta em ação preenchida, '
             || 'guardando o vínculo com o alerta/marcação/competência de origem.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Ponte presente: %s.', v_link);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_389()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_389 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_390()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): concluir uma ação valida a eficácia sobre a ocorrência?';
  r.esperado := 'Baixa da ação confere se o alerta de origem pode encerrar e registra a evidência';

  v_fns := public.qa_fns_com('%eficacia%');

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: não existe validação de eficácia — depende da ponte alerta→ação do '
             || 'PONTO-389, que também não existe. Sem ela, concluir a ação dá baixa cega: o '
             || 'intervalo continua suprimido na semana seguinte e ninguém percebe, porque o '
             || 'alerta morreu junto com a ação. Correção: na conclusão, reavaliar a ocorrência '
             || 'de origem; persistindo, reabrir ou gerar novo alerta com o histórico.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Validação de eficácia presente em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_390()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_390 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_391()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_auto text; v_ia boolean; v_decisao boolean;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): alguma rotina decide sozinha sobre direito do trabalhador?';
  r.esperado := 'Nenhuma decisao automatizada (descontar, negar, punir) sem registro de revisao humana';

  -- Procura descontos/negativas automaticas sem ator humano registrado.
  SELECT string_agg(p.proname, ', ') INTO v_auto
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%ponto%'
    AND (p.prosrc ILIKE '%decisao_automatica%' OR p.prosrc ILIKE '%rejeicao_automatica%'
         OR p.prosrc ILIKE '%desconto_automatico%');

  -- Controle implantado: a IA SUGERE (ponto_ia_analisar_alerta) e o HUMANO decide
  -- (ponto_ia_registrar_decisao), com a sugestao registrada em ponto_ia_analises.
  v_ia := to_regprocedure('public.ponto_ia_analisar_alerta(uuid,uuid)') IS NOT NULL
          AND to_regclass('public.ponto_ia_analises') IS NOT NULL;
  v_decisao := to_regprocedure('public.ponto_ia_registrar_decisao(uuid,text,uuid,text,text)') IS NOT NULL;

  IF v_auto IS NOT NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: rotina(s) com decisao automatica sobre o ponto: %s. A LGPD '
             || '(art. 20) exige revisao humana para qualquer decisao que afete direito.', v_auto);
  ELSIF v_ia AND v_decisao THEN
    r.situacao := 'passou';
    r.obtido := 'Controle implantado: a IA de analise SUGERE (ponto_ia_analisar_alerta, status '
             || 'sugerido) e so avanca por DECISAO HUMANA registrada (ponto_ia_registrar_decisao, '
             || 'exige responsavel humano). Nenhuma decisao automatica afeta direito (LGPD art. 20).';
  ELSE
    r.situacao := 'falhou';
    r.obtido := 'RESSALVA: nenhuma rotina decide sozinha (bom para a LGPD art. 20), mas o controle '
             || 'da IA de analise (sugestao + decisao humana) ainda nao esta implantado.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_391()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_391 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;


-- (2) CASOS DOCUMENTADOS — 60 casos.

-- Ponto (2 de 3) (60 casos)

INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
SELECT m.id, d.codigo::text, d.titulo::text, d.tipo::text::qa_caso_tipo, d.prioridade::text::qa_prioridade, d.status::text::qa_caso_status, d.objetivo::text, d.pre_condicoes::text, d.passos::text::jsonb, d.resultado_esperado::text, d.observacoes::text, d.nivel::text, d.base_legal::text, d.disposicao::text, d.disposicao_motivo::text
FROM (VALUES
    ('PONTO-213', 'Cliente sem autorização coletiva não usa sistema alternativo', 'negativo', 'critica', 'aprovado', 'Sem autorização coletiva, a operação por aplicativo precisa atender às formalidades do REP-P.', 'Cliente sem autorização coletiva registrada.', '[{"acao": "Tentar gerar link de marcação por aplicativo", "ordem": 1, "resultado_esperado": "RECUSADO, com explicação da exigência"}, {"acao": "Cadastrar autorização coletiva vigente e repetir", "ordem": 2, "resultado_esperado": "Permitido"}, {"acao": "Autorização vencida", "ordem": 3, "resultado_esperado": "Bloqueado, com alerta de vencimento anterior à expiração"}]', 'A vigência da autorização coletiva governa a modalidade de registro.', 'DECISÃO DE PRODUTO PRECEDENTE (D-01 do documento): ou o YourEyes se estrutura como REP-P conforme, ou cada cliente precisa de autorização em norma coletiva. Este caso pressupõe o segundo caminho. Se a decisão for o primeiro, o caso muda de forma.', 'api', 'CONDICIONADA A CCT/ACT — Portaria MTE 671/2021: o sistema alternativo de controle de jornada (REP-A) é admitido apenas quando autorizado por convenção ou acordo coletivo; CLT, art. 74, §4º (registro por exceção)', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-250', 'Marcação não atravessa a fronteira entre clientes', 'negativo', 'critica', 'aprovado', 'Ponto é dado pessoal e revela rotina, localização e presença. Vazamento entre clientes é incidente, não inconveniência.', 'Dois tenants com colaboradores ativos.', '[{"acao": "Autenticado no tenant A, consultar marcações do tenant B", "ordem": 1, "resultado_esperado": "Nenhum dado retornado"}, {"acao": "Gravar marcação com tenant_id de outro cliente pela API", "ordem": 2, "resultado_esperado": "RECUSADO"}, {"acao": "Consultar por cada caminho público do módulo", "ordem": 3, "resultado_esperado": "Nenhum retorna dado de outra empresa"}, {"acao": "Conferir RLS em todas as tabelas de ponto", "ordem": 4, "resultado_esperado": "Ativa, com política, nas 24 tabelas do módulo"}]', 'O isolamento vale para leitura e escrita, em todos os caminhos.', 'O passo 4 é verificável por consulta ao catálogo e é o mais barato de automatizar. Conecta com o achado HIER-006, onde a escrita atravessava tenant porque a FK não validava.', 'api', 'OBRIGAÇÃO LEGAL — LGPD, arts. 46 e 47 (segurança e prevenção de acesso indevido); art. 6º, VII (segurança)', 'em_triagem', NULL),
    ('PONTO-251', 'Link de marcação exige expiração e é revogável', 'negativo', 'critica', 'aprovado', 'Link sem expiração é credencial permanente distribuída por mensagem.', 'Tela de geração de link.', '[{"acao": "Tentar criar link sem data de expiração", "ordem": 1, "resultado_esperado": "RECUSADO"}, {"acao": "Acessar com token revogado", "ordem": 2, "resultado_esperado": "Acesso negado; tentativa registrada"}, {"acao": "Acessar com token expirado", "ordem": 3, "resultado_esperado": "Acesso negado"}, {"acao": "Conferir a geração do token", "ordem": 4, "resultado_esperado": "No servidor, com entropia adequada — nunca previsível ou derivado de dado do colaborador"}, {"acao": "Vários CPFs em sequência no mesmo link compartilhado", "ordem": 5, "resultado_esperado": "Bloqueio temporário e registro do evento"}]', 'O link é temporário, revogável, imprevisível e protegido contra varredura.', 'O passo 5 trata o link compartilhado como superfície de enumeração de CPF — que é exatamente o que ele é se não houver limite de tentativas.', 'api', 'OBRIGAÇÃO LEGAL — LGPD, arts. 46 e 47; art. 6º, VIII (prevenção)', 'em_triagem', NULL),
    ('PONTO-252', 'Aprovação de ajuste exige alçada', 'negativo', 'critica', 'aprovado', 'Aprovar o próprio ajuste destrói o controle.', 'Colaborador comum e gestor.', '[{"acao": "Colaborador comum tenta aprovar ajuste", "ordem": 1, "resultado_esperado": "RECUSADO com mensagem clara"}, {"acao": "Colaborador tenta aprovar o PRÓPRIO ajuste", "ordem": 2, "resultado_esperado": "RECUSADO mesmo se tiver papel de gestor"}, {"acao": "Gestor de outra empresa tenta aprovar", "ordem": 3, "resultado_esperado": "RECUSADO"}, {"acao": "Gestor com alçada aprova", "ordem": 4, "resultado_esperado": "Permitido, com autor registrado"}]', 'A alçada é verificada por papel, por escopo e por conflito de interesse.', 'O passo 2 é o mais esquecido: gestor que ajusta o próprio ponto e aprova sozinho anula todo o fluxo.', 'api', 'OBRIGAÇÃO LEGAL — Portaria MTE 671/2021 (integridade do registro); LGPD, art. 6º, III (necessidade)', 'em_triagem', NULL),
    ('PONTO-253', 'Dado acessório é eliminado no fim do prazo, sem perder a marcação', 'excecao', 'alta', 'aprovado', 'Selfie e geolocalização são acessórios com finalidade limitada. A marcação em si tem guarda legal e permanece.', 'Marcações com selfie e localização, com prazo vencido.', '[{"acao": "Rodar o expurgo do prazo vencido", "ordem": 1, "resultado_esperado": "Selfie e geolocalização eliminadas"}, {"acao": "Conferir a marcação", "ordem": 2, "resultado_esperado": "PRESERVADA — tem guarda legal própria"}, {"acao": "Conferir o registro do expurgo", "ordem": 3, "resultado_esperado": "Evento registrado, conforme LGPD art. 37"}, {"acao": "Conferir a cadeia de hash após o expurgo", "ordem": 4, "resultado_esperado": "Íntegra — o expurgo do acessório não pode quebrar a prova da batida"}]', 'O acessório some no prazo, a prova permanece, e a cadeia sobrevive.', 'O passo 4 é a armadilha: se o hash incluir a selfie, expurgá-la invalida a cadeia inteira. É decisão de projeto que precisa ser tomada antes, não depois.', 'api', 'OBRIGAÇÃO LEGAL — LGPD, art. 16 (eliminação após o término do tratamento, ressalvadas hipóteses de guarda legal); art. 6º, III (necessidade); CLT, art. 74 (guarda dos controles de jornada)', 'em_triagem', NULL),
    ('PONTO-254', 'Selfie é dado comum enquanto não houver verificação facial', 'alternativo', 'critica', 'aprovado', 'O regime jurídico muda conforme o uso, não conforme o formato do arquivo.', 'Sistema com selfie na marcação.', '[{"acao": "Selfie armazenada apenas como evidência, sem comparação", "ordem": 1, "resultado_esperado": "Dado pessoal COMUM; base legal do art. 7º, II"}, {"acao": "Sistema passa a comparar a foto para identificar o trabalhador", "ordem": 2, "resultado_esperado": "Vira dado BIOMÉTRICO — sensível; exige base do art. 11 e avaliação de impacto"}, {"acao": "Conferir o aviso de tratamento na tela de marcação", "ordem": 3, "resultado_esperado": "Visível e acessível, com a finalidade correta para o uso vigente"}]', 'O uso define o regime, e o aviso acompanha o uso.', 'DECISÃO DE PRODUTO COM CONSEQUÊNCIA JURÍDICA: ativar verificação facial sem trocar a base legal e sem avaliação de impacto é tratar dado sensível fora do art. 11.', 'e2e', 'CONDICIONADA AO USO — LGPD, art. 5º, II (dado biométrico é dado pessoal sensível); art. 11 (tratamento de dado sensível exige base legal própria); art. 7º, II (obrigação legal do controlador)', 'decisao_de_produto', 'AS-BUILT 2026-08-20: não há verificação facial em lugar nenhum — a selfie é capturada e guardada como foto. Ou seja, hoje ela É dado comum de fato (estado correto). O que falta é DECISÃO de produto/LGPD: classificar e avisar explicitamente que a selfie é dado comum enquanto não houver biometria, e definir o gatilho que a reclassificaria como dado sensível (art. 5º, II / art. 11 da LGPD) se um dia entrar reconhecimento facial. Sem essa definição, não há o que construir na tela.'),
    ('PONTO-270', 'Todas as tabelas de ponto têm a trava do cercado', 'negativo', 'critica', 'aprovado', 'O módulo tem 24 tabelas de ponto e 6 de jornada. Uma rotina com erro de tenant não pode alcançar nenhuma delas.', 'Cercado instalado.', '[{"acao": "Listar tabelas de ponto e jornada sem a trava qa_guarda_cercado", "ordem": 1, "resultado_esperado": "Nenhuma"}, {"acao": "Com o modo de teste ligado, tentar INSERT em ponto de tenant real", "ordem": 2, "resultado_esperado": "BLOQUEADO"}, {"acao": "Tentar UPDATE movendo linha do cercado para tenant real", "ordem": 3, "resultado_esperado": "BLOQUEADO"}, {"acao": "Tentar DELETE em ponto de tenant real", "ordem": 4, "resultado_esperado": "BLOQUEADO"}, {"acao": "Escrever no cercado", "ordem": 5, "resultado_esperado": "PERMITIDO"}]', 'A cerca cobre as três operações em todas as tabelas do módulo.', 'Verificado em 31/07/2026 com a cerca genérica: 24 tabelas de ponto e 6 de jornada protegidas, e as três operações bloqueadas contra tenant real. Este caso vigia para que continue assim quando tabelas novas de ponto forem criadas.', 'api', 'Regra de produto (sem base legal direta) — apoia LGPD, arts. 46 e 47: rotina de teste que escreva em dado de cliente é incidente de segurança causado pela própria ferramenta de qualidade', 'em_triagem', NULL),
    ('PONTO-271', 'Bateria de ponto não deixa resíduo no cercado', 'negativo', 'critica', 'aprovado', 'As rotinas de ponto escrevem em marcação, dia, banco de horas, alertas e fechamento. Nada pode sobrar.', 'Bateria do módulo executada.', '[{"acao": "Rodar a bateria do módulo de ponto", "ordem": 1, "resultado_esperado": "Concluída"}, {"acao": "Rodar qa_verifica_vazamento()", "ordem": 2, "resultado_esperado": "Limpo — nada fora do mobiliário fixo em nenhuma das 298 tabelas"}, {"acao": "Conferir especificamente as tabelas de ponto", "ordem": 3, "resultado_esperado": "Zero linhas no tenant do cercado"}]', 'O cercado volta ao repouso após a bateria.', 'O detector genérico cobre isso automaticamente desde 01/08/2026 — tabela nova de ponto entra na vigilância sem alteração de código.', 'api', 'Regra de produto — integridade do ambiente de teste', 'em_triagem', NULL),
    ('PONTO-290', 'Dia útil sem marcação é materializado como falta', 'feliz', 'critica', 'aprovado', 'A apuração percorre as linhas de ponto_diario; quem cria a linha do dia SEM batida é a materialização (ponto_materializar_faltas). Sem ela, a falta não é calculada e ignorada — ela nunca chega a existir, e nada é descontado. Foi o caso da clínica: a lista pulava de domingo para terça.', 'Colaborador ativo em escala 5x2; um dia útil já passado sem nenhuma marcação e sem amparo.', '[{"acao": "Rodar a materialização para o período que contém o dia sem batida", "ordem": 1, "resultado_esperado": "Linha criada em ponto_diario com status de falta"}, {"acao": "Conferir a apuração da competência", "ordem": 2, "resultado_esperado": "O dia aparece na lista e o débito da falta entra no saldo"}, {"acao": "Rodar a materialização passando um período com data futura", "ordem": 3, "resultado_esperado": "Datas futuras são ignoradas — não existe falta em dia que não aconteceu"}]', 'O dia sem batida passa a existir, desconta, e o futuro fica de fora.', 'Regressão aqui reabre o caso de 13/07 (falta que não desconta). A rotina diária automatiza o dia anterior; a recuperação retroativa é decisão de quem opera a folha — o caso testa a função, não dispara retroativo.', 'api', 'CLT, art. 473 (a contrario sensu); Lei 605/1949, art. 6º (a falta injustificada repercute no DSR — mas só se for vista)', 'em_triagem', NULL),
    ('PONTO-291', 'Ausência amparada não vira falta na materialização', 'alternativo', 'alta', 'aprovado', 'A materialização não pode ser um gerador cego de débito: dia sem batida com atestado, férias ou feriado na unidade é dia amparado. PONTO-024 já garante isso na apuração; este caso garante na MATERIALIZAÇÃO — a linha criada precisa nascer com o status do amparo, não como falta.', 'Colaborador com atestado aprovado cobrindo um dia útil sem marcação; outro dia coberto por feriado da unidade.', '[{"acao": "Materializar o período com o dia do atestado", "ordem": 1, "resultado_esperado": "Linha criada com status de ausência amparada, sem débito"}, {"acao": "Materializar o período com o feriado", "ordem": 2, "resultado_esperado": "Dia reconhecido como feriado, sem falta e sem débito"}]', 'Materialização distingue falta de ausência amparada.', NULL, 'api', 'CLT, art. 473 (ausências legais); Lei 605/1949, art. 6º, §1º', 'em_triagem', NULL),
    ('PONTO-292', 'Materializar duas vezes não duplica o dia', 'excecao', 'alta', 'aprovado', 'A rotina roda todo dia e a recuperação por período pode passar pelo mesmo intervalo mais de uma vez. Idempotência é o que separa uma rotina de manutenção de um gerador de duplicatas — e dia duplicado é exatamente a doença que a frente "um dia por data" acabou de tratar.', 'Dia já materializado como falta.', '[{"acao": "Rodar a materialização de novo sobre o mesmo período", "ordem": 1, "resultado_esperado": "Nenhuma linha nova; a existente permanece uma só"}, {"acao": "Conferir o saldo da competência", "ordem": 2, "resultado_esperado": "O débito da falta conta uma única vez"}]', 'Rodar N vezes produz o mesmo estado de rodar uma.', NULL, 'api', 'Portaria MTE 671/2021 (integridade dos registros de tratamento)', 'em_triagem', NULL),
    ('PONTO-293', 'Diagnóstico aponta os dias que faltam materializar', 'alternativo', 'media', 'aprovado', 'ponto_dias_nao_materializados é o exame que revela o buraco antes de o cliente notar no espelho. O caso garante que o diagnóstico enxerga o dia ausente e que, depois da materialização, a lista zera.', 'Colaborador com um dia útil passado sem linha em ponto_diario.', '[{"acao": "Rodar o diagnóstico", "ordem": 1, "resultado_esperado": "O dia sem linha aparece na lista"}, {"acao": "Materializar e rodar o diagnóstico de novo", "ordem": 2, "resultado_esperado": "Lista vazia"}]', 'O diagnóstico acusa antes e silencia depois.', NULL, 'api', 'Portaria MTE 671/2021 (dever de tratamento fiel dos registros)', 'em_triagem', NULL),
    ('PONTO-300', 'A apuração devolve no máximo uma linha por data', 'excecao', 'critica', 'aprovado', 'ponto_saldo_dias_competencia ganhou a garantia de UM DIA POR DATA: quando algum ramo interno emite a mesma data duas vezes (o caso da linha de equalização), o invólucro agrupa — dia protegido vence com saldo zero; senão vale o trabalhado real e a maior jornada. Duplicata debita o colaborador duas vezes.', 'Competência com marcações normais, incluindo um sábado trabalhado e uma equalização configurada.', '[{"acao": "Apurar a competência e agrupar por data", "ordem": 1, "resultado_esperado": "Nenhuma data aparece mais de uma vez"}, {"acao": "Conferir o sábado trabalhado", "ordem": 2, "resultado_esperado": "Uma linha só, com as horas reais — não uma linha real mais uma de equalização zerada"}, {"acao": "Somar o saldo do mês", "ordem": 3, "resultado_esperado": "Cada dia contribui uma única vez"}]', 'Um dia civil, uma linha de apuração, um débito/crédito.', 'O corpo antigo segue intacto (renomeado _bruto); a garantia vive no invólucro. Se alguém voltar a chamar o bruto diretamente, este caso acusa.', 'api', 'CLT, art. 74 (fidelidade do registro); caso Adriana 27/06 (débito de 3h40 inexistente)', 'em_triagem', NULL),
    ('PONTO-301', 'Dia normal atravessa o agrupamento sem ser alterado', 'alternativo', 'alta', 'aprovado', 'A promessa da correção foi cirúrgica: dia que sai uma vez só passa intocado — valores idênticos aos de antes. Este caso compara a saída agrupada com a bruta num período sem duplicatas: precisa ser igual, linha a linha.', 'Competência sem nenhuma data duplicada no ramo bruto.', '[{"acao": "Apurar pela função pública e pela bruta", "ordem": 1, "resultado_esperado": "Mesmo número de linhas, mesmos valores por dia"}]', 'O invólucro só age quando há duplicata.', NULL, 'api', 'CLT, art. 74 (fidelidade do registro)', 'em_triagem', NULL),
    ('PONTO-310', 'Apuração filtrada por empresa traz só aquela empresa', 'feliz', 'critica', 'aprovado', 'O filtro antigo tinha a válvula "OR empresa_id IS NULL": todo colaborador sem empresa entrava na apuração de TODAS as empresas do tenant. A correção resolve a empresa pelo cadastro de admissão quando a linha não tem, e o filtro passa a ser empresa resolvida = empresa pedida. Fechar a empresa A não pode arrastar gente da B.', 'Tenant com duas empresas, colaboradores com marcações em ambas.', '[{"acao": "Apurar a competência filtrando pela empresa A", "ordem": 1, "resultado_esperado": "Só colaboradores da empresa A na saída"}, {"acao": "Apurar pela empresa B", "ordem": 2, "resultado_esperado": "Só os da B — sem interseção com a lista anterior"}, {"acao": "Apurar sem filtro", "ordem": 3, "resultado_esperado": "Todos aparecem, cada um uma vez"}]', 'Cada empresa fecha o próprio pessoal, e mais ninguém.', NULL, 'api', 'CLT, art. 74, §2º (registro por estabelecimento); caso "fecha pra todas as empresas" (04/08)', 'em_triagem', NULL),
    ('PONTO-311', 'Colaborador sem empresa na linha é resolvido pelo cadastro', 'alternativo', 'alta', 'aprovado', 'Linha de ponto sem empresa preenchida não pode nem sumir do fechamento nem entrar em todos: a empresa vem da admissão vigente do colaborador. É a substituição da válvula de escape por resolução de verdade.', 'Colaborador admitido na empresa A com linhas de ponto_diario sem empresa_id.', '[{"acao": "Apurar filtrando pela empresa A", "ordem": 1, "resultado_esperado": "O colaborador aparece — a empresa veio do cadastro"}, {"acao": "Apurar filtrando pela empresa B", "ordem": 2, "resultado_esperado": "O colaborador NÃO aparece"}]', 'Sem empresa na linha, vale a do cadastro — nunca a da vez.', NULL, 'api', 'CLT, art. 74, §2º (vinculação ao estabelecimento)', 'em_triagem', NULL),
    ('PONTO-312', 'Reapurar por uma empresa não rouba colaborador da outra', 'negativo', 'critica', 'aprovado', 'O defeito original tinha segunda camada: além de fechar demais, o reapurar carimbava cada linha com a empresa selecionada na barra do topo (COALESCE(p_empresa_id, ...)), MUDANDO a empresa de quem já tinha a sua. Espelho da empresa errada é documento errado assinado.', 'Colaborador da empresa A com linhas já atribuídas à empresa A.', '[{"acao": "Reapurar a competência filtrando pela empresa B", "ordem": 1, "resultado_esperado": "As linhas do colaborador da A permanecem com a empresa A"}, {"acao": "Conferir o espelho do colaborador", "ordem": 2, "resultado_esperado": "Emitido pela empresa A, a dele"}]', 'Reapuração nunca reatribui empresa de quem já tem.', 'Foi necessária uma migration de reparo (corrige_empresa_atribuida_errada) para desfazer o estrago desse comportamento — este caso impede a reincidência.', 'api', 'Portaria MTE 671/2021 (fidelidade do espelho por estabelecimento)', 'em_triagem', NULL),
    ('PONTO-320', 'Feriado trabalhado sem folga compensatória rende adicional de 100%', 'feliz', 'critica', 'aprovado', 'O sistema já sabia que o dia era feriado e que houve marcação — e parava no rótulo. Agora ponto_feriado_adicional_competencia devolve os minutos trabalhados no feriado com adicional de 100%, prontos para a folha, a partir do feriado resolvido pela tabela da unidade (RN22).', 'Colaborador com marcações completas num feriado da tabela vinculada à sua unidade; nenhuma folga compensatória registrada.', '[{"acao": "Apurar o adicional de feriado da competência", "ordem": 1, "resultado_esperado": "Os minutos trabalhados no feriado aparecem com adicional de 100%"}, {"acao": "Conferir um dia comum trabalhado na mesma competência", "ordem": 2, "resultado_esperado": "Fora do cálculo do adicional — só feriado entra"}]', 'Feriado trabalhado e não compensado vira verba de 100% apurada, sem lançamento manual.', NULL, 'api', 'Lei 605/1949, art. 9º; Súmula 146 do TST (trabalho em feriado não compensado é pago em dobro)', 'em_triagem', NULL),
    ('PONTO-321', 'Folga compensatória registrada afasta o pagamento em dobro', 'alternativo', 'alta', 'aprovado', 'A parte final do art. 9º é a exceção que a tabela feriado_folga_compensatoria materializa: RH registra que o feriado trabalhado foi compensado com folga em outro dia, e o adicional daquele feriado deixa de ser devido.', 'Feriado trabalhado com folga compensatória registrada apontando outro dia.', '[{"acao": "Registrar a folga compensatória do feriado trabalhado", "ordem": 1, "resultado_esperado": "Registro aceito, vinculando feriado, colaborador e dia da folga"}, {"acao": "Apurar o adicional da competência", "ordem": 2, "resultado_esperado": "O feriado compensado sai do cálculo; outros feriados não compensados permanecem"}]', 'Compensou, não dobra; não compensou, dobra.', NULL, 'api', 'Lei 605/1949, art. 9º, parte final (salvo se houver folga compensatória em outro dia)', 'em_triagem', NULL),
    ('PONTO-322', 'Adicional de feriado não entra no saldo do banco de horas', 'negativo', 'alta', 'aprovado', 'O adicional de feriado é verba de folha, não crédito de compensação. Se os mesmos minutos entrassem também no saldo do banco, o colaborador receberia em dobro E folgaria por eles. A apuração do adicional não altera o saldo — e este caso vigia exatamente isso.', 'Feriado trabalhado sem compensação, com o adicional apurado.', '[{"acao": "Comparar o saldo do banco antes e depois de apurar o adicional", "ordem": 1, "resultado_esperado": "Idêntico — a apuração do adicional é somente leitura sobre o saldo"}]', 'A mesma hora não vira verba e crédito ao mesmo tempo.', NULL, 'api', 'Lei 605/1949, art. 9º; princípio do non bis in idem (não pagar duas vezes a mesma hora)', 'em_triagem', NULL),
    ('PONTO-330', 'Espelho-resumo agrega a mesma fonte que o banco de horas', 'feliz', 'critica', 'aprovado', 'O espelho somava colunas órfãs da consolidação antiga e saía zerado para todo mundo. ponto_espelho_resumo agrega a fonte real (ponto_saldo_dias_competencia): as duas telas — espelho e banco de horas — precisam dizer a mesma coisa para a mesma competência.', 'Colaborador com competência apurada, saldo diferente de zero.', '[{"acao": "Gerar o espelho-resumo da competência", "ordem": 1, "resultado_esperado": "Totais de horas e saldo iguais aos do banco de horas"}, {"acao": "Conferir dias trabalhados e faltas", "ordem": 2, "resultado_esperado": "Batem com a apuração dia a dia"}]', 'Espelho e banco de horas contam a mesma história.', NULL, 'api', 'Portaria MTE 671/2021, art. 84 (espelho de ponto fiel); caso do espelho zerado (07/2026)', 'em_triagem', NULL),
    ('PONTO-331', 'O que o modelo não apura sai como não apurado, nunca como zero', 'negativo', 'alta', 'aprovado', 'A apuração atual trabalha em minutos de saldo e não separa HE 50% de 100% nem adicional noturno próprio. Zero afirma que não houve; num espelho assinado, isso é declaração falsa. Esses campos saem marcados como não apurados neste modelo — e o adicional de feriado, esse sim calculado, sai em campo próprio.', 'Colaborador com horas extras reais na competência.', '[{"acao": "Gerar o espelho-resumo", "ordem": 1, "resultado_esperado": "HE 50%/100% e adicional noturno marcados como não apurados neste modelo — não como 0h00"}, {"acao": "Conferir o adicional de feriado", "ordem": 2, "resultado_esperado": "Aparece em campo próprio, com o valor apurado da RN23"}]', 'Zero só quando é zero de verdade.', 'Se um dia a apuração passar a separar os percentuais, este caso deve ser revisado junto — a marca de não apurado deixa de valer para o campo que passar a existir.', 'api', 'Portaria MTE 671/2021 (fidelidade); vedação à declaração falsa em documento que o colaborador assina', 'em_triagem', NULL),
    ('PONTO-340', 'Marcação nasce original e ajuste é rotulado como ajuste', 'feliz', 'alta', 'aprovado', 'A coluna origem_marcacao classifica cada batida: O (original), A (ajuste), P (pré-assinalada), E (importada), I (integração). É o que o AEJ exige e o que permite auditar quanto do espelho veio de batida real e quanto veio de tratamento. A batida comum nasce O; a marcação criada por ajuste nasce A — em harmonia com PONTO-190 (o ajuste cria batida de correção e preserva a original).', 'Colaborador ativo; um ajuste aprovado criando marcação de correção.', '[{"acao": "Registrar uma batida comum", "ordem": 1, "resultado_esperado": "origem_marcacao = O"}, {"acao": "Criar marcação por ajuste aprovado", "ordem": 2, "resultado_esperado": "origem_marcacao = A; a original permanece O"}]', 'Cada marcação carrega a própria origem, e o ajuste não se disfarça de original.', NULL, 'api', 'Portaria MTE 671/2021 (AEJ distingue a origem de cada marcação tratada)', 'em_triagem', NULL),
    ('PONTO-341', 'Origem fora da lista O/A/P/E/I é recusada', 'negativo', 'media', 'aprovado', 'O CHECK da coluna fecha a lista em cinco valores. Origem inventada quebraria a geração do AEJ e a auditoria de tratamento.', 'Cercado disponível.', '[{"acao": "Gravar marcação com origem_marcacao = X", "ordem": 1, "resultado_esperado": "Recusado pelo CHECK"}, {"acao": "Gravar com origem_marcacao vazia ou nula", "ordem": 2, "resultado_esperado": "Recusado — a coluna é NOT NULL com DEFAULT O"}]', 'Só entram as cinco origens previstas.', NULL, 'api', 'Portaria MTE 671/2021 (padronização do AEJ)', 'em_triagem', NULL),
    ('PONTO-350', 'Toque duplo: duas marcações no mesmo minuto', 'negativo', 'alta', 'aprovado', 'Batida repetida no mesmo minuto (dedo que escorrega, clique duplo) não pode virar duas marcações — dobraria pares e quebraria a apuração. A segunda deve ser recusada ou absorvida, com mensagem clara, sem apagar a primeira.', 'Colaborador ativo, escala 5x2.', '[{"acao": "Registrar entrada às 08:00", "ordem": 1, "resultado_esperado": "Gravada"}, {"acao": "Registrar de novo às 08:00 (mesmo minuto)", "ordem": 2, "resultado_esperado": "Segunda recusada pela regra anti-toque-duplo, com mensagem clara; a primeira intacta"}]', 'Um minuto, uma marcação.', 'Documento de conformidade: CT-004 / RQ-010. Cuidado no desenho: a recusa aqui NÃO conflita com PONTO-002 (vedado restringir horário) — não se bloqueia o horário, apenas o eco da mesma batida.', 'api', 'Portaria MTE 671/2021 (tratamento de marcações; fidelidade do registro)', 'em_triagem', NULL),
    ('PONTO-351', 'Batida retroativa reordena os rótulos sem tocar nos horários', 'alternativo', 'media', 'aprovado', 'Um ajuste aprovado pode inserir batida ANTERIOR às existentes (a entrada esquecida). Os rótulos do dia (entrada, saída-almoço...) precisam se reordenar pela cronologia — e nenhum horário já gravado pode mudar.', 'Dia com 3 marcações (12:00, 13:00, 17:00) e ajuste aprovado incluindo 08:00.', '[{"acao": "Incluir a batida retroativa das 08:00 por ajuste", "ordem": 1, "resultado_esperado": "Dia passa a ter 4 marcações pareadas na ordem certa"}, {"acao": "Conferir os horários pré-existentes", "ordem": 2, "resultado_esperado": "Idênticos aos originais — só os rótulos se moveram"}]', 'Cronologia manda nos rótulos; horários gravados são intocáveis.', 'Documento de conformidade: CT-002 / RQ-060.', 'api', 'CLT, art. 74 (fidelidade); Portaria MTE 671/2021 (a marcação original é imutável)', 'em_triagem', NULL),
    ('PONTO-352', 'Tolerância zero é configuração válida', 'alternativo', 'baixa', 'aprovado', 'O art. 58 §1º fixa o MÁXIMO tolerável — a empresa pode adotar menos, inclusive zero. Com zero, toda variação é computada. O cadastro não pode confundir "zero" com "vazio" e cair no padrão.', 'Parâmetro de tolerância do cliente configurável.', '[{"acao": "Gravar tolerância = 0 minutos", "ordem": 1, "resultado_esperado": "Aceito — zero é escolha, não ausência"}, {"acao": "Apurar dia com entrada 08:03", "ordem": 2, "resultado_esperado": "3 minutos computados — nada é abonado"}]', 'Zero configurado significa zero aplicado.', 'Documento de conformidade: CT-015 / RQ-011. Complementa PONTO-043 (teto legal): lá o limite superior, aqui o inferior.', 'api', 'CLT, art. 58, §1º (a tolerância é um teto, não um piso)', 'em_triagem', NULL),
    ('PONTO-353', 'Fronteira exata do teto diário de 10 minutos', 'negativo', 'media', 'aprovado', 'Variações somando EXATAMENTE 10 minutos ficam dentro do teto: nada computado. Um minuto a mais (11) e o excedente à jornada é computado integralmente. PONTO-041 cobre a fronteira por marcação; esta é a fronteira do dia.', 'Colaborador com tolerância legal padrão.', '[{"acao": "Dia com variações somando exatamente 10 minutos", "ordem": 1, "resultado_esperado": "Nada descontado nem computado"}, {"acao": "Dia com variações somando 11 minutos", "ordem": 2, "resultado_esperado": "Excedente computado integralmente, como PONTO-042"}]', 'Dez fica; onze computa.', 'Documento de conformidade: CT-013 / RQ-011.', 'api', 'CLT, art. 58, §1º (10 minutos diários)', 'em_triagem', NULL),
    ('PONTO-354', 'Vencimento do saldo segue o instrumento do regime', 'feliz', 'alta', 'aprovado', 'O prazo de compensação depende do instrumento: acordo individual escrito = 6 meses; norma coletiva = até 12. O sistema precisa calcular e EXIBIR a data de vencimento de cada crédito conforme o regime do colaborador — sem ela, PONTO-171 (saldo vencido vira extra) não tem gatilho confiável.', 'Dois colaboradores com regimes distintos (individual 6m; coletivo 12m) e créditos no banco.', '[{"acao": "Apurar crédito no regime individual", "ordem": 1, "resultado_esperado": "Vencimento em 6 meses, visível no extrato"}, {"acao": "Apurar crédito no regime coletivo", "ordem": 2, "resultado_esperado": "Vencimento conforme o prazo do instrumento"}]', 'Cada crédito nasce com a própria data de vencimento, pelo regime certo.', 'Documento de conformidade: CT-062/CT-063 / RQ-041. | Requisitos YE-DP-ESC-001: os regimes, prazos e a conversão do banco de horas seguem donos aqui (RN-002/RN-008 do documento); o extrato no portal do colaborador é o ESC-030.', 'api', 'CLT, art. 59, §5º (acordo individual: 6 meses) e §2º (instrumento coletivo: 12 meses)', 'em_triagem', NULL),
    ('PONTO-355', 'Saldo perto de vencer gera alerta com ação', 'alternativo', 'media', 'aprovado', 'A 30 dias do vencimento (parametrizável), o RH precisa ser alertado a tempo de conceder a folga — com a opção de transformar o alerta em ação no Plano de Ação, o mecanismo que a casa já usa para obrigações.', 'Saldo de banco com vencimento a menos de 30 dias.', '[{"acao": "Rodar a verificação de vencimentos", "ordem": 1, "resultado_esperado": "Alerta gerado para o saldo próximo do prazo"}, {"acao": "Acionar a criação de ação a partir do alerta", "ordem": 2, "resultado_esperado": "Ação criada no Plano de Ação vinculada ao alerta"}]', 'O prazo avisa antes de virar passivo.', 'Documento de conformidade: CT-065 / RQ-042. | Requisitos YE-DP-ESC-001: os regimes, prazos e a conversão do banco de horas seguem donos aqui (RN-002/RN-008 do documento); o extrato no portal do colaborador é o ESC-030.', 'api', 'CLT, art. 59 (gestão do regime de compensação)', 'em_triagem', NULL),
    ('PONTO-356', 'Estouro do limite de acúmulo do banco', 'negativo', 'media', 'aprovado', 'O cliente pode parametrizar um teto de acúmulo (ex.: 40 horas). Saldo acima do teto precisa gerar alerta conforme a configuração — acúmulo ilimitado silencioso é passivo trabalhista crescendo sem ninguém ver.', 'Limite de acúmulo parametrizado; saldo prestes a ultrapassá-lo.', '[{"acao": "Apurar crédito que ultrapassa o limite", "ordem": 1, "resultado_esperado": "Alerta gerado conforme a configuração"}]', 'Teto configurado é teto vigiado.', 'Documento de conformidade: CT-066 / RQ-043.', 'api', 'CLT, art. 59 (limites do regime); parametrização do cliente', 'em_triagem', NULL),
    ('PONTO-357', 'Rejeição de ajuste: motivo visível, dia intocado', 'alternativo', 'media', 'aprovado', 'PONTO-190 cobre a aprovação; a rejeição é o outro braço do fluxo: status rejeitado, motivo visível ao solicitante e NADA alterado no dia — nem marcação de correção, nem reapuração.', 'Solicitação de ajuste pendente.', '[{"acao": "Rejeitar o ajuste com motivo", "ordem": 1, "resultado_esperado": "Status rejeitado e motivo registrado"}, {"acao": "Conferir o dia", "ordem": 2, "resultado_esperado": "Nenhuma marcação criada, apuração intacta"}]', 'Rejeitar não deixa rastro no dia — só na trilha.', 'Documento de conformidade: CT-073 / RQ-060.', 'api', 'Portaria MTE 671/2021 (tratamento com trilha)', 'em_triagem', NULL),
    ('PONTO-358', 'Reabertura formal de competência fechada', 'excecao', 'alta', 'aprovado', 'PONTO-193 garante que fechado não se altera. Mas erro legítimo descoberto depois precisa de saída FORMAL: reabertura com motivo e alçada, registrada na trilha — e, ao fechar de novo, o espelho ganha NOVA VERSÃO (o documento que o colaborador cientificou não pode ser regravado por cima).', 'Competência fechada com espelho emitido.', '[{"acao": "Reabrir a competência com motivo e alçada adequada", "ordem": 1, "resultado_esperado": "Reabertura aceita e registrada na trilha"}, {"acao": "Corrigir e fechar de novo", "ordem": 2, "resultado_esperado": "Nova versão do espelho; a anterior preservada"}, {"acao": "Tentar reabrir sem alçada", "ordem": 3, "resultado_esperado": "Recusado"}]', 'Fechado só reabre com rito — e nunca sobrescreve a história.', 'Documento de conformidade: CT-078 / RQ-065.', 'api', 'Portaria MTE 671/2021 (integridade do espelho); contraparte de PONTO-193', 'em_triagem', NULL),
    ('PONTO-359', 'Extração dos comprovantes das últimas 48 horas', 'feliz', 'media', 'aprovado', 'Além do comprovante a cada batida (PONTO-005), o trabalhador pode extrair TODOS os comprovantes de um período — o documento fixa a janela de 48 horas como exercício mínimo desse direito.', 'Colaborador com marcações nas últimas 48 horas.', '[{"acao": "Solicitar os comprovantes das últimas 48 horas", "ordem": 1, "resultado_esperado": "Todos os comprovantes do período extraídos, com os campos exigidos"}]', 'O período pedido volta completo.', 'Documento de conformidade: CT-091 / RQ-080.', 'api', 'Portaria MTE 671/2021 (comprovante do trabalhador; disponibilidade)', 'em_triagem', NULL),
    ('PONTO-360', 'Certificado de assinatura perto de vencer gera alerta', 'alternativo', 'media', 'aprovado', 'AFD e AEJ são assinados com certificado digital. Certificado vencido para a emissão dos artefatos na hora da fiscalização — o responsável precisa ser alertado com a antecedência parametrizada.', 'Certificado cadastrado com vencimento dentro da janela de antecedência.', '[{"acao": "Rodar a verificação de certificados", "ordem": 1, "resultado_esperado": "Alerta gerado ao responsável antes do vencimento"}]', 'A assinatura nunca vence de surpresa.', 'Documento de conformidade: CT-094 / RQ-084.', 'api', 'Portaria MTE 671/2021 (assinatura dos arquivos AFD/AEJ)', 'em_triagem', NULL),
    ('PONTO-361', 'Exportação para a folha com grandezas e naturezas corretas', 'feliz', 'critica', 'aprovado', 'A exportação da competência fechada é onde o ponto vira dinheiro: horas normais, extras por faixa, adicional noturno, faltas e DSR precisam sair com VALORES REAIS e a natureza correta (vencimento/desconto/indenizatória) — e o arquivo gerado fica arquivado. Zero afirmativo aqui é o mesmo problema do espelho (PONTO-331), com efeito direto na folha.', 'Competência fechada e apurada, com eventos de cada natureza.', '[{"acao": "Exportar a competência para a folha", "ordem": 1, "resultado_esperado": "Todas as grandezas com valores reais e natureza correta"}, {"acao": "Conferir o arquivamento", "ordem": 2, "resultado_esperado": "Arquivo gerado fica retido com data e autor"}]', 'O que a folha recebe é o que a apuração provou.', 'Documento de conformidade: CT-097 / RQ-090. Depende das decisões D-01/D-02 do documento (papel do módulo x folha) — o caso vigia a fronteira, qualquer que seja a decisão.', 'api', 'CLT, arts. 58-73 (as grandezas); fronteira com o eSocial', 'em_triagem', NULL),
    ('PONTO-362', 'Enumeração de CPFs num link compartilhado é bloqueada', 'negativo', 'critica', 'aprovado', 'O link compartilhado de marcação identifica o trabalhador por CPF. Tentativas em sequência com CPFs diferentes no mesmo link são o padrão de ENUMERAÇÃO — descobrir CPFs válidos da empresa e marcar por terceiros. Precisa de bloqueio temporário e registro do evento.', 'Link de marcação compartilhado ativo.', '[{"acao": "Tentar vários CPFs em sequência no mesmo link", "ordem": 1, "resultado_esperado": "Bloqueio temporário após o limiar, com o evento registrado"}, {"acao": "Aguardar e usar o CPF correto", "ordem": 2, "resultado_esperado": "Fluxo normal — o bloqueio é temporário, não pune o legítimo"}]', 'O link não serve de oráculo de CPFs.', 'Documento de conformidade: CT-103 / RQ-101. Complementa PONTO-251 (expiração) e o caso de revogação.', 'api', 'LGPD, arts. 46-49 (segurança); o CPF é o identificador da marcação', 'em_triagem', NULL),
    ('PONTO-363', 'Aviso de tratamento de dados na tela de marcação', 'feliz', 'media', 'aprovado', 'Quem bate ponto entrega CPF, horário e — quando configurado — selfie e localização. A tela de marcação precisa exibir aviso de tratamento visível e acessível, dizendo o que é coletado e por quê. Caso de TELA: vive no React.', 'Tela de marcação acessível (app ou link).', '[{"acao": "Abrir a tela de marcação", "ordem": 1, "resultado_esperado": "Aviso de tratamento visível e acessível antes de bater"}]', 'O titular sabe o que entrega antes de entregar.', 'Documento de conformidade: CT-108 / RQ-103. Nível e2e — cobertura no Cypress, não no motor SQL.', 'e2e', 'LGPD, arts. 9º e 18 (transparência ao titular)', 'decisao_de_produto', 'AS-BUILT 2026-08-20: a tela (PontoExterno) tem só um rodapé mínimo ("Geolocalização e horário capturados automaticamente • Dados protegidos"): diz O QUE, mas não POR QUÊ (finalidade), não é destacado e não linka política de privacidade — não cumpre um aviso de tratamento LGPD (arts. 9º e 18). Depende de DECISÃO de conteúdo (texto do aviso, finalidades, link da política) e então da construção do aviso visível e acessível na tela de marcação.'),
    ('PONTO-370', 'Estabelecimento com mais de 20 trabalhadores exige controle', 'feliz', 'alta', 'aprovado', 'O controle de jornada é obrigatório quando o ESTABELECIMENTO passa de 20 trabalhadores — a contagem é por estabelecimento, não pela empresa inteira. Ao criar vínculo obrigado, o sistema deve exigir o controle e sinalizar a obrigatoriedade.', 'Estabelecimento com 21+ colaboradores ativos.', '[{"acao": "Cadastrar o 21º colaborador ativo no estabelecimento", "ordem": 1, "resultado_esperado": "Sistema passa a tratar o controle como obrigatório e sinaliza"}, {"acao": "Conferir vínculo novo criado depois", "ordem": 2, "resultado_esperado": "Nasce com exigência de marcação ativa"}]', 'Acima de 20 no estabelecimento, controle obrigatório e sinalizado.', 'Requisitos YE-DP-PONTO-001: RN-001 / CA-001. Sem controle quando obrigado, vale a jornada que o empregado alegar (Súmula 338 TST).', 'api', 'CLT, art. 74, §2º (redação da Lei 13.874/2019)', 'em_triagem', NULL),
    ('PONTO-371', 'Até 20 trabalhadores: controle facultativo, sem falsas pendências', 'alternativo', 'media', 'aprovado', 'Abaixo do limite o controle é opcional. Empresa que NÃO optou não pode ser bombardeada com pendências de marcação; empresa que optou assume o padrão completo (comprovante, integridade, guarda).', 'Estabelecimento com 10 colaboradores, controle desativado.', '[{"acao": "Apurar a competência sem nenhuma marcação", "ordem": 1, "resultado_esperado": "Nenhuma falta ou pendência de marcação é gerada"}, {"acao": "Ativar o controle por opção da empresa", "ordem": 2, "resultado_esperado": "A partir daí o padrão legal completo se aplica, com a mesma integridade do obrigado"}]', 'Facultativo de verdade: nem cobrança indevida, nem meio-padrão quando aderir.', 'Requisitos YE-DP-PONTO-001: RN-001 (parametrização por estabelecimento).', 'api', 'CLT, art. 74, §2º (contrario sensu)', 'em_triagem', NULL),
    ('PONTO-372', 'Registro por exceção só com acordo escrito ou instrumento coletivo', 'negativo', 'alta', 'aprovado', 'O modo "registro por exceção" (só se anota o que foge da jornada) é lícito apenas mediante acordo individual ESCRITO, convenção ou acordo coletivo. Ativar o modo sem o documento anexado deve ser recusado ou, no mínimo, bloqueado com alerta.', 'Empresa sem acordo de exceção cadastrado.', '[{"acao": "Tentar ativar registro por exceção sem anexar o documento autorizador", "ordem": 1, "resultado_esperado": "Recusado ou bloqueado, pedindo o acordo/instrumento"}, {"acao": "Anexar acordo individual escrito vigente e ativar", "ordem": 2, "resultado_esperado": "Modo ativado, com o documento vinculado e a vigência registrada"}]', 'Sem papel, sem exceção.', 'Requisitos YE-DP-PONTO-001: RN-002. Documento arquivado em Empresa › Acordos (seção 16).', 'e2e', 'CLT, art. 74, §4º', 'em_triagem', NULL),
    ('PONTO-373', 'Dispensado do art. 62 não gera pendência nem falta', 'feliz', 'alta', 'aprovado', 'Atividade externa incompatível, cargo de gestão e teletrabalho por produção/tarefa dispensam controle. Para esses vínculos o sistema não exige marcação, não materializa falta e não abre pendência.', 'Colaborador enquadrado no art. 62 (com documento de enquadramento).', '[{"acao": "Apurar um mês inteiro sem nenhuma marcação do dispensado", "ordem": 1, "resultado_esperado": "Nenhuma falta, lacuna ou pendência gerada"}, {"acao": "Conferir o cadastro do vínculo", "ordem": 2, "resultado_esperado": "Enquadramento sinalizado com o fundamento (inciso) e o documento vinculado"}]', 'Dispensado de direito, dispensado de fato.', 'Requisitos YE-DP-PONTO-001: RN-011 / RF-011 / CA-010.', 'api', 'CLT, art. 62, I a III', 'em_triagem', NULL),
    ('PONTO-374', 'Teletrabalho por JORNADA mantém o controle obrigatório', 'alternativo', 'alta', 'aprovado', 'A exclusão do teletrabalho vale só para quem é contratado por produção/tarefa. Teletrabalhista por jornada continua sujeito a controle — o sistema não pode dispensá-lo por engano só porque é remoto.', 'Colaborador em teletrabalho com contrato por jornada.', '[{"acao": "Enquadrar o contrato como teletrabalho por jornada", "ordem": 1, "resultado_esperado": "Exigência de marcação permanece ativa (REP-P)"}, {"acao": "Dia útil sem marcação", "ordem": 2, "resultado_esperado": "Lacuna apontada normalmente, como qualquer controlado"}]', 'Remoto não é sinônimo de dispensado.', 'Requisitos YE-DP-PONTO-001: RN-011. A modalidade (jornada × produção/tarefa) vem do contrato.', 'api', 'CLT, art. 62, III; Lei 14.442/2022', 'em_triagem', NULL),
    ('PONTO-375', 'Controle de fato sobre dispensado gera alerta de descaracterização', 'excecao', 'alta', 'aprovado', 'Se um vínculo dispensado do controle passa a ter marcações reais, a exclusão do art. 62 corre risco de cair na Justiça — e as horas extras do período inteiro junto. O sistema deve detectar o conflito e alertar RH/Jurídico.', 'Colaborador enquadrado no art. 62.', '[{"acao": "Registrar marcações reais em dias seguidos para o dispensado", "ordem": 1, "resultado_esperado": "Sistema detecta controle de fato em vínculo dispensado"}, {"acao": "Conferir alertas", "ordem": 2, "resultado_esperado": "Alerta de possível descaracterização para RH/Jurídico, com a lista das marcações"}]', 'Ou é dispensado, ou é controlado — os dois juntos são passivo.', 'Requisitos YE-DP-PONTO-001: RN-011 / RF-011 / CA-010 / alerta da seção 14.', 'api', 'CLT, art. 62 (jurisprudência: controle de fato descaracteriza a exclusão)', 'em_triagem', NULL),
    ('PONTO-376', 'Marcação com data ou hora futura é recusada', 'negativo', 'alta', 'aprovado', 'A marcação registra o momento em que aconteceu. Data ou hora futura (relógio adulterado do dispositivo, chamada direta de API) deve ser recusada — o carimbo de tempo é do servidor, sincronizado, nunca do cliente.', 'Colaborador ativo.', '[{"acao": "Enviar marcação com data de amanhã", "ordem": 1, "resultado_esperado": "Recusada"}, {"acao": "Enviar marcação de hoje com hora futura (ex.: 23:59 sendo 10h)", "ordem": 2, "resultado_esperado": "Recusada ou registrada com o horário DO SERVIDOR, nunca o informado"}]', 'Ninguém bate o ponto de amanhã.', 'Requisitos YE-DP-PONTO-001: validações da seção 13 ("marcação futura"). Complementa PONTO-002 (não restringir horário): recusar o FUTURO não é restringir horário legítimo.', 'api', 'Portaria MTE 671/2021 (fidelidade do registro); CLT, art. 74', 'em_triagem', NULL),
    ('PONTO-377', 'Marcações "britânicas" (uniformes) são detectadas e alertadas', 'excecao', 'alta', 'aprovado', 'Espelhos com horários idênticos todos os dias (08:00/12:00/13:00/17:00 cravados) são considerados INVÁLIDOS como prova — presunção a favor do empregado. O sistema deve detectar uniformidade prolongada e alertar, pois indica registro artificial.', 'Colaborador com 30 dias de marcações idênticas ao minuto.', '[{"acao": "Apurar competência com todas as marcações cravadas no mesmo minuto", "ordem": 1, "resultado_esperado": "Detecção de uniformidade (ausência de variação real)"}, {"acao": "Conferir alertas", "ordem": 2, "resultado_esperado": "Alerta de marcações uniformes com o risco da Súmula 338 explicado"}]', 'Ponto britânico é prova contra a empresa, não a favor.', 'Requisitos YE-DP-PONTO-001: RN-003 (Súmula 338 — marcações uniformes inválidas). Caso candidato a IA de anomalias (seção 18).', 'api', 'Súmula 338, III, TST', 'em_triagem', NULL),
    ('PONTO-378', 'Marcação offline sincroniza depois preservando o momento real', 'alternativo', 'alta', 'aprovado', 'Sem conexão, a marcação grava localmente com o horário do MOMENTO DA BATIDA e sincroniza quando a rede volta — carimbada como off-line. O horário da sincronização não pode substituir o da batida.', 'Dispositivo em modo offline.', '[{"acao": "Marcar ponto às 08:00 sem conexão", "ordem": 1, "resultado_esperado": "Gravada localmente com 08:00"}, {"acao": "Reconectar às 10:30", "ordem": 2, "resultado_esperado": "Marcação sobe com hora 08:00 e status off-line preservado; comprovante emitido"}, {"acao": "Conferir a apuração do dia", "ordem": 3, "resultado_esperado": "Usa 08:00, não 10:30"}]', 'A hora é a da batida; a sincronização é só transporte.', 'Requisitos YE-DP-PONTO-001: RF-002 / RNF-004 / cenário "Offline" da seção 25.', 'e2e', 'Portaria MTE 671/2021 (REP-P; identificação de status on/off-line)', 'em_triagem', NULL),
    ('PONTO-379', 'Divergência com a Hora Legal Brasileira gera alerta e registro', 'excecao', 'media', 'aprovado', 'O REP-P deve operar sincronizado com a Hora Legal. Desvio acima da tolerância parametrizada precisa disparar alerta imediato (DP/TI), registrar o evento na trilha e ressincronizar — horário errado contamina toda a cadeia de marcações.', 'Monitoração de tempo ativa.', '[{"acao": "Simular desvio do relógio acima da tolerância", "ordem": 1, "resultado_esperado": "Alerta imediato de divergência de relógio"}, {"acao": "Conferir a trilha", "ordem": 2, "resultado_esperado": "Evento registrado com o desvio medido e a ressincronização"}]', 'Relógio fora da Hora Legal é incidente, não detalhe.', 'Requisitos YE-DP-PONTO-001: RNF-003 / alerta "Divergência de relógio (HBL)" da seção 14.', 'api', 'Portaria MTE 671/2021 (sincronização com a Hora Legal Brasileira — Observatório Nacional)', 'em_triagem', NULL),
    ('PONTO-380', 'Comprovante traz o conteúdo mínimo e o vínculo com a marcação', 'feliz', 'alta', 'aprovado', 'Cada marcação gera comprovante com identificação do empregador, do trabalhador, data/hora da marcação e vínculo com o registro (NSR). É o recibo legal do trabalhador — incompleto não vale.', 'Colaborador ativo com marcação registrada.', '[{"acao": "Registrar uma marcação", "ordem": 1, "resultado_esperado": "Comprovante gerado"}, {"acao": "Abrir o comprovante", "ordem": 2, "resultado_esperado": "Contém empregador, trabalhador, data/hora e referência inequívoca à marcação (NSR)"}, {"acao": "Conferir no módulo Documentos", "ordem": 3, "resultado_esperado": "Arquivado em Funcionário › Ponto › Comprovantes, sem novo upload"}]', 'Comprovante completo, vinculado e arquivado sozinho.', 'Requisitos YE-DP-PONTO-001: RF-003 / CA-003 / seção 16. Complementa PONTO-005 (existência) e PONTO-359 (extração 48h).', 'e2e', 'Portaria MTE 671/2021 (comprovante de registro de ponto)', 'em_triagem', NULL),
    ('PONTO-381', 'Comprovante não disponibilizado em 48h vira alerta crítico', 'excecao', 'alta', 'aprovado', 'No REP-P o comprovante pode ser disponibilizado eletronicamente em até 48h da marcação. Estourar esse prazo é descumprimento direto da Portaria: o sistema deve alertar ANTES do vencimento e criar ação se estourar.', 'Marcação registrada há mais de 40h sem comprovante disponível.', '[{"acao": "Aproximar-se do prazo (ex.: 40h) com comprovante pendente", "ordem": 1, "resultado_esperado": "Alerta preventivo ao DP"}, {"acao": "Estourar as 48h", "ordem": 2, "resultado_esperado": "Alerta crítico + ação no Plano de Ação com a marcação de origem vinculada"}]', 'As 48h são da lei, não meta interna.', 'Requisitos YE-DP-PONTO-001: RF-003 / CA-003 / alerta da seção 14 / cenário "Prazo vencido" da seção 25.', 'api', 'Portaria MTE 671/2021 (REP-P: comprovante em até 48 horas por meio eletrônico)', 'em_triagem', NULL),
    ('PONTO-382', 'AFD com integridade violada vai para quarentena — nada é conciliado', 'excecao', 'alta', 'aprovado', 'Arquivo importado com CRC inválido, cadeia SHA quebrada ou assinatura .p7s inválida não pode entrar nem parcialmente: vai inteiro para quarentena, com relatório do que falhou, e o DP é alertado. Conciliar arquivo corrompido contamina a base probatória.', 'Arquivo AFD adulterado (um byte alterado num registro tipo 3).', '[{"acao": "Importar o AFD adulterado", "ordem": 1, "resultado_esperado": "Validação acusa a falha (CRC/SHA/assinatura) e o arquivo entra em quarentena"}, {"acao": "Conferir as marcações", "ordem": 2, "resultado_esperado": "NENHUMA linha do arquivo foi conciliada"}, {"acao": "Conferir alertas", "ordem": 3, "resultado_esperado": "Alerta crítico com o relatório de inconsistências"}]', 'Ou o arquivo inteiro é confiável, ou nada dele entra.', 'Requisitos YE-DP-PONTO-001: RF-004 / CA-004 / cenário "Com erro" da seção 25. Complementa PONTO-212 (lacuna de NSR).', 'api', 'Portaria MTE 671/2021 (AFD: NSR, CRC-16 nos tipos 1-5, SHA-256 encadeado no tipo 7, assinatura)', 'em_triagem', NULL),
    ('PONTO-383', 'Reimportar o mesmo AFD não duplica marcações', 'negativo', 'alta', 'aprovado', 'Reprocessamento é rotina (falha no meio, operador repete o upload). O mesmo arquivo — ou outro arquivo contendo NSRs já importados do mesmo equipamento — não pode gerar marcações em dobro.', 'AFD já importado com sucesso.', '[{"acao": "Importar o mesmo AFD de novo", "ordem": 1, "resultado_esperado": "Sistema reconhece (mesmo arquivo/NSRs) e não duplica nada"}, {"acao": "Conferir a contagem de marcações do período", "ordem": 2, "resultado_esperado": "Idêntica à da primeira importação"}]', 'Importar duas vezes = importar uma vez.', 'Requisitos YE-DP-PONTO-001: seção 13 ("duplicidade de importação — mesmo AFD/NSR — e reprocessamento seguro").', 'api', 'Portaria MTE 671/2021 (NSR único por REP); princípio da fidelidade', 'em_triagem', NULL),
    ('PONTO-384', 'Ajustes de relógio e eventos sensíveis do AFD entram na trilha', 'alternativo', 'media', 'aprovado', 'O AFD não traz só marcações: traz ajustes de relógio do equipamento (tipo 4) e eventos sensíveis (tipo 6). Esses registros devem ser importados e visíveis na trilha de auditoria — um relógio ajustado perto de uma marcação suspeita é exatamente o que o fiscal procura.', 'AFD contendo registros tipo 4 e tipo 6.', '[{"acao": "Importar o AFD", "ordem": 1, "resultado_esperado": "Registros tipo 4 e 6 importados, não descartados"}, {"acao": "Consultar a trilha do equipamento/período", "ordem": 2, "resultado_esperado": "Ajustes de relógio e eventos sensíveis listados com data/hora"}]', 'A trilha guarda o relógio, não só as batidas.', 'Requisitos YE-DP-PONTO-001: RF-004 / seção 23 ("ajustes de relógio; eventos sensíveis do REP").', 'api', 'Portaria MTE 671/2021 (AFD: registro tipo 4 — ajuste do relógio; tipo 6 — eventos sensíveis)', 'em_triagem', NULL),
    ('PONTO-385', 'Memória de cálculo reproduz o resultado a partir da fonte', 'feliz', 'alta', 'aprovado', 'Cada competência apurada gera memória de cálculo versionada: marcações-fonte + versão dos parâmetros → resultado. Reprocessar com os MESMOS insumos tem de dar o MESMO resultado, e a memória deve ser exportável para o auditor refazer a conta.', 'Competência apurada.', '[{"acao": "Apurar a competência e guardar a memória de cálculo", "ordem": 1, "resultado_esperado": "Memória gerada com fonte, parâmetros e versão"}, {"acao": "Reprocessar a mesma competência sem mudar nada", "ordem": 2, "resultado_esperado": "Resultado idêntico, minuto a minuto"}, {"acao": "Exportar a memória", "ordem": 3, "resultado_esperado": "Legível o bastante para refazer a conta fora do sistema"}]', 'Mesma fonte + mesmos parâmetros = mesmo resultado, sempre.', 'Requisitos YE-DP-PONTO-001: RF-005 / RNF-012 / seção 13 ("validação de cálculo: reprodutibilidade").', 'api', 'Portaria MTE 671/2021 (Programa de Tratamento); princípio da auditabilidade', 'em_triagem', NULL),
    ('PONTO-386', 'Apuração usa o instrumento coletivo vigente NA COMPETÊNCIA', 'alternativo', 'alta', 'aprovado', 'Tolerância, adicionais e banco podem vir da CCT/ACT — mas do instrumento vigente na competência apurada, não do mais recente. Reapurar março com a convenção que só entrou em maio é erro clássico. Sobreposição de instrumentos deve gerar alerta, e instrumento a vencer avisa com 60/30 dias.', 'Duas CCTs cadastradas com vigências distintas (percentuais diferentes).', '[{"acao": "Apurar competência coberta pela CCT antiga", "ordem": 1, "resultado_esperado": "Percentuais/tolerância da CCT antiga aplicados"}, {"acao": "Apurar competência coberta pela nova", "ordem": 2, "resultado_esperado": "Parâmetros da nova aplicados"}, {"acao": "Cadastrar instrumentos com vigência sobreposta", "ordem": 3, "resultado_esperado": "Alerta de conflito/sobreposição"}, {"acao": "Aproximar o vencimento do instrumento", "ordem": 4, "resultado_esperado": "Alerta preventivo (60/30 dias) a RH/Jurídico"}]', 'Cada competência com a norma do seu tempo.', 'Requisitos YE-DP-PONTO-001: RNF-009 / seção 13 (vigências) / alerta "Instrumento coletivo vencido" / cenário "Regra coletiva diferente" da seção 25. Par com PONTO-153 (parâmetro não retroage).', 'api', 'CF/88, art. 7º, XXVI (reconhecimento das convenções); CLT (parametrização por CCT/ACT)', 'em_triagem', NULL),
    ('PONTO-387', 'Espelho não assinado impede a conclusão do fechamento', 'negativo', 'alta', 'aprovado', 'O espelho assinado pelo colaborador é a prova de ciência da jornada apurada. Fechar a competência com espelhos pendentes de assinatura, sem tratamento formal da recusa, enfraquece a prova — o fechamento deve travar ou exigir justificativa registrada.', 'Competência apurada com 1 espelho sem assinatura.', '[{"acao": "Tentar concluir o fechamento com espelho pendente", "ordem": 1, "resultado_esperado": "Fechamento não conclui (ou exige justificativa formal da pendência), com alerta ao responsável"}, {"acao": "Colher a assinatura (ou registrar a recusa com ressalva) e fechar", "ordem": 2, "resultado_esperado": "Fechamento conclui, com a situação de cada espelho registrada"}]', 'Fechou, é porque todo mundo viu — ou a recusa está documentada.', 'Requisitos YE-DP-PONTO-001: RF-006 / cenário "Documento inválido" da seção 25. Complementa PONTO-195 (ciência e ressalva).', 'e2e', 'Portaria MTE 671/2021 (ciência do trabalhador); Súmula 338 TST (valor probatório)', 'em_triagem', NULL),
    ('PONTO-388', 'Fechamento bloqueado enquanto houver pendência crítica', 'negativo', 'alta', 'aprovado', 'A competência só fecha com as pendências críticas resolvidas: ajustes em aberto, lacunas sem justificativa, falhas de integridade. Fechar por cima de pendência crítica manda dado errado para a folha e congela o erro.', 'Competência com ajuste pendente de aprovação.', '[{"acao": "Tentar fechar com ajuste pendente", "ordem": 1, "resultado_esperado": "Bloqueado, listando as pendências que impedem"}, {"acao": "Resolver as pendências e fechar", "ordem": 2, "resultado_esperado": "Fechamento conclui e a edição é bloqueada dali em diante"}]', 'Pendência crítica aberta = competência aberta.', 'Requisitos YE-DP-PONTO-001: RF-009 (validações). Par com PONTO-193 (competência fechada não aceita alteração) e PONTO-358 (reabertura formal).', 'api', 'Portaria MTE 671/2021 (tratamento completo antes da consolidação)', 'em_triagem', NULL),
    ('PONTO-389', 'Alerta do ponto gera ação no Plano de Ação com 5W2H e origem', 'feliz', 'media', 'aprovado', 'Todo alerta do módulo (lacuna, HE habitual, intervalo, banco a expirar, integridade, instrumento vencido) pode virar ação no Plano de Ação já preenchida: o quê, por quê (fundamento legal e risco), onde, quando (prazo pelo gatilho), quem (responsável sugerido) e como — mantendo o vínculo com o alerta de origem.', 'Alerta de intervalo suprimido gerado.', '[{"acao": "A partir do alerta, criar ação no Plano de Ação", "ordem": 1, "resultado_esperado": "Ação nasce com 5W2H preenchido e fundamento legal no porquê"}, {"acao": "Abrir a ação criada", "ordem": 2, "resultado_esperado": "Vínculo navegável com o alerta/marcação/competência de origem"}]', 'Do alerta à ação sem digitação — e com rastro.', 'Requisitos YE-DP-PONTO-001: RF-010 / seções 14-15 / CA-013.', 'e2e', 'Boa prática de compliance (documento YE: integração nativa com Plano de Ação)', 'em_triagem', NULL),
    ('PONTO-390', 'Concluir a ação exige verificar se a ocorrência foi resolvida', 'alternativo', 'media', 'aprovado', 'Ao concluir a ação vinculada, o sistema confere a eficácia: a ocorrência de origem foi resolvida? O alerta pode encerrar? Se a causa persiste (ex.: intervalo continua suprimido na semana seguinte), o encerramento deve apontar a reincidência em vez de dar baixa cega.', 'Ação de regularização vinculada a alerta de intervalo.', '[{"acao": "Concluir a ação com a ocorrência de fato resolvida", "ordem": 1, "resultado_esperado": "Alerta encerra junto, com evidência da regularização registrada"}, {"acao": "Concluir outra ação com a causa ainda ativa", "ordem": 2, "resultado_esperado": "Sistema aponta que a ocorrência persiste (novo alerta ou reabertura), sem baixa silenciosa"}]', 'Baixa de ação não é baixa de problema.', 'Requisitos YE-DP-PONTO-001: seção 15 (validação de eficácia).', 'e2e', 'Boa prática de gestão (validação de eficácia — documento YE, seção 15)', 'em_triagem', NULL),
    ('PONTO-391', 'IA sugere, humano decide — nada automatizado afeta direito do trabalhador', 'excecao', 'alta', 'aprovado', 'O "Analisar com IA" produz causa provável, impacto e ação sugerida — mas NUNCA executa sozinho decisão que afete direito (descontar falta, negar ajuste, apontar fraude). Toda sugestão fica registrada com a decisão humana que a acatou ou rejeitou.', 'Alerta com análise de IA disponível.', '[{"acao": "Rodar o Analisar com IA sobre uma ocorrência", "ordem": 1, "resultado_esperado": "Sugestão gerada; NENHUM desconto, negativa ou sanção aplicada automaticamente"}, {"acao": "Acatar ou rejeitar a sugestão", "ordem": 2, "resultado_esperado": "Registro da sugestão da IA + decisão humana + autor, na trilha"}]', 'IA no volante de apoio, nunca no comando.', 'Requisitos YE-DP-PONTO-001: RF-010 / seção 18 (limites gerais de IA).', 'e2e', 'LGPD, art. 20 (decisões automatizadas); CLT (direitos indisponíveis)', 'em_triagem', NULL)
) AS d(codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
CROSS JOIN public.qa_modulos m
WHERE m.path = 'jornada-rotina/ponto'
ON CONFLICT (codigo) DO UPDATE SET
      titulo = EXCLUDED.titulo,
      tipo = EXCLUDED.tipo,
      prioridade = EXCLUDED.prioridade,
      status = EXCLUDED.status,
      objetivo = EXCLUDED.objetivo,
      pre_condicoes = EXCLUDED.pre_condicoes,
      passos = EXCLUDED.passos,
      resultado_esperado = EXCLUDED.resultado_esperado,
      observacoes = EXCLUDED.observacoes,
      nivel = EXCLUDED.nivel,
      base_legal = EXCLUDED.base_legal,
      modulo_id = EXCLUDED.modulo_id,
      disposicao = CASE WHEN qa_casos_teste.disposicao = 'em_triagem' THEN EXCLUDED.disposicao ELSE qa_casos_teste.disposicao END,
      disposicao_motivo = CASE WHEN qa_casos_teste.disposicao = 'em_triagem' THEN EXCLUDED.disposicao_motivo ELSE qa_casos_teste.disposicao_motivo END,
      updated_at = now();


-- (3) PONTES — 58 ligacoes caso -> rotina.

INSERT INTO public.qa_implementacoes (codigo, funcao_sql, ativo)
SELECT d.codigo::text, d.funcao_sql::text, d.ativo::boolean
FROM (VALUES
    ('PONTO-213', 'qa_caso_ponto_213', true),
    ('PONTO-250', 'qa_caso_ponto_250', true),
    ('PONTO-251', 'qa_caso_ponto_251', true),
    ('PONTO-252', 'qa_caso_ponto_252', true),
    ('PONTO-253', 'qa_caso_ponto_253', true),
    ('PONTO-270', 'qa_caso_ponto_270', true),
    ('PONTO-271', 'qa_caso_ponto_271', true),
    ('PONTO-290', 'qa_caso_ponto_290', true),
    ('PONTO-291', 'qa_caso_ponto_291', true),
    ('PONTO-292', 'qa_caso_ponto_292', true),
    ('PONTO-293', 'qa_caso_ponto_293', true),
    ('PONTO-300', 'qa_caso_ponto_300', true),
    ('PONTO-301', 'qa_caso_ponto_301', true),
    ('PONTO-310', 'qa_caso_ponto_310', true),
    ('PONTO-311', 'qa_caso_ponto_311', true),
    ('PONTO-312', 'qa_caso_ponto_312', true),
    ('PONTO-320', 'qa_caso_ponto_320', true),
    ('PONTO-321', 'qa_caso_ponto_321', true),
    ('PONTO-322', 'qa_caso_ponto_322', true),
    ('PONTO-330', 'qa_caso_ponto_330', true),
    ('PONTO-331', 'qa_caso_ponto_331', true),
    ('PONTO-340', 'qa_caso_ponto_340', true),
    ('PONTO-341', 'qa_caso_ponto_341', true),
    ('PONTO-350', 'qa_caso_ponto_350', true),
    ('PONTO-351', 'qa_caso_ponto_351', true),
    ('PONTO-352', 'qa_caso_ponto_352', true),
    ('PONTO-353', 'qa_caso_ponto_353', true),
    ('PONTO-354', 'qa_caso_ponto_354', true),
    ('PONTO-355', 'qa_caso_ponto_355', true),
    ('PONTO-356', 'qa_caso_ponto_356', true),
    ('PONTO-357', 'qa_caso_ponto_357', true),
    ('PONTO-358', 'qa_caso_ponto_358', true),
    ('PONTO-359', 'qa_caso_ponto_359', true),
    ('PONTO-360', 'qa_caso_ponto_360', true),
    ('PONTO-361', 'qa_caso_ponto_361', true),
    ('PONTO-362', 'qa_caso_ponto_362', true),
    ('PONTO-370', 'qa_caso_ponto_370', true),
    ('PONTO-371', 'qa_caso_ponto_371', true),
    ('PONTO-372', 'qa_caso_ponto_372', true),
    ('PONTO-373', 'qa_caso_ponto_373', true),
    ('PONTO-374', 'qa_caso_ponto_374', true),
    ('PONTO-375', 'qa_caso_ponto_375', true),
    ('PONTO-376', 'qa_caso_ponto_376', true),
    ('PONTO-377', 'qa_caso_ponto_377', true),
    ('PONTO-378', 'qa_caso_ponto_378', true),
    ('PONTO-379', 'qa_caso_ponto_379', true),
    ('PONTO-380', 'qa_caso_ponto_380', true),
    ('PONTO-381', 'qa_caso_ponto_381', true),
    ('PONTO-382', 'qa_caso_ponto_382', true),
    ('PONTO-383', 'qa_caso_ponto_383', true),
    ('PONTO-384', 'qa_caso_ponto_384', true),
    ('PONTO-385', 'qa_caso_ponto_385', true),
    ('PONTO-386', 'qa_caso_ponto_386', true),
    ('PONTO-387', 'qa_caso_ponto_387', true),
    ('PONTO-388', 'qa_caso_ponto_388', true),
    ('PONTO-389', 'qa_caso_ponto_389', true),
    ('PONTO-390', 'qa_caso_ponto_390', true),
    ('PONTO-391', 'qa_caso_ponto_391', true)
) AS d(codigo, funcao_sql, ativo)
WHERE to_regprocedure('public.' || d.funcao_sql || '()') IS NOT NULL
ON CONFLICT (codigo) DO UPDATE SET
      funcao_sql = EXCLUDED.funcao_sql, ativo = EXCLUDED.ativo;


-- ---------------------------------------------------------------------------
-- CONFERENCIA — o SQL Editor mostra apenas o ultimo resultado.
-- Esperado: esperados = casos_no_alvo = 60, ponte_orfa = 0, OK
--   (com_rotina pode ser menor: caso de tela (e2e) nao tem rotina no motor.)
-- ---------------------------------------------------------------------------
WITH alvo(codigo) AS (VALUES ('PONTO-213'), ('PONTO-250'), ('PONTO-251'), ('PONTO-252'), ('PONTO-253'), ('PONTO-254'), ('PONTO-270'), ('PONTO-271'), ('PONTO-290'), ('PONTO-291'), ('PONTO-292'), ('PONTO-293'), ('PONTO-300'), ('PONTO-301'), ('PONTO-310'), ('PONTO-311'), ('PONTO-312'), ('PONTO-320'), ('PONTO-321'), ('PONTO-322'), ('PONTO-330'), ('PONTO-331'), ('PONTO-340'), ('PONTO-341'), ('PONTO-350'), ('PONTO-351'), ('PONTO-352'), ('PONTO-353'), ('PONTO-354'), ('PONTO-355'), ('PONTO-356'), ('PONTO-357'), ('PONTO-358'), ('PONTO-359'), ('PONTO-360'), ('PONTO-361'), ('PONTO-362'), ('PONTO-363'), ('PONTO-370'), ('PONTO-371'), ('PONTO-372'), ('PONTO-373'), ('PONTO-374'), ('PONTO-375'), ('PONTO-376'), ('PONTO-377'), ('PONTO-378'), ('PONTO-379'), ('PONTO-380'), ('PONTO-381'), ('PONTO-382'), ('PONTO-383'), ('PONTO-384'), ('PONTO-385'), ('PONTO-386'), ('PONTO-387'), ('PONTO-388'), ('PONTO-389'), ('PONTO-390'), ('PONTO-391')),
x AS MATERIALIZED (
  SELECT
    (SELECT count(*) FROM alvo) AS esperados,
    (SELECT count(*) FROM alvo a JOIN public.qa_casos_teste c ON c.codigo = a.codigo) AS casos_no_alvo,
    (SELECT count(*) FROM alvo a
       JOIN public.qa_casos_teste c ON c.codigo = a.codigo
       JOIN public.qa_implementacoes i ON i.codigo = c.codigo AND i.ativo
      WHERE to_regprocedure('public.' || i.funcao_sql || '()') IS NOT NULL) AS com_rotina,
    (SELECT count(*) FROM alvo a
       JOIN public.qa_implementacoes i ON i.codigo = a.codigo AND i.ativo
      WHERE to_regprocedure('public.' || i.funcao_sql || '()') IS NULL) AS ponte_orfa
)
SELECT esperados, casos_no_alvo, com_rotina, ponte_orfa,
       CASE WHEN casos_no_alvo = esperados AND ponte_orfa = 0
            THEN 'OK' ELSE 'CONFERIR' END AS erro_tecnico
FROM x;
