
-- Adicionar campos para diferenciar clientes tester vs pagante
ALTER TABLE public.programa_validador_clientes 
  ADD COLUMN IF NOT EXISTS tipo_cliente TEXT NOT NULL DEFAULT 'tester',
  ADD COLUMN IF NOT EXISTS valor_mensal NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS dia_vencimento INTEGER,
  ADD COLUMN IF NOT EXISTS plano TEXT,
  ADD COLUMN IF NOT EXISTS modulos_contratados TEXT[],
  ADD COLUMN IF NOT EXISTS data_contrato DATE,
  ADD COLUMN IF NOT EXISTS data_vigencia_fim DATE;

-- Adicionar constraint para tipo_cliente
ALTER TABLE public.programa_validador_clientes
  ADD CONSTRAINT chk_tipo_cliente CHECK (tipo_cliente IN ('tester', 'pagante'));

-- Adicionar colunas faltantes (podem já existir em alguns projetos)
ALTER TABLE public.programa_validador_clientes 
  ADD COLUMN IF NOT EXISTS endereco TEXT,
  ADD COLUMN IF NOT EXISTS representante TEXT,
  ADD COLUMN IF NOT EXISTS cidade_foro TEXT;
