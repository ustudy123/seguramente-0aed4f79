DROP TRIGGER IF EXISTS trigger_audit_marcacoes_update ON public.ponto_marcacoes;
CREATE OR REPLACE FUNCTION public.audit_ponto_marcacoes_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  INSERT INTO public.ponto_audit_log (
    tenant_id, tabela_origem, registro_id, acao, dados_anteriores, dados_novos, usuario_id
  ) VALUES (
    COALESCE(NEW.tenant_id, OLD.tenant_id), 'ponto_marcacoes', OLD.id, 'UPDATE',
    to_jsonb(OLD), to_jsonb(NEW), auth.uid()
  );
  RETURN NEW;
END;
$fn$;
CREATE TRIGGER trigger_audit_marcacoes_update
AFTER UPDATE ON public.ponto_marcacoes
FOR EACH ROW EXECUTE FUNCTION public.audit_ponto_marcacoes_update();