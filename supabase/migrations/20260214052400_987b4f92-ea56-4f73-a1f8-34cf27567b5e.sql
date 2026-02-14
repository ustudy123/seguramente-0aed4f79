
-- =============================================
-- Auto-recalculate terceiro & trabalhador status
-- based on document/training expiry
-- =============================================

-- Function: recalculate a single terceiro's status
CREATE OR REPLACE FUNCTION public.recalcular_status_terceiro(p_terceiro_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  has_vencido BOOLEAN;
  has_a_vencer BOOLEAN;
BEGIN
  -- Check empresa-level docs
  SELECT
    EXISTS(SELECT 1 FROM terceiro_documentos WHERE terceiro_id = p_terceiro_id AND trabalhador_id IS NULL AND status = 'vencido'),
    EXISTS(SELECT 1 FROM terceiro_documentos WHERE terceiro_id = p_terceiro_id AND trabalhador_id IS NULL AND status = 'a_vencer')
  INTO has_vencido, has_a_vencer;

  UPDATE terceiros SET status = 
    CASE
      WHEN has_vencido THEN 'bloqueado'::terceiro_status
      WHEN has_a_vencer THEN 'restrito'::terceiro_status
      ELSE 'liberado'::terceiro_status
    END
  WHERE id = p_terceiro_id;
END;
$$;

-- Function: recalculate a single trabalhador's status
CREATE OR REPLACE FUNCTION public.recalcular_status_trabalhador(p_trabalhador_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  has_doc_vencido BOOLEAN;
  has_trein_vencido BOOLEAN;
  has_doc_a_vencer BOOLEAN;
  has_trein_a_vencer BOOLEAN;
BEGIN
  SELECT
    EXISTS(SELECT 1 FROM terceiro_documentos WHERE trabalhador_id = p_trabalhador_id AND status = 'vencido'),
    EXISTS(SELECT 1 FROM terceiro_documentos WHERE trabalhador_id = p_trabalhador_id AND status = 'a_vencer')
  INTO has_doc_vencido, has_doc_a_vencer;

  SELECT
    EXISTS(SELECT 1 FROM terceiro_treinamentos WHERE trabalhador_id = p_trabalhador_id AND status = 'vencido'),
    EXISTS(SELECT 1 FROM terceiro_treinamentos WHERE trabalhador_id = p_trabalhador_id AND status = 'a_vencer')
  INTO has_trein_vencido, has_trein_a_vencer;

  UPDATE terceiro_trabalhadores SET status =
    CASE
      WHEN has_doc_vencido OR has_trein_vencido THEN 'bloqueado'::terceiro_status
      WHEN has_doc_a_vencer OR has_trein_a_vencer THEN 'restrito'::terceiro_status
      ELSE 'liberado'::terceiro_status
    END
  WHERE id = p_trabalhador_id;
END;
$$;

-- Trigger: after doc insert/update, recalculate status
CREATE OR REPLACE FUNCTION public.trigger_recalc_terceiro_doc()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM recalcular_status_terceiro(COALESCE(NEW.terceiro_id, OLD.terceiro_id));
  IF COALESCE(NEW.trabalhador_id, OLD.trabalhador_id) IS NOT NULL THEN
    PERFORM recalcular_status_trabalhador(COALESCE(NEW.trabalhador_id, OLD.trabalhador_id));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER recalc_status_on_doc_change
  AFTER INSERT OR UPDATE OR DELETE ON public.terceiro_documentos
  FOR EACH ROW EXECUTE FUNCTION public.trigger_recalc_terceiro_doc();

-- Trigger: after training insert/update, recalculate trabalhador status
CREATE OR REPLACE FUNCTION public.trigger_recalc_terceiro_trein()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM recalcular_status_trabalhador(COALESCE(NEW.trabalhador_id, OLD.trabalhador_id));
  -- Also recalc the parent terceiro
  PERFORM recalcular_status_terceiro(COALESCE(NEW.terceiro_id, OLD.terceiro_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER recalc_status_on_trein_change
  AFTER INSERT OR UPDATE OR DELETE ON public.terceiro_treinamentos
  FOR EACH ROW EXECUTE FUNCTION public.trigger_recalc_terceiro_trein();

-- Also update the doc status trigger to support 60-day threshold
CREATE OR REPLACE FUNCTION public.atualizar_status_terceiro_doc()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.data_validade IS NULL THEN
    IF NEW.arquivo_url IS NOT NULL THEN
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
