
-- Corrige os triggers de pós-processamento do questionário psicossocial
-- para não abortar a transação principal em caso de erro interno.

CREATE OR REPLACE FUNCTION public.atualizar_ips_campanha()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total INT;
  v_avg_ips NUMERIC;
  v_classificacao TEXT;
  v_radar JSONB;
  v_avg_irps NUMERIC;
  v_avg_ibo NUMERIC;
  v_avg_ibd NUMERIC;
  v_avg_irec NUMERIC;
  v_avg_icop NUMERIC;
  v_avg_inot NUMERIC;
BEGIN
  BEGIN
    SELECT COUNT(*) INTO v_total
    FROM public.questionario_psicossocial_respostas
    WHERE campanha_id = NEW.campanha_id;

    SELECT 
      ROUND(AVG((indicadores->>'IPS')::numeric)),
      ROUND(AVG((indicadores->>'IRP_S')::numeric)),
      ROUND(AVG((indicadores->>'IBO_S')::numeric)),
      ROUND(AVG((indicadores->>'IBD_S')::numeric)),
      ROUND(AVG((indicadores->>'IREC_S')::numeric)),
      ROUND(AVG((indicadores->>'ICOP_S')::numeric)),
      ROUND(AVG((indicadores->>'INOT_S')::numeric))
    INTO v_avg_ips, v_avg_irps, v_avg_ibo, v_avg_ibd, v_avg_irec, v_avg_icop, v_avg_inot
    FROM public.questionario_psicossocial_respostas
    WHERE campanha_id = NEW.campanha_id
      AND indicadores IS NOT NULL
      AND indicadores->>'IPS' IS NOT NULL;

    v_classificacao := CASE
      WHEN v_avg_ips >= 80 THEN 'saudavel'
      WHEN v_avg_ips >= 65 THEN 'estavel'
      WHEN v_avg_ips >= 50 THEN 'atencao'
      WHEN v_avg_ips >= 35 THEN 'risco'
      ELSE 'critico'
    END;

    SELECT jsonb_agg(
      jsonb_build_object(
        'subject', agg.subject,
        'value', ROUND(agg.avg_val),
        'fullMark', 100
      ) ORDER BY agg.min_ord
    )
    INTO v_radar
    FROM (
      SELECT 
        elem->>'subject' AS subject,
        AVG((elem->>'value')::numeric) AS avg_val,
        MIN(ord) AS min_ord
      FROM public.questionario_psicossocial_respostas r,
           jsonb_array_elements(r.indicadores->'radar') WITH ORDINALITY AS t(elem, ord)
      WHERE r.campanha_id = NEW.campanha_id
        AND r.indicadores IS NOT NULL
        AND r.indicadores->'radar' IS NOT NULL
      GROUP BY elem->>'subject'
    ) agg;

    UPDATE public.questionario_psicossocial_campanhas
    SET 
      total_respostas = v_total,
      ips_score = v_avg_ips,
      ips_classificacao = v_classificacao,
      radar_data = COALESCE(v_radar, radar_data),
      irps_score = v_avg_irps,
      ibo_score = v_avg_ibo,
      ibd_score = v_avg_ibd,
      irec_score = v_avg_irec,
      icop_score = v_avg_icop,
      inot_score = v_avg_inot,
      updated_at = now()
    WHERE id = NEW.campanha_id;
  EXCEPTION WHEN OTHERS THEN
    -- Não abortar a transação principal; apenas registrar
    RAISE WARNING 'atualizar_ips_campanha falhou: %', SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.gerar_alertas_psicossociais()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_campanha_nome text;
  v_total int;
