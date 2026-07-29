-- ============================================================================
-- Férias — Encargos parametrizáveis por empresa (Fase 2, seção 7.4)
--
-- A taxa de encargos muda o resultado financeiro de forma relevante e depende
-- do regime tributário (Simples por anexo, RAT ajustado por FAP). O DRF exige
-- parametrização por CNPJ — obrigatória em grupo multiempresa. Estende a
-- ferias_config (Fase 1), que já é por empresa.
--
-- Todos os campos têm default que reproduz a composição sugerida na seção 7.4:
-- patronal 20% + RAT/FAP 2% + terceiros 5,8% + FGTS 8%.
-- ============================================================================

ALTER TABLE public.ferias_config
    ADD COLUMN IF NOT EXISTS encargo_inss_patronal NUMERIC(5,2) NOT NULL DEFAULT 20,
    ADD COLUMN IF NOT EXISTS encargo_rat_fap       NUMERIC(5,2) NOT NULL DEFAULT 2,
    ADD COLUMN IF NOT EXISTS encargo_terceiros     NUMERIC(5,2) NOT NULL DEFAULT 5.8,
    ADD COLUMN IF NOT EXISTS encargo_fgts          NUMERIC(5,2) NOT NULL DEFAULT 8,
    -- Simples Nacional (Anexos I, II, III, V) dispensa patronal e terceiros;
    -- Anexo IV recolhe. Quando true, o cálculo zera patronal e terceiros.
    ADD COLUMN IF NOT EXISTS simples_dispensa_patronal BOOLEAN NOT NULL DEFAULT FALSE;
