-- ============================================================================
-- ONDA 11 (parte 1) — Atestado acima de 15 dias encaminha ao INSS (ESC-010)
--
-- O atestado longo muda de natureza no 16º dia: até 15 dias a empresa abona
-- (auxílio-doença pago pelo empregador); do 16º em diante é benefício
-- previdenciário (INSS) — Lei 8.213, arts. 59-60. Hoje um atestado de 20 dias
-- entra e NENHUM afastamento nasce: a passagem de bastão do 16º dia depende de
-- alguém LEMBRAR de abrir o afastamento noutro módulo. Esquecer é seguir
-- "abonando" por conta da empresa o que é do INSS.
--
-- O QUE FAZ (aditivo): um gatilho BEFORE INSERT em atestados que, quando o
-- período de afastamento passa de 15 dias e o atestado ainda não tem afastamento
-- vinculado, CRIA o afastamento previdenciário (status beneficio_inss, começando
-- no 16º dia), VINCULA em atestados.afastamento_id e ALERTA o DP — uma única vez.
-- A criação do afastamento é defensiva (EXCEPTION → NOTICE): qualquer falha na
-- cadeia de gatilhos de afastamentos NÃO quebra o registro do atestado.
--
-- GARANTIAS: não altera o motor de saldo, a apuração, o espelho nem o fechamento.
-- Só faz a ponte atestado→afastamentos. Aditivo e idempotente (só age quando
-- afastamento_id é nulo). SET lock_timeout na criação do gatilho.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ponto_atestado_encaminhar_afastamento()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_dias   integer;
  v_dia16  date;
  v_afast  uuid;
BEGIN
  -- Só faz a ponte quando o atestado ainda não tem afastamento vinculado.
  IF NEW.afastamento_id IS NOT NULL OR NEW.data_inicio_afastamento IS NULL THEN
    RETURN NEW;
  END IF;

  v_dias := COALESCE(NEW.dias_afastamento,
                     (NEW.data_fim_afastamento - NEW.data_inicio_afastamento + 1),
                     0);

  -- Até 15 dias: abono da empresa; nada a encaminhar.
  IF v_dias <= 15 THEN
    RETURN NEW;
  END IF;

  v_dia16 := NEW.data_inicio_afastamento + 15;  -- 16º dia: início do benefício INSS

  BEGIN
    INSERT INTO public.afastamentos
      (tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
       data_inicio, data_fim, data_atestado, status, tipo_principal_new, observacoes)
    VALUES
      (NEW.tenant_id, NEW.empresa_id, NEW.colaborador_id, NEW.colaborador_nome, NEW.colaborador_cpf,
       v_dia16, NEW.data_fim_afastamento, NEW.data_emissao, 'beneficio_inss', 'beneficio_b31',
       'Encaminhamento previdenciario automatico — atestado acima de 15 dias (Lei 8.213, arts. 59-60). '
       || 'Empresa abona os primeiros 15 dias; do 16o dia em diante e beneficio do INSS (auxilio-doenca B31).')
    RETURNING id INTO v_afast;

    NEW.afastamento_id := v_afast;

    -- Alerta ao DP (idempotente por atestado nao se aplica aqui — 1 por insert).
    INSERT INTO public.ponto_alertas
      (tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
       tipo, severidade, titulo, descricao, data_referencia)
    VALUES
      (NEW.tenant_id, NEW.empresa_id, NULL, NEW.colaborador_nome, NEW.colaborador_cpf,
       'atestado_encaminhado_inss', 'alta',
       'Atestado acima de 15 dias encaminhado ao INSS',
       format('O atestado de %s dias de %s (inicio %s) passou dos 15 dias abonados pela empresa. '
           || 'Foi criado o afastamento previdenciario a partir do 16o dia (%s), status beneficio_inss. '
           || 'Confira a documentacao e o encaminhamento ao INSS (Lei 8.213, arts. 59-60).',
           v_dias, COALESCE(NEW.colaborador_nome,'-'), NEW.data_inicio_afastamento, v_dia16),
       v_dia16);
  EXCEPTION WHEN OTHERS THEN
    -- A ponte nunca quebra o registro do atestado; fica o aviso para tratamento manual.
    RAISE NOTICE 'Nao foi possivel encaminhar o afastamento automaticamente (%). O atestado foi registrado; abra o afastamento no modulo Afastamentos.', SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.ponto_atestado_encaminhar_afastamento() IS
  'Atestado acima de 15 dias: cria o afastamento previdenciario (beneficio_inss) a partir do 16o dia, vincula em atestados.afastamento_id e alerta o DP (Lei 8.213, arts. 59-60). Uma unica vez; defensivo. ESC-010.';

DO $trg$
BEGIN
  SET LOCAL lock_timeout = '10s';
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
                 WHERE tgname = 'trg_ponto_atestado_encaminha_inss'
                   AND tgrelid = 'public.atestados'::regclass AND NOT tgisinternal) THEN
    CREATE TRIGGER trg_ponto_atestado_encaminha_inss
      BEFORE INSERT ON public.atestados
      FOR EACH ROW EXECUTE FUNCTION public.ponto_atestado_encaminhar_afastamento();
  END IF;
END $trg$;
