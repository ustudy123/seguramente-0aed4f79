-- =========================================================
-- FIX: solicitações de ajuste de ponto e de férias aparecendo na
-- empresa/unidade errada (ex.: colaboradores de Dois Vizinhos e
-- Realeza listados sob BARROS & NUERNBERG ENGENHARIA LTDA).
--
-- Causa raiz: tanto ponto_ajustes quanto ferias_solicitacoes eram
-- gravados com empresa_id = empresa ATIVA de quem criava a
-- solicitação, e não com a empresa/unidade real do COLABORADOR
-- (que vem da admissão). Quando um gestor com a empresa X ativa
-- lançava ajustes/férias de colaboradores de outras unidades,
-- todos ficavam carimbados com X e apareciam na empresa errada.
--
-- O front já foi corrigido para gravar o empresa_id do colaborador
-- na criação. Esta migration corrige os REGISTROS JÁ EXISTENTES,
-- realinhando o empresa_id ao da admissão do colaborador
-- (casando por colaborador_id; fallback por CPF no tenant).
-- =========================================================

-- 1) PONTO_AJUSTES — alinha pelo colaborador_id (admissão)
WITH alvo AS (
  SELECT pa.id, a.empresa_id AS empresa_correta
  FROM public.ponto_ajustes pa
  JOIN public.admissoes a ON a.id = pa.colaborador_id
  WHERE a.empresa_id IS NOT NULL
    AND pa.empresa_id IS DISTINCT FROM a.empresa_id
)
UPDATE public.ponto_ajustes pa
SET empresa_id = alvo.empresa_correta
FROM alvo
WHERE pa.id = alvo.id;

-- 1b) PONTO_AJUSTES — fallback por CPF (registros sem colaborador_id
--     casável), só quando há uma única empresa para aquele CPF.
WITH cpf_emp AS (
  SELECT a.tenant_id, a.cpf, MIN(a.empresa_id::text)::uuid AS empresa_correta
  FROM public.admissoes a
  WHERE a.empresa_id IS NOT NULL AND a.cpf IS NOT NULL
  GROUP BY a.tenant_id, a.cpf
  HAVING COUNT(DISTINCT a.empresa_id) = 1
)
UPDATE public.ponto_ajustes pa
SET empresa_id = ce.empresa_correta
FROM cpf_emp ce
WHERE pa.colaborador_cpf = ce.cpf
  AND pa.tenant_id = ce.tenant_id
  AND (pa.colaborador_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.admissoes a2 WHERE a2.id = pa.colaborador_id AND a2.empresa_id IS NOT NULL
      ))
  AND pa.empresa_id IS DISTINCT FROM ce.empresa_correta;

-- 2) FERIAS_SOLICITACOES — alinha pelo colaborador_id (admissão)
WITH alvo AS (
  SELECT fs.id, a.empresa_id AS empresa_correta
  FROM public.ferias_solicitacoes fs
  JOIN public.admissoes a ON a.id = fs.colaborador_id
  WHERE a.empresa_id IS NOT NULL
    AND fs.empresa_id IS DISTINCT FROM a.empresa_id
)
UPDATE public.ferias_solicitacoes fs
SET empresa_id = alvo.empresa_correta
FROM alvo
WHERE fs.id = alvo.id;

-- 2b) FERIAS_SOLICITACOES — fallback por CPF
WITH cpf_emp AS (
  SELECT a.tenant_id, a.cpf, MIN(a.empresa_id::text)::uuid AS empresa_correta
  FROM public.admissoes a
  WHERE a.empresa_id IS NOT NULL AND a.cpf IS NOT NULL
  GROUP BY a.tenant_id, a.cpf
  HAVING COUNT(DISTINCT a.empresa_id) = 1
)
UPDATE public.ferias_solicitacoes fs
SET empresa_id = ce.empresa_correta
FROM cpf_emp ce
WHERE fs.colaborador_cpf = ce.cpf
  AND fs.tenant_id = ce.tenant_id
  AND (fs.colaborador_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.admissoes a2 WHERE a2.id = fs.colaborador_id AND a2.empresa_id IS NOT NULL
      ))
  AND fs.empresa_id IS DISTINCT FROM ce.empresa_correta;
