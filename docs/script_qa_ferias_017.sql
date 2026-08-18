-- ============================================================================
-- YourEyes · PRODUÇÃO · Correção da rotina de teste FERIAS-017
--
-- Na entrega da camada de perfil em Férias, as 7 tabelas ficaram em ordem
-- e as duas vigilâncias passaram — mas a FERIAS-017 voltou 'erro'.
--
-- CAUSA (reproduzida): a rotina chamava duas funções auxiliares do motor de
-- QA (qa_col_existe e qa_fns_com) que existem no ambiente de teste e NÃO
-- existem na produção — elas nasceram numa migration que nunca virou script
-- de entrega. A mensagem exata é:
--
--   function public.qa_col_existe(unknown, unknown) does not exist
--
-- NADA DE PROTEÇÃO ESTÁ EM RISCO. A FERIAS-017 é rotina de teste: ela
-- relata, não protege. As políticas de leitura das 7 tabelas seguem
-- aplicadas e intactas.
--
-- CORREÇÃO: a rotina não precisa das auxiliares. A evidência que responde à
-- pergunta é a tabela ferias_vinculo_familiar, consultada primeiro. As
-- auxiliares eram plano B da versão antiga e passam a rodar dentro de um
-- bloco protegido: onde não existirem, são ignoradas em vez de derrubar
-- tudo.
--
-- SEGURO DE RODAR DUAS VEZES. Só substitui uma função de teste; nenhum dado
-- e nenhuma política são tocados.
--
-- COMO RODAR: cole o arquivo inteiro no SQL Editor do projeto de PRODUÇÃO.
-- O último resultado é a conferência.
-- ============================================================================

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

-- ============================================================================
-- CONFERÊNCIA
--
-- Desta vez a conferência mostra a coluna `erro_tecnico` DO RETORNO — que é
-- onde a causa real aparece. Na entrega anterior eu mostrei só o `obtido`,
-- que traz a mensagem genérica "A rotina quebrou", e isso escondeu o motivo.
-- ============================================================================
SELECT
  'FERIAS-017' AS item,
  (public.qa_caso_ferias_017()).situacao::text AS situacao,
  left((public.qa_caso_ferias_017()).obtido, 160) AS obtido,
  coalesce((public.qa_caso_ferias_017()).erro_tecnico, '') AS erro_tecnico

UNION ALL

SELECT
  'Camada de perfil em Férias (7 tabelas)',
  CASE WHEN count(*) = 7 THEN 'ok' ELSE 'FALTA' END,
  count(*)::text || ' de 7 políticas RESTRICTIVE de leitura',
  CASE WHEN count(*) = 7 THEN '' ELSE 'reveja o script_perfil_ferias.sql' END
FROM pg_policies
WHERE schemaname = 'public'
  AND permissive = 'RESTRICTIVE'
  AND cmd = 'SELECT'
  AND policyname LIKE 'perfil_restringe_leitura_%'
  AND tablename IN ('ferias_periodos_aquisitivos', 'ferias_programacao',
                    'ferias_solicitacoes', 'folha_ferias_calculo',
                    'ferias_assinatura_links', 'ferias_historico',
                    'ferias_vinculo_familiar')
ORDER BY 1;
