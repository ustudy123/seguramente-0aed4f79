
-- 1. Adicionar flag controla_tamanho em epi_tipos
ALTER TABLE public.epi_tipos ADD COLUMN IF NOT EXISTS controla_tamanho boolean NOT NULL DEFAULT false;

-- 2. Criar tabela de grade de tamanhos por tipo de EPI
CREATE TABLE IF NOT EXISTS public.epi_tamanhos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  tipo_id UUID NOT NULL REFERENCES public.epi_tipos(id) ON DELETE CASCADE,
  tamanho TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.epi_tamanhos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for epi_tamanhos"
  ON public.epi_tamanhos FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

-- Index para busca rápida
CREATE INDEX idx_epi_tamanhos_tipo ON public.epi_tamanhos(tipo_id);
CREATE UNIQUE INDEX idx_epi_tamanhos_unique ON public.epi_tamanhos(tenant_id, tipo_id, tamanho);

-- 3. Adicionar coluna tamanho nas tabelas de movimentação/estoque
ALTER TABLE public.epi_estoque_local ADD COLUMN IF NOT EXISTS tamanho TEXT;
ALTER TABLE public.epi_movimentacoes ADD COLUMN IF NOT EXISTS tamanho TEXT;
ALTER TABLE public.epi_entregas ADD COLUMN IF NOT EXISTS tamanho TEXT;
ALTER TABLE public.epi_nf_itens ADD COLUMN IF NOT EXISTS tamanho TEXT;

-- 4. Drop a unique constraint antiga do epi_estoque_local (se existir) e criar nova incluindo tamanho
-- Primeiro, verificar e remover constraint existente
DO $$
BEGIN
  -- Remove old unique index if exists (without tamanho)
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'epi_estoque_local_epi_local_unique') THEN
    DROP INDEX public.epi_estoque_local_epi_local_unique;
  END IF;
END $$;

-- Criar unique index que inclui tamanho (null = sem tamanho)
CREATE UNIQUE INDEX IF NOT EXISTS epi_estoque_local_epi_local_tamanho_unique 
  ON public.epi_estoque_local(epi_id, local_estoque_id, tenant_id, COALESCE(tamanho, ''));
