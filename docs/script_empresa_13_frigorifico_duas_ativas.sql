-- 1) As duas linhas do frigorífico, lado a lado
SELECT e.id, COALESCE(e.razao_social, e.nome_fantasia) AS empresa, e.cnpj, e.ativo,
       (SELECT count(*) FROM public.admissoes a
         WHERE a.empresa_id = e.id AND COALESCE(a.inativo,false) = false) AS pessoas_ativas,
       (SELECT count(*) FROM public.admissoes a WHERE a.empresa_id = e.id) AS admissoes_total,
       (SELECT count(*) FROM public.ponto_diario p WHERE p.empresa_id = e.id) AS dias_de_ponto
FROM public.empresa_cadastro e
WHERE regexp_replace(COALESCE(e.cnpj,''), '[^0-9]', '', 'g') = '57488681000104'
ORDER BY pessoas_ativas DESC, admissoes_total DESC;

-- 2) Desativa de volta a que está VAZIA, mantendo a que tem gente.
--    Só age se sobrar exatamente uma com conteúdo — senão não faz nada.
DO $frig$
DECLARE
  v_com_gente uuid;
  v_qtd int;
  v_n int;
BEGIN
  SELECT count(*) INTO v_qtd
  FROM public.empresa_cadastro e
  WHERE regexp_replace(COALESCE(e.cnpj,''), '[^0-9]', '', 'g') = '57488681000104'
    AND e.ativo = true
    AND (EXISTS (SELECT 1 FROM public.admissoes a WHERE a.empresa_id = e.id)
      OR EXISTS (SELECT 1 FROM public.ponto_diario p WHERE p.empresa_id = e.id));

  IF v_qtd <> 1 THEN
    RAISE NOTICE 'Não é uma só com conteúdo (são %). Nada alterado — me avise.', v_qtd;
    RETURN;
  END IF;

  SELECT e.id INTO v_com_gente
  FROM public.empresa_cadastro e
  WHERE regexp_replace(COALESCE(e.cnpj,''), '[^0-9]', '', 'g') = '57488681000104'
    AND e.ativo = true
    AND (EXISTS (SELECT 1 FROM public.admissoes a WHERE a.empresa_id = e.id)
      OR EXISTS (SELECT 1 FROM public.ponto_diario p WHERE p.empresa_id = e.id));

  UPDATE public.empresa_cadastro
  SET ativo = false
  WHERE regexp_replace(COALESCE(cnpj,''), '[^0-9]', '', 'g') = '57488681000104'
    AND ativo = true
    AND id <> v_com_gente;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  RAISE NOTICE 'Mantida a empresa % ; % cópia(s) vazia(s) desativada(s).', v_com_gente, v_n;
END $frig$;

-- 3) Confirmação: uma ativa só, com a gente dentro
SELECT count(*) FILTER (WHERE ativo) AS ativas_com_esse_cnpj,
       count(*)                      AS cadastros_com_esse_cnpj
FROM public.empresa_cadastro
WHERE regexp_replace(COALESCE(cnpj,''), '[^0-9]', '', 'g') = '57488681000104';
