-- ============================================================================
-- Plano de Ação PGR — Psicossocial
--
-- Armazena as ações 5W2H vinculadas a um fator de risco de um GHE, derivadas
-- do Inventário PGR. As ações podem ser sugeridas pela IA e depois editadas,
-- ou criadas manualmente. O nível de GRO é copiado no momento da geração para
-- preservar a prova documental: se a campanha for reprocessada depois, o plano
-- continua refletindo o risco que existia quando a ação foi decidida.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.psicossocial_plano_acao (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL,
    empresa_id     UUID,

    -- Recorte que originou a ação
    campanha_ids   UUID[] NOT NULL DEFAULT '{}',
    ghe_id         UUID,
    ghe_nome       TEXT NOT NULL DEFAULT 'Organização',

    -- Fator de risco do inventário
    fator_id       TEXT NOT NULL,
    fator          TEXT NOT NULL,
    nivel_gro      TEXT NOT NULL CHECK (nivel_gro IN ('trivial','baixo','medio','alto','critico')),

    -- 5W2H
    o_que          TEXT NOT NULL,
    quem           TEXT,
    onde           TEXT,
    por_que        TEXT,
    data_inicial   DATE,
    ate_quando     DATE,
    como           TEXT,
    quanto         TEXT,

    -- Controle
    selecionada    BOOLEAN NOT NULL DEFAULT FALSE,
    origem         TEXT NOT NULL DEFAULT 'ia' CHECK (origem IN ('ia','manual')),
    criado_por     UUID,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_psico_plano_acao_tenant
    ON public.psicossocial_plano_acao (tenant_id, empresa_id);
CREATE INDEX IF NOT EXISTS idx_psico_plano_acao_ghe
    ON public.psicossocial_plano_acao (tenant_id, ghe_id);
CREATE INDEX IF NOT EXISTS idx_psico_plano_acao_campanhas
    ON public.psicossocial_plano_acao USING GIN (campanha_ids);

ALTER TABLE public.psicossocial_plano_acao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Plano acao psico select por tenant" ON public.psicossocial_plano_acao;
CREATE POLICY "Plano acao psico select por tenant"
ON public.psicossocial_plano_acao FOR SELECT TO authenticated
USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "Plano acao psico insert por tenant" ON public.psicossocial_plano_acao;
CREATE POLICY "Plano acao psico insert por tenant"
ON public.psicossocial_plano_acao FOR INSERT TO authenticated
WITH CHECK (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "Plano acao psico update por tenant" ON public.psicossocial_plano_acao;
CREATE POLICY "Plano acao psico update por tenant"
ON public.psicossocial_plano_acao FOR UPDATE TO authenticated
USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "Plano acao psico delete por tenant" ON public.psicossocial_plano_acao;
CREATE POLICY "Plano acao psico delete por tenant"
ON public.psicossocial_plano_acao FOR DELETE TO authenticated
USING (tenant_id = public.get_user_tenant_id());

DROP TRIGGER IF EXISTS touch_psicossocial_plano_acao ON public.psicossocial_plano_acao;
CREATE TRIGGER touch_psicossocial_plano_acao
BEFORE UPDATE ON public.psicossocial_plano_acao
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
