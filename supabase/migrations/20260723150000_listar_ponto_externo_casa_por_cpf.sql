-- =====================================================================
-- FOLHA DE AJUSTE EXTERNA: listar marcações casando por CPF (não por id)
-- =====================================================================
-- Sintoma: na folha de ajuste aberta pelo LINK do colaborador
-- (/ponto-externo/<token> -> SolicitarAjusteModal), todas as marcações
-- apareciam como "Sem marcações", mesmo a pessoa tendo registrado ponto.
--
-- Causa: externo.listar_ponto_externo filtrava por
-- `colaborador_id = v_link.colaborador_id`. Quando o colaborador_id gravado
-- nas marcações diverge do id do link (ex.: admissão recriada -> novo id, mas
-- o CPF é o mesmo), nada aparece — enquanto o Espelho e a folha interna já
-- casam por dígitos do CPF.
--
-- Correção: casar por dígitos do CPF, escopado por tenant (CPF não é único
-- entre tenants — por isso o tenant_id passa a ser exigido no filtro).
-- Vale para a versão por token (link por colaborador) e a por CPF (link
-- compartilhado). Só leitura; não altera criação de ajustes nem marcações.
-- =====================================================================

-- 1) Link por colaborador (token) ----------------------------------------
CREATE OR REPLACE FUNCTION externo.listar_ponto_externo(p_token text, p_dias integer DEFAULT 45)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link RECORD;
  v_cpf text;
  v_marcacoes JSONB;
  v_ajustes JSONB;
BEGIN
  SELECT * INTO v_link FROM public.ponto_links
  WHERE token = p_token AND ativo = true
    AND (data_expiracao IS NULL OR data_expiracao > now());
  IF NOT FOUND THEN
    RETURN json_build_object('error','Link inválido ou expirado.');
  END IF;

  v_cpf := regexp_replace(COALESCE(v_link.colaborador_cpf,''), '\D', '', 'g');
  IF length(v_cpf) <> 11 THEN
    -- Sem CPF válido no link, mantém o casamento por id (comportamento antigo).
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', m.id, 'data', m.data_marcacao, 'hora', m.hora_marcacao, 'tipo', m.tipo_marcacao
    ) ORDER BY m.data_marcacao DESC, m.hora_marcacao ASC), '[]'::jsonb)
    INTO v_marcacoes
    FROM public.ponto_marcacoes m
    WHERE m.colaborador_id = v_link.colaborador_id::uuid
      AND m.data_marcacao >= (CURRENT_DATE - (p_dias || ' days')::interval)::date
      AND m.data_marcacao <= CURRENT_DATE;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', a.id, 'data', a.data_referencia, 'hora', a.hora_solicitada, 'tipo', a.tipo_marcacao,
      'tipo_ajuste', a.tipo_ajuste, 'status', a.status, 'motivo', a.motivo
    ) ORDER BY a.data_referencia DESC, a.created_at DESC), '[]'::jsonb)
    INTO v_ajustes
    FROM public.ponto_ajustes a
    WHERE a.colaborador_id = v_link.colaborador_id::uuid
      AND a.data_referencia >= (CURRENT_DATE - (p_dias || ' days')::interval)::date;
  ELSE
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', m.id, 'data', m.data_marcacao, 'hora', m.hora_marcacao, 'tipo', m.tipo_marcacao
    ) ORDER BY m.data_marcacao DESC, m.hora_marcacao ASC), '[]'::jsonb)
    INTO v_marcacoes
    FROM public.ponto_marcacoes m
    WHERE m.tenant_id = v_link.tenant_id
      AND regexp_replace(COALESCE(m.colaborador_cpf,''), '\D', '', 'g') = v_cpf
      AND m.data_marcacao >= (CURRENT_DATE - (p_dias || ' days')::interval)::date
      AND m.data_marcacao <= CURRENT_DATE;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', a.id, 'data', a.data_referencia, 'hora', a.hora_solicitada, 'tipo', a.tipo_marcacao,
      'tipo_ajuste', a.tipo_ajuste, 'status', a.status, 'motivo', a.motivo
    ) ORDER BY a.data_referencia DESC, a.created_at DESC), '[]'::jsonb)
    INTO v_ajustes
    FROM public.ponto_ajustes a
    WHERE a.tenant_id = v_link.tenant_id
      AND regexp_replace(COALESCE(a.colaborador_cpf,''), '\D', '', 'g') = v_cpf
      AND a.data_referencia >= (CURRENT_DATE - (p_dias || ' days')::interval)::date;
  END IF;

  RETURN json_build_object(
    'success', true,
    'colaborador_nome', v_link.colaborador_nome,
    'marcacoes', v_marcacoes,
    'ajustes', v_ajustes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION externo.listar_ponto_externo(text, integer) TO anon, authenticated;

-- 2) Link compartilhado (CPF) — mesma resiliência -----------------------
CREATE OR REPLACE FUNCTION externo.listar_ponto_externo_cpf(p_token text, p_cpf text, p_dias integer DEFAULT 45)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link RECORD;
  v_colab RECORD;
  v_cpf text;
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

  v_cpf := regexp_replace(COALESCE(v_colab.colaborador_cpf,''), '\D', '', 'g');

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', m.id, 'data', m.data_marcacao, 'hora', m.hora_marcacao, 'tipo', m.tipo_marcacao
  ) ORDER BY m.data_marcacao DESC, m.hora_marcacao ASC), '[]'::jsonb)
  INTO v_marcacoes
  FROM public.ponto_marcacoes m
  WHERE m.tenant_id = v_link.tenant_id
    AND regexp_replace(COALESCE(m.colaborador_cpf,''), '\D', '', 'g') = v_cpf
    AND m.data_marcacao >= (CURRENT_DATE - (p_dias || ' days')::interval)::date
    AND m.data_marcacao <= CURRENT_DATE;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', a.id, 'data', a.data_referencia, 'hora', a.hora_solicitada, 'tipo', a.tipo_marcacao,
    'tipo_ajuste', a.tipo_ajuste, 'status', a.status, 'motivo', a.motivo
  ) ORDER BY a.data_referencia DESC, a.created_at DESC), '[]'::jsonb)
  INTO v_ajustes
  FROM public.ponto_ajustes a
  WHERE a.tenant_id = v_link.tenant_id
    AND regexp_replace(COALESCE(a.colaborador_cpf,''), '\D', '', 'g') = v_cpf
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
