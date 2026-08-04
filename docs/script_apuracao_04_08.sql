-- ============================================================
-- Correções da apuração — 04/08/2026
--   1) escala não resolvida deixa de derrubar a apuração inteira
--   2) sábado fora do dia de equalização não cobra jornada
--   3) segundos truncados na apuração e na consolidação
--   4) ferramenta para a escala vinculada de outro tenant
-- Idempotente. Nenhuma parte interrompe as outras: o que não
-- encontrar seu alvo apenas avisa.
-- ============================================================
DO $tudo$
DECLARE
  d text;
  v_alvo text;
  v_novo text;
BEGIN
  ---------------------------------------------------------------- 1
  BEGIN
    d := pg_get_functiondef('public.ponto_saldo_dias_competencia(uuid,text,text)'::regprocedure);
    IF position('escala nao resolvida: segue sem equalizacao' in d) > 0 THEN
      RAISE NOTICE '1/4 tolerancia a escala ausente: ja aplicada';
    ELSE
      v_alvo := 'v_eq_m := public.ponto_equalizacao_competencia(p_tenant_id, v_fb_escala_id, p_competencia);';
      IF position(v_alvo in d) = 0 THEN
        RAISE NOTICE '1/4 tolerancia: TRECHO NAO ENCONTRADO — nada feito';
      ELSE
        v_novo := 'BEGIN' || E'\n'
               || '        -- escala nao resolvida: segue sem equalizacao em vez de derrubar' || E'\n'
               || '        -- a apuracao de todos os colaboradores da tela.' || E'\n'
               || '        v_eq_m := public.ponto_equalizacao_competencia(p_tenant_id, v_fb_escala_id, p_competencia);' || E'\n'
               || '      EXCEPTION WHEN OTHERS THEN' || E'\n'
               || '        v_eq_m := NULL;' || E'\n'
               || '      END;';
        EXECUTE replace(d, v_alvo, v_novo);
        RAISE NOTICE '1/4 tolerancia a escala ausente: APLICADA';
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE '1/4 tolerancia: falhou (%)', SQLERRM;
  END;

  ---------------------------------------------------------------- 2
  BEGIN
    d := pg_get_functiondef('public.ponto_saldo_dias_competencia(uuid,text,text)'::regprocedure);
    IF position('RN14: sabado fora do dia de equalizacao' in d) > 0 THEN
      RAISE NOTICE '2/4 sabado fora da equalizacao: ja aplicada';
    ELSE
      v_alvo := 'v_tol := CASE WHEN COALESCE(v_tol, 0) <> 0 THEN v_tol ELSE COALESCE(v_fb_tol, 0) END;';
      IF position(v_alvo in d) = 0 THEN
        RAISE NOTICE '2/4 sabado: TRECHO NAO ENCONTRADO — nada feito';
      ELSE
        v_novo := '-- RN14: sabado fora do dia de equalizacao nao tem obrigacao de jornada.' || E'\n'
               || '    IF v_eq_data IS NOT NULL' || E'\n'
               || '       AND EXTRACT(ISODOW FROM r.data) = 6' || E'\n'
               || '       AND r.data <> v_eq_data THEN' || E'\n'
               || '      v_esperado := 0;' || E'\n'
               || '    END IF;' || E'\n'
               || '    ' || v_alvo;
        EXECUTE replace(d, v_alvo, v_novo);
        RAISE NOTICE '2/4 sabado fora da equalizacao: APLICADA';
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE '2/4 sabado: falhou (%)', SQLERRM;
  END;

  ---------------------------------------------------------------- 3a
  BEGIN
    d := pg_get_functiondef('public.ponto_saldo_dias_competencia(uuid,text,text)'::regprocedure);
    IF position('floor(EXTRACT(EPOCH FROM' in d) > 0 THEN
      RAISE NOTICE '3/4 segundos na apuracao: ja aplicada';
    ELSE
      v_alvo := 'v_janela := (EXTRACT(EPOCH FROM r.saida)/60)::int - (EXTRACT(EPOCH FROM r.entrada)/60)::int;';
      IF position(v_alvo in d) = 0 THEN
        RAISE NOTICE '3/4 segundos na apuracao: TRECHO NAO ENCONTRADO — nada feito';
      ELSE
        d := replace(d, v_alvo, 'v_janela := floor(EXTRACT(EPOCH FROM (r.saida - r.entrada))/60)::int;');
        d := regexp_replace(d, '\(EXTRACT\(EPOCH FROM ([a-zA-Z_][a-zA-Z0-9_\.]*)\)/60\)::int',
                            'floor(EXTRACT(EPOCH FROM \1)/60)::int', 'g');
        EXECUTE d;
        RAISE NOTICE '3/4 segundos na apuracao: APLICADA';
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE '3/4 segundos na apuracao: falhou (%)', SQLERRM;
  END;

  ---------------------------------------------------------------- 3b
  BEGIN
    d := pg_get_functiondef('public._ponto_calc_dia(uuid,text,date,uuid)'::regprocedure);
    IF position('floor(EXTRACT(EPOCH FROM (v_marc.hora_marcacao' in d) > 0 THEN
      RAISE NOTICE '3/4 segundos na consolidacao: ja aplicada';
    ELSE
      v_alvo := '(EXTRACT(EPOCH FROM (v_marc.hora_marcacao - v_abr)) / 60)::INT';
      IF position(v_alvo in d) = 0 THEN
        RAISE NOTICE '3/4 segundos na consolidacao: TRECHO NAO ENCONTRADO — nada feito';
      ELSE
        EXECUTE replace(d, v_alvo, 'floor(EXTRACT(EPOCH FROM (v_marc.hora_marcacao - v_abr)) / 60)::INT');
        RAISE NOTICE '3/4 segundos na consolidacao: APLICADA';
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE '3/4 segundos na consolidacao: falhou (%)', SQLERRM;
  END;
