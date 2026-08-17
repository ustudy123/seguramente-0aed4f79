-- PONTO-004 — Marcação original é IMUTÁVEL (não pode ser alterada nem apagada).
-- Base legal: Portaria MTE 671/2021 (veda alterar/apagar marcações), CLT art. 74,
-- TST Súmula 338 (ônus da prova do empregador). Correção = ACRÉSCIMO (ponto_ajustes),
-- nunca substituição/exclusão do registro original.
--
-- Duas correções nesta migration:
--   1) Fecha a brecha: a exclusão direta de MARCAÇÃO (public.ponto_marcacoes) por PAPEL
--      (gestor/admin/superadmin) deixa de ser permitida no trigger. Continuam válidos
--      apenas os caminhos controlados do próprio sistema: cascata (pg_trigger_depth > 1)
--      e o flag de sessão de RPC autorizado (app.allow_ponto_delete).
--
--      IMPORTANTE — o mesmo trigger (public.bloquear_delete_ponto) também está montado
--      em public.ponto_ajustes e public.ponto_diario, que NÃO são a marcação original:
--        * ponto_ajustes  = os acréscimos (a própria correção auditável);
--        * ponto_diario   = consolidação derivada, recalculável a partir das marcações.
--      Tirar a regra de papéis dessas duas quebraria a exclusão de ajuste pela tela
--      (src/hooks/usePonto.ts → excluirAjuste faz DELETE direto em ponto_ajustes, e a
--      política RLS "Autorizados podem excluir ajustes de ponto" depende justamente de
--      pode_excluir_registro_ponto). Por isso a trava por papel passa a valer só para
--      a tabela da marcação original.
--
--   2) Remove o e-mail REAL hardcoded (backdoor de exclusão + violação de LGPD: dado
--      pessoal real no código) de pode_excluir_registro_ponto. A função permanece para
--      os usos legítimos (exclusão de AJUSTES de ponto, que são acréscimos).

-- 1) Trigger de proteção contra exclusão da marcação original.
CREATE OR REPLACE FUNCTION public.bloquear_delete_ponto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Permitir deletes em cascata acionados por outras triggers do sistema (integridade referencial).
  IF pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;

  -- Permitir quando um RPC autorizado seta explicitamente o flag de sessão (caminho controlado).
  IF current_setting('app.allow_ponto_delete', true) = 'true' THEN
    RETURN OLD;
  END IF;

  -- Fora da marcação original, a regra de papéis continua valendo (ajustes e consolidação).
  IF TG_TABLE_NAME <> 'ponto_marcacoes'
     AND public.pode_excluir_registro_ponto(OLD.tenant_id) THEN
    RETURN OLD;
  END IF;

  -- A marcação ORIGINAL é imutável: ninguém (inclusive gestor/admin/empregador) a apaga direto.
  -- Correção deve ser feita por ACRÉSCIMO (ponto_ajustes). Registra a tentativa para auditoria.
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

-- 2) Remove o e-mail real hardcoded (backdoor + LGPD). Mantém a regra de papéis para os
--    demais usos legítimos da função (ela ainda gate a exclusão de AJUSTES de ponto).
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
    SELECT 1
    FROM public.usuarios_base ub
    WHERE ub.auth_user_id = auth.uid()
      AND ub.tenant_id = _tenant_id
      AND ub.status::text = 'ativo'
      AND ub.tipo_usuario::text IN ('administrador', 'gestor')
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.usuario_vinculos uv
    JOIN public.usuarios_base ub ON ub.id = uv.usuario_id
    WHERE ub.auth_user_id = auth.uid()
      AND uv.tenant_id = _tenant_id
      AND uv.status::text = 'ativo'
      AND uv.tipo_vinculo::text IN ('administrador', 'gestor')
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- 3) QA PONTO-004 — a nota de risco da rotina descrevia a brecha fechada acima.
--    Atualiza o texto para refletir o que ficou fechado e o que AINDA está aberto
--    (a rotina continua somente leitura e continua testando os mesmos dois passos).
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_004()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
END $$;
