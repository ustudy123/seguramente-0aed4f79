-- ============================================================================
-- ONDA 8 (parte 4) — Sistema alternativo (REP-A) só com instrumento coletivo
-- PONTO-213
--
-- O sistema alternativo de controle de jornada (REP-A: registro por link/app) é
-- admitido APENAS quando autorizado por convenção ou acordo coletivo (Portaria
-- MTP 671/2021; CLT art. 74, §4º). Hoje o modo 'link_externo' podia ser ativado
-- sem NENHUM lastro documental — e registro alternativo sem autorização invalida
-- o controle perante a fiscalização.
--
-- O QUE FAZ (aditivo): espelha a trava que já existe para o registro por exceção
-- (ponto_validar_acordo_excecao). Ativar modo_registro='link_externo' passa a
-- exigir autorização — o documento do instrumento coletivo anexado
-- (link_externo_acordo_url) OU um acordo coletivo vigente em ponto_acordos. Sem
-- isso, a ativação é RECUSADA (não cria/atualiza a configuração).
--
-- GARANTIAS: não altera o motor de saldo, o espelho nem o fechamento. Só valida a
-- ativação do modo alternativo. Modos 'interno' e 'ambos' não são afetados.
-- Aditivo e idempotente; o gatilho só dispara quando se mexe no modo/autorização.
-- ============================================================================

ALTER TABLE public.ponto_configuracao
  ADD COLUMN IF NOT EXISTS link_externo_acordo_url text;

COMMENT ON COLUMN public.ponto_configuracao.link_externo_acordo_url IS
  'Documento do instrumento coletivo (CCT/ACT) que autoriza o sistema alternativo de registro (REP-A, link externo), exigido pela Portaria 671 / CLT art. 74, §4. Alternativa ao acordo vigente em ponto_acordos.';

CREATE OR REPLACE FUNCTION public.ponto_validar_rep_alternativo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Só valida quando se ATIVA/altera o modo alternativo ou a sua autorização.
  IF TG_OP = 'INSERT'
     OR NEW.modo_registro IS DISTINCT FROM OLD.modo_registro
     OR NEW.link_externo_acordo_url IS DISTINCT FROM OLD.link_externo_acordo_url THEN

    IF COALESCE(NEW.modo_registro, '') = 'link_externo'
       AND btrim(COALESCE(NEW.link_externo_acordo_url, '')) = ''
       AND NOT EXISTS (
         SELECT 1 FROM public.ponto_acordos ac
         WHERE ac.tenant_id = NEW.tenant_id
           AND COALESCE(ac.ativo, false) = true
           AND (ac.vigencia_inicio IS NULL OR ac.vigencia_inicio <= CURRENT_DATE)
           AND (ac.vigencia_fim   IS NULL OR ac.vigencia_fim   >= CURRENT_DATE)
           AND (ac.tipo ILIKE '%alternativ%' OR ac.tipo ILIKE '%rep%a%'
                OR ac.tipo ILIKE '%link%' OR ac.tipo ILIKE '%jornada%'
                OR ac.tipo ILIKE '%cct%'  OR ac.tipo ILIKE '%act%'
                OR ac.tipo ILIKE '%conven%' OR ac.tipo ILIKE '%coletiv%')
       ) THEN
      RAISE EXCEPTION
        'Sistema alternativo de registro (REP-A, link externo) exige autorizacao em acordo ou instrumento coletivo (Portaria 671; CLT art. 74, §4): anexe o instrumento coletivo (link_externo_acordo_url) ou cadastre um acordo vigente antes de ativar o modo.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DO $trg$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
                 WHERE tgname='trg_ponto_validar_rep_alternativo'
                   AND tgrelid='public.ponto_configuracao'::regclass AND NOT tgisinternal) THEN
    CREATE TRIGGER trg_ponto_validar_rep_alternativo
      BEFORE INSERT OR UPDATE OF modo_registro, link_externo_acordo_url
      ON public.ponto_configuracao
      FOR EACH ROW EXECUTE FUNCTION public.ponto_validar_rep_alternativo();
  END IF;
END $trg$;

COMMENT ON FUNCTION public.ponto_validar_rep_alternativo() IS
  'Recusa ativar o modo de registro alternativo (link_externo/REP-A) sem autorizacao coletiva — documento anexado ou acordo vigente em ponto_acordos (Portaria 671; CLT art. 74, §4). Espelha a trava do registro por excecao. PONTO-213.';