END $tudo$;

-- REGISTRO DA CORREÇÃO — é o que permite desfazer -----------------------
CREATE TABLE IF NOT EXISTS public.ponto_escala_copia_tenant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,            -- tenant que passou a ter a cópia
  escala_origem_id uuid NOT NULL,     -- escala do outro tenant
  escala_origem_tenant uuid NOT NULL,
  escala_copia_id uuid NOT NULL,
  atribuicoes_repontadas integer NOT NULL DEFAULT 0,
  executado_em timestamptz NOT NULL DEFAULT now(),
  executado_por uuid,
  UNIQUE (tenant_id, escala_origem_id)
);

GRANT SELECT ON public.ponto_escala_copia_tenant TO authenticated;
GRANT ALL ON public.ponto_escala_copia_tenant TO service_role;
ALTER TABLE public.ponto_escala_copia_tenant ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant le ponto_escala_copia_tenant" ON public.ponto_escala_copia_tenant;
CREATE POLICY "Tenant le ponto_escala_copia_tenant" ON public.ponto_escala_copia_tenant
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_user_tenant_id());

-- DIAGNÓSTICO — o que está fora do lugar --------------------------------
CREATE OR REPLACE FUNCTION public.ponto_escalas_cross_tenant()
RETURNS TABLE(
  tenant_da_atribuicao uuid,
  escala_id uuid,
  tenant_da_escala uuid,
  escala_nome text,
  colaboradores integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT a.tenant_id, a.escala_id, e.tenant_id, e.nome, count(DISTINCT a.colaborador_cpf)::int
  FROM public.ponto_escala_atribuicoes a
  JOIN public.ponto_escalas e ON e.id = a.escala_id
  WHERE COALESCE(a.ativa, true)
    AND e.tenant_id IS DISTINCT FROM a.tenant_id
  GROUP BY 1, 2, 3, 4
  ORDER BY 1, 4;
$$;

GRANT EXECUTE ON FUNCTION public.ponto_escalas_cross_tenant() TO authenticated;

-- CORREÇÃO — copia a escala para o tenant que a usa e repõe o vínculo ---
CREATE OR REPLACE FUNCTION public.ponto_escalas_corrigir_tenant(
  p_tenant_id uuid DEFAULT NULL,
  p_aplicar boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
  v_nova uuid;
  v_emp uuid;
  v_n_escalas int := 0;
  v_n_atrib int := 0;
  v_detalhe jsonb := '[]'::jsonb;
BEGIN
  FOR r IN
    SELECT * FROM public.ponto_escalas_cross_tenant()
    WHERE p_tenant_id IS NULL OR tenant_da_atribuicao = p_tenant_id
  LOOP
    v_detalhe := v_detalhe || jsonb_build_object(
      'tenant', r.tenant_da_atribuicao,
      'escala_origem', r.escala_id,
      'escala_nome', r.escala_nome,
      'colaboradores', r.colaboradores);

    v_n_escalas := v_n_escalas + 1;
    v_n_atrib := v_n_atrib + r.colaboradores;

    CONTINUE WHEN NOT p_aplicar;

    -- Já copiada numa execução anterior: reaproveita.
    SELECT escala_copia_id INTO v_nova
    FROM public.ponto_escala_copia_tenant
    WHERE tenant_id = r.tenant_da_atribuicao AND escala_origem_id = r.escala_id;

    IF v_nova IS NULL THEN
      -- empresa da escala só vem junto se existir no tenant de destino;
      -- caso contrário a cópia herdaria outra referência cruzada.
      SELECT ec.id INTO v_emp
      FROM public.ponto_escalas e
      JOIN public.empresa_cadastro ec
        ON ec.id = e.empresa_id AND ec.tenant_id = r.tenant_da_atribuicao
      WHERE e.id = r.escala_id;

      INSERT INTO public.ponto_escalas (
        tenant_id, empresa_id, nome, tipo, descricao_contratual, descricao_original,
        dias_config, dias_semana, compensacoes_mensais, regras_extras, observacoes,
        jornada_diaria_minutos, jornada_semanal_minutos, jornada_mensal_minutos,
        carga_semanal_contratada_min, intervalo_intrajornada_minutos,
        tolerancia_minutos, tolerancia_diaria_minutos,
        hora_entrada_padrao, hora_saida_padrao, janela_flexivel,
        adicional_noturno_inicio, adicional_noturno_fim, percentual_adicional_noturno,
        usa_hora_ficta_noturna, percentual_hora_extra_50, percentual_hora_extra_100,
        sabado_util, domingo_util, comportamento_feriado, equalizacao_mensal_ativa,
        ciclo_horas_trabalho, ciclo_horas_descanso, ciclo_inicio_data, ciclo_inicio_hora,
        modalidade, origem_input, nivel_confianca, ativa
      )
      SELECT
        r.tenant_da_atribuicao, v_emp, e.nome, e.tipo, e.descricao_contratual, e.descricao_original,
        e.dias_config, e.dias_semana, e.compensacoes_mensais, e.regras_extras, e.observacoes,
        e.jornada_diaria_minutos, e.jornada_semanal_minutos, e.jornada_mensal_minutos,
        e.carga_semanal_contratada_min, e.intervalo_intrajornada_minutos,
        e.tolerancia_minutos, e.tolerancia_diaria_minutos,
        e.hora_entrada_padrao, e.hora_saida_padrao, e.janela_flexivel,
        e.adicional_noturno_inicio, e.adicional_noturno_fim, e.percentual_adicional_noturno,
        e.usa_hora_ficta_noturna, e.percentual_hora_extra_50, e.percentual_hora_extra_100,
        e.sabado_util, e.domingo_util, e.comportamento_feriado, e.equalizacao_mensal_ativa,
        e.ciclo_horas_trabalho, e.ciclo_horas_descanso, e.ciclo_inicio_data, e.ciclo_inicio_hora,
        e.modalidade, e.origem_input, e.nivel_confianca, e.ativa
      FROM public.ponto_escalas e
      WHERE e.id = r.escala_id
      RETURNING id INTO v_nova;

      -- Blocos de horário e recorrências acompanham a escala: sem eles a
      -- cópia teria jornada mas não teria horário.
      INSERT INTO public.ponto_escala_periodos (tenant_id, escala_id, dia_semana, hora_inicio, hora_fim, ordem_bloco)
      SELECT r.tenant_da_atribuicao, v_nova, p.dia_semana, p.hora_inicio, p.hora_fim, p.ordem_bloco
      FROM public.ponto_escala_periodos p WHERE p.escala_id = r.escala_id;

      INSERT INTO public.ponto_escala_recorrencias (tenant_id, escala_id, dia_semana, ordinal_mes, hora_inicio, hora_fim, descricao, observacao)
      SELECT r.tenant_da_atribuicao, v_nova, c.dia_semana, c.ordinal_mes, c.hora_inicio, c.hora_fim, c.descricao, c.observacao
      FROM public.ponto_escala_recorrencias c WHERE c.escala_id = r.escala_id;

      INSERT INTO public.ponto_escala_copia_tenant (
        tenant_id, escala_origem_id, escala_origem_tenant, escala_copia_id, executado_por)
      VALUES (r.tenant_da_atribuicao, r.escala_id, r.tenant_da_escala, v_nova, auth.uid());
    END IF;

    UPDATE public.ponto_escala_atribuicoes
       SET escala_id = v_nova
     WHERE tenant_id = r.tenant_da_atribuicao
       AND escala_id = r.escala_id;

    UPDATE public.ponto_escala_copia_tenant
       SET atribuicoes_repontadas = r.colaboradores
     WHERE tenant_id = r.tenant_da_atribuicao AND escala_origem_id = r.escala_id;

    v_nova := NULL;
  END LOOP;

  RETURN jsonb_build_object(
    'aplicado', p_aplicar,
    'escalas', v_n_escalas,
    'colaboradores', v_n_atrib,
    'detalhe', v_detalhe
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ponto_escalas_corrigir_tenant(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ponto_escalas_corrigir_tenant(uuid, boolean) TO authenticated;

COMMENT ON FUNCTION public.ponto_escalas_corrigir_tenant(uuid, boolean) IS
  'Copia para o tenant que a usa cada escala vinculada a partir de outro tenant e repõe as atribuições. p_aplicar=false apenas relata. O tenant de origem não é alterado.';

-- 1) RECÁLCULO DIRETO --------------------------------------------------
-- Soma os pares entrada→saída truncando cada par ao minuto. Devolve NULL
-- quando não há par completo — dia anômalo não é dia para corrigir no
-- automático.
CREATE OR REPLACE FUNCTION public.ponto_minutos_das_marcacoes(
  p_tenant_id uuid,
  p_colaborador_cpf text,
  p_data date
)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  m RECORD;
  v_abr time;
  v_esp text := 'in';
  v_classe text;
  v_dif int;
  v_min int := 0;
  v_pares int := 0;
BEGIN
  FOR m IN
    SELECT hora_marcacao, tipo_marcacao
    FROM public.ponto_marcacoes
    WHERE tenant_id = p_tenant_id
      AND colaborador_cpf = p_colaborador_cpf
      AND data_marcacao = p_data
    ORDER BY hora_marcacao
  LOOP
    v_classe := COALESCE(public.ponto_classifica_tipo(m.tipo_marcacao), v_esp);
    IF v_classe = 'in' THEN
      v_abr := m.hora_marcacao;
      v_esp := 'out';
    ELSE
      IF v_abr IS NOT NULL THEN
        v_dif := floor(EXTRACT(EPOCH FROM (m.hora_marcacao - v_abr)) / 60)::int;
        IF v_dif < 0 THEN v_dif := v_dif + 1440; END IF;
        v_min := v_min + GREATEST(0, v_dif);
        v_pares := v_pares + 1;
        v_abr := NULL;
      END IF;
      v_esp := 'in';
    END IF;
  END LOOP;

  IF v_pares = 0 THEN
    RETURN NULL;
  END IF;

  RETURN v_min;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ponto_minutos_das_marcacoes(uuid, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ponto_minutos_das_marcacoes(uuid, text, date) TO authenticated;

-- 2) CORREÇÃO DOS DIAS JÁ GRAVADOS ------------------------------------
-- Alcança inclusive os dias abonados, que a reconsolidação não recalcula.
-- Só mexe onde o valor gravado difere do recalculado, e só quando existe
-- par completo de marcações.
CREATE OR REPLACE FUNCTION public.ponto_corrigir_horas_arredondadas(
  p_tenant_id uuid DEFAULT NULL,
  p_desde date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
  v_min int;
  v_atual int;
  v_n int := 0;
  v_minutos int := 0;
BEGIN
  FOR r IN
    SELECT d.tenant_id, d.colaborador_cpf, d.data, d.horas_trabalhadas
    FROM public.ponto_diario d
    WHERE (p_tenant_id IS NULL OR d.tenant_id = p_tenant_id)
      AND (p_desde IS NULL OR d.data >= p_desde)
      AND EXISTS (
        SELECT 1 FROM public.ponto_marcacoes m
        WHERE m.tenant_id = d.tenant_id
          AND m.colaborador_cpf = d.colaborador_cpf
          AND m.data_marcacao = d.data
          AND EXTRACT(SECOND FROM m.hora_marcacao) <> 0
      )
  LOOP
    v_min := public.ponto_minutos_das_marcacoes(r.tenant_id, r.colaborador_cpf, r.data);
    IF v_min IS NULL THEN CONTINUE; END IF;

    v_atual := COALESCE((EXTRACT(EPOCH FROM r.horas_trabalhadas) / 60)::int, 0);
    IF v_atual = v_min THEN CONTINUE; END IF;

    UPDATE public.ponto_diario
       SET horas_trabalhadas = make_interval(mins => v_min),
           updated_at = now()
     WHERE tenant_id = r.tenant_id
       AND colaborador_cpf = r.colaborador_cpf
       AND data = r.data;

    v_n := v_n + 1;
    v_minutos := v_minutos + (v_atual - v_min);
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'dias_corrigidos', v_n,
    'minutos_devolvidos', v_minutos
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ponto_corrigir_horas_arredondadas(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ponto_corrigir_horas_arredondadas(uuid, date) TO authenticated;

-- 3) RODA AGORA --------------------------------------------------------
DO $corrige$
DECLARE v_res jsonb;
BEGIN
  v_res := public.ponto_corrigir_horas_arredondadas(NULL, NULL);
  RAISE NOTICE '4/4 correcao de horas arredondadas: %', v_res::text;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '4/4 correcao de horas arredondadas: falhou (%)', SQLERRM;
END $corrige$;

COMMENT ON FUNCTION public.ponto_corrigir_horas_arredondadas(uuid, date) IS
  'Recalcula ponto_diario.horas_trabalhadas direto das marcações, truncando os segundos. Alcança dias abonados, que consolidar_ponto_diario_manual não recalcula.';

-- ============================================================
-- CONFERENCIA — to_regprocedure devolve NULL quando a funcao nao existe,
-- entao a conferencia nunca quebra por causa de uma ausencia.
SELECT
  position('escala nao resolvida' in COALESCE(pg_get_functiondef(
    to_regprocedure('public.ponto_saldo_dias_competencia(uuid,text,text)')), '')) > 0 AS tolerancia_ok,
  position('RN14: sabado fora' in COALESCE(pg_get_functiondef(
    to_regprocedure('public.ponto_saldo_dias_competencia(uuid,text,text)')), '')) > 0 AS sabado_ok,
  position('floor(EXTRACT(EPOCH FROM' in COALESCE(pg_get_functiondef(
    to_regprocedure('public.ponto_saldo_dias_competencia(uuid,text,text)')), '')) > 0 AS segundos_apuracao_ok,
  position('floor(EXTRACT(EPOCH FROM (v_marc.hora_marcacao' in COALESCE(pg_get_functiondef(
    to_regprocedure('public._ponto_calc_dia(uuid,text,date,uuid)')), '')) > 0 AS segundos_consolidacao_ok,
  to_regprocedure('public.ponto_escalas_corrigir_tenant(uuid,boolean)') IS NOT NULL AS ferramenta_escala_ok,
  to_regprocedure('public.ponto_corrigir_horas_arredondadas(uuid,date)') IS NOT NULL AS reparo_horas_ok;
