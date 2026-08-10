-- =====================================================================
-- Dispatch dos agentes YourEyes sem URL de produção no código
--
-- Preparação do ambiente de staging (análise de 08/08): a função
-- youreyes_dispatch_agentes roda a cada minuto pelo pg_cron e chamava
-- a Edge Function com a URL e a chave do projeto de PRODUÇÃO escritas
-- no código. Num segundo banco (staging), essas mesmas migrations
-- fariam o ambiente de teste disparar funções da produção — o oposto
-- do isolamento que um staging existe para dar.
--
-- Este arquivo move URL e chave para a tabela app_config:
--   · sem valores configurados, o dispatch NÃO chama ninguém e avisa
--     no log — o padrão é seguro para qualquer ambiente novo;
--   · cada ambiente insere os próprios valores (o script de entrega
--     semeia os de produção; o roteiro de staging, os de staging).
--
-- A migration original (20260803100000) foi editada no repositório
-- com esta mesma versão — bancos novos já nascem certos. Esta
-- migration garante o mesmo estado em bancos que rodaram a original.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.app_config (
  chave text PRIMARY KEY,
  valor text NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_config FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.app_config IS
  'Configuração por ambiente (URL do projeto, chave publicável). Lida apenas por funções SECURITY DEFINER e pelo service_role; sem acesso de anon/authenticated.';

CREATE OR REPLACE FUNCTION public.youreyes_dispatch_agentes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_agente RECORD;
  v_base timestamptz;
  v_url text;
  v_key text;
BEGIN
  SELECT valor INTO v_url FROM public.app_config WHERE chave = 'supabase_url';
  SELECT valor INTO v_key FROM public.app_config WHERE chave = 'supabase_anon_key';
  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE NOTICE 'youreyes_dispatch_agentes: app_config sem supabase_url/supabase_anon_key — nenhum agente disparado (proteção de ambiente).';
    RETURN;
  END IF;

  FOR v_agente IN
    SELECT id, periodicidade, dias_semana, dia_mes, horario
    FROM youreyes_agentes
    WHERE ativo = true
      AND proxima_execucao IS NOT NULL
      AND proxima_execucao <= now()
  LOOP
    PERFORM net.http_post(
      url := v_url || '/functions/v1/youreyes-run-agent',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body := jsonb_build_object('agente_id', v_agente.id, 'origem', 'agendada')
    );

    -- Reagenda imediatamente para evitar disparo duplicado.
    -- Quinzenal: parte de +7 dias para que o próximo dia da semana marcado caia ~14 dias à frente.
    v_base := CASE WHEN v_agente.periodicidade = 'quinzenal'
                   THEN now() + interval '7 days'
                   ELSE now() END;

    UPDATE youreyes_agentes
    SET proxima_execucao = public.youreyes_calcular_proxima_execucao(
          periodicidade, dias_semana, dia_mes, horario, v_base
        )
    WHERE id = v_agente.id;
  END LOOP;
END;
$$;
