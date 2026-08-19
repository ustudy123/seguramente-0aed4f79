-- ============================================================================
-- ENTREGA — ONDA 2 (parte 5): correção por acréscimo (desconsiderar, nunca apagar)
-- Alvos: colunas desconsiderada* em ponto_marcacoes; desconsiderar_marcacao_ponto;
--        excluir_marcacao_ponto (passa a delegar); processar_ajuste_ponto;
--        _ponto_calc_dia, ponto_reordena_tipos_dia, ponto_corte_virada
-- PONTO-004 (resto)
--
-- O QUE FAZ
--   A batida original nunca é apagada. Passa a ser DESCONSIDERADA: fica no acervo
--   (e na cadeia de hash), marcada com motivo e responsável, e sai do cálculo do
--   dia. Fecha o buraco dos RPCs que ainda apagavam pelo flag app.allow_ponto_delete.
--   (Portaria 671/2021 veda apagar; CLT art. 74; Súmula 338 do TST.)
--
-- ATENÇÃO — TEM PARTE DE TELA. Este script cuida do BANCO. A tela (o botão
--   "Excluir" do espelho vira "Desconsiderar", com motivo) vai no código do
--   frontend e entra em produção pelo **Publicar no Lovable** — não por este
--   script. Enquanto a tela antiga não for publicada, o botão "Excluir" já se
--   comporta como desconsiderar (o RPC antigo passou a delegar), só com o rótulo
--   antigo.
--
-- Aditivo e idempotente (ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE). Sem backfill.
-- ============================================================================

ALTER TABLE public.ponto_marcacoes
  ADD COLUMN IF NOT EXISTS desconsiderada        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS desconsiderada_motivo text,
  ADD COLUMN IF NOT EXISTS desconsiderada_por    text,
  ADD COLUMN IF NOT EXISTS desconsiderada_em     timestamptz;

COMMENT ON COLUMN public.ponto_marcacoes.desconsiderada IS
  'Marcacao mantida no acervo mas retirada do calculo do dia (correcao por acrescimo). A batida original nunca e apagada (Portaria 671; Sumula 338).';

