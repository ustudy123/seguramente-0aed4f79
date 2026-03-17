
-- ============================================================
-- GRO: Tabela unificada de riscos ergonômicos (físicos + psicossociais)
-- Consolida ergonomia_riscos (físicos) + riscos oriundos do módulo psicossocial
-- Compatível com NR-1 GRO, NR-17 e ISO 45003
-- ============================================================

CREATE TABLE IF NOT EXISTS public.gro_riscos (
  id                     UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id              UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  empresa_id             UUID REFERENCES public.empresa_cadastro(id) ON DELETE SET NULL,

  subtipo                TEXT NOT NULL CHECK (subtipo IN ('fisico', 'psicossocial')),
  fonte                  TEXT NOT NULL DEFAULT 'manual'
                         CHECK (fonte IN ('aep', 'questionario', 'ia', 'observacao', 'manual', 'psicossocial')),

  titulo                 TEXT NOT NULL,
  descricao              TEXT,
  perigo_identificado    TEXT,

  setor                  TEXT,
  cargo                  TEXT,
  atividade              TEXT,
  unidade                TEXT,

  trabalhadores_expostos INTEGER,
  grupos_expostos        TEXT[],

  probabilidade          TEXT NOT NULL DEFAULT 'baixa'
                         CHECK (probabilidade IN ('muito_baixa', 'baixa', 'moderada', 'alta', 'muito_alta')),
  severidade             TEXT NOT NULL DEFAULT 'leve'
                         CHECK (severidade IN ('leve', 'moderada', 'grave', 'gravissima')),
  nivel_risco            TEXT NOT NULL DEFAULT 'baixo',

  medidas_existentes     TEXT[],
  medidas_recomendadas   TEXT[],

  campanha_id            UUID REFERENCES public.questionario_psicossocial_campanhas(id) ON DELETE SET NULL,
  analise_ergonomia_id   UUID REFERENCES public.ergonomia_analises(id) ON DELETE SET NULL,
  ergonomia_risco_id     UUID REFERENCES public.ergonomia_riscos(id) ON DELETE SET NULL,

  base_normativa         TEXT[],
  dimensao_psicossocial  TEXT,
  score_dimensao         NUMERIC,

  acao_id                UUID,

  status_gro             TEXT NOT NULL DEFAULT 'identificado'
                         CHECK (status_gro IN ('identificado', 'avaliado', 'controlado', 'monitorado', 'revisado')),

  ativo                  BOOLEAN NOT NULL DEFAULT TRUE,

  created_at             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Função para calcular nível de risco automaticamente
CREATE OR REPLACE FUNCTION public.calcular_nivel_gro_risco()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.nivel_risco := CASE
    WHEN NEW.probabilidade IN ('alta', 'muito_alta') AND NEW.severidade IN ('grave', 'gravissima') THEN 'critico'
    WHEN NEW.probabilidade IN ('alta', 'muito_alta') AND NEW.severidade = 'moderada' THEN 'alto'
    WHEN NEW.probabilidade = 'moderada' AND NEW.severidade IN ('grave', 'gravissima') THEN 'alto'
    WHEN NEW.probabilidade IN ('baixa', 'muito_baixa') AND NEW.severidade IN ('grave', 'gravissima') THEN 'medio'
    WHEN NEW.probabilidade = 'moderada' AND NEW.severidade = 'moderada' THEN 'medio'
    WHEN NEW.probabilidade IN ('alta', 'muito_alta') AND NEW.severidade = 'leve' THEN 'medio'
    ELSE 'baixo'
  END;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_gro_riscos_nivel_risco
  BEFORE INSERT OR UPDATE ON public.gro_riscos
  FOR EACH ROW EXECUTE FUNCTION public.calcular_nivel_gro_risco();

CREATE TRIGGER trg_gro_riscos_updated_at
  BEFORE UPDATE ON public.gro_riscos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_gro_riscos_tenant_id ON public.gro_riscos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_gro_riscos_empresa_id ON public.gro_riscos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_gro_riscos_subtipo ON public.gro_riscos(subtipo);
CREATE INDEX IF NOT EXISTS idx_gro_riscos_nivel_risco ON public.gro_riscos(nivel_risco);
CREATE INDEX IF NOT EXISTS idx_gro_riscos_campanha_id ON public.gro_riscos(campanha_id);
CREATE INDEX IF NOT EXISTS idx_gro_riscos_status_gro ON public.gro_riscos(status_gro);

ALTER TABLE public.gro_riscos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gro_riscos_tenant_select" ON public.gro_riscos
  FOR SELECT USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "gro_riscos_tenant_insert" ON public.gro_riscos
  FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "gro_riscos_tenant_update" ON public.gro_riscos
  FOR UPDATE USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "gro_riscos_tenant_delete" ON public.gro_riscos
  FOR DELETE USING (tenant_id = public.get_user_tenant_id());
