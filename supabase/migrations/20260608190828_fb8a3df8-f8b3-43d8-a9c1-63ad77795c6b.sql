-- Permite que gestores/RH (manager+) excluam permanentemente solicitações de ajuste de ponto
CREATE POLICY "Managers+ podem excluir ajustes"
ON public.ponto_ajustes
FOR DELETE
TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  AND has_minimum_role(auth.uid(), 'manager'::app_role)
);

-- Trigger de auditoria para registrar exclusões em ponto_audit_log
CREATE OR REPLACE FUNCTION public.log_exclusao_ponto_ajuste()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ponto_audit_log (
    tenant_id,
    acao,
    tabela,
    registro_id,
    usuario_id,
    dados_anteriores,
    descricao
  ) VALUES (
    OLD.tenant_id,
    'EXCLUSAO_AJUSTE',
    'ponto_ajustes',
    OLD.id,
    auth.uid(),
    to_jsonb(OLD),
    format('Ajuste de %s (%s) excluído permanentemente', OLD.colaborador_nome, OLD.data_referencia)
  );
  RETURN OLD;
EXCEPTION WHEN OTHERS THEN
  -- Não bloqueia exclusão se auditoria falhar
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_exclusao_ponto_ajuste ON public.ponto_ajustes;
CREATE TRIGGER trg_log_exclusao_ponto_ajuste
BEFORE DELETE ON public.ponto_ajustes
FOR EACH ROW
EXECUTE FUNCTION public.log_exclusao_ponto_ajuste();