-- =====================================================================
-- Anexar o print da falha numa 2ª chamada, pequena e separada
--
-- Por que: a 1ª corrida com tudo junto (resultados + prints base64 no
-- MESMO corpo) deu HTTP 504 — o corpo de ~1,2 MB estoura o limite do
-- gateway e a função fica pendurada até o timeout de 150s.
--
-- Solução: desacoplar. O reporter manda os resultados primeiro (leve,
-- garante o pass/fail no painel) e recebe o id da execução; depois manda
-- CADA print numa chamada própria e pequena. Esta função é o destino
-- dessas chamadas: acha a linha do resultado por (execução, spec, teste)
-- e cola o print nela. Idempotente: reenviar sobrescreve.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.qa_anexar_print_e2e(
  p_execucao_id  uuid,
  p_spec         text,
  p_teste        text,
  p_evidencia_png text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_codigo text;
  v_n      int;
BEGIN
  IF p_evidencia_png IS NULL OR btrim(p_evidencia_png) = '' THEN
    RETURN false;
  END IF;

  -- O reporter conhece (spec, teste), não o código do caso — a ligação
  -- vive no banco. Resolve aqui, do mesmo jeito que a gravação faz.
  SELECT e.codigo INTO v_codigo
  FROM public.qa_cobertura_e2e e
  WHERE e.ativo AND e.spec = p_spec AND e.teste = p_teste;

  IF v_codigo IS NULL THEN
    RETURN false; -- teste sem caso documentado: não há linha para anexar
  END IF;

  UPDATE public.qa_resultados
  SET evidencia_png = p_evidencia_png
  WHERE execucao_id = p_execucao_id AND codigo = v_codigo;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n > 0;
END $$;

COMMENT ON FUNCTION public.qa_anexar_print_e2e(uuid, text, text, text) IS
  'Cola o print (PNG base64) numa linha de qa_resultados já criada, por (execucao, spec, teste). Chamada uma vez por print pela Edge Function, para o corpo ficar pequeno e não estourar o gateway.';

REVOKE ALL ON FUNCTION public.qa_anexar_print_e2e(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qa_anexar_print_e2e(uuid, text, text, text) TO service_role;

SELECT 'qa_anexar_print_e2e' AS funcao,
       to_regprocedure('public.qa_anexar_print_e2e(uuid, text, text, text)')::text AS existe;
