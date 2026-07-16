-- =========================================================
-- QA — v3: fechar a ativação da trava
--
-- O DEFEITO (encontrado em 16/07, depois de eu ter afirmado que a trava
-- estava consertada — não estava):
--
--   A trigger qa_guarda_cercado é obrigatória: o banco recusa e pronto.
--   Mas a primeira linha dela é:
--       IF current_setting('app.qa_modo') <> 'on' THEN RETURN NEW;
--   Ela só age com o modo ligado. E quem ligava era CADA ROTINA,
--   individualmente. Rotina nova que esquecesse a linha rodaria sem
--   trava alguma.
--
--   Trava obrigatória, ativação opcional. É o mesmo defeito do
--   ON CONFLICT DO NOTHING sem índice, pela quarta vez em um dia.
--
-- A CORREÇÃO — três camadas, nenhuma dependendo de quem escreve a rotina:
--
--   1. O FUNIL liga. Toda rotina passa por qa_executar_descartavel.
--      Se o funil liga, esquecer deixa de ser possível pelo caminho normal.
--
--   2. O MOTOR liga antes do laço. Redundante de propósito.
--
--   3. FALHA FECHADA. qa_exigir_modo() estoura se o modo não estiver
--      ligado. Chamada de dentro do funil, ANTES da rotina rodar. Se
--      alguém quebrar as camadas 1 e 2, o robô para em vez de escrever.
--
-- O RESÍDUO, dito com todas as letras: alguém que chame qa_caso_colab_001()
-- na mão, direto no SQL Editor, sem passar pelo funil, roda sem trava. Não
-- há desenho que impeça uma pessoa de fazer isso deliberadamente. O que dá
-- para garantir é que o CAMINHO DO ROBÔ não tem essa saída.
-- =========================================================

-- ─────────────────────────────────────────────────────────
-- 1) FALHA FECHADA
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_exigir_modo()
RETURNS void
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  IF COALESCE(current_setting('app.qa_modo', true), 'off') <> 'on' THEN
    RAISE EXCEPTION
      'QA ABORTADO: modo de teste desligado. A trava do cercado estaria inerte e a rotina poderia escrever em cliente real. Nada foi executado.';
  END IF;
  IF public.qa_sandbox_tenant_id() IS NULL THEN
    RAISE EXCEPTION 'QA ABORTADO: o cercado nao existe.';
  END IF;
END $$;

COMMENT ON FUNCTION public.qa_exigir_modo() IS
  'Falha fechada. Se o modo de teste nao estiver ligado, para tudo. Chamada dentro do funil, ANTES de qualquer rotina rodar.';

-- ─────────────────────────────────────────────────────────
-- 2) O FUNIL — agora ele liga a trava, e confere que ligou
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_executar_descartavel(p_funcao text)
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE
  r public.qa_retorno;
BEGIN
  -- A rotina nao precisa lembrar de nada. O funil liga.
  PERFORM public.qa_modo_ligar();
  -- E confere que ligou mesmo. Falha fechada.
  PERFORM public.qa_exigir_modo();

  BEGIN
    EXECUTE format('SELECT public.%I()', p_funcao) INTO r;
    RAISE EXCEPTION USING ERRCODE = 'QA000', MESSAGE = 'QA_DESCARTE';
  EXCEPTION
    WHEN SQLSTATE 'QA000' THEN
      NULL;  -- caminho normal: os dados de teste ja foram desfeitos
    WHEN OTHERS THEN
      r.situacao     := 'erro';
      r.obtido       := 'A rotina quebrou. Nenhum dado ficou na base.';
      r.erro_tecnico := SQLERRM || ' [' || SQLSTATE || ']';
  END;

  IF r.situacao IS NULL THEN
    r.situacao := 'erro';
    r.obtido   := 'A rotina nao devolveu veredito.';
  END IF;

  RETURN r;
END $$;

COMMENT ON FUNCTION public.qa_executar_descartavel(text) IS
  'Funil unico por onde toda rotina passa. Liga a trava, exige que esteja ligada, roda a rotina e desfaz tudo que ela escreveu. Quem escreve rotina nova nao precisa lembrar de nada.';