BEGIN
  BEGIN
    SELECT tenant_id, nome, total_respostas 
    INTO v_tenant_id, v_campanha_nome, v_total
    FROM public.questionario_psicossocial_campanhas
    WHERE id = NEW.campanha_id;

    IF v_tenant_id IS NULL OR COALESCE(v_total, 0) < 5 THEN RETURN NEW; END IF;
    IF NEW.indicadores IS NULL OR NEW.indicadores->'radar' IS NULL THEN RETURN NEW; END IF;

    -- Inserir alertas para dimensões em risco elevado, alto ou crítico
    INSERT INTO public.psicossocial_alertas (
      tenant_id, campanha_id, dimensao_id, dimensao_nome,
      score_risco, score_ips, classificacao, resolvido
    )
    SELECT
      v_tenant_id,
      NEW.campanha_id,
      (elem->>'subject'),
      (elem->>'subject'),
      (100 - (elem->>'value')::numeric)::int,
      (NEW.indicadores->>'IPS')::int,
      CASE
        WHEN (100 - (elem->>'value')::numeric) >= 75 THEN 'critico'
        WHEN (100 - (elem->>'value')::numeric) >= 51 THEN 'alto'
        ELSE 'elevado'
      END,
      false
    FROM jsonb_array_elements(NEW.indicadores->'radar') AS elem
    WHERE (100 - (elem->>'value')::numeric) >= 35
      AND NOT EXISTS (
        SELECT 1 FROM public.psicossocial_alertas pa
        WHERE pa.tenant_id = v_tenant_id
          AND pa.campanha_id = NEW.campanha_id
          AND pa.dimensao_id = (elem->>'subject')
          AND pa.resolvido = false
      )
    ON CONFLICT DO NOTHING;

    -- Gerar ações 5W2H automáticas para Crítico (prazo 30d) e Alto (prazo 60d)
    INSERT INTO public.plano_acoes (
      tenant_id, titulo, descricao, porque, onde, como,
      tipo, prioridade, origem_modulo, origem_descricao,
      exige_evidencia, codigo, progresso, status, tempo_gasto_minutos, prazo
    )
    SELECT
      v_tenant_id,
      CASE
        WHEN (100 - (elem->>'value')::numeric) >= 75
          THEN 'Intervenção Urgente — ' || (elem->>'subject') || ' [Crítico]'
        ELSE 'Ação Preventiva — ' || (elem->>'subject') || ' [Alto]'
      END,
      'Risco psicossocial identificado na campanha "' || v_campanha_nome || '". Dimensão: ' || (elem->>'subject') || '. Score de risco: ' || (100 - (elem->>'value')::numeric)::int || '/100.',
      'Score de risco ' || (100 - (elem->>'value')::numeric)::int || '/100 na dimensão ' || (elem->>'subject'),
      'Toda a organização',
      CASE
        WHEN (100 - (elem->>'value')::numeric) >= 75
          THEN 'Realizar diagnóstico aprofundado, envolver liderança, implementar intervenção imediata.'
        ELSE 'Monitorar evolução, implementar ações preventivas. Reavaliar em 60 dias conforme ISO 45003.'
      END,
      'corretiva',
      CASE WHEN (100 - (elem->>'value')::numeric) >= 75 THEN 'imediato' ELSE 'urgente' END,
      'psicossocial',
      'Campanha: ' || v_campanha_nome || ' — Gerado automaticamente',
      true, '', 0, 'pendente', 0,
      CASE
        WHEN (100 - (elem->>'value')::numeric) >= 75 THEN CURRENT_DATE + INTERVAL '30 days'
        ELSE CURRENT_DATE + INTERVAL '60 days'
      END
    FROM jsonb_array_elements(NEW.indicadores->'radar') AS elem
    WHERE (100 - (elem->>'value')::numeric) >= 51
      AND NOT EXISTS (
        SELECT 1 FROM public.psicossocial_alertas pa
        WHERE pa.tenant_id = v_tenant_id
          AND pa.campanha_id = NEW.campanha_id
          AND pa.dimensao_id = (elem->>'subject')
          AND pa.acao_criada_id IS NOT NULL
      );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'gerar_alertas_psicossociais falhou: %', SQLERRM;
  END;

  RETURN NEW;
END;
$function$;
