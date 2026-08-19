-- ============================================================================
-- ENTREGA — ONDA 5 (parte 5): liquidacao do saldo de banco na rescisao
-- Alvos: ponto_banco_liquidar_rescisao (nova); gatilho no desligamento (admissoes)
-- PONTO-173
--
-- O desligamento nao conversava com o banco de horas: o colaborador desligado
-- com saldo positivo perdia o registro. A CLT art. 59, §3º manda pagar as horas
-- nao compensadas na rescisao, sobre a REMUNERACAO DA DATA DA RESCISAO. Passa a
-- existir a funcao de liquidacao e um gatilho no desligamento que a dispara —
-- blindado: falha na liquidacao NAO quebra o desligamento.
--
-- GARANTIAS
--   · Nao altera o motor de saldo nem a apuracao; so le o banco e registra a
--     liquidacao (movimentacao liquidacao_rescisao). Idempotente; saldo
--     zero/negativo nao gera credito. Nada e apagado.
--   · Um unico gatilho, na tabela admissoes (que ja tem varios gatilhos de
--     desligamento). lock_timeout curto para a criacao do gatilho.
-- Aditivo e idempotente (CREATE OR REPLACE; DROP TRIGGER IF EXISTS + CREATE).
-- ============================================================================
SET lock_timeout = '10s';

-- (1) Liquidação do saldo -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.ponto_banco_liquidar_rescisao(
  p_tenant_id       uuid,
  p_colaborador_cpf text,
  p_data_rescisao   date DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cpf   text := regexp_replace(COALESCE(p_colaborador_cpf, ''), '[^0-9]', '', 'g');
  v_data  date := COALESCE(p_data_rescisao, CURRENT_DATE);
  v_banco RECORD;
  v_min   int;
BEGIN
  -- Saldo final = saldo da ULTIMA competência (o saldo do banco carrega adiante
  -- via saldo_anterior).
  SELECT * INTO v_banco
  FROM public.ponto_banco_horas
  WHERE tenant_id = p_tenant_id
    AND regexp_replace(colaborador_cpf, '[^0-9]', '', 'g') = v_cpf
  ORDER BY competencia DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN 0;  -- sem banco (sem regime): nada a liquidar
  END IF;

  v_min := COALESCE(v_banco.saldo_atual_minutos, 0);
  IF v_min <= 0 THEN
    RETURN 0;  -- saldo zero/negativo não gera crédito rescisório
  END IF;

  -- Idempotente: não liquida o mesmo banco duas vezes.
  IF EXISTS (
    SELECT 1 FROM public.ponto_banco_horas_movimentacoes m
    WHERE m.banco_horas_id = v_banco.id AND m.tipo = 'liquidacao_rescisao'
  ) THEN
    RETURN 0;
  END IF;

  INSERT INTO public.ponto_banco_horas_movimentacoes
    (tenant_id, banco_horas_id, colaborador_cpf, data_referencia, tipo, minutos, descricao, origem)
  VALUES (
    p_tenant_id, v_banco.id, v_banco.colaborador_cpf, v_data, 'liquidacao_rescisao', v_min,
    format('Liquidacao do saldo de banco de horas na rescisao (%s min): pagar como horas nao '
        || 'compensadas sobre a REMUNERACAO DA DATA DA RESCISAO (CLT art. 59, §3º).', v_min),
    'rescisao'
  );

  -- Marca o saldo como liquidado (preserva o registro; documenta a quitacao).
  UPDATE public.ponto_banco_horas
  SET observacoes = COALESCE(observacoes, '')
        || format(' [Liquidado na rescisao em %s: %s min a pagar na folha]', v_data, v_min),
      updated_at = now()
  WHERE id = v_banco.id;

  RETURN v_min;
END;
$$;

COMMENT ON FUNCTION public.ponto_banco_liquidar_rescisao(uuid, text, date) IS
  'Liquida o saldo positivo do banco de horas na rescisao: registra a movimentacao liquidacao_rescisao com os minutos a pagar sobre a remuneracao da data da rescisao (CLT art. 59, §3º). Idempotente; saldo zero/negativo nao gera credito.';

-- (2) Gatilho no desligamento (blindado) -------------------------------------
CREATE OR REPLACE FUNCTION public.ponto_banco_liquidar_rescisao_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_desligou boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_desligou := (NEW.status::text = 'desligado' OR NEW.data_desligamento IS NOT NULL);
  ELSE
    v_desligou := (NEW.status::text = 'desligado' AND COALESCE(OLD.status::text, '') <> 'desligado')
               OR (NEW.data_desligamento IS NOT NULL AND OLD.data_desligamento IS NULL);
  END IF;

  IF v_desligou AND NEW.tenant_id IS NOT NULL AND NEW.cpf IS NOT NULL THEN
    BEGIN
      PERFORM public.ponto_banco_liquidar_rescisao(NEW.tenant_id, NEW.cpf, NEW.data_desligamento);
    EXCEPTION WHEN OTHERS THEN
      -- Nunca quebra o desligamento por causa da liquidacao do banco.
      RAISE NOTICE 'Liquidacao de banco na rescisao falhou para % (%): %', NEW.cpf, NEW.tenant_id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ponto_banco_liquidar_rescisao ON public.admissoes;
CREATE TRIGGER trg_ponto_banco_liquidar_rescisao
  AFTER INSERT OR UPDATE ON public.admissoes
  FOR EACH ROW EXECUTE FUNCTION public.ponto_banco_liquidar_rescisao_trg();

COMMENT ON FUNCTION public.ponto_banco_liquidar_rescisao_trg() IS
  'No desligamento (admissoes -> status desligado / data_desligamento): liquida o saldo do banco de horas para a rescisao. Blindado — falha aqui nao quebra o desligamento. CLT art. 59, §3º.';

-- ---------------------------------------------------------------------------
-- CONFERENCIA — o SQL Editor mostra apenas o ultimo resultado.
-- Esperado: t | t | OK
--   funcao_existe  : t  (ponto_banco_liquidar_rescisao)
--   gatilho_existe : t  (trg_ponto_banco_liquidar_rescisao em admissoes)
-- ---------------------------------------------------------------------------
SELECT
  (to_regprocedure('public.ponto_banco_liquidar_rescisao(uuid,text,date)') IS NOT NULL) AS funcao_existe,
  (EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_ponto_banco_liquidar_rescisao'
     AND tgrelid='public.admissoes'::regclass AND NOT tgisinternal))                     AS gatilho_existe,
  CASE WHEN to_regprocedure('public.ponto_banco_liquidar_rescisao(uuid,text,date)') IS NOT NULL
        AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_ponto_banco_liquidar_rescisao'
              AND tgrelid='public.admissoes'::regclass AND NOT tgisinternal)
       THEN 'OK' ELSE 'CONFERIR' END AS erro_tecnico;
