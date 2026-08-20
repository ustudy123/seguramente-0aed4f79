-- =====================================================================
-- SCRIPT DE ENTREGA (produção) — Ponte QA ↔ Cypress, Empresa 2ª leva
--
-- Cole no SQL Editor do projeto de PRODUÇÃO. Registra, no catálogo de QA,
-- que os casos e2e CHK-001, CHK-003 e HIER-003 passaram a ter teste de
-- tela (cypress/e2e/empresa.cy.ts). É só documentação/cobertura de QA —
-- não altera dados de clientes nem regras de negócio.
--
-- Idempotente: rodar de novo não duplica. Roda o arquivo inteiro numa
-- transação; termina com uma conferência.
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

-- Conferência (o editor mostra só o último SELECT):
SELECT cob.codigo, cob.spec, cob.teste, ct.nivel, ct.status
FROM public.qa_cobertura_e2e cob
LEFT JOIN public.qa_casos_teste ct ON ct.codigo = cob.codigo
WHERE cob.codigo IN ('CHK-001', 'CHK-003', 'HIER-003')
ORDER BY cob.codigo;
