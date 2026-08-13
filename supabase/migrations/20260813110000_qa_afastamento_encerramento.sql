-- =====================================================================
-- QA · Afastamento tem que terminar (AFAST-001 a 003)
--
-- Guarda permanente sobre a correção de 13/08. O defeito que motivou tudo
-- não foi um erro de digitação: foi a AUSÊNCIA de um encerramento. Nada
-- no sistema fechava um afastamento, e ninguém percebeu por meses porque
-- não havia nada vigiando. Estas três rotinas passam a vigiar.
--
-- Rodam no cercado de QA e são desfeitas ao final, como todas as outras.
-- =====================================================================

SET lock_timeout = '10s';

-- ── Catálogo ─────────────────────────────────────────────────────────
DO $doc$
DECLARE v_mod uuid;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos WHERE path = 'jornada-rotina/afastamentos';
  IF v_mod IS NULL THEN
    RAISE EXCEPTION 'Módulo jornada-rotina/afastamentos não encontrado.';
  END IF;

  INSERT INTO public.qa_casos_teste
    (modulo_id, codigo, titulo, tipo, prioridade, status, nivel,
     base_legal, objetivo, pre_condicoes, passos, resultado_esperado, observacoes)
  VALUES

  (v_mod, 'AFAST-001', 'Afastamento com período vencido é encerrado, não fica ativo para sempre',
   'feliz', 'critica', 'aprovado', 'api',
   'Portaria MTP 671/2021 (fidedignidade do registro); eSocial S-2230',
   'Um afastamento cujo período de término já passou não pode continuar contando como ativo. '
   || 'Enquanto conta, ele infla a régua dos 15 dias, o absenteísmo e os painéis de FAP/RAT, e '
   || 'mantém o colaborador impedido de bater ponto.',
   'Afastamento com data de término anterior a hoje.',
   '[{"ordem":1,"acao":"Registrar afastamento já vencido e rodar a rotina de encerramento","resultado_esperado":"Situação passa a encerrado"},
     {"ordem":2,"acao":"Rodar a rotina de novo","resultado_esperado":"Nada muda — rodar duas vezes é seguro"}]'::jsonb,
   'Vencido vira encerrado; a rotina é idempotente.',
   'Achado de 13/08/2026: nenhum trecho do sistema mudava a situação para encerrado. Dos 9 '
   || 'afastamentos abertos na produção, 5 tinham o período vencido e seguiam ativos.'),

  (v_mod, 'AFAST-002', 'Afastamento novo sem data de término é recusado (salvo INSS)',
   'negativo', 'critica', 'aprovado', 'api',
   'CLT art. 60 da Lei 8.213/91 (benefício); Portaria MTP 671/2021',
   'Afastamento sem data de fim é lido pela trava do ponto como término em 31/12/9999 — o '
   || 'colaborador fica impedido de bater ponto por tempo indefinido. Só é legítimo sem fim '
   || 'quando não há previsão de retorno: benefício do INSS, prazo indeterminado ou licença '
   || 'previdenciária.',
   'Nenhuma.',
   '[{"ordem":1,"acao":"Tentar criar afastamento comum sem data de término","resultado_esperado":"Recusado, com mensagem que diz o que fazer"},
     {"ordem":2,"acao":"Criar afastamento de prazo indeterminado sem data de término","resultado_esperado":"Aceito — é o caso legítimo"}]'::jsonb,
   'Comum sem fim é recusado; prazo indeterminado é aceito.',
   'A origem do defeito estava no formulário do atestado: a data de término só era calculada '
   || 'quando a unidade era dias e a quantidade maior que zero. Atestado em horas ou com zero '
   || 'dias gerava afastamento eterno.'),

  (v_mod, 'AFAST-003', 'Preencher a data de término encerra o afastamento na hora',
   'feliz', 'alta', 'aprovado', 'api',
   'Portaria MTP 671/2021',
   'O RH precisa de um caminho de saída que não seja apagar o registro. Ao informar a data de '
   || 'término de um afastamento que já acabou, ele deve encerrar imediatamente, sem esperar a '
   || 'rotina da madrugada — e sem perder o histórico.',
   'Afastamento antigo sem data de término (registro legado).',
   '[{"ordem":1,"acao":"Informar a data de término de um afastamento legado já vencido","resultado_esperado":"Encerra na hora"},
     {"ordem":2,"acao":"Conferir que o registro continua existindo","resultado_esperado":"Histórico preservado, nada apagado"}]'::jsonb,
   'Encerra na hora e preserva o registro.',
   'Antes desta correção o RH excluía o afastamento para liberar a batida — perdendo o '
   || 'histórico de saúde ocupacional junto.')

  ON CONFLICT (codigo) DO UPDATE SET
    titulo             = EXCLUDED.titulo,
    objetivo           = EXCLUDED.objetivo,
    passos             = EXCLUDED.passos,
    resultado_esperado = EXCLUDED.resultado_esperado,
    observacoes        = EXCLUDED.observacoes,
    status             = 'aprovado';
END $doc$;

-- ── Helper: afastamento no cercado ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_afast_novo(
  p_nome text, p_inicio date, p_fim date,
  p_prazo_indeterminado boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.afastamentos
    (tenant_id, colaborador_nome, colaborador_cpf, data_inicio, data_fim,
     status, prazo_indeterminado)
  VALUES (public.qa_sandbox_tenant_id(), p_nome, public.qa_cpf(9101),
          p_inicio, p_fim, 'ativo', p_prazo_indeterminado)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- AFAST-001 — vencido é encerrado
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_caso_afast_001()
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE
  r public.qa_retorno;
  v_id uuid;
  v_st text;
  v_n1 int;
  v_n2 int;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'Registrar afastamento já vencido e rodar a rotina de encerramento';
  r.esperado    := 'A situação passa de ativo para encerrado';

  -- Entra pela porta lateral: o gatilho já encerraria na hora, e aqui
  -- queremos provar que a ROTINA também dá conta do que ficou para trás.
  PERFORM set_config('session_replication_role', 'replica', true);
  v_id := public.qa_afast_novo('QA Vencido', CURRENT_DATE - 40, CURRENT_DATE - 10);
  PERFORM set_config('session_replication_role', 'origin', true);

  SELECT public.afastamento_encerrar_vencidos() INTO v_n1;
  SELECT status::text INTO v_st FROM public.afastamentos WHERE id = v_id;

  IF v_st <> 'encerrado' THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: afastamento com término em %s continua como "%s". Enquanto '
             || 'contar como ativo, ele infla a régua dos 15 dias e o absenteísmo, e mantém o '
             || 'colaborador impedido de bater ponto. O RH só sai disso apagando o registro.',
             to_char(CURRENT_DATE - 10, 'DD/MM/YYYY'), v_st);
    RETURN r;
  END IF;

  r.passo_ordem := 2;
  r.passo_acao  := 'Rodar a rotina de novo';
  r.esperado    := 'Nada muda — rodar duas vezes é seguro';
  SELECT public.afastamento_encerrar_vencidos() INTO v_n2;

  IF v_n2 <> 0 THEN
    r.situacao := 'falhou';
    r.obtido := format('A rotina não é idempotente: na segunda execução ainda encerrou %s '
                    || 'registro(s). Agendada para rodar todo dia, ela precisa ser inócua '
                    || 'quando não há nada a fazer.', v_n2);
    RETURN r;
  END IF;

  r.situacao := 'passou';
  r.obtido := format('Encerrado pela rotina (%s registro na primeira passada, 0 na segunda). '
                  || 'Rodar de novo não mexe em nada.', v_n1);
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- AFAST-002 — sem data de término é recusado, salvo INSS
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_caso_afast_002()
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE
  r public.qa_retorno;
  v_recusou boolean := false;
  v_msg text;
  v_id uuid;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'Tentar criar afastamento comum sem data de término';
  r.esperado    := 'Recusado, com mensagem que diz o que fazer';

  BEGIN
    v_id := public.qa_afast_novo('QA Sem Fim', CURRENT_DATE - 5, NULL);
  EXCEPTION WHEN OTHERS THEN
    v_recusou := true;
    v_msg := SQLERRM;
  END;

  IF NOT v_recusou THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o banco aceitou afastamento comum SEM data de término. A trava do '
             || 'ponto lê fim ausente como 31/12/9999 — o colaborador fica impedido de bater '
             || 'ponto para sempre, e o RH só resolve apagando o afastamento (perdendo o '
             || 'histórico de saúde ocupacional junto).';
    RETURN r;
  END IF;

  r.passo_ordem := 2;
  r.passo_acao  := 'Criar afastamento de prazo indeterminado sem data de término';
  r.esperado    := 'Aceito — benefício do INSS não tem previsão de retorno';

  BEGIN
    v_id := public.qa_afast_novo('QA Prazo Indeterminado', CURRENT_DATE - 5, NULL, true);
  EXCEPTION WHEN OTHERS THEN
    r.situacao := 'falhou';
    r.obtido := format('A guarda passou do ponto: recusou até o caso legítimo (prazo '
                    || 'indeterminado / benefício do INSS), que não tem data de retorno por '
                    || 'natureza. Mensagem: %s', left(SQLERRM, 120));
    RETURN r;
  END;

  r.situacao := 'passou';
  r.obtido := format('Comum sem fim recusado ("%s") e prazo indeterminado aceito.',
                     left(v_msg, 80));
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- AFAST-003 — preencher a data de término encerra na hora
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_caso_afast_003()
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE
  r public.qa_retorno;
  v_id uuid;
  v_st text;
  v_existe boolean;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'Informar a data de término de um afastamento legado já vencido';
  r.esperado    := 'Encerra na hora, sem esperar a rotina da madrugada';

  -- Registro legado: nasceu sem data de fim, antes da guarda existir.
  PERFORM set_config('session_replication_role', 'replica', true);
  v_id := public.qa_afast_novo('QA Legado', CURRENT_DATE - 60, NULL);
  PERFORM set_config('session_replication_role', 'origin', true);

  UPDATE public.afastamentos SET data_fim = CURRENT_DATE - 50 WHERE id = v_id;
  SELECT status::text INTO v_st FROM public.afastamentos WHERE id = v_id;

  IF v_st <> 'encerrado' THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: informar a data de término deixou o registro como "%s". Sem '
             || 'encerramento imediato, o RH continua sem caminho de saída a não ser apagar o '
             || 'afastamento — que é justamente o que estamos tentando evitar.', v_st);
    RETURN r;
  END IF;

  r.passo_ordem := 2;
  r.passo_acao  := 'Conferir que o registro continua existindo';
  r.esperado    := 'Histórico preservado, nada apagado';
  SELECT EXISTS (SELECT 1 FROM public.afastamentos WHERE id = v_id) INTO v_existe;

  IF NOT v_existe THEN
    r.situacao := 'falhou';
    r.obtido := 'O encerramento apagou o registro. Afastamento é histórico de saúde '
             || 'ocupacional: encerra, não some.';
    RETURN r;
  END IF;

  r.situacao := 'passou';
  r.obtido := 'Ao informar a data de término o afastamento encerrou na hora, e o registro '
           || 'continua na base para consulta e para o eSocial.';
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ── Registro no motor ────────────────────────────────────────────────
INSERT INTO public.qa_implementacoes (codigo, funcao_sql, ativo)
VALUES ('AFAST-001', 'qa_caso_afast_001', true),
       ('AFAST-002', 'qa_caso_afast_002', true),
       ('AFAST-003', 'qa_caso_afast_003', true)
ON CONFLICT (codigo) DO UPDATE SET funcao_sql = EXCLUDED.funcao_sql, ativo = true;
