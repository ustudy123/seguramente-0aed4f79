-- =====================================================================
-- QA DOC-030 — "Esperava 2 versões (v1+v2). Total=3, v1=2, v2=1"
--
-- Duas coisas diferentes, e o relatório mostra as duas de uma vez:
--
-- 1. DEFEITO REAL: nada impede duas linhas com o mesmo número de versão
--    para o mesmo documento. O fix de 31/07 tornou a trigger idempotente
--    POR storage_path, o que resolve o caso de o app gravar o mesmo arquivo
--    duas vezes — mas não impede duas "v1" com arquivos distintos. Numa
--    disputa sobre qual documento foi assinado, "a v1" precisa ser uma só.
--
-- 2. ROTINA DESATUALIZADA: a trigger de versionamento passou a criar a v1
--    sozinha quando o documento nasce. A rotina, escrita antes disso, cria
--    o documento e insere a v1 na mão — ganhando a v1 duplicada que ela
--    mesma denuncia. O cenário que ela precisa provar continua valendo
--    ("revisar cria v2 preservando a v1"), só que o v1 agora é automático.
--
-- Correção: unicidade de verdade + numeração que não colide + rotina
-- reescrita para o comportamento correto do produto.
-- =====================================================================

-- 1) LIMPEZA DO QUE JÁ ESTÁ DUPLICADO ---------------------------------
-- Mantém a linha mais antiga de cada (documento, versão) e renumera as
-- demais para o fim da fila, preservando o arquivo — apagar versão é
-- destruir prova.
DO $dedup$
DECLARE
  r RECORD;
  v_prox int;
BEGIN
  FOR r IN
    SELECT v.id, v.documento_id
    FROM (
      SELECT id, documento_id, versao,
             row_number() OVER (PARTITION BY documento_id, versao ORDER BY created_at, id) AS rn
      FROM public.documento_versoes
    ) v
    WHERE v.rn > 1
    ORDER BY v.documento_id, v.rn
  LOOP
    SELECT COALESCE(max(versao), 0) + 1 INTO v_prox
    FROM public.documento_versoes WHERE documento_id = r.documento_id;

    UPDATE public.documento_versoes SET versao = v_prox WHERE id = r.id;
    RAISE NOTICE 'DOC-030: versão duplicada renumerada para % (documento %)', v_prox, r.documento_id;
  END LOOP;
END $dedup$;

-- 2) UNICIDADE ---------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_documento_versoes_numero
  ON public.documento_versoes (documento_id, versao);

-- 3) NUMERAÇÃO À PROVA DE COLISÃO -------------------------------------
-- Quem insere uma versão nem sempre sabe qual é a próxima: o app manda o
-- número que leu antes, a importação manda 1, a trigger calcula. Em vez de
-- rejeitar, o banco resolve — e continua ignorando a regravação do mesmo
-- arquivo, que é o caso que o fix de 31/07 tratou.
CREATE OR REPLACE FUNCTION public.documento_versao_numerar()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_prox int;
BEGIN
  -- Mesmo arquivo já versionado neste documento: não duplica.
  IF NEW.storage_path IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.documento_versoes
    WHERE documento_id = NEW.documento_id
      AND storage_path = NEW.storage_path
  ) THEN
    RETURN NULL;
  END IF;

  IF NEW.versao IS NULL OR EXISTS (
    SELECT 1 FROM public.documento_versoes
    WHERE documento_id = NEW.documento_id AND versao = NEW.versao
  ) THEN
    SELECT COALESCE(max(versao), 0) + 1 INTO v_prox
    FROM public.documento_versoes WHERE documento_id = NEW.documento_id;
    NEW.versao := v_prox;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_documento_versao_numerar ON public.documento_versoes;
CREATE TRIGGER trg_documento_versao_numerar
  BEFORE INSERT ON public.documento_versoes
  FOR EACH ROW EXECUTE FUNCTION public.documento_versao_numerar();

-- 4) ROTINA REESCRITA PARA O COMPORTAMENTO REAL -----------------------
-- A premissa sob teste não mudou: revisar preserva a versão anterior. O que
-- mudou é quem cria a v1. A rotina passa a exercer o caminho do produto —
-- criar o documento, depois trocar o arquivo — e ainda cobre o defeito
-- recém-corrigido, tentando forçar uma segunda v1.
CREATE OR REPLACE FUNCTION public.qa_caso_doc_030()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_doc uuid; v_qtd int; v_v1 int; v_v2 int; v_path_v1 text;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Guardar um documento — a v1 nasce com ele';
  r.esperado    := 'Revisar cria a versao 2 preservando a versao 1 (a premissa da assinatura)';
  v_doc := public.qa_novo_documento('[QA] termo.pdf');

  SELECT storage_path INTO v_path_v1
  FROM public.documento_versoes WHERE documento_id = v_doc AND versao = 1;

  r.passo_ordem := 2;
  r.passo_acao  := 'Documento assinado chega: gravar o novo arquivo (revisao)';
  INSERT INTO public.documento_versoes
    (tenant_id, documento_id, versao, nome_original, storage_path, tamanho, mime_type, motivo_revisao)
  VALUES (v_t, v_doc, 2, '[QA] termo_assinado.pdf', 'qa/termo_v2_assinado.pdf', 2048,
          'application/pdf', 'Versao assinada');

  r.passo_ordem := 3;
  r.passo_acao  := 'Tentar forcar uma SEGUNDA versao 1 (o defeito do DOC-030)';
  INSERT INTO public.documento_versoes
    (tenant_id, documento_id, versao, nome_original, storage_path, tamanho, mime_type)
  VALUES (v_t, v_doc, 1, '[QA] termo_falso.pdf', 'qa/termo_v1_falso.pdf', 512, 'application/pdf');

  r.passo_ordem := 4;
  r.passo_acao  := 'Conferir: v1 unica e preservada, v2 assinada';
  SELECT count(*) INTO v_qtd FROM public.documento_versoes WHERE documento_id = v_doc;
  SELECT count(*) INTO v_v1  FROM public.documento_versoes WHERE documento_id = v_doc AND versao = 1;
  SELECT count(*) INTO v_v2  FROM public.documento_versoes WHERE documento_id = v_doc AND versao = 2;

  IF v_v1 = 1 AND v_v2 = 1
     AND (SELECT storage_path FROM public.documento_versoes
           WHERE documento_id = v_doc AND versao = 1) IS NOT DISTINCT FROM v_path_v1 THEN
    r.situacao := 'passou';
    r.obtido   := format('v1 unica e intacta, v2 assinada. A tentativa de sobrescrever a v1 virou '
                      || 'versao %s em vez de duplicar. Total de versoes: %s.', v_qtd, v_qtd);
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('Esperava v1 unica e preservada. Total=%s, v1=%s, v2=%s.', v_qtd, v_v1, v_v2);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;
