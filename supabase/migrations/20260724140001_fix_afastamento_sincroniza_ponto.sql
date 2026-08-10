-- ============================================================================
-- Corrige afastamento_sincroniza_ponto()
--
-- Segundo bloqueador da criacao de afastamentos, escondido atras do trigger
-- corrigido em 20260724130000. Tres defeitos independentes:
--
--   1. COALESCE(NEW.motivo_principal, 'Motivo nao informado')
--      motivo_principal e do enum grupo_clinico. O COALESCE forca o literal
--      para o mesmo tipo, e 'Motivo nao informado' nao e valor valido do enum
--      -> 22P02. Corrigido com ::text.
--
--   2. ON CONFLICT (tenant_id, colaborador_id, data)
--      A constraint que existe em ponto_diario e
--      unique_ponto_diario UNIQUE (tenant_id, colaborador_cpf, data).
--      Do jeito que estava levantaria 42P10 assim que passasse do defeito 1.
--
--   3. ponto_diario.colaborador_id e colaborador_cpf sao NOT NULL, mas
--      afastamentos.colaborador_id e SEMPRE null — o insert do atestado grava
--      null de proposito ("admissoes nao sao profiles") e o afastamento apenas
--      copia. Resultaria em 23502. Agora o colaborador e resolvido por CPF na
--      tabela admissoes; se nao der para resolver, a sincronizacao com o ponto
--      e pulada em silencio em vez de derrubar o afastamento inteiro.
--      Registrar o afastamento e mais importante do que abonar o ponto.
--
-- Tambem remove o trigger duplicado: trg_ e tr_ chamavam a mesma funcao, que
-- rodava duas vezes a cada insert.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.afastamento_sincroniza_ponto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_data           DATE;
    v_limite         DATE;
    v_colaborador_id UUID;
    v_cpf            TEXT;
    v_motivo         TEXT;
    v_observacao     TEXT;
BEGIN
    -- Só reage a insert ou a mudanca real de periodo/status
    IF NOT (TG_OP = 'INSERT'
            OR (TG_OP = 'UPDATE'
                AND (OLD.data_inicio IS DISTINCT FROM NEW.data_inicio
                  OR OLD.data_fim    IS DISTINCT FROM NEW.data_fim
                  OR OLD.status      IS DISTINCT FROM NEW.status))) THEN
        RETURN NEW;
    END IF;

    IF NEW.status NOT IN ('ativo', 'beneficio_inss') THEN
        RETURN NEW;
    END IF;

    -- ponto_diario casa por CPF (constraint unique_ponto_diario). Sem CPF nao
    -- ha como fazer o upsert com seguranca.
    v_cpf := NEW.colaborador_cpf;
    IF v_cpf IS NULL OR btrim(v_cpf) = '' THEN
        RETURN NEW;
    END IF;

    -- colaborador_id do afastamento e sempre null hoje; resolve pela admissao.
    v_colaborador_id := NEW.colaborador_id;
    IF v_colaborador_id IS NULL THEN
        SELECT a.id INTO v_colaborador_id
          FROM public.admissoes a
         WHERE a.tenant_id = NEW.tenant_id
           AND a.cpf = v_cpf
           AND a.status = 'concluido'
         ORDER BY a.created_at DESC
         LIMIT 1;
    END IF;

    -- ponto_diario.colaborador_id e NOT NULL. Sem conseguir resolver, pula a
    -- sincronizacao em vez de abortar a criacao do afastamento.
    IF v_colaborador_id IS NULL THEN
        RETURN NEW;
    END IF;

    v_motivo     := COALESCE(NEW.motivo_principal::text, 'Motivo nao informado');
    v_observacao := 'Abonado: Afastamento (' || v_motivo || ')';

    v_data   := NEW.data_inicio;
    -- Teto de 2 anos como trava de seguranca para prazo indeterminado
    v_limite := LEAST(COALESCE(NEW.data_fim, CURRENT_DATE), NEW.data_inicio + 730);

    WHILE v_data <= v_limite LOOP
        INSERT INTO public.ponto_diario (
            tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
            data, status, observacao
        ) VALUES (
            NEW.tenant_id, NEW.empresa_id, v_colaborador_id, NEW.colaborador_nome, v_cpf,
            v_data, 'justificado', v_observacao
        )
        ON CONFLICT (tenant_id, colaborador_cpf, data)
        DO UPDATE SET status     = 'justificado',
                      observacao = EXCLUDED.observacao;

        v_data := v_data + 1;
    END LOOP;

    RETURN NEW;
END;
$$;

-- Trigger duplicado: as duas versoes chamavam a mesma funcao.
DROP TRIGGER IF EXISTS trg_afastamento_sincroniza_ponto ON public.afastamentos;

DROP TRIGGER IF EXISTS tr_afastamento_sincroniza_ponto ON public.afastamentos;
CREATE TRIGGER tr_afastamento_sincroniza_ponto
AFTER INSERT OR UPDATE ON public.afastamentos
FOR EACH ROW EXECUTE FUNCTION public.afastamento_sincroniza_ponto();
