-- =====================================================================
-- Segundos: os dias com atestado/férias/afastamento ficaram de fora
--
-- O 20260804160000 corrigiu o critério em _ponto_calc_dia e mandou
-- reconsolidar os dias com segundos na marcação. Só que a reconsolidação
-- não alcança justamente o dia do caso relatado.
--
-- consolidar_ponto_diario_manual, ao encontrar atestado (ou férias, ou
-- afastamento) no dia, grava o abono e RETORNA — nunca chega em
-- _ponto_calc_dia. E o _ponto_grava_abono, no ON CONFLICT, atualiza só
-- empresa_id, status e observacao: entrada, saída e horas_trabalhadas
-- permanecem como estavam.
--
-- Resultado prático no caso da Kailaine (30/06/2026, atestado de 7h26):
-- horas_trabalhadas continuou 01:13:00, o dia é "protegido" na apuração,
-- e nessa condição o total do dia vem direto de horas_trabalhadas. Por
-- isso o espelho seguia mostrando 1h13 depois da publicação — a correção
-- estava certa e simplesmente não passava por ali.
--
-- Correção: recalcular horas_trabalhadas direto das marcações, com o
-- mesmo truncamento, sem depender da consolidação.
-- =====================================================================

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
  RAISE NOTICE 'Correção de horas arredondadas: %', v_res::text;
END $corrige$;

COMMENT ON FUNCTION public.ponto_corrigir_horas_arredondadas(uuid, date) IS
  'Recalcula ponto_diario.horas_trabalhadas direto das marcações, truncando os segundos. Alcança dias abonados, que consolidar_ponto_diario_manual não recalcula.';
