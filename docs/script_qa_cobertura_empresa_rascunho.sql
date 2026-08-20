-- =====================================================================
-- SCRIPT DE ENTREGA (produção) — Ponte QA ↔ Cypress, Empresa rascunho
--
-- Cole no SQL Editor do projeto de PRODUÇÃO. Registra, no catálogo de QA,
-- que os casos e2e RASC-001 e RASC-004 passaram a ter teste de tela
-- (cypress/e2e/empresa.cy.ts). É só documentação/cobertura de QA — não
-- altera dados de clientes nem regras de negócio.
--
-- Idempotente: rodar de novo não duplica. Roda o arquivo inteiro numa
-- transação; termina com uma conferência.
-- =====================================================================

INSERT INTO public.qa_cobertura_e2e (codigo, spec, teste)
VALUES
  ('RASC-001', 'cypress/e2e/empresa.cy.ts',
   'RASC-001: Rascunho é restaurado ao voltar sem ter salvo'),
  ('RASC-004', 'cypress/e2e/empresa.cy.ts',
   'RASC-004: Novo cadastro não herda rascunho de tentativa anterior')
ON CONFLICT (codigo) DO NOTHING;

-- Conferência (o editor mostra só o último SELECT):
SELECT cob.codigo, cob.spec, cob.teste, ct.nivel, ct.status
FROM public.qa_cobertura_e2e cob
LEFT JOIN public.qa_casos_teste ct ON ct.codigo = cob.codigo
WHERE cob.codigo IN ('RASC-001', 'RASC-004')
ORDER BY cob.codigo;
