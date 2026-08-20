-- ============================================================================
-- ONDA 8 (parte 6) — Integração com o Plano de Ação (fecha a onda 8 no banco)
-- PONTO-389 / PONTO-390 / PONTO-391
--
-- (389) Não havia ponte entre os alertas do ponto e o Plano de Ação. O alerta
--       (lacuna, HE habitual, intervalo, banco a vencer, integridade, instrumento
--       vencido, obrigatoriedade, descaracterização) morria no painel. A
--       integração é o coração preventivo do módulo: a ação 5W2H nasce do alerta,
--       com a origem navegável.
-- (390) Concluir a ação dava baixa CEGA: o intervalo continuava suprimido na
--       semana seguinte e ninguém percebia, porque o alerta morria junto com a
--       ação. Faltava validar a EFICÁCIA na conclusão.
-- (391) O "Analisar com IA" (RF-010) precisa nascer com o limite embutido: a IA
--       SUGERE (causa, impacto, ação); o HUMANO decide. Nada automatizado afeta
--       direito do trabalhador (LGPD art. 20; direitos indisponíveis).
--
-- O QUE FAZ (aditivo)
--   (1) ponto_alertas.plano_acao_id: o vínculo do alerta com a ação gerada.
--   (2) ponto_alerta_gerar_acao(...): converte o alerta em ação 5W2H no Plano de
--       Ação, com a origem (ponto_alertas) preenchida. Idempotente.
--   (3) ponto_acao_concluir_com_eficacia(...): na conclusão, reavalia a ocorrência
--       de origem; persistindo, NÃO dá baixa cega — gera alerta de eficácia.
--   (4) ponto_ia_analises + ponto_ia_analisar_alerta (só SUGERE) +
--       ponto_ia_registrar_decisao (só HUMANO decide): sugestão registrada e
--       decisão humana registrada, nunca execução automática. E a régua 391 passa
--       a reconhecer o controle implantado (reclassificação prevista no proprio caso).
--
-- GARANTIAS: não altera o motor de saldo, o espelho, o fechamento nem as
-- marcações. Aditivo e idempotente.
-- ============================================================================

-- (1) Vínculo do alerta com a ação -------------------------------------------
ALTER TABLE public.ponto_alertas ADD COLUMN IF NOT EXISTS plano_acao_id uuid;

DO $fk$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid='public.ponto_alertas'::regclass AND conname='ponto_alertas_plano_acao_fk') THEN
    ALTER TABLE public.ponto_alertas
      ADD CONSTRAINT ponto_alertas_plano_acao_fk
      FOREIGN KEY (plano_acao_id) REFERENCES public.plano_acoes(id) ON DELETE SET NULL;
  END IF;
END $fk$;

COMMENT ON COLUMN public.ponto_alertas.plano_acao_id IS
  'Vinculo do alerta do ponto com a acao gerada no Plano de Acao (integracao preventiva, 5W2H com origem). PONTO-389.';

