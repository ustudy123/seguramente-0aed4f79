-- ============================================================================
-- ENTREGA — ONDA 5 (parte 3): alertas de vencimento e de teto de acumulo
-- Alvo: ponto_banco_alertas_monitorar (nova)
-- PONTO-355 / PONTO-356  ·  DEPENDE DA PARTE 1 (#21: ponto_banco_regime_vigente)
--
-- Dois avisos que faltavam no banco de horas:
--   (355) VENCIMENTO PROXIMO: X dias antes do prazo_compensacao (parte 2),
--         alerta com a acao sugerida (programar compensacao ou pagar). Sem isso
--         o RH so descobre o saldo vencido quando ja virou passivo (art. 59 §5º).
--   (356) TETO DE ACUMULO: o limite_acumulo_horas da configuracao era
--         decorativo; passa a ser comparado com o saldo e a gerar alerta do
--         excedente.
--
-- Um monitor que so insere alertas (idempotente), no padrao dos monitores das
-- ondas 2 e 4. Nao roda sozinho, sem gatilho em tabela quente, sem tocar no
-- motor de saldo. Aditivo e idempotente (CREATE OR REPLACE). Sem backfill.
-- Sugestao: agendar (pg_cron) a chamada diaria, ex.: SELECT ponto_banco_alertas_monitorar(15);
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ponto_banco_alertas_monitorar(p_dias_aviso integer DEFAULT 15)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_n         int := 0;
  v_ins       int;
  b           RECORD;
  v_regime    public.ponto_banco_horas_config;
  v_limite_min int;
  v_dias_ate  int;
  v_comp_fim  date;
BEGIN
  FOR b IN
    SELECT * FROM public.ponto_banco_horas
    WHERE COALESCE(convertido_extras, false) = false
      AND COALESCE(saldo_atual_minutos, 0) > 0
      AND tenant_id IS NOT NULL
  LOOP
    -- (355) Vencimento próximo: até p_dias_aviso dias antes do prazo, ainda não
    -- vencido. Idempotente por colaborador/prazo.
    IF b.prazo_compensacao IS NOT NULL
       AND b.prazo_compensacao >= CURRENT_DATE
       AND b.prazo_compensacao <= CURRENT_DATE + COALESCE(p_dias_aviso, 15) THEN
      v_dias_ate := b.prazo_compensacao - CURRENT_DATE;
      INSERT INTO public.ponto_alertas
        (tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
         tipo, severidade, titulo, descricao, data_referencia)
      SELECT b.tenant_id, b.empresa_id, b.colaborador_id::text, b.colaborador_nome, b.colaborador_cpf,
             'banco_vencimento_proximo', 'media',
             'Saldo de banco de horas perto de vencer',
             format('Saldo de %s min (competencia %s) vence em %s — faltam %s dia(s). Antes do prazo, '
                 || 'programar a compensacao ou pagar como hora extra; vencido, o saldo vira hora '
                 || 'extra devida (CLT art. 59, §5º).',
                 b.saldo_atual_minutos, b.competencia, b.prazo_compensacao, v_dias_ate),
             b.prazo_compensacao
      WHERE NOT EXISTS (
        SELECT 1 FROM public.ponto_alertas a
        WHERE a.tenant_id = b.tenant_id
          AND a.colaborador_cpf = b.colaborador_cpf
          AND a.tipo = 'banco_vencimento_proximo'
          AND a.data_referencia = b.prazo_compensacao
      );
      GET DIAGNOSTICS v_ins = ROW_COUNT;
      v_n := v_n + v_ins;
    END IF;

    -- (356) Teto de acúmulo: compara o saldo com limite_acumulo_horas do regime
    -- vigente. Idempotente por colaborador/competência.
    v_regime := public.ponto_banco_regime_vigente(
                  b.tenant_id, b.colaborador_cpf, b.colaborador_id::text,
                  COALESCE(b.prazo_compensacao, CURRENT_DATE));
    IF v_regime.limite_acumulo_horas IS NOT NULL AND v_regime.limite_acumulo_horas > 0 THEN
      v_limite_min := round(v_regime.limite_acumulo_horas * 60)::int;
      IF b.saldo_atual_minutos > v_limite_min THEN
        BEGIN
          v_comp_fim := (to_date(b.competencia || '-01', 'YYYY-MM-DD') + INTERVAL '1 month - 1 day')::date;
        EXCEPTION WHEN OTHERS THEN
          v_comp_fim := CURRENT_DATE;
        END;
        INSERT INTO public.ponto_alertas
          (tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
           tipo, severidade, titulo, descricao, data_referencia)
        SELECT b.tenant_id, b.empresa_id, b.colaborador_id::text, b.colaborador_nome, b.colaborador_cpf,
               'banco_teto_acumulo', 'alta',
               'Saldo de banco acima do teto de acumulo',
               format('Saldo de %s min ultrapassa o teto de acumulo do regime (%s h = %s min). '
                   || 'Excedente de %s min — regularizar (compensar ou pagar) o que passa do teto.',
                   b.saldo_atual_minutos, v_regime.limite_acumulo_horas, v_limite_min,
                   b.saldo_atual_minutos - v_limite_min),
               v_comp_fim
        WHERE NOT EXISTS (
          SELECT 1 FROM public.ponto_alertas a
          WHERE a.tenant_id = b.tenant_id
            AND a.colaborador_cpf = b.colaborador_cpf
            AND a.tipo = 'banco_teto_acumulo'
            AND a.data_referencia = v_comp_fim
        );
        GET DIAGNOSTICS v_ins = ROW_COUNT;
        v_n := v_n + v_ins;
      END IF;
    END IF;
  END LOOP;

  RETURN v_n;
END;
$$;

COMMENT ON FUNCTION public.ponto_banco_alertas_monitorar(integer) IS
  'Monitor do banco de horas: alerta o RH sobre saldo perto de vencer (X dias antes do prazo_compensacao) e sobre saldo acima do limite_acumulo_horas do regime. So insere em ponto_alertas, idempotente. CLT art. 59.';

-- ---------------------------------------------------------------------------
-- CONFERENCIA — o SQL Editor mostra apenas o ultimo resultado.
-- Esperado: t | t | t | OK
--   monitor_existe  : t  (funcao ponto_banco_alertas_monitorar)
--   alerta_vencto   : t  (gera alerta de vencimento — ponto_alertas + prazo)
--   usa_teto        : t  (consulta limite_acumulo)
-- ---------------------------------------------------------------------------
WITH src AS (SELECT prosrc FROM pg_proc WHERE proname='ponto_banco_alertas_monitorar' LIMIT 1)
SELECT
  (to_regprocedure('public.ponto_banco_alertas_monitorar(integer)') IS NOT NULL) AS monitor_existe,
  ((SELECT prosrc FROM src) ILIKE '%ponto_alertas%' AND (SELECT prosrc FROM src) ILIKE '%prazo%') AS alerta_vencto,
  ((SELECT prosrc FROM src) ILIKE '%limite_acumulo%') AS usa_teto,
  CASE WHEN to_regprocedure('public.ponto_banco_alertas_monitorar(integer)') IS NOT NULL
        AND (SELECT prosrc FROM src) ILIKE '%ponto_alertas%'
        AND (SELECT prosrc FROM src) ILIKE '%prazo%'
        AND (SELECT prosrc FROM src) ILIKE '%limite_acumulo%'
       THEN 'OK' ELSE 'CONFERIR' END AS erro_tecnico;
