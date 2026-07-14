-- =========================================================
-- PONTO: reordenação de tipos após inclusão/correção retroativa
--
-- PROBLEMA (casos Adriana 06/07, Tania/Kymberly 07/07, etc.):
--   O tipo entrada/saída de cada batida é congelado no momento da
--   gravação (resolvido pela alternância *daquele instante*). Quando
--   um gestor inclui/corrige uma batida em horário ANTERIOR às que já
--   existem — ex.: incluir a ENTRADA das 08:03 por "falha no
--   equipamento", depois das batidas do meio-dia já terem entrado — a
--   paridade das batidas seguintes vira, mas o tipo congelado delas
--   não. Resultado: sequência impossível (entrada→entrada→saída→
--   entrada). Tanto o cálculo do dia quanto o espelho pareiam em cima
--   disso e mostram o dia quebrado (1 par válido, "saída antecipada"
--   falsa, resto "incompleto").
--
-- CORREÇÃO:
--   No modelo de "alternância livre", entrada e saída SEMPRE alternam
--   por posição — o tipo concreto é derivável 100% da ordem
--   cronológica. Este migration adiciona um helper que, ao consolidar
--   o dia, reescreve o tipo_marcacao das batidas pela posição
--   (1ª=entrada, 2ª=saída, 3ª=entrada, ...), regularizando qualquer
--   sequência quebrada por inserção retroativa.
--
--   IMPORTANTE — os HORÁRIOS nunca são tocados; muda só o rótulo
--   entrada/saída que o sistema havia embaralhado. É correção de erro
--   do próprio sistema, não alteração de ponto.
--
-- SALVAGUARDA (caso Amanda 07/07):
--   A reescrita SÓ ocorre quando o dia forma uma jornada limpa —
--   número PAR de batidas e nenhum intervalo consecutivo menor que
--   15 min. Dias com batidas grudadas (ruído/toque repetido) ou
--   ímpares (jornada aberta / batida esquecida) NÃO são reordenados:
--   ficam como estão e a consolidação os sinaliza como incompleto
--   para revisão humana. Não inventamos jornada.
--
-- NADA das funções grandes (consolidar_ponto_diario_manual,
-- _ponto_calc_dia, apuração) é redefinido aqui — apenas um helper novo
-- e o wrapper de trigger trivial.
-- =========================================================