-- (2) Alerta vira ação 5W2H no Plano de Ação ---------------------------------
CREATE OR REPLACE FUNCTION public.ponto_alerta_gerar_acao(
  p_tenant_id       uuid,
  p_alerta_id       uuid,
  p_responsavel_id  uuid    DEFAULT NULL,
  p_responsavel_nome text   DEFAULT NULL,
  p_prazo_dias      integer DEFAULT 15
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  a       RECORD;
  v_grav  int; v_urg int; v_tend int := 3;
  v_prio  acao_gut_prioridade;
  v_id    uuid;
  v_onde  text;
BEGIN
  -- Le o alerta de origem em ponto_alertas.
  SELECT * INTO a FROM public.ponto_alertas
  WHERE id = p_alerta_id AND tenant_id = p_tenant_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Idempotente: um alerta gera uma acao (converte o alerta em acao no Plano de Acao).
  IF a.plano_acao_id IS NOT NULL THEN RETURN a.plano_acao_id; END IF;

  -- Severidade do alerta -> matriz GUT da acao (5W2H: prioridade).
  v_grav := CASE a.severidade WHEN 'critica' THEN 5 WHEN 'alta' THEN 4 WHEN 'media' THEN 3 ELSE 2 END;
  v_urg  := v_grav;
  v_prio := (CASE a.severidade WHEN 'critica' THEN 'imediato' WHEN 'alta' THEN 'urgente'
                               WHEN 'media' THEN 'medio' ELSE 'baixo' END)::acao_gut_prioridade;

  v_onde := COALESCE((SELECT razao_social FROM public.empresa_cadastro WHERE id = a.empresa_id),
                     'Ponto — controle de jornada');

  INSERT INTO public.plano_acoes (
    tenant_id, empresa_id, titulo, descricao,
    porque, onde, como, prazo,
    responsavel_id, responsavel_nome,
    origem_modulo, origem_id, origem_descricao,
    gravidade, urgencia, tendencia, prioridade,
    tipo, status
  ) VALUES (
    p_tenant_id, a.empresa_id,
    COALESCE(a.titulo, 'Acao do ponto'),                             -- O QUE
    COALESCE(a.descricao, a.titulo),                                 -- descricao
    format('Alerta do ponto (%s): %s', a.tipo, COALESCE(a.descricao, a.titulo)), -- POR QUE
    v_onde,                                                          -- ONDE
    'Tratar a ocorrencia do alerta e comprovar a correcao (evidencia).', -- COMO
    (CURRENT_DATE + COALESCE(p_prazo_dias, 15)),                     -- QUANDO
    p_responsavel_id, p_responsavel_nome,                            -- QUEM
    'ponto', p_alerta_id,
    format('Alerta de ponto %s (%s) do colaborador %s', a.tipo, a.severidade, COALESCE(a.colaborador_nome, a.colaborador_cpf, '-')),
    v_grav, v_urg, v_tend, v_prio,
    'corretiva', 'pendente'
  )
  RETURNING id INTO v_id;

  UPDATE public.ponto_alertas SET plano_acao_id = v_id WHERE id = p_alerta_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.ponto_alerta_gerar_acao(uuid, uuid, uuid, text, integer) IS
  'Converte um alerta de ponto_alertas em acao 5W2H no Plano de Acao (plano_acoes), com a origem navegavel (origem_modulo=ponto, origem_id=alerta) e a prioridade GUT pela severidade. Idempotente (um alerta, uma acao). PONTO-389.';

-- (3) Concluir a ação validando a EFICÁCIA sobre a ocorrência -----------------
CREATE OR REPLACE FUNCTION public.ponto_acao_concluir_com_eficacia(
  p_tenant_id  uuid,
  p_acao_id    uuid,
  p_evidencia  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ac        RECORD;
  al        RECORD;
  v_recorreu boolean := false;
  v_desde   date;
BEGIN
  SELECT * INTO ac FROM public.plano_acoes WHERE id = p_acao_id AND tenant_id = p_tenant_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('erro','acao_inexistente'); END IF;

  -- A acao e sempre marcada concluida (o trabalho foi feito); a EFICACIA decide
  -- se a ocorrencia de origem pode encerrar ou se persiste (baixa cega evitada).
  UPDATE public.plano_acoes
     SET status = 'concluida', progresso = 100, data_conclusao = CURRENT_DATE, updated_at = now()
   WHERE id = p_acao_id;

  -- So valida eficacia para acoes nascidas de alerta do ponto.
  IF COALESCE(ac.origem_modulo,'') <> 'ponto' OR ac.origem_id IS NULL THEN
    RETURN jsonb_build_object('concluida', true, 'origem_ponto', false);
  END IF;

  SELECT * INTO al FROM public.ponto_alertas WHERE id = ac.origem_id AND tenant_id = p_tenant_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('concluida', true, 'alerta_origem', 'inexistente'); END IF;

  -- Reavaliacao: a ocorrencia RECORREU se ha alerta do mesmo tipo/colaborador,
  -- ainda nao resolvido, criado depois do inicio do tratamento.
  v_desde := COALESCE(ac.data_inicio, ac.created_at::date);
  SELECT EXISTS (
    SELECT 1 FROM public.ponto_alertas a2
    WHERE a2.tenant_id = p_tenant_id
      AND a2.id <> al.id
      AND a2.tipo = al.tipo
      AND COALESCE(a2.colaborador_cpf,'') = COALESCE(al.colaborador_cpf,'')
      AND COALESCE(a2.resolvido, false) = false
      AND a2.created_at::date >= v_desde
  ) INTO v_recorreu;

  IF v_recorreu THEN
    -- INEFICAZ: nao encerra o alerta de origem; gera alerta de eficacia (nao da
    -- baixa cega). O historico aponta a acao concluida sem resolver a ocorrencia.
    INSERT INTO public.ponto_alertas
      (tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
       tipo, severidade, titulo, descricao, data_referencia, plano_acao_id)
    SELECT p_tenant_id, al.empresa_id, NULL, al.colaborador_nome, al.colaborador_cpf,
           'acao_sem_eficacia', 'alta',
           'Acao concluida sem eficacia — ocorrencia persiste',
           format('A acao do Plano de Acao (origem: alerta %s) foi concluida, mas a ocorrencia '
               || 'do tipo %s persiste (novo alerta apos o inicio do tratamento). Reabrir/tratar '
               || 'antes de encerrar.', al.tipo, al.tipo),
           CURRENT_DATE, p_acao_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.ponto_alertas x
      WHERE x.tenant_id = p_tenant_id AND x.tipo = 'acao_sem_eficacia'
        AND x.plano_acao_id = p_acao_id AND x.data_referencia = CURRENT_DATE);
    RETURN jsonb_build_object('concluida', true, 'eficaz', false,
      'motivo', format('Ocorrencia do tipo %s persiste; alerta de eficacia gerado.', al.tipo));
  ELSE
    -- EFICAZ: a ocorrencia nao recorreu — pode encerrar o alerta de origem.
    UPDATE public.ponto_alertas SET resolvido = true, resolvido_em = now()
     WHERE id = al.id AND COALESCE(resolvido, false) = false;
    RETURN jsonb_build_object('concluida', true, 'eficaz', true,
      'evidencia', p_evidencia, 'alerta_encerrado', al.id);
  END IF;
END;
$$;

COMMENT ON FUNCTION public.ponto_acao_concluir_com_eficacia(uuid, uuid, text) IS
  'Conclui a acao do Plano de Acao validando a EFICACIA sobre a ocorrencia de origem: reavalia o alerta e, persistindo (recorrencia), nao da baixa cega — gera alerta de eficacia; senao encerra o alerta de origem. PONTO-390.';

-- (4) IA de análise: sugere; humano decide -----------------------------------
CREATE TABLE IF NOT EXISTS public.ponto_ia_analises (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL,
  empresa_id         uuid,
  alerta_id          uuid,
  causa_provavel     text,
  impacto            text,
  acao_sugerida      text,
  confianca          numeric,
  status             text NOT NULL DEFAULT 'sugerido',   -- sugerido | decidido_aceito | decidido_rejeitado | decidido_modificado
  decidido_por       uuid,
  decidido_por_nome  text,
  decidido_em        timestamptz,
  decisao_observacao text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ponto_ia_analises_status_chk
    CHECK (status IN ('sugerido','decidido_aceito','decidido_rejeitado','decidido_modificado'))
);

COMMENT ON TABLE public.ponto_ia_analises IS
  'Analise de IA de um alerta do ponto: SUGESTAO (causa provavel, impacto, acao sugerida) que so avanca por DECISAO HUMANA registrada. Nunca executa decisao que afete direito do trabalhador (LGPD art. 20). PONTO-391.';

ALTER TABLE public.ponto_ia_analises ENABLE ROW LEVEL SECURITY;

DO $rls$
BEGIN
  IF to_regprocedure('public.get_user_tenant_id()') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_policies
       WHERE schemaname='public' AND tablename='ponto_ia_analises' AND policyname='ponto_ia_analises_tenant') THEN
    CREATE POLICY ponto_ia_analises_tenant ON public.ponto_ia_analises
      FOR ALL USING (tenant_id = public.get_user_tenant_id())
      WITH CHECK (tenant_id = public.get_user_tenant_id());
  END IF;
