-- =====================================================================
-- PONTO-252 estava dando sinal verde sobre 76 autoaprovações reais
--
-- As duas medições do mesmo assunto rodaram lado a lado na produção em
-- 14/08 e discordaram:
--
--   PONTO-252 .......... "nenhuma auto-aprovação entre 1656 ajustes"
--   conferência do script de alinhamento ....... 76 autoaprovações
--
-- Quem está certo é a segunda. A rotina comparava assim:
--
--     aprovado_por = colaborador_id
--
-- e as duas colunas são de DOMÍNIOS DIFERENTES. `aprovado_por` é o id do
-- usuário em auth.users; `colaborador_id` é o id em usuarios_base (a
-- coluna não tem chave estrangeira, e o gatilho de bloqueio a resolve por
-- usuarios_base). Dois identificadores que nunca coincidem: a comparação
-- é sempre falsa, e a rotina sempre passava.
--
-- É o mesmo defeito que a FERIAS-056 propunha como correção — o CHECK
-- `aprovado_por <> colaborador_id`, que também nunca barraria nada. A
-- diferença é que aqui a comparação decorativa já estava instalada e
-- vinha afirmando, todo mês, que o problema não existia.
--
-- Rotina que dá verde sobre problema real é pior que rotina ausente: a
-- ausência ninguém confunde com garantia.
--
-- CORREÇÃO: a rotina passa a usar exatamente a mesma lógica do gatilho
-- que bloqueia (ponto_ajuste_bloqueia_autoaprovacao) — resolve o
-- aprovador em usuarios_base pelo auth_user_id e compara com o
-- colaborador por id OU por CPF. O que a trava impede é o que a rotina
-- conta.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.qa_caso_ponto_252()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_tem_trava boolean; v_auto int; v_aprovados int;
BEGIN
  IF to_regclass('public.ponto_ajustes') IS NULL THEN
    r.situacao := 'nao_implementado';
    r.obtido   := 'Tabela ponto_ajustes não existe nesta base.';
    RETURN r;
  END IF;

  r.passo_ordem := 1;
  r.passo_acao  := 'Conferir a trava de autoaprovação e contar os casos existentes';
  r.esperado    := 'Trava instalada e nenhuma autoaprovação no histórico';

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.ponto_ajustes'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%aprovado_por%'
  ) OR EXISTS (
    SELECT 1 FROM pg_trigger tg
    WHERE tg.tgrelid = 'public.ponto_ajustes'::regclass AND NOT tg.tgisinternal
      AND pg_get_triggerdef(tg.oid) ILIKE '%aprov%'
  ) INTO v_tem_trava;

  SELECT count(*) INTO v_aprovados
    FROM public.ponto_ajustes WHERE status = 'aprovado';

  -- MESMA lógica do gatilho: o aprovador é resolvido em usuarios_base
  -- pelo auth_user_id, e comparado com o colaborador por id OU por CPF.
  -- Comparar aprovado_por com colaborador_id direto não funciona: são
  -- identificadores de tabelas diferentes.
  SELECT count(*) INTO v_auto
    FROM public.ponto_ajustes a
   WHERE a.status = 'aprovado'
     AND a.aprovado_por IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.usuarios_base ub
        WHERE ub.auth_user_id = a.aprovado_por
          AND ub.tenant_id = a.tenant_id
          AND (
            ub.id::text = a.colaborador_id::text
            OR (COALESCE(ub.cpf, '') <> ''
                AND regexp_replace(ub.cpf, '[^0-9]', '', 'g')
                  = regexp_replace(COALESCE(a.colaborador_cpf, ''), '[^0-9]', '', 'g'))
          )
     );

  IF v_auto > 0 THEN
    r.situacao := 'falhou';
    r.obtido   := format(
      '%s de %s ajuste(s) aprovado(s) foram aprovados pelo PRÓPRIO colaborador. '
      || 'O ajuste de ponto altera a marcação, e a autoaprovação anula o controle: '
      || 'quem corrige o próprio registro e o homologa sozinho não tem contrapeso. '
      || '%s Os casos já existentes seguem no histórico — a trava vale para as '
      || 'aprovações novas, não reescreve o passado.',
      v_auto, v_aprovados,
      CASE WHEN v_tem_trava
           THEN 'A trava está instalada, então estes são anteriores a ela.'
           ELSE 'E NÃO HÁ TRAVA instalada: o padrão continua acontecendo.' END);
    r.detalhe := jsonb_build_object('auto_aprovados', v_auto,
                                    'total_aprovados', v_aprovados,
                                    'tem_trava', v_tem_trava);
  ELSIF NOT v_tem_trava THEN
    r.situacao := 'falhou';
    r.obtido   := format(
      'Nenhuma autoaprovação entre %s ajuste(s) aprovado(s) — mas NÃO HÁ TRAVA: '
      || 'nada impede que a próxima aconteça.', v_aprovados);
    r.detalhe := jsonb_build_object('auto_aprovados', 0, 'tem_trava', false);
  ELSE
    r.situacao := 'passou';
    r.obtido   := format('Trava instalada e nenhuma autoaprovação entre %s ajuste(s) aprovado(s).',
                         v_aprovados);
    r.detalhe := jsonb_build_object('auto_aprovados', 0, 'total_aprovados', v_aprovados,
                                    'tem_trava', true);
  END IF;

  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;
