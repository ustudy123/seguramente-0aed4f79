-- =====================================================================
-- RN17 (parte 2) — RETENÇÃO DO EXCEDENTE ACIMA DO TETO DIÁRIO
--
-- Chamado (Jaqueline Dalmolin, 08/06/2026): 10h53 trabalhadas contra um
-- teto de 10h38 (jornada 8h38 + 2h suplementares, art. 59 caput CLT). O
-- excedente entrava como crédito no banco automaticamente e o dia ainda
-- aparecia como "Regular".
--
-- O alerta visual já foi entregue. Esta migration trata o saldo: o que
-- passa do teto NÃO entra no banco por conta própria — fica retido até o
-- RH decidir, exatamente como já ocorre no sábado de equalização (RN06).
--
-- Duas saídas possíveis, e toda retenção precisa chegar a uma delas:
--   * 'liberado'       justificativa do art. 61 registrada; o crédito entra
--                      no banco com data no PRÓPRIO dia trabalhado, nunca
--                      redatado (exigência explícita do chamado);
--   * 'irregularidade' não credita no banco; as horas seguem para pagamento
--                      e o dia fica marcado no relatório de conformidade.
--
-- Hora trabalhada nunca é descartada: o art. 59 limita a jornada, mas não
-- desobriga o pagamento. A retenção impede o crédito automático, não o
-- reconhecimento do tempo prestado.
-- =====================================================================

-- 1) DECISÕES DO RH SOBRE O EXCEDENTE ---------------------------------
-- Guarda apenas a DECISÃO. O valor retido continua sendo calculado na
-- hora por ponto_saldo_dias_competencia, para não duplicar verdade.
CREATE TABLE IF NOT EXISTS public.ponto_excedente_decisao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  empresa_id uuid,
  colaborador_cpf text NOT NULL,               -- apenas dígitos
  colaborador_nome text,
  dia date NOT NULL,
  decisao text NOT NULL CHECK (decisao IN ('liberado', 'irregularidade')),
  justificativa text NOT NULL,
  minutos_no_momento int,                      -- excedente na hora da decisão (auditoria)
  motivo_ajuste text,                          -- motivo declarado no ajuste de ponto do dia
  decidido_por uuid,
  decidido_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_excedente_decisao_dia
  ON public.ponto_excedente_decisao (tenant_id, colaborador_cpf, dia);

CREATE INDEX IF NOT EXISTS idx_excedente_decisao_tenant_dia
  ON public.ponto_excedente_decisao (tenant_id, dia);

