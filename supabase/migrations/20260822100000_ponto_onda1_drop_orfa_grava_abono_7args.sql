-- ============================================================================
-- PONTO Onda 1 (correção de drift) — remove a sobrecarga órfã de 7 args
-- de _ponto_grava_abono, descoberta no ensaio da homologação.
--
-- Uma versão de 7 argumentos — `_ponto_grava_abono(uuid, uuid, text, text,
-- date, text, text)` (o último argumento `p_tipo_dia text`) — foi criada
-- direto na PRODUÇÃO no passado, nunca entrou nas migrations e foi SUPERADA
-- pela versão de 6 args (os antigos chamadores passaram a chamar 6 args). Ela
-- ainda usava o arbiter antigo `ON CONFLICT (tenant_id, colaborador_cpf, data)`
-- e quebraria em execução depois que a onda 1 (vínculo na chave) troca o índice
-- de `ponto_diario` de 3 para 4 colunas. Nada no código atual a chama.
--
-- Aqui é aditivo/idempotente e DEFENSIVO: no ambiente de teste (e onde a órfã
-- já foi limpa) é no-op; em produção/homologação remove o drift. Assim o mesmo
-- tropeço do ensaio não se repete na produção.
-- ============================================================================

DROP FUNCTION IF EXISTS public._ponto_grava_abono(uuid, uuid, text, text, date, text, text);
