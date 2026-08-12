-- =====================================================================
-- qa_disparo ganha o valor 'e2e'
--
-- As corridas do Cypress precisam se distinguir das baterias do motor
-- SQL no historico: mesma tabela (qa_execucoes), origem diferente.
--
-- Por que isto vive numa migration sozinha: um valor novo de ENUM nao
-- pode ser USADO na mesma transacao que o cria. Se este ALTER TYPE
-- estivesse junto da migration que grava uma execucao 'e2e', a gravacao
-- quebraria em execucao. Arquivo separado = transacao separada.
-- =====================================================================

ALTER TYPE public.qa_disparo ADD VALUE IF NOT EXISTS 'e2e';
