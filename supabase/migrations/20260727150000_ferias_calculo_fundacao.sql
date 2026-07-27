-- ============================================================================
-- Férias — Fundação do cálculo por período aquisitivo (Fatia 1 + 2)
--
-- Hoje o modulo de ferias assume 30 dias fixos para todos (FeriasSaldos.tsx:
-- saldoTotal: 30). Nao ha calculo do art. 130 da CLT, nao ha tratamento de
-- faltas, nao ha dias proporcionais. Esta migration cria a base para o calculo
-- real: uma linha por colaborador x periodo aquisitivo, o metodo de calculo
-- por empresa, e as funcoes que aplicam a regra.
--
-- Decisoes de negocio (acordadas):
--  • Faltas por periodo: do PONTO quando ha consolidacao cobrindo o intervalo;
--    da CARGA (planilha) quando nao ha. E por periodo, nao por empresa — o
--    mesmo colaborador pode ter periodos antigos vindos da planilha e novos
--    vindos do ponto.
--  • Metodo de calculo por EMPRESA: 'clt_faltas' (art. 130, inteiros:
--    30/24/18/12/0) ou 'proporcional_avos' (1/12 por mes trabalhado,
--    fracionados como 22,5). Trocar recalcula todos os saldos.
--  • Zeragem por excesso de faltas (>32) NAO e automatica: marca o periodo como
--    'pendente_validacao' para conferencia do RH, em fila propria, separada das
--    solicitacoes de ferias.
-- ============================================================================

