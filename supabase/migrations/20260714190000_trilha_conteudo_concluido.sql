-- =========================================================
-- TRILHAS: conclusão por conteúdo (dentro do módulo)
--
-- Um módulo pode ter vários conteúdos. O colaborador passa a poder
-- marcar cada conteúdo como concluído individualmente. Guardamos os
-- ids dos conteúdos concluídos num array JSONB na linha de progresso
-- do módulo (por colaborador), sem tabela nova.
--
-- Não altera a conclusão do MÓDULO em si (coluna status), que segue
-- independente.
-- =========================================================

ALTER TABLE public.trilha_progresso
  ADD COLUMN IF NOT EXISTS conteudos_concluidos jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.trilha_progresso.conteudos_concluidos IS
  'Ids dos conteúdos do módulo marcados como concluídos pelo colaborador (array JSONB de strings).';
