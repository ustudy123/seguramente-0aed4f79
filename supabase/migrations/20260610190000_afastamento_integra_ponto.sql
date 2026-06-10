-- =========================================================
-- INTEGRAÇÃO AFASTAMENTOS ↔ PONTO
--
-- Regras:
-- 1) Dias dentro de afastamento ativo (atestado/licença/INSS)
--    ficam ABONADOS no ponto: status 'justificado' no espelho,
--    sem cobrança de batida e sem contar como falta
-- 2) Colaborador afastado NÃO consegue registrar ponto pelo
--    link externo (mensagem amigável informando o abono)
-- 3) Colaborador afastado NÃO consegue solicitar ajuste para
--    dias abonados (bloqueio com mensagem amigável)
-- 4) Ao encerrar/cancelar o afastamento, os dias são
--    reconsolidados automaticamente pelas regras normais
-- =========================================================

-- ---------------------------------------------------------
-- 1) Helper: afastamento vigente para um CPF numa data
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.afastamento_vigente(p_tenant_id uuid, p_cpf text, p_data date)
RETURNS public.afastamentos
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT a.* FROM public.afastamentos a
  WHERE a.tenant_id = p_tenant_id
    AND a.colaborador_cpf = p_cpf
    AND a.status IN ('ativo', 'beneficio_inss')
    AND a.data_inicio <= p_data
    AND (a.data_fim IS NULL OR a.data_fim >= p_data)
  ORDER BY a.data_inicio DESC
  LIMIT 1;
$$;

-- ---------------------------------------------------------
-- 2) Consolidação: dia em afastamento = justificado (abonado)
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consolidar_ponto_diario_manual(p_tenant_id UUID, p_colaborador_cpf TEXT, p_data DATE)
RETURNS VOID AS $$
DECLARE
  v_afast public.afastamentos;
  v_marc RECORD;
  v_classe TEXT;
  v_esperado TEXT := 'in';
  v_aberto_em TIME := NULL;
  v_total_minutos INT := 0;
  v_count INT := 0;
  v_primeira_entrada TIME := NULL;
  v_ultima_saida TIME := NULL;
  v_saida_almoco TIME := NULL;
  v_retorno_almoco TIME := NULL;
  v_jornada_aberta BOOLEAN := false;
  v_horas_trabalhadas INTERVAL;
  v_status TEXT;
  v_observacao TEXT := NULL;
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

  -- Afastamento vigente? Dia abonado.
  v_afast := public.afastamento_vigente(p_tenant_id, p_colaborador_cpf, p_data);
  IF v_afast.id IS NOT NULL THEN
    IF v_colaborador_id IS NULL THEN
      v_colaborador_id := v_afast.colaborador_id;
      v_colaborador_nome := v_afast.colaborador_nome;
    END IF;
    v_observacao := 'Abonado por afastamento ('
      || COALESCE(replace(v_afast.motivo_principal::text, '_', ' '), 'registrado')
      || ') de ' || to_char(v_afast.data_inicio, 'DD/MM/YYYY')
      || CASE WHEN v_afast.data_fim IS NOT NULL
           THEN ' a ' || to_char(v_afast.data_fim, 'DD/MM/YYYY')
           ELSE ' — em aberto' END;

    IF v_colaborador_id IS NOT NULL THEN
      INSERT INTO public.ponto_diario (
        tenant_id, colaborador_id, colaborador_nome, colaborador_cpf, data,
        entrada, saida_almoco, retorno_almoco, saida,
        horas_trabalhadas, status, observacao
      ) VALUES (
        p_tenant_id, v_colaborador_id, v_colaborador_nome, p_colaborador_cpf, p_data,
        NULL, NULL, NULL, NULL,
        make_interval(mins => 0), 'justificado', v_observacao
      )
      ON CONFLICT (tenant_id, colaborador_cpf, data)
      DO UPDATE SET
        status = 'justificado',
        observacao = EXCLUDED.observacao,
        updated_at = now();
    END IF;
    RETURN;
  END IF;

  -- ── Fluxo normal (alternância entrada/saída) ──
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

  IF array_length(v_outs, 1) >= 2 THEN
    v_saida_almoco := v_outs[1];
    SELECT t INTO v_retorno_almoco
    FROM unnest(v_ins) AS t
    WHERE t > v_outs[1]
    ORDER BY t ASC LIMIT 1;
  END IF;
  IF v_jornada_aberta AND array_length(v_outs, 1) >= 1 AND array_length(v_ins, 1) >= 2 THEN
    v_saida_almoco := v_outs[1];
    SELECT t INTO v_retorno_almoco
    FROM unnest(v_ins) AS t
    WHERE t > v_outs[1]
    ORDER BY t ASC LIMIT 1;
    v_ultima_saida := NULL;
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
      observacao = CASE WHEN public.ponto_diario.observacao LIKE 'Abonado por afastamento%' THEN NULL ELSE public.ponto_diario.observacao END,
      updated_at = now();
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- ---------------------------------------------------------
-- 3) Trigger em afastamentos: (re)consolida os dias do período
--    na criação, alteração de datas ou mudança de status
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.afastamento_sincroniza_ponto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_cpf TEXT := COALESCE(NEW.colaborador_cpf, OLD.colaborador_cpf);
  v_tenant UUID := COALESCE(NEW.tenant_id, OLD.tenant_id);
  v_ini DATE;
  v_fim DATE;
  v_dia DATE;
BEGIN
  IF v_cpf IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Cobre o período antigo e o novo (datas podem ter mudado)
  v_ini := LEAST(COALESCE(NEW.data_inicio, OLD.data_inicio), COALESCE(OLD.data_inicio, NEW.data_inicio));
  v_fim := GREATEST(
    COALESCE(NEW.data_fim, NEW.data_inicio, OLD.data_fim, OLD.data_inicio),
    COALESCE(OLD.data_fim, OLD.data_inicio, NEW.data_fim, NEW.data_inicio),
    CURRENT_DATE
  );
  -- Não gera além de hoje para afastamentos em aberto; e limita a 1 ano
  IF COALESCE(NEW.data_fim, OLD.data_fim) IS NULL THEN
    v_fim := LEAST(v_fim, CURRENT_DATE);
  END IF;
  v_fim := LEAST(v_fim, v_ini + INTERVAL '370 days');

  FOR v_dia IN SELECT generate_series(v_ini, v_fim, '1 day')::date LOOP
    PERFORM public.consolidar_ponto_diario_manual(v_tenant, v_cpf, v_dia);
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_afastamento_sincroniza_ponto ON public.afastamentos;
CREATE TRIGGER trg_afastamento_sincroniza_ponto
AFTER INSERT OR UPDATE OF status, data_inicio, data_fim ON public.afastamentos
FOR EACH ROW EXECUTE FUNCTION public.afastamento_sincroniza_ponto();

-- ---------------------------------------------------------
-- 4) Bloqueia solicitação de ajuste em dia abonado
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bloquear_ajuste_dia_abonado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_afast public.afastamentos;
BEGIN
  v_afast := public.afastamento_vigente(NEW.tenant_id, NEW.colaborador_cpf, NEW.data_referencia);
  IF v_afast.id IS NOT NULL THEN
    RAISE EXCEPTION 'Este dia já está abonado por afastamento (% a %) — não é necessário solicitar ajuste de ponto.',
      to_char(v_afast.data_inicio, 'DD/MM/YYYY'),
      COALESCE(to_char(v_afast.data_fim, 'DD/MM/YYYY'), 'em aberto');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_ajuste_dia_abonado ON public.ponto_ajustes;
CREATE TRIGGER trg_bloquear_ajuste_dia_abonado
BEFORE INSERT ON public.ponto_ajustes
FOR EACH ROW EXECUTE FUNCTION public.bloquear_ajuste_dia_abonado();

-- ---------------------------------------------------------
-- 5) Link externo: afastado não registra ponto (nem é cobrado)
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
  v_ultima RECORD; v_afast public.afastamentos;
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

  -- Afastamento vigente: dia abonado, sem registro
  v_afast := public.afastamento_vigente(v_link.tenant_id, v_link.colaborador_cpf, v_data);
  IF v_afast.id IS NOT NULL THEN
    RETURN json_build_object('error',
      'Você está afastado(a) ' ||
      CASE WHEN v_afast.data_fim IS NOT NULL
        THEN 'até ' || to_char(v_afast.data_fim, 'DD/MM/YYYY')
        ELSE 'por tempo indeterminado' END ||
      '. Durante o afastamento seus dias ficam abonados automaticamente — não é necessário registrar ponto.');
  END IF;

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

-- ---------------------------------------------------------
-- 6) proximo_tipo: informa o afastamento para a tela externa
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
  v_afast public.afastamentos;
BEGIN
  SELECT * INTO v_link FROM public.ponto_links
  WHERE token = p_token AND ativo = true
    AND (data_expiracao IS NULL OR data_expiracao > now());
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Link inválido ou expirado.');
  END IF;

  v_data := timezone('America/Sao_Paulo', now())::DATE;

  v_afast := public.afastamento_vigente(v_link.tenant_id, v_link.colaborador_cpf, v_data);
  IF v_afast.id IS NOT NULL THEN
    RETURN json_build_object(
      'afastado', true,
      'afastado_ate', CASE WHEN v_afast.data_fim IS NOT NULL THEN to_char(v_afast.data_fim, 'DD/MM/YYYY') ELSE NULL END,
      'afastado_desde', to_char(v_afast.data_inicio, 'DD/MM/YYYY')
    );
  END IF;

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
-- 7) Sincroniza retroativamente os afastamentos ativos atuais
-- ---------------------------------------------------------
DO $$
DECLARE
  v_a RECORD;
  v_dia DATE;
  v_fim DATE;
BEGIN
  FOR v_a IN
    SELECT * FROM public.afastamentos
    WHERE status IN ('ativo', 'beneficio_inss')
      AND colaborador_cpf IS NOT NULL
  LOOP
    v_fim := LEAST(COALESCE(v_a.data_fim, CURRENT_DATE), CURRENT_DATE, v_a.data_inicio + INTERVAL '370 days');
    FOR v_dia IN SELECT generate_series(v_a.data_inicio, v_fim, '1 day')::date LOOP
      PERFORM public.consolidar_ponto_diario_manual(v_a.tenant_id, v_a.colaborador_cpf, v_dia);
    END LOOP;
  END LOOP;
END $$;
