-- ============================================================================
-- ONDA 5 (parte 4) — Limite de 10 horas diárias no regime de compensação
-- PONTO-172
--
-- Em regime de compensação (banco de horas), a jornada do dia NÃO pode passar
-- de 10 horas (CLT art. 59, §2º). Esse limite é DO REGIME e independe do teto de
-- 2 horas extras: um dia de 11 horas com banco é irregular mesmo que o saldo
-- compense depois. Hoje nada confronta a jornada do dia com esse limite.
--
-- O QUE FAZ (aditivo): monitor que, para colaborador em regime de compensação
-- vigente, sinaliza os dias em que a jornada trabalhada passa de 600 minutos
-- (10 horas). Só insere alerta, idempotente. Reaproveita ponto_banco_regime_-
-- vigente (parte 1): o limite vale para quem está em compensação — dia longo de
-- quem não tem banco já é apurado como hora extra normal.
--
-- Baixo risco: não roda sozinho, sem gatilho em tabela quente, sem tocar no
-- motor de saldo. Aditivo e idempotente.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ponto_banco_limite_diario_monitorar(p_competencia text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ini date := to_date(p_competencia || '-01', 'YYYY-MM-DD');
  v_fim date := (to_date(p_competencia || '-01', 'YYYY-MM-DD') + INTERVAL '1 month - 1 day')::date;
  v_n   int := 0;
  v_ins int;
  b     RECORD;
  v_regime public.ponto_banco_horas_config;
BEGIN
  FOR b IN
    SELECT d.tenant_id, d.empresa_id, d.colaborador_id, d.colaborador_nome,
           d.colaborador_cpf, d.data,
           floor(EXTRACT(EPOCH FROM d.horas_trabalhadas)/60)::int AS min_trab
    FROM public.ponto_diario d
    WHERE d.data BETWEEN v_ini AND v_fim
      AND d.tenant_id IS NOT NULL
      -- Limite de 10 horas (600 minutos) da jornada em regime de compensacao
      -- (CLT art. 59, §2º): so passa adiante o dia que excede.
      AND floor(EXTRACT(EPOCH FROM d.horas_trabalhadas)/60)::int > 600
  LOOP
    -- O limite de 10 horas vale para quem esta em regime de compensacao.
    v_regime := public.ponto_banco_regime_vigente(
                  b.tenant_id, b.colaborador_cpf, b.colaborador_id::text, b.data);
    IF v_regime.id IS NOT NULL THEN
      INSERT INTO public.ponto_alertas
        (tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
         tipo, severidade, titulo, descricao, data_referencia)
      SELECT b.tenant_id, b.empresa_id, b.colaborador_id::text, b.colaborador_nome, b.colaborador_cpf,
             'banco_limite_10h', 'alta',
             'Jornada acima de 10h em regime de compensacao (CLT art. 59, §2º)',
             format('Jornada de %s min neste dia em regime de compensacao ultrapassa o limite de '
                 || '10 horas (600 minutos) do art. 59, §2º. O limite e do regime e independe do '
                 || 'teto de 2h extras — dia de mais de 10 horas e irregular ainda que o saldo '
                 || 'compense depois. Excedente de %s min.',
                 b.min_trab, b.min_trab - 600),
             b.data
      WHERE NOT EXISTS (
        SELECT 1 FROM public.ponto_alertas a
        WHERE a.tenant_id = b.tenant_id
          AND a.colaborador_cpf = b.colaborador_cpf
          AND a.tipo = 'banco_limite_10h'
          AND a.data_referencia = b.data
      );
      GET DIAGNOSTICS v_ins = ROW_COUNT;
      v_n := v_n + v_ins;
    END IF;
  END LOOP;

  RETURN v_n;
END;
$$;

COMMENT ON FUNCTION public.ponto_banco_limite_diario_monitorar(text) IS
  'Monitor: sinaliza dias com jornada acima de 10 horas (600 min) para colaborador em regime de compensacao (CLT art. 59, §2º). So insere em ponto_alertas, idempotente por colaborador/dia.';
