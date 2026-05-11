CREATE OR REPLACE FUNCTION public.classificar_marcacao_clt(p_marcacao_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_marc RECORD;
  v_anterior RECORD;
  v_marc_dh TIMESTAMP;
  v_ant_dh TIMESTAMP;
  v_diff_minutos INTEGER;
  v_classificacao TEXT := 'verde';
  v_riscos JSONB := '[]'::jsonb;
BEGIN
  SELECT * INTO v_marc FROM public.ponto_marcacoes WHERE id = p_marcacao_id;
  IF NOT FOUND THEN RETURN 'verde'; END IF;

  -- marcacao_original = false indica registro manual/ajuste
  IF v_marc.marcacao_original IS DISTINCT FROM true THEN
    v_classificacao := 'amarelo';
    v_riscos := v_riscos || jsonb_build_object('tipo','marcacao_manual','desc','Marcação manual ou alterada');
  END IF;

  v_marc_dh := (v_marc.data_marcacao::text || ' ' || v_marc.hora_marcacao::text)::timestamp;

  SELECT *, (data_marcacao::text || ' ' || hora_marcacao::text)::timestamp AS dh INTO v_anterior
  FROM public.ponto_marcacoes
  WHERE colaborador_cpf = v_marc.colaborador_cpf
    AND tipo_marcacao = 'saida'
    AND (data_marcacao::text || ' ' || hora_marcacao::text)::timestamp < v_marc_dh
  ORDER BY data_marcacao DESC, hora_marcacao DESC LIMIT 1;

  IF FOUND AND v_marc.tipo_marcacao = 'entrada' THEN
    v_ant_dh := v_anterior.dh;
    v_diff_minutos := EXTRACT(EPOCH FROM (v_marc_dh - v_ant_dh))/60;
    IF v_diff_minutos < 660 THEN
      v_classificacao := 'vermelho';
      v_riscos := v_riscos || jsonb_build_object('tipo','interjornada','desc',format('Apenas %s min entre jornadas (mínimo 660)', v_diff_minutos));
    END IF;
  END IF;

  UPDATE public.ponto_marcacoes SET classificacao_clt = v_classificacao WHERE id = p_marcacao_id;
  RETURN v_classificacao;
END;
$function$;