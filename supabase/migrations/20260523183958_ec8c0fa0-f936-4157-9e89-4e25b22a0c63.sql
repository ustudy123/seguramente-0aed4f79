
CREATE TABLE IF NOT EXISTS public.ponto_justificativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  empresa_id uuid NULL,
  nome text NOT NULL,
  descricao text NULL,
  horas_abono numeric(5,2) NOT NULL DEFAULT 0,
  requer_anexo boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  CONSTRAINT ponto_justificativas_nome_unico UNIQUE (tenant_id, empresa_id, nome)
);

CREATE INDEX IF NOT EXISTS idx_ponto_just_tenant ON public.ponto_justificativas(tenant_id, ativo);

ALTER TABLE public.ponto_justificativas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant pode ver justificativas"
ON public.ponto_justificativas FOR SELECT
TO authenticated
USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "admins gerenciam justificativas - insert"
ON public.ponto_justificativas FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
  )
);

CREATE POLICY "admins gerenciam justificativas - update"
ON public.ponto_justificativas FOR UPDATE
TO authenticated
USING (
  tenant_id = public.get_user_tenant_id()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
  )
);

CREATE POLICY "admins gerenciam justificativas - delete"
ON public.ponto_justificativas FOR DELETE
TO authenticated
USING (
  tenant_id = public.get_user_tenant_id()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
  )
);

CREATE TRIGGER trg_ponto_just_updated_at
BEFORE UPDATE ON public.ponto_justificativas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.ponto_ajustes
  ADD COLUMN IF NOT EXISTS justificativa_id uuid NULL REFERENCES public.ponto_justificativas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS horas_abonadas numeric(5,2) NOT NULL DEFAULT 0;
