-- =====================================================================
-- LINK ÚNICO DE PONTO (COMPARTILHADO) + IDENTIFICAÇÃO POR CPF
-- =====================================================================
-- Hoje o registro externo é 1 link/token por colaborador (ponto_links).
-- Esta migration adiciona um modo "compartilhado": UM link por tenant em
-- que o colaborador se identifica digitando o CPF. A selfie passa a ser
-- OBRIGATÓRIA nesse modo (CPF não é secreto — a foto é a prova de
-- identidade / anti-fraude).
--
-- Princípios:
--  * Não-destrutivo: nova coluna `tipo` com DEFAULT 'colaborador' — toda
--    linha/link/PWA legado continua funcionando inalterado.
--  * As RPCs antigas (por token) NÃO mudam de comportamento. As novas RPCs
--    `_cpf` são autocontidas (espelham a lógica atual) e resolvem o
--    colaborador pela admissão a partir do CPF.
--  * O CPF gravado na marcação é o `admissoes.cpf` (mesma forma usada pela
--    consolidação/espelho/banco), garantindo que tudo downstream case.
-- =====================================================================

-- 1) Coluna que distingue link por-colaborador (legado) do compartilhado --
ALTER TABLE public.ponto_links
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'colaborador';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ponto_links_tipo_check'
  ) THEN
    ALTER TABLE public.ponto_links
      ADD CONSTRAINT ponto_links_tipo_check CHECK (tipo IN ('colaborador','compartilhado'));
  END IF;
END $$;

-- No máximo 1 link compartilhado ATIVO por tenant.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ponto_links_compartilhado_por_tenant
  ON public.ponto_links (tenant_id)
  WHERE tipo = 'compartilhado';

-- 2) Helper: resolve a admissão (colaborador) a partir do CPF -----------
-- Compara por dígitos (CPF pode estar formatado). Retorna o CPF na forma
-- ARMAZENADA em admissoes.cpf — é esse formato que a consolidação casa.
-- Mensagem genérica no chamador (não confirma existência de CPF).
CREATE OR REPLACE FUNCTION public._ponto_resolver_colaborador_cpf(
  p_tenant_id uuid,
  p_cpf text
)
RETURNS TABLE (colaborador_id uuid, colaborador_nome text, colaborador_cpf text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT a.id, a.nome_completo, a.cpf
  FROM public.admissoes a
  WHERE a.tenant_id = p_tenant_id
    AND regexp_replace(COALESCE(a.cpf,''), '\D', '', 'g') = regexp_replace(COALESCE(p_cpf,''), '\D', '', 'g')
    AND length(regexp_replace(COALESCE(p_cpf,''), '\D', '', 'g')) = 11
    AND a.status = 'concluido'
    AND COALESCE(a.inativo, false) = false
    AND COALESCE(a.bate_ponto, true) = true
  ORDER BY a.data_admissao DESC NULLS LAST
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public._ponto_resolver_colaborador_cpf(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._ponto_resolver_colaborador_cpf(uuid, text) TO authenticated;

-- 3) buscar_ponto_link_por_token: sinaliza link compartilhado ------------
-- Acréscimo ADITIVO: quando o token é de um link 'compartilhado', retorna
-- {compartilhado:true} para o front exibir a etapa de CPF. Tokens legados
-- (tipo='colaborador') seguem com o retorno idêntico ao anterior.
CREATE OR REPLACE FUNCTION public.buscar_ponto_link_por_token(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link RECORD;
BEGIN
  SELECT * INTO v_link
  FROM public.ponto_links
  WHERE token = p_token
    AND ativo = true
    AND (data_expiracao IS NULL OR data_expiracao > now());

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Link inválido ou expirado');
  END IF;

  IF v_link.tipo = 'compartilhado' THEN
    RETURN json_build_object('compartilhado', true);
  END IF;

  RETURN json_build_object(
    'colaborador_nome', v_link.colaborador_nome,
    'colaborador_cpf_parcial', '***.' || substring(v_link.colaborador_cpf from 5 for 3) || '.' || substring(v_link.colaborador_cpf from 8 for 3) || '-**',
    'tenant_id', v_link.tenant_id,
    'colaborador_id', v_link.colaborador_id,
    'colaborador_cpf', v_link.colaborador_cpf
  );
END;
$$;

-- 4) buscar_colaborador_por_cpf: identifica pelo CPF no link compartilhado
CREATE OR REPLACE FUNCTION public.buscar_colaborador_por_cpf(p_token TEXT, p_cpf TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link RECORD;
  v_colab RECORD;
BEGIN
  SELECT * INTO v_link FROM public.ponto_links
  WHERE token = p_token AND tipo = 'compartilhado' AND ativo = true
    AND (data_expiracao IS NULL OR data_expiracao > now());
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Link inválido ou expirado.');
  END IF;

  SELECT * INTO v_colab FROM public._ponto_resolver_colaborador_cpf(v_link.tenant_id, p_cpf);
  IF v_colab.colaborador_id IS NULL THEN
    RETURN json_build_object('error', 'CPF não encontrado ou colaborador sem ponto ativo. Confira os números e tente novamente.');
  END IF;

  RETURN json_build_object(
    'colaborador_nome', v_colab.colaborador_nome,
    'colaborador_cpf_parcial', '***.' || substring(v_colab.colaborador_cpf from 5 for 3) || '.' || substring(v_colab.colaborador_cpf from 8 for 3) || '-**',
    'tenant_id', v_link.tenant_id,
    'colaborador_id', v_colab.colaborador_id,
    'colaborador_cpf', v_colab.colaborador_cpf
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.buscar_colaborador_por_cpf(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buscar_colaborador_por_cpf(text, text) TO anon, authenticated;

-- 5) proximo_tipo_marcacao_externo_cpf -----------------------------------
-- Espelha proximo_tipo_marcacao_externo, mas resolvendo o colaborador pelo
-- CPF no link compartilhado.
CREATE OR REPLACE FUNCTION public.proximo_tipo_marcacao_externo_cpf(p_token TEXT, p_cpf TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_link RECORD;
  v_colab RECORD;
  v_data DATE;
  v_ultima RECORD;
  v_proximo TEXT;
  v_marcacoes JSON;
  v_afast public.afastamentos;
BEGIN
  SELECT * INTO v_link FROM public.ponto_links
  WHERE token = p_token AND tipo = 'compartilhado' AND ativo = true
    AND (data_expiracao IS NULL OR data_expiracao > now());
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Link inválido ou expirado.');
  END IF;

  SELECT * INTO v_colab FROM public._ponto_resolver_colaborador_cpf(v_link.tenant_id, p_cpf);
  IF v_colab.colaborador_id IS NULL THEN
    RETURN json_build_object('error', 'CPF não encontrado ou colaborador sem ponto ativo.');
  END IF;

  v_data := timezone('America/Sao_Paulo', now())::DATE;

  v_afast := public.afastamento_vigente(v_link.tenant_id, v_colab.colaborador_cpf, v_data);
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
    AND colaborador_cpf = v_colab.colaborador_cpf
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
    AND colaborador_cpf = v_colab.colaborador_cpf
    AND data_marcacao = v_data;

  RETURN json_build_object('proximo', v_proximo, 'marcacoes', v_marcacoes);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.proximo_tipo_marcacao_externo_cpf(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.proximo_tipo_marcacao_externo_cpf(text, text) TO anon, authenticated;

-- 6) registrar_ponto_externo_cpf (selfie OBRIGATÓRIA) --------------------
CREATE OR REPLACE FUNCTION public.registrar_ponto_externo_cpf(
  p_token text,
  p_cpf text,
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
  v_link RECORD; v_colab RECORD; v_marcacao_id UUID; v_hora TIME; v_data DATE;
  v_now TIMESTAMP; v_err TEXT; v_tipo TEXT; v_esperado TEXT; v_ultima RECORD;
  v_afast public.afastamentos;
BEGIN
  v_now := timezone('America/Sao_Paulo', now());
  v_hora := v_now::TIME;
  v_data := v_now::DATE;

  SELECT * INTO v_link FROM public.ponto_links
  WHERE token = p_token AND tipo = 'compartilhado' AND ativo = true
    AND (data_expiracao IS NULL OR data_expiracao > now());
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Link inválido ou expirado.');
  END IF;

  SELECT * INTO v_colab FROM public._ponto_resolver_colaborador_cpf(v_link.tenant_id, p_cpf);
  IF v_colab.colaborador_id IS NULL THEN
    RETURN json_build_object('error', 'CPF não encontrado ou colaborador sem ponto ativo.');
  END IF;

  -- Selfie obrigatória no link compartilhado (anti-fraude do CPF).
  IF p_selfie_url IS NULL OR btrim(p_selfie_url) = '' THEN
    RETURN json_build_object('error', 'É obrigatório tirar a selfie para registrar o ponto.');
  END IF;

  -- Afastamento vigente: dia abonado, sem registro.
  v_afast := public.afastamento_vigente(v_link.tenant_id, v_colab.colaborador_cpf, v_data);
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
    AND colaborador_cpf = v_colab.colaborador_cpf
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
      v_link.tenant_id, v_colab.colaborador_id, v_colab.colaborador_nome, v_colab.colaborador_cpf,
      v_data, v_hora, v_tipo, p_latitude, p_longitude, 'mobile_web',
      encode(sha256((v_colab.colaborador_cpf || v_data::text || v_hora::text || v_tipo || clock_timestamp()::text)::bytea), 'hex'),
      true, p_endereco, p_selfie_url, p_selfie_nome
    ) RETURNING id INTO v_marcacao_id;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    RETURN json_build_object('error', COALESCE(v_err, 'Não foi possível registrar agora.'));
  END;

  RETURN json_build_object(
    'success', true,
    'marcacao_id', v_marcacao_id,
    'colaborador_nome', v_colab.colaborador_nome,
    'tipo_marcacao', v_tipo,
    'hora', to_char(v_hora, 'HH24:MI:SS'),
    'data', to_char(v_data, 'DD/MM/YYYY')
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.registrar_ponto_externo_cpf(text, text, text, double precision, double precision, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_ponto_externo_cpf(text, text, text, double precision, double precision, text, text, text) TO anon, authenticated;

-- 7) Ajuste de ponto pelo CPF (schema externo) + wrappers ----------------
GRANT USAGE ON SCHEMA externo TO anon, authenticated;

CREATE OR REPLACE FUNCTION externo.listar_ponto_externo_cpf(p_token text, p_cpf text, p_dias integer DEFAULT 45)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link RECORD;
  v_colab RECORD;
  v_marcacoes JSONB;
  v_ajustes JSONB;
BEGIN
  SELECT * INTO v_link FROM public.ponto_links
  WHERE token = p_token AND tipo = 'compartilhado' AND ativo = true
    AND (data_expiracao IS NULL OR data_expiracao > now());
  IF NOT FOUND THEN
    RETURN json_build_object('error','Link inválido ou expirado.');
  END IF;

  SELECT * INTO v_colab FROM public._ponto_resolver_colaborador_cpf(v_link.tenant_id, p_cpf);
  IF v_colab.colaborador_id IS NULL THEN
    RETURN json_build_object('error','CPF não encontrado ou colaborador sem ponto ativo.');
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', m.id, 'data', m.data_marcacao, 'hora', m.hora_marcacao, 'tipo', m.tipo_marcacao
  ) ORDER BY m.data_marcacao DESC, m.hora_marcacao ASC), '[]'::jsonb)
  INTO v_marcacoes
  FROM public.ponto_marcacoes m
  WHERE m.colaborador_id = v_colab.colaborador_id
    AND m.data_marcacao >= (CURRENT_DATE - (p_dias || ' days')::interval)::date
    AND m.data_marcacao <= CURRENT_DATE;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', a.id, 'data', a.data_referencia, 'hora', a.hora_solicitada, 'tipo', a.tipo_marcacao,
    'tipo_ajuste', a.tipo_ajuste, 'status', a.status, 'motivo', a.motivo
  ) ORDER BY a.data_referencia DESC, a.created_at DESC), '[]'::jsonb)
  INTO v_ajustes
  FROM public.ponto_ajustes a
  WHERE a.colaborador_id = v_colab.colaborador_id
    AND a.data_referencia >= (CURRENT_DATE - (p_dias || ' days')::interval)::date;

  RETURN json_build_object(
    'success', true,
    'colaborador_nome', v_colab.colaborador_nome,
    'marcacoes', v_marcacoes,
    'ajustes', v_ajustes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION externo.listar_ponto_externo_cpf(text, text, integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION externo.solicitar_ajustes_ponto_externo_cpf_batch(
  p_token text,
  p_cpf text,
  p_itens jsonb,
  p_motivo text DEFAULT NULL,
  p_anexos jsonb DEFAULT '[]'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link RECORD;
  v_colab RECORD;
  v_item JSONB;
  v_data DATE;
  v_hora TIME;
  v_tipo TEXT;
  v_hora_original TIME;
  v_tipo_ajuste TEXT;
  v_motivo_item TEXT;
  v_now TIMESTAMPTZ := now();
  v_ids UUID[] := ARRAY[]::UUID[];
  v_id UUID;
  v_count INT := 0;
BEGIN
  IF p_itens IS NULL OR jsonb_array_length(p_itens) = 0 THEN
    RETURN json_build_object('error','Inclua ao menos uma marcação para ajuste.');
  END IF;
  IF jsonb_array_length(p_itens) > 40 THEN
    RETURN json_build_object('error','Máximo de 40 ajustes por solicitação.');
  END IF;

  SELECT * INTO v_link FROM public.ponto_links
  WHERE token = p_token AND tipo = 'compartilhado' AND ativo = true
    AND (data_expiracao IS NULL OR data_expiracao > now());
  IF NOT FOUND THEN
    RETURN json_build_object('error','Link inválido ou expirado.');
  END IF;

  SELECT * INTO v_colab FROM public._ponto_resolver_colaborador_cpf(v_link.tenant_id, p_cpf);
  IF v_colab.colaborador_id IS NULL THEN
    RETURN json_build_object('error','CPF não encontrado ou colaborador sem ponto ativo.');
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_data := (v_item->>'data')::date;
    v_hora := (v_item->>'hora')::time;
    v_tipo := v_item->>'tipo';
    v_hora_original := NULLIF(v_item->>'hora_original','')::time;
    v_tipo_ajuste := CASE WHEN v_hora_original IS NOT NULL THEN 'correcao' ELSE 'inclusao' END;
    v_motivo_item := COALESCE(NULLIF(trim(v_item->>'motivo'),''), NULLIF(trim(p_motivo),''));

    IF v_motivo_item IS NULL OR length(v_motivo_item) < 5 THEN
      RETURN json_build_object('error','Cada ajuste precisa de uma justificativa (mín. 5 caracteres).');
    END IF;
    IF v_tipo NOT IN ('entrada','saida','saida_almoco','retorno_almoco') THEN
      RETURN json_build_object('error','Tipo de marcação inválido: ' || COALESCE(v_tipo,'(vazio)'));
    END IF;
    IF v_data IS NULL OR v_hora IS NULL THEN
      RETURN json_build_object('error','Data e hora são obrigatórios para cada ajuste.');
    END IF;
    IF v_data > CURRENT_DATE THEN
      RETURN json_build_object('error','Não é permitido solicitar ajuste para data futura.');
    END IF;
    IF v_data = CURRENT_DATE AND (v_data + v_hora) > v_now THEN
      RETURN json_build_object('error','Não é permitido solicitar ajuste para horário futuro.');
    END IF;

    INSERT INTO public.ponto_ajustes (
      tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
      data_referencia, tipo_ajuste, tipo_marcacao,
      hora_solicitada, hora_original, motivo, status, created_by_nome, anexos
    ) VALUES (
      v_link.tenant_id, v_colab.colaborador_id, v_colab.colaborador_nome, v_colab.colaborador_cpf,
      v_data, v_tipo_ajuste, v_tipo,
      v_hora, v_hora_original, v_motivo_item, 'pendente',
      v_colab.colaborador_nome || ' (link compartilhado)', COALESCE(p_anexos, '[]'::jsonb)
    ) RETURNING id INTO v_id;
    v_ids := v_ids || v_id;
    v_count := v_count + 1;
  END LOOP;

  RETURN json_build_object('success', true, 'total', v_count, 'ids', to_jsonb(v_ids));
END;
$$;

GRANT EXECUTE ON FUNCTION externo.solicitar_ajustes_ponto_externo_cpf_batch(text, text, jsonb, text, jsonb) TO anon, authenticated;

-- Wrappers públicos (SECURITY INVOKER) — mesmo padrão dos existentes.
CREATE OR REPLACE FUNCTION public.listar_ponto_externo_cpf(p_token text, p_cpf text, p_dias integer DEFAULT 45)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN externo.listar_ponto_externo_cpf(p_token, p_cpf, p_dias);
END;
$$;

CREATE OR REPLACE FUNCTION public.solicitar_ajustes_ponto_externo_cpf_batch(
  p_token text,
  p_cpf text,
  p_itens jsonb,
  p_motivo text DEFAULT NULL,
  p_anexos jsonb DEFAULT '[]'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN externo.solicitar_ajustes_ponto_externo_cpf_batch(p_token, p_cpf, p_itens, p_motivo, p_anexos);
END;
$$;

GRANT EXECUTE ON FUNCTION public.listar_ponto_externo_cpf(text, text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.solicitar_ajustes_ponto_externo_cpf_batch(text, text, jsonb, text, jsonb) TO anon, authenticated;
