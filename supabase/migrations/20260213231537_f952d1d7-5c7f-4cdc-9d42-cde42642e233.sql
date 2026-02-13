
-- Tabela de notas fiscais de EPI
CREATE TABLE public.epi_notas_fiscais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  numero_nf TEXT NOT NULL,
  serie TEXT,
  chave_acesso TEXT,
  fornecedor_cnpj TEXT,
  fornecedor_nome TEXT,
  data_emissao DATE,
  valor_total NUMERIC(12,2),
  observacoes TEXT,
  origem TEXT NOT NULL DEFAULT 'manual' CHECK (origem IN ('xml', 'manual')),
  criado_por UUID,
  criado_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Itens da nota fiscal vinculados a EPIs
CREATE TABLE public.epi_nf_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  nota_fiscal_id UUID NOT NULL REFERENCES public.epi_notas_fiscais(id) ON DELETE CASCADE,
  epi_id UUID NOT NULL REFERENCES public.epis(id),
  local_estoque_id UUID NOT NULL REFERENCES public.epi_locais_estoque(id),
  descricao_nf TEXT,
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  valor_unitario NUMERIC(12,2),
  valor_total NUMERIC(12,2),
  movimentacao_id UUID REFERENCES public.epi_movimentacoes(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.epi_notas_fiscais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epi_nf_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.epi_notas_fiscais
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Tenant isolation" ON public.epi_nf_itens
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- Indexes
CREATE INDEX idx_epi_nf_tenant ON public.epi_notas_fiscais(tenant_id);
CREATE INDEX idx_epi_nf_itens_nf ON public.epi_nf_itens(nota_fiscal_id);

-- Triggers updated_at
CREATE TRIGGER update_epi_notas_fiscais_updated_at
  BEFORE UPDATE ON public.epi_notas_fiscais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
