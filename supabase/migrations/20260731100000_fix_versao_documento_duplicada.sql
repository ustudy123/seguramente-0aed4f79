-- ============================================================================
-- FIX — trigger de versionamento duplicava a v1 (regressão do DOC-030)
--
-- A trigger registrar_versao_documento() foi instalada em 30/07 assumindo que
-- nada mais escrevia em documento_versoes. Errado: useDocumentos.ts já insere a
-- versão explicitamente (linhas 212 e 404). Resultado: cada documento novo
-- ganhava DUAS v1 — uma da trigger, outra do app.
--
-- O DOC-030 pegou exatamente isso: "Esperava 2 versões (v1+v2). Total=3, v1=2".
--
-- Correção: a trigger só grava se ainda NÃO existir versão com aquele mesmo
-- storage_path. Assim ela cobre os caminhos que não versionam (importação,
-- edge function, SQL direto) e sai da frente quando o app já fez o trabalho.
-- ============================================================================

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

  -- No update, só age quando o arquivo realmente mudou.
  IF TG_OP = 'UPDATE' AND NEW.storage_path IS NOT DISTINCT FROM OLD.storage_path THEN
    RETURN NEW;
  END IF;

  -- IDEMPOTÊNCIA: se já existe versão apontando para este arquivo, o app (ou a
  -- reconciliação) já registrou. Não duplica.
  IF EXISTS (
    SELECT 1 FROM public.documento_versoes
     WHERE documento_id = NEW.id
       AND storage_path = NEW.storage_path
  ) THEN
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


-- Limpa as v1 duplicadas que a versão anterior da trigger criou entre a
-- instalação (30/07) e esta correção. Mantém a mais antiga de cada par.
DELETE FROM public.documento_versoes v
 WHERE EXISTS (
   SELECT 1 FROM public.documento_versoes v2
    WHERE v2.documento_id = v.documento_id
      AND v2.storage_path = v.storage_path
      AND v2.versao       = v.versao
      AND v2.created_at   < v.created_at
 );
