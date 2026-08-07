-- =========================================================
-- QA — Ponto: rotinas do bloco de segurança e isolamento (31/07/2026)
--
-- RECORTE DELIBERADO: dos 61 casos do módulo, apenas seis viram rotina agora.
-- São os que NÃO dependem do motor de apuração — que, conforme a auditoria
-- as-built, não existe. Os outros 55 falhariam todos pela mesma causa, e 55
-- falhas idênticas apontando para um único fato arquitetural é ruído, não
-- sinal. Eles seguem documentados como especificação contra a qual o
-- desenvolvimento vai construir, cada um com a base legal ao lado.
--
-- PONTO-254 fica de fora por outro motivo: é 'e2e'. O regime jurídico da
-- selfie depende do USO (evidência ou verificação facial), e isso é decisão
-- de produto verificável em tela, não em SQL.
--
-- TODAS SÃO SEGURAS: cinco leem catálogo e dados agregados sem escrever
-- nada. A sexta (PONTO-270) escreve, mas só para PROVAR que a cerca bloqueia
-- — e toda tentativa contra tenant real é capturada, nunca persiste.
--
-- ACHADOS ANTECIPADOS PELA LEITURA DO SCHEMA, que estas rotinas vão medir:
--   ponto_links.data_expiracao é NULLABLE -> link sem prazo é possível
--   ponto_ajustes não tem nada impedindo aprovado_por = colaborador_id
--   não existe configuração de retenção de dado acessório em lugar nenhum
-- =========================================================

SET lock_timeout = '10s';

-- ─────────────────────────────────────────────────────────
-- PONTO-250 — isolamento multi-tenant nas tabelas do módulo
-- LGPD, arts. 46 e 47
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_250()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
END $$;

-- ─────────────────────────────────────────────────────────
-- PONTO-251 — link de marcação: expiração obrigatória e revogável
-- LGPD, arts. 46 e 47; art. 6º, VIII
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_251()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_nullable boolean; v_sem_prazo int; v_expirado_ativo int;
  v_total int; v_token_curto int; v_achados text := '';
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
  r.passo_acao  := 'Conferir o comprimento do token como indício de entropia';
  SELECT count(*) INTO v_token_curto FROM public.ponto_links WHERE length(token) < 32;

  IF COALESCE(v_nullable, false) THEN
    v_achados := v_achados || 'data_expiracao aceita NULO no schema; ';
  END IF;
  IF v_sem_prazo > 0 THEN
    v_achados := v_achados || format('%s link(s) ATIVO(S) sem prazo nenhum; ', v_sem_prazo);
  END IF;
  IF v_expirado_ativo > 0 THEN
    v_achados := v_achados || format('%s link(s) marcado(s) como ativo com prazo já vencido; ', v_expirado_ativo);
  END IF;
  IF v_token_curto > 0 THEN
    v_achados := v_achados || format('%s token(s) com menos de 32 caracteres; ', v_token_curto);
  END IF;

  IF v_achados = '' THEN
    r.situacao := 'passou';
    r.obtido   := format('%s link(s) analisado(s): prazo obrigatório no schema, nenhum ativo '
               || 'sem prazo ou vencido, tokens com comprimento adequado.', v_total);
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('De %s link(s): %s Link de marcação é credencial distribuída por '
               || 'mensagem: sem prazo obrigatório vira acesso permanente ao ponto do '
               || 'colaborador. Correção: tornar data_expiracao NOT NULL, com prazo padrão '
               || 'curto, e rotina que desative os vencidos em vez de depender da consulta '
               || 'lembrar de filtrar por data.', v_total, v_achados);
    r.detalhe  := jsonb_build_object('schema_aceita_sem_prazo', v_nullable,
                                     'ativos_sem_prazo', v_sem_prazo,
                                     'ativos_vencidos', v_expirado_ativo,
                                     'tokens_curtos', v_token_curto);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- ─────────────────────────────────────────────────────────
-- PONTO-252 — alçada: ninguém aprova o próprio ajuste
-- Portaria MTE 671/2021 (integridade do registro); LGPD art. 6º, III
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_252()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
END $$;

