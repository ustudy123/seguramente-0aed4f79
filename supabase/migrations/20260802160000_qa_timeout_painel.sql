-- =========================================================
-- QA — Timeout do painel (29/07/2026)
--
-- MEDICAO ANTES DE CORRIGIR:
--   bateria completa (290 casos) ... 6.389 ms
--   varredura de vazamento ........... 249 ms  (4% do total)
--
-- Minha hipotese inicial era que a varredura de 295 tabelas fosse a culpada.
-- ERRADA: ela custa 249 ms. O tempo esta distribuido nos 290 casos, a cerca
-- de 21 ms cada — trabalho legitimo, nao desperdicio. Nao ha o que otimizar
-- sem tirar cobertura, e tirar cobertura para caber num limite arbitrario
-- seria trocar a finalidade da ferramenta pela conveniencia do transporte.
--
-- CAUSA REAL: o papel `authenticated` do Supabase tem statement_timeout curto
-- (8s por padrao). Pelo SQL Editor a bateria roda porque o limite la e outro.
-- Pelo painel, 6,4s de trabalho mais autenticacao, o UPDATE de disparada_por
-- e a serializacao da resposta ultrapassam o teto.
--
-- CORRECAO: elevar o statement_timeout APENAS para as funcoes de QA, via
-- atributo de funcao. O ajuste vale durante a chamada e volta ao normal
-- depois — nao afeta nenhum outro endpoint do sistema. E preferivel a mexer
-- no timeout global do papel authenticated, que protege o resto da API.
--
-- 120s e folga generosa sobre os 6,4s atuais: a bateria vai crescer conforme
-- documentarmos mais modulos, e nao quero voltar aqui a cada 50 casos novos.
-- =========================================================

SET lock_timeout = '5s';

-- Ponto de entrada da tela.
ALTER FUNCTION public.qa_disparar_bateria(text)  SET statement_timeout = '120s';

-- Motor. Recebe o mesmo teto para o caso de ser chamado direto (pg_cron).
ALTER FUNCTION public.qa_rodar_bateria(public.qa_disparo, text)
  SET statement_timeout = '120s';

-- Varredura: barata hoje (249 ms), mas cresce com o numero de tabelas.
ALTER FUNCTION public.qa_verifica_vazamento() SET statement_timeout = '60s';

COMMENT ON FUNCTION public.qa_disparar_bateria(text) IS
  'Ponto de entrada da tela. Verifica superadmin, roda a bateria (que ja se '
  'isola sozinha) e devolve o id para a tela buscar o relatorio. '
  'statement_timeout elevado para 120s em 29/07/2026: a bateria completa leva '
  'cerca de 6,4s e estourava o teto de 8s do papel authenticated. O ajuste '
  'vale so durante esta funcao.';

-- Conferencia: os tetos ficaram gravados?
SELECT p.proname AS funcao,
       COALESCE(array_to_string(p.proconfig, ', '), '(padrao do papel)') AS ajustes
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('qa_disparar_bateria','qa_rodar_bateria','qa_verifica_vazamento')
ORDER BY p.proname;
