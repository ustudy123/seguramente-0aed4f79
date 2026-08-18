-- ============================================================================
-- SCRIPT DE ENTREGA — PONTO-004: marcação original imutável + remover backdoor
-- Cole no SQL Editor do banco de PRODUÇÃO (projeto diayjpsrcerycycyaxst)
-- SOMENTE após aprovar no ambiente de teste. Idempotente (pode rodar 2x).
--
-- Efeito:
--   (1) exclusão DIRETA de marcação de ponto (public.ponto_marcacoes) por papel
--       de gestão deixa de ser permitida — a correção passa a ser por acréscimo.
--       A exclusão de AJUSTES (public.ponto_ajustes) e da consolidação diária
--       (public.ponto_diario) continua funcionando como hoje, pelos mesmos papéis:
--       ajuste é o próprio acréscimo e ponto_diario é derivado/recalculável.
--   (2) remove o e-mail real hardcoded (backdoor de exclusão + dado pessoal real
--       no código, LGPD) de public.pode_excluir_registro_ponto.
--   (3) atualiza a nota de risco da rotina de QA PONTO-004 (se o motor de QA
--       estiver instalado neste banco).
--
-- NÃO cobre (decisão pendente, ver conversa): os RPC excluir_marcacao_ponto e
-- processar_ajuste_ponto (tipo "correcao") continuam apagando a marcação original
-- pelo flag de sessão app.allow_ponto_delete. É por eles que a tela do gestor
-- apaga hoje.
-- ============================================================================

SET LOCAL lock_timeout = '10s';

-- ---------------------------------------------------------------------------
-- 1) Trigger de proteção contra exclusão da marcação original.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bloquear_delete_ponto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;

  IF current_setting('app.allow_ponto_delete', true) = 'true' THEN
    RETURN OLD;
  END IF;

  -- Fora da marcação original, a regra de papéis continua valendo
  -- (ponto_ajustes = acréscimos; ponto_diario = consolidação derivada).
  IF TG_TABLE_NAME <> 'ponto_marcacoes'
     AND public.pode_excluir_registro_ponto(OLD.tenant_id) THEN
    RETURN OLD;
  END IF;

  INSERT INTO public.ponto_audit_log (
    tenant_id, tabela_origem, registro_id, acao, dados_anteriores, usuario_id
  ) VALUES (
    OLD.tenant_id, TG_TABLE_NAME, OLD.id, 'TENTATIVA_DELETE', to_jsonb(OLD), auth.uid()
  );

  IF TG_TABLE_NAME = 'ponto_marcacoes' THEN
    RAISE EXCEPTION 'Marcacao de ponto e imutavel: nao pode ser apagada (Sumula 338 / Portaria 671). Use correcao por acrescimo.';
  END IF;

  RAISE EXCEPTION 'Operação de exclusão não permitida para registros de ponto. Tentativa registrada.';
  RETURN NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2) Remove o e-mail real hardcoded (backdoor + LGPD).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pode_excluir_registro_ponto(_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR _tenant_id IS NULL THEN
    RETURN false;
  END IF;
  IF public.has_minimum_role(auth.uid(), 'manager'::public.app_role)
     OR public.has_role(auth.uid(), 'superadmin'::public.app_role) THEN
    RETURN true;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.usuarios_base ub
    WHERE ub.auth_user_id = auth.uid() AND ub.tenant_id = _tenant_id
      AND ub.status::text = 'ativo'
      AND ub.tipo_usuario::text IN ('administrador', 'gestor')
  ) THEN
    RETURN true;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.usuario_vinculos uv
    JOIN public.usuarios_base ub ON ub.id = uv.usuario_id
    WHERE ub.auth_user_id = auth.uid() AND uv.tenant_id = _tenant_id
      AND uv.status::text = 'ativo'
      AND uv.tipo_vinculo::text IN ('administrador', 'gestor')
  ) THEN
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3) QA PONTO-004 — atualiza a nota de risco. Se o motor de QA não existir
--    neste banco, apenas avisa e segue (não aborta o script).
-- ---------------------------------------------------------------------------
DO $prodqa$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'qa_retorno'
  ) THEN
    RAISE NOTICE 'Motor de QA nao instalado neste banco: qa_caso_ponto_004 ignorado.';
    RETURN;
  END IF;

  EXECUTE $qa004$
  CREATE OR REPLACE FUNCTION public.qa_caso_ponto_004()
  RETURNS public.qa_retorno LANGUAGE plpgsql AS $body$
  DECLARE r public.qa_retorno; v_cpf text; v_id uuid;
          v_upd boolean := false; v_del boolean := false;
  BEGIN
    v_cpf := public.qa_ponto_admissao('QA Imutável', 5004);
    PERFORM public.qa_ponto_marca(v_cpf, 'QA Imutável', CURRENT_DATE - 1, TIME '08:00', 'entrada');
    SELECT id INTO v_id FROM public.ponto_marcacoes
    WHERE tenant_id = public.qa_sandbox_tenant_id() AND colaborador_cpf = v_cpf LIMIT 1;

    r.passo_ordem := 1;
    r.passo_acao := 'Tentar ALTERAR a hora da marcação original';
    r.esperado := 'Bloqueado pela imutabilidade';
    BEGIN
      UPDATE public.ponto_marcacoes SET hora_marcacao = TIME '07:00' WHERE id = v_id;
      v_upd := true;
    EXCEPTION WHEN OTHERS THEN v_upd := false; END;

    r.passo_ordem := 2;
    r.passo_acao := 'Tentar APAGAR a marcação original (sem privilégio de gestor)';
    r.esperado := 'Bloqueado';
    BEGIN
      DELETE FROM public.ponto_marcacoes WHERE id = v_id;
      v_del := NOT EXISTS (SELECT 1 FROM public.ponto_marcacoes WHERE id = v_id);
    EXCEPTION WHEN OTHERS THEN v_del := false; END;

    IF NOT v_upd AND NOT v_del THEN
      r.situacao := 'passou';
      r.obtido := 'Alteração e exclusão da marcação original foram bloqueadas. A exclusão direta '
               || 'por papel de gestão foi fechada e o e-mail hardcoded de exceção foi removido. '
               || 'Risco remanescente (fora desta rotina): os RPC excluir_marcacao_ponto e '
               || 'processar_ajuste_ponto (tipo "correcao") ainda apagam a marcação original pelo '
               || 'flag de sessão app.allow_ponto_delete — correção por substituição, não por acréscimo.';
    ELSE
      r.situacao := 'falhou';
      r.obtido := format('A marcação original foi %s — registro que se altera não prova nada '
               || '(Súmula 338; Portaria 671 veda a alteração).',
               CASE WHEN v_upd AND v_del THEN 'ALTERADA E APAGADA'
                    WHEN v_upd THEN 'ALTERADA' ELSE 'APAGADA' END);
    END IF;
    RETURN r;
  EXCEPTION WHEN OTHERS THEN
    r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
  END $body$;
  $qa004$;

  RAISE NOTICE 'qa_caso_ponto_004 atualizado.';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Nao foi possivel atualizar qa_caso_ponto_004: %', SQLERRM;