-- ---------------------------------------------------------
-- 1) Helper: reordena os tipos do dia pela posição cronológica
--    Retorna true se reordenou (jornada limpa), false caso contrário.
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ponto_reordena_tipos_dia(
  p_tenant_id uuid, p_colaborador_cpf text, p_data date
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_n       int;
  v_min_gap numeric;
  v_changed uuid[];
  v_id      uuid;
BEGIN
  -- Nº de batidas do dia e menor intervalo entre batidas consecutivas
  SELECT count(*), min(gap)
    INTO v_n, v_min_gap
  FROM (
    SELECT EXTRACT(EPOCH FROM (
             hora_marcacao
             - lag(hora_marcacao) OVER (ORDER BY hora_marcacao, created_at)
           )) / 60 AS gap
    FROM public.ponto_marcacoes
    WHERE tenant_id       = p_tenant_id
      AND colaborador_cpf = p_colaborador_cpf
      AND data_marcacao   = p_data
  ) s;

  -- Salvaguarda: só regulariza jornada "limpa".
  --   * nº ÍMPAR  → jornada aberta / batida esquecida (revisão humana)
  --   * gap < 15min → provável ruído de batida (revisão humana)
  IF v_n IS NULL OR v_n = 0
     OR v_n % 2 = 1
     OR (v_min_gap IS NOT NULL AND v_min_gap < 15) THEN
    RETURN false;
  END IF;

  -- Reescreve o tipo pela posição cronológica; coleta os ids alterados
  WITH reord AS (
    SELECT id,
           row_number() OVER (ORDER BY hora_marcacao, created_at) AS pos
    FROM public.ponto_marcacoes
    WHERE tenant_id       = p_tenant_id
      AND colaborador_cpf = p_colaborador_cpf
      AND data_marcacao   = p_data
  ),
  upd AS (
    UPDATE public.ponto_marcacoes m
    SET    tipo_marcacao = CASE WHEN r.pos % 2 = 1 THEN 'entrada' ELSE 'saida' END
    FROM   reord r
    WHERE  m.id = r.id
      AND  m.tipo_marcacao IS DISTINCT FROM
           (CASE WHEN r.pos % 2 = 1 THEN 'entrada' ELSE 'saida' END)
    RETURNING m.id
  )
  SELECT array_agg(id) INTO v_changed FROM upd;

  -- Reclassifica a flag CLT (verde/amarelo/vermelho) das batidas que
  -- mudaram de tipo, para a auditoria de interjornada não ficar stale.
  IF v_changed IS NOT NULL THEN
    FOREACH v_id IN ARRAY v_changed LOOP
      BEGIN
        PERFORM public.classificar_marcacao_clt(v_id);
      EXCEPTION WHEN OTHERS THEN
        NULL; -- classificação CLT é auxiliar; nunca quebra o fluxo
      END;
    END LOOP;
  END IF;

  RETURN (v_changed IS NOT NULL);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ponto_reordena_tipos_dia(uuid, text, date) FROM PUBLIC;

-- ---------------------------------------------------------
-- 2) Wrapper de trigger: reordena ANTES de consolidar
--    (delegador trivial + a chamada nova; assinatura inalterada)
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consolidar_ponto_diario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Regulariza os tipos do dia (no-op em dias já coerentes) e então
  -- consolida com a sequência corrigida.
  PERFORM public.ponto_reordena_tipos_dia(NEW.tenant_id, NEW.colaborador_cpf, NEW.data_marcacao);
  PERFORM public.consolidar_ponto_diario_manual(NEW.tenant_id, NEW.colaborador_cpf, NEW.data_marcacao);
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------
-- 3) Backfill: corrige os dias já quebrados dos últimos 90 dias.
--    A salvaguarda do helper exclui automaticamente dias ruidosos
--    (ex.: Amanda 07/07), que seguem sinalizados para revisão.
-- ---------------------------------------------------------
DO $backfill$
DECLARE
  r RECORD;
  v_ok boolean;
  v_corrigidos int := 0;
BEGIN
  FOR r IN
    WITH base AS (
      SELECT tenant_id, colaborador_cpf, data_marcacao,
             row_number() OVER (PARTITION BY tenant_id, colaborador_cpf, data_marcacao
                                ORDER BY hora_marcacao, created_at) AS pos,
             count(*)      OVER (PARTITION BY tenant_id, colaborador_cpf, data_marcacao) AS n,
             CASE WHEN tipo_marcacao IN ('entrada','retorno_almoco') THEN 'in'
                  WHEN tipo_marcacao IN ('saida','saida_almoco')     THEN 'out' END AS classe
      FROM public.ponto_marcacoes
      WHERE data_marcacao >= CURRENT_DATE - 90
    )
    SELECT tenant_id, colaborador_cpf, data_marcacao
    FROM base
    GROUP BY tenant_id, colaborador_cpf, data_marcacao
    HAVING max(n) % 2 = 0
       AND NOT bool_or(pos = 1 AND classe = 'out')
       AND bool_or(classe IS NOT NULL
                   AND classe <> CASE WHEN pos % 2 = 1 THEN 'in' ELSE 'out' END)
  LOOP
    -- Nunca toca em mês com folha fechada (evita inconsistência entre
    -- ponto_marcacoes e ponto_diario num período travado).
    IF EXISTS (
      SELECT 1 FROM public.ponto_fechamentos
      WHERE tenant_id  = r.tenant_id
        AND competencia = to_char(r.data_marcacao, 'YYYY-MM')
        AND status      = 'fechado'
    ) THEN
      CONTINUE;
    END IF;

    v_ok := public.ponto_reordena_tipos_dia(r.tenant_id, r.colaborador_cpf, r.data_marcacao);
    IF v_ok THEN
      BEGIN
        PERFORM public.consolidar_ponto_diario_manual(r.tenant_id, r.colaborador_cpf, r.data_marcacao);
        v_corrigidos := v_corrigidos + 1;
      EXCEPTION WHEN OTHERS THEN
        NULL; -- pula período fechado / erro pontual
      END;
    END IF;
  END LOOP;

  RAISE NOTICE 'Backfill reordenação de tipos: % dia(s) corrigido(s)', v_corrigidos;
END $backfill$;