ALTER TABLE public.ponto_excedente_decisao ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "excedente_decisao_select" ON public.ponto_excedente_decisao
    FOR SELECT USING (tenant_id = public.get_user_tenant_id() OR public.is_superadmin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "excedente_decisao_manage" ON public.ponto_excedente_decisao
    FOR ALL USING (tenant_id = public.get_user_tenant_id() AND public.has_minimum_role(auth.uid(), 'manager'))
    WITH CHECK (tenant_id = public.get_user_tenant_id() AND public.has_minimum_role(auth.uid(), 'manager'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) FUNÇÃO DE SALDO COM A RETENÇÃO GERAL -----------------------------
CREATE OR REPLACE FUNCTION public.ponto_saldo_dias_competencia(p_tenant_id uuid, p_colaborador_cpf text, p_competencia text)
 RETURNS TABLE(dia date, entrada time without time zone, saida time without time zone, trabalhado_min integer, jornada_min integer, saldo_min integer, protegido boolean, equalizacao boolean, excedente_retido_min integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_ini date := to_date(p_competencia || '-01', 'YYYY-MM-DD');
  v_fim date := (to_date(p_competencia || '-01', 'YYYY-MM-DD') + INTERVAL '1 month - 1 day')::date;
  v_cpf text := regexp_replace(COALESCE(p_colaborador_cpf, ''), '[^0-9]', '', 'g');
  v_colaborador_id text;
  v_fb_jornada int;
  v_fb_tol int := 0;
  v_fb_escala_id uuid;
  v_jornada int;
  v_tol int;
  v_esperado int;
  v_atest_min int;
  v_jornada_efetiva int;
  v_extras int;
  v_faltantes int;
  v_trab int;
  v_diff int;
  v_ent_esc time; v_sai_esc time; v_interv int; v_tol_bat int;
  v_ent_cons int; v_sai_cons int; v_trab_ajust int; v_usou_batida boolean;
  v_protegido boolean;
  -- desconto de intervalo (correcao 03/08/2026)
  v_trab_marc int;      -- minutos pareados nas marcacoes (ja sem intervalos reais)
  v_janela int;         -- permanencia real: ultima saida - primeira entrada
  v_janela_cons int;    -- permanencia com as bordas ajustadas pela tolerancia
  v_interv_real int;    -- intervalo efetivamente registrado nas batidas
  v_desc_interv int;    -- intervalo previsto a descontar quando nao houve registro
  v_int_ini time; v_int_fim time;
  v_eq_data date;
  v_eq_total int;
  v_eq_liberado boolean := false;
  v_eq_teve_linha boolean := false;
  v_eq_m jsonb;
  v_eq_auto boolean := false;
  v_qtd_sab int := 0;
  v_exc_decidido boolean;   -- RN17: excedente do dia já decidido pelo RH
  r RECORD;
BEGIN
  SELECT colaborador_id INTO v_colaborador_id
  FROM public.ponto_diario
  WHERE tenant_id = p_tenant_id
    AND regexp_replace(colaborador_cpf, '[^0-9]', '', 'g') = v_cpf
    AND data BETWEEN v_ini AND v_fim
  ORDER BY data DESC
  LIMIT 1;

  SELECT e.jornada_diaria_minutos, COALESCE(e.tolerancia_diaria_minutos, 0), e.id
    INTO v_fb_jornada, v_fb_tol, v_fb_escala_id
  FROM public.ponto_escala_atribuicoes a
  JOIN public.ponto_escalas e ON e.id = a.escala_id
  WHERE a.tenant_id = p_tenant_id
    AND (regexp_replace(COALESCE(a.colaborador_cpf,''), '[^0-9]', '', 'g') = v_cpf OR a.colaborador_id = v_colaborador_id)
    AND COALESCE(a.ativa, true) = true
  ORDER BY a.data_inicio ASC
  LIMIT 1;

  SELECT pem.data_equalizacao, pem.total_equalizacao_min, (pem.art61_liberado_em IS NOT NULL)
    INTO v_eq_data, v_eq_total, v_eq_liberado
  FROM public.ponto_equalizacao_mensal pem
  WHERE pem.tenant_id = p_tenant_id
    AND pem.colaborador_cpf = v_cpf
    AND pem.competencia = p_competencia;

  -- FIX (chamado Kailaine) — Detecção automática do dia de equalização (RN05):
  -- se NÃO há marcação manual mas existe sábado com ponto no mês, esse sábado é
  -- o dia de equalização. Havendo vários, usa o último. Isso evita creditar o
  -- sábado cheio e ainda lançar débito-fantasma de fechamento num dia sem ponto.
  IF v_eq_data IS NULL AND v_fb_escala_id IS NOT NULL THEN
    SELECT count(*) INTO v_qtd_sab
    FROM public.ponto_diario d
    WHERE d.tenant_id = p_tenant_id
      AND regexp_replace(d.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf
      AND d.data BETWEEN v_ini AND v_fim
      AND EXTRACT(ISODOW FROM d.data) = 6
      AND (d.entrada IS NOT NULL OR COALESCE((EXTRACT(EPOCH FROM d.horas_trabalhadas)/60)::int,0) > 0);

    IF v_qtd_sab >= 1 THEN
      SELECT d.data INTO v_eq_data
      FROM public.ponto_diario d
      WHERE d.tenant_id = p_tenant_id
        AND regexp_replace(d.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf
        AND d.data BETWEEN v_ini AND v_fim
        AND EXTRACT(ISODOW FROM d.data) = 6
        AND (d.entrada IS NOT NULL OR COALESCE((EXTRACT(EPOCH FROM d.horas_trabalhadas)/60)::int,0) > 0)
      ORDER BY d.data DESC
      LIMIT 1;

      v_eq_m := public.ponto_equalizacao_competencia(p_tenant_id, v_fb_escala_id, p_competencia);
      v_eq_total := COALESCE((v_eq_m->>'total_equalizacao_min')::int, 0);
      v_eq_auto := (v_eq_total > 0);
      IF NOT v_eq_auto THEN
        v_eq_data := NULL;
      END IF;
    END IF;
  END IF;

  FOR r IN
    SELECT d.data, d.status, d.tipo_dia, d.observacao, d.horas_trabalhadas,
           d.horas_extras, d.horas_faltantes, d.colaborador_id, d.entrada, d.saida
    FROM public.ponto_diario d
    WHERE d.tenant_id = p_tenant_id
      AND regexp_replace(d.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf
      AND d.data BETWEEN v_ini AND v_fim
    ORDER BY d.data
  LOOP
    v_protegido := (
      r.status = 'justificado'
      OR COALESCE(r.tipo_dia, 'normal') IN ('ferias', 'atestado', 'afastamento', 'feriado')
      OR COALESCE(r.observacao, '') ILIKE '%atestado%'
      OR EXISTS (
        SELECT 1 FROM public.atestados a
        WHERE a.tenant_id = p_tenant_id
          AND regexp_replace(a.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf
          AND COALESCE(a.unidade_afastamento, 'dias') = 'dias'
          AND a.data_inicio_afastamento IS NOT NULL
          AND a.data_inicio_afastamento <= r.data
          AND COALESCE(a.data_fim_afastamento, a.data_inicio_afastamento) >= r.data
      )
    );

    IF v_protegido THEN
      IF v_eq_data IS NOT NULL AND r.data = v_eq_data THEN
        v_eq_teve_linha := true;
      END IF;
      dia := r.data; entrada := r.entrada; saida := r.saida;
      trabalhado_min := COALESCE((EXTRACT(EPOCH FROM r.horas_trabalhadas)/60)::int, 0);
      jornada_min := 0; saldo_min := 0; protegido := true;
      equalizacao := false; excedente_retido_min := 0;
      RETURN NEXT;
      CONTINUE;
    END IF;

    IF v_eq_data IS NOT NULL AND r.data = v_eq_data THEN
      v_eq_teve_linha := true;
      v_trab := COALESCE((EXTRACT(EPOCH FROM r.horas_trabalhadas)/60)::int, 0);
      v_diff := v_trab - COALESCE(v_eq_total, 0);
      excedente_retido_min := 0;
      IF v_diff > 120 AND NOT v_eq_liberado THEN
        excedente_retido_min := v_diff - 120;
        v_diff := 120;
      END IF;
      IF abs(v_diff) <= 10 THEN v_diff := 0; END IF;
      dia := r.data; entrada := r.entrada; saida := r.saida;
      trabalhado_min := v_trab;
      jornada_min := COALESCE(v_eq_total, 0);
      saldo_min := v_diff;
      protegido := false;
      equalizacao := true;
      RETURN NEXT;
      CONTINUE;
    END IF;

    SELECT j.jornada_min, j.tol_min INTO v_jornada, v_tol
    FROM public.ponto_jornada_do_dia(p_tenant_id, v_cpf, r.colaborador_id::text, r.data) j;

    IF v_jornada IS NULL OR v_jornada = 0 THEN
      IF EXTRACT(DOW FROM r.data)::int IN (0, 6) THEN
        v_esperado := 0;
      ELSE
        v_esperado := COALESCE(v_fb_jornada, 0);
      END IF;
    ELSE
      v_esperado := v_jornada;
    END IF;
    v_tol := CASE WHEN COALESCE(v_tol, 0) <> 0 THEN v_tol ELSE COALESCE(v_fb_tol, 0) END;

    SELECT COALESCE(SUM(COALESCE(a.horas_afastamento, 0) * 60 + COALESCE(a.minutos_afastamento, 0)), 0)
      INTO v_atest_min
    FROM public.atestados a
    WHERE a.tenant_id = p_tenant_id
      AND regexp_replace(a.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf
      AND COALESCE(a.unidade_afastamento, 'dias') = 'horas'
      AND a.data_inicio_afastamento IS NOT NULL
      AND a.data_inicio_afastamento <= r.data
      AND COALESCE(a.data_fim_afastamento, a.data_inicio_afastamento) >= r.data;

    v_jornada_efetiva := GREATEST(0, v_esperado - COALESCE(v_atest_min, 0));

    v_ent_esc := NULL; v_sai_esc := NULL; v_interv := 0; v_tol_bat := 10;
    BEGIN
      SELECT e.entrada, e.saida, COALESCE(e.intervalo_min, 0), COALESCE(e.tolerancia_batida_min, 10)
        INTO v_ent_esc, v_sai_esc, v_interv, v_tol_bat
      FROM public.ponto_escala_do_dia(p_tenant_id, v_cpf, r.colaborador_id::text, r.data) e;
    EXCEPTION WHEN OTHERS THEN
      v_ent_esc := NULL; v_sai_esc := NULL;
    END;

    v_trab := COALESCE((EXTRACT(EPOCH FROM r.horas_trabalhadas)/60)::int, 0);
    v_usou_batida := false;
    v_diff := 0;

    IF v_ent_esc IS NOT NULL AND v_sai_esc IS NOT NULL
       AND r.entrada IS NOT NULL AND r.saida IS NOT NULL
       AND v_jornada_efetiva > 0 THEN

      v_ent_cons := CASE
        WHEN abs((EXTRACT(EPOCH FROM r.entrada)/60)::int - (EXTRACT(EPOCH FROM v_ent_esc)/60)::int) <= COALESCE(v_tol_bat, 10)
          THEN (EXTRACT(EPOCH FROM v_ent_esc)/60)::int
        ELSE (EXTRACT(EPOCH FROM r.entrada)/60)::int
      END;

      v_sai_cons := CASE
        WHEN abs((EXTRACT(EPOCH FROM r.saida)/60)::int - (EXTRACT(EPOCH FROM v_sai_esc)/60)::int) <= COALESCE(v_tol_bat, 10)
          THEN (EXTRACT(EPOCH FROM v_sai_esc)/60)::int
        ELSE (EXTRACT(EPOCH FROM r.saida)/60)::int
      END;

      -- Intervalo REAL: o que a permanencia tem a mais do que o tempo pareado
      -- nas marcacoes. Se o colaborador bateu o almoco, aparece aqui.
      v_trab_marc := COALESCE((EXTRACT(EPOCH FROM r.horas_trabalhadas)/60)::int, 0);
      v_janela := (EXTRACT(EPOCH FROM r.saida)/60)::int - (EXTRACT(EPOCH FROM r.entrada)/60)::int;
      IF v_janela < 0 THEN
        v_janela := v_janela + 1440;  -- turno que vira o dia
      END IF;
      v_interv_real := GREATEST(0, v_janela - v_trab_marc);

      -- Janela consolidada (bordas na tolerancia). Turno que vira o dia:
      -- saida < entrada, soma 24h -- sem isto o trabalhado zerava.
      v_janela_cons := v_sai_cons - v_ent_cons;
      IF v_janela_cons < 0 THEN
        v_janela_cons := v_janela_cons + 1440;
      END IF;

      IF v_interv_real > 0 THEN
        -- Intervalo registrado: ja descontado no pareamento, nao desconta de novo.
        v_desc_interv := 0;
      ELSE
        -- Intervalo NAO registrado: desconta o previsto apenas na parte que a
        -- janela trabalhada realmente atravessa.
        v_int_ini := NULL; v_int_fim := NULL;
        IF v_sai_cons >= v_ent_cons THEN
          BEGIN
            SELECT w.inicio, w.fim INTO v_int_ini, v_int_fim
            FROM public.ponto_intervalo_janela_do_dia(p_tenant_id, v_cpf, r.colaborador_id::text, r.data) w;
          EXCEPTION WHEN OTHERS THEN
            v_int_ini := NULL; v_int_fim := NULL;
          END;
        END IF;

        IF v_int_ini IS NOT NULL AND v_int_fim IS NOT NULL THEN
          v_desc_interv := GREATEST(0,
            LEAST(v_sai_cons, (EXTRACT(EPOCH FROM v_int_fim)/60)::int)
            - GREATEST(v_ent_cons, (EXTRACT(EPOCH FROM v_int_ini)/60)::int)
          );
        ELSE
          -- Sem janela conhecida: desconta no maximo o excedente sobre a
          -- jornada -- nunca zera um dia curto legitimamente trabalhado.
          v_desc_interv := LEAST(COALESCE(v_interv, 0), GREATEST(0, v_janela - v_jornada_efetiva));
        END IF;
      END IF;

      v_trab_ajust := GREATEST(0, v_janela_cons - v_interv_real - v_desc_interv);
      v_diff := v_trab_ajust - v_jornada_efetiva;
      v_trab := v_trab_ajust;
      v_usou_batida := true;
    END IF;

    IF NOT v_usou_batida THEN
      v_extras    := COALESCE((EXTRACT(EPOCH FROM r.horas_extras)/60)::int, 0);
      v_faltantes := COALESCE((EXTRACT(EPOCH FROM r.horas_faltantes)/60)::int, 0);

      IF v_extras > 0 OR v_faltantes > 0 THEN
        v_diff := v_extras - v_faltantes;
      ELSIF v_jornada_efetiva = 0 THEN
        v_diff := GREATEST(0, v_trab);
      ELSIF r.status = 'falta' THEN
        v_diff := -v_jornada_efetiva;
      ELSE
        v_diff := v_trab - v_jornada_efetiva;
        IF abs(v_diff) <= COALESCE(v_tol, 0) THEN
          v_diff := 0;
        END IF;
      END IF;
    END IF;

    IF abs(v_diff) <= 10 THEN
      v_diff := 0;
    END IF;

    -- RN17: o que passa da jornada + 2h suplementares (art. 59, caput) NÃO
    -- entra automaticamente no banco. Fica retido até o RH decidir:
    --  * 'liberado'       -> crédito integral, com data no próprio dia;
    --  * 'irregularidade' -> não credita (segue para pagamento) e o dia fica
    --                        marcado no relatório de conformidade.
    -- Sem decisão, o excedente permanece retido. Mesma regra já aplicada ao
    -- sábado de equalização (RN06), agora nos demais dias da semana.
    excedente_retido_min := 0;
    IF v_jornada_efetiva > 0 AND v_diff > 120 THEN
      SELECT EXISTS (
        SELECT 1 FROM public.ponto_excedente_decisao x
        WHERE x.tenant_id = p_tenant_id
          AND regexp_replace(x.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf
          AND x.dia = r.data
          AND x.decisao = 'liberado'
      ) INTO v_exc_decidido;

      IF NOT COALESCE(v_exc_decidido, false) THEN
        excedente_retido_min := v_diff - 120;
        v_diff := 120;
      END IF;
    END IF;

    dia := r.data;
    entrada := r.entrada;
    saida := r.saida;
    trabalhado_min := v_trab;
    jornada_min := v_jornada_efetiva;
    saldo_min := v_diff;
    protegido := false;
    equalizacao := false;
    RETURN NEXT;
  END LOOP;

  IF v_eq_data IS NOT NULL AND NOT v_eq_teve_linha AND v_eq_data < CURRENT_DATE THEN
    dia := v_eq_data; entrada := NULL; saida := NULL;
    trabalhado_min := 0;
    jornada_min := COALESCE(v_eq_total, 0);
    saldo_min := -COALESCE(v_eq_total, 0);
    protegido := false; equalizacao := true; excedente_retido_min := 0;
    IF saldo_min <> 0 THEN RETURN NEXT; END IF;
  END IF;

  -- FIX (chamado Kailaine): fallback só dispara se NÃO houve sábado trabalhado.
  IF v_eq_data IS NULL AND v_fim < CURRENT_DATE AND v_fb_escala_id IS NOT NULL
     AND v_qtd_sab = 0 THEN
    v_eq_m := public.ponto_equalizacao_competencia(p_tenant_id, v_fb_escala_id, p_competencia);
    v_eq_total := COALESCE((v_eq_m->>'total_equalizacao_min')::int, 0);
    IF v_eq_total > 0 THEN
      dia := v_fim; entrada := NULL; saida := NULL;
      trabalhado_min := 0;
      jornada_min := v_eq_total;
      saldo_min := -v_eq_total;
      protegido := false; equalizacao := true; excedente_retido_min := 0;
      RETURN NEXT;
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ponto_saldo_dias_competencia(uuid, text, text) TO authenticated, service_role;

-- 3) REGISTRAR A DECISÃO DO RH ----------------------------------------
CREATE OR REPLACE FUNCTION public.ponto_excedente_decidir(
  p_tenant_id uuid,
  p_colaborador_cpf text,
  p_dia date,
  p_decisao text,
  p_justificativa text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_cpf text := regexp_replace(COALESCE(p_colaborador_cpf, ''), '[^0-9]', '', 'g');
  v_nome text;
  v_empresa uuid;
  v_motivo text;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF public.get_user_tenant_id() IS DISTINCT FROM p_tenant_id
       OR NOT public.has_minimum_role(auth.uid(), 'manager') THEN
      RAISE EXCEPTION 'Sem permissão';
    END IF;
  END IF;

  IF p_decisao NOT IN ('liberado', 'irregularidade') THEN
    RAISE EXCEPTION 'Decisão inválida: use liberado ou irregularidade';
  END IF;

  -- Justificativa obrigatória nas duas saídas: é ela que sustenta o
  -- registro perante a Portaria 671/2021 (quem decidiu, quando e por quê).
  IF COALESCE(trim(p_justificativa), '') = '' THEN
    RAISE EXCEPTION 'Justificativa é obrigatória (art. 61 CLT)';
  END IF;

  SELECT d.colaborador_nome, d.empresa_id INTO v_nome, v_empresa
  FROM public.ponto_diario d
  WHERE d.tenant_id = p_tenant_id
    AND regexp_replace(d.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf
    AND d.data = p_dia
  LIMIT 1;

  -- Motivo declarado no ajuste do dia — alimenta o relatório de auditoria
  -- (motivo declarado x evidência x recorrência) pedido no chamado.
  SELECT a.justificativa INTO v_motivo
  FROM public.ponto_ajustes a
  WHERE a.tenant_id = p_tenant_id
    AND regexp_replace(a.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf
    AND a.data_referencia = p_dia
    AND a.status = 'aprovado'
  ORDER BY a.created_at DESC
  LIMIT 1;

  INSERT INTO public.ponto_excedente_decisao AS x (
    tenant_id, empresa_id, colaborador_cpf, colaborador_nome, dia,
    decisao, justificativa, motivo_ajuste, decidido_por, decidido_em
  ) VALUES (
    p_tenant_id, v_empresa, v_cpf, v_nome, p_dia,
    p_decisao, trim(p_justificativa), v_motivo, auth.uid(), now()
  )
  ON CONFLICT (tenant_id, colaborador_cpf, dia) DO UPDATE SET
    decisao = EXCLUDED.decisao,
    justificativa = EXCLUDED.justificativa,
    motivo_ajuste = EXCLUDED.motivo_ajuste,
    decidido_por = EXCLUDED.decidido_por,
    decidido_em = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.ponto_excedente_decidir(uuid, text, date, text, text)
  TO authenticated, service_role;

-- 4) FILA DE PENDÊNCIAS DA COMPETÊNCIA --------------------------------
-- Dias acima do teto que ainda não têm decisão. É esta lista que impede a
-- retenção de virar limbo: o RH vê o que está parado e há quanto tempo.
CREATE OR REPLACE FUNCTION public.ponto_excedente_pendentes(
  p_tenant_id uuid,
  p_competencia text
)
RETURNS TABLE(
  colaborador_cpf text,
  colaborador_nome text,
  dia date,
  trabalhado_min int,
  jornada_min int,
  excedente_retido_min int,
  motivo_ajuste text,
  dias_parado int
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
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
    WHERE b.tenant_id = p_tenant_id AND b.competencia = p_competencia
  LOOP
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
      (SELECT a.justificativa FROM public.ponto_ajustes a
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
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ponto_excedente_pendentes(uuid, text) TO authenticated, service_role;

COMMENT ON TABLE public.ponto_excedente_decisao IS
  'RN17: decisão do RH sobre o excedente acima da jornada + 2h (art. 59/61 CLT). liberado = credita no banco com data do dia; irregularidade = não credita, segue para pagamento.';
