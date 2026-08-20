-- =====================================================================
-- Ponte QA ↔ Cypress — Desligamento, 2ª leva
--
-- Liga os casos e2e DOCUMENTADOS DESL-010, DESL-020 e DESL-021 aos it()
-- reais do spec cypress/e2e/desligamento.cy.ts. Sem esta ponte, a guarda
-- (scripts/verificar-cobertura-e2e.mjs) acusaria os it() novos como
-- "inventados" e reprovaria a esteira.
--
-- Casos desta leva (validações de formulário, ZERO mutação no banco):
--   DESL-010 — Data de desligamento é obrigatória (botão desabilitado sem data)
--   DESL-020 — Motivo do desligamento é obrigatório (botão desabilitado sem motivo)
--   DESL-021 — Lista de motivos cobre as hipóteses legais de extinção
--
-- teste = título EXATO do it() (é por ele que a corrida casa o resultado).
-- Idempotente: rodar duas vezes não duplica.
-- =====================================================================

INSERT INTO public.qa_cobertura_e2e (codigo, spec, teste)
VALUES
  ('DESL-010', 'cypress/e2e/desligamento.cy.ts',
   'DESL-010: Data de desligamento é obrigatória'),
  ('DESL-020', 'cypress/e2e/desligamento.cy.ts',
   'DESL-020: Motivo do desligamento é obrigatório'),
  ('DESL-021', 'cypress/e2e/desligamento.cy.ts',
   'DESL-021: Motivos disponíveis cobrem as hipóteses legais de extinção')
ON CONFLICT (codigo) DO NOTHING;
