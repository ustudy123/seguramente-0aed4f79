CREATE OR REPLACE FUNCTION public.bloquear_delete_ponto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Permitir deletes em cascata acionados por outras triggers do sistema
  -- (ex: consolidar_ponto_diario faz limpeza de duplicatas entre tenants).
  -- pg_trigger_depth() > 1 significa que estamos dentro de outra trigger.
  IF pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;

  -- Registrar tentativa de exclusão direta no audit log
  INSERT INTO public.ponto_audit_log (
    tenant_id, tabela_origem, registro_id, acao,
    dados_anteriores, usuario_id
  ) VALUES (
    OLD.tenant_id, TG_TABLE_NAME, OLD.id, 'TENTATIVA_DELETE',
    to_jsonb(OLD), auth.uid()
  );

  RAISE EXCEPTION 'Operação de exclusão não permitida para registros de ponto. Tentativa registrada.';
  RETURN NULL;
END;
$$;