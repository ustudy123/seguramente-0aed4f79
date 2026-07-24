-- =========================================================
-- QA — SEGURANÇA: instalar a trava do cercado nas tabelas que ficaram sem
--
-- COMO APARECEU: o Alexandre perguntou se os SQLs de teste alteram tabelas do
-- sistema ou apenas as do robo. A resposta e que os arquivos so escrevem em
-- qa_casos_teste e qa_implementacoes — mas a verificacao revelou que OITO
-- tabelas escritas pelas rotinas nao tinham a trava instalada.
--
-- AS TABELAS DESPROTEGIDAS:
--   usuarios_base        <- colaboradores (a mais sensivel)
--   usuario_vinculos     <- vinculos de colaboradores
--   admissoes            <- fluxo de admissao
--   atestados            <- atestados medicos
--   epis, epi_tipos, epi_entregas  <- controle de EPI
--   grupos_economicos    <- grupos economicos
--
-- POR QUE ACONTECEU: as rotinas de Colaboradores e dos fluxos de marco foram
-- as primeiras escritas, antes de a trava virar parte do padrao. As tabelas
-- cobertas depois receberam a protecao; essas ficaram para tras e ninguem
-- reviu. grupos_economicos e recente e a trava simplesmente foi esquecida.
--
-- O QUE JA PROTEGIA (e continua protegendo):
--   O funil qa_executar_descartavel roda cada rotina e forca ROLLBACK ao
--   final. Nada que uma rotina escreva persiste. Essa e a protecao principal
--   e ela funciona.
--
-- O QUE FALTAVA:
--   A trava e a SEGUNDA linha de defesa: um trigger que bloqueia fisicamente
--   qualquer escrita cujo tenant_id nao seja o do cercado. Ela protege o caso
--   em que alguem execute uma rotina fora do funil — por exemplo
--   SELECT public.qa_caso_colab_001() direto no editor. Sem a trava, essa
--   escrita aconteceria de verdade.
--
-- Defesa em profundidade: o funil desfaz, a trava impede. Ter as duas e o
-- desenho original; oito tabelas estavam com apenas uma.
-- =========================================================

DO $instala$
DECLARE
  t text;
  v_instaladas int := 0;
  v_ausentes   text := '';
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'usuarios_base',
    'usuario_vinculos',
    'admissoes',
    'atestados',
    'epis',
    'epi_tipos',
    'epi_entregas',
    'grupos_economicos'
  ] LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS qa_guarda_cercado ON public.%I', t);
      EXECUTE format(
        'CREATE TRIGGER qa_guarda_cercado
           BEFORE INSERT OR UPDATE OR DELETE ON public.%I
           FOR EACH ROW EXECUTE FUNCTION public.qa_bloqueia_fora_do_cercado()', t);

      INSERT INTO public.qa_tabelas_protegidas (tabela, motivo)
      VALUES (t, 'Trava adicionada em jul/2026 — tabela era escrita por rotinas de teste sem protecao.')
      ON CONFLICT (tabela) DO NOTHING;

      v_instaladas := v_instaladas + 1;
    ELSE
      v_ausentes := v_ausentes || t || ' ';
    END IF;
  END LOOP;

  RAISE NOTICE 'Trava instalada em % tabelas.', v_instaladas;
  IF v_ausentes <> '' THEN
    RAISE NOTICE 'Nao existem neste banco (ignoradas): %', v_ausentes;
  END IF;
END $instala$;

-- ─────────────────────────────────────────────────────────
-- CONFERÊNCIA — quais tabelas estão protegidas agora
-- ─────────────────────────────────────────────────────────
SELECT
  c.relname AS tabela,
  'protegida' AS situacao
FROM pg_trigger tg
JOIN pg_class c ON c.oid = tg.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE tg.tgname = 'qa_guarda_cercado'
  AND n.nspname = 'public'
  AND NOT tg.tgisinternal
ORDER BY c.relname;