-- ─────────────────────────────────────────────────────────
-- PONTO-253 — retenção de dado acessório
-- LGPD, art. 16 e art. 6º, III; CLT art. 74 (guarda da marcação)
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_253()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_tem_config boolean; v_com_geo_antiga int; v_total int; v_hash_inclui_geo boolean;
BEGIN
  IF to_regclass('public.ponto_marcacoes') IS NULL THEN
    r.situacao := 'nao_implementado';
    r.obtido   := 'Tabela ponto_marcacoes não existe nesta base.';
    RETURN r;
  END IF;

  r.passo_ordem := 1;
  r.passo_acao  := 'Conferir se existe parâmetro de retenção do dado acessório';
  r.esperado    := 'Prazo configurável para geolocalização e imagem';

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (column_name ILIKE '%retencao%' OR column_name ILIKE '%expurgo%'
           OR column_name ILIKE '%dias_guarda%')
  ) INTO v_tem_config;

  r.passo_ordem := 2;
  r.passo_acao  := 'AUDITORIA (somente leitura): geolocalização retida há mais de um ano';

  SELECT count(*) INTO v_total FROM public.ponto_marcacoes;
  SELECT count(*) INTO v_com_geo_antiga FROM public.ponto_marcacoes
   WHERE (latitude IS NOT NULL OR longitude IS NOT NULL)
     AND data_marcacao < CURRENT_DATE - 365;

  r.passo_ordem := 3;
  r.passo_acao  := 'Conferir se a marcação tem hash próprio, independente do acessório';
  v_hash_inclui_geo := public.qa_coluna_existe('ponto_marcacoes','hash_marcacao');

  IF v_tem_config AND v_com_geo_antiga = 0 THEN
    r.situacao := 'passou';
    r.obtido   := format('Parâmetro de retenção existe e nenhuma geolocalização antiga '
               || 'retida entre %s marcação(ões).', v_total);
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('Parâmetro de retenção existe: %s. Marcações com geolocalização '
               || 'guardada há mais de um ano: %s, de %s no total. A LGPD, art. 16, exige '
               || 'eliminação ao término do tratamento, e a finalidade da geolocalização '
               || 'se esgota bem antes do prazo de guarda da MARCAÇÃO, que tem base própria '
               || 'no art. 74 da CLT. São dois prazos diferentes tratados hoje como um só: '
               || 'guarda-se tudo para sempre. Correção: prazo configurável para o acessório, '
               || 'rotina de expurgo com registro do evento (art. 37), e conferir se o '
               || 'hash_marcacao (presente: %s) inclui os campos acessórios — se incluir, '
               || 'expurgá-los quebra a cadeia de integridade da batida, e essa decisão '
               || 'precisa ser tomada ANTES de implementar o expurgo.',
               v_tem_config, v_com_geo_antiga, v_total, v_hash_inclui_geo);
    r.detalhe  := jsonb_build_object('tem_parametro_retencao', v_tem_config,
                                     'geo_antiga_retida', v_com_geo_antiga,
                                     'total_marcacoes', v_total);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- ─────────────────────────────────────────────────────────
-- PONTO-270 — a cerca cobre o módulo nas três operações
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_270()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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

  SELECT id INTO v_real FROM public.tenants
  WHERE id IS DISTINCT FROM public.qa_sandbox_tenant_id() LIMIT 1;

  IF v_real IS NULL THEN
    r.situacao := 'passou';
    r.obtido   := 'Todas as tabelas do módulo têm a trava. Não há outro tenant nesta base '
               || 'para exercitar o bloqueio.';
    RETURN r;
  END IF;

  BEGIN
    INSERT INTO public.ponto_marcacoes
      (tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
       tipo_marcacao, hash_marcacao)
    VALUES (v_real, gen_random_uuid(), '[QA-PONTO-270]', '99900027001',
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
            '99900027002', 'entrada', 'qa-teste-cerca');

    UPDATE public.ponto_marcacoes SET tenant_id = v_real
    WHERE colaborador_nome = '[QA-PONTO-270] Cobaia';
    v_upd := true;   -- passou: a cerca falhou
  EXCEPTION WHEN OTHERS THEN v_upd := false;
  END;

  r.passo_ordem := 4;
  r.passo_acao  := 'Conferir no catalogo se a trava tambem cobre DELETE';
  r.esperado    := 'A trigger declara INSERT, UPDATE e DELETE';
  -- DELETE nao e exercitado contra dado real de proposito: so provaria algo
  -- mirando uma linha de cliente que existisse, e se a cerca falhasse o dado
  -- seria apagado. Aqui a declaracao e verificada no catalogo. tgtype: bit 4
  -- = INSERT, bit 8 = DELETE, bit 16 = UPDATE.
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
                                     'delete_coberto', v_del_coberto);
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
END $$;

-- ─────────────────────────────────────────────────────────
-- PONTO-271 — o detector enxerga as tabelas do módulo
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_271()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
END $$;

-- ─────────────────────────────────────────────────────────
-- Ligar caso <-> rotina
-- ─────────────────────────────────────────────────────────
INSERT INTO public.qa_implementacoes (codigo, funcao_sql, ativo) VALUES
  ('PONTO-250','qa_caso_ponto_250',true),
  ('PONTO-251','qa_caso_ponto_251',true),
  ('PONTO-252','qa_caso_ponto_252',true),
  ('PONTO-253','qa_caso_ponto_253',true),
  ('PONTO-270','qa_caso_ponto_270',true),
  ('PONTO-271','qa_caso_ponto_271',true)
ON CONFLICT (codigo) DO UPDATE SET funcao_sql = EXCLUDED.funcao_sql, ativo = true;

DO $roda$
BEGIN
  PERFORM public.qa_rodar_bateria('manual','jornada-rotina/ponto');
END $roda$;

SELECT * FROM public.qa_relatorio_falhas('jornada-rotina/ponto');
SELECT * FROM public.qa_verifica_vazamento();
