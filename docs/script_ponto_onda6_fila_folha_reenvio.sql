-- ============================================================================
-- ENTREGA — ONDA 6 (parte 5): fila da folha com estados e reenvio idempotente
-- Alvos: ponto_folha_marcar_status (nova); ponto_folha_reenviar (nova)
-- PONTO-398  (fecha a onda 6)
--
-- A exportacao para a folha era um registro passivo: sem fila, sem reenvio, sem
-- confirmacao. A coluna status ja tem os quatro estados (gerado/enviado/
-- processado/erro), mas nada os movimentava. Passa a existir a transicao de
-- estado VALIDADA e o REENVIO IDEMPOTENTE (reencaminha so o que esta em erro,
-- sem duplicar nem perder).
--
-- GARANTIAS: nao cria exportacao nova (usa a da parte 4); nao altera o motor de
-- saldo, o espelho nem o fechamento. Aditivo e idempotente. Sem backfill.
-- ============================================================================

-- (1) Transição de estado validada -------------------------------------------
CREATE OR REPLACE FUNCTION public.ponto_folha_marcar_status(
  p_export_id   uuid,
  p_novo_status text,
  p_detalhe     text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_atual text;
  v_ok    boolean;
BEGIN
  SELECT status INTO v_atual FROM public.ponto_exportacoes_folha WHERE id = p_export_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exportacao de folha % nao encontrada.', p_export_id USING ERRCODE = 'raise_exception';
  END IF;

  -- Estados da fila (pendente/enviado/confirmado/falha):
  --   gerado    -> enviado | erro
  --   enviado   -> processado | erro
  --   erro      -> gerado         (reenvio)
  --   x         -> x              (idempotente)
  v_ok := CASE
    WHEN v_atual = 'gerado'  AND p_novo_status IN ('enviado', 'erro') THEN true
    WHEN v_atual = 'enviado' AND p_novo_status IN ('processado', 'erro') THEN true
    WHEN v_atual = 'erro'    AND p_novo_status = 'gerado' THEN true
    WHEN v_atual = p_novo_status THEN true
    ELSE false
  END;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'Transicao de status invalida na fila da folha: % -> %.', v_atual, p_novo_status
      USING ERRCODE = 'raise_exception';
  END IF;

  UPDATE public.ponto_exportacoes_folha
     SET status = p_novo_status,
         dados_exportados = jsonb_set(
           COALESCE(dados_exportados, '{}'::jsonb), '{fila}',
           COALESCE(dados_exportados -> 'fila', '[]'::jsonb)
             || jsonb_build_object('de', v_atual, 'para', p_novo_status,
                                   'detalhe', p_detalhe, 'em', now()))
   WHERE id = p_export_id;
END;
$$;

COMMENT ON FUNCTION public.ponto_folha_marcar_status(uuid, text, text) IS
  'Transicao de estado da fila da folha (gerado->enviado->processado; ->erro na falha; erro->gerado no reenvio), validada e com trilha em dados_exportados->fila. PONTO-398.';

-- (2) Reenvio idempotente ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.ponto_folha_reenviar(
  p_tenant_id   uuid,
  p_empresa_id  uuid,
  p_competencia text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_n int := 0;
  r   RECORD;
BEGIN
  FOR r IN
    SELECT id, COALESCE((dados_exportados ->> 'tentativas')::int, 0) AS tent
    FROM public.ponto_exportacoes_folha
    WHERE tenant_id = p_tenant_id
      AND competencia = p_competencia
      AND (p_empresa_id IS NULL OR empresa_id = p_empresa_id
           OR (p_empresa_id IS NULL AND empresa_id IS NULL))
      AND status = 'erro'   -- só reenvia o que está em falha
  LOOP
    -- Reencaminha o MESMO registro (erro -> gerado): sem duplicidade. Bump da
    -- contagem de tentativas + carimbo do reenvio.
    UPDATE public.ponto_exportacoes_folha
       SET status = 'gerado',
           dados_exportados = jsonb_set(
             jsonb_set(
               jsonb_set(COALESCE(dados_exportados, '{}'::jsonb),
                         '{tentativas}', to_jsonb(r.tent + 1)),
               '{reenviado_em}', to_jsonb(now())),
             '{fila}',
             COALESCE(dados_exportados -> 'fila', '[]'::jsonb)
               || jsonb_build_object('de', 'erro', 'para', 'gerado',
                                     'detalhe', 'reenvio idempotente', 'em', now()))
     WHERE id = r.id;
    v_n := v_n + 1;
  END LOOP;

  RETURN v_n;  -- idempotente: reexecutar reencaminha só os que ainda estão em erro
END;
$$;

COMMENT ON FUNCTION public.ponto_folha_reenviar(uuid, uuid, text) IS
  'Reenvio idempotente da fila da folha: reencaminha (erro -> gerado) so os pacotes ainda em erro na competencia, incrementando tentativas, sem duplicar nem perder. PONTO-398.';

-- ---------------------------------------------------------------------------
-- CONFERENCIA — o SQL Editor mostra apenas o ultimo resultado.
-- Esperado: t | t | t | OK
--   marcar_existe   : t  (ponto_folha_marcar_status)
--   reenviar_existe : t  (ponto_folha_reenviar)
--   tem_estados     : t  (transicao conhece enviado/processado/erro)
-- ---------------------------------------------------------------------------
WITH m AS (SELECT prosrc FROM pg_proc WHERE proname='ponto_folha_marcar_status' LIMIT 1)
SELECT
  (to_regprocedure('public.ponto_folha_marcar_status(uuid,text,text)') IS NOT NULL) AS marcar_existe,
  (to_regprocedure('public.ponto_folha_reenviar(uuid,uuid,text)') IS NOT NULL)      AS reenviar_existe,
  ((SELECT prosrc FROM m) ILIKE '%enviado%' AND (SELECT prosrc FROM m) ILIKE '%processado%'
     AND (SELECT prosrc FROM m) ILIKE '%erro%') AS tem_estados,
  CASE WHEN to_regprocedure('public.ponto_folha_marcar_status(uuid,text,text)') IS NOT NULL
        AND to_regprocedure('public.ponto_folha_reenviar(uuid,uuid,text)') IS NOT NULL
        AND (SELECT prosrc FROM m) ILIKE '%enviado%' AND (SELECT prosrc FROM m) ILIKE '%processado%'
        AND (SELECT prosrc FROM m) ILIKE '%erro%'
       THEN 'OK' ELSE 'CONFERIR' END AS erro_tecnico;