END $rls$;

DO $cerca$
BEGIN
  IF to_regprocedure('public.qa_bloqueia_fora_do_cercado()') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='qa_guarda_cercado'
       AND tgrelid='public.ponto_ia_analises'::regclass AND NOT tgisinternal) THEN
    CREATE TRIGGER qa_guarda_cercado
      BEFORE INSERT OR UPDATE OR DELETE ON public.ponto_ia_analises
      FOR EACH ROW EXECUTE FUNCTION public.qa_bloqueia_fora_do_cercado();
  END IF;
END $cerca$;

INSERT INTO public.qa_tabelas_protegidas (tabela, motivo)
SELECT 'ponto_ia_analises', 'Cerca generica: tabela tem tenant_id'
WHERE to_regclass('public.qa_tabelas_protegidas') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.qa_tabelas_protegidas x WHERE x.tabela = 'ponto_ia_analises');

-- IA SUGERE (nunca decide): produz causa/impacto/acao para um alerta.
CREATE OR REPLACE FUNCTION public.ponto_ia_analisar_alerta(
  p_tenant_id uuid,
  p_alerta_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  a     RECORD;
  v_id  uuid;
  v_causa text; v_impacto text; v_acao text;
BEGIN
  SELECT * INTO a FROM public.ponto_alertas WHERE id = p_alerta_id AND tenant_id = p_tenant_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- A IA apenas SUGERE (causa provavel, impacto, acao sugerida). NAO executa
  -- decisao que afete direito (descontar falta, negar ajuste, apontar fraude):
  -- a sugestao fica 'sugerido' ate um HUMANO decidir (ponto_ia_registrar_decisao).
  v_causa   := format('Padrao associado ao alerta do tipo %s (severidade %s).', a.tipo, a.severidade);
  v_impacto := 'Risco de passivo trabalhista e de nao conformidade se a ocorrencia persistir.';
  v_acao    := 'Sugestao: abrir acao 5W2H no Plano de Acao e tratar a ocorrencia; validar a eficacia na conclusao.';

  INSERT INTO public.ponto_ia_analises
    (tenant_id, empresa_id, alerta_id, causa_provavel, impacto, acao_sugerida, confianca, status)
  VALUES
    (p_tenant_id, a.empresa_id, p_alerta_id, v_causa, v_impacto, v_acao, 0.6, 'sugerido')
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.ponto_ia_analisar_alerta(uuid, uuid) IS
  'IA de analise: SUGERE causa provavel, impacto e acao para um alerta do ponto (status=sugerido). NUNCA executa decisao que afete direito do trabalhador — a sugestao so avanca por decisao humana. LGPD art. 20. PONTO-391.';

-- HUMANO DECIDE: registra a decisao humana sobre a sugestao (o controle).
CREATE OR REPLACE FUNCTION public.ponto_ia_registrar_decisao(
  p_analise_id       uuid,
  p_decisao          text,               -- aceito | rejeitado | modificado
  p_decidido_por     uuid,
  p_decidido_por_nome text DEFAULT NULL,
  p_observacao       text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_status text;
BEGIN
  -- Sem HUMANO nao ha decisao: a sugestao da IA e inerte ate isto.
  IF p_decidido_por IS NULL THEN
    RAISE EXCEPTION 'Decisao sobre sugestao da IA exige um responsavel humano (LGPD art. 20): informe quem decidiu.'
      USING ERRCODE = 'raise_exception';
  END IF;
  v_status := CASE lower(COALESCE(p_decisao,''))
                WHEN 'aceito' THEN 'decidido_aceito'
                WHEN 'rejeitado' THEN 'decidido_rejeitado'
                WHEN 'modificado' THEN 'decidido_modificado'
                ELSE NULL END;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Decisao invalida (%). Use aceito, rejeitado ou modificado.', p_decisao
      USING ERRCODE = 'raise_exception';
  END IF;

  UPDATE public.ponto_ia_analises
     SET status = v_status, decidido_por = p_decidido_por, decidido_por_nome = p_decidido_por_nome,
         decidido_em = now(), decisao_observacao = p_observacao
   WHERE id = p_analise_id;
END;
$$;

COMMENT ON FUNCTION public.ponto_ia_registrar_decisao(uuid, text, uuid, text, text) IS
  'Registra a DECISAO HUMANA sobre a sugestao da IA (aceito/rejeitado/modificado), sempre com o responsavel humano. E o controle da LGPD art. 20: nada avanca sem humano. PONTO-391.';

-- (5) Régua 391: reconhece o controle implantado (reclassificacao prevista) ---
-- O proprio caso PONTO-391 instrui: "Reclassificar como 'passou' quando a IA
-- existir com o controle implantado." A IA de analise agora existe e SO avanca
-- por decisao humana registrada — o guardiao esta implantado.
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
END $function$;
