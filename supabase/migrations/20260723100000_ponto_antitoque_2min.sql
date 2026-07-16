-- =========================================================
-- PONTO: anti-toque-duplo — 10 min → 2 min, com tempo real na mensagem
--
-- MUDANÇA 1 — janela de 10 para 2 minutos.
--   A proteção existe contra toque duplo acidental no device (a pessoa
--   aperta duas vezes sem querer). Para isso, 2 minutos bastam.
--   10 minutos barrava jornada curta legítima — entra e sai rápido
--   (entrega, visita técnica, motoboy) — e empurrava o colaborador para
--   o ajuste manual com justificativa "falha no aplicativo". Ou seja: a
--   regra estava FABRICANDO parte dos ajustes que fomos investigar.
--
-- MUDANÇA 2 — a mensagem passa a dizer quanto falta, de verdade.
--   Antes: "aguarde alguns minutos" — o colaborador não sabia se eram 2
--   ou 15, e ficava tentando. Agora o banco calcula os segundos que
--   restam e diz o número.
--
-- O RESTO DA FUNÇÃO É IDÊNTICO à versão vigente
-- (20260722150000_fix_validar_sequencia_considera_ajustadas.sql):
--   * ajuste aprovado (marcacao_original = false) segue entrando sem
--     validação;
--   * a alternância / "primeira marcação do dia" segue considerando
--     TODAS as marcações (original + ajustada) — o fix da Kailaine;
--   * o anti-toque-duplo segue olhando só batidas reais de device.
-- =========================================================

CREATE OR REPLACE FUNCTION public.validar_sequencia_marcacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ultima RECORD;       -- última marcação do dia (qualquer origem) -> alternância
  v_ultima_orig RECORD;  -- última marcação ORIGINAL -> anti-toque-duplo
  v_classe_nova TEXT;
  v_classe_ultima TEXT;
  v_faltam_seg INT;
  v_janela CONSTANT interval := interval '2 minutes';
BEGIN
  -- Ajustes aprovados (marcacao_original = false) entram sem validação
  IF NEW.marcacao_original = false THEN
    RETURN NEW;
  END IF;

  -- Anti-toque-duplo (2 min): só contra batidas REAIS de device
  SELECT hora_marcacao INTO v_ultima_orig
  FROM public.ponto_marcacoes
  WHERE tenant_id = NEW.tenant_id
    AND colaborador_cpf = NEW.colaborador_cpf
    AND data_marcacao = NEW.data_marcacao
    AND marcacao_original = true
  ORDER BY hora_marcacao DESC, created_at DESC
  LIMIT 1;

  IF v_ultima_orig.hora_marcacao IS NOT NULL
     AND NEW.hora_marcacao - v_ultima_orig.hora_marcacao < v_janela
     AND NEW.hora_marcacao >= v_ultima_orig.hora_marcacao THEN
    -- Quanto falta, em segundos (arredondado para cima: 0,4s vira 1s)
    v_faltam_seg := CEIL(
      EXTRACT(EPOCH FROM (v_janela - (NEW.hora_marcacao - v_ultima_orig.hora_marcacao)))
    );
    RAISE EXCEPTION
      'Sua marcação anterior já foi registrada com sucesso ✓ Aguarde % segundos para registrar a próxima batida.',
      v_faltam_seg;
  END IF;

  -- Alternância / primeira marcação: considera TODAS (original + ajustada)
  SELECT hora_marcacao, tipo_marcacao INTO v_ultima
  FROM public.ponto_marcacoes
  WHERE tenant_id = NEW.tenant_id
    AND colaborador_cpf = NEW.colaborador_cpf
    AND data_marcacao = NEW.data_marcacao
  ORDER BY hora_marcacao DESC, created_at DESC
  LIMIT 1;

  IF v_ultima.hora_marcacao IS NOT NULL THEN
    v_classe_ultima := COALESCE(public.ponto_classifica_tipo(v_ultima.tipo_marcacao), 'in');
    v_classe_nova := public.ponto_classifica_tipo(NEW.tipo_marcacao);
    IF v_classe_nova IS NOT NULL AND v_classe_nova = v_classe_ultima THEN
      IF v_classe_nova = 'in' THEN
        RAISE EXCEPTION 'Você já está com a jornada em aberto (última marcação foi uma entrada). A próxima marcação deve ser uma SAÍDA.';
      ELSE
        RAISE EXCEPTION 'Sua jornada já está fechada (última marcação foi uma saída). A próxima marcação deve ser uma ENTRADA.';
      END IF;
    END IF;
  ELSE
    IF public.ponto_classifica_tipo(NEW.tipo_marcacao) = 'out' THEN
      RAISE EXCEPTION 'A primeira marcação do dia deve ser uma ENTRADA.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------
-- Verificação (a lição de ontem: função instalada ≠ confirmada)
-- ---------------------------------------------------------
DO $verifica$
DECLARE v_ok boolean;
BEGIN
  SELECT prosrc LIKE '%interval ''2 minutes''%' AND prosrc LIKE '%Aguarde % segundos%'
    INTO v_ok
  FROM pg_proc WHERE proname = 'validar_sequencia_marcacao';

  IF v_ok THEN
    RAISE NOTICE 'OK: janela de 2 minutos aplicada e mensagem com tempo real.';
  ELSE
    RAISE EXCEPTION 'FALHOU: validar_sequencia_marcacao não ficou com a nova regra.';
  END IF;
END $verifica$;
