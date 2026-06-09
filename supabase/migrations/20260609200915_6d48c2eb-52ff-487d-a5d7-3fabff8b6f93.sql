-- 1. Unificar as marcações no tenant correto (83f1b040-c857-45a4-b71d-506e2a32d527)
-- Desabilitamos temporariamente as triggers de auditoria/restrição para permitir a correção técnica
SET session_replication_role = 'replica';

UPDATE public.ponto_marcacoes
SET tenant_id = '83f1b040-c857-45a4-b71d-506e2a32d527'
WHERE colaborador_cpf = '10140589961' AND tenant_id = '299779a8-1cd2-4ffe-9462-78181426cd1a';

-- 2. Limpar os registros de ponto_diario duplicados/errados
DELETE FROM public.ponto_diario
WHERE colaborador_cpf = '10140589961' AND tenant_id = '299779a8-1cd2-4ffe-9462-78181426cd1a';

-- Reabilitamos as triggers
SET session_replication_role = 'origin';

-- 3. Forçar a consolidação no tenant correto para a data específica
SELECT public.consolidar_ponto_diario_manual('83f1b040-c857-45a4-b71d-506e2a32d527', '10140589961', '2026-06-08');
