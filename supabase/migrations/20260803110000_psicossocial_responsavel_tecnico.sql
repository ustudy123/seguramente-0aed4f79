-- Responsável Técnico do documento de Fatores de Risco Psicossociais (PGR/GRO)
-- Preenchido manualmente e reutilizado nas próximas emissões do documento.

CREATE TABLE public.psicossocial_responsavel_tecnico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  empresa_id uuid,
  nome text NOT NULL,
  ocupacao text,
  registro_profissional text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Um responsável por tenant+empresa (empresa_id nulo = padrão do tenant)
CREATE UNIQUE INDEX uq_psico_resp_tecnico_tenant_empresa
  ON public.psicossocial_responsavel_tecnico (
    tenant_id,
    COALESCE(empresa_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

CREATE TRIGGER update_psico_resp_tecnico_updated_at
  BEFORE UPDATE ON public.psicossocial_responsavel_tecnico
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.psicossocial_responsavel_tecnico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem responsável técnico do tenant"
  ON public.psicossocial_responsavel_tecnico FOR SELECT
  USING (tenant_id = get_user_tenant_id() OR is_superadmin(auth.uid()));

CREATE POLICY "Managers gerenciam responsável técnico"
  ON public.psicossocial_responsavel_tecnico FOR ALL
  USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'))
  WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'));
