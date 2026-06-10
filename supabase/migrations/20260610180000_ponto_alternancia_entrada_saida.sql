-- =========================================================
-- PONTO: MODELO DE ALTERNÂNCIA LIVRE ENTRADA ↔ SAÍDA
--
-- Regra única:
--   • Sem registro no dia        → próxima marcação = ENTRADA
--   • Última marcação = ENTRADA  → próxima = SAÍDA
--   • Última marcação = SAÍDA    → próxima = ENTRADA
--   • Quantos ciclos forem necessários no mesmo dia
--
-- Compatibilidade com dados legados: saida_almoco conta como
-- SAÍDA e retorno_almoco conta como ENTRADA; 'batida' é
-- classificada pela alternância (posição na sequência).
--
-- Esta migration também RECONCILIA as funções que ficaram com
-- versões conflitantes (edições do Lovable de 10/06 12:11 vs
-- correções da manhã): processar_ajuste_ponto volta a ter
-- validação multi-tenant + papel mínimo, com o retorno jsonb
-- e o fluxo por marcação única da versão vigente.
-- =========================================================

-- ---------------------------------------------------------
-- 0) Remove o bloqueio físico de 1 marcação por tipo/dia
-- ---------------------------------------------------------
ALTER TABLE public.ponto_marcacoes DROP CONSTRAINT IF EXISTS unique_marcacao;

-- Garante que o CHECK aceita os tipos novos e legados
ALTER TABLE public.ponto_marcacoes DROP CONSTRAINT IF EXISTS ponto_marcacoes_tipo_marcacao_check;
ALTER TABLE public.ponto_marcacoes ADD CONSTRAINT ponto_marcacoes_tipo_marcacao_check
  CHECK (tipo_marcacao IN ('entrada', 'saida_almoco', 'retorno_almoco', 'saida', 'batida'));

-- ---------------------------------------------------------
-- 1) Helper: classifica um tipo como 'in' / 'out' / NULL(batida)
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ponto_classifica_tipo(p_tipo text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_tipo IN ('entrada', 'retorno_almoco') THEN 'in'
    WHEN p_tipo IN ('saida', 'saida_almoco') THEN 'out'
    ELSE NULL  -- 'batida': resolvida pela alternância
  END;
$$;

-- ---------------------------------------------------------
-- 2) Consolidação do dia: soma TODOS os pares entrada→saída
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consolidar_ponto_diario_manual(p_tenant_id UUID, p_colaborador_cpf TEXT, p_data DATE)
RETURNS VOID AS $$
DECLARE
  v_marc RECORD;
  v_classe TEXT;
  v_esperado TEXT := 'in';
  v_aberto_em TIME := NULL;
  v_total_minutos INT := 0;
  v_count INT := 0;
  v_primeira_entrada TIME := NULL;
  v_ultima_saida TIME := NULL;
  v_saida_almoco TIME := NULL;     -- 1ª saída intermediária (exibição legada)
  v_retorno_almoco TIME := NULL;   -- 1ª entrada após essa saída
  v_jornada_aberta BOOLEAN := false;
  v_horas_trabalhadas INTERVAL;
  v_status TEXT;
  v_tem_ajuste_pendente BOOLEAN := false;
  v_colaborador_id UUID;
  v_colaborador_nome TEXT;
  v_outs TIME[] := '{}';
  v_ins  TIME[] := '{}';
BEGIN
  SELECT colaborador_id, colaborador_nome INTO v_colaborador_id, v_colaborador_nome
  FROM public.ponto_marcacoes
  WHERE tenant_id = p_tenant_id AND colaborador_cpf = p_colaborador_cpf
  ORDER BY created_at DESC LIMIT 1;

  IF v_colaborador_id IS NULL THEN
    SELECT colaborador_id, colaborador_nome INTO v_colaborador_id, v_colaborador_nome
    FROM public.ponto_ajustes
    WHERE tenant_id = p_tenant_id AND colaborador_cpf = p_colaborador_cpf
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  -- Percorre as marcações do dia em ordem cronológica,
  -- alternando in/out e somando os pares fechados
  FOR v_marc IN
    SELECT hora_marcacao, tipo_marcacao
    FROM public.ponto_marcacoes
    WHERE tenant_id = p_tenant_id
      AND colaborador_cpf = p_colaborador_cpf
      AND data_marcacao = p_data
    ORDER BY hora_marcacao ASC, created_at ASC
  LOOP
    v_count := v_count + 1;
    v_classe := COALESCE(public.ponto_classifica_tipo(v_marc.tipo_marcacao), v_esperado);

    IF v_classe = 'in' THEN
      IF v_primeira_entrada IS NULL THEN
        v_primeira_entrada := v_marc.hora_marcacao;
      END IF;
      v_ins := v_ins || v_marc.hora_marcacao;
      -- abre um novo período (se já havia um aberto, o anterior fica órfão)
      v_aberto_em := v_marc.hora_marcacao;
      v_esperado := 'out';
    ELSE
      IF v_aberto_em IS NOT NULL THEN
        v_total_minutos := v_total_minutos + GREATEST(0,
          (EXTRACT(EPOCH FROM (v_marc.hora_marcacao - v_aberto_em)) / 60)::INT);
        v_aberto_em := NULL;
      END IF;
      v_outs := v_outs || v_marc.hora_marcacao;
      v_ultima_saida := v_marc.hora_marcacao;
      v_esperado := 'in';
    END IF;
  END LOOP;

  v_jornada_aberta := (v_aberto_em IS NOT NULL);

  -- Colunas de exibição legadas (espelho com 4 colunas):
  --   saida_almoco  = 1ª saída que NÃO é a última do dia
  --   retorno_almoco = 1ª entrada posterior a essa saída
  IF array_length(v_outs, 1) >= 2 THEN
    v_saida_almoco := v_outs[1];
    SELECT t INTO v_retorno_almoco
    FROM unnest(v_ins) AS t
    WHERE t > v_outs[1]
    ORDER BY t ASC LIMIT 1;
  END IF;
  -- Jornada aberta com 2+ entradas: a 1ª saída é intermediária
  IF v_jornada_aberta AND array_length(v_outs, 1) >= 1 AND array_length(v_ins, 1) >= 2 THEN
    v_saida_almoco := v_outs[1];
    SELECT t INTO v_retorno_almoco
    FROM unnest(v_ins) AS t
    WHERE t > v_outs[1]
    ORDER BY t ASC LIMIT 1;
    v_ultima_saida := NULL; -- ainda não saiu de vez
  END IF;

  v_horas_trabalhadas := make_interval(mins => v_total_minutos);

  SELECT EXISTS (
    SELECT 1 FROM public.ponto_ajustes
    WHERE tenant_id = p_tenant_id
      AND colaborador_cpf = p_colaborador_cpf
      AND data_referencia = p_data
      AND status = 'pendente'
  ) INTO v_tem_ajuste_pendente;

  IF v_tem_ajuste_pendente THEN
    v_status := 'ajuste_pendente';
  ELSIF v_count = 0 THEN
    v_status := 'falta';
  ELSIF v_jornada_aberta THEN
    v_status := 'incompleto';
  ELSIF v_primeira_entrada IS NOT NULL AND v_primeira_entrada > '08:10'::TIME THEN
    v_status := 'atraso';
  ELSE
    v_status := 'regular';
  END IF;

  IF v_colaborador_id IS NOT NULL THEN
    INSERT INTO public.ponto_diario (
      tenant_id, colaborador_id, colaborador_nome, colaborador_cpf, data,
      entrada, saida_almoco, retorno_almoco, saida,
      horas_trabalhadas, status
    ) VALUES (
      p_tenant_id, v_colaborador_id, v_colaborador_nome, p_colaborador_cpf, p_data,
      v_primeira_entrada, v_saida_almoco, v_retorno_almoco, v_ultima_saida,
      v_horas_trabalhadas, v_status
    )
    ON CONFLICT (tenant_id, colaborador_cpf, data)
    DO UPDATE SET
      entrada = EXCLUDED.entrada,
      saida_almoco = EXCLUDED.saida_almoco,
      retorno_almoco = EXCLUDED.retorno_almoco,
      saida = EXCLUDED.saida,
      horas_trabalhadas = EXCLUDED.horas_trabalhadas,
      status = CASE WHEN public.ponto_diario.status = 'justificado' THEN 'justificado' ELSE EXCLUDED.status END,
      updated_at = now();
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- ---------------------------------------------------------
-- 3) Trigger de consolidação ao inserir marcação: delega
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consolidar_ponto_diario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  PERFORM public.consolidar_ponto_diario_manual(NEW.tenant_id, NEW.colaborador_cpf, NEW.data_marcacao);
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------
-- 4) Validação ao vivo: 10min entre batidas + alternância
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validar_sequencia_marcacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_ultima RECORD;
  v_classe_nova TEXT;
  v_classe_ultima TEXT;
BEGIN
  -- Ajustes aprovados (marcacao_original = false) entram sem
  -- validação de sequência/intervalo
  IF NEW.marcacao_original = false THEN
    RETURN NEW;
  END IF;

  SELECT hora_marcacao, tipo_marcacao INTO v_ultima
  FROM public.ponto_marcacoes
  WHERE tenant_id = NEW.tenant_id
    AND colaborador_cpf = NEW.colaborador_cpf
    AND data_marcacao = NEW.data_marcacao
    AND marcacao_original = true
  ORDER BY hora_marcacao DESC, created_at DESC
  LIMIT 1;

  IF v_ultima.hora_marcacao IS NOT NULL THEN
    -- Trava anti-toque-duplo: 10 minutos entre batidas
    IF NEW.hora_marcacao - v_ultima.hora_marcacao < interval '10 minutes'
       AND NEW.hora_marcacao >= v_ultima.hora_marcacao THEN
      RAISE EXCEPTION 'Sua marcação anterior já foi registrada com sucesso ✓ Por segurança, aguarde alguns minutos antes da próxima batida.';
    END IF;

    -- Alternância: depois de entrada vem saída, e vice-versa
    v_classe_ultima := COALESCE(public.ponto_classifica_tipo(v_ultima.tipo_marcacao), 'in');
    v_classe_nova := public.ponto_classifica_tipo(NEW.tipo_marcacao);
    IF v_classe_nova IS NOT NULL AND v_classe_nova = v_classe_ultima THEN
      IF v_classe_nova = 'in' THEN
        RAISE EXCEPTION 'Você já está com a jornada em aberto (última marcação foi uma entrada). A próxima marcação deve ser uma SAÍDA.';
      ELSE
        RAISE EXCEPTION 'Sua jornada já está fechada (última marcação foi uma saída). A próxima marcação deve ser uma ENTRADA.';
      END IF;
    END IF;
  ELSE
    -- Primeira marcação do dia deve ser uma entrada
    IF public.ponto_classifica_tipo(NEW.tipo_marcacao) = 'out' THEN
      RAISE EXCEPTION 'A primeira marcação do dia deve ser uma ENTRADA.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------