-- RPC próprio: desconsiderar (não apaga) ------------------------------------
CREATE OR REPLACE FUNCTION public.desconsiderar_marcacao_ponto(
  p_marcacao_id uuid,
  p_motivo      text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_marc public.ponto_marcacoes%ROWTYPE;
  v_has_access boolean := false;
  v_is_gestor boolean := false;
  v_vinculo_role text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO v_marc FROM public.ponto_marcacoes WHERE id = p_marcacao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Marcação não encontrada'; END IF;

  -- Via 1: cadastro ativo no tenant
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios_base ub
    WHERE ub.auth_user_id = v_uid AND ub.tenant_id = v_marc.tenant_id AND ub.status = 'ativo'
  ) INTO v_has_access;

  -- Via 2: vínculo multi-empresa ativo no tenant
  IF NOT v_has_access THEN
    SELECT uv.tipo_vinculo::text INTO v_vinculo_role
    FROM public.usuario_vinculos uv
    JOIN public.usuarios_base ub2 ON ub2.id = uv.usuario_id
    WHERE ub2.auth_user_id = v_uid
      AND uv.tenant_id = v_marc.tenant_id
      AND uv.status = 'ativo'
      AND (uv.data_fim IS NULL OR uv.data_fim >= CURRENT_DATE)
    LIMIT 1;
    IF v_vinculo_role IS NOT NULL THEN
      v_has_access := true;
      v_is_gestor := v_vinculo_role IN ('gestor','administrador','rh','rh_dp');
    END IF;
  END IF;

  -- Via 3: perfil no tenant
  IF NOT v_has_access THEN
    SELECT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = v_uid AND p.tenant_id = v_marc.tenant_id
    ) INTO v_has_access;
  END IF;

  IF NOT v_has_access THEN RAISE EXCEPTION 'Sem acesso a este tenant'; END IF;

  -- Papel mínimo: gestor/RH
  IF NOT v_is_gestor THEN
    v_is_gestor :=
      public.has_role(v_uid, 'manager'::public.app_role)
      OR public.has_role(v_uid, 'admin'::public.app_role)
      OR public.has_role(v_uid, 'owner'::public.app_role)
      OR public.is_superadmin(v_uid);
  END IF;
  IF NOT v_is_gestor THEN
    SELECT EXISTS (
      SELECT 1 FROM public.usuarios_base ub3
      WHERE ub3.auth_user_id = v_uid
        AND ub3.tipo_usuario IN ('gestor','administrador','rh_dp')
    ) INTO v_is_gestor;
  END IF;
  IF NOT v_is_gestor THEN
    RAISE EXCEPTION 'Apenas gestor/RH pode desconsiderar marcações';
  END IF;

  IF COALESCE(v_marc.desconsiderada, false) THEN
    RETURN jsonb_build_object('success', true, 'ja_desconsiderada', true);
  END IF;

  -- Trilha (mantém a batida; registra a desconsideração).
  INSERT INTO public.ponto_audit_log (
    tenant_id, tabela_origem, registro_id, acao, dados_anteriores, dados_novos, usuario_id
  ) VALUES (
    v_marc.tenant_id, 'ponto_marcacoes', v_marc.id, 'AJUSTE',
    to_jsonb(v_marc),
    jsonb_build_object('operacao','DESCONSIDERACAO',
                       'motivo', COALESCE(NULLIF(btrim(p_motivo),''), 'Marcacao duplicada/incorreta'),
                       'por', v_uid),
    v_uid
  );

  -- Correção por ACRÉSCIMO: a batida fica, marcada como desconsiderada.
  UPDATE public.ponto_marcacoes
     SET desconsiderada = true,
         desconsiderada_motivo = COALESCE(NULLIF(btrim(p_motivo),''), 'Marcacao duplicada/incorreta'),
         desconsiderada_por = v_uid::text,
         desconsiderada_em = now()
   WHERE id = p_marcacao_id;

  PERFORM public.consolidar_ponto_diario_manual(
    v_marc.tenant_id, v_marc.colaborador_cpf, v_marc.data_marcacao
  );

  RETURN jsonb_build_object('success', true, 'desconsiderada', true);
END;
$function$;

COMMENT ON FUNCTION public.desconsiderar_marcacao_ponto(uuid, text) IS
  'Desconsidera uma marcacao (correcao por acrescimo): mantem a batida no acervo, marca como desconsiderada com motivo/responsavel e retira do calculo. Nunca apaga (Portaria 671; Sumula 338). Papel minimo gestor/RH.';

GRANT EXECUTE ON FUNCTION public.desconsiderar_marcacao_ponto(uuid, text) TO authenticated;

