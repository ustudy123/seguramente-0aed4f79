-- ============================================================================
-- QA Tier 5 — documentos órfãos de admissão
--
--   ADM-105  231 documentos sem registro em documento_versoes
--   ADM-108  54 arquivos da admissão sem registro no módulo Documentos
--   ADM-101  231 documentos sem pasta_id
--   ADM-102  231 documentos sem colaborador_id
--   ADM-103  152 documentos de 25 admissões CONCLUÍDAS ainda no limbo
--
-- No espírito da reconciliar_pastas_todas_empresas() que já existe no produto.
--
-- CUIDADO CENTRAL: a reconciliação NÃO usa CPF como chave de identidade quando
-- ele é ambíguo. A auditoria de 30/07 encontrou 36 registros em 9 empresas onde
-- o CPF do EMPREGADOR foi gravado no empregado — num caso, o mesmo CPF em doze
-- pessoas. Atribuir documento por CPF ali daria o documento de uma pessoa a
-- outra. Onde há ambiguidade, a rotina PULA e reporta, em vez de adivinhar.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ADM-105 — versão inicial dos documentos existentes
--
-- documento_versoes existe no schema e nunca foi alimentada por este fluxo.
-- Como o upload usa upsert:true no storage, o reenvio SUBSTITUI o arquivo e a
-- versão anterior deixa de existir sem registro de que existiu.
--
-- Cria a v1 a partir do estado atual. Não recupera o que já foi sobrescrito —
-- isso é irrecuperável — mas estabelece a linha de base para daqui pra frente.
-- Seguro e sem ambiguidade: trata do documento, não de quem é o dono.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reconciliar_versoes_documentos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_qtd integer := 0;
BEGIN
  INSERT INTO public.documento_versoes (
    tenant_id, documento_id, versao, storage_path,
    nome_original, mime_type, tamanho, data_validade,
    criado_por, motivo_revisao, created_at
  )
  SELECT
    d.tenant_id, d.id, 1, d.storage_path,
    d.nome_original, d.mime_type, d.tamanho, d.data_validade,
    d.criado_por,
    'Versão inicial registrada por reconciliação retroativa',
    d.created_at
  FROM public.documentos d
  WHERE d.storage_path IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.documento_versoes v WHERE v.documento_id = d.id
    );

  GET DIAGNOSTICS v_qtd = ROW_COUNT;
  RETURN v_qtd;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ADM-108 — arquivos da admissão ausentes no módulo Documentos
--
-- Existem no storage e no checklist, mas o módulo Documentos não os conhece. A
-- sincronização só passou a existir em determinado momento do desenvolvimento.
--
-- O vínculo aqui é o ARQUIVO (admissao_documentos.arquivo_url), não o CPF —
-- inequívoco mesmo com CPF compartilhado, e foi o que permitiu verificar o
-- ADM-106. O tenant e a empresa vêm da ADMISSÃO, nunca do documento.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reconciliar_documentos_admissao()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_qtd integer := 0;
BEGIN
  INSERT INTO public.documentos (
    tenant_id, empresa_id, nome_arquivo, nome_original, tipo,
    tamanho, mime_type, storage_path,
    colaborador_nome, colaborador_cpf, status, classificacao, created_at
  )
  SELECT DISTINCT ON (ad.arquivo_url)
    a.tenant_id,
    a.empresa_id,
    COALESCE(ad.arquivo_nome, ad.nome, 'documento'),
    COALESCE(ad.arquivo_nome, ad.nome, 'documento'),
    ad.tipo,
    -- arquivo_tamanho vem nulo em registros antigos; 0 significa desconhecido.
    -- Mais honesto que inventar um número.
    COALESCE(ad.arquivo_tamanho, 0),
    -- A origem não guarda o MIME; deriva da extensão do arquivo.
    CASE lower(regexp_replace(COALESCE(ad.arquivo_nome, ad.arquivo_url), '^.*\.', ''))
      WHEN 'pdf'  THEN 'application/pdf'
      WHEN 'png'  THEN 'image/png'
      WHEN 'jpg'  THEN 'image/jpeg'
      WHEN 'jpeg' THEN 'image/jpeg'
      WHEN 'webp' THEN 'image/webp'
      WHEN 'doc'  THEN 'application/msword'
      WHEN 'docx' THEN 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ELSE 'application/octet-stream'
    END,
    ad.arquivo_url,
    a.nome_completo,
    a.cpf,
    'valido',
    CASE
      WHEN ad.tipo ILIKE '%aso%' OR ad.tipo ILIKE '%exame%'
        OR ad.tipo ILIKE '%atestado%' OR ad.tipo ILIKE '%laudo%' THEN 'sensivel_saude'
      WHEN ad.tipo ILIKE '%rg%' OR ad.tipo ILIKE '%cpf%' OR ad.tipo ILIKE '%ctps%'
        OR ad.tipo ILIKE '%carteira%' OR ad.tipo ILIKE '%certid%'
        OR ad.tipo ILIKE '%titulo%' OR ad.tipo ILIKE '%identidade%'
        OR ad.tipo ILIKE '%reservista%' THEN 'pessoal'
      ELSE 'comum'
    END,
    ad.created_at
  FROM public.admissao_documentos ad
  JOIN public.admissoes a ON a.id = ad.admissao_id
  WHERE ad.arquivo_url IS NOT NULL
    AND ad.arquivo_url <> ''
    AND a.nome_completo IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.documentos d WHERE d.storage_path = ad.arquivo_url
    );

  GET DIAGNOSTICS v_qtd = ROW_COUNT;
  RETURN v_qtd;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ADM-101 / ADM-102 / ADM-103 — dono e pasta do documento
