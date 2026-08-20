-- =====================================================================
-- Ponte QA ↔ Cypress — Empresa (rascunho de cadastro), leva 5
--
-- Liga os casos e2e DOCUMENTADOS RASC-001 e RASC-004 aos it() reais do
-- spec cypress/e2e/empresa.cy.ts. Sem esta ponte, a guarda
-- (scripts/verificar-cobertura-e2e.mjs) acusaria os it() novos como
-- "inventados" e reprovaria a esteira.
--
-- Casos desta leva (rascunho vive só no localStorage — ZERO mutação no banco):
--   RASC-001 — Rascunho é restaurado ao voltar sem ter salvo
--   RASC-004 — Novo cadastro não herda rascunho de tentativa anterior
--
-- (RASC-002 "Descartar rascunho" não tem ação observável na tela — o
--  handleDescartarRascunho existe mas não está ligado a nenhum botão —,
--  então fica para o motor/ambiente local, não para teste de tela.)
--
-- teste = título EXATO do it(). Idempotente: rodar duas vezes não duplica.
-- =====================================================================

INSERT INTO public.qa_cobertura_e2e (codigo, spec, teste)
VALUES
  ('RASC-001', 'cypress/e2e/empresa.cy.ts',
   'RASC-001: Rascunho é restaurado ao voltar sem ter salvo'),
  ('RASC-004', 'cypress/e2e/empresa.cy.ts',
   'RASC-004: Novo cadastro não herda rascunho de tentativa anterior')
ON CONFLICT (codigo) DO NOTHING;
