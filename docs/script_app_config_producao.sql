-- =====================================================================
-- YourEyes — PRODUÇÃO: agentes por configuração (preparação do staging)
--
-- COLE ESTE ARQUIVO INTEIRO no SQL Editor do Supabase DE PRODUÇÃO e
-- execute UMA vez. Pode rodar de novo sem medo: ele é idempotente.
--
-- O que ele faz e por quê:
--   A rotina que dispara os agentes YourEyes (roda a cada minuto)
--   tinha a URL e a chave do projeto de produção ESCRITAS NO CÓDIGO.
--   Para produção isso funciona, mas é a armadilha do ambiente de
--   testes: o staging, criado com as mesmas migrations, chamaria as
--   funções da PRODUÇÃO a cada minuto.
--
--   Este script move os valores para a tabela app_config e regrava a
--   rotina para lê-los de lá. Em produção NADA muda de comportamento:
--   os agentes continuam disparando normalmente, com os MESMOS
--   valores de hoje — só que agora vindos da configuração. Num
--   ambiente sem configuração, a rotina não chama ninguém.
--
--   (A chave usada é a "anon/publishable", que é pública por desenho —
--   é a mesma que o navegador de qualquer usuário já recebe.)
-- =====================================================================

-- 1) Tabela de configuração (leitura só por funções internas)
CREATE TABLE IF NOT EXISTS public.app_config (
  chave text PRIMARY KEY,
  valor text NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_config FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.app_config IS
  'Configuração por ambiente (URL do projeto, chave publicável). Lida apenas por funções SECURITY DEFINER e pelo service_role; sem acesso de anon/authenticated.';

-- 2) Valores DE PRODUÇÃO (os mesmos que estavam fixos no código)
INSERT INTO public.app_config (chave, valor) VALUES
  ('supabase_url', 'https://diayjpsrcerycycyaxst.supabase.co'),
  ('supabase_anon_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpYXlqcHNyY2VyeWN5Y3lheHN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3Mjg3NTEsImV4cCI6MjA4MzMwNDc1MX0.5DUjPQQB-CKdiuERL3LBUX4g2yzDy_L5b-M8FQS-Dxo')
ON CONFLICT (chave) DO UPDATE
  SET valor = EXCLUDED.valor, atualizado_em = now();

-- 3) A rotina passa a ler da configuração
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

-- 4) CONFERÊNCIA -------------------------------------------------------
-- Esperado: config_completa = sim | rotina_sem_url_fixa = sim
SELECT
  CASE WHEN (SELECT count(*) FROM public.app_config
             WHERE chave IN ('supabase_url', 'supabase_anon_key')) = 2
       THEN 'sim' ELSE 'NÃO' END AS config_completa,
  CASE WHEN pg_get_functiondef('public.youreyes_dispatch_agentes()'::regprocedure)
            NOT LIKE '%diayjpsrcerycycyaxst%'
       THEN 'sim' ELSE 'NÃO' END AS rotina_sem_url_fixa;
