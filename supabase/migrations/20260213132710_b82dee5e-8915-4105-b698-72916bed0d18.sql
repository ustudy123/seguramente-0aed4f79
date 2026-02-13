
-- RF-EPI-EST-01: Configuração de controle de estoque (on/off) na tabela tenant_config
CREATE TABLE IF NOT EXISTS public.epi_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  usar_controle_estoque BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

ALTER TABLE public.epi_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view epi_config"
  ON public.epi_config FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Admins can manage epi_config"
  ON public.epi_config FOR ALL
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE TRIGGER update_epi_config_updated_at
  BEFORE UPDATE ON public.epi_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RF-EPI-EST-02: Locais de Estoque com hierarquia
CREATE TABLE IF NOT EXISTS public.epi_locais_estoque (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome VARCHAR(255) NOT NULL,
  tipo VARCHAR(100) DEFAULT 'almoxarifado_central',
  filial_id UUID REFERENCES public.filiais(id) ON DELETE SET NULL,
  responsavel_id UUID,
  responsavel_nome VARCHAR(255),
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.epi_locais_estoque ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view epi_locais_estoque"
  ON public.epi_locais_estoque FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Admins can manage epi_locais_estoque"
  ON public.epi_locais_estoque FOR ALL
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE TRIGGER update_epi_locais_estoque_updated_at
  BEFORE UPDATE ON public.epi_locais_estoque
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar coluna local_estoque_id na tabela epis para vincular EPI a um local
ALTER TABLE public.epis ADD COLUMN IF NOT EXISTS local_estoque_id UUID REFERENCES public.epi_locais_estoque(id) ON DELETE SET NULL;

-- Tabela de estoque por local (saldo de cada EPI em cada local)
CREATE TABLE IF NOT EXISTS public.epi_estoque_local (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  epi_id UUID NOT NULL REFERENCES public.epis(id) ON DELETE CASCADE,
  local_estoque_id UUID NOT NULL REFERENCES public.epi_locais_estoque(id) ON DELETE CASCADE,
  quantidade INTEGER NOT NULL DEFAULT 0,
  quantidade_minima INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(epi_id, local_estoque_id)
);

ALTER TABLE public.epi_estoque_local ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view epi_estoque_local"
  ON public.epi_estoque_local FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Admins can manage epi_estoque_local"
  ON public.epi_estoque_local FOR ALL
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE TRIGGER update_epi_estoque_local_updated_at
  BEFORE UPDATE ON public.epi_estoque_local
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
