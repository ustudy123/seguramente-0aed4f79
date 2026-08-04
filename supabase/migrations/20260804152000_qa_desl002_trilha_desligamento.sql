-- =====================================================================
-- QA DESL-002 — segundo desligamento sobrescreve o primeiro, sem trilha
--
-- O desligamento é um UPDATE na própria linha de admissoes, não um evento.
-- A rotina provou: registrou pedido_demissao em 04/07, gravou por cima
-- sem_justa_causa em 03/08, e o primeiro simplesmente deixou de existir —
-- motivo, data, verbas e ASO. Não há como auditar o que mudou nem por quem.
--
-- Correção em duas frentes, como o chamado sugere:
--
--   1. HISTÓRICO — tabela desligamento_eventos registra toda gravação de
--      desligamento, com o estado anterior e quem fez.
--   2. TRAVA — admissão já desligada não aceita nova gravação silenciosa
--      de motivo/data. Retificar continua possível, mas pela porta da
--      frente: uma função que exige justificativa e deixa rastro.
--
-- A trava sozinha seria pior que o problema (erro de digitação viraria
-- registro imutável). A porta de retificação é o que a torna aceitável.
-- =====================================================================

-- 1) HISTÓRICO ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.desligamento_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  admissao_id uuid NOT NULL REFERENCES public.admissoes(id) ON DELETE CASCADE,
  colaborador_cpf text,
  colaborador_nome text,
  -- 'registro' = primeiro desligamento; 'retificacao' = correção posterior;
  -- 'reversao'  = desligamento desfeito (volta a vínculo ativo).
  evento text NOT NULL CHECK (evento IN ('registro', 'retificacao', 'reversao')),
  data_desligamento_anterior date,
  motivo_desligamento_anterior text,
  data_desligamento_nova date,
  motivo_desligamento_novo text,
  justificativa text,
  registrado_por uuid,
  registrado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_desligamento_eventos_admissao
  ON public.desligamento_eventos (admissao_id, registrado_em DESC);
CREATE INDEX IF NOT EXISTS idx_desligamento_eventos_tenant
  ON public.desligamento_eventos (tenant_id, registrado_em DESC);

GRANT SELECT ON public.desligamento_eventos TO authenticated;
GRANT ALL ON public.desligamento_eventos TO service_role;
ALTER TABLE public.desligamento_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant le desligamento_eventos" ON public.desligamento_eventos;
CREATE POLICY "Tenant le desligamento_eventos" ON public.desligamento_eventos
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_user_tenant_id());

-- Histórico não se edita nem se apaga pela aplicação: é a trilha.
DROP POLICY IF EXISTS "Ninguem altera desligamento_eventos" ON public.desligamento_eventos;

-- 2) TRAVA + REGISTRO AUTOMÁTICO --------------------------------------
CREATE OR REPLACE FUNCTION public.admissao_guardar_desligamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ja_desligada boolean;
  v_mudou boolean;
  v_retificando boolean;
  v_evento text;
