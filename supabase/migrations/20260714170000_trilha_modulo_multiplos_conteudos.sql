-- =========================================================
-- TRILHAS: múltiplos conteúdos por módulo
--
-- Até agora um módulo tinha um único conteúdo (tipo + conteudo_url /
-- conteudo_texto). Passa a aceitar uma LISTA de conteúdos adicionais
-- (vídeo, PDF, apresentação, link, texto) num array JSONB, além do
-- conteúdo principal já existente.
--
-- Formato de cada item:
--   { "id": "<uuid>", "tipo": "video|pdf|apresentacao|link|texto",
--     "titulo": "<opcional>", "url": "<p/ video/pdf/apresentacao/link>",
--     "texto": "<p/ texto>" }
--
-- Módulos existentes continuam funcionando: conteudos default '[]' e o
-- conteúdo principal segue sendo lido dos campos legados.
-- =========================================================

ALTER TABLE public.trilha_modulos
  ADD COLUMN IF NOT EXISTS conteudos jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.trilha_modulos.conteudos IS
  'Conteúdos adicionais do módulo (array de {id,tipo,titulo,url,texto}). O conteúdo principal continua em tipo/conteudo_url/conteudo_texto.';
