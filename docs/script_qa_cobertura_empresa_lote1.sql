-- =====================================================================
-- SCRIPT DE ENTREGA (produção) — Ponte QA ↔ Cypress, Empresa 1ª leva
--
-- Cole no SQL Editor do projeto de PRODUÇÃO. Registra, no catálogo de QA,
-- que os casos e2e EMP-014 e ENQ-018 passaram a ter teste de tela
-- (cypress/e2e/empresa.cy.ts). É só documentação/cobertura de QA — não
-- altera dados de clientes nem regras de negócio.
--
-- Idempotente: rodar de novo não duplica. Roda o arquivo inteiro numa
-- transação; termina com uma conferência.
-- =====================================================================

INSERT INTO public.qa_cobertura_e2e (codigo, spec, teste)
VALUES
  ('EMP-014', 'cypress/e2e/empresa.cy.ts',
   'EMP-014: Documento exigido acompanha o tipo de pessoa'),
  ('ENQ-018', 'cypress/e2e/empresa.cy.ts',
   'ENQ-018: Mandato e membros viram obrigatórios com CIPA ativa')
ON CONFLICT (codigo) DO NOTHING;

-- Conferência (o editor mostra só o último SELECT):
SELECT cob.codigo, cob.spec, cob.teste, ct.nivel, ct.status
FROM public.qa_cobertura_e2e cob
LEFT JOIN public.qa_casos_teste ct ON ct.codigo = cob.codigo
WHERE cob.codigo IN ('EMP-014', 'ENQ-018')
ORDER BY cob.codigo;
