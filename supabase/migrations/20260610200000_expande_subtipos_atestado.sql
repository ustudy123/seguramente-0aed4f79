-- =========================================================
-- FIX: cadastro de atestado/afastamento falhando com
-- "invalid input value for enum atestado_subtipo_assistencial"
--
-- O formulário (MOD-GAF) oferece subtipos de licenças e
-- afastamentos (paternidade, maternidade, casamento,
-- outros_motivos etc.) que não existem no enum do banco,
-- criado apenas com os 6 subtipos assistenciais originais.
--
-- Correção: expande o enum com todos os valores usados pelo
-- formulário (idempotente — ADD VALUE IF NOT EXISTS).
-- =========================================================

-- Licenças
ALTER TYPE public.atestado_subtipo_assistencial ADD VALUE IF NOT EXISTS 'casamento';
ALTER TYPE public.atestado_subtipo_assistencial ADD VALUE IF NOT EXISTS 'falecimento';
ALTER TYPE public.atestado_subtipo_assistencial ADD VALUE IF NOT EXISTS 'militar';
ALTER TYPE public.atestado_subtipo_assistencial ADD VALUE IF NOT EXISTS 'sindical';
ALTER TYPE public.atestado_subtipo_assistencial ADD VALUE IF NOT EXISTS 'outras_licencas';

-- Afastamentos/atestados
ALTER TYPE public.atestado_subtipo_assistencial ADD VALUE IF NOT EXISTS 'maternidade';
ALTER TYPE public.atestado_subtipo_assistencial ADD VALUE IF NOT EXISTS 'paternidade';
ALTER TYPE public.atestado_subtipo_assistencial ADD VALUE IF NOT EXISTS 'acidente_trabalho';
ALTER TYPE public.atestado_subtipo_assistencial ADD VALUE IF NOT EXISTS 'doenca_trabalho';
ALTER TYPE public.atestado_subtipo_assistencial ADD VALUE IF NOT EXISTS 'acidente_nao_trabalho';
ALTER TYPE public.atestado_subtipo_assistencial ADD VALUE IF NOT EXISTS 'doenca_nao_trabalho';
ALTER TYPE public.atestado_subtipo_assistencial ADD VALUE IF NOT EXISTS 'prorrogacao';
ALTER TYPE public.atestado_subtipo_assistencial ADD VALUE IF NOT EXISTS 'aborto_nao_criminoso';
ALTER TYPE public.atestado_subtipo_assistencial ADD VALUE IF NOT EXISTS 'aposentadoria_invalidez';
ALTER TYPE public.atestado_subtipo_assistencial ADD VALUE IF NOT EXISTS 'suspensao_contrato';
ALTER TYPE public.atestado_subtipo_assistencial ADD VALUE IF NOT EXISTS 'outros_motivos';

-- Ocupacionais (garante a lista completa do formulário)
ALTER TYPE public.atestado_subtipo_ocupacional ADD VALUE IF NOT EXISTS 'admissional';
ALTER TYPE public.atestado_subtipo_ocupacional ADD VALUE IF NOT EXISTS 'periodico';
ALTER TYPE public.atestado_subtipo_ocupacional ADD VALUE IF NOT EXISTS 'retorno_trabalho';
ALTER TYPE public.atestado_subtipo_ocupacional ADD VALUE IF NOT EXISTS 'mudanca_risco';
ALTER TYPE public.atestado_subtipo_ocupacional ADD VALUE IF NOT EXISTS 'demissional';