-- ─────────────────────────────────────────────────────────
-- 3) O MOTOR — liga antes do laço. Redundância de propósito.
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_rodar_bateria(
  p_disparo public.qa_disparo DEFAULT 'manual',
  p_modulo  text DEFAULT 'estrutura-organizacional/colaboradores'
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_exec uuid;
  v_t0   timestamptz := clock_timestamp();
  c      record;
  r      public.qa_retorno;
  v_ini  timestamptz;
  v_vaz  int;
BEGIN
  IF public.qa_sandbox_tenant_id() IS NULL THEN
    RAISE EXCEPTION 'Cercado nao existe. Bateria abortada.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'qa_guarda_cercado' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'A trava do cercado nao esta instalada. Bateria abortada por seguranca.';
  END IF;

  -- Liga aqui tambem. Se o funil falhar, esta camada segura.
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_exigir_modo();

  INSERT INTO public.qa_execucoes (disparo, modulo_path)
  VALUES (p_disparo, p_modulo) RETURNING id INTO v_exec;

  FOR c IN
    SELECT ct.id AS caso_id, ct.codigo, ct.titulo, i.funcao_sql
    FROM public.qa_casos_teste ct
    JOIN public.qa_modulos m ON m.id = ct.modulo_id AND m.path = p_modulo
    LEFT JOIN public.qa_implementacoes i ON i.codigo = ct.codigo AND i.ativo
    WHERE ct.status = 'aprovado'
    ORDER BY ct.codigo
  LOOP
    v_ini := clock_timestamp();

    IF c.funcao_sql IS NULL THEN
      INSERT INTO public.qa_resultados
        (execucao_id, caso_id, codigo, situacao, esperado, obtido, duracao_ms)
      VALUES (v_exec, c.caso_id, c.codigo, 'nao_implementado', c.titulo,
              'Caso documentado e aprovado. Nenhuma rotina foi escrita para executa-lo.', 0);
    ELSE
      r := public.qa_executar_descartavel(c.funcao_sql);
      INSERT INTO public.qa_resultados
        (execucao_id, caso_id, codigo, situacao, passo_ordem, passo_acao,
         esperado, obtido, erro_tecnico, detalhe, duracao_ms)
      VALUES (v_exec, c.caso_id, c.codigo, r.situacao, r.passo_ordem, r.passo_acao,
              r.esperado, r.obtido, r.erro_tecnico, r.detalhe,
              extract(milliseconds from clock_timestamp() - v_ini)::int);
    END IF;
  END LOOP;

  SELECT count(*) INTO v_vaz FROM public.qa_verifica_vazamento()
  WHERE veredito NOT IN ('limpo','ok');

  UPDATE public.qa_execucoes e SET
    terminada_em     = now(),
    duracao_ms       = extract(milliseconds from clock_timestamp() - v_t0)::int,
    total            = (SELECT count(*) FROM public.qa_resultados WHERE execucao_id = v_exec),
    passou           = (SELECT count(*) FROM public.qa_resultados WHERE execucao_id = v_exec AND situacao='passou'),
    falhou           = (SELECT count(*) FROM public.qa_resultados WHERE execucao_id = v_exec AND situacao='falhou'),
    nao_implementado = (SELECT count(*) FROM public.qa_resultados WHERE execucao_id = v_exec AND situacao='nao_implementado'),
    erro             = (SELECT count(*) FROM public.qa_resultados WHERE execucao_id = v_exec AND situacao='erro'),
    observacao       = CASE WHEN v_vaz > 0
                            THEN '>>> VAZAMENTO: sobrou dado de teste no cercado.'
                            ELSE 'Cercado limpo ao final.' END
  WHERE e.id = v_exec;

  PERFORM public.qa_limpar_historico(90);
  RETURN v_exec;
END $$;

-- ─────────────────────────────────────────────────────────
-- 4) A PROVA — o teste do teste
--
-- Nao adianta eu afirmar que fechou. Isto DEMONSTRA, na sua base:
-- instala uma rotina sabotada de proposito, que tenta escrever num
-- cliente real, roda ela pelo funil, e EXIGE que seja bloqueada.
-- Se passar, aborta tudo.
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_caso_sabotagem()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_outro uuid;
BEGIN
  -- Note: esta rotina NAO chama qa_modo_ligar(). De proposito.
  -- Ela simula exatamente o erro que eu poderia cometer amanha.
  SELECT id INTO v_outro FROM public.tenants
  WHERE slug <> 'qa-sandbox' AND ativo LIMIT 1;

  r.passo_ordem := 1;
  r.passo_acao  := 'Rotina sabotada tenta cadastrar pessoa num cliente REAL';
  r.esperado    := 'Bloqueada pela trava do cercado';

  INSERT INTO public.usuarios_base (tenant_id, nome_completo, email_principal, tipo_usuario, status)
  VALUES (v_outro, '[QA] INVASAO QUE NAO PODE ACONTECER',
          'qa.sabotagem.1@sandbox.invalid', 'colaborador', 'ativo');

  -- Se chegou aqui, escreveu num cliente real.
  r.situacao := 'falhou';
  r.obtido   := 'A ROTINA ESCREVEU EM CLIENTE REAL. A trava nao funciona.';
  RETURN r;
END $$;

DO $prova$
DECLARE
  r public.qa_retorno;
  v_outro uuid;
BEGIN
  SELECT id INTO v_outro FROM public.tenants WHERE slug <> 'qa-sandbox' AND ativo LIMIT 1;
  IF v_outro IS NULL THEN
    RAISE NOTICE 'PROVA PULADA: nao ha outro cliente para tentar invadir.';
    RETURN;
  END IF;

  r := public.qa_executar_descartavel('qa_caso_sabotagem');

  IF r.situacao = 'erro' AND r.erro_tecnico LIKE '%QA BLOQUEADO%' THEN
    RAISE NOTICE 'PROVA OK: rotina que esqueceu de ligar a trava foi bloqueada pelo funil.';
  ELSIF r.situacao = 'falhou' THEN
    RAISE EXCEPTION 'PROVA FALHOU: a rotina sabotada ESCREVEU em cliente real. NAO USE O ROBO.';
  ELSE
    RAISE EXCEPTION 'PROVA INCONCLUSIVA: situacao=%, erro=%. Nao use o robo ate entender.',
      r.situacao, COALESCE(r.erro_tecnico, '(nenhum)');
  END IF;
END $prova$;

-- A sabotagem cumpriu o papel. Sai de cena para nao virar rotina de verdade.
DROP FUNCTION IF EXISTS public.qa_caso_sabotagem();

-- ─────────────────────────────────────────────────────────
-- Bateria de verdade
-- ─────────────────────────────────────────────────────────
DO $roda$ BEGIN PERFORM public.qa_rodar_bateria('manual'); END $roda$;

SELECT r.codigo, r.situacao::text AS situacao, COALESCE(left(r.obtido, 56), '') AS o_que_aconteceu
FROM public.qa_resultados r
WHERE r.execucao_id = (SELECT id FROM public.qa_execucoes ORDER BY iniciada_em DESC LIMIT 1)
ORDER BY (r.situacao <> 'passou') DESC, r.codigo;

SELECT * FROM public.qa_verifica_vazamento();
