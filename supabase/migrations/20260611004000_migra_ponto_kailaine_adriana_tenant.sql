-- =========================================================
-- MIGRAÇÃO: registros de ponto da Kailaine e Adriana do
-- tenant antigo (BARROS 299779a8) para o SUDOMED (83f1b040)
--
-- Causa: links de registro de ponto gerados no tenant antigo;
-- as marcações caíam num "mundo" que a gestora não enxerga.
-- As duas já possuem link novo no Sudomed (criados 05/06).
-- =========================================================

DO $mig$
DECLARE
  c_antigo  uuid := '299779a8-1cd2-4ffe-9462-78181426cd1a';
  c_novo    uuid := '83f1b040-c857-45a4-b71d-506e2a32d527';
  c_empresa uuid := '987c8b52-8a7d-4cb3-b6bc-b4cce0869985'; -- Barros & Nuernberg Engenharia (Sudomed)
  v_dia RECORD;
BEGIN
  PERFORM set_config('app.allow_ponto_delete', 'true', true);

  -- 1) Migra as MARCAÇÕES que não colidem com idênticas no destino
  UPDATE public.ponto_marcacoes pm
  SET tenant_id = c_novo,
      empresa_id = c_empresa,
      colaborador_id = CASE pm.colaborador_cpf
        WHEN '11869993900' THEN 'd674de6a-507c-42f5-b1fa-09db4456dab0'::uuid -- Kailaine (admissão Sudomed)
        WHEN '06153113931' THEN '865a3f4c-39fe-40a6-be6b-ea076643c05d'::uuid -- Adriana (admissão Sudomed)
        ELSE pm.colaborador_id END
  WHERE pm.tenant_id = c_antigo
    AND pm.colaborador_cpf IN ('11869993900', '06153113931')
    AND NOT EXISTS (
      SELECT 1 FROM public.ponto_marcacoes x
      WHERE x.tenant_id = c_novo
        AND x.colaborador_cpf = pm.colaborador_cpf
        AND x.data_marcacao = pm.data_marcacao
        AND x.tipo_marcacao = pm.tipo_marcacao
        AND x.hora_marcacao = pm.hora_marcacao
    );

  -- 2) Remove do antigo o que colidiu (já existia idêntico no novo)
  DELETE FROM public.ponto_marcacoes
  WHERE tenant_id = c_antigo
    AND colaborador_cpf IN ('11869993900', '06153113931');

  -- 3) Migra os AJUSTES (pendentes e histórico)
  UPDATE public.ponto_ajustes
  SET tenant_id = c_novo,
      empresa_id = c_empresa,
      colaborador_id = CASE colaborador_cpf
        WHEN '11869993900' THEN 'd674de6a-507c-42f5-b1fa-09db4456dab0'::uuid
        WHEN '06153113931' THEN '865a3f4c-39fe-40a6-be6b-ea076643c05d'::uuid
        ELSE colaborador_id END
  WHERE tenant_id = c_antigo
    AND colaborador_cpf IN ('11869993900', '06153113931');

  -- 4) Apaga o espelho do tenant antigo (será recalculado no novo)
  DELETE FROM public.ponto_diario
  WHERE tenant_id = c_antigo
    AND colaborador_cpf IN ('11869993900', '06153113931');

  PERFORM set_config('app.allow_ponto_delete', 'false', true);

  -- 5) Reconsolida no Sudomed todos os dias com marcações delas
  FOR v_dia IN
    SELECT DISTINCT colaborador_cpf, data_marcacao
    FROM public.ponto_marcacoes
    WHERE tenant_id = c_novo
      AND colaborador_cpf IN ('11869993900', '06153113931')
  LOOP
    BEGIN
      PERFORM public.consolidar_ponto_diario_manual(c_novo, v_dia.colaborador_cpf, v_dia.data_marcacao);
    EXCEPTION WHEN OTHERS THEN
      NULL; -- período fechado: mantém como está
    END;
  END LOOP;

  -- 6) Desativa os LINKS do tenant antigo (o link velho passa a
  --    responder "Link inválido ou expirado")
  UPDATE public.ponto_links
  SET ativo = false
  WHERE tenant_id = c_antigo
    AND colaborador_cpf IN ('11869993900', '06153113931');
END $mig$;

-- 7) CONFERÊNCIA: tudo deve estar no SUDOMED agora
SELECT colaborador_nome, data, status, tenant_id = '83f1b040-c857-45a4-b71d-506e2a32d527' AS no_sudomed
FROM public.ponto_diario
WHERE colaborador_cpf IN ('11869993900', '06153113931')
  AND data >= CURRENT_DATE - 4
ORDER BY colaborador_nome, data DESC;