BEGIN
  v_ja_desligada := OLD.data_desligamento IS NOT NULL
                    OR OLD.status = 'desligado';

  v_mudou := NEW.data_desligamento IS DISTINCT FROM OLD.data_desligamento
             OR NEW.motivo_desligamento IS DISTINCT FROM OLD.motivo_desligamento;

  IF NOT v_mudou THEN
    RETURN NEW;
  END IF;

  -- Desfazer o desligamento (volta a vínculo ativo) é operação legítima e
  -- fica registrada como 'reversao'.
  IF NEW.data_desligamento IS NULL AND NEW.motivo_desligamento IS NULL THEN
    INSERT INTO public.desligamento_eventos (
      tenant_id, admissao_id, colaborador_cpf, colaborador_nome, evento,
      data_desligamento_anterior, motivo_desligamento_anterior,
      data_desligamento_nova, motivo_desligamento_novo, registrado_por
    ) VALUES (
      NEW.tenant_id, NEW.id, NEW.cpf, NEW.nome_completo, 'reversao',
      OLD.data_desligamento, OLD.motivo_desligamento, NULL, NULL, auth.uid()
    );
    RETURN NEW;
  END IF;

  v_retificando := COALESCE(
    current_setting('app.retificar_desligamento', true), ''
  ) = 'on';

  IF v_ja_desligada AND NOT v_retificando THEN
    RAISE EXCEPTION
      'Esta admissão já tem desligamento registrado em % (%). Regravar por cima apagaria o '
      'registro original. Para corrigir, use desligamento_retificar(admissao_id, data, motivo, '
      'justificativa) — a correção fica registrada no histórico.',
      to_char(OLD.data_desligamento, 'DD/MM/YYYY'),
      COALESCE(OLD.motivo_desligamento, 'motivo não informado')
      USING ERRCODE = 'unique_violation';
  END IF;

  v_evento := CASE WHEN v_ja_desligada THEN 'retificacao' ELSE 'registro' END;

  INSERT INTO public.desligamento_eventos (
    tenant_id, admissao_id, colaborador_cpf, colaborador_nome, evento,
    data_desligamento_anterior, motivo_desligamento_anterior,
    data_desligamento_nova, motivo_desligamento_novo,
    justificativa, registrado_por
  ) VALUES (
    NEW.tenant_id, NEW.id, NEW.cpf, NEW.nome_completo, v_evento,
    OLD.data_desligamento, OLD.motivo_desligamento,
    NEW.data_desligamento, NEW.motivo_desligamento,
    NULLIF(current_setting('app.retificar_justificativa', true), ''),
    auth.uid()
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admissao_guardar_desligamento ON public.admissoes;
CREATE TRIGGER trg_admissao_guardar_desligamento
  BEFORE UPDATE OF data_desligamento, motivo_desligamento ON public.admissoes
  FOR EACH ROW EXECUTE FUNCTION public.admissao_guardar_desligamento();

-- 3) PORTA DE RETIFICAÇÃO ---------------------------------------------
CREATE OR REPLACE FUNCTION public.desligamento_retificar(
  p_admissao_id uuid,
  p_data_desligamento date,
  p_motivo_desligamento text,
  p_justificativa text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_adm public.admissoes;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF COALESCE(btrim(p_justificativa), '') = '' THEN
    RAISE EXCEPTION 'A justificativa da retificação é obrigatória — é ela que sustenta a alteração numa auditoria.';
  END IF;

  SELECT * INTO v_adm FROM public.admissoes WHERE id = p_admissao_id;
  IF v_adm.id IS NULL THEN
    RAISE EXCEPTION 'Admissão não encontrada.';
  END IF;

  IF NOT public.has_minimum_role(v_uid, 'manager'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas gestor/RH pode retificar desligamento.';
  END IF;

  PERFORM set_config('app.retificar_desligamento', 'on', true);
  PERFORM set_config('app.retificar_justificativa', p_justificativa, true);

  UPDATE public.admissoes
     SET data_desligamento   = p_data_desligamento,
         motivo_desligamento = p_motivo_desligamento
   WHERE id = p_admissao_id;

  PERFORM set_config('app.retificar_desligamento', 'off', true);

  RETURN jsonb_build_object(
    'success', true,
    'admissao_id', p_admissao_id,
    'data_anterior', v_adm.data_desligamento,
    'motivo_anterior', v_adm.motivo_desligamento,
    'data_nova', p_data_desligamento,
    'motivo_novo', p_motivo_desligamento
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.desligamento_retificar(uuid, date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.desligamento_retificar(uuid, date, text, text) TO authenticated;

COMMENT ON TABLE public.desligamento_eventos IS
  'DESL-002 — trilha de desligamentos. Cada gravação de data/motivo vira um evento com o estado anterior, o novo e quem fez.';
