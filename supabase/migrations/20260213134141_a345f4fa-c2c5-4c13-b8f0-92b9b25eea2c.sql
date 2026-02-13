
-- RF-EPI-EST-06: Adicionar campos para entrada manual de estoque com rastreabilidade por local
ALTER TABLE public.epi_movimentacoes
  ADD COLUMN IF NOT EXISTS local_estoque_id uuid REFERENCES public.epi_locais_estoque(id),
  ADD COLUMN IF NOT EXISTS subtipo text;

-- Comentários
COMMENT ON COLUMN public.epi_movimentacoes.local_estoque_id IS 'Local de estoque relacionado à movimentação';
COMMENT ON COLUMN public.epi_movimentacoes.subtipo IS 'Subtipo: inventario_inicial, ajuste, doacao, compra, perda, avaria, roubo, vencimento';
