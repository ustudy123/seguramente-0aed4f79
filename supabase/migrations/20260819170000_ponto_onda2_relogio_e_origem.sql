-- ============================================================================
-- ONDA 2 (parte 2) — Relógio confiável e origem da batida
-- PONTO-378 / PONTO-379
--
-- Requisitos do REP-P (Portaria MTP 671/2021, Anexo IX):
--   (378) A marcação precisa registrar se nasceu ON-LINE ou OFF-LINE e o momento
--         da sincronização, preservando a HORA DA BATIDA como a oficial. Sem
--         isso, uma marcação offline não teria como distinguir a hora do fato da
--         hora do envio.
--   (379) O relógio do REP-P precisa ser monitorado contra a Hora Legal
--         Brasileira (Observatório Nacional). Registra-se a checagem numa trilha
--         e alerta-se quando o desvio passa da tolerância.
--
-- Tudo aqui é ADITIVO: colunas novas com padrão neutro e mecanismos novos ao
-- lado do que já existe. Nada do fluxo atual muda.
-- ============================================================================

-- (378) Origem e sincronização da marcação -----------------------------------
ALTER TABLE public.ponto_marcacoes
  ADD COLUMN IF NOT EXISTS origem_offline boolean NOT NULL DEFAULT false;

ALTER TABLE public.ponto_marcacoes
  ADD COLUMN IF NOT EXISTS sincronizado_em timestamptz;

COMMENT ON COLUMN public.ponto_marcacoes.origem_offline IS
  'Marca se a batida foi feita off-line (registrada no dispositivo e enviada depois). A hora_marcacao continua sendo a hora oficial do fato; sincronizado_em guarda o momento do envio.';
COMMENT ON COLUMN public.ponto_marcacoes.sincronizado_em IS
  'Momento em que a batida off-line foi sincronizada com o servidor. Nulo para batidas on-line (nascem sincronizadas).';

-- (379) Trilha de checagens do relógio contra a Hora Legal Brasileira ---------
CREATE TABLE IF NOT EXISTS public.ponto_relogio_checagens (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verificado_em  timestamptz NOT NULL DEFAULT now(),
  hora_servidor  timestamptz NOT NULL,
  hora_legal     timestamptz,           -- Hora Legal Brasileira (Observatório Nacional)
  desvio_seg     numeric,
  tolerancia_seg integer,
  dentro_tolerancia boolean
);

COMMENT ON TABLE public.ponto_relogio_checagens IS
  'Trilha das checagens do relogio do ponto contra a Hora Legal Brasileira (Observatorio Nacional), exigidas do REP-P pela Portaria 671/2021.';

ALTER TABLE public.ponto_relogio_checagens ENABLE ROW LEVEL SECURITY;

DO $rls$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
     WHERE schemaname='public' AND tablename='ponto_relogio_checagens'
       AND policyname='ponto_relogio_checagens_leitura') THEN
    CREATE POLICY ponto_relogio_checagens_leitura
      ON public.ponto_relogio_checagens FOR SELECT
      TO authenticated USING (true);
  END IF;
END $rls$;

-- Monitoração do relógio contra a Hora Legal Brasileira.
-- A hora_legal é obtida da fonte oficial (Observatório Nacional / NTP) por quem
-- chama — tipicamente uma Edge Function, que é quem pode sair para a rede. Esta
-- rotina avalia o desvio, registra a checagem na trilha e, se passar da
-- tolerância, alerta os tenants ativos (idempotente por dia).
CREATE OR REPLACE FUNCTION public.ponto_monitorar_hora_legal(
  p_hora_legal timestamptz,
  p_tolerancia_seg integer DEFAULT 60,
  p_tenant_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_servidor timestamptz := clock_timestamp();
  v_desvio   numeric;
  v_ok       boolean;
  v_hoje     date := CURRENT_DATE;
BEGIN
  IF p_hora_legal IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'hora_legal_ausente');
  END IF;

  v_desvio := EXTRACT(EPOCH FROM (v_servidor - p_hora_legal));
  v_ok := abs(v_desvio) <= COALESCE(p_tolerancia_seg, 60);

  INSERT INTO public.ponto_relogio_checagens
    (hora_servidor, hora_legal, desvio_seg, tolerancia_seg, dentro_tolerancia)
  VALUES (v_servidor, p_hora_legal, v_desvio, p_tolerancia_seg, v_ok);

  IF NOT v_ok THEN
    -- Alerta os tenants com movimento recente (ou o informado), um por dia.
    INSERT INTO public.ponto_alertas
      (tenant_id, tipo, severidade, titulo, descricao, data_referencia)
    SELECT t.id, 'relogio_fora_hora_legal', 'critica',
           'Relogio do ponto fora da Hora Legal Brasileira',
           format('Desvio de %s segundos do relogio contra a Hora Legal Brasileira '
               || '(tolerancia de %s s). O carimbo das marcacoes pode estar incorreto — '
               || 'verificar a sincronizacao do servidor.', round(v_desvio,1), p_tolerancia_seg),
           v_hoje
    FROM public.tenants t
    WHERE (p_tenant_id IS NULL OR t.id = p_tenant_id)
      AND (p_tenant_id IS NOT NULL OR EXISTS (
            SELECT 1 FROM public.ponto_marcacoes m
            WHERE m.tenant_id = t.id AND m.data_marcacao >= v_hoje - 30))
      AND NOT EXISTS (
            SELECT 1 FROM public.ponto_alertas a
            WHERE a.tenant_id = t.id
              AND a.tipo = 'relogio_fora_hora_legal'
              AND a.data_referencia = v_hoje);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'hora_servidor', v_servidor,
    'hora_legal', p_hora_legal,
    'desvio_seg', v_desvio,
    'tolerancia_seg', p_tolerancia_seg,
    'dentro_tolerancia', v_ok
  );
END;
$$;

COMMENT ON FUNCTION public.ponto_monitorar_hora_legal(timestamptz, integer, uuid) IS
  'Compara o relogio do servidor com a Hora Legal Brasileira (Observatorio Nacional) fornecida pelo chamador, registra a checagem na trilha e alerta quando o desvio passa da tolerancia. Requisito do REP-P (Portaria 671/2021).';
