-- =====================================================================
-- FERIAS-017 para de quebrar onde o motor de QA está incompleto
--
-- A entrega de 14/08 (camada de perfil em Férias) rodou na produção com
-- as 7 tabelas em ordem e as duas vigilâncias verdes — mas a FERIAS-017
-- voltou 'erro'.
--
-- CAUSA: a rotina chama duas auxiliares do motor de QA, qa_col_existe e
-- qa_fns_com, criadas na migration 20260812130000 e que NUNCA foram
-- entregues à produção (não existe script delas em docs/). A produção só
-- recebe o que é colado no SQL Editor, então o motor de lá tem lacunas
-- que o ambiente de teste não tem. Corpo de plpgsql não é validado na
-- criação: a função é criada sem reclamar e só quebra quando roda.
--
-- CORREÇÃO: a rotina não precisa dessas auxiliares. A evidência que
-- responde à pergunta é a TABELA DEDICADA (ferias_vinculo_familiar), que
-- já é consultada primeiro. As auxiliares eram plano B herdado da versão
-- antiga, de quando o vínculo era procurado por nome de coluna. Passam a
-- rodar dentro de um bloco protegido: se não existirem, o plano B
-- simplesmente não acontece — e não derruba a rotina.
--
-- Vale além deste caso: rotina de QA que depende de auxiliar não
-- garantida transforma "não instalado aqui" em "quebrou", que é o pior
-- diagnóstico possível — parece defeito do produto quando é lacuna do
-- próprio motor.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.qa_caso_ferias_017()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o cadastro registra vínculo familiar entre colaboradores?';
  r.esperado := 'Familiares na mesma empresa sinalizados para a preferência de coincidência';

  -- Evidência principal: a tabela dedicada. Não depende de nada do motor.
  v_est := CASE WHEN to_regclass('public.ferias_vinculo_familiar') IS NOT NULL
                THEN 'tabela ferias_vinculo_familiar' END;

  -- Plano B (bases antigas, em que o vínculo podia estar como coluna).
  -- Protegido: onde as auxiliares do motor não existem, seguimos sem elas.
  IF v_est IS NULL THEN
    BEGIN
      v_est := COALESCE(public.qa_col_existe(NULL, '%conjuge%'),
                        public.qa_col_existe(NULL, '%familiar%'),
                        public.qa_fns_com('%familiar%ferias%'));
    EXCEPTION WHEN undefined_function THEN
      v_est := NULL;
    END;
  END IF;

  IF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: nenhum campo liga colaboradores da mesma família — a preferência do '
             || 'art. 136, §1º (familiares na mesma empresa tirarem férias juntos, se não '
             || 'prejudicar o serviço) não tem como ser sinalizada na programação. É direito '
             || 'informativo, não bloqueante. Correção: vínculo familiar no cadastro + aviso '
             || 'de coincidência na programação.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Vínculo familiar presente: %s. A regra do art. 136, §1º é avaliada na '
                    || 'programação como informativo.', v_est);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;
