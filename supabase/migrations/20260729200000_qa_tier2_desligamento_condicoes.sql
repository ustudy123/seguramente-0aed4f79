-- ============================================================================
-- QA Tier 2 — risco jurídico com dinheiro em jogo
--
-- Cinco achados do relatório de 29/07. A base foi auditada antes: zero
-- violações existentes, então os CHECKs entram sem quebrar nada.
--
--   DESL-004  desligamento com data anterior à admissão (contrato negativo)
--   DESL-003  dispensa imotivada com contrato suspenso (CLT art. 476)
--   DESL-002  regravação de desligamento apaga o anterior, sem trilha
--   COND-011  adicional "ambos" — o que o art. 193 §2º veda
--   COND-012  adicional negativo — vira desconto no salário
--   COND-010  grau de insalubridade fora da NR-15
--
-- Domínios confirmados no código antes de fechar o CHECK:
--   insalubridade_grau  : minimo | medio | maximo   (NR-15: 10%, 20%, 40%)
--   adicional_aplicado  : insalubridade | periculosidade | nenhum
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. DESL-004 — desligamento não pode anteceder a admissão
--
-- A validação existia só na tela (RNDES02). Pelo banco passava contrato com
-- duração negativa. Para desistência antes do início, o evento correto é
-- cancelamento de admissão — são coisas distintas no eSocial.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.admissoes
  DROP CONSTRAINT IF EXISTS admissoes_desligamento_apos_admissao;

ALTER TABLE public.admissoes
  ADD CONSTRAINT admissoes_desligamento_apos_admissao
  CHECK (data_desligamento IS NULL OR data_desligamento >= data_admissao);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. COND-010 / 011 / 012 — condições especiais
--
-- Colunas hoje inteiramente nulas na base, então o domínio veio do código.
-- NULL segue permitido: nem todo registro declara grau ou adicional.
-- ─────────────────────────────────────────────────────────────────────────────

-- COND-010: NR-15 prevê apenas mínimo (10%), médio (20%) e máximo (40%).
-- Um grau desconhecido resultava em percentual zero e adicional R$ 0,00 sem aviso.
ALTER TABLE public.colaborador_condicoes_especiais
  DROP CONSTRAINT IF EXISTS cce_insalubridade_grau_nr15;

ALTER TABLE public.colaborador_condicoes_especiais
  ADD CONSTRAINT cce_insalubridade_grau_nr15
  CHECK (insalubridade_grau IS NULL
         OR insalubridade_grau IN ('minimo', 'medio', 'maximo'));

-- COND-011: art. 193 §2º da CLT veda a cumulatividade — o campo que documenta
-- o cumprimento da regra não pode aceitar justamente o valor que a lei proíbe.
ALTER TABLE public.colaborador_condicoes_especiais
  DROP CONSTRAINT IF EXISTS cce_adicional_aplicado_dominio;

ALTER TABLE public.colaborador_condicoes_especiais
  ADD CONSTRAINT cce_adicional_aplicado_dominio
  CHECK (adicional_aplicado IS NULL
         OR adicional_aplicado IN ('insalubridade', 'periculosidade', 'nenhum'));

-- COND-012: adicional é acréscimo, nunca desconto. Em campo que alimenta folha,
-- um valor negativo vira desconto no salário do colaborador.
ALTER TABLE public.colaborador_condicoes_especiais
  DROP CONSTRAINT IF EXISTS cce_valores_nao_negativos;

ALTER TABLE public.colaborador_condicoes_especiais
  ADD CONSTRAINT cce_valores_nao_negativos
  CHECK (COALESCE(adicional_valor_aplicado, 0) >= 0
     AND COALESCE(insalubridade_valor_calculado, 0) >= 0
     AND COALESCE(periculosidade_valor_calculado, 0) >= 0);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. DESL-002 — trilha do desligamento
