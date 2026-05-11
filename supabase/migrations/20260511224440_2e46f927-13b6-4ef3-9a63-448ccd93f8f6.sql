
ALTER TABLE public.ponto_escalas
  ADD COLUMN IF NOT EXISTS jornada_mensal_minutos INTEGER,
  ADD COLUMN IF NOT EXISTS dias_semana JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS janela_flexivel JSONB,
  ADD COLUMN IF NOT EXISTS regras_extras JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS acordo_individual_url TEXT,
  ADD COLUMN IF NOT EXISTS cct_act_url TEXT,
  ADD COLUMN IF NOT EXISTS observacoes TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ponto_marcacoes' AND column_name='classificacao_clt') THEN
    ALTER TABLE public.ponto_marcacoes ADD COLUMN classificacao_clt TEXT DEFAULT 'verde' CHECK (classificacao_clt IN ('verde','amarelo','vermelho'));
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='ponto_dia_consolidado') THEN
    ALTER TABLE public.ponto_dia_consolidado ADD COLUMN IF NOT EXISTS classificacao_clt TEXT DEFAULT 'verde';
    ALTER TABLE public.ponto_dia_consolidado ADD COLUMN IF NOT EXISTS riscos_detectados JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

ALTER TABLE public.ponto_configuracao
  ADD COLUMN IF NOT EXISTS modo_apuracao TEXT DEFAULT 'padrao' CHECK (modo_apuracao IN ('padrao','por_excecao')),
  ADD COLUMN IF NOT EXISTS ponto_excecao_acordo_url TEXT,
  ADD COLUMN IF NOT EXISTS jornada_diaria_max_minutos INTEGER DEFAULT 600,
  ADD COLUMN IF NOT EXISTS jornada_semanal_max_minutos INTEGER DEFAULT 2640,
  ADD COLUMN IF NOT EXISTS he_diaria_max_minutos INTEGER DEFAULT 120,
  ADD COLUMN IF NOT EXISTS interjornada_min_minutos INTEGER DEFAULT 660;

CREATE TABLE IF NOT EXISTS public.ponto_acordos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  empresa_id UUID,
  tipo TEXT NOT NULL CHECK (tipo IN ('individual','act','cct')),
  titulo TEXT NOT NULL,
  vigencia_inicio DATE,
  vigencia_fim DATE,
  documento_url TEXT,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ponto_acordos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ponto_acordos' AND policyname='acordos tenant select') THEN
    CREATE POLICY "acordos tenant select" ON public.ponto_acordos FOR SELECT USING (tenant_id = public.get_user_tenant_id());
    CREATE POLICY "acordos tenant insert" ON public.ponto_acordos FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id());
    CREATE POLICY "acordos tenant update" ON public.ponto_acordos FOR UPDATE USING (tenant_id = public.get_user_tenant_id());
    CREATE POLICY "acordos tenant delete" ON public.ponto_acordos FOR DELETE USING (tenant_id = public.get_user_tenant_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.ponto_banco_horas_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  empresa_id UUID,
  escala_id UUID REFERENCES public.ponto_escalas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'sem_banco' CHECK (tipo IN ('sem_banco','semanal','mensal','individual','coletivo')),
  prazo_compensacao_dias INTEGER DEFAULT 180,
  permite_saldo_positivo BOOLEAN DEFAULT true,
  permite_saldo_negativo BOOLEAN DEFAULT false,
  limite_acumulo_horas NUMERIC DEFAULT 60,
  forma_compensacao TEXT,
  forma_pagamento_vencer TEXT,
  exige_acordo_individual BOOLEAN DEFAULT false,
  exige_cct_act BOOLEAN DEFAULT false,
  acordo_id UUID REFERENCES public.ponto_acordos(id) ON DELETE SET NULL,
  data_inicio DATE DEFAULT CURRENT_DATE,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ponto_banco_horas_config ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ponto_banco_horas_config' AND policyname='bh tenant select') THEN
    CREATE POLICY "bh tenant select" ON public.ponto_banco_horas_config FOR SELECT USING (tenant_id = public.get_user_tenant_id());
    CREATE POLICY "bh tenant insert" ON public.ponto_banco_horas_config FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id());
    CREATE POLICY "bh tenant update" ON public.ponto_banco_horas_config FOR UPDATE USING (tenant_id = public.get_user_tenant_id());
    CREATE POLICY "bh tenant delete" ON public.ponto_banco_horas_config FOR DELETE USING (tenant_id = public.get_user_tenant_id());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.classificar_marcacao_clt(p_marcacao_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_marc RECORD;
  v_anterior RECORD;
  v_diff_minutos INTEGER;
  v_classificacao TEXT := 'verde';
  v_riscos JSONB := '[]'::jsonb;
BEGIN
  SELECT * INTO v_marc FROM public.ponto_marcacoes WHERE id = p_marcacao_id;
  IF NOT FOUND THEN RETURN 'verde'; END IF;

  IF v_marc.origem_marcacao IN ('manual','importacao','ajuste') OR v_marc.alterada_em IS NOT NULL THEN
    v_classificacao := 'amarelo';
    v_riscos := v_riscos || jsonb_build_object('tipo','marcacao_manual','desc','Marcação manual ou alterada');
  END IF;

  SELECT * INTO v_anterior
  FROM public.ponto_marcacoes
  WHERE colaborador_cpf = v_marc.colaborador_cpf
    AND tipo_marcacao = 'saida'
    AND data_hora < v_marc.data_hora
  ORDER BY data_hora DESC LIMIT 1;

  IF FOUND AND v_marc.tipo_marcacao = 'entrada' THEN
    v_diff_minutos := EXTRACT(EPOCH FROM (v_marc.data_hora - v_anterior.data_hora))/60;
    IF v_diff_minutos < 660 THEN
      v_classificacao := 'vermelho';
      v_riscos := v_riscos || jsonb_build_object('tipo','interjornada','desc',format('Apenas %s min entre jornadas (mínimo 660)', v_diff_minutos));
    END IF;
  END IF;

  UPDATE public.ponto_marcacoes SET classificacao_clt = v_classificacao WHERE id = p_marcacao_id;
  RETURN v_classificacao;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_classificar_marcacao()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.classificar_marcacao_clt(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_classificar_marcacao_clt ON public.ponto_marcacoes;
CREATE TRIGGER trg_classificar_marcacao_clt
  AFTER INSERT ON public.ponto_marcacoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_classificar_marcacao();
