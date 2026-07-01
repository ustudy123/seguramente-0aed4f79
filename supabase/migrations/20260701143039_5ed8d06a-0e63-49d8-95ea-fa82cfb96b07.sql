CREATE OR REPLACE FUNCTION public.pode_excluir_registro_ponto(_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_email text;
BEGIN
  IF auth.uid() IS NULL OR _tenant_id IS NULL THEN
    RETURN false;
  END IF;

  v_email := lower(coalesce(public.get_auth_user_email(), ''));

  IF v_email = 'renata_sophia_cortereal@cafefrossard.com' THEN
    RETURN true;
  END IF;

  IF public.has_minimum_role(auth.uid(), 'manager'::public.app_role)
     OR public.has_role(auth.uid(), 'superadmin'::public.app_role) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.usuarios_base ub
    WHERE ub.auth_user_id = auth.uid()
      AND ub.tenant_id = _tenant_id
      AND ub.status::text = 'ativo'
      AND ub.tipo_usuario::text IN ('administrador', 'gestor')
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.usuario_vinculos uv
    JOIN public.usuarios_base ub ON ub.id = uv.usuario_id
    WHERE ub.auth_user_id = auth.uid()
      AND uv.tenant_id = _tenant_id
      AND uv.status::text = 'ativo'
      AND uv.tipo_vinculo::text IN ('administrador', 'gestor')
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pode_excluir_registro_ponto(uuid) TO authenticated;

DROP POLICY IF EXISTS "Managers+ podem excluir ajustes" ON public.ponto_ajustes;

CREATE POLICY "Autorizados podem excluir ajustes de ponto"
ON public.ponto_ajustes
FOR DELETE
TO authenticated
USING (
  tenant_id = public.get_user_tenant_id()
  AND public.pode_excluir_registro_ponto(tenant_id)
);

CREATE OR REPLACE FUNCTION public.bloquear_delete_ponto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Permitir deletes em cascata acionados por outras triggers do sistema
  IF pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;

  -- Permitir quando RPC autorizado seta o flag de sessão
  IF current_setting('app.allow_ponto_delete', true) = 'true' THEN
    RETURN OLD;
  END IF;

  -- Permitir exclusão direta somente para perfis autorizados do mesmo tenant
  IF public.pode_excluir_registro_ponto(OLD.tenant_id) THEN
    RETURN OLD;
  END IF;

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