-- =====================================================================
-- ENTREGA · Aprovar ajuste de ponto volta a funcionar
--
-- COLE ESTE ARQUIVO INTEIRO no SQL Editor do projeto de PRODUÇÃO
-- (diayjpsrcerycycyaxst) e clique em Run. Uma execução só.
--
-- O QUE ELE CONSERTA
-- Em 07/08 a rotina que aprova ajustes de ponto foi reescrita e, no meio
-- da reescrita, o trecho que grava a batida passou a usar nomes de coluna
-- que não existem na tabela. Toda aprovação de inclusão/correção de
-- batida quebrava com:
--   column "data_hora" of relation "ponto_marcacoes" does not exist
-- Junto vieram outros três defeitos (chamada de abono com número errado
-- de argumentos, perda das travas de segurança do apagamento e da
-- duplicidade, e o conflito entre a reordenação automática de rótulos e a
-- trava de imutabilidade). Os quatro são corrigidos aqui.
--
-- O QUE ELE NÃO MEXE
-- A regra de segregação de funções da Portaria 671 criada no mesmo dia
-- 07/08 (ninguém aprova o próprio ponto; auto-lançamento exige
-- justificativa) fica intacta, palavra por palavra. Nenhuma marcação
-- existente é alterada, apagada ou recalculada por este script — ele
-- troca apenas o código de três rotinas.
--
-- SEGURO RODAR DUAS VEZES: só substitui definições de função.
-- =====================================================================

SET lock_timeout = '10s';


