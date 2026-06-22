-- FIX: batida ao vivo barrada quando a entrada do dia veio de AJUSTE
--
-- Sintoma (Kailaine): colaboradora tem a entrada do dia como
-- marcacao_original = false (lançada por ajuste / resíduo de migração de
-- tenant). Ao tentar registrar a SAÍDA pelo link, o sistema recusava com
-- "A primeira marcação do dia deve ser uma ENTRADA".
--
-- Causa: registrar_ponto_externo e proximo_tipo_marcacao_externo leem as
-- marcações do dia SEM filtrar marcacao_original (enxergam a entrada
-- ajustada -> próximo tipo = saída), mas o trigger validar_sequencia_marcacao
-- só considerava marcacao_original = true. A entrada ajustada era ignorada,
-- o trigger achava o dia vazio e barrava a saída.
--
-- Correção: a alternância / "primeira marcação" passa a considerar TODAS as
-- marcações do dia (original + ajustada), pois uma entrada ajustada também
-- faz parte da sequência. O anti-toque-duplo (proteção de device) continua
-- olhando só as batidas reais (marcacao_original = true).

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
BEGIN
  -- Ajustes aprovados (marcacao_original = false) entram sem validação
  IF NEW.marcacao_original = false THEN
    RETURN NEW;
  END IF;

  -- Anti-toque-duplo (10 min): só contra batidas REAIS de device
  SELECT hora_marcacao INTO v_ultima_orig
  FROM public.ponto_marcacoes
  WHERE tenant_id = NEW.tenant_id
    AND colaborador_cpf = NEW.colaborador_cpf
    AND data_marcacao = NEW.data_marcacao
    AND marcacao_original = true
  ORDER BY hora_marcacao DESC, created_at DESC
  LIMIT 1;

  IF v_ultima_orig.hora_marcacao IS NOT NULL
     AND NEW.hora_marcacao - v_ultima_orig.hora_marcacao < interval '10 minutes'
     AND NEW.hora_marcacao >= v_ultima_orig.hora_marcacao THEN
    RAISE EXCEPTION 'Sua marcação anterior já foi registrada com sucesso ✓ Por segurança, aguarde alguns minutos antes da próxima batida.';
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
