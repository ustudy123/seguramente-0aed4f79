-- =====================================================================
-- Coluna ponto_diario.tipo_dia — trazida para as migrations
--
-- Dívida de reprodutibilidade encontrada na prova do staging (10/08):
-- a coluna existe em produção mas não nasce de nenhuma migration — foi
-- criada direto no banco. A apuração de banco de horas (28/07 e 05/08)
-- depende dela e quebrava o db push em banco novo.
-- Em produção, nada muda (IF NOT EXISTS).
-- =====================================================================
ALTER TABLE public.ponto_diario
  ADD COLUMN IF NOT EXISTS tipo_dia text NOT NULL DEFAULT 'util';