CREATE OR REPLACE FUNCTION public.processar_ajuste_ponto(p_ajuste_id uuid, p_aprovado boolean, p_observacao text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_ajuste public.ponto_ajustes%ROWTYPE;
  v_has_access boolean := false;
  v_is_gestor boolean := false;
  v_vinculo_role text;
  v_aprovador_nome text;
  v_aprovador_cpf text;
  v_auto_lancado boolean := false;
  v_just_tipo_abono text;
  v_just_nome text;
  v_deve_abonar boolean := false;
  v_colab_uuid uuid;
  v_tipo text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO v_ajuste FROM public.ponto_ajustes WHERE id = p_ajuste_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ajuste não encontrado'; END IF;
  IF v_ajuste.status <> 'pendente' THEN RAISE EXCEPTION 'Este ajuste já foi processado'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.usuarios_base ub
    WHERE ub.auth_user_id = v_uid AND ub.tenant_id = v_ajuste.tenant_id AND ub.status = 'ativo'
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    SELECT uv.tipo_vinculo::text INTO v_vinculo_role
    FROM public.usuario_vinculos uv
    JOIN public.usuarios_base ub2 ON ub2.id = uv.usuario_id
    WHERE ub2.auth_user_id = v_uid
      AND uv.tenant_id = v_ajuste.tenant_id
      AND uv.status = 'ativo'
      AND (uv.data_fim IS NULL OR uv.data_fim >= CURRENT_DATE)
    LIMIT 1;
    IF v_vinculo_role IS NOT NULL THEN
      v_has_access := true;
      v_is_gestor := v_vinculo_role IN ('gestor','administrador','proprietario','rh');
    END IF;
  END IF;

  IF NOT v_has_access THEN
    SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = v_uid AND p.tenant_id = v_ajuste.tenant_id) INTO v_has_access;
  END IF;
  IF NOT v_has_access THEN RAISE EXCEPTION 'Sem acesso a este tenant'; END IF;

  IF NOT v_is_gestor THEN
    v_is_gestor :=
      public.has_role(v_uid, 'manager'::public.app_role)
      OR public.has_role(v_uid, 'admin'::public.app_role)
      OR public.has_role(v_uid, 'owner'::public.app_role)
      OR public.has_role(v_uid, 'superadmin'::public.app_role);
  END IF;

  IF NOT v_is_gestor THEN
    SELECT EXISTS (
      SELECT 1 FROM public.usuarios_base ub3
      WHERE ub3.auth_user_id = v_uid AND ub3.tipo_usuario IN ('gestor','administrador','proprietario','rh')
    ) INTO v_is_gestor;
  END IF;

  IF NOT v_is_gestor THEN RAISE EXCEPTION 'Apenas gestor/RH pode processar ajustes de ponto'; END IF;

  SELECT nome_completo, regexp_replace(COALESCE(cpf,''), '\D', '', 'g')
    INTO v_aprovador_nome, v_aprovador_cpf
  FROM public.usuarios_base
  WHERE auth_user_id = v_uid AND tenant_id = v_ajuste.tenant_id
  LIMIT 1;
  IF v_aprovador_nome IS NULL THEN
    SELECT nome_completo INTO v_aprovador_nome FROM public.profiles WHERE user_id = v_uid LIMIT 1;
  END IF;

  -- =========================================================
  -- Bloco 3 — Segregação de funções (MTP 671 / auditoria)
  -- 1) Ninguém aprova ajuste do PRÓPRIO ponto.
  -- 2) Quem lançou o ajuste e aprova o mesmo ajuste precisa
  --    justificar (observação >= 10 caracteres) e o registro
  --    fica marcado como auto-lançamento.
  -- =========================================================
  IF COALESCE(v_aprovador_cpf, '') <> ''
     AND regexp_replace(COALESCE(v_ajuste.colaborador_cpf,''), '\D', '', 'g') = v_aprovador_cpf THEN
    RAISE EXCEPTION 'Segregação de funções: não é permitido aprovar ou rejeitar ajuste do próprio ponto. Outro gestor/RH deve analisar.';
  END IF;

  v_auto_lancado := (v_ajuste.created_by IS NOT NULL AND v_ajuste.created_by = v_uid);

  IF v_auto_lancado AND p_aprovado AND length(COALESCE(btrim(p_observacao), '')) < 10 THEN
    RAISE EXCEPTION 'Você foi quem solicitou este ajuste. Informe uma observação de aprovação com no mínimo 10 caracteres justificando o auto-lançamento.';
  END IF;

  UPDATE public.ponto_ajustes
  SET status = CASE WHEN p_aprovado THEN 'aprovado' ELSE 'rejeitado' END,
      aprovado_por = v_uid,
      aprovado_por_nome = v_aprovador_nome,
      data_aprovacao = now(),
      observacao_aprovador = p_observacao,
      auto_lancado = v_auto_lancado
  WHERE id = p_ajuste_id;

  IF v_auto_lancado THEN
    BEGIN
      INSERT INTO public.audit_logs (tenant_id, user_id, acao, entidade, entidade_id, detalhes)
      VALUES (
        v_ajuste.tenant_id, v_uid,
        CASE WHEN p_aprovado THEN 'ajuste_ponto_auto_aprovado' ELSE 'ajuste_ponto_auto_rejeitado' END,
        'ponto_ajustes', p_ajuste_id,
        jsonb_build_object(
          'colaborador_cpf', v_ajuste.colaborador_cpf,
          'data_referencia', v_ajuste.data_referencia,
          'observacao', p_observacao,
          'aprovador_nome', v_aprovador_nome
        )
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  IF p_aprovado AND v_ajuste.justificativa_id IS NOT NULL THEN
    SELECT tipo_abono, nome INTO v_just_tipo_abono, v_just_nome
    FROM public.ponto_justificativas WHERE id = v_ajuste.justificativa_id;
    v_deve_abonar := (v_just_tipo_abono = 'sim')
      OR (v_just_tipo_abono = 'configuravel' AND COALESCE(v_ajuste.abonar_se_aprovado, false));
    IF v_deve_abonar THEN
      BEGIN v_colab_uuid := v_ajuste.colaborador_id::uuid;
      EXCEPTION WHEN OTHERS THEN v_colab_uuid := NULL;
      END;
    END IF;
  END IF;

  IF NOT p_aprovado OR v_ajuste.tipo_ajuste IN ('justificativa', 'abono') THEN
    IF v_deve_abonar AND v_colab_uuid IS NOT NULL AND COALESCE(v_ajuste.dia_inteiro, false) THEN
      PERFORM public._ponto_gera_batidas_dia_inteiro(
        v_ajuste.tenant_id, v_colab_uuid, v_ajuste.colaborador_nome,
        v_ajuste.colaborador_cpf, v_ajuste.data_referencia, v_ajuste.id, v_uid
      );
    END IF;
    PERFORM public.consolidar_ponto_diario_manual(v_ajuste.tenant_id, v_ajuste.colaborador_cpf, v_ajuste.data_referencia);
    IF v_deve_abonar AND v_colab_uuid IS NOT NULL THEN
      PERFORM public._ponto_grava_abono(
        v_ajuste.tenant_id, v_colab_uuid, v_ajuste.colaborador_nome,
        v_ajuste.colaborador_cpf, v_ajuste.data_referencia,
        COALESCE(v_just_nome, v_ajuste.motivo)
      );
    END IF;
    BEGIN
      PERFORM public.apurar_banco_horas_colaborador(
        v_ajuste.tenant_id, v_ajuste.colaborador_cpf, to_char(v_ajuste.data_referencia, 'YYYY-MM')
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    RETURN jsonb_build_object('success', true, 'auto_lancado', v_auto_lancado);
  END IF;

  -- ── Ajustes de marcação (inclusão / correção) ────────────────────────
  -- Colunas reais da tabela: data_marcacao (date) + hora_marcacao (time) +
  -- tipo_marcacao. Lógica restaurada da versão de 24/07, que traz as travas
  -- construídas ao longo de meses de correções.
  v_tipo := COALESCE(v_ajuste.tipo_marcacao, 'batida');
  IF v_tipo = 'saida_almoco'   THEN v_tipo := 'saida';   END IF;
  IF v_tipo = 'retorno_almoco' THEN v_tipo := 'entrada'; END IF;

  -- CORREÇÃO SEGURA: só apaga quando é correção COM hora_original explícita.
  -- Sem essa trava, uma inclusão apagaria em massa as batidas do mesmo tipo
  -- no dia (problema real já vivido neste sistema).
  IF v_ajuste.tipo_ajuste = 'correcao' AND v_ajuste.hora_original IS NOT NULL THEN
    PERFORM set_config('app.allow_ponto_delete', 'true', true);
    DELETE FROM public.ponto_marcacoes
    WHERE tenant_id = v_ajuste.tenant_id
      AND colaborador_cpf = v_ajuste.colaborador_cpf
      AND data_marcacao = v_ajuste.data_referencia
      AND to_char(hora_marcacao, 'HH24:MI') = to_char(v_ajuste.hora_original, 'HH24:MI');
    PERFORM set_config('app.allow_ponto_delete', 'false', true);
  END IF;

  -- Não duplica se a batida solicitada já existir no minuto.
  IF v_ajuste.hora_solicitada IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.ponto_marcacoes
    WHERE tenant_id = v_ajuste.tenant_id
      AND colaborador_cpf = v_ajuste.colaborador_cpf
      AND data_marcacao = v_ajuste.data_referencia
      AND tipo_marcacao = v_tipo
      AND to_char(hora_marcacao, 'HH24:MI') = to_char(v_ajuste.hora_solicitada, 'HH24:MI')
  ) THEN
    INSERT INTO public.ponto_marcacoes (
      tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
      data_marcacao, hora_marcacao, tipo_marcacao, marcacao_original, created_by, hash_marcacao
    ) VALUES (
      v_ajuste.tenant_id, v_ajuste.empresa_id, v_ajuste.colaborador_id,
      v_ajuste.colaborador_nome, v_ajuste.colaborador_cpf,
      v_ajuste.data_referencia, v_ajuste.hora_solicitada, v_tipo, false, v_uid,
      'AJUSTE-' || p_ajuste_id
    );
  END IF;

  PERFORM public.consolidar_ponto_diario_manual(v_ajuste.tenant_id, v_ajuste.colaborador_cpf, v_ajuste.data_referencia);
  BEGIN
    PERFORM public.apurar_banco_horas_colaborador(
      v_ajuste.tenant_id, v_ajuste.colaborador_cpf, to_char(v_ajuste.data_referencia, 'YYYY-MM')
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true, 'auto_lancado', v_auto_lancado);
END;
$function$;
-- =====================================================================
-- Defeito 4 — a reordenação automática de rótulos contra a trava de
-- imutabilidade da marcação
--
-- O tipo entrada/saída é congelado no momento da gravação. Quando entra
-- uma batida em horário ANTERIOR às já existentes (exatamente o caso de
-- um ajuste retroativo aprovado), a paridade das seguintes vira e o
-- sistema precisa reetiquetar o dia — só o RÓTULO, nunca o horário.
-- Desde 07/08 esse UPDATE de rótulo era barrado pela trava de
-- imutabilidade, derrubando a aprovação inteira.
--
-- A trava está certa e continua valendo: o que a Portaria 671 protege é
-- o HORÁRIO registrado. Damos à reordenação um contexto próprio, mais
-- estreito que o da retificação: com app.ponto_reordena ligado, só a
-- coluna tipo_marcacao pode mudar; qualquer outra alteração continua
-- levantando a exceção, inclusive dentro do contexto.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.ponto_bloquear_update_marcacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_reordena boolean := coalesce(current_setting('app.ponto_reordena', true), 'off') = 'on';
BEGIN
  -- Retificação oficial (com justificativa registrada): passa direto.
  IF coalesce(current_setting('app.ponto_retificacao', true), 'off') = 'on' THEN
    RETURN NEW;
  END IF;

  -- Reordenação automática de rótulos: libera SOMENTE tipo_marcacao.
  IF v_reordena
     AND NEW.hora_marcacao       IS NOT DISTINCT FROM OLD.hora_marcacao
     AND NEW.data_marcacao       IS NOT DISTINCT FROM OLD.data_marcacao
     AND NEW.colaborador_cpf     IS NOT DISTINCT FROM OLD.colaborador_cpf
     AND NEW.colaborador_id      IS NOT DISTINCT FROM OLD.colaborador_id
     AND NEW.marcacao_original   IS NOT DISTINCT FROM OLD.marcacao_original
  THEN
    RETURN NEW;
  END IF;

  IF NEW.hora_marcacao IS DISTINCT FROM OLD.hora_marcacao
     OR NEW.data_marcacao IS DISTINCT FROM OLD.data_marcacao
     OR NEW.tipo_marcacao IS DISTINCT FROM OLD.tipo_marcacao
     OR NEW.colaborador_cpf IS DISTINCT FROM OLD.colaborador_cpf
     OR NEW.colaborador_id IS DISTINCT FROM OLD.colaborador_id
     OR NEW.marcacao_original IS DISTINCT FROM OLD.marcacao_original
  THEN
    RAISE EXCEPTION 'Marcação original é imutável (Portaria MTP 671/2021). Use a retificação com justificativa.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- Reordenador: mesma regra de sempre (só reordena jornada limpa, nº PAR
-- de batidas e nenhum intervalo abaixo de 15 min), agora executando
-- dentro do contexto que a trava reconhece — e deixando rastro no log de
-- auditoria do ponto, porque toda mudança de rótulo precisa ser
-- explicável na fiscalização.
CREATE OR REPLACE FUNCTION public.ponto_reordena_tipos_dia(
  p_tenant_id uuid, p_colaborador_cpf text, p_data date
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_n       int;
  v_min_gap numeric;
  v_changed uuid[];
  v_id      uuid;
  v_antes   jsonb;
BEGIN
  SELECT count(*), min(gap) INTO v_n, v_min_gap
  FROM (
    SELECT EXTRACT(EPOCH FROM (
             hora_marcacao - lag(hora_marcacao) OVER (ORDER BY hora_marcacao, created_at)
           )) / 60 AS gap
    FROM public.ponto_marcacoes
    WHERE tenant_id = p_tenant_id
      AND colaborador_cpf = p_colaborador_cpf
      AND data_marcacao = p_data
  ) s;

  IF v_n IS NULL OR v_n = 0
     OR v_n % 2 = 1
     OR (v_min_gap IS NOT NULL AND v_min_gap < 15) THEN
    RETURN false;
  END IF;

  -- Retrato de antes, para o log de auditoria.
  SELECT jsonb_agg(jsonb_build_object('hora', hora_marcacao, 'tipo', tipo_marcacao)
                   ORDER BY hora_marcacao)
    INTO v_antes
  FROM public.ponto_marcacoes
  WHERE tenant_id = p_tenant_id
    AND colaborador_cpf = p_colaborador_cpf
    AND data_marcacao = p_data;

  PERFORM set_config('app.ponto_reordena', 'on', true);

  WITH reord AS (
    SELECT id, row_number() OVER (ORDER BY hora_marcacao, created_at) AS pos
    FROM public.ponto_marcacoes
    WHERE tenant_id = p_tenant_id
      AND colaborador_cpf = p_colaborador_cpf
      AND data_marcacao = p_data
  ), upd AS (
    UPDATE public.ponto_marcacoes m
    SET    tipo_marcacao = CASE WHEN r.pos % 2 = 1 THEN 'entrada' ELSE 'saida' END
    FROM   reord r
    WHERE  m.id = r.id
      AND  m.tipo_marcacao IS DISTINCT FROM
           (CASE WHEN r.pos % 2 = 1 THEN 'entrada' ELSE 'saida' END)
    RETURNING m.id
  )
  SELECT array_agg(id) INTO v_changed FROM upd;

  PERFORM set_config('app.ponto_reordena', 'off', true);

  IF v_changed IS NOT NULL THEN
    FOREACH v_id IN ARRAY v_changed LOOP
      BEGIN
        PERFORM public.classificar_marcacao_clt(v_id);
      EXCEPTION WHEN OTHERS THEN
        NULL;  -- classificação CLT é auxiliar; nunca quebra o fluxo
      END;
    END LOOP;

    BEGIN
      INSERT INTO public.ponto_audit_log (
        tenant_id, tabela_origem, registro_id, acao,
        dados_anteriores, dados_novos, usuario_id
      )
      SELECT p_tenant_id, 'ponto_marcacoes', v_changed[1], 'AJUSTE',
             jsonb_build_object('operacao', 'REORDENACAO_ROTULOS',
                                'data', p_data, 'sequencia', v_antes),
             jsonb_build_object('operacao', 'REORDENACAO_ROTULOS',
                                'data', p_data,
                                'motivo', 'Batida incluída em horário anterior às existentes; '
                                       || 'rótulos entrada/saída reencaixados pelo relógio. '
                                       || 'Nenhum horário foi alterado.',
                                'marcacoes_afetadas', to_jsonb(v_changed),
                                'sequencia', (
                                  SELECT jsonb_agg(jsonb_build_object('hora', hora_marcacao,
                                                                      'tipo', tipo_marcacao)
                                                   ORDER BY hora_marcacao)
                                  FROM public.ponto_marcacoes
                                  WHERE tenant_id = p_tenant_id
                                    AND colaborador_cpf = p_colaborador_cpf
                                    AND data_marcacao = p_data
                                )),
             auth.uid();
    EXCEPTION WHEN OTHERS THEN
      NULL;  -- auditoria é registro acessório; nunca derruba a aprovação
    END;
  END IF;

  RETURN (v_changed IS NOT NULL);
END;
$fn$;

-- =====================================================================
-- CONFERÊNCIA (o editor mostra só este último resultado)
-- =====================================================================
WITH def AS MATERIALIZED (
  SELECT
    (SELECT pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'processar_ajuste_ponto' LIMIT 1)         AS f_ajuste,
    (SELECT pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'ponto_bloquear_update_marcacao' LIMIT 1) AS f_trava,
    (SELECT pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'ponto_reordena_tipos_dia' LIMIT 1)       AS f_reord
)
SELECT
  CASE WHEN f_ajuste NOT LIKE '%data_hora%' AND f_ajuste LIKE '%data_marcacao%'
       THEN 'sim' ELSE 'NAO — verificar' END                          AS colunas_corrigidas,
  CASE WHEN f_ajuste LIKE '%Segregação de funções%'
       THEN 'sim' ELSE 'NAO — verificar' END                          AS portaria_671_preservada,
  CASE WHEN f_ajuste LIKE '%_ponto_grava_abono(%'
        AND f_ajuste LIKE '%COALESCE(v_just_nome, v_ajuste.motivo)%'
       THEN 'sim' ELSE 'NAO — verificar' END                          AS abono_com_6_argumentos,
  CASE WHEN f_ajuste LIKE '%tipo_ajuste = ''correcao'' AND v_ajuste.hora_original IS NOT NULL%'
       THEN 'sim' ELSE 'NAO — verificar' END                          AS trava_correcao_segura,
  CASE WHEN f_trava LIKE '%app.ponto_reordena%' AND f_reord LIKE '%app.ponto_reordena%'
       THEN 'sim' ELSE 'NAO — verificar' END                          AS reordenacao_liberada,
  CASE WHEN f_trava LIKE '%Marcação original é imutável%'
       THEN 'sim' ELSE 'NAO — verificar' END                          AS imutabilidade_mantida,
  (SELECT count(*) FROM public.ponto_ajustes WHERE status = 'pendente') AS ajustes_pendentes_para_aprovar
FROM def;
