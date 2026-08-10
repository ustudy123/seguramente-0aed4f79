-- ═══════════════════════════════════════════════════════════════
-- YourEyes · Central de Testes com Agentes de IA (somente superadmin)
-- Documentação de testes por módulo + agentes com execução agendada
-- ═══════════════════════════════════════════════════════════════

-- 1) Documentos de teste (diretório organizado por módulo/submódulo do menu)
CREATE TABLE public.youreyes_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  modulo text NOT NULL,
  submodulo text,
  conteudo text NOT NULL DEFAULT '',
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Agentes de teste (a "equipe" YourEyes)
CREATE TABLE public.youreyes_agentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  emoji text NOT NULL DEFAULT '🤖',
  descricao text,
  modulo text,
  documento_ids uuid[] NOT NULL DEFAULT '{}',
  ativo boolean NOT NULL DEFAULT true,
  periodicidade text NOT NULL DEFAULT 'diaria'
    CHECK (periodicidade IN ('diaria', 'semanal', 'quinzenal', 'mensal')),
  dias_semana integer[] NOT NULL DEFAULT '{1}',      -- 0=domingo ... 6=sábado
  dia_mes integer CHECK (dia_mes BETWEEN 1 AND 28),  -- usado na periodicidade mensal
  horario time NOT NULL DEFAULT '06:00',             -- horário local (America/Sao_Paulo)
  proxima_execucao timestamptz,
  ultima_execucao timestamptz,
  ultimo_status text,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3) Histórico de execuções
CREATE TABLE public.youreyes_execucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_id uuid NOT NULL REFERENCES public.youreyes_agentes(id) ON DELETE CASCADE,
  origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual', 'agendada')),
  status text NOT NULL DEFAULT 'executando'
    CHECK (status IN ('executando', 'sucesso', 'atencao', 'falha')),
  score integer,
  resumo text,
  resultado jsonb,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  finalizado_em timestamptz
);

CREATE INDEX idx_youreyes_execucoes_agente ON public.youreyes_execucoes (agente_id, iniciado_em DESC);
CREATE INDEX idx_youreyes_agentes_proxima ON public.youreyes_agentes (proxima_execucao) WHERE ativo = true;

-- ═══ RLS: acesso exclusivo de superadmin ═══
ALTER TABLE public.youreyes_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youreyes_agentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youreyes_execucoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "youreyes_documentos_superadmin" ON public.youreyes_documentos
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "youreyes_agentes_superadmin" ON public.youreyes_agentes
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "youreyes_execucoes_superadmin" ON public.youreyes_execucoes
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

-- ═══ Cálculo da próxima execução (horário local America/Sao_Paulo) ═══
CREATE OR REPLACE FUNCTION public.youreyes_calcular_proxima_execucao(
  _periodicidade text,
  _dias_semana integer[],
  _dia_mes integer,
  _horario time,
  _a_partir_de timestamptz DEFAULT now()
)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_local timestamp := _a_partir_de AT TIME ZONE 'America/Sao_Paulo';
  v_data date := v_local::date;
  v_dias integer[] := COALESCE(NULLIF(_dias_semana, '{}'::integer[]), '{1}'::integer[]);
  v_candidato timestamp := NULL;
  v_base date;
  i integer;
BEGIN
  IF _periodicidade = 'diaria' THEN
    v_candidato := v_data + _horario;
    IF v_candidato <= v_local THEN
      v_candidato := v_candidato + interval '1 day';
    END IF;

  ELSIF _periodicidade IN ('semanal', 'quinzenal') THEN
    -- Próximo dia da semana marcado (0=domingo ... 6=sábado).
    -- Para quinzenal, o dispatcher reagenda a partir de +7 dias, resultando em ciclos de 14 dias.
    FOR i IN 0..13 LOOP
      IF EXTRACT(dow FROM v_data + i)::integer = ANY (v_dias) THEN
        v_candidato := (v_data + i) + _horario;
        EXIT WHEN v_candidato > v_local;
        v_candidato := NULL;
      END IF;
    END LOOP;

  ELSIF _periodicidade = 'mensal' THEN
    v_base := date_trunc('month', v_data)::date + (LEAST(COALESCE(_dia_mes, 1), 28) - 1);
    v_candidato := v_base + _horario;
    IF v_candidato <= v_local THEN
      v_base := (date_trunc('month', v_data) + interval '1 month')::date
                + (LEAST(COALESCE(_dia_mes, 1), 28) - 1);
      v_candidato := v_base + _horario;
    END IF;
  END IF;

  IF v_candidato IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN v_candidato AT TIME ZONE 'America/Sao_Paulo';
END;
$$;

-- ═══ Trigger: mantém updated_at e recalcula proxima_execucao ═══
CREATE OR REPLACE FUNCTION public.youreyes_agentes_before_save()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at := now();

  IF NOT NEW.ativo THEN
    NEW.proxima_execucao := NULL;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.proxima_execucao := public.youreyes_calcular_proxima_execucao(
      NEW.periodicidade, NEW.dias_semana, NEW.dia_mes, NEW.horario
    );
  ELSIF NEW.proxima_execucao IS NULL
     OR NOT OLD.ativo
     OR NEW.periodicidade IS DISTINCT FROM OLD.periodicidade
     OR NEW.dias_semana IS DISTINCT FROM OLD.dias_semana
     OR NEW.dia_mes IS DISTINCT FROM OLD.dia_mes
     OR NEW.horario IS DISTINCT FROM OLD.horario THEN
    NEW.proxima_execucao := public.youreyes_calcular_proxima_execucao(
      NEW.periodicidade, NEW.dias_semana, NEW.dia_mes, NEW.horario
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_youreyes_agentes_before_save
  BEFORE INSERT OR UPDATE ON public.youreyes_agentes
  FOR EACH ROW EXECUTE FUNCTION public.youreyes_agentes_before_save();

CREATE OR REPLACE FUNCTION public.youreyes_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_youreyes_documentos_updated
  BEFORE UPDATE ON public.youreyes_documentos
  FOR EACH ROW EXECUTE FUNCTION public.youreyes_touch_updated_at();

-- ═══ Dispatcher: dispara agentes com execução vencida ═══
-- Configuração por ambiente: a URL do próprio projeto e a chave publicável
-- ficam em app_config, nunca no código. Sem os valores, o dispatch não chama
-- ninguém — impossível um staging disparar funções da produção.
CREATE TABLE IF NOT EXISTS public.app_config (
  chave text PRIMARY KEY,
  valor text NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_config FROM PUBLIC, anon, authenticated;

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

-- Verificação a cada minuto (precisão do horário configurado no agente)
SELECT cron.schedule(
  'youreyes-dispatch-agentes',
  '* * * * *',
  $$SELECT public.youreyes_dispatch_agentes()$$
);
