-- RN30 / LGPD art. 6º I e art. 46: os painéis de Apuração > Banco de Horas
-- precisam do mesmo isolamento por empresa das demais telas. As funções
-- ganham p_empresa_id opcional (NULL = tenant inteiro, comportamento antigo).

CREATE OR REPLACE FUNCTION public.ponto_equalizacao_competencia_tenant(
  p_tenant_id uuid, p_competencia text, p_empresa_id uuid DEFAULT NULL)
 RETURNS TABLE(escala_id uuid, escala_nome text, total_equalizacao_min integer, dias_uteis_efetivos integer, qtd_feriados integer, memoria jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
  m jsonb;
  v_ini date := to_date(p_competencia || '-01', 'YYYY-MM-DD');
  v_fim date := (to_date(p_competencia || '-01', 'YYYY-MM-DD') + INTERVAL '1 month - 1 day')::date;
BEGIN
  IF auth.uid() IS NOT NULL AND public.get_user_tenant_id() IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'Acesso negado ao tenant';
  END IF;
  FOR r IN
    SELECT e.id FROM public.ponto_escalas e
    WHERE e.tenant_id = p_tenant_id
      AND COALESCE(e.ativa, true) = true
      AND COALESCE(e.equalizacao_mensal_ativa, false) = true
      AND (
        p_empresa_id IS NULL
        OR e.empresa_id = p_empresa_id
        -- Escala legada sem empresa: só entra se houver colaborador dela
        -- com ponto registrado NESTA empresa na competência.
        OR (e.empresa_id IS NULL AND EXISTS (
              SELECT 1
              FROM public.ponto_escala_atribuicoes a
              JOIN public.ponto_diario d
                ON d.tenant_id = p_tenant_id
               AND d.empresa_id = p_empresa_id
               AND regexp_replace(COALESCE(d.colaborador_cpf,''), '[^0-9]', '', 'g')
                   = regexp_replace(COALESCE(a.colaborador_cpf,''), '[^0-9]', '', 'g')
               AND d.data BETWEEN v_ini AND v_fim
              WHERE a.tenant_id = p_tenant_id
                AND a.escala_id = e.id
                AND COALESCE(a.ativa, true) = true
            ))
      )
    ORDER BY e.nome
  LOOP
    m := public.ponto_equalizacao_competencia(p_tenant_id, r.id, p_competencia);
    escala_id := (m->>'escala_id')::uuid;
    escala_nome := m->>'escala_nome';
    total_equalizacao_min := (m->>'total_equalizacao_min')::int;
    dias_uteis_efetivos := COALESCE((m->>'dias_uteis_efetivos')::int, 0);
    qtd_feriados := COALESCE((m->>'qtd_feriados_deduzidos')::int, 0);
    memoria := m;
    RETURN NEXT;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ponto_equalizacao_listar(
  p_tenant_id uuid, p_competencia text, p_empresa_id uuid DEFAULT NULL)
 RETURNS TABLE(colaborador_cpf text, colaborador_nome text, escala_id uuid, escala_nome text, total_equalizacao_min integer, sabados jsonb, data_marcada date, art61_liberado boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ini date := to_date(p_competencia || '-01', 'YYYY-MM-DD');
  v_fim date := (to_date(p_competencia || '-01', 'YYYY-MM-DD') + INTERVAL '1 month - 1 day')::date;
  r RECORD;
  v_m jsonb;
  v_total int;
BEGIN
  IF auth.uid() IS NOT NULL AND public.get_user_tenant_id() IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'Acesso negado ao tenant';
  END IF;

  FOR r IN
    SELECT DISTINCT ON (regexp_replace(COALESCE(a.colaborador_cpf,''), '[^0-9]', '', 'g'))
           regexp_replace(COALESCE(a.colaborador_cpf,''), '[^0-9]', '', 'g') AS cpf,
           COALESCE(a.colaborador_nome, '') AS nome,
           e.id AS esc_id, e.nome AS esc_nome
    FROM public.ponto_escala_atribuicoes a
    JOIN public.ponto_escalas e ON e.id = a.escala_id
    WHERE a.tenant_id = p_tenant_id
      AND COALESCE(a.ativa, true) = true
      AND a.data_inicio <= v_fim
      AND (a.data_fim IS NULL OR a.data_fim >= v_ini)
      AND COALESCE(a.colaborador_cpf,'') <> ''
      -- Isolamento por empresa: o colaborador precisa pertencer à empresa
      -- selecionada (banco de horas ou ponto da competência).
      AND (
        p_empresa_id IS NULL
        OR EXISTS (
             SELECT 1 FROM public.ponto_banco_horas b
             WHERE b.tenant_id = p_tenant_id
               AND b.empresa_id = p_empresa_id
               AND b.competencia = p_competencia
               AND regexp_replace(COALESCE(b.colaborador_cpf,''), '[^0-9]', '', 'g')
                   = regexp_replace(COALESCE(a.colaborador_cpf,''), '[^0-9]', '', 'g')
           )
        OR EXISTS (
             SELECT 1 FROM public.ponto_diario d
             WHERE d.tenant_id = p_tenant_id
               AND d.empresa_id = p_empresa_id
               AND d.data BETWEEN v_ini AND v_fim
               AND regexp_replace(COALESCE(d.colaborador_cpf,''), '[^0-9]', '', 'g')
                   = regexp_replace(COALESCE(a.colaborador_cpf,''), '[^0-9]', '', 'g')
           )
      )
    ORDER BY regexp_replace(COALESCE(a.colaborador_cpf,''), '[^0-9]', '', 'g'), a.data_inicio ASC
  LOOP
    v_m := public.ponto_equalizacao_competencia(p_tenant_id, r.esc_id, p_competencia);
    v_total := COALESCE((v_m->>'total_equalizacao_min')::int, 0);
    IF v_total <= 0 THEN CONTINUE; END IF;

    colaborador_cpf := r.cpf;
    colaborador_nome := r.nome;
    escala_id := r.esc_id;
    escala_nome := r.esc_nome;
    total_equalizacao_min := v_total;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'data', d.data,
             'trabalhado_min', COALESCE((EXTRACT(EPOCH FROM d.horas_trabalhadas)/60)::int, 0)
           ) ORDER BY d.data), '[]'::jsonb)
      INTO sabados
    FROM public.ponto_diario d
    WHERE d.tenant_id = p_tenant_id
      AND regexp_replace(d.colaborador_cpf, '[^0-9]', '', 'g') = r.cpf
      AND d.data BETWEEN v_ini AND v_fim
      AND EXTRACT(ISODOW FROM d.data) = 6
      AND (d.entrada IS NOT NULL OR COALESCE((EXTRACT(EPOCH FROM d.horas_trabalhadas)/60)::int,0) > 0);

    SELECT pem.data_equalizacao, (pem.art61_liberado_em IS NOT NULL)
      INTO data_marcada, art61_liberado
    FROM public.ponto_equalizacao_mensal pem
    WHERE pem.tenant_id = p_tenant_id
      AND pem.colaborador_cpf = r.cpf
      AND pem.competencia = p_competencia;
    IF NOT FOUND THEN data_marcada := NULL; art61_liberado := false; END IF;

    RETURN NEXT;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ponto_excedente_pendentes(
  p_tenant_id uuid, p_competencia text, p_empresa_id uuid DEFAULT NULL)
 RETURNS TABLE(colaborador_cpf text, colaborador_nome text, dia date, trabalhado_min integer, jornada_min integer, excedente_retido_min integer, motivo_ajuste text, dias_parado integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
BEGIN
  IF auth.uid() IS NOT NULL
     AND public.get_user_tenant_id() IS DISTINCT FROM p_tenant_id
     AND NOT public.is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  FOR r IN
    SELECT DISTINCT b.colaborador_cpf AS cpf
    FROM public.ponto_banco_horas b
    WHERE b.tenant_id = p_tenant_id
      AND b.competencia = p_competencia
      AND (p_empresa_id IS NULL OR b.empresa_id = p_empresa_id)
  LOOP
    BEGIN
      RETURN QUERY
      SELECT
        r.cpf,
        (SELECT d.colaborador_nome FROM public.ponto_diario d
          WHERE d.tenant_id = p_tenant_id
            AND regexp_replace(d.colaborador_cpf, '[^0-9]', '', 'g') = regexp_replace(r.cpf, '[^0-9]', '', 'g')
            AND d.data = s.dia LIMIT 1),
        s.dia,
        s.trabalhado_min,
        s.jornada_min,
        s.excedente_retido_min,
        (SELECT COALESCE(a.motivo, a.observacao) FROM public.ponto_ajustes a
          WHERE a.tenant_id = p_tenant_id
            AND regexp_replace(a.colaborador_cpf, '[^0-9]', '', 'g') = regexp_replace(r.cpf, '[^0-9]', '', 'g')
            AND a.data_referencia = s.dia AND a.status = 'aprovado'
          ORDER BY a.created_at DESC LIMIT 1),
        GREATEST(0, (CURRENT_DATE - s.dia))::int
      FROM public.ponto_saldo_dias_competencia(p_tenant_id, r.cpf, p_competencia) s
      WHERE s.excedente_retido_min > 0
        AND NOT EXISTS (
          SELECT 1 FROM public.ponto_excedente_decisao x
          WHERE x.tenant_id = p_tenant_id
            AND regexp_replace(x.colaborador_cpf, '[^0-9]', '', 'g') = regexp_replace(r.cpf, '[^0-9]', '', 'g')
            AND x.dia = s.dia
        );
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;
  END LOOP;
END;
$function$;