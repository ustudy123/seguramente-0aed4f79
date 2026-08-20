-- =====================================================================
-- Ponte QA ↔ Cypress — Empresa (checklist e hierarquia), 2ª leva
--
-- Liga os casos e2e DOCUMENTADOS CHK-001, CHK-003 e HIER-003 aos it()
-- reais do spec cypress/e2e/empresa.cy.ts. Sem esta ponte, a guarda
-- (scripts/verificar-cobertura-e2e.mjs) acusaria os it() novos como
-- "inventados" e reprovaria a esteira.
--
-- Casos desta leva (ZERO mutação — só leem/alternam o formulário novo):
--   CHK-001  — Checklist reflete o preenchimento em tempo real
--   CHK-003  — Quantidade zero conta como preenchida
--   HIER-003 — Alternar entre matriz e filial limpa o vínculo anterior
--
-- teste = título EXATO do it() (é por ele que a corrida casa o resultado).
-- Idempotente: rodar duas vezes não duplica.
-- =====================================================================

INSERT INTO public.qa_cobertura_e2e (codigo, spec, teste)
VALUES
  ('CHK-001', 'cypress/e2e/empresa.cy.ts',
   'CHK-001: Checklist reflete o preenchimento em tempo real'),
  ('CHK-003', 'cypress/e2e/empresa.cy.ts',
   'CHK-003: Quantidade zero conta como preenchida'),
  ('HIER-003', 'cypress/e2e/empresa.cy.ts',
   'HIER-003: Alternar entre matriz e filial limpa o vínculo anterior')
ON CONFLICT (codigo) DO NOTHING;
