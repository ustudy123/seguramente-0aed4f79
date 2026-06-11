-- =========================================================
-- FIX: colaboradoras somem do espelho — empresa_id divergente
--
-- O espelho filtra ponto_diario por:
--   empresa_id = empresa ativa OU empresa_id IS NULL
-- Se a linha do dia ficar com empresa_id de OUTRA empresa
-- (efeito das admissões duplicadas), o colaborador some do
-- espelho da empresa correta, mesmo registrando normalmente.
-- A consolidação também não preenchia empresa_id.
-- =========================================================

-- 0) DIAGNÓSTICO: empresa_id das linhas recentes da Kailaine/Adriana
--    (compare com a empresa Barros: 987c8b52-8a7d-4cb3-b6bc-b4cce0869985)
SELECT colaborador_nome, data, status, empresa_id
FROM public.ponto_diario
WHERE (colaborador_nome ILIKE '%kailaine%' OR colaborador_nome ILIKE '%adriana medeiros%')
  AND data >= CURRENT_DATE - 3
ORDER BY colaborador_nome, data DESC;

-- 1) REPARO GERAL: alinha o empresa_id do espelho ao empresa_id da
--    ADMISSÃO correspondente (fonte da verdade do colaborador)
UPDATE public.ponto_diario pd
SET empresa_id = a.empresa_id,
    updated_at = now()
FROM public.admissoes a
WHERE a.id = pd.colaborador_id
  AND a.empresa_id IS NOT NULL
  AND pd.empresa_id IS DISTINCT FROM a.empresa_id;

-- 2) FIX PERMANENTE: consolidação passa a preencher empresa_id
--    (busca da admissão do colaborador; preserva quando já correto)
CREATE OR REPLACE FUNCTION public.ponto_empresa_do_colaborador(p_colaborador_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT empresa_id FROM public.admissoes WHERE id = p_colaborador_id;
$$;

-- Recria a consolidação incluindo empresa_id no upsert.
-- (Mesma lógica vigente de alternância + afastamento; só acrescenta
--  o campo empresa_id nos dois INSERTs/UPDATEs.)
DO $patch$
DECLARE
  v_src text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'consolidar_ponto_diario_manual';

  -- Acrescenta empresa_id nos INSERTs do upsert
  v_src := replace(v_src,
    'INSERT INTO public.ponto_diario (
      tenant_id, colaborador_id, colaborador_nome, colaborador_cpf, data,',
    'INSERT INTO public.ponto_diario (
      tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf, data,');
  v_src := replace(v_src,
    'INSERT INTO public.ponto_diario (
        tenant_id, colaborador_id, colaborador_nome, colaborador_cpf, data,',
    'INSERT INTO public.ponto_diario (
        tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf, data,');

  v_src := replace(v_src,
    'p_tenant_id, v_colaborador_id, v_colaborador_nome, p_colaborador_cpf, p_data,',
    'p_tenant_id, public.ponto_empresa_do_colaborador(v_colaborador_id), v_colaborador_id, v_colaborador_nome, p_colaborador_cpf, p_data,');

  -- Mantém o empresa_id correto também no UPDATE do conflito
  v_src := replace(v_src,
    'DO UPDATE SET
      entrada = EXCLUDED.entrada,',
    'DO UPDATE SET
      empresa_id = COALESCE(EXCLUDED.empresa_id, public.ponto_diario.empresa_id),
      entrada = EXCLUDED.entrada,');
  v_src := replace(v_src,
    'DO UPDATE SET
        status = ''justificado'',',
    'DO UPDATE SET
        empresa_id = COALESCE(EXCLUDED.empresa_id, public.ponto_diario.empresa_id),
        status = ''justificado'',');

  EXECUTE v_src;
END $patch$;

-- 3) CONFERÊNCIA: as duas devem estar com a empresa da Barros agora
SELECT colaborador_nome, data, status, empresa_id
FROM public.ponto_diario
WHERE (colaborador_nome ILIKE '%kailaine%' OR colaborador_nome ILIKE '%adriana medeiros%')
  AND data >= CURRENT_DATE - 3
ORDER BY colaborador_nome, data DESC;
