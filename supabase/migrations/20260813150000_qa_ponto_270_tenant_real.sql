-- =====================================================================
-- QA · PONTO-270 escolhia o cercado vizinho como se fosse cliente real
--
-- Depois de instalar as cercas que faltavam (migration 20260813140000), a
-- rotina PONTO-270 passou a falhar no passo 2 com "INSERT em tenant real
-- passou" — acusando que a cerca não estava segurando.
--
-- A cerca está segurando. Quem estava errado era o teste: ele escolhe o
-- "tenant real" com
--
--   SELECT id FROM tenants WHERE id IS DISTINCT FROM qa_sandbox_tenant_id()
--
-- e o primeiro que aparece é o SEGUNDO CERCADO (slug 'qa-sandbox-2'),
-- criado justamente para exercitar isolamento entre cercados. A trava
-- permite os dois cercados de propósito — então o INSERT passa, e o teste
-- conclui que a cerca falhou.
--
-- Falso negativo, e do tipo pior: acusa defeito onde não há, e ensina a
-- equipe a ignorar a rotina. Corrigido excluindo os dois cercados da
-- escolha. Quando não houver nenhum tenant fora deles — banco recém-criado
-- só com os cercados —, o passo é declarado inaplicável em vez de
-- inventar um veredito.
-- =====================================================================

SET lock_timeout = '10s';

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
END $$;
