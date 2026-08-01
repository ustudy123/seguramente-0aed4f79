CREATE OR REPLACE FUNCTION public.ponto_jornada_do_dia(p_tenant_id uuid, p_cpf text, p_colaborador_id text, p_data date)
RETURNS TABLE(jornada_min integer, tol_min integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_escala public.ponto_escalas;
  v_dow int;
  v_dia_key text;
  v_ordinal int;
  v_is_ultimo boolean;
  v_dia_cfg jsonb;
  v_comp jsonb;
  v_ord_raw text;
  v_entrada time;
  v_saida time;
  v_intervalo int;
  v_jornada int;
BEGIN
  SELECT e.* INTO v_escala
  FROM public.ponto_escala_atribuicoes a
  JOIN public.ponto_escalas e ON e.id = a.escala_id
  WHERE a.tenant_id = p_tenant_id
    AND (a.colaborador_cpf = p_cpf OR a.colaborador_id = p_colaborador_id)
    AND COALESCE(a.ativa, true) = true
    AND a.data_inicio <= p_data
    AND (a.data_fim IS NULL OR a.data_fim >= p_data)
  ORDER BY a.data_inicio DESC
  LIMIT 1;

  IF v_escala.id IS NULL THEN
    RETURN;
  END IF;

  IF v_escala.dias_config IS NULL OR jsonb_typeof(v_escala.dias_config) <> 'object' THEN
    jornada_min := v_escala.jornada_diaria_minutos;
    tol_min := COALESCE(v_escala.tolerancia_diaria_minutos, 0);
    RETURN NEXT;
    RETURN;
  END IF;

  v_dow := EXTRACT(DOW FROM p_data)::int;
  v_dia_key := CASE v_dow
    WHEN 0 THEN 'domingo'
    WHEN 1 THEN 'segunda'
    WHEN 2 THEN 'terca'
    WHEN 3 THEN 'quarta'
    WHEN 4 THEN 'quinta'
    WHEN 5 THEN 'sexta'
    WHEN 6 THEN 'sabado'
  END;

  v_dia_cfg := v_escala.dias_config -> v_dia_key;

  IF v_dia_cfg IS NOT NULL AND COALESCE((v_dia_cfg->>'trabalha')::boolean, false) THEN
    v_entrada := (v_dia_cfg->>'entrada')::time;
    v_saida := (v_dia_cfg->>'saida')::time;
    v_jornada := EXTRACT(EPOCH FROM (v_saida - v_entrada))::int / 60;
    IF COALESCE((v_dia_cfg->>'tem_almoco')::boolean, false)
       AND (v_dia_cfg->>'inicio_almoco') IS NOT NULL
       AND (v_dia_cfg->>'fim_almoco') IS NOT NULL THEN
      v_jornada := v_jornada - (EXTRACT(EPOCH FROM (
        (v_dia_cfg->>'fim_almoco')::time - (v_dia_cfg->>'inicio_almoco')::time
      ))::int / 60);
    END IF;
    jornada_min := GREATEST(v_jornada, 0);
    tol_min := COALESCE(v_escala.tolerancia_diaria_minutos, 0);
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_escala.compensacoes_mensais IS NOT NULL
     AND jsonb_typeof(v_escala.compensacoes_mensais) = 'array' THEN
    v_ordinal := ((EXTRACT(DAY FROM p_data)::int - 1) / 7) + 1;
    -- é a última ocorrência deste dia da semana no mês?
    v_is_ultimo := (p_data + 7) > (date_trunc('month', p_data) + interval '1 month - 1 day')::date;

    -- ordinal_mes pode vir como número ('1'..'5'), 'ultimo'/'último',
    -- 'todos'/'todas'/vazio (qualquer ocorrência). Comparação textual evita
    -- o erro de cast que derrubava toda a apuração do dia.
    FOR v_comp IN
      SELECT c FROM jsonb_array_elements(v_escala.compensacoes_mensais) c
      WHERE c->>'dia_semana' = v_dia_key
    LOOP
      v_ord_raw := lower(trim(COALESCE(v_comp->>'ordinal_mes', '')));
      IF v_ord_raw IN ('', 'todos', 'todas', 'todo', 'toda', '0')
         OR (v_ord_raw ~ '^\d+$' AND v_ord_raw::int = v_ordinal)
         OR (v_ord_raw IN ('ultimo', 'último', 'ultima', 'última') AND v_is_ultimo) THEN
        v_entrada := (v_comp->>'entrada')::time;
        v_saida := (v_comp->>'saida')::time;
        v_intervalo := COALESCE(NULLIF(v_comp->>'intervalo','')::int, 0);
        v_jornada := (EXTRACT(EPOCH FROM (v_saida - v_entrada))::int / 60) - v_intervalo;
        jornada_min := GREATEST(v_jornada, 0);
        tol_min := COALESCE(v_escala.tolerancia_diaria_minutos, 0);
        RETURN NEXT;
        RETURN;
      END IF;
    END LOOP;
  END IF;

  jornada_min := 0;
  tol_min := COALESCE(v_escala.tolerancia_diaria_minutos, 0);
  RETURN NEXT;
END;
$function$;