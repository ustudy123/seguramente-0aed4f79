-- =====================================================================
-- QA COLAB-021 — "O banco aceitou CPF inválido (validação existe só no
-- front)". Não aceitou. A rotina é que não reconhece a recusa.
--
-- O que de fato acontece hoje:
--   1. a rotina insere 111.111.111-11 em usuarios_base;
--   2. a trigger valida_cpf_usuario (instalada em 30/07) recusa, com
--      ERRCODE check_violation e a mensagem
--        'CPF inválido: 11111111111 — dígito verificador não confere.'
--   3. o bloco EXCEPTION da rotina tenta reconhecer a recusa assim:
--        IF SQLERRM LIKE '%cpf%' OR SQLERRM LIKE '%valid%'
--   4. LIKE é sensível a caixa e a acento. A mensagem traz 'CPF' em
--      maiúsculas e 'inválido' com acento — nenhum dos dois padrões casa.
--      Cai no ELSE e reporta falha.
--
-- Ou seja: a defesa em profundidade está no lugar, e o relatório vinha
-- dizendo o contrário há dias. Pior que um teste que não pega o defeito é
-- um que acusa defeito onde não há: manda corrigir o que já está certo.
--
-- Correção: reconhecer a recusa pelo ERRCODE, que é estável, em vez de
-- pelo texto da mensagem. O texto vira só complemento — e a comparação,
-- quando usada, passa a ser insensível a caixa e acento.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.qa_caso_colab_021()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_id uuid;
  v_estado text;
  v_msg text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1;
  r.passo_acao  := 'Tentar cadastrar com CPF matematicamente invalido (111.111.111-11)';
  r.esperado    := 'Recusado pelo banco — digito verificador invalido';

  BEGIN
    INSERT INTO public.usuarios_base (tenant_id, nome_completo, email_principal, cpf, tipo_usuario, status)
    VALUES (v_t, '[QA-021] CPF Ruim', 'qa.021.1@sandbox.invalid', '11111111111', 'colaborador', 'ativo')
    RETURNING id INTO v_id;

    r.situacao := 'falhou';
    r.obtido   := 'O BANCO ACEITOU CPF invalido. A validacao existe so no front — '
               || 'a trigger valida_cpf_usuario nao esta instalada nesta base.';
    RETURN r;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_estado = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
  END;

  -- check_violation (23514) e a recusa esperada: e o ERRCODE que a trigger
  -- levanta e o mesmo de um CHECK constraint, caso a defesa mude de forma.
  -- unaccent nao esta garantido em toda base, entao a checagem de texto usa
  -- translate para tirar os acentos que interessam.
  IF v_estado = '23514'
     OR lower(translate(v_msg, 'áàâãéêíóôõúüç', 'aaaaeeiooouuc')) LIKE '%cpf%'
     OR lower(translate(v_msg, 'áàâãéêíóôõúüç', 'aaaaeeiooouuc')) LIKE '%invalid%' THEN
    r.situacao := 'passou';
    r.obtido   := format('Recusado pelo banco, como deveria (SQLSTATE %s): %s', v_estado, v_msg);
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('A escrita falhou, mas por outro motivo — nao pela validacao de CPF '
                      || '(SQLSTATE %s): %s', v_estado, v_msg);
    r.erro_tecnico := v_msg;
  END IF;

  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;
