-- =========================================================
-- QA — desbloqueio do bloco "Jornada & Rotina" na documentação de testes
--
-- O bloco foi marcado 'bloqueado' em jul/2026 ("regras de negócio em
-- alteração — documentar agora eternizaria comportamento que vai mudar").
-- O cenário mudou: Ponto tem 123 casos documentados (frentes de agosto,
-- conformidade Portaria 671 e requisitos YE-DP-PONTO-001) e Férias tem 27
-- (requisitos + CLT arts. 129-145), ambos com rotinas executáveis no runner.
--
-- Ajuste (idempotente):
--   ponto, ferias ......................... documentado
--   demais filhos e o pai ................. nao_iniciado / em_andamento,
--                                           liberados para trabalho
--   motivo_bloqueio ....................... limpo em todos
-- =========================================================

SET lock_timeout = '10s';

UPDATE public.qa_modulos
SET status_doc = 'documentado', motivo_bloqueio = NULL
WHERE path IN ('jornada-rotina/ponto', 'jornada-rotina/ferias')
  AND status_doc = 'bloqueado';

UPDATE public.qa_modulos
SET status_doc = 'em_andamento', motivo_bloqueio = NULL
WHERE path = 'jornada-rotina'
  AND status_doc = 'bloqueado';

UPDATE public.qa_modulos
SET status_doc = 'nao_iniciado', motivo_bloqueio = NULL
WHERE path LIKE 'jornada-rotina/%'
  AND status_doc = 'bloqueado';

-- Conferência
SELECT path, label, status_doc, coalesce(motivo_bloqueio, '—') AS motivo
FROM public.qa_modulos
WHERE path = 'jornada-rotina' OR path LIKE 'jornada-rotina/%'
ORDER BY path;