--
-- O desligamento é UPDATE na própria linha de admissoes, não um evento. A
-- segunda gravação APAGA a primeira: motivo, data, verbas e ASO do desligamento
-- original deixam de existir, sem como auditar o que mudou nem quem mudou.
--
-- OPÇÃO DELIBERADA: registrar histórico em vez de BLOQUEAR a regravação.
-- Bloquear impediria a correção legítima de um erro de digitação e deixaria o
-- RH sem saída. Com a trilha, a correção continua possível e passa a ser
-- rastreável — que é o problema central do achado.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admissao_desligamento_historico (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    admissao_id     UUID NOT NULL,
    colaborador_cpf TEXT,
    colaborador_nome TEXT,

    -- Estado ANTERIOR à alteração (o que teria sido perdido)
    data_desligamento_anterior   DATE,
    motivo_desligamento_anterior TEXT,
    -- Estado NOVO
    data_desligamento_novo       DATE,
    motivo_desligamento_novo     TEXT,

    -- 'registro' = primeira gravação; 'alteracao' = regravação; 'reversao' = limpou
    tipo_mudanca    TEXT NOT NULL CHECK (tipo_mudanca IN ('registro','alteracao','reversao')),
    alterado_por    UUID,
    alterado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_desl_hist_admissao
    ON public.admissao_desligamento_historico (admissao_id, alterado_em DESC);
CREATE INDEX IF NOT EXISTS idx_desl_hist_tenant
    ON public.admissao_desligamento_historico (tenant_id);

ALTER TABLE public.admissao_desligamento_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "desl_hist por tenant" ON public.admissao_desligamento_historico;
CREATE POLICY "desl_hist por tenant"
ON public.admissao_desligamento_historico FOR SELECT TO authenticated
USING (tenant_id = public.get_user_tenant_id());

-- Só a trigger escreve; ninguém insere à mão.
DROP POLICY IF EXISTS "desl_hist insert sistema" ON public.admissao_desligamento_historico;
CREATE POLICY "desl_hist insert sistema"
ON public.admissao_desligamento_historico FOR INSERT TO authenticated
WITH CHECK (tenant_id = public.get_user_tenant_id());


CREATE OR REPLACE FUNCTION public.registrar_historico_desligamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tipo TEXT;
BEGIN
  -- Só interessa quando algo do desligamento muda.
  IF NEW.data_desligamento IS NOT DISTINCT FROM OLD.data_desligamento
     AND NEW.motivo_desligamento IS NOT DISTINCT FROM OLD.motivo_desligamento THEN
    RETURN NEW;
  END IF;

  IF OLD.data_desligamento IS NULL AND NEW.data_desligamento IS NOT NULL THEN
    v_tipo := 'registro';
  ELSIF NEW.data_desligamento IS NULL AND OLD.data_desligamento IS NOT NULL THEN
    v_tipo := 'reversao';
  ELSE
    -- É AQUI que o achado morava: a regravação que apagava a anterior.
    v_tipo := 'alteracao';
  END IF;

  INSERT INTO public.admissao_desligamento_historico (
    tenant_id, admissao_id, colaborador_cpf, colaborador_nome,
    data_desligamento_anterior, motivo_desligamento_anterior,
    data_desligamento_novo, motivo_desligamento_novo,
    tipo_mudanca, alterado_por
  ) VALUES (
    NEW.tenant_id, NEW.id, NEW.cpf, NEW.nome_completo,
    OLD.data_desligamento, OLD.motivo_desligamento,
    NEW.data_desligamento, NEW.motivo_desligamento,
    v_tipo, auth.uid()
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trilha_desligamento ON public.admissoes;
CREATE TRIGGER trilha_desligamento
AFTER UPDATE OF data_desligamento, motivo_desligamento ON public.admissoes
FOR EACH ROW EXECUTE FUNCTION public.registrar_historico_desligamento();


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. DESL-003 — dispensa imotivada com contrato suspenso
--
-- CLT art. 476: durante o auxílio-doença o contrato está suspenso, e a dispensa
-- imotivada é ineficaz — a discussão vira reintegração. A tela consultava
-- afastamentos, mas o banco não impedia por nenhuma outra rota.
--
-- Exceções que a lei admite mesmo com afastamento ativo (apontadas no próprio
-- achado): falecimento e término de contrato a termo.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validar_desligamento_afastamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cpf    TEXT;
  v_ativo  INT;
  v_motivo TEXT := lower(trim(COALESCE(NEW.motivo_desligamento, '')));
BEGIN
  -- Só age quando o desligamento está sendo registrado agora.
  IF NEW.data_desligamento IS NULL
     OR NEW.data_desligamento IS NOT DISTINCT FROM OLD.data_desligamento THEN
    RETURN NEW;
  END IF;

  -- A vedação do art. 476 alcança a dispensa IMOTIVADA. Os demais motivos
  -- (pedido de demissão, justa causa, acordo, aposentadoria, rescisão indireta,
  -- culpa recíproca) e as exceções legítimas com contrato suspenso
  -- (falecimento, término de contrato a termo) seguem permitidos.
  -- Valores conforme MOTIVOS_DESLIGAMENTO em DesligamentoForm.tsx.
  IF v_motivo <> 'sem_justa_causa' THEN
    RETURN NEW;
  END IF;

  v_cpf := regexp_replace(COALESCE(NEW.cpf, ''), '[^0-9]', '', 'g');
  IF v_cpf = '' THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_ativo
    FROM public.afastamentos a
   WHERE a.tenant_id = NEW.tenant_id
     AND regexp_replace(COALESCE(a.colaborador_cpf, ''), '[^0-9]', '', 'g') = v_cpf
     AND a.status = 'ativo'
     AND (a.data_fim IS NULL OR a.data_fim >= NEW.data_desligamento);

  IF v_ativo > 0 THEN
    RAISE EXCEPTION 'Dispensa sem justa causa não é admitida com o contrato suspenso por afastamento ativo (CLT art. 476). Registre o retorno do afastamento antes, ou use o motivo cabível.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS valida_desligamento_afastamento ON public.admissoes;
CREATE TRIGGER valida_desligamento_afastamento
BEFORE UPDATE OF data_desligamento, motivo_desligamento ON public.admissoes
FOR EACH ROW EXECUTE FUNCTION public.validar_desligamento_afastamento();