-- ── 1. Método de cálculo por empresa ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ferias_config (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL,
    empresa_id   UUID,
    metodo_calculo TEXT NOT NULL DEFAULT 'clt_faltas'
        CHECK (metodo_calculo IN ('clt_faltas', 'proporcional_avos')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Uma config por empresa (e uma "geral" do tenant quando empresa_id é null).
    CONSTRAINT ferias_config_empresa_unica UNIQUE (tenant_id, empresa_id)
);

ALTER TABLE public.ferias_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ferias_config por tenant" ON public.ferias_config;
CREATE POLICY "ferias_config por tenant"
ON public.ferias_config FOR ALL TO authenticated
USING (tenant_id = public.get_user_tenant_id())
WITH CHECK (tenant_id = public.get_user_tenant_id());

DROP TRIGGER IF EXISTS touch_ferias_config ON public.ferias_config;
CREATE TRIGGER touch_ferias_config
BEFORE UPDATE ON public.ferias_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ── 2. Período aquisitivo por colaborador ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ferias_periodos_aquisitivos (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL,
    empresa_id     UUID,

    -- Colaborador. CPF é a chave de casamento (a planilha não traz o UUID).
    colaborador_cpf   TEXT NOT NULL,
    colaborador_nome  TEXT NOT NULL,
    colaborador_id    UUID,

    -- O período aquisitivo em si
    data_admissao     DATE NOT NULL,
    aquisitivo_inicio DATE NOT NULL,
    aquisitivo_fim    DATE NOT NULL,

    -- Insumos do cálculo
    -- Faltas: da carga inicial. O ponto, quando cobre o período, tem precedência
    -- e é lido em tempo de cálculo — este campo é o fallback permanente.
    faltas_carga        INTEGER NOT NULL DEFAULT 0,
    dias_gozados        NUMERIC(4,1) NOT NULL DEFAULT 0,
    -- 'carga' = veio da planilha; 'ponto' = faltas contadas do ponto no cálculo.
    fonte_faltas        TEXT NOT NULL DEFAULT 'carga'
        CHECK (fonte_faltas IN ('carga', 'ponto')),

    -- Resultado calculado (materializado para a tela não recalcular a cada render)
    dias_direito        NUMERIC(4,1) NOT NULL DEFAULT 30,
    dias_saldo          NUMERIC(4,1) NOT NULL DEFAULT 30,
    faltas_consideradas INTEGER NOT NULL DEFAULT 0,

    -- Zeragem (>32 faltas) espera conferência humana antes de valer.
    status TEXT NOT NULL DEFAULT 'ativo'
        CHECK (status IN ('ativo', 'pendente_validacao', 'zerado_confirmado', 'encerrado')),
    validacao_motivo    TEXT,
    validado_por        UUID,
    validado_em         TIMESTAMPTZ,

    origem      TEXT NOT NULL DEFAULT 'importacao'
        CHECK (origem IN ('importacao', 'manual', 'sistema')),
    calculado_em TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Chave estável para reimportação atualizar em vez de duplicar:
    -- um colaborador só pode ter um registro por início de período aquisitivo.
    CONSTRAINT ferias_periodo_unico
        UNIQUE (tenant_id, colaborador_cpf, aquisitivo_inicio)
);

CREATE INDEX IF NOT EXISTS idx_ferias_periodos_tenant
    ON public.ferias_periodos_aquisitivos (tenant_id, empresa_id);
CREATE INDEX IF NOT EXISTS idx_ferias_periodos_cpf
    ON public.ferias_periodos_aquisitivos (tenant_id, colaborador_cpf);
CREATE INDEX IF NOT EXISTS idx_ferias_periodos_status
    ON public.ferias_periodos_aquisitivos (tenant_id, status)
    WHERE status = 'pendente_validacao';

ALTER TABLE public.ferias_periodos_aquisitivos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ferias_periodos por tenant" ON public.ferias_periodos_aquisitivos;
CREATE POLICY "ferias_periodos por tenant"
ON public.ferias_periodos_aquisitivos FOR ALL TO authenticated
USING (tenant_id = public.get_user_tenant_id())
WITH CHECK (tenant_id = public.get_user_tenant_id());

DROP TRIGGER IF EXISTS touch_ferias_periodos ON public.ferias_periodos_aquisitivos;
CREATE TRIGGER touch_ferias_periodos
BEFORE UPDATE ON public.ferias_periodos_aquisitivos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ── 3. Contagem de faltas do ponto num intervalo ────────────────────────────
-- Retorna NULL quando NÃO há ponto consolidado cobrindo o período — o que
-- sinaliza ao motor para cair no fallback da carga. "Há ponto" = existe pelo
-- menos um dia com status decidido (não 'pendente') dentro do intervalo.
CREATE OR REPLACE FUNCTION public.ferias_faltas_do_ponto(
    p_tenant_id UUID,
    p_cpf       TEXT,
    p_inicio    DATE,
    p_fim       DATE
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cpf_digitos TEXT := regexp_replace(COALESCE(p_cpf, ''), '\D', '', 'g');
    v_tem_ponto   BOOLEAN;
    v_faltas      INTEGER;
BEGIN
    IF v_cpf_digitos = '' THEN
        RETURN NULL;
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.ponto_diario pd
         WHERE pd.tenant_id = p_tenant_id
           AND regexp_replace(pd.colaborador_cpf, '\D', '', 'g') = v_cpf_digitos
           AND pd.data BETWEEN p_inicio AND p_fim
           AND pd.status <> 'pendente'
    ) INTO v_tem_ponto;

    IF NOT v_tem_ponto THEN
        RETURN NULL;  -- sem cobertura de ponto → usar carga
    END IF;

    SELECT count(*) INTO v_faltas
      FROM public.ponto_diario pd
     WHERE pd.tenant_id = p_tenant_id
       AND regexp_replace(pd.colaborador_cpf, '\D', '', 'g') = v_cpf_digitos
       AND pd.data BETWEEN p_inicio AND p_fim
       AND pd.status = 'falta';

    RETURN v_faltas;
END;
$$;


-- ── 4. Dias de direito pela tabela do art. 130 (método inteiros) ────────────
-- CLT art. 130: até 5 faltas → 30; 6–14 → 24; 15–23 → 18; 24–32 → 12; >32 → 0.
CREATE OR REPLACE FUNCTION public.ferias_dias_por_faltas_clt(p_faltas INTEGER)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN COALESCE(p_faltas, 0) <= 5  THEN 30
        WHEN p_faltas <= 14 THEN 24
        WHEN p_faltas <= 23 THEN 18
        WHEN p_faltas <= 32 THEN 12
        ELSE 0
    END;
$$;


-- ── 5. Motor: recalcula um período ──────────────────────────────────────────
-- Aplica fonte de faltas (ponto x carga) e método (clt x avos), grava direito e
-- saldo, e marca zeragem como pendente de validação. Idempotente.
CREATE OR REPLACE FUNCTION public.ferias_recalcular_periodo(p_periodo_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r            public.ferias_periodos_aquisitivos%ROWTYPE;
    v_metodo     TEXT;
    v_faltas_pt  INTEGER;
    v_faltas     INTEGER;
    v_fonte      TEXT;
    v_direito    NUMERIC(4,1);
    v_meses      INTEGER;
BEGIN
    SELECT * INTO r FROM public.ferias_periodos_aquisitivos WHERE id = p_periodo_id;
    IF NOT FOUND THEN RETURN; END IF;

    -- Método da empresa (fallback: config geral do tenant → clt_faltas)
    SELECT metodo_calculo INTO v_metodo
      FROM public.ferias_config
     WHERE tenant_id = r.tenant_id
       AND empresa_id IS NOT DISTINCT FROM r.empresa_id
     LIMIT 1;
    IF v_metodo IS NULL THEN
        SELECT metodo_calculo INTO v_metodo
          FROM public.ferias_config
         WHERE tenant_id = r.tenant_id AND empresa_id IS NULL
         LIMIT 1;
    END IF;
    v_metodo := COALESCE(v_metodo, 'clt_faltas');

    -- Fonte das faltas: ponto tem precedência; senão, carga.
    v_faltas_pt := public.ferias_faltas_do_ponto(
        r.tenant_id, r.colaborador_cpf, r.aquisitivo_inicio, r.aquisitivo_fim
    );
    IF v_faltas_pt IS NOT NULL THEN
        v_faltas := v_faltas_pt;
        v_fonte  := 'ponto';
    ELSE
        v_faltas := COALESCE(r.faltas_carga, 0);
        v_fonte  := 'carga';
    END IF;

    IF v_metodo = 'proporcional_avos' THEN
        -- 1/12 (2,5 dias) por mês do período. Aproxima meses pela duração.
        v_meses := GREATEST(0, LEAST(12,
            (EXTRACT(YEAR  FROM age(r.aquisitivo_fim + 1, r.aquisitivo_inicio)) * 12
           + EXTRACT(MONTH FROM age(r.aquisitivo_fim + 1, r.aquisitivo_inicio)))::INTEGER));
        v_direito := ROUND(v_meses * 2.5, 1);
        -- Excesso de faltas ainda zera, como no regime CLT.
        IF v_faltas > 32 THEN v_direito := 0; END IF;
    ELSE
        v_direito := public.ferias_dias_por_faltas_clt(v_faltas);
    END IF;

    UPDATE public.ferias_periodos_aquisitivos
       SET fonte_faltas        = v_fonte,
           faltas_consideradas = v_faltas,
           dias_direito        = v_direito,
           dias_saldo          = GREATEST(0, v_direito - COALESCE(dias_gozados, 0)),
           calculado_em        = now(),
           -- Zeragem por faltas espera conferência; não sobrescreve uma
           -- validação já resolvida pelo RH.
           status = CASE
               WHEN v_direito = 0 AND v_faltas > 32
                    AND status NOT IN ('zerado_confirmado', 'encerrado')
                   THEN 'pendente_validacao'
               WHEN status = 'pendente_validacao' AND NOT (v_direito = 0 AND v_faltas > 32)
                   THEN 'ativo'
               ELSE status
           END,
           validacao_motivo = CASE
               WHEN v_direito = 0 AND v_faltas > 32
                   THEN v_faltas || ' faltas no período — art. 130 da CLT retira o direito a férias'
               ELSE validacao_motivo
           END
     WHERE id = p_periodo_id;
END;
$$;


-- ── 6. Recalcula todos os períodos de uma empresa ───────────────────────────
-- Chamado após importação e após troca de método de cálculo.
CREATE OR REPLACE FUNCTION public.ferias_recalcular_empresa(
    p_tenant_id  UUID,
    p_empresa_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id  UUID;
    v_qtd INTEGER := 0;
BEGIN
    FOR v_id IN
        SELECT id FROM public.ferias_periodos_aquisitivos
         WHERE tenant_id = p_tenant_id
           AND (p_empresa_id IS NULL OR empresa_id IS NOT DISTINCT FROM p_empresa_id)
           AND status <> 'encerrado'
    LOOP
        PERFORM public.ferias_recalcular_periodo(v_id);
        v_qtd := v_qtd + 1;
    END LOOP;
    RETURN v_qtd;
END;
$$;
