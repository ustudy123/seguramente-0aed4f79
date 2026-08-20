-- =====================================================================
-- Ponte QA ↔ Cypress — Empresa (checklist de cadastro), 1ª leva
--
-- Liga os casos e2e DOCUMENTADOS EMP-014 e ENQ-018 aos it() reais do novo
-- spec cypress/e2e/empresa.cy.ts. Sem esta ponte, a guarda
-- (scripts/verificar-cobertura-e2e.mjs) acusaria os it() novos como
-- "inventados" e reprovaria a esteira.
--
-- Casos desta leva (obrigatoriedade condicional no checklist, ZERO mutação):
--   EMP-014 — Documento exigido acompanha o tipo de pessoa (CNPJ x CPF)
--   ENQ-018 — Mandato e membros viram obrigatórios com CIPA ativa
--
-- teste = título EXATO do it() (é por ele que a corrida casa o resultado).
-- Idempotente: rodar duas vezes não duplica.
-- =====================================================================

INSERT INTO public.qa_cobertura_e2e (codigo, spec, teste)
VALUES
  ('EMP-014', 'cypress/e2e/empresa.cy.ts',
   'EMP-014: Documento exigido acompanha o tipo de pessoa'),
  ('ENQ-018', 'cypress/e2e/empresa.cy.ts',
   'ENQ-018: Mandato e membros viram obrigatórios com CIPA ativa')
ON CONFLICT (codigo) DO NOTHING;