-- 5) Link externo: próximo tipo pela alternância
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.proximo_tipo_marcacao_externo(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_link RECORD;
  v_data DATE;
  v_ultima RECORD;
  v_proximo TEXT;
  v_marcacoes JSON;
BEGIN
  SELECT * INTO v_link FROM public.ponto_links
  WHERE token = p_token AND ativo = true
    AND (data_expiracao IS NULL OR data_expiracao > now());
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Link inválido ou expirado.');
  END IF;

  v_data := timezone('America/Sao_Paulo', now())::DATE;

  SELECT hora_marcacao, tipo_marcacao INTO v_ultima
  FROM public.ponto_marcacoes
  WHERE tenant_id = v_link.tenant_id
    AND colaborador_cpf = v_link.colaborador_cpf
    AND data_marcacao = v_data
  ORDER BY hora_marcacao DESC, created_at DESC
  LIMIT 1;

  IF v_ultima.tipo_marcacao IS NULL THEN
    v_proximo := 'entrada';
  ELSIF COALESCE(public.ponto_classifica_tipo(v_ultima.tipo_marcacao), 'in') = 'in' THEN
    v_proximo := 'saida';
  ELSE
    v_proximo := 'entrada';
  END IF;

  SELECT COALESCE(json_agg(json_build_object(
    'tipo', tipo_marcacao,
    'classe', COALESCE(public.ponto_classifica_tipo(tipo_marcacao), 'in'),
    'hora', to_char(hora_marcacao, 'HH24:MI')
  ) ORDER BY hora_marcacao ASC), '[]'::json)
  INTO v_marcacoes
  FROM public.ponto_marcacoes
  WHERE tenant_id = v_link.tenant_id
    AND colaborador_cpf = v_link.colaborador_cpf
    AND data_marcacao = v_data;

  RETURN json_build_object(
    'proximo', v_proximo,
    'marcacoes', v_marcacoes
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.proximo_tipo_marcacao_externo(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.proximo_tipo_marcacao_externo(text) TO anon, authenticated;

-- ---------------------------------------------------------
-- 6) Link externo: registrar pela alternância
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_ponto_externo(
  p_token text,
  p_tipo_marcacao text DEFAULT NULL,
  p_latitude double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL,
  p_endereco text DEFAULT NULL,
  p_selfie_url text DEFAULT NULL,
  p_selfie_nome text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_link RECORD; v_marcacao_id UUID; v_hora TIME; v_data DATE;
  v_now TIMESTAMP; v_err TEXT; v_tipo TEXT; v_esperado TEXT;
  v_ultima RECORD;
BEGIN
  v_now := timezone('America/Sao_Paulo', now());
  v_hora := v_now::TIME;
  v_data := v_now::DATE;

  SELECT * INTO v_link FROM public.ponto_links
  WHERE token = p_token AND ativo = true
    AND (data_expiracao IS NULL OR data_expiracao > now());
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Link inválido ou expirado.');
  END IF;

  -- Próximo tipo esperado pela alternância
  SELECT hora_marcacao, tipo_marcacao INTO v_ultima
  FROM public.ponto_marcacoes
  WHERE tenant_id = v_link.tenant_id
    AND colaborador_cpf = v_link.colaborador_cpf
    AND data_marcacao = v_data
  ORDER BY hora_marcacao DESC, created_at DESC
  LIMIT 1;

  IF v_ultima.tipo_marcacao IS NULL THEN
    v_esperado := 'entrada';
  ELSIF COALESCE(public.ponto_classifica_tipo(v_ultima.tipo_marcacao), 'in') = 'in' THEN
    v_esperado := 'saida';
  ELSE
    v_esperado := 'entrada';
  END IF;

  -- Normaliza tipos legados enviados por fronts antigos
  v_tipo := p_tipo_marcacao;
  IF v_tipo = 'saida_almoco' THEN v_tipo := 'saida'; END IF;
  IF v_tipo = 'retorno_almoco' THEN v_tipo := 'entrada'; END IF;
  IF v_tipo IS NULL OR v_tipo = 'batida' THEN v_tipo := v_esperado; END IF;

  IF v_tipo NOT IN ('entrada', 'saida') THEN
    RETURN json_build_object('error', 'Tipo de marcação inválido.');
  END IF;

  IF v_tipo <> v_esperado THEN
    IF v_esperado = 'saida' THEN
      RETURN json_build_object('error',
        'Sua última marcação foi uma ENTRADA — a próxima deve ser uma SAÍDA. Se precisar corrigir algum horário, use "Solicitar Ajuste de Ponto".');
    ELSE
      RETURN json_build_object('error',
        'Sua última marcação foi uma SAÍDA — a próxima deve ser uma ENTRADA. Se precisar corrigir algum horário, use "Solicitar Ajuste de Ponto".');
    END IF;
  END IF;

  BEGIN
    INSERT INTO public.ponto_marcacoes (
      tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
      data_marcacao, hora_marcacao, tipo_marcacao,
      latitude, longitude, dispositivo, hash_marcacao, marcacao_original,
      endereco_geolocalizacao, selfie_url, selfie_nome
    ) VALUES (
      v_link.tenant_id, v_link.colaborador_id::uuid, v_link.colaborador_nome, v_link.colaborador_cpf,
      v_data, v_hora, v_tipo, p_latitude, p_longitude, 'mobile_web',
      encode(sha256((v_link.colaborador_cpf || v_data::text || v_hora::text || v_tipo || clock_timestamp()::text)::bytea), 'hex'),
      true, p_endereco, p_selfie_url, p_selfie_nome
    ) RETURNING id INTO v_marcacao_id;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    RETURN json_build_object('error', COALESCE(v_err, 'Não foi possível registrar agora.'));
  END;

  RETURN json_build_object(
    'success', true,
    'marcacao_id', v_marcacao_id,
    'colaborador_nome', v_link.colaborador_nome,
    'tipo_marcacao', v_tipo,
    'hora', to_char(v_hora, 'HH24:MI:SS'),
    'data', to_char(v_data, 'DD/MM/YYYY')
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.registrar_ponto_externo(text, text, double precision, double precision, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_ponto_externo(text, text, double precision, double precision, text, text, text) TO anon, authenticated;

-- Mantém o wrapper de compatibilidade (assinatura antiga de 6 args)
CREATE OR REPLACE FUNCTION public.registrar_ponto_externo(
  p_token text,
  p_tipo_marcacao text,
  p_latitude double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL,
  p_endereco text DEFAULT NULL,
  p_selfie_base64 text DEFAULT NULL
)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT public.registrar_ponto_externo(
    p_token, p_tipo_marcacao, p_latitude, p_longitude, p_endereco, NULL, NULL
  );
$$;

REVOKE EXECUTE ON FUNCTION public.registrar_ponto_externo(text, text, double precision, double precision, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_ponto_externo(text, text, double precision, double precision, text, text) TO anon, authenticated;

-- ---------------------------------------------------------
-- 7) processar_ajuste_ponto: versão reconciliada
--    (fluxo por marcação única + multi-tenant + papel mínimo)
-- ---------------------------------------------------------
DROP FUNCTION IF EXISTS public.processar_ajuste_ponto(uuid, boolean, text);

CREATE OR REPLACE FUNCTION public.processar_ajuste_ponto(p_ajuste_id uuid, p_aprovado boolean, p_observacao text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ajuste public.ponto_ajustes%ROWTYPE;
  v_has_access boolean := false;
  v_is_gestor boolean := false;
  v_vinculo_role text;
  v_aprovador_nome text;
  v_tipo text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO v_ajuste FROM public.ponto_ajustes WHERE id = p_ajuste_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ajuste não encontrado'; END IF;
  IF v_ajuste.status <> 'pendente' THEN RAISE EXCEPTION 'Este ajuste já foi processado'; END IF;

  -- Acesso: tenant principal OU vínculo multi-tenant
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios_base ub
    WHERE ub.auth_user_id = v_uid AND ub.tenant_id = v_ajuste.tenant_id AND ub.status = 'ativo'
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    SELECT ut.role::text INTO v_vinculo_role
    FROM public.usuario_tenants ut
    WHERE ut.user_id = v_uid AND ut.tenant_id = v_ajuste.tenant_id AND ut.ativo = true
    LIMIT 1;
    IF v_vinculo_role IS NOT NULL THEN
      v_has_access := true;
      v_is_gestor := v_vinculo_role IN ('manager','admin','super_admin','superadmin','owner','rh');
    END IF;
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
    RAISE EXCEPTION 'Apenas gestor/RH pode processar ajustes de ponto';
  END IF;

  SELECT nome_completo INTO v_aprovador_nome
  FROM public.usuarios_base
  WHERE auth_user_id = v_uid AND tenant_id = v_ajuste.tenant_id
  LIMIT 1;
  IF v_aprovador_nome IS NULL THEN
    SELECT nome_completo INTO v_aprovador_nome
    FROM public.profiles WHERE user_id = v_uid LIMIT 1;
  END IF;

  UPDATE public.ponto_ajustes
  SET status = CASE WHEN p_aprovado THEN 'aprovado' ELSE 'rejeitado' END,
      aprovado_por = v_uid,
      aprovado_por_nome = v_aprovador_nome,
      data_aprovacao = now(),
      observacao_aprovador = p_observacao
  WHERE id = p_ajuste_id;

  IF NOT p_aprovado OR v_ajuste.tipo_ajuste IN ('justificativa', 'abono') THEN
    PERFORM public.consolidar_ponto_diario_manual(v_ajuste.tenant_id, v_ajuste.colaborador_cpf, v_ajuste.data_referencia);
    RETURN jsonb_build_object('success', true);
  END IF;

  -- Correção: remove a marcação antiga correspondente
  IF v_ajuste.tipo_ajuste = 'correcao' THEN
    PERFORM set_config('app.allow_ponto_delete', 'true', true);
    DELETE FROM public.ponto_marcacoes
    WHERE tenant_id = v_ajuste.tenant_id
      AND colaborador_cpf = v_ajuste.colaborador_cpf
      AND data_marcacao = v_ajuste.data_referencia
      AND tipo_marcacao = v_ajuste.tipo_marcacao
      AND (hora_marcacao = v_ajuste.hora_original OR v_ajuste.hora_original IS NULL);
    PERFORM set_config('app.allow_ponto_delete', 'false', true);
  END IF;

  -- Normaliza tipos legados na inserção
  v_tipo := COALESCE(v_ajuste.tipo_marcacao, 'batida');
  IF v_tipo = 'saida_almoco' THEN v_tipo := 'saida'; END IF;
  IF v_tipo = 'retorno_almoco' THEN v_tipo := 'entrada'; END IF;

  INSERT INTO public.ponto_marcacoes (
    tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
    data_marcacao, hora_marcacao, tipo_marcacao, marcacao_original, created_by, hash_marcacao
  ) VALUES (
    v_ajuste.tenant_id, v_ajuste.empresa_id, v_ajuste.colaborador_id, v_ajuste.colaborador_nome, v_ajuste.colaborador_cpf,
    v_ajuste.data_referencia, v_ajuste.hora_solicitada, v_tipo, false, v_uid, 'AJUSTE-' || p_ajuste_id
  );

  PERFORM public.consolidar_ponto_diario_manual(v_ajuste.tenant_id, v_ajuste.colaborador_cpf, v_ajuste.data_referencia);

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.processar_ajuste_ponto(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.processar_ajuste_ponto(uuid, boolean, text) TO authenticated;
