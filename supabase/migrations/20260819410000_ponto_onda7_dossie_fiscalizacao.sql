-- ============================================================================
-- ONDA 7 (parte 5) — Dossiê de fiscalização + arquivamento no módulo Documentos
-- PONTO-392 / PONTO-393  (fecha a onda 7)
--
-- Faltavam as duas pontas do acervo probatório:
--   (392) Diante do Auditor-Fiscal, o DP teria de caçar peça por peça — não havia
--         um empacotador que reunisse AFD, AEJ, comprovantes, espelhos e a trilha
--         num pacote com índice e verificação de assinaturas (hashes). As peças
--         nasceram nas partes 1–4 desta onda; faltava juntá-las.
--   (393) As peças ficavam soltas nas tabelas do ponto, sem a classificação por
--         pasta e o vínculo do módulo Documentos (seção 16 dos requisitos) — sem
--         arquivamento automático, dependendo de upload manual.
--
-- O QUE FAZ (aditivo)
--   (1) ponto_dossies_fiscalizacao: o pacote — empresa, competência, ÍNDICE das
--       peças com suas contagens e hashes, e o hash do pacote. Cercado + RLS.
--   (2) ponto_arquivar_documento(...): grava a referência de uma peça no
--       repositório de Documentos (public.documentos) com pasta/classificação e
--       vínculo (empresa/colaborador), conferindo o objeto em storage.objects —
--       sem upload manual. Idempotente por caminho de arquivo.
--   (3) ponto_gerar_dossie_fiscalizacao(tenant, empresa, competencia): monta o
--       dossie de fiscalizacao a partir das peças (AEJ, comprovantes, espelhos,
--       AFD importado), com índice e hashes, e o ARQUIVA no módulo Documentos.
--
-- GARANTIAS: não altera o motor de saldo, o espelho, o fechamento nem as peças.
-- Só LÊ as peças, monta o pacote e registra a referência. Aditivo e idempotente.
-- ============================================================================

-- (1) O pacote ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ponto_dossies_fiscalizacao (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  empresa_id    uuid,
  competencia   text NOT NULL,
  periodo_ini   date,
  periodo_fim   date,
  total_pecas   integer NOT NULL DEFAULT 0,
  indice        jsonb,
  hash_pacote   text,
  documento_id  uuid,
  gerado_em     timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ponto_dossies_fiscalizacao_comp
  ON public.ponto_dossies_fiscalizacao (tenant_id, empresa_id, competencia);

COMMENT ON TABLE public.ponto_dossies_fiscalizacao IS
  'Dossie de fiscalizacao do ponto: pacote da competencia que reune as pecas (AEJ, comprovantes, espelhos, AFD importado) com indice, contagens e hashes de integridade. PONTO-392.';

ALTER TABLE public.ponto_dossies_fiscalizacao ENABLE ROW LEVEL SECURITY;

DO $rls$
BEGIN
  IF to_regprocedure('public.get_user_tenant_id()') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_policies
       WHERE schemaname='public' AND tablename='ponto_dossies_fiscalizacao'
         AND policyname='ponto_dossies_fiscalizacao_tenant') THEN
    CREATE POLICY ponto_dossies_fiscalizacao_tenant
      ON public.ponto_dossies_fiscalizacao
      FOR ALL
      USING (tenant_id = public.get_user_tenant_id())
      WITH CHECK (tenant_id = public.get_user_tenant_id());
  END IF;
END $rls$;

DO $cerca$
BEGIN
  IF to_regprocedure('public.qa_bloqueia_fora_do_cercado()') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_trigger
       WHERE tgname = 'qa_guarda_cercado'
         AND tgrelid = 'public.ponto_dossies_fiscalizacao'::regclass
         AND NOT tgisinternal) THEN
    CREATE TRIGGER qa_guarda_cercado
      BEFORE INSERT OR UPDATE OR DELETE ON public.ponto_dossies_fiscalizacao
      FOR EACH ROW EXECUTE FUNCTION public.qa_bloqueia_fora_do_cercado();
  END IF;
