-- =========================================================
-- REPARO: documentos de admissão gravados com tenant errado
--
-- Causa raiz identificada: o upload usava o tenant do USUÁRIO
-- LOGADO em vez do tenant da ADMISSÃO. A Cacilda subiu os docs
-- da Tânia logada na conta antiga (profile no tenant 299779a8),
-- numa admissão do tenant Sudomed (83f1b040) — os registros e
-- arquivos ficaram com tenant divergente e invisíveis para a
-- equipe do tenant correto. O hook do front já foi corrigido.
-- =========================================================

-- 0) DIAGNÓSTICO: quantos documentos estão com tenant divergente
--    da sua admissão? (rode e veja antes de prosseguir)
SELECT COUNT(*) AS docs_com_tenant_divergente
FROM public.admissao_documentos d
JOIN public.admissoes a ON a.id = d.admissao_id
WHERE d.tenant_id <> a.tenant_id;

-- 1) REPARO: alinha o tenant do documento ao tenant da admissão
UPDATE public.admissao_documentos d
SET tenant_id = a.tenant_id,
    updated_at = now()
FROM public.admissoes a
WHERE a.id = d.admissao_id
  AND d.tenant_id <> a.tenant_id;

-- 2) Os ARQUIVOS físicos continuam no caminho antigo do storage
--    ('299779a8/admissoes/...'). Em vez de mover arquivos (arriscado),
--    liberamos a LEITURA por admissão: quem tem acesso ao tenant da
--    admissão pode visualizar os arquivos dela, onde quer que estejam.
DROP POLICY IF EXISTS "documentos_admissao_por_vinculo_select" ON storage.objects;
CREATE POLICY "documentos_admissao_por_vinculo_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documentos'
  AND (storage.foldername(name))[2] = 'admissoes'
  AND EXISTS (
    SELECT 1 FROM public.admissoes a
    WHERE a.id::text = (storage.foldername(name))[3]
      AND a.tenant_id IN (SELECT public.user_tenant_ids())
  )
);

-- 3) CONFERÊNCIA: a Tânia deve aparecer com 9 docs no tenant Sudomed
SELECT d.tenant_id, COUNT(*) AS docs, COUNT(*) FILTER (WHERE d.status = 'enviado') AS enviados
FROM public.admissao_documentos d
WHERE d.admissao_id = 'df701521-d881-4504-82b1-0753187a744f'
GROUP BY d.tenant_id;
