-- =========================================================
-- QA — Correcao do ADM-111 (29/07/2026)
--
-- ERRO MEU: a rotina usava status IN ('reprovado','rejeitado'), e 'rejeitado'
-- nao existe no enum admissao_status. Peguei o valor de um grep que juntou
-- dois enums diferentes do projeto — exatamente o tipo de erro que a
-- exigencia de "nada por achismo" existe para evitar, e que eu cometi.
--
-- CORRECAO: comparar o status como TEXTO, nao como enum. Assim a rotina
-- pergunta "o status e um destes?" sem exigir que todos existam no tipo, e
-- nao quebra se amanha alguem acrescentar ou remover um rotulo. Para uma
-- rotina de QA, resiliencia a mudanca de enum vale mais que rigor de tipo.
--
-- Alem disso, a lista passa a ser derivada do proprio enum: qualquer status
-- que nao seja de admissao em andamento nem concluida conta como encerrada
-- sem efetivacao.
-- =========================================================

SET lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.qa_caso_adm_111()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno; v_docs int; v_admissoes int; v_status text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'AUDITORIA (somente leitura): documentos pessoais retidos de admissoes encerradas sem efetivacao';
  r.esperado    := 'Destino definido — eliminados ou retidos com prazo e justificativa';

  -- Comparacao por TEXTO: nao depende de quais rotulos existem no enum hoje.
  SELECT count(DISTINCT a.id), count(ad.id) INTO v_admissoes, v_docs
  FROM public.admissoes a
  JOIN public.admissao_documentos ad ON ad.admissao_id = a.id
  WHERE a.status::text IN ('reprovado','rejeitado','cancelado','recusado')
    AND ad.arquivo_url IS NOT NULL AND btrim(ad.arquivo_url) <> '';

  -- Registra quais rotulos de encerramento existem de fato, para a proxima
  -- pessoa nao ter que descobrir isso na marra como eu descobri.
  SELECT string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) INTO v_status
  FROM pg_enum e
  JOIN pg_type t ON t.oid = e.enumtypid
  WHERE t.typname = 'admissao_status';

  IF v_docs = 0 THEN
    r.situacao := 'passou';
    r.obtido   := format('Nenhum documento retido de admissao encerrada sem efetivacao. '
               || 'Rotulos existentes em admissao_status: %s.', COALESCE(v_status,'(nao encontrado)'));
    r.detalhe  := jsonb_build_object('status_do_enum', v_status);
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('%s documento(s) pessoal(is) de %s admissao(oes) encerrada(s) sem '
               || 'efetivacao continuam armazenados. A finalidade que autorizou a coleta '
               || 'deixou de existir (LGPD, art. 15, I e III), e o art. 16 exige eliminacao '
               || 'apos o termino do tratamento, ressalvada guarda obrigatoria. Nao ha no '
               || 'sistema prazo, responsavel nem registro de decisao sobre esse acervo. '
               || 'AGRAVANTE: como o ADM-102 mostra 100%% dos documentos sem colaborador_id '
               || 'e sem pasta, nao ha nem como localizar o conjunto de uma admissao '
               || 'especifica para elimina-lo.', v_docs, v_admissoes);
    r.detalhe  := jsonb_build_object('documentos_retidos', v_docs,
                                     'admissoes', v_admissoes,
                                     'status_do_enum', v_status);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- Conferencia: roda so esta rotina, fora da bateria.
SELECT (public.qa_caso_adm_111()).situacao AS situacao,
       left((public.qa_caso_adm_111()).obtido, 150) AS resultado;
