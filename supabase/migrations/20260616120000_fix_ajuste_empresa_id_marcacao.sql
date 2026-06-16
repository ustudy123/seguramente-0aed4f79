-- =========================================================
-- FIX: marcação aprovada via ajuste não aparece no espelho
--
-- Sintoma: após aprovar uma solicitação de ajuste (ex.: entrada
-- 01:39 em 16/06), a linha do colaborador no espelho mostra o
-- status "Entrada Registrada" (incompleto) mas "Sem marcações" e
-- total 00h00.
--
-- Causa raiz: a processar_ajuste_ponto inseria a marcação com
-- empresa_id = ponto_ajustes.empresa_id (capturado da empresa
-- ATIVA no momento da solicitação). Já o ponto_diario tem o
-- empresa_id corrigido para o da ADMISSÃO do colaborador
-- (migration 20260611003000). Quando os dois divergem, a
-- consolidação enxerga a marcação (gera o status incompleto), mas
-- a query de marcações do espelho — que filtrava empresa_id =
-- ativo OR null — escondia a batida.
--
-- O front já foi ajustado para não filtrar marcações por
-- empresa_id (casa por CPF com a lista já escopada). Aqui
-- consertamos a ORIGEM: a inserção do ajuste passa a usar o mesmo
-- empresa_id da admissão (ponto_empresa_do_colaborador), evitando
-- divergência futura. E alinhamos as marcações já gravadas.
-- =========================================================

-- 1) Recria a função vigente trocando o empresa_id do INSERT da
--    marcação para ponto_empresa_do_colaborador(colaborador_id),
--    com fallback para o empresa_id do próprio ajuste.
DO $patch$
DECLARE
  v_src text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'processar_ajuste_ponto';

  IF v_src IS NULL THEN
    RAISE NOTICE 'processar_ajuste_ponto não encontrada — nada a corrigir';
    RETURN;
  END IF;

  -- Troca o valor inserido para empresa_id da marcação.
  -- A versão vigente insere "v_ajuste.empresa_id" na lista de VALUES.
  v_src := replace(
    v_src,
    'v_ajuste.tenant_id, v_ajuste.empresa_id, v_ajuste.colaborador_id',
    'v_ajuste.tenant_id, COALESCE(public.ponto_empresa_do_colaborador(v_ajuste.colaborador_id), v_ajuste.empresa_id), v_ajuste.colaborador_id'
  );

  EXECUTE v_src;
END $patch$;

-- 2) Reaplica grants (o CREATE OR REPLACE preserva, mas garantimos)
REVOKE EXECUTE ON FUNCTION public.processar_ajuste_ponto(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.processar_ajuste_ponto(uuid, boolean, text) TO authenticated;

-- 3) CORREÇÃO RETROATIVA: marcações criadas por aprovação de ajuste
--    (hash 'AJUSTE-%') cujo empresa_id diverge do empresa_id da
--    admissão do colaborador. Alinha ao da admissão e reconsolida.
DO $fix$
DECLARE
  v RECORD;
  v_corrigidas INT := 0;
BEGIN
  FOR v IN
    SELECT pm.id, pm.tenant_id, pm.colaborador_cpf, pm.data_marcacao,
           pm.colaborador_id, a.empresa_id AS empresa_correta
    FROM public.ponto_marcacoes pm
    JOIN public.admissoes a ON a.id = pm.colaborador_id
    WHERE pm.hash_marcacao LIKE 'AJUSTE-%'
      AND a.empresa_id IS NOT NULL
      AND pm.empresa_id IS DISTINCT FROM a.empresa_id
      AND pm.data_marcacao >= CURRENT_DATE - 90
  LOOP
    UPDATE public.ponto_marcacoes
    SET empresa_id = v.empresa_correta
    WHERE id = v.id;
    v_corrigidas := v_corrigidas + 1;
    BEGIN
      PERFORM public.consolidar_ponto_diario_manual(v.tenant_id, v.colaborador_cpf, v.data_marcacao);
    EXCEPTION WHEN OTHERS THEN
      NULL; -- período fechado/trava: segue
    END;
  END LOOP;

  RAISE NOTICE 'Fix empresa_id de marcações de ajuste: % corrigidas', v_corrigidas;
END $fix$;