-- Compatibilidade: o antigo "Excluir" passa a DESCONSIDERAR (não apaga mais).
CREATE OR REPLACE FUNCTION public.excluir_marcacao_ponto(p_marcacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN public.desconsiderar_marcacao_ponto(
    p_marcacao_id,
    'Marcacao duplicada/incorreta desconsiderada pela gestao'
  );
END;
$function$;

COMMENT ON FUNCTION public.excluir_marcacao_ponto(uuid) IS
  'Mantido por compatibilidade: agora DELEGA para desconsiderar_marcacao_ponto (correcao por acrescimo). Nao apaga a marcacao.';


-- Consolidacao diaria: ignora as marcacoes desconsideradas.
CREATE OR REPLACE FUNCTION public._ponto_calc_dia(p_tenant_id uuid, p_colaborador_cpf text, p_data date, p_cid uuid, OUT o_pent time without time zone, OUT o_salm time without time zone, OUT o_ralm time without time zone, OUT o_usai time without time zone, OUT o_horas interval, OUT o_status text, OUT o_obs text)
 RETURNS record
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_marc RECORD;
  v_count INT := 0;
  v_ins TIME[] := '{}'; v_outs TIME[] := '{}';
  v_abr TIME; v_classe TEXT; v_esp TEXT := 'in';
  v_min INT := 0; v_dif INT;
  v_anom BOOLEAN := false; v_aberta BOOLEAN := false;
  v_pend BOOLEAN := false; v_esc RECORD;
  v_corte TIME := public.ponto_corte_virada(p_tenant_id, p_colaborador_cpf, p_data);
BEGIN
  FOR v_marc IN
    SELECT hora_marcacao, tipo_marcacao FROM public.ponto_marcacoes
    WHERE tenant_id = p_tenant_id AND colaborador_cpf = p_colaborador_cpf AND data_marcacao = p_data AND NOT COALESCE(desconsiderada, false)
    ORDER BY (EXTRACT(EPOCH FROM hora_marcacao)
              + CASE WHEN v_corte IS NOT NULL AND hora_marcacao < v_corte
                     THEN 86400 ELSE 0 END) ASC,
             created_at ASC
  LOOP
    v_count := v_count + 1;
    v_classe := COALESCE(public.ponto_classifica_tipo(v_marc.tipo_marcacao), v_esp);
    IF v_classe = 'in' THEN
      o_pent := COALESCE(o_pent, v_marc.hora_marcacao);
      v_ins := v_ins || v_marc.hora_marcacao;
      IF v_abr IS NOT NULL THEN v_anom := true; END IF;
      v_abr := v_marc.hora_marcacao; v_esp := 'out';
    ELSE
      IF v_abr IS NOT NULL THEN
        -- Trunca os segundos (FLOOR) para alinhar com a exibição do Espelho
        v_dif := FLOOR(EXTRACT(EPOCH FROM (v_marc.hora_marcacao - v_abr)) / 60)::INT;
        IF v_dif < 0 THEN v_dif := v_dif + 1440; END IF;
        v_min := v_min + GREATEST(0, v_dif);
        v_abr := NULL;
      ELSE
        v_anom := true;
      END IF;
      v_outs := v_outs || v_marc.hora_marcacao;
      o_usai := v_marc.hora_marcacao; v_esp := 'in';
    END IF;
  END LOOP;

  v_aberta := (v_abr IS NOT NULL);
  IF array_length(v_outs,1) >= 2 THEN
    o_salm := v_outs[1];
    SELECT t INTO o_ralm FROM unnest(v_ins) AS t WHERE t > v_outs[1] ORDER BY t ASC LIMIT 1;
  END IF;
  IF v_aberta AND array_length(v_outs,1) >= 1 AND array_length(v_ins,1) >= 2 THEN
    o_salm := v_outs[1];
    SELECT t INTO o_ralm FROM unnest(v_ins) AS t WHERE t > v_outs[1] ORDER BY t ASC LIMIT 1;
    o_usai := NULL;
  END IF;
  o_horas := make_interval(mins => v_min);

  SELECT EXISTS (SELECT 1 FROM public.ponto_ajustes
    WHERE tenant_id = p_tenant_id AND colaborador_cpf = p_colaborador_cpf
      AND data_referencia = p_data AND status = 'pendente') INTO v_pend;

  IF v_pend THEN o_status := 'ajuste_pendente';
  ELSIF v_count = 0 THEN o_status := 'falta';
  ELSIF v_aberta OR v_anom THEN o_status := 'incompleto';
  ELSE
    o_status := 'regular';
    SELECT * INTO v_esc FROM public.ponto_escala_do_dia(p_tenant_id, p_colaborador_cpf, p_cid, p_data);
    IF v_esc.hora_entrada IS NOT NULL AND o_pent IS NOT NULL
       AND o_pent > (v_esc.hora_entrada + make_interval(mins => v_esc.tolerancia_min)) THEN
      o_status := 'atraso';
    END IF;
  END IF;

  IF o_status = 'atraso' AND EXISTS (
    SELECT 1 FROM public.atestados a
    WHERE a.tenant_id = p_tenant_id AND a.colaborador_cpf = p_colaborador_cpf
      AND a.data_inicio_afastamento IS NOT NULL
      AND COALESCE(a.unidade_afastamento,'dias') = 'horas'
      AND a.data_inicio_afastamento <= p_data
      AND COALESCE(a.data_fim_afastamento, a.data_inicio_afastamento) >= p_data
  ) THEN
    o_status := 'regular';
    o_obs := COALESCE(NULLIF(o_obs, '') || ' ', '') || 'Atraso justificado por atestado de horas no dia.';
  END IF;

  IF v_anom AND NOT v_pend THEN
    o_obs := 'Sequência de marcações incompleta (entrada/saída sem par) — horas do período não pareado não contabilizadas. Solicite ajuste de ponto.';
  END IF;
END;
$function$;

-- Reordenacao de rotulos: ignora as desconsideradas.
CREATE OR REPLACE FUNCTION public.ponto_reordena_tipos_dia(p_tenant_id uuid, p_colaborador_cpf text, p_data date)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_n       int;
  v_min_gap numeric;
  v_corte   time := public.ponto_corte_virada(p_tenant_id, p_colaborador_cpf, p_data);
  v_changed uuid[];
  v_id      uuid;
  v_antes   jsonb;
BEGIN
  -- Contagem e menor vão entre batidas JÁ na ordem cíclica (guarda de ruído).
  SELECT count(*), min(gap) INTO v_n, v_min_gap
  FROM (
    SELECT (ordk - lag(ordk) OVER (ORDER BY ordk)) / 60 AS gap
    FROM (
      SELECT EXTRACT(EPOCH FROM hora_marcacao)
             + CASE WHEN v_corte IS NOT NULL AND hora_marcacao < v_corte
                    THEN 86400 ELSE 0 END AS ordk
      FROM public.ponto_marcacoes
      WHERE tenant_id = p_tenant_id
        AND colaborador_cpf = p_colaborador_cpf
        AND data_marcacao = p_data AND NOT COALESCE(desconsiderada, false)
    ) e
  ) g;

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
    AND data_marcacao = p_data AND NOT COALESCE(desconsiderada, false);

  PERFORM set_config('app.ponto_reordena', 'on', true);

  WITH reord AS (
    SELECT id,
           row_number() OVER (
             ORDER BY (EXTRACT(EPOCH FROM hora_marcacao)
                       + CASE WHEN v_corte IS NOT NULL AND hora_marcacao < v_corte
                              THEN 86400 ELSE 0 END),
                      created_at
           ) AS pos
    FROM public.ponto_marcacoes
    WHERE tenant_id = p_tenant_id
      AND colaborador_cpf = p_colaborador_cpf
      AND data_marcacao = p_data AND NOT COALESCE(desconsiderada, false)
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
                                       || 'rótulos entrada/saída reencaixados pelo relógio '
                                       || '(ordem cíclica, virada reconhecida). '
                                       || 'Nenhum horário foi alterado.',
                                'marcacoes_afetadas', to_jsonb(v_changed),
                                'sequencia', (
                                  SELECT jsonb_agg(jsonb_build_object('hora', hora_marcacao,
                                                                      'tipo', tipo_marcacao)
                                                   ORDER BY hora_marcacao)
                                  FROM public.ponto_marcacoes
                                  WHERE tenant_id = p_tenant_id
                                    AND colaborador_cpf = p_colaborador_cpf
                                    AND data_marcacao = p_data AND NOT COALESCE(desconsiderada, false)
                                )),
             auth.uid();
    EXCEPTION WHEN OTHERS THEN
      NULL;  -- auditoria é registro acessório; nunca derruba a aprovação
    END;
  END IF;

  RETURN (v_changed IS NOT NULL);
END;
$function$;

-- Corte da virada: ignora as desconsideradas.
CREATE OR REPLACE FUNCTION public.ponto_corte_virada(p_tenant_id uuid, p_colaborador_cpf text, p_data date)
 RETURNS time without time zone
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH m AS (
    SELECT hora_marcacao AS h
    FROM public.ponto_marcacoes
    WHERE tenant_id = p_tenant_id
      AND colaborador_cpf = p_colaborador_cpf
      AND data_marcacao = p_data AND NOT COALESCE(desconsiderada, false)
  ),
  g AS (
    SELECT h, EXTRACT(EPOCH FROM (h - lag(h) OVER (ORDER BY h)))/60 AS gap
    FROM m
  ),
  stats AS (
    SELECT (SELECT max(gap) FROM g) AS max_int,
           1440 - EXTRACT(EPOCH FROM ((SELECT max(h) FROM m) - (SELECT min(h) FROM m)))/60 AS wrap_gap
  )
  SELECT CASE
           WHEN (SELECT count(*) FROM m) < 2 THEN NULL
           WHEN s.max_int > s.wrap_gap
             THEN (SELECT h FROM g WHERE gap = s.max_int ORDER BY h LIMIT 1)
           ELSE NULL
         END
  FROM stats s;
$function$;

-- processar_ajuste_ponto: correcao (tipo 'correcao') desconsidera em vez de apagar.
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
    -- Correcao por ACRESCIMO: a batida original nao e apagada, e desconsiderada.
    UPDATE public.ponto_marcacoes
       SET desconsiderada = true,
           desconsiderada_motivo = COALESCE(NULLIF(btrim(v_ajuste.motivo), ''), 'Correcao por ajuste aprovado'),
           desconsiderada_por = COALESCE(v_ajuste.aprovado_por::text, v_ajuste.created_by::text),
           desconsiderada_em = now()
     WHERE tenant_id = v_ajuste.tenant_id
       AND colaborador_cpf = v_ajuste.colaborador_cpf
       AND data_marcacao = v_ajuste.data_referencia
       AND to_char(hora_marcacao, 'HH24:MI') = to_char(v_ajuste.hora_original, 'HH24:MI')
       AND NOT COALESCE(desconsiderada, false);
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

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA — o SQL Editor mostra apenas o último resultado.
-- Esperado: t | t | t | t | t | OK
--   coluna_desconsid   : t  (ponto_marcacoes.desconsiderada existe)
--   rpc_desconsiderar  : t  (desconsiderar_marcacao_ponto existe)
--   excluir_delega     : t  (excluir_marcacao_ponto agora delega, nao apaga)
--   calc_ignora        : t  (_ponto_calc_dia ignora desconsideradas)
--   ajuste_nao_apaga   : t  (processar_ajuste_ponto desconsidera em vez de apagar)
-- ---------------------------------------------------------------------------
SELECT
  (EXISTS (SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='ponto_marcacoes' AND column_name='desconsiderada')) AS coluna_desconsid,
  (to_regprocedure('public.desconsiderar_marcacao_ponto(uuid,text)') IS NOT NULL) AS rpc_desconsiderar,
  (position('desconsiderar_marcacao_ponto' in pg_get_functiondef('public.excluir_marcacao_ponto(uuid)'::regprocedure)) > 0) AS excluir_delega,
  (position('desconsiderada' in pg_get_functiondef('public._ponto_calc_dia(uuid,text,date,uuid)'::regprocedure)) > 0) AS calc_ignora,
  (position('desconsiderada = true' in pg_get_functiondef('public.processar_ajuste_ponto(uuid,boolean,text)'::regprocedure)) > 0) AS ajuste_nao_apaga,
  CASE
    WHEN (EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='ponto_marcacoes' AND column_name='desconsiderada'))
     AND to_regprocedure('public.desconsiderar_marcacao_ponto(uuid,text)') IS NOT NULL
     AND position('desconsiderar_marcacao_ponto' in pg_get_functiondef('public.excluir_marcacao_ponto(uuid)'::regprocedure)) > 0
     AND position('desconsiderada' in pg_get_functiondef('public._ponto_calc_dia(uuid,text,date,uuid)'::regprocedure)) > 0
     AND position('desconsiderada = true' in pg_get_functiondef('public.processar_ajuste_ponto(uuid,boolean,text)'::regprocedure)) > 0
      THEN 'OK' ELSE 'CONFERIR'
  END AS erro_tecnico;
