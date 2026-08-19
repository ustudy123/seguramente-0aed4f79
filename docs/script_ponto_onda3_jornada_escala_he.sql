-- ============================================================================
-- ENTREGA — ONDA 3 (parte 2): jornada da escala + hora extra sem truncar
-- Alvo: public.calcular_he_adicional_noturno_dia
-- PONTO-091 / PONTO-092  (mantém PONTO-110, PONTO-111)
--
-- O QUE FAZ
--   (091) A jornada esperada do dia passa a vir da ESCALA vigente do vínculo
--         (respeita o versionamento da onda 1). A CCT/8h fixas só valem quando
--         o vínculo não tem escala para o dia. Assim a hora extra de quem tem
--         jornada contratual menor (ex.: 6h) deixa de ser apagada.
--   (092) Remove o corte que truncava a hora extra em 2h (art. 59): apura-se
--         TODO o tempo trabalhado além da jornada (continua devido) e sinaliza-se
--         o excesso ao RH com um alerta (ponto_alertas), um por colaborador/dia.
--   Não mexe no adicional noturno nem na hora ficta.
--
-- SEGURO E IDEMPOTENTE: é um CREATE OR REPLACE da função (definição única, sem
--   remendos próprios de produção nesta função). Rodar duas vezes não quebra
--   nem duplica; o alerta tem guarda anti-duplicata.
--
-- OBSERVAÇÃO IMPORTANTE: hoje esta função de cálculo ainda não é consumida pelo
--   fluxo vivo de apuração (nenhum gatilho/tela a chama). A correção deixa o
--   cálculo certo para quando ele for ligado; por si só não altera os números
--   que já aparecem hoje.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calcular_he_adicional_noturno_dia(p_colaborador_id uuid, p_data date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_diario RECORD;
  v_cct RECORD;
  v_jornada_diaria_min INTEGER := 480; -- 8h (fallback; a escala do vínculo tem prioridade)
  v_he50_pct NUMERIC := 50;
  v_he100_pct NUMERIC := 100;
  v_adn_pct NUMERIC := 20;
  v_noturno_inicio TIME := '22:00';
  v_noturno_fim TIME := '05:00';
  v_usa_hora_ficta BOOLEAN := true;
  v_he_limite_diario_min INTEGER := 120;
  v_he50 INTEGER := 0;
  v_he100 INTEGER := 0;
  v_adn_min INTEGER := 0;
  v_trab_min INTEGER := 0;
  v_dow INTEGER;
  v_empresa UUID;
  v_j_escala INTEGER;
  v_excesso INTEGER;
BEGIN
  SELECT * INTO v_diario FROM public.ponto_diario
   WHERE colaborador_id = p_colaborador_id AND data = p_data
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'sem_diario');
  END IF;

  v_empresa := v_diario.empresa_id;

  -- CCT vigente (se houver) prioriza acordo individual, depois ACT, depois CCT
  SELECT c.* INTO v_cct
    FROM public.ponto_cct_config c
   WHERE c.tenant_id = v_diario.tenant_id
     AND (c.vigencia_inicio IS NULL OR c.vigencia_inicio <= p_data)
     AND (c.vigencia_fim IS NULL OR c.vigencia_fim >= p_data)
   ORDER BY c.created_at DESC
   LIMIT 1;
  IF FOUND THEN
    v_jornada_diaria_min := COALESCE(v_cct.jornada_diaria_horas,8) * 60;
    v_he50_pct := COALESCE(v_cct.he_percentual_dia_util,50);
    v_he100_pct := COALESCE(v_cct.he_percentual_domingos,100);
    v_adn_pct := COALESCE(v_cct.adicional_noturno_percentual,20);
    v_noturno_inicio := COALESCE(v_cct.hora_noturna_inicio,'22:00'::time);
    v_noturno_fim := COALESCE(v_cct.hora_noturna_fim,'05:00'::time);
    v_usa_hora_ficta := COALESCE(v_cct.usa_hora_ficta,true);
    v_he_limite_diario_min := COALESCE(v_cct.he_limite_diario_min,120);
  END IF;

  -- (091) Jornada do dia pela ESCALA vigente do vínculo — tem prioridade sobre
  -- a CCT/8h fixas. Respeita o versionamento de parâmetros da onda 1 (a própria
  -- ponto_jornada_do_dia aplica o overlay). Sem escala com jornada para o dia,
  -- mantém-se o que a CCT/8h definiram acima.
  BEGIN
    SELECT j.jornada_min INTO v_j_escala
      FROM public.ponto_jornada_do_dia(v_diario.tenant_id, v_diario.colaborador_cpf,
                                       v_diario.colaborador_id::text, p_data) j;
    IF COALESCE(v_j_escala, 0) > 0 THEN
      v_jornada_diaria_min := v_j_escala;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- qualquer falha na leitura da escala: mantém o fallback CCT/8h
  END;

  -- Total trabalhado em minutos (a partir das marcações entrada/saida)
  IF v_diario.entrada IS NOT NULL AND v_diario.saida IS NOT NULL THEN
    v_trab_min := EXTRACT(EPOCH FROM (v_diario.saida::time - v_diario.entrada::time))/60;
    IF v_diario.saida_almoco IS NOT NULL AND v_diario.retorno_almoco IS NOT NULL THEN
      v_trab_min := v_trab_min - EXTRACT(EPOCH FROM (v_diario.retorno_almoco::time - v_diario.saida_almoco::time))/60;
    END IF;
  END IF;
  IF v_trab_min < 0 THEN v_trab_min := 0; END IF;

  -- (092) Horas extras: TODO o tempo que excede a jornada é apurado. O limite
  -- de 2h do art. 59 é norma de conduta, não de cálculo — não se trunca a
  -- apuração; apura-se tudo e sinaliza-se o excesso ao RH.
  v_dow := EXTRACT(DOW FROM p_data); -- 0=domingo
  IF v_trab_min > v_jornada_diaria_min THEN
    v_excesso := v_trab_min - v_jornada_diaria_min;
    IF v_dow = 0 THEN
      v_he100 := v_excesso;
    ELSE
      v_he50 := v_excesso;
    END IF;

    -- Sinalização do excesso ao limite do art. 59 (sem deixar de apurar).
    -- Idempotente: um alerta por colaborador/dia.
    IF v_excesso > v_he_limite_diario_min THEN
      INSERT INTO public.ponto_alertas
        (tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
         tipo, severidade, titulo, descricao, data_referencia)
      SELECT v_diario.tenant_id, v_empresa, v_diario.colaborador_id::text,
             v_diario.colaborador_nome, v_diario.colaborador_cpf,
             'excesso_he_art59', 'alta',
             'Excesso ao limite de 2h extras (CLT art. 59)',
             format('Apuradas %s min de hora extra no dia, acima do limite de %s min do art. 59. '
                 || 'O tempo foi apurado por inteiro (continua devido); regularizar o excesso.',
                 v_excesso, v_he_limite_diario_min),
             p_data
      WHERE NOT EXISTS (
        SELECT 1 FROM public.ponto_alertas a
        WHERE a.tenant_id = v_diario.tenant_id
          AND a.colaborador_cpf = v_diario.colaborador_cpf
          AND a.data_referencia = p_data
          AND a.tipo = 'excesso_he_art59'
      );
    END IF;
  END IF;

  -- Adicional noturno: minutos trabalhados na janela 22h-05h
  -- Aproximação: se entrada < 05:00 OU saida > 22:00, calcula sobreposição da jornada bruta
  IF v_diario.entrada IS NOT NULL AND v_diario.saida IS NOT NULL THEN
    DECLARE
      v_e TIMESTAMP := (p_data::text || ' ' || v_diario.entrada::text)::timestamp;
      v_s TIMESTAMP := (p_data::text || ' ' || v_diario.saida::text)::timestamp;
      v_n_ini TIMESTAMP := (p_data::text || ' ' || v_noturno_inicio::text)::timestamp;
      v_n_fim TIMESTAMP := ((p_data + 1)::text || ' ' || v_noturno_fim::text)::timestamp;
      v_overlap_min INTEGER := 0;
    BEGIN
      IF v_s < v_e THEN v_s := v_s + INTERVAL '1 day'; END IF;
      v_overlap_min := GREATEST(0,
        EXTRACT(EPOCH FROM (LEAST(v_s, v_n_fim) - GREATEST(v_e, v_n_ini)))/60
      )::INTEGER;
      v_adn_min := v_overlap_min;
      IF v_usa_hora_ficta AND v_adn_min > 0 THEN
        v_adn_min := ROUND(v_adn_min * 60.0 / 52.5);
      END IF;
    END;
  END IF;

  UPDATE public.ponto_diario
     SET horas_extras_50_minutos = v_he50,
         horas_extras_100_minutos = v_he100,
         adicional_noturno_minutos = v_adn_min,
         updated_at = now()
   WHERE id = v_diario.id;

  RETURN jsonb_build_object(
    'ok', true,
    'he50_min', v_he50,
    'he100_min', v_he100,
    'adicional_noturno_min', v_adn_min,
    'percentual_he50', v_he50_pct,
    'percentual_he100', v_he100_pct,
    'percentual_adn', v_adn_pct
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA — o SQL Editor mostra apenas o último resultado.
-- Esperado: t | t | t | OK
--   le_jornada_escala : t  (passou a consultar ponto_jornada_do_dia)
--   nao_trunca_2h     : t  (sumiu o corte LEAST no cálculo de HE)
--   sinaliza_excesso  : t  (o alerta de excesso do art. 59 está no corpo)
-- ---------------------------------------------------------------------------
WITH def AS (
  SELECT pg_get_functiondef(p.oid) AS src
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'calcular_he_adicional_noturno_dia'
    AND pg_get_function_identity_arguments(p.oid) = 'p_colaborador_id uuid, p_data date'
  LIMIT 1
)
SELECT
  (position('ponto_jornada_do_dia' in src) > 0)                                AS le_jornada_escala,
  (position('LEAST(v_trab_min - v_jornada_diaria_min' in src) = 0)             AS nao_trunca_2h,
  (position('excesso_he_art59' in src) > 0)                                    AS sinaliza_excesso,
  CASE
    WHEN position('ponto_jornada_do_dia' in src) > 0
     AND position('LEAST(v_trab_min - v_jornada_diaria_min' in src) = 0
     AND position('excesso_he_art59' in src) > 0
      THEN 'OK'
    ELSE 'PENDENTE: corpo inesperado — conferir'
  END                                                                          AS erro_tecnico
FROM def;
