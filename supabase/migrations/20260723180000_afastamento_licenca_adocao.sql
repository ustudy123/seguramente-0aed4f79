-- =====================================================================
-- Tarefa 3: Licença-Adoção como natureza própria de "Licença Legal"
-- =====================================================================
-- Maternidade e Paternidade já existem nos enums; falta a Adoção.
-- Adiciona o valor nos dois enums usados:
--   * afastamento_tipo_principal  -> motor de afastamentos (tipo_principal_new)
--   * atestado_subtipo_assistencial -> rótulo/subtipo em atestados
-- 'ADD VALUE IF NOT EXISTS' é idempotente. Cada ALTER TYPE roda como
-- statement próprio (auto-commit no SQL Editor) — não usar dentro de um
-- bloco transacional que já consuma o valor.
-- =====================================================================

ALTER TYPE public.afastamento_tipo_principal ADD VALUE IF NOT EXISTS 'licenca_adocao';

ALTER TYPE public.atestado_subtipo_assistencial ADD VALUE IF NOT EXISTS 'adocao';
