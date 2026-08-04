-- =====================================================================
-- Escala não resolvida derruba a apuração inteira
--
-- Como apareceu: uma consulta que percorria os colaboradores da base parou
-- com
--   ERROR: Escala não encontrada no tenant
--   CONTEXT: ponto_equalizacao_competencia(...) line 32
--            ponto_saldo_dias_competencia(...)  line 357
--
-- O que isso significa na prática é pior do que uma consulta que falha.
-- ponto_saldo_dias_competencia é a fonte do Espelho e do Banco de Horas, e
-- o Espelho a chama para TODOS os colaboradores da empresa no dia
-- (ponto_saldo_dia_empresa faz um laço). Um único colaborador com escala
-- não resolvida — atribuição apontando para escala apagada, escala de
-- outro tenant, importação incompleta — levanta exceção e a tela inteira
-- para de carregar, para todo mundo.
--
-- ponto_equalizacao_competencia levanta exceção de propósito: quem a chama
-- direto, para configurar a equalização, precisa saber que a escala não
-- existe. O problema é a apuração tratar isso como erro fatal em vez de
-- "esta pessoa não tem equalização calculável".
--
-- Correção: os dois pontos onde a apuração consulta a equalização passam a
-- tolerar a falha e seguir sem equalização. O colaborador com cadastro
-- quebrado aparece com o saldo que dá para calcular, em vez de derrubar a
-- apuração dos demais.
--
-- Não altera nenhum cálculo de quem tem escala válida.
-- =====================================================================
DO $do$
DECLARE
  d text;
  v_alvo text := 'v_eq_m := public.ponto_equalizacao_competencia(p_tenant_id, v_fb_escala_id, p_competencia);';
  v_novo text;
  v_qtd int;
BEGIN
  d := pg_get_functiondef('public.ponto_saldo_dias_competencia(uuid,text,text)'::regprocedure);

  IF position('escala nao resolvida: segue sem equalizacao' in d) > 0 THEN
    RAISE NOTICE 'Tolerância à escala ausente já aplicada — nada a fazer.';
    RETURN;
  END IF;

  v_qtd := (length(d) - length(replace(d, v_alvo, ''))) / length(v_alvo);
  IF v_qtd = 0 THEN
    RAISE EXCEPTION 'Trecho alvo não encontrado — abortado sem alterar nada.';
  END IF;

  -- BEGIN/EXCEPTION em volta da chamada: escala inexistente, de outro
  -- tenant ou apagada deixa de ser erro fatal.
  v_novo :=
    'BEGIN' || E'\n' ||
    '        -- escala nao resolvida: segue sem equalizacao em vez de derrubar' || E'\n' ||
    '        -- a apuracao de todos os colaboradores da tela.' || E'\n' ||
    '        v_eq_m := public.ponto_equalizacao_competencia(p_tenant_id, v_fb_escala_id, p_competencia);' || E'\n' ||
    '      EXCEPTION WHEN OTHERS THEN' || E'\n' ||
    '        v_eq_m := NULL;' || E'\n' ||
    '      END;';

  d := replace(d, v_alvo, v_novo);
  EXECUTE d;
  RAISE NOTICE 'Apuração passa a tolerar escala não resolvida (% ponto(s) protegido(s)).', v_qtd;
END $do$;
