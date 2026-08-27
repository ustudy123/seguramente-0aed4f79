-- =====================================================================
-- Correções apontadas pela bateria rodando na HOMOLOGAÇÃO (PONTO-354)
--
-- O caso PONTO-354 quebrava em qualquer base com dado de cliente:
--
--   QA BLOQUEADO: modo de teste ligado. Operacao UPDATE em
--   public.ponto_banco_horas tentou tocar o tenant 83f1b040-...
--   Permitido apenas os cercados. Transacao abortada.
--
-- A trava do cercado funcionou — o problema é do teste. Ele chama
-- converter_banco_horas_vencido(), que é global: varre TODOS os tenants.
-- Numa base sem dado de cliente (o ambiente de teste) isso nunca aparece;
-- numa base com dado de cliente (homologação, produção) o teste tenta
-- tocar linha de terceiro e a trava aborta, como deve.
--
-- Consequência: o caso era INEXECUTÁVEL justamente onde a bancada mais
-- precisa rodar. A rotina passa a aceitar um tenant OPCIONAL. Sem
-- argumento o comportamento é idêntico ao de hoje (todos os tenants);
-- com argumento, só aquele — e o caso escopa a conversão no cercado.
--
-- (O PONTO-191 não entra aqui: a versão correta da verificação já está
-- no repositório; o que divergiu foi o que a produção recebeu. Isso vive
-- no script de entrega docs/script_ponto_correcoes_bateria_homologacao.sql.)
--
-- NOTA: converter_banco_horas_vencido não está agendada em lugar nenhum —
-- nem cron, nem tela, nem outra função. Na prática, saldo vencido não é
-- convertido sozinho. É decisão de produto, fora do escopo desta correção.
-- =====================================================================

DROP FUNCTION IF EXISTS public.converter_banco_horas_vencido();

CREATE OR REPLACE FUNCTION public.converter_banco_horas_vencido(p_tenant uuid DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_banco RECORD;
BEGIN
  FOR v_banco IN
    SELECT * FROM public.ponto_banco_horas
    WHERE convertido_extras = FALSE
      AND prazo_compensacao IS NOT NULL
      AND prazo_compensacao < CURRENT_DATE
      AND saldo_atual_minutos > 0
      -- Sem argumento, o comportamento e o de sempre: todos os tenants.
      -- Com argumento, so aquele — e a bancada de QA consegue exercitar a
      -- conversao dentro do cercado, sem tentar tocar dado de cliente.
      AND (p_tenant IS NULL OR tenant_id = p_tenant)
  LOOP
    -- Mark as converted
    UPDATE public.ponto_banco_horas
    SET convertido_extras = TRUE,
        data_conversao = CURRENT_DATE,
        observacoes = COALESCE(observacoes, '') || ' [Convertido automaticamente em HE em ' || CURRENT_DATE::TEXT || '. Saldo: ' || v_banco.saldo_atual_minutos || ' min]'
    WHERE id = v_banco.id;

    -- Register conversion movement
    INSERT INTO public.ponto_banco_horas_movimentacoes (
      tenant_id, banco_horas_id, colaborador_cpf, data_referencia, tipo, minutos, descricao
    ) VALUES (
      v_banco.tenant_id, v_banco.id, v_banco.colaborador_cpf, CURRENT_DATE,
      'conversao_he', v_banco.saldo_atual_minutos,
      'Conversão automática: prazo de compensação vencido em ' || v_banco.prazo_compensacao::TEXT
    );
  END LOOP;
END;
$function$;

COMMENT ON FUNCTION public.converter_banco_horas_vencido(uuid) IS
  'Converte em horas extras o saldo de banco de horas com prazo de compensacao vencido. Sem argumento: todos os tenants (comportamento historico). Com argumento: apenas aquele tenant — o que permite a bancada de QA exercitar a conversao dentro do cercado, sem tocar dado de cliente. PONTO-354.';

CREATE OR REPLACE FUNCTION public.qa_caso_ponto_354()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_cpf text := public.qa_cpf(3541);
  v_apuracao_preenche boolean;
  v_convertido boolean;
  v_mov int;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a apuração do banco preenche o prazo de compensação?';
  r.esperado := 'apurar_banco_horas* deriva prazo_compensacao da configuração do regime (6m/12m)';

  SELECT bool_or(p.prosrc ILIKE '%prazo_compensacao%') INTO v_apuracao_preenche
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('apurar_banco_horas', 'apurar_banco_horas_colaborador');

  r.passo_ordem := 2;
  r.passo_acao := 'Semear saldo de 120 min com prazo vencido ontem e rodar a conversão automática';
  r.esperado := 'O saldo vencido vira hora extra: convertido_extras = true + movimentação de conversão';

  INSERT INTO public.ponto_banco_horas
    (tenant_id, colaborador_id, colaborador_nome, colaborador_cpf, tipo,
     competencia, saldo_anterior_minutos, creditos_minutos, debitos_minutos,
     compensados_minutos, saldo_atual_minutos, convertido_extras, prazo_compensacao)
  VALUES (public.qa_sandbox_tenant_id(), v_cpf, 'QA Vencimento Banco', v_cpf, 'mensal',
          to_char(CURRENT_DATE - INTERVAL '1 month', 'YYYY-MM'), 0, 120, 0, 0, 120,
          false, CURRENT_DATE - 1);

  PERFORM public.converter_banco_horas_vencido(public.qa_sandbox_tenant_id());

  SELECT b.convertido_extras,
         (SELECT count(*) FROM public.ponto_banco_horas_movimentacoes m
           WHERE m.banco_horas_id = b.id AND m.tipo = 'conversao_he')
    INTO v_convertido, v_mov
  FROM public.ponto_banco_horas b
  WHERE b.tenant_id = public.qa_sandbox_tenant_id() AND b.colaborador_cpf = v_cpf;

  IF NOT coalesce(v_convertido, false) OR coalesce(v_mov, 0) = 0 THEN
    r.situacao := 'falhou';
    r.obtido := format('A conversão de saldo vencido não funcionou nem com o prazo semeado à mão '
             || '(convertido=%s, movimentações=%s). O saldo que passa do prazo legal precisa virar '
             || 'hora extra a pagar.', coalesce(v_convertido::text, 'NULL'), coalesce(v_mov, 0));
  ELSIF NOT coalesce(v_apuracao_preenche, false) THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o mecanismo de conversão existe e funciona QUANDO o prazo está na linha '
             || '(o teste semeou o prazo à mão e o saldo foi convertido) — mas a APURAÇÃO nunca '
             || 'preenche prazo_compensacao. A configuração do regime até guarda '
             || 'prazo_compensacao_dias (ponto_banco_horas_config), só que nenhuma função de '
             || 'apuração a consulta. Resultado prático: nenhum saldo tem vencimento, a conversão '
             || 'automática nunca encontra o que converter, e saldos de banco individual passam '
             || 'dos 6 meses do art. 59, §5º (ou dos 12 meses do §2º) sem virar hora extra. '
             || 'Correção: ao apurar a competência, gravar prazo_compensacao = fim da competência '
             || '+ prazo_compensacao_dias do regime vigente.';
    r.detalhe := jsonb_build_object('conversao_funciona', true,
                                    'apuracao_preenche_prazo', false);
  ELSE
    r.situacao := 'passou';
    r.obtido := 'A apuração deriva o prazo do regime e a conversão de saldo vencido funciona.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $function$
;
