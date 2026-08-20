-- =====================================================================
-- SCRIPT DE ENTREGA (produção) — Ponte QA ↔ Cypress, Desligamento 2ª leva
--
-- Cole no SQL Editor do projeto de PRODUÇÃO. Registra, no catálogo de QA,
-- que os casos e2e DESL-010, DESL-020 e DESL-021 passaram a ter teste de
-- tela (cypress/e2e/desligamento.cy.ts). É só documentação/cobertura de QA —
-- não altera dados de clientes nem regras de negócio.
--
-- Idempotente: rodar de novo não duplica. Roda o arquivo inteiro numa
-- transação; termina com uma conferência.
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

-- Conferência (o editor mostra só o último SELECT):
SELECT cob.codigo, cob.spec, cob.teste, ct.nivel, ct.status
FROM public.qa_cobertura_e2e cob
LEFT JOIN public.qa_casos_teste ct ON ct.codigo = cob.codigo
WHERE cob.codigo IN ('DESL-010', 'DESL-020', 'DESL-021')
ORDER BY cob.codigo;
