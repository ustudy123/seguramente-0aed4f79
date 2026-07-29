-- ============================================================================
-- Férias — Programação Anual (Fase 3A: fundação + grade)
--
-- Núcleo do módulo segundo o DRF: o plano de 12 meses de toda a empresa, do
-- qual as solicitações passam a ser exceção. Esta é a fundação — a tabela que
-- guarda um registro de programação por colaborador × período aquisitivo, com
-- os três sub-períodos de fracionamento (P1/P2/P3), abono, e o estado do ciclo.
--
-- ESTADOS (seção 4.2): sugerido → planejado → confirmado → ciente → solicitado
-- → aprovado → em_gozo → concluido, mais 'cancelado'. Nesta 3A implementamos até
-- 'confirmado' na tela; os demais entram nas sub-etapas seguintes (3C converte
-- em solicitação, o resto acompanha o ciclo existente).
--
-- CHAVE ESTÁVEL: um registro por (colaborador, período aquisitivo), casado por
-- CPF + aquisitivo_inicio — igual à Fase 1, para reprocessar sem duplicar e
-- para cruzar com ferias_periodos_aquisitivos (saldo real).
--
-- Datas/dias de cada sub-período ficam aqui; o VALOR estimado e o SALDO não são
-- materializados — vêm em tempo de tela do motor da Fase 2 e da Fase 1, para
-- nunca divergir. Só o que é decisão do RH (as datas programadas) se persiste.
-- ============================================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ferias_prog_estado') THEN
    CREATE TYPE public.ferias_prog_estado AS ENUM (
      'sugerido', 'planejado', 'confirmado', 'ciente',
      'solicitado', 'aprovado', 'em_gozo', 'concluido', 'cancelado'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.ferias_programacao (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL,
    empresa_id     UUID,

    -- Colaborador (casa por CPF com a Fase 1 e com admissoes)
    colaborador_cpf   TEXT NOT NULL,
    colaborador_nome  TEXT NOT NULL,
    colaborador_id    UUID,

    -- Período aquisitivo a que esta programação se refere
    aquisitivo_inicio DATE NOT NULL,
    aquisitivo_fim    DATE NOT NULL,

    -- Sub-períodos de fracionamento (art. 134 §1º: até 3, validado na 3B).
    -- NULL = sub-período não usado.
    p1_inicio DATE, p1_fim DATE, p1_dias INTEGER,
    p2_inicio DATE, p2_fim DATE, p2_dias INTEGER,
    p3_inicio DATE, p3_fim DATE, p3_dias INTEGER,

    -- Abono pecuniário (art. 143: até 1/3, validado na 3B)
    abono_vender   BOOLEAN NOT NULL DEFAULT FALSE,
    abono_dias     INTEGER NOT NULL DEFAULT 0,

    -- Adiantamento do 13º junto às férias (Lei 4.749/65, art. 2º §2º)
    adiantar_13    BOOLEAN NOT NULL DEFAULT FALSE,

    estado         public.ferias_prog_estado NOT NULL DEFAULT 'planejado',

    -- Trilha da confirmação do gestor (a partir de 'confirmado')
    confirmado_por UUID,
    confirmado_em  TIMESTAMPTZ,
    -- Vínculo com a solicitação gerada na 3C (quando 'solicitado')
    solicitacao_id UUID,

    observacao     TEXT,
    criado_por     UUID,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ferias_prog_unica
        UNIQUE (tenant_id, colaborador_cpf, aquisitivo_inicio)
);

CREATE INDEX IF NOT EXISTS idx_ferias_prog_tenant
    ON public.ferias_programacao (tenant_id, empresa_id);
CREATE INDEX IF NOT EXISTS idx_ferias_prog_estado
    ON public.ferias_programacao (tenant_id, estado);
CREATE INDEX IF NOT EXISTS idx_ferias_prog_cpf
    ON public.ferias_programacao (tenant_id, colaborador_cpf);

ALTER TABLE public.ferias_programacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ferias_programacao por tenant" ON public.ferias_programacao;
CREATE POLICY "ferias_programacao por tenant"
ON public.ferias_programacao FOR ALL TO authenticated
USING (tenant_id = public.get_user_tenant_id())
WITH CHECK (tenant_id = public.get_user_tenant_id());

DROP TRIGGER IF EXISTS touch_ferias_programacao ON public.ferias_programacao;
CREATE TRIGGER touch_ferias_programacao
BEFORE UPDATE ON public.ferias_programacao
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
