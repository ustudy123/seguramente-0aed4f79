-- =========================================================
-- FIX (continuação): enum atestado_tipo não conhecia os tipos
-- 'licencas' e 'atestados' usados pelo formulário MOD-GAF
-- (banco só tinha 'assistencial' e 'ocupacional')
-- =========================================================
ALTER TYPE public.atestado_tipo ADD VALUE IF NOT EXISTS 'licencas';
ALTER TYPE public.atestado_tipo ADD VALUE IF NOT EXISTS 'atestados';
