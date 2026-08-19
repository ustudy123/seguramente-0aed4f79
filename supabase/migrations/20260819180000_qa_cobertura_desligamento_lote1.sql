-- =====================================================================
-- Ponte QA ↔ Cypress — Desligamento, 1ª leva
--
-- Liga os casos e2e DOCUMENTADOS DESL-011 e DESL-012 aos it() reais do
-- novo spec cypress/e2e/desligamento.cy.ts. Sem esta ponte, a guarda
-- (scripts/verificar-cobertura-e2e.mjs) acusaria os it() novos como
-- "inventados" e reprovaria a esteira.
--
-- teste = título EXATO do it() (é por ele que a corrida casa o resultado).
-- Idempotente: rodar duas vezes não duplica.
-- =====================================================================

INSERT INTO public.qa_cobertura_e2e (codigo, spec, teste)
VALUES
  ('DESL-011', 'cypress/e2e/desligamento.cy.ts',
   'DESL-011: Data de desligamento não pode ser anterior à admissão'),
  ('DESL-012', 'cypress/e2e/desligamento.cy.ts',
   'DESL-012: Data de desligamento futura é bloqueada')
ON CONFLICT (codigo) DO NOTHING;
