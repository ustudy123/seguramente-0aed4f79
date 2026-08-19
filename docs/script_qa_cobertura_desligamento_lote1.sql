-- =====================================================================
-- SCRIPT DE ENTREGA (produção) — Ponte QA ↔ Cypress, Desligamento 1ª leva
--
-- Cole no SQL Editor do projeto de PRODUÇÃO. Registra, no catálogo de QA,
-- que os casos e2e DESL-011 e DESL-012 passaram a ter teste de tela
-- (cypress/e2e/desligamento.cy.ts). É só documentação/cobertura de QA —
-- não altera dados de clientes nem regras de negócio.
--
-- Idempotente: rodar de novo não duplica. Roda o arquivo inteiro numa
-- transação; termina com uma conferência.
-- =====================================================================

INSERT INTO public.qa_cobertura_e2e (codigo, spec, teste)
VALUES
  ('DESL-011', 'cypress/e2e/desligamento.cy.ts',
   'DESL-011: Data de desligamento não pode ser anterior à admissão'),
  ('DESL-012', 'cypress/e2e/desligamento.cy.ts',
   'DESL-012: Data de desligamento futura é bloqueada')
ON CONFLICT (codigo) DO NOTHING;

-- Conferência (o editor mostra só o último SELECT):
SELECT cob.codigo, cob.spec, cob.teste, ct.nivel, ct.status
FROM public.qa_cobertura_e2e cob
LEFT JOIN public.qa_casos_teste ct ON ct.codigo = cob.codigo
WHERE cob.codigo IN ('DESL-011', 'DESL-012')
ORDER BY cob.codigo;
