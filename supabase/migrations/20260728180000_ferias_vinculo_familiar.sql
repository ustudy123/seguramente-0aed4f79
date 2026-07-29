-- ============================================================================
-- Férias — Vínculo familiar entre colaboradores (Fase 3B-2, art. 136 §1º)
--
-- Art. 136 §1º da CLT: membros de uma família que trabalham no MESMO
-- estabelecimento têm direito a gozar férias no mesmo período, se não houver
-- prejuízo ao serviço. Para a regra (informativa) sugerir períodos coincidentes,
-- o sistema precisa saber quem é parente de quem — dado que não existia.
--
-- Modelo simétrico: um par (colaborador A, colaborador B) com o grau. A regra
-- consulta nos dois sentidos. Casado por CPF, coerente com o resto do módulo.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ferias_vinculo_familiar (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL,
    empresa_id     UUID,

    -- Par de colaboradores (por CPF)
    cpf_a          TEXT NOT NULL,
    nome_a         TEXT NOT NULL,
    cpf_b          TEXT NOT NULL,
    nome_b         TEXT NOT NULL,

    grau           TEXT NOT NULL DEFAULT 'outro'
        CHECK (grau IN ('conjuge', 'pai_mae', 'filho', 'irmao', 'outro')),
    observacao     TEXT,

    criado_por     UUID,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Um vínculo por par, independente da ordem (normaliza no app: cpf_a < cpf_b)
    CONSTRAINT ferias_vinculo_par_unico UNIQUE (tenant_id, cpf_a, cpf_b),
    CONSTRAINT ferias_vinculo_nao_self CHECK (cpf_a <> cpf_b)
);

CREATE INDEX IF NOT EXISTS idx_ferias_vinculo_tenant
    ON public.ferias_vinculo_familiar (tenant_id, empresa_id);
CREATE INDEX IF NOT EXISTS idx_ferias_vinculo_cpf_a
    ON public.ferias_vinculo_familiar (tenant_id, cpf_a);
CREATE INDEX IF NOT EXISTS idx_ferias_vinculo_cpf_b
    ON public.ferias_vinculo_familiar (tenant_id, cpf_b);

ALTER TABLE public.ferias_vinculo_familiar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ferias_vinculo por tenant" ON public.ferias_vinculo_familiar;
CREATE POLICY "ferias_vinculo por tenant"
ON public.ferias_vinculo_familiar FOR ALL TO authenticated
USING (tenant_id = public.get_user_tenant_id())
WITH CHECK (tenant_id = public.get_user_tenant_id());

DROP TRIGGER IF EXISTS touch_ferias_vinculo ON public.ferias_vinculo_familiar;
CREATE TRIGGER touch_ferias_vinculo
BEFORE UPDATE ON public.ferias_vinculo_familiar
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
