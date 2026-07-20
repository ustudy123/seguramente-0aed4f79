-- =========================================================
-- PONTO x ATESTADO: reverter o espelho ao excluir atestado
--
-- BUG: excluir um atestado não desfazia o efeito dele no espelho. A tela
-- mostrava "Sem marcações", mas seguia contando as horas abonadas e o
-- status "Atestado" (ex.: Vitor Monteiro, 02/06 — 08h41 fantasma).
--
-- CAUSA: existe o trigger justificar_ponto_por_atestado que dispara no
-- INSERT/UPDATE do atestado e grava em ponto_diario:
--   - dias que já existiam (falta/atraso/incompleto) -> status 'justificado'
--   - dias que não existiam                          -> cria com 'justificado'
-- Mas NÃO havia nada no DELETE. O registro em ponto_diario ficava órfão.
-- (O front até apagava atestado, afastamento e alertas, mas não tocava em
-- ponto_diario — e por isso o fantasma resistia mesmo recarregando.)
--
-- CORREÇÃO: trigger AFTER DELETE que, no intervalo do atestado apagado,
-- reverte ponto_diario. Como o trigger de INSERT sobrescreveu o status
-- anterior sem guardá-lo, a reversão segura é RECONSOLIDAR o dia a partir
-- das batidas reais:
--   - tem batida no dia  -> reconsolida (a função redecide o status real)
--   - não tem batida     -> remove o registro justificado (ele só existia
--                           por causa do atestado)
--
-- Só age em dias marcados como 'justificado' cuja observação aponta para
-- atestado — não encosta em férias, folga ou justificativa de outra origem.
-- =========================================================

CREATE OR REPLACE FUNCTION public.reverter_ponto_por_atestado_excluido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_data_inicio date;
  v_data_fim    date;
  v_dia         date;
  v_tem_batida  boolean;
BEGIN
  -- Só atestados que afetaram o ponto têm data de afastamento.
  IF OLD.data_inicio_afastamento IS NULL THEN
    RETURN OLD;
  END IF;

  v_data_inicio := OLD.data_inicio_afastamento::date;
  v_data_fim    := COALESCE(
    OLD.data_fim_afastamento::date,
    v_data_inicio + COALESCE(OLD.dias_afastamento, 1) - 1
  );

  v_dia := v_data_inicio;
  WHILE v_dia <= v_data_fim LOOP
    -- Havia marcação real de ponto nesse dia?
    SELECT EXISTS (
      SELECT 1 FROM public.ponto_marcacoes
      WHERE tenant_id = OLD.tenant_id
        AND colaborador_cpf = OLD.colaborador_cpf
        AND data_marcacao = v_dia
    ) INTO v_tem_batida;

    IF v_tem_batida THEN
      -- Deixa o motor de cálculo redecidir o status a partir das batidas.
      PERFORM public.consolidar_ponto_diario_manual(
        OLD.tenant_id, OLD.colaborador_cpf, v_dia
      );
    ELSE
      -- Sem batida, o registro 'justificado' só existia por causa do
      -- atestado. Remove — mas apenas se a marca for de atestado, para não
      -- apagar justificativa de outra origem (férias, folga, etc.).
      DELETE FROM public.ponto_diario
      WHERE tenant_id = OLD.tenant_id
        AND colaborador_cpf = OLD.colaborador_cpf
        AND data = v_dia
        AND status = 'justificado'
        AND observacao ILIKE '%Atestado médico%';
    END IF;

    v_dia := v_dia + 1;
  END LOOP;

  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_reverter_ponto_atestado ON public.atestados;
CREATE TRIGGER trigger_reverter_ponto_atestado
  AFTER DELETE ON public.atestados
  FOR EACH ROW
  EXECUTE FUNCTION public.reverter_ponto_por_atestado_excluido();

-- ---------------------------------------------------------
-- Verificação
-- ---------------------------------------------------------
DO $verifica$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trigger_reverter_ponto_atestado'
      AND tgrelid = 'public.atestados'::regclass
  ) THEN
    RAISE EXCEPTION 'FALHOU: trigger de reversão não foi criado.';
  END IF;
  RAISE NOTICE 'OK: exclusão de atestado passa a reverter o espelho.';
END $verifica$;