END
$prodqa$;

-- ---------------------------------------------------------------------------
-- Conferência (o SQL Editor mostra só o último resultado).
-- Esperado: true | true | true | 3 | 'OK'
-- ---------------------------------------------------------------------------
SELECT
  position('cafefrossard' in pg_get_functiondef('public.pode_excluir_registro_ponto(uuid)'::regprocedure)) = 0
    AS email_hardcoded_removido,
  position('Marcacao de ponto e imutavel' in pg_get_functiondef('public.bloquear_delete_ponto()'::regprocedure)) > 0
    AS marcacao_original_blindada,
  position('ponto_ajustes' in pg_get_functiondef('public.pode_excluir_registro_ponto(uuid)'::regprocedure)) = 0
    AND position('pode_excluir_registro_ponto' in pg_get_functiondef('public.bloquear_delete_ponto()'::regprocedure)) > 0
    AS exclusao_de_ajustes_preservada,
  (SELECT count(*) FROM pg_trigger tg
     WHERE NOT tg.tgisinternal
       AND tg.tgfoid = 'public.bloquear_delete_ponto()'::regprocedure) AS triggers_de_protecao,
  CASE
    WHEN position('cafefrossard' in pg_get_functiondef('public.pode_excluir_registro_ponto(uuid)'::regprocedure)) > 0
      THEN 'ERRO: e-mail hardcoded ainda presente'
    WHEN position('Marcacao de ponto e imutavel' in pg_get_functiondef('public.bloquear_delete_ponto()'::regprocedure)) = 0
      THEN 'ERRO: trava de imutabilidade nao aplicada'
    WHEN (SELECT count(*) FROM pg_trigger tg
            WHERE NOT tg.tgisinternal
              AND tg.tgfoid = 'public.bloquear_delete_ponto()'::regprocedure) < 3
      THEN 'ATENCAO: menos de 3 triggers de protecao montados'
    ELSE 'OK'
  END AS erro_tecnico;