--
-- Os documentos entram com colaborador_id e pasta_id nulos ("colaborador ainda
-- não tem profile") e NADA volta depois para preencher. ColaboradorFolderView
-- agrupa por (colaborador_id || 'sem-colaborador'), então todos caem no balde
-- avulso em vez de sob a pessoa — é o retrabalho que o arquivamento único se
-- propôs a eliminar.
--
-- IDENTIDADE: o colaborador_id adotado é o que a PASTA daquele CPF já usa. Ele
-- é derivado do dado existente, não inventado — mantém a consistência com o
-- agrupamento da tela.
--
-- AMBIGUIDADE: se o CPF tiver mais de uma pasta de colaborador na mesma empresa
-- (efeito do CPF compartilhado), a rotina PULA o documento e o contabiliza em
-- out_ambiguos. Melhor deixar avulso do que arquivar na pessoa errada.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reconciliar_donos_documentos()
RETURNS TABLE (out_vinculados integer, out_ambiguos integer, out_sem_pasta integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_vinculados integer := 0;
  v_ambiguos   integer := 0;
  v_sem_pasta  integer := 0;
BEGIN
  -- Pastas de colaborador que identificam UMA pessoa sem ambiguidade.
  WITH pasta_unica AS (
    SELECT tenant_id,
           regexp_replace(colaborador_cpf, '[^0-9]', '', 'g') AS cpf_n,
           min(id)             AS pasta_id,
           min(colaborador_id) AS colaborador_id,
           count(*)            AS qtd
      FROM public.documento_pastas
     WHERE tipo = 'colaborador'
       AND colaborador_cpf IS NOT NULL
       AND colaborador_cpf <> ''
     GROUP BY 1, 2
    HAVING count(*) = 1          -- só quando não há dúvida
  )
  UPDATE public.documentos d
     SET pasta_id       = COALESCE(d.pasta_id, p.pasta_id),
         colaborador_id = COALESCE(d.colaborador_id, p.colaborador_id)
    FROM pasta_unica p
   WHERE p.tenant_id = d.tenant_id
     AND p.cpf_n = regexp_replace(COALESCE(d.colaborador_cpf, ''), '[^0-9]', '', 'g')
     AND d.colaborador_cpf IS NOT NULL
     AND (d.pasta_id IS NULL OR d.colaborador_id IS NULL);

  GET DIAGNOSTICS v_vinculados = ROW_COUNT;

  -- Quantos ficaram de fora por CPF que aponta para mais de uma pasta.
  SELECT count(*) INTO v_ambiguos
    FROM public.documentos d
   WHERE d.colaborador_cpf IS NOT NULL
     AND (d.pasta_id IS NULL OR d.colaborador_id IS NULL)
     AND EXISTS (
       SELECT 1 FROM public.documento_pastas p
        WHERE p.tenant_id = d.tenant_id
          AND p.tipo = 'colaborador'
          AND regexp_replace(COALESCE(p.colaborador_cpf, ''), '[^0-9]', '', 'g')
            = regexp_replace(d.colaborador_cpf, '[^0-9]', '', 'g')
        GROUP BY p.tenant_id
       HAVING count(*) > 1
     );

  -- Quantos ficaram sem pasta porque a pasta do colaborador não existe.
  SELECT count(*) INTO v_sem_pasta
    FROM public.documentos d
   WHERE d.colaborador_cpf IS NOT NULL
     AND d.pasta_id IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.documento_pastas p
        WHERE p.tenant_id = d.tenant_id
          AND p.tipo = 'colaborador'
          AND regexp_replace(COALESCE(p.colaborador_cpf, ''), '[^0-9]', '', 'g')
            = regexp_replace(d.colaborador_cpf, '[^0-9]', '', 'g')
     );

  out_vinculados := v_vinculados;
  out_ambiguos   := v_ambiguos;
  out_sem_pasta  := v_sem_pasta;
  RETURN NEXT;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Gancho na conclusão da admissão — para não gerar passivo novo
--
-- O ADM-103 não é só passivo histórico: enquanto nada reconciliar na conclusão,
-- toda admissão nova repõe o problema. A trigger fecha o ciclo de arquivamento
-- no momento em que a pessoa vira colaborador.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reconciliar_documentos_na_conclusao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cpf     TEXT;
  v_pasta   UUID;
  v_colab   UUID;
  v_qtd     INTEGER;
BEGIN
  IF NEW.status <> 'concluido' OR OLD.status = 'concluido' THEN
    RETURN NEW;
  END IF;

  v_cpf := regexp_replace(COALESCE(NEW.cpf, ''), '[^0-9]', '', 'g');
  IF v_cpf = '' THEN RETURN NEW; END IF;

  -- Só age quando a pasta do colaborador é única — mesma cautela da rotina
  -- retroativa: na dúvida, deixa avulso em vez de arquivar na pessoa errada.
  SELECT count(*), min(id), min(colaborador_id)
    INTO v_qtd, v_pasta, v_colab
    FROM public.documento_pastas
   WHERE tenant_id = NEW.tenant_id
     AND tipo = 'colaborador'
     AND regexp_replace(COALESCE(colaborador_cpf, ''), '[^0-9]', '', 'g') = v_cpf;

  IF v_qtd <> 1 THEN RETURN NEW; END IF;

  UPDATE public.documentos
     SET pasta_id       = COALESCE(pasta_id, v_pasta),
         colaborador_id = COALESCE(colaborador_id, v_colab)
   WHERE tenant_id = NEW.tenant_id
     AND regexp_replace(COALESCE(colaborador_cpf, ''), '[^0-9]', '', 'g') = v_cpf
     AND (pasta_id IS NULL OR colaborador_id IS NULL);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reconcilia_documentos_conclusao ON public.admissoes;
CREATE TRIGGER reconcilia_documentos_conclusao
AFTER UPDATE OF status ON public.admissoes
FOR EACH ROW EXECUTE FUNCTION public.reconciliar_documentos_na_conclusao();


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Trigger de versionamento — para o ADM-105 não voltar a acontecer
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.registrar_versao_documento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_prox INTEGER;
BEGIN
  IF NEW.storage_path IS NULL THEN RETURN NEW; END IF;

  -- Na inserção: v1. No update com troca de arquivo: próxima versão.
  IF TG_OP = 'UPDATE' AND NEW.storage_path IS NOT DISTINCT FROM OLD.storage_path THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(max(versao), 0) + 1 INTO v_prox
    FROM public.documento_versoes WHERE documento_id = NEW.id;

  INSERT INTO public.documento_versoes (
    tenant_id, documento_id, versao, storage_path,
    nome_original, mime_type, tamanho, data_validade, criado_por
  ) VALUES (
    NEW.tenant_id, NEW.id, v_prox, NEW.storage_path,
    NEW.nome_original, NEW.mime_type, NEW.tamanho, NEW.data_validade, NEW.criado_por
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS versiona_documento ON public.documentos;
CREATE TRIGGER versiona_documento
AFTER INSERT OR UPDATE OF storage_path ON public.documentos
FOR EACH ROW EXECUTE FUNCTION public.registrar_versao_documento();
