
-- =============================================
-- MÓDULO MEA - METAS ERGONOMICAMENTE ALINHADAS
-- =============================================

-- 1. Adicionar campos de categoria e origem na tabela metas existente
ALTER TABLE public.metas
  ADD COLUMN IF NOT EXISTS categoria_meta TEXT DEFAULT 'operacional',
  ADD COLUMN IF NOT EXISTS origem_meta TEXT DEFAULT 'gestor',
  ADD COLUMN IF NOT EXISTS origem_referencia_id UUID,
  ADD COLUMN IF NOT EXISTS ierm_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ierm_nivel TEXT DEFAULT 'segura',
  ADD COLUMN IF NOT EXISTS ierm_calculado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS premiacao_tipo TEXT,
  ADD COLUMN IF NOT EXISTS premiacao_descricao TEXT,
  ADD COLUMN IF NOT EXISTS premiacao_valor NUMERIC,
  ADD COLUMN IF NOT EXISTS premiacao_atingida BOOLEAN DEFAULT FALSE;

-- 2. Tabela de Análise Ergonômica da Meta (AEM)
CREATE TABLE IF NOT EXISTS public.meta_aem (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_id UUID REFERENCES public.metas(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) NOT NULL,

  -- 2.2.1 Exigência da Meta
  exigencia_fisica TEXT DEFAULT 'nenhuma',
  exigencia_cognitiva TEXT DEFAULT 'nenhuma',
  exigencia_emocional TEXT DEFAULT 'nenhuma',

  -- 2.2.2 Ritmo e Pressão
  ritmo_imposto TEXT DEFAULT 'autogerido',
  pressao_prazo TEXT DEFAULT 'nao',

  -- 2.2.3 Autonomia e Controle
  grau_autonomia TEXT DEFAULT 'alto',
  possibilidade_ajuste_metodo TEXT DEFAULT 'sim',

  -- 2.2.4 Jornada e Pausas
  impacta_jornada BOOLEAN DEFAULT FALSE,
  exige_horas_extras TEXT DEFAULT 'nao',
  exige_atencao_continua BOOLEAN DEFAULT FALSE,

  -- 2.2.5 Compatibilidade Organizacional
  compativel_funcao TEXT DEFAULT 'sim',
  compativel_competencias TEXT DEFAULT 'sim',

  -- IERM calculado
  ierm_score INTEGER DEFAULT 0,
  ierm_nivel TEXT DEFAULT 'segura',

  -- Rastreabilidade
  preenchido_por UUID,
  preenchido_por_nome TEXT,
  revisado_por UUID,
  revisado_por_nome TEXT,
  revisado_em TIMESTAMPTZ,

  -- Validação do colaborador
  colaborador_validou BOOLEAN DEFAULT FALSE,
  colaborador_validou_em TIMESTAMPTZ,
  colaborador_sinaliza_dificuldade BOOLEAN DEFAULT FALSE,
  colaborador_observacao TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabela de Ações vinculadas à Meta
CREATE TABLE IF NOT EXISTS public.meta_acoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_id UUID REFERENCES public.metas(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) NOT NULL,
  descricao TEXT NOT NULL,
  tipo TEXT DEFAULT 'tarefa',
  responsavel_id UUID,
  responsavel_nome TEXT,
  prazo TIMESTAMPTZ,
  prioridade TEXT DEFAULT 'media',
  evidencia_esperada TEXT,
  status TEXT DEFAULT 'pendente',
  progresso INTEGER DEFAULT 0,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Tabela de Controle de Tempo das Ações
CREATE TABLE IF NOT EXISTS public.meta_acao_tempo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acao_id UUID REFERENCES public.meta_acoes(id) ON DELETE CASCADE NOT NULL,
  meta_id UUID REFERENCES public.metas(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) NOT NULL,
  tipo TEXT NOT NULL, -- 'inicio', 'pausa', 'retomada', 'encerramento'
  registrado_por UUID,
  registrado_por_nome TEXT,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Tabela de Histórico/Timeline da Meta (auditoria)
CREATE TABLE IF NOT EXISTS public.meta_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_id UUID REFERENCES public.metas(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) NOT NULL,
  tipo TEXT NOT NULL, -- 'criacao', 'ajuste', 'acao_criada', 'execucao', 'evidencia', 'conclusao', 'aem_preenchida', 'aem_revisada', 'validacao_colaborador'
  descricao TEXT,
  dados_anteriores JSONB,
  dados_novos JSONB,
  usuario_id UUID,
  usuario_nome TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Índices
CREATE INDEX IF NOT EXISTS idx_meta_aem_meta_id ON public.meta_aem(meta_id);
CREATE INDEX IF NOT EXISTS idx_meta_aem_tenant_id ON public.meta_aem(tenant_id);
CREATE INDEX IF NOT EXISTS idx_meta_acoes_meta_id ON public.meta_acoes(meta_id);
CREATE INDEX IF NOT EXISTS idx_meta_acoes_tenant_id ON public.meta_acoes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_meta_acao_tempo_acao_id ON public.meta_acao_tempo(acao_id);
CREATE INDEX IF NOT EXISTS idx_meta_historico_meta_id ON public.meta_historico(meta_id);

-- 7. RLS
ALTER TABLE public.meta_aem ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_acoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_acao_tempo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation meta_aem" ON public.meta_aem
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Tenant isolation meta_acoes" ON public.meta_acoes
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Tenant isolation meta_acao_tempo" ON public.meta_acao_tempo
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Tenant isolation meta_historico" ON public.meta_historico
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- 8. Trigger updated_at
CREATE TRIGGER update_meta_aem_updated_at BEFORE UPDATE ON public.meta_aem
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meta_acoes_updated_at BEFORE UPDATE ON public.meta_acoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Função para calcular IERM automaticamente
CREATE OR REPLACE FUNCTION public.calcular_ierm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_score INTEGER := 0;
  v_nivel TEXT;
  v_pontos_exigencia INTEGER := 0;
  v_pontos_ritmo INTEGER := 0;
  v_pontos_autonomia INTEGER := 0;
  v_pontos_jornada INTEGER := 0;
  v_pontos_compat INTEGER := 0;
BEGIN
  -- Exigências (0-3 cada, max 9)
  v_pontos_exigencia := v_pontos_exigencia +
    CASE NEW.exigencia_fisica WHEN 'alta' THEN 3 WHEN 'moderada' THEN 2 WHEN 'baixa' THEN 1 ELSE 0 END +
    CASE NEW.exigencia_cognitiva WHEN 'alta' THEN 3 WHEN 'moderada' THEN 2 WHEN 'baixa' THEN 1 ELSE 0 END +
    CASE NEW.exigencia_emocional WHEN 'alta' THEN 3 WHEN 'moderada' THEN 2 WHEN 'baixa' THEN 1 ELSE 0 END;

  -- Ritmo e Pressão (0-3 cada, max 6)
  v_pontos_ritmo :=
    CASE NEW.ritmo_imposto WHEN 'acelerado' THEN 3 WHEN 'moderado' THEN 2 WHEN 'autogerido' THEN 0 ELSE 0 END +
    CASE NEW.pressao_prazo WHEN 'continua' THEN 3 WHEN 'eventual' THEN 1 WHEN 'nao' THEN 0 ELSE 0 END;

  -- Autonomia (inverso: menos autonomia = mais risco)
  v_pontos_autonomia :=
    CASE NEW.grau_autonomia WHEN 'baixo' THEN 3 WHEN 'medio' THEN 1 WHEN 'alto' THEN 0 ELSE 0 END +
    CASE NEW.possibilidade_ajuste_metodo WHEN 'nao' THEN 3 WHEN 'parcial' THEN 1 WHEN 'sim' THEN 0 ELSE 0 END;

  -- Jornada (max 9)
  v_pontos_jornada :=
    CASE WHEN NEW.impacta_jornada THEN 2 ELSE 0 END +
    CASE NEW.exige_horas_extras WHEN 'frequentes' THEN 3 WHEN 'eventuais' THEN 1 WHEN 'nao' THEN 0 ELSE 0 END +
    CASE WHEN NEW.exige_atencao_continua THEN 2 ELSE 0 END;

  -- Compatibilidade (max 6)
  v_pontos_compat :=
    CASE NEW.compativel_funcao WHEN 'nao' THEN 3 WHEN 'parcial' THEN 1 WHEN 'sim' THEN 0 ELSE 0 END +
    CASE NEW.compativel_competencias WHEN 'nao' THEN 3 WHEN 'sim' THEN 0 ELSE 0 END;

  -- Score total (max ~36)
  v_score := v_pontos_exigencia + v_pontos_ritmo + v_pontos_autonomia + v_pontos_jornada + v_pontos_compat;

  -- Normalizar para 0-100
  v_score := LEAST(100, ROUND(v_score::numeric / 36.0 * 100));

  -- Classificação
  v_nivel := CASE
    WHEN v_score >= 66 THEN 'risco'
    WHEN v_score >= 33 THEN 'atencao'
    ELSE 'segura'
  END;

  NEW.ierm_score := v_score;
  NEW.ierm_nivel := v_nivel;

  -- Atualizar meta pai
  UPDATE public.metas SET
    ierm_score = v_score,
    ierm_nivel = v_nivel,
    ierm_calculado_em = now()
  WHERE id = NEW.meta_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_calcular_ierm
  BEFORE INSERT OR UPDATE ON public.meta_aem
  FOR EACH ROW EXECUTE FUNCTION public.calcular_ierm();

-- 10. Função para recalcular progresso da meta baseado em ações
CREATE OR REPLACE FUNCTION public.recalcular_progresso_meta_acoes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_total INTEGER;
  v_concluidas INTEGER;
  v_progresso INTEGER;
  v_status TEXT;
  v_meta_id UUID;
BEGIN
  v_meta_id := COALESCE(NEW.meta_id, OLD.meta_id);

  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'concluida')
  INTO v_total, v_concluidas
  FROM public.meta_acoes
  WHERE meta_id = v_meta_id;

  IF v_total > 0 THEN
    v_progresso := ROUND((v_concluidas::numeric / v_total) * 100);
  ELSE
    v_progresso := 0;
  END IF;

  -- Determinar status
  IF v_concluidas = v_total AND v_total > 0 THEN
    v_status := 'concluida';
  ELSIF v_concluidas > 0 THEN
    v_status := 'em_andamento';
  ELSE
    v_status := 'nao_iniciada';
  END IF;

  UPDATE public.metas SET
    progresso = v_progresso,
    status = v_status::meta_status
  WHERE id = v_meta_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trigger_recalc_meta_acoes
  AFTER INSERT OR UPDATE OR DELETE ON public.meta_acoes
  FOR EACH ROW EXECUTE FUNCTION public.recalcular_progresso_meta_acoes();