END $cerca$;

INSERT INTO public.qa_tabelas_protegidas (tabela, motivo)
SELECT 'ponto_dossies_fiscalizacao', 'Cerca generica: tabela tem tenant_id'
WHERE to_regclass('public.qa_tabelas_protegidas') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.qa_tabelas_protegidas x
                  WHERE x.tabela = 'ponto_dossies_fiscalizacao');

-- (2) Arquivamento no módulo Documentos --------------------------------------
CREATE OR REPLACE FUNCTION public.ponto_arquivar_documento(
  p_tenant_id       uuid,
  p_empresa_id      uuid,
  p_colaborador_id  uuid,
  p_colaborador_nome text,
  p_colaborador_cpf text,
  p_nome            text,
  p_tipo            text,
  p_storage_path    text,
  p_classificacao   text DEFAULT 'comum',
  p_pasta_id        uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id    uuid;
  v_no_storage boolean;
BEGIN
  -- Idempotente: uma referencia por caminho de arquivo no tenant.
  SELECT id INTO v_id FROM public.documentos
  WHERE tenant_id = p_tenant_id AND storage_path = p_storage_path
  LIMIT 1;
  IF FOUND THEN
    RETURN v_id;
  END IF;

  -- Confere se o objeto fisico ja esta no repositorio de arquivos
  -- (storage.objects); a referencia nasce mesmo antes do upload, marcada.
  v_no_storage := EXISTS (
    SELECT 1 FROM storage.objects o WHERE o.name = p_storage_path
  );

  INSERT INTO public.documentos (
    tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
    nome_arquivo, nome_original, tipo, tamanho, mime_type, storage_path,
    status, classificacao, pasta_id, criado_por_nome, versao, versao_atual, total_versoes,
    observacoes
  ) VALUES (
    p_tenant_id, p_empresa_id, p_colaborador_id,
    COALESCE(p_colaborador_nome, '(documento da empresa)'), p_colaborador_cpf,
    p_nome, p_nome, p_tipo, 0, 'application/octet-stream', p_storage_path,
    'valido', COALESCE(p_classificacao, 'comum'), p_pasta_id, 'Ponto (automatico)', '1', 1, 1,
    CASE WHEN v_no_storage THEN 'Arquivo presente em storage.objects.'
         ELSE 'Referencia registrada; arquivo fisico pendente em storage.objects.' END
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.ponto_arquivar_documento(uuid, uuid, uuid, text, text, text, text, text, text, uuid) IS
  'Arquiva a referencia de uma peca do ponto no modulo Documentos (public.documentos) com classificacao e vinculo (empresa/colaborador), conferindo o objeto em storage.objects. Idempotente por storage_path. Sem upload manual. PONTO-393.';

-- (3) Gerador do dossiê -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ponto_gerar_dossie_fiscalizacao(
  p_tenant_id   uuid,
  p_empresa_id  uuid,
  p_competencia text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ini date := to_date(p_competencia || '-01', 'YYYY-MM-DD');
  v_fim date := (to_date(p_competencia || '-01', 'YYYY-MM-DD') + INTERVAL '1 month - 1 day')::date;
  v_indice jsonb := '[]'::jsonb;
  v_total  int := 0;
  v_c int; v_h text;
  v_hash_pacote text;
  v_id uuid;
  v_doc uuid;
BEGIN
  -- Monta o dossie de fiscalizacao reunindo as pecas da competencia, cada uma
  -- com sua contagem e um hash representativo (verificacao de integridade).

  -- AEJ (Arquivo Eletronico de Jornada) — parte 2.
  SELECT count(*), max(hash_arquivo) INTO v_c, v_h
  FROM public.ponto_arquivos_aej
  WHERE tenant_id = p_tenant_id AND competencia = p_competencia
    AND (p_empresa_id IS NULL OR empresa_id = p_empresa_id);
  v_indice := v_indice || jsonb_build_object('peca','aej','quantidade',v_c,'hash',v_h);
  v_total := v_total + COALESCE(v_c,0);

  -- Comprovantes de registro de ponto — parte 1.
  SELECT count(*), encode(public.digest(COALESCE(string_agg(hash_comprovante, ',' ORDER BY hash_comprovante),''),'sha256'),'hex')
    INTO v_c, v_h
  FROM public.ponto_comprovantes
  WHERE tenant_id = p_tenant_id
    AND (p_empresa_id IS NULL OR empresa_id = p_empresa_id)
    AND data_hora_marcacao::date BETWEEN v_ini AND v_fim;
  v_indice := v_indice || jsonb_build_object('peca','comprovantes','quantidade',v_c,'hash',v_h);
  v_total := v_total + COALESCE(v_c,0);

  -- Espelhos de ponto (apuracao fechada) — onda 6.
  SELECT count(*), encode(public.digest(COALESCE(string_agg(COALESCE(assinatura_hash,''), ',' ORDER BY colaborador_cpf),''),'sha256'),'hex')
    INTO v_c, v_h
  FROM public.ponto_espelhos
  WHERE tenant_id = p_tenant_id AND competencia = p_competencia
    AND (p_empresa_id IS NULL OR empresa_id = p_empresa_id);
  v_indice := v_indice || jsonb_build_object('peca','espelhos','quantidade',v_c,'hash',v_h);
  v_total := v_total + COALESCE(v_c,0);

  -- AFD importado e conferido (nao em quarentena) — parte 3.
  SELECT count(*), encode(public.digest(COALESCE(string_agg(COALESCE(arquivo_hash,''), ',' ORDER BY arquivo_hash),''),'sha256'),'hex')
    INTO v_c, v_h
  FROM public.ponto_repc_importacoes
  WHERE tenant_id = p_tenant_id
    AND (p_empresa_id IS NULL OR empresa_id = p_empresa_id)
    AND COALESCE(quarentena, false) = false;
  v_indice := v_indice || jsonb_build_object('peca','afd_importado','quantidade',v_c,'hash',v_h);
  v_total := v_total + COALESCE(v_c,0);

  -- Hash do pacote: integridade do indice inteiro (verificacao de assinaturas).
  v_hash_pacote := encode(public.digest(v_indice::text, 'sha256'), 'hex');

  -- Idempotente: refaz o dossie desta competencia/empresa.
  DELETE FROM public.ponto_dossies_fiscalizacao
  WHERE tenant_id = p_tenant_id AND competencia = p_competencia
    AND (p_empresa_id IS NULL OR empresa_id = p_empresa_id
         OR (p_empresa_id IS NULL AND empresa_id IS NULL));

  INSERT INTO public.ponto_dossies_fiscalizacao
    (tenant_id, empresa_id, competencia, periodo_ini, periodo_fim, total_pecas, indice, hash_pacote)
  VALUES
    (p_tenant_id, p_empresa_id, p_competencia, v_ini, v_fim, v_total, v_indice, v_hash_pacote)
  RETURNING id INTO v_id;

  -- Arquiva a referencia do dossie no modulo Documentos (sem upload manual).
  v_doc := public.ponto_arquivar_documento(
    p_tenant_id, p_empresa_id, NULL, NULL, NULL,
    format('Dossie de fiscalizacao %s.json', p_competencia),
    'dossie_fiscalizacao',
    format('ponto/dossie/%s/%s.json', COALESCE(p_empresa_id::text,'tenant'), p_competencia),
    'comum', NULL);

  UPDATE public.ponto_dossies_fiscalizacao SET documento_id = v_doc WHERE id = v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.ponto_gerar_dossie_fiscalizacao(uuid, uuid, text) IS
  'Monta o dossie de fiscalizacao da competencia reunindo AEJ, comprovantes, espelhos e AFD importado, com indice, contagens e hashes (verificacao de integridade), e arquiva a referencia no modulo Documentos. Idempotente. PONTO-392.';
