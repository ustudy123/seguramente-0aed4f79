-- ============================================================================
-- QA — Estabilidades, prazo do exame demissional, protocolo e LGPD
--
--   DESL-073  composição nominal da CIPA (ADCT art. 10, II, "a")
--   DESL-072  mandato sindical (CLT art. 543 §3º, CF art. 8º VIII)
--   DESL-065  dispensa e prazo do exame demissional (NR-07, 7.5.11)
--   DESL-101  protocolo do desligamento não era gravado
--   ADM-110   documento de saúde sem classificação própria (LGPD art. 11)
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. DESL-073 — composição nominal da CIPA
--
-- empresa_cadastro já tem cipa_data_mandato_inicio/fim e cipa_membros (contagem),
-- mas não HÁ VÍNCULO entre a comissão e as pessoas. Sem isso a estabilidade não
-- pode ser verificada no desligamento.
--
-- Súmula 339, I do TST: a garantia alcança também o SUPLENTE. A estrutura
-- distingue titular de suplente sem tirar nenhum dos dois da proteção.
--
-- A estabilidade vai do registro da candidatura até 1 ANO APÓS o fim do mandato
-- (ADCT art. 10, II, "a"), daí a coluna estabilidade_ate ser calculada e não
-- igual ao fim do mandato.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cipa_composicao (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    empresa_id        UUID NOT NULL,

    colaborador_cpf   TEXT NOT NULL,
    colaborador_nome  TEXT NOT NULL,
    colaborador_id    UUID,

    -- Representação: eleito pelos empregados ou designado pelo empregador.
    -- Só o ELEITO tem estabilidade (a designação do empregador não gera garantia).
    representacao     TEXT NOT NULL DEFAULT 'empregados'
        CHECK (representacao IN ('empregados', 'empregador')),
    condicao          TEXT NOT NULL DEFAULT 'titular'
        CHECK (condicao IN ('titular', 'suplente')),

    mandato_inicio    DATE NOT NULL,
    mandato_fim       DATE NOT NULL,
    -- Registro da candidatura: início da garantia para quem concorreu.
    candidatura_em    DATE,

    ativo             BOOLEAN NOT NULL DEFAULT TRUE,
    observacao        TEXT,
    criado_por        UUID,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT cipa_mandato_coerente CHECK (mandato_fim >= mandato_inicio),
    CONSTRAINT cipa_membro_unico UNIQUE (tenant_id, empresa_id, colaborador_cpf, mandato_inicio)
);

CREATE INDEX IF NOT EXISTS idx_cipa_comp_cpf
    ON public.cipa_composicao (tenant_id, colaborador_cpf) WHERE ativo;

ALTER TABLE public.cipa_composicao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cipa_composicao por tenant" ON public.cipa_composicao;
CREATE POLICY "cipa_composicao por tenant"
ON public.cipa_composicao FOR ALL TO authenticated
USING (tenant_id = public.get_user_tenant_id())
WITH CHECK (tenant_id = public.get_user_tenant_id());

DROP TRIGGER IF EXISTS touch_cipa_composicao ON public.cipa_composicao;
CREATE TRIGGER touch_cipa_composicao
BEFORE UPDATE ON public.cipa_composicao
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. DESL-072 — mandato sindical
--
-- Não existia NENHUM campo para registrar dirigente sindical ou candidato, e
-- sem o dado a estabilidade do art. 543 §3º não tem como ser verificada.
--
-- Tabela própria (e não coluna em admissoes) porque o mandato tem vigência e a
-- pessoa pode ter mais de um ao longo do vínculo.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mandato_sindical (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    empresa_id        UUID,

    colaborador_cpf   TEXT NOT NULL,
    colaborador_nome  TEXT NOT NULL,
    colaborador_id    UUID,

    sindicato         TEXT,
    cargo_sindical    TEXT,
    condicao          TEXT NOT NULL DEFAULT 'dirigente'
        CHECK (condicao IN ('dirigente', 'suplente', 'candidato')),

    -- Para candidato: da data de registro da candidatura. Para eleito: da posse.
    inicio            DATE NOT NULL,
    fim               DATE,

    ativo             BOOLEAN NOT NULL DEFAULT TRUE,
    documento_ref     TEXT,   -- comunicação do sindicato ao empregador
    criado_por        UUID,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT mandato_sind_coerente CHECK (fim IS NULL OR fim >= inicio)
);

CREATE INDEX IF NOT EXISTS idx_mandato_sind_cpf
    ON public.mandato_sindical (tenant_id, colaborador_cpf) WHERE ativo;

ALTER TABLE public.mandato_sindical ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mandato_sindical por tenant" ON public.mandato_sindical;
CREATE POLICY "mandato_sindical por tenant"
ON public.mandato_sindical FOR ALL TO authenticated
USING (tenant_id = public.get_user_tenant_id())
WITH CHECK (tenant_id = public.get_user_tenant_id());

DROP TRIGGER IF EXISTS touch_mandato_sindical ON public.mandato_sindical;
CREATE TRIGGER touch_mandato_sindical
BEFORE UPDATE ON public.mandato_sindical
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Verificação de estabilidade no desligamento
--
-- ALERTA, não bloqueio. Dispensar estável não é impossível — é ônus e risco que
-- a empresa pode assumir conscientemente (e há hipóteses lícitas). O que não
-- pode é acontecer SEM QUE NINGUÉM SAIBA. A função devolve as estabilidades
-- vigentes para a tela exibir antes de confirmar.
--
-- Exceção do art. 543 §3º: dirigente sindical só é dispensável por falta grave
-- APURADA EM INQUÉRITO JUDICIAL (arts. 494 e 853) — justa causa "simples" não
-- basta, ao contrário do que a tela hoje assume.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.estabilidades_vigentes(
    p_tenant_id UUID,
    p_cpf       TEXT,
    p_data      DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    tipo          TEXT,
    detalhe       TEXT,
    base_legal    TEXT,
    vigente_ate   DATE,
    exige_inquerito BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cpf TEXT := regexp_replace(COALESCE(p_cpf, ''), '[^0-9]', '', 'g');
BEGIN
  IF v_cpf = '' THEN RETURN; END IF;

  -- CIPA: garantia até 1 ano após o fim do mandato. Só representação dos
  -- empregados; a designada pelo empregador não gera estabilidade.
  RETURN QUERY
  SELECT
    'cipa'::TEXT,
    format('%s da CIPA (mandato %s a %s)', c.condicao, c.mandato_inicio, c.mandato_fim),
    'ADCT art. 10, II, "a" / Súmula 339 I TST'::TEXT,
    (c.mandato_fim + INTERVAL '1 year')::DATE,
    FALSE
  FROM public.cipa_composicao c
  WHERE c.tenant_id = p_tenant_id
    AND regexp_replace(c.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf
    AND c.ativo
    AND c.representacao = 'empregados'
    AND p_data <= (c.mandato_fim + INTERVAL '1 year')::DATE
    AND p_data >= COALESCE(c.candidatura_em, c.mandato_inicio);

  -- Sindical: garantia até 1 ano após o fim do mandato (art. 543 §3º).
  RETURN QUERY
  SELECT
    'sindical'::TEXT,
    format('%s sindical%s', m.condicao, COALESCE(' — ' || m.sindicato, '')),
    'CLT art. 543 §3º / CF art. 8º, VIII'::TEXT,
    CASE WHEN m.fim IS NULL THEN NULL ELSE (m.fim + INTERVAL '1 year')::DATE END,
    TRUE   -- exige inquérito judicial para dispensa por falta grave
  FROM public.mandato_sindical m
  WHERE m.tenant_id = p_tenant_id
    AND regexp_replace(m.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf
    AND m.ativo
    AND p_data >= m.inicio
    AND (m.fim IS NULL OR p_data <= (m.fim + INTERVAL '1 year')::DATE);
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. DESL-065 — dispensa e prazo do exame demissional
--
-- A NR-07, 7.5.11, admite DISPENSA do exame demissional quando houver exame
-- ocupacional dentro do prazo previsto. O sistema não registrava a dispensa,
-- então "sem data" e "dispensado" ficavam indistinguíveis.
--
-- Este prazo é da NR-07 e NÃO se confunde com os 10 dias do art. 477 §6º da CLT:
-- coincidem no número, são normas e penalidades diferentes.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.admissoes
  ADD COLUMN IF NOT EXISTS exame_demissional_dispensado BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS exame_demissional_dispensa_motivo TEXT;

-- Dispensa exige justificativa: sem ela o registro não distingue de esquecimento.
ALTER TABLE public.admissoes
  DROP CONSTRAINT IF EXISTS admissoes_dispensa_exame_justificada;
ALTER TABLE public.admissoes
  ADD CONSTRAINT admissoes_dispensa_exame_justificada
  CHECK (NOT exame_demissional_dispensado
         OR (exame_demissional_dispensa_motivo IS NOT NULL
             AND trim(exame_demissional_dispensa_motivo) <> ''))
  NOT VALID;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. DESL-101 — protocolo do desligamento
--
-- O número era montado no componente, exibido em toast e embutido no texto livre
-- da descrição enviada ao Hub Contábil. Nenhuma coluna o guardava: o rastreio
-- prometido ao usuário não podia ser consultado. Sendo determinístico por
-- admissão e dia, também não distinguia tentativas.
--
-- Agora é coluna própria, única, gerada no banco no momento do desligamento.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.admissoes
  ADD COLUMN IF NOT EXISTS desligamento_protocolo TEXT;

DROP INDEX IF EXISTS admissoes_desligamento_protocolo_uidx;
CREATE UNIQUE INDEX admissoes_desligamento_protocolo_uidx
  ON public.admissoes (desligamento_protocolo)
  WHERE desligamento_protocolo IS NOT NULL;

CREATE OR REPLACE FUNCTION public.gerar_protocolo_desligamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Só na primeira gravação do desligamento; regravação preserva o protocolo
  -- original (a trilha do DESL-002 registra a alteração).
  IF NEW.data_desligamento IS NOT NULL
     AND NEW.desligamento_protocolo IS NULL THEN
    NEW.desligamento_protocolo :=
      'DESL-' || to_char(now(), 'YYYYMMDD') || '-' ||
      upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protocolo_desligamento ON public.admissoes;
CREATE TRIGGER protocolo_desligamento
BEFORE INSERT OR UPDATE OF data_desligamento ON public.admissoes
FOR EACH ROW EXECUTE FUNCTION public.gerar_protocolo_desligamento();


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. ADM-110 — classificação do documento para a LGPD
--
-- A RLS já protege o acesso, mas RG, comprovante de residência e ASO recebiam
-- tratamento idêntico. A LGPD dá regime próprio ao dado de saúde (art. 5º, II e
-- art. 11), e o ASO admissional entrava como o nono item de uma lista genérica.
--
-- A classificação é o primeiro passo: sem ela não há como diferenciar a política
-- de acesso. A política em si depende de definição de quem pode ver o quê —
-- decisão de produto, não de schema.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS classificacao TEXT NOT NULL DEFAULT 'comum';

ALTER TABLE public.documentos
  DROP CONSTRAINT IF EXISTS documentos_classificacao_dominio;
ALTER TABLE public.documentos
  ADD CONSTRAINT documentos_classificacao_dominio
  CHECK (classificacao IN ('comum', 'pessoal', 'sensivel_saude', 'sensivel_outro'))
  NOT VALID;

-- Classifica o que já existe pelo tipo do documento.
UPDATE public.documentos
   SET classificacao = 'sensivel_saude'
 WHERE classificacao = 'comum'
   AND (tipo ILIKE '%aso%' OR tipo ILIKE '%exame%' OR tipo ILIKE '%atestado%'
        OR tipo ILIKE '%laudo%' OR tipo ILIKE '%medic%');

UPDATE public.documentos
   SET classificacao = 'pessoal'
 WHERE classificacao = 'comum'
   AND (tipo ILIKE '%rg%' OR tipo ILIKE '%cpf%' OR tipo ILIKE '%ctps%'
        OR tipo ILIKE '%carteira%' OR tipo ILIKE '%certid%' OR tipo ILIKE '%titulo%'
        OR tipo ILIKE '%comprovante de resid%' OR tipo ILIKE '%reservista%');
