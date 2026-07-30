-- ============================================================================
-- QA Tier 1 — correções do que já está quebrado ou vazando
--
-- Três achados do relatório de 29/07/2026, todos com correção fechada:
--   TTRE-011  funcionalidade morta: não dá para cadastrar treinamento sem validade
--   HIER-005  árvore de empresas aceita ciclo → travessia recursiva entra em laço
--   HIER-006  filial de um cliente aponta matriz de OUTRO cliente (vazamento)
--
-- ADM-106 (36 documentos em tenant divergente) NÃO entra aqui: é migração de
-- dados e exige identificar as linhas antes de alterar. Vai à parte.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TTRE-011 — trigger de treinamentos lê coluna que não existe
--
-- atualizar_status_terceiro_doc() serve DUAS tabelas:
--   terceiro_documentos    → tem arquivo_url
--   terceiro_treinamentos  → tem certificado_url, NÃO tem arquivo_url
--
-- O acesso a NEW.arquivo_url só acontece no ramo "data_validade IS NULL", por
-- isso o problema é latente: treinamento COM validade grava normal; sem
-- validade, erro de banco. Resultado: treinamentos sem prazo (integração,
-- ordem de serviço) são impossíveis de cadastrar.
--
-- Correção: função própria para treinamentos, idêntica à de documentos, mas
-- lendo certificado_url. A função original fica intacta para terceiro_documentos.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.atualizar_status_terceiro_treinamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.data_validade IS NULL THEN
    -- Mesma regra da função de documentos, com a coluna correta desta tabela.
    IF NEW.certificado_url IS NOT NULL THEN
      NEW.status := 'valido';
    ELSE
      NEW.status := 'pendente';
    END IF;
  ELSIF NEW.data_validade < CURRENT_DATE THEN
    NEW.status := 'vencido';
  ELSIF NEW.data_validade <= CURRENT_DATE + INTERVAL '60 days' THEN
    NEW.status := 'a_vencer';
  ELSE
    NEW.status := 'valido';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_status_terceiro_treinamentos ON public.terceiro_treinamentos;
CREATE TRIGGER auto_status_terceiro_treinamentos
BEFORE INSERT OR UPDATE ON public.terceiro_treinamentos
FOR EACH ROW EXECUTE FUNCTION public.atualizar_status_terceiro_treinamento();


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. HIER-005 e HIER-006 — integridade da árvore de empresas
--
-- matriz_id é FK simples para empresa_cadastro. Não há nada impedindo:
--   • auto-referência (A é matriz de A)
--   • ciclo de 2+ níveis (A → B → A, A → B → C → A)
--   • apontar matriz de OUTRO tenant
--
-- A RLS protege a LEITURA, mas não valida a ESCRITA — daí o vazamento do
-- HIER-006: a estrutura societária de um cliente aparece pendurada na de outro
-- em qualquer consulta que suba a árvore.
--
-- Um CHECK não resolve ciclo (precisa percorrer a árvore), então é trigger.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validar_hierarquia_empresa()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_atual      UUID;
  v_tenant_mae UUID;
  v_saltos     INT := 0;
BEGIN
  IF NEW.matriz_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- HIER-005: auto-referência
  IF NEW.matriz_id = NEW.id THEN
    RAISE EXCEPTION 'Uma empresa não pode ser matriz de si mesma.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- HIER-006: a matriz precisa ser do mesmo cliente
  SELECT tenant_id INTO v_tenant_mae
    FROM public.empresa_cadastro
   WHERE id = NEW.matriz_id;

  IF v_tenant_mae IS NULL THEN
    RAISE EXCEPTION 'Matriz informada não existe.'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_tenant_mae <> NEW.tenant_id THEN
    RAISE EXCEPTION 'A matriz pertence a outro cliente — a hierarquia não atravessa essa fronteira.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- HIER-005: ciclo de qualquer profundidade. Sobe a árvore a partir da matriz
  -- pretendida; se reencontrar a própria empresa, fecharia laço.
  v_atual := NEW.matriz_id;
  WHILE v_atual IS NOT NULL LOOP
    IF v_atual = NEW.id THEN
      RAISE EXCEPTION 'Hierarquia circular: esta empresa já é ascendente da matriz informada.'
        USING ERRCODE = 'check_violation';
    END IF;

    v_saltos := v_saltos + 1;
    -- Guarda contra laço pré-existente na base (dado sujo anterior à trigger).
    IF v_saltos > 50 THEN
      RAISE EXCEPTION 'Hierarquia circular detectada ao percorrer a árvore.'
        USING ERRCODE = 'check_violation';
    END IF;

    SELECT matriz_id INTO v_atual
      FROM public.empresa_cadastro
     WHERE id = v_atual;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS valida_hierarquia_empresa ON public.empresa_cadastro;
CREATE TRIGGER valida_hierarquia_empresa
BEFORE INSERT OR UPDATE OF matriz_id, tenant_id ON public.empresa_cadastro
FOR EACH ROW EXECUTE FUNCTION public.validar_hierarquia_empresa();
