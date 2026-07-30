-- ============================================================================
-- QA — validação de CPF no banco (COLAB-021 e COLAB-034)
--
-- O cálculo do dígito verificador existia só no TypeScript. Qualquer escrita
-- que não passe pela tela — importação, API, edge function — entrava sem
-- checagem. O caso COLAB-021 gravou 111.111.111-11 sem resistência.
--
-- Auditoria de 30/07/2026 antes de aplicar:
--   • 0 colaboradores sem CPF  → o CHECK do COLAB-034 entra limpo
--   • 42 CPFs cadastrados, 1 com sequência repetida (inválido)
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Função de validação — algoritmo oficial do dígito verificador
--
-- IMMUTABLE de propósito: depende só da entrada, o que permite usá-la em índice
-- ou CHECK no futuro, se necessário.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cpf_valido(p_cpf TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_cpf   TEXT;
  v_soma  INTEGER;
  v_resto INTEGER;
  v_d1    INTEGER;
  v_d2    INTEGER;
  i       INTEGER;
BEGIN
  v_cpf := regexp_replace(COALESCE(p_cpf, ''), '[^0-9]', '', 'g');

  -- Tamanho
  IF length(v_cpf) <> 11 THEN
    RETURN FALSE;
  END IF;

  -- Sequência repetida (000..., 111..., 999...) é formalmente válida pelo
  -- cálculo mas não existe como CPF real.
  IF v_cpf ~ '^(\d)\1{10}$' THEN
    RETURN FALSE;
  END IF;

  -- Primeiro dígito verificador: pesos 10..2 sobre os 9 primeiros
  v_soma := 0;
  FOR i IN 1..9 LOOP
    v_soma := v_soma + (substr(v_cpf, i, 1)::INTEGER * (11 - i));
  END LOOP;
  v_resto := v_soma % 11;
  v_d1 := CASE WHEN v_resto < 2 THEN 0 ELSE 11 - v_resto END;

  IF v_d1 <> substr(v_cpf, 10, 1)::INTEGER THEN
    RETURN FALSE;
  END IF;

  -- Segundo dígito: pesos 11..2 sobre os 10 primeiros
  v_soma := 0;
  FOR i IN 1..10 LOOP
    v_soma := v_soma + (substr(v_cpf, i, 1)::INTEGER * (12 - i));
  END LOOP;
  v_resto := v_soma % 11;
  v_d2 := CASE WHEN v_resto < 2 THEN 0 ELSE 11 - v_resto END;

  RETURN v_d2 = substr(v_cpf, 11, 1)::INTEGER;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Trigger — recusa CPF inválido
--
-- DECISÃO DELIBERADA: valida apenas quando o CPF está SENDO ALTERADO. Um
-- registro antigo com CPF inválido continua editável em outros campos — o RH
-- consegue corrigir o cadastro sem esbarrar numa trava do próprio dado ruim.
-- Mesmo princípio adotado no DESL-002 (trilha em vez de bloqueio): uma trava
-- que impede corrigir é pior que o problema que ela resolve.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validar_cpf_usuario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Sem CPF: a obrigatoriedade é assunto do CHECK, não desta trigger.
  IF NEW.cpf IS NULL OR trim(NEW.cpf) = '' THEN
    RETURN NEW;
  END IF;

  -- Só valida quando o valor muda (ou na inserção).
  IF TG_OP = 'UPDATE'
     AND regexp_replace(COALESCE(OLD.cpf, ''), '[^0-9]', '', 'g')
       = regexp_replace(NEW.cpf, '[^0-9]', '', 'g') THEN
    RETURN NEW;
  END IF;

  IF NOT public.cpf_valido(NEW.cpf) THEN
    RAISE EXCEPTION 'CPF inválido: % — dígito verificador não confere.', NEW.cpf
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS valida_cpf_usuario ON public.usuarios_base;
CREATE TRIGGER valida_cpf_usuario
BEFORE INSERT OR UPDATE OF cpf ON public.usuarios_base
FOR EACH ROW EXECUTE FUNCTION public.validar_cpf_usuario();


-- Mesma proteção em admissoes: é de onde vem o vínculo e o eSocial.
CREATE OR REPLACE FUNCTION public.validar_cpf_admissao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.cpf IS NULL OR trim(NEW.cpf) = '' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND regexp_replace(COALESCE(OLD.cpf, ''), '[^0-9]', '', 'g')
       = regexp_replace(NEW.cpf, '[^0-9]', '', 'g') THEN
    RETURN NEW;
  END IF;

  IF NOT public.cpf_valido(NEW.cpf) THEN
    RAISE EXCEPTION 'CPF inválido: % — dígito verificador não confere.', NEW.cpf
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS valida_cpf_admissao ON public.admissoes;
CREATE TRIGGER valida_cpf_admissao
BEFORE INSERT OR UPDATE OF cpf ON public.admissoes
FOR EACH ROW EXECUTE FUNCTION public.validar_cpf_admissao();


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. COLAB-034 — colaborador exige CPF
--
-- Colaborador sem CPF fica fora do índice parcial de unicidade e, portanto,
-- fora de qualquer proteção contra duplicidade. A auditoria confirmou zero
-- registros nessa situação, então o CHECK entra sem quebrar nada.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.usuarios_base
  DROP CONSTRAINT IF EXISTS usuarios_base_colaborador_exige_cpf;
ALTER TABLE public.usuarios_base
  ADD CONSTRAINT usuarios_base_colaborador_exige_cpf
  CHECK (tipo_usuario <> 'colaborador' OR (cpf IS NOT NULL AND trim(cpf) <> ''));


-- ============================================================================
-- LIMITAÇÃO CONHECIDA
--
-- Esta validação NÃO teria detectado o problema dos 36 registros com o CPF do
-- empregador: aquele CPF é matematicamente válido. Ela pega dígito verificador
-- errado, sequências e tamanho — a maior parte do lixo de digitação, mas não a
-- atribuição do CPF certo à pessoa errada. Esse caso só se resolve com
-- conferência documental.
-- ============================================================================
