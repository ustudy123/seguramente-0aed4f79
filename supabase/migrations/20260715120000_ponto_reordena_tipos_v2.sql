-- =========================================================
-- PONTO: reordenação de tipos após ajuste — VERSÃO DEFINITIVA
--
-- Substitui 20260714120000_ponto_reordena_tipos_retroativo.sql, que NÃO
-- chegou a ser aplicada (verificado em 15/07: pg_proc não tem
-- ponto_reordena_tipos_dia e consolidar_ponto_diario() não a chama).
-- Por isso o bug seguiu vivo e reapareceu ao aprovar ajustes em 15/07
-- (ex.: Natiele — 07:59 entrada / 11:54 saída / 13:30 entrada ajustada /
-- 17:57 entrada, quando a 17:57 deveria ter virado saída).
--
-- PROBLEMA
--   O tipo entrada/saída é congelado na gravação. Ao inserir uma batida
--   em horário ANTERIOR às existentes, a paridade das seguintes vira,
--   mas o tipo congelado delas não. Sequência impossível
--   (entrada > saída > entrada > entrada) quebra espelho e apuração.
--
-- O QUE MUDOU EM RELAÇÃO À v1 (a falha da minha correção anterior)
--   A v1 só pendurava a reordenação no wrapper consolidar_ponto_diario().
--   Mas existe um SEGUNDO caminho: consolidar_ponto_por_ajuste() chama
--   consolidar_ponto_diario_manual() DIRETO, pulando o wrapper. No ajuste
--   do tipo 'correcao' (que faz UPDATE, não INSERT) nenhum trigger de
--   INSERT dispara — e a reordenação nunca acontecia. Agora os dois
--   caminhos chamam o reordenador.
--
--   Os HORÁRIOS nunca são tocados; muda só o rótulo entrada/saída que o
--   sistema embaralhou. É correção de erro do próprio sistema.
--
-- SALVAGUARDA
--   Só reordena jornada limpa: nº PAR de batidas e nenhum intervalo
--   menor que 15 min. Dia ruidoso (toque repetido) ou ímpar (batida
--   esquecida) fica como está, para revisão humana. Não inventamos
--   jornada.
--
-- Blocos separados de propósito: se um falhar, os anteriores permanecem
-- e o erro fica visível.
-- =========================================================

-- ---------------------------------------------------------
-- 1) Helper
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ponto_reordena_tipos_dia(
  p_tenant_id uuid, p_colaborador_cpf text, p_data date
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_n       int;
  v_min_gap numeric;
  v_changed uuid[];
  v_id      uuid;
BEGIN
  SELECT count(*), min(gap) INTO v_n, v_min_gap
  FROM (
    SELECT EXTRACT(EPOCH FROM (
             hora_marcacao - lag(hora_marcacao) OVER (ORDER BY hora_marcacao, created_at)
           )) / 60 AS gap
    FROM public.ponto_marcacoes
    WHERE tenant_id = p_tenant_id
      AND colaborador_cpf = p_colaborador_cpf
      AND data_marcacao = p_data
  ) s;

  IF v_n IS NULL OR v_n = 0
     OR v_n % 2 = 1
     OR (v_min_gap IS NOT NULL AND v_min_gap < 15) THEN
    RETURN false;
  END IF;

  WITH reord AS (
    SELECT id, row_number() OVER (ORDER BY hora_marcacao, created_at) AS pos
    FROM public.ponto_marcacoes
    WHERE tenant_id = p_tenant_id
      AND colaborador_cpf = p_colaborador_cpf
      AND data_marcacao = p_data
  ), upd AS (
    UPDATE public.ponto_marcacoes m
    SET    tipo_marcacao = CASE WHEN r.pos % 2 = 1 THEN 'entrada' ELSE 'saida' END
    FROM   reord r
    WHERE  m.id = r.id
      AND  m.tipo_marcacao IS DISTINCT FROM
           (CASE WHEN r.pos % 2 = 1 THEN 'entrada' ELSE 'saida' END)
    RETURNING m.id
  )
  SELECT array_agg(id) INTO v_changed FROM upd;

  IF v_changed IS NOT NULL THEN
    FOREACH v_id IN ARRAY v_changed LOOP
      BEGIN
        PERFORM public.classificar_marcacao_clt(v_id);
      EXCEPTION WHEN OTHERS THEN
        NULL;  -- classificação CLT é auxiliar; nunca quebra o fluxo
      END;
    END LOOP;
  END IF;

  RETURN (v_changed IS NOT NULL);
END;
$fn$;

-- ---------------------------------------------------------
-- 2) Caminho A — trigger de INSERT em ponto_marcacoes
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consolidar_ponto_diario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  PERFORM public.ponto_reordena_tipos_dia(NEW.tenant_id, NEW.colaborador_cpf, NEW.data_marcacao);
  PERFORM public.consolidar_ponto_diario_manual(NEW.tenant_id, NEW.colaborador_cpf, NEW.data_marcacao);
  RETURN NEW;
END;
$fn$;

-- ---------------------------------------------------------
-- 3) Caminho B — trigger de ajuste (aprovação), inclusive 'correcao'
--    Era o caminho descoberto: chamava a consolidação direto.
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consolidar_ponto_por_ajuste()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) OR (TG_OP = 'INSERT') THEN
    PERFORM public.ponto_reordena_tipos_dia(NEW.tenant_id, NEW.colaborador_cpf, NEW.data_referencia);
    PERFORM public.consolidar_ponto_diario_manual(NEW.tenant_id, NEW.colaborador_cpf, NEW.data_referencia);
  END IF;
  RETURN NEW;
END;
$fn$;

-- ---------------------------------------------------------
-- 4) Backfill — 90 dias, pulando folha fechada
-- ---------------------------------------------------------
DO $backfill$
DECLARE
  r RECORD;
  v_corrigidos int := 0;
BEGIN
  FOR r IN
    WITH base AS (
      SELECT tenant_id, colaborador_cpf, data_marcacao,
             row_number() OVER (PARTITION BY tenant_id, colaborador_cpf, data_marcacao
                                ORDER BY hora_marcacao, created_at) AS pos,
             count(*) OVER (PARTITION BY tenant_id, colaborador_cpf, data_marcacao) AS n,
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
    IF EXISTS (
      SELECT 1 FROM public.ponto_fechamentos
      WHERE tenant_id = r.tenant_id
        AND competencia = to_char(r.data_marcacao, 'YYYY-MM')
        AND status = 'fechado'
    ) THEN
      CONTINUE;
    END IF;

    IF public.ponto_reordena_tipos_dia(r.tenant_id, r.colaborador_cpf, r.data_marcacao) THEN
      BEGIN
        PERFORM public.consolidar_ponto_diario_manual(r.tenant_id, r.colaborador_cpf, r.data_marcacao);
        v_corrigidos := v_corrigidos + 1;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END LOOP;

  RAISE NOTICE 'Backfill: % dia(s) corrigido(s)', v_corrigidos;
END $backfill$;
