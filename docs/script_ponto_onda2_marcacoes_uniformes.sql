-- ============================================================================
-- ENTREGA — ONDA 2 (parte 3): detecção de marcações uniformes ("britânico")
-- Alvos: ponto_verificar_marcacoes_uniformes, ponto_marcacoes_uniformes_monitorar
-- PONTO-377
--
-- O QUE FAZ
--   Por colaborador na competência, mede o desvio-padrão dos horários de entrada
--   e de saída ao longo dos dias. Desvio quase nulo por muitos dias = espelho
--   uniforme ("britânico"), que a Súmula 338, III, do TST considera INVÁLIDO
--   como prova. Uma companheira agendável alerta o RH, idempotente por
--   competência.
--
-- Somente leitura sobre ponto_diario; aditivo e idempotente (CREATE OR REPLACE).
-- Sem backfill.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ponto_verificar_marcacoes_uniformes(
  p_tenant_id          uuid    DEFAULT NULL,
  p_competencia        text    DEFAULT to_char(CURRENT_DATE, 'YYYY-MM'),
  p_min_dias           integer DEFAULT 10,
  p_limiar_desvio_seg  numeric DEFAULT 60
)
RETURNS TABLE(
  tenant_id          uuid,
  colaborador_cpf    text,
  colaborador_nome   text,
  dias               integer,
  desvio_entrada_seg numeric,
  desvio_saida_seg   numeric,
  uniforme           boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Deteccao de marcacoes uniformes (espelho "britanico"): variancia dos
  -- horarios por colaborador. Desvio-padrao quase nulo por muitos dias sinaliza
  -- registro invalido como prova (Sumula 338, III, do TST).
  WITH v_periodo AS (
    SELECT to_date(p_competencia || '-01', 'YYYY-MM-DD') AS ini,
           (to_date(p_competencia || '-01', 'YYYY-MM-DD') + INTERVAL '1 month - 1 day')::date AS fim
  ),
  dias AS (
    SELECT d.tenant_id,
           regexp_replace(d.colaborador_cpf, '[^0-9]', '', 'g') AS cpf,
           d.colaborador_nome AS nome,
           EXTRACT(EPOCH FROM d.entrada) AS ent_seg,
           EXTRACT(EPOCH FROM d.saida)   AS sai_seg
    FROM public.ponto_diario d, v_periodo p
    WHERE d.data BETWEEN p.ini AND p.fim
      AND d.entrada IS NOT NULL
      AND d.saida   IS NOT NULL
      AND (p_tenant_id IS NULL OR d.tenant_id = p_tenant_id)
  ),
  agg AS (
    SELECT tenant_id, cpf,
           max(nome)              AS nome,
           count(*)::int          AS dias,
           round(stddev_pop(ent_seg)::numeric, 1) AS dp_ent,
           round(stddev_pop(sai_seg)::numeric, 1) AS dp_sai
    FROM dias
    GROUP BY tenant_id, cpf
  )
  SELECT tenant_id, cpf AS colaborador_cpf, nome AS colaborador_nome, dias,
         dp_ent AS desvio_entrada_seg, dp_sai AS desvio_saida_seg,
         (dias >= p_min_dias
          AND COALESCE(dp_ent, 0) <= p_limiar_desvio_seg
          AND COALESCE(dp_sai, 0) <= p_limiar_desvio_seg) AS uniforme
  FROM agg
  ORDER BY uniforme DESC, dias DESC;
$$;

COMMENT ON FUNCTION public.ponto_verificar_marcacoes_uniformes(uuid, text, integer, numeric) IS
  'Mede a variancia dos horarios de entrada/saida por colaborador na competencia. Desvio quase nulo por muitos dias sinaliza espelho uniforme ("britanico"), invalido como prova (Sumula 338, III, TST). Somente leitura.';

-- Companheira agendável: alerta o RH sobre os espelhos uniformes da competência.
CREATE OR REPLACE FUNCTION public.ponto_marcacoes_uniformes_monitorar(
  p_competencia text DEFAULT to_char(CURRENT_DATE, 'YYYY-MM')
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ref  date := (to_date(p_competencia || '-01','YYYY-MM-DD') + INTERVAL '1 month - 1 day')::date;
  v_qtd  int  := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT * FROM public.ponto_verificar_marcacoes_uniformes(NULL, p_competencia)
    WHERE uniforme
  LOOP
    v_qtd := v_qtd + 1;
    INSERT INTO public.ponto_alertas
      (tenant_id, colaborador_cpf, colaborador_nome, tipo, severidade,
       titulo, descricao, data_referencia)
    SELECT r.tenant_id, r.colaborador_cpf, r.colaborador_nome,
           'marcacoes_uniformes', 'alta',
           'Marcacoes uniformes (espelho britanico)',
           format('Em %s, %s dias com horarios praticamente identicos (desvio de %s s na entrada e %s s na saida). '
               || 'Registros uniformes sao invalidos como prova (Sumula 338, III, TST) — conferir a fidelidade das batidas.',
               p_competencia, r.dias, r.desvio_entrada_seg, r.desvio_saida_seg),
           v_ref
    WHERE NOT EXISTS (
      SELECT 1 FROM public.ponto_alertas a
      WHERE a.tenant_id = r.tenant_id
        AND a.colaborador_cpf = r.colaborador_cpf
        AND a.tipo = 'marcacoes_uniformes'
        AND a.data_referencia = v_ref
    );
  END LOOP;
  RETURN v_qtd;
END;
$$;

COMMENT ON FUNCTION public.ponto_marcacoes_uniformes_monitorar(text) IS
  'Roda a deteccao de marcacoes uniformes da competencia e alerta o RH por colaborador. Idempotente por competencia. Para agendar via pg_cron.';

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA — o SQL Editor mostra apenas o último resultado.
-- Esperado: t | t | OK
--   detecta_uniforme : t  (função de verificação existe)
--   monitor_alerta   : t  (companheira de alerta existe)
-- ---------------------------------------------------------------------------
SELECT
  (to_regprocedure('public.ponto_verificar_marcacoes_uniformes(uuid,text,integer,numeric)') IS NOT NULL) AS detecta_uniforme,
  (to_regprocedure('public.ponto_marcacoes_uniformes_monitorar(text)') IS NOT NULL) AS monitor_alerta,
  CASE
    WHEN to_regprocedure('public.ponto_verificar_marcacoes_uniformes(uuid,text,integer,numeric)') IS NOT NULL
     AND to_regprocedure('public.ponto_marcacoes_uniformes_monitorar(text)') IS NOT NULL
      THEN 'OK' ELSE 'CONFERIR'
  END AS erro_tecnico;
