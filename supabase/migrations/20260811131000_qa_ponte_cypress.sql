-- =====================================================================
-- A PONTE: resultado do Cypress entra no relatorio de QA
--
-- O motor SQL ja sabia que existem casos que ele nao consegue executar:
-- ao encontrar um caso `nivel = 'e2e'` ele grava 'nao_implementado' com
-- a observacao de que "a cobertura dele vive no Cypress". Faltava o
-- caminho de volta — o Cypress rodava (quando rodava) e o resultado
-- morria no log da esteira.
--
-- Esta migration cria esse caminho:
--   1) qa_cobertura_e2e  — liga caso documentado <-> teste do Cypress;
--   2) qa_registrar_bateria_e2e(jsonb) — grava uma corrida inteira;
--   3) qa_cobertura      — a view passa a enxergar cobertura de tela.
--
-- Decisao de desenho: a ligacao e por (spec, teste), NAO por codigo
-- escrito dentro do titulo do it(). Assim os 127 testes existentes nao
-- precisam ser reescritos, e renomear um caso no banco nao exige tocar
-- no spec. O preco e que renomear um it() quebra a ligacao — por isso a
-- funcao conta e denuncia os testes sem caso correspondente.
-- =====================================================================

-- ─────────────────────────────────────────────────────────
-- 1) O mapa entre caso documentado e teste de tela
--    Espelha o papel que qa_implementacoes tem para o motor SQL.
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.qa_cobertura_e2e (
  codigo     text PRIMARY KEY,
  spec       text NOT NULL,   -- ex.: 'cypress/e2e/psicossocial.cy.ts'
  teste      text NOT NULL,   -- titulo completo do it(), como o Cypress reporta
  ativo      boolean NOT NULL DEFAULT true,
  criado_em  timestamptz NOT NULL DEFAULT now()
);

-- Um teste de tela cobre um caso e um so: se dois casos apontarem para o
-- mesmo it(), o resultado seria ambiguo na hora de gravar.
CREATE UNIQUE INDEX IF NOT EXISTS qa_cobertura_e2e_spec_teste_uidx
  ON public.qa_cobertura_e2e(spec, teste);

COMMENT ON TABLE public.qa_cobertura_e2e IS
  'Liga cada caso de nivel e2e ao teste do Cypress que o executa. Sem isto, spec e documentacao descolam em silencio — mesmo problema que qa_implementacoes resolve para o motor SQL.';

ALTER TABLE public.qa_cobertura_e2e ENABLE ROW LEVEL SECURITY;

DO $pol$ BEGIN
  CREATE POLICY qa_cobertura_e2e_leitura ON public.qa_cobertura_e2e
    FOR SELECT TO authenticated
    USING (public.has_minimum_role(auth.uid(), 'admin'::public.app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $pol$;

-- ─────────────────────────────────────────────────────────
-- 2) Gravar uma corrida inteira
--
-- Recebe o relatorio da suite e devolve o id da execucao. Roda como
-- SECURITY DEFINER porque quem chama e a Edge Function (service role),
-- e as tabelas de QA sao fechadas por RLS.
--
-- Formato esperado:
-- {
--   "origem": "esteira",                       -- texto livre, so registro
--   "resultados": [
--     { "spec": "cypress/e2e/epi.cy.ts",
--       "teste": "titulo completo do it()",
--       "situacao": "passou|falhou|pulado",
--       "duracao_ms": 1234,
--       "erro": "mensagem do Cypress, se houver" }
--   ]
-- }
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_registrar_bateria_e2e(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exec       uuid;
  v_item       jsonb;
  v_codigo     text;
  v_caso       uuid;
  v_situacao   public.qa_situacao;
  v_sem_caso   int := 0;
  v_gravados   int := 0;
  v_total      int;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload->'resultados') <> 'array' THEN
    RAISE EXCEPTION 'Payload invalido: esperava { "resultados": [...] }.';
  END IF;

  v_total := jsonb_array_length(p_payload->'resultados');

  INSERT INTO public.qa_execucoes (disparo, modulo_path, terminada_em)
  VALUES ('e2e', 'cypress', now())
  RETURNING id INTO v_exec;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'resultados')
  LOOP
    -- Vocabulario do Cypress -> vocabulario do motor. 'pulado' entra como
    -- nao_implementado: o caso existe, o teste nao rodou, ninguem sabe.
    v_situacao := CASE lower(COALESCE(v_item->>'situacao', ''))
                    WHEN 'passou' THEN 'passou'
                    WHEN 'falhou' THEN 'falhou'
                    WHEN 'pulado' THEN 'nao_implementado'
                    ELSE 'erro'
                  END::public.qa_situacao;

    SELECT e.codigo INTO v_codigo
    FROM public.qa_cobertura_e2e e
    WHERE e.ativo
      AND e.spec  = v_item->>'spec'
      AND e.teste = v_item->>'teste';

    IF v_codigo IS NULL THEN
      -- Teste de tela sem caso documentado. Nao inventamos codigo: ele e
      -- contado e denunciado na observacao da execucao.
      v_sem_caso := v_sem_caso + 1;
      CONTINUE;
    END IF;

    SELECT c.id INTO v_caso FROM public.qa_casos_teste c WHERE c.codigo = v_codigo;

    INSERT INTO public.qa_resultados
      (execucao_id, caso_id, codigo, situacao, passo_acao, esperado, obtido,
       erro_tecnico, duracao_ms)
    VALUES
      (v_exec, v_caso, v_codigo, v_situacao,
       v_item->>'teste',
       'Teste de tela em ' || COALESCE(v_item->>'spec', '(spec desconhecido)'),
       CASE v_situacao
         WHEN 'passou' THEN 'A tela se comportou como o caso descreve.'
         WHEN 'nao_implementado' THEN 'O teste existe mas nao rodou nesta corrida.'
         ELSE 'A tela fez diferente do que o caso descreve.'
       END,
       NULLIF(v_item->>'erro', ''),
       NULLIF(v_item->>'duracao_ms', '')::int)
    ON CONFLICT (execucao_id, codigo) DO NOTHING;

    v_gravados := v_gravados + 1;
    v_codigo := NULL;
  END LOOP;

  UPDATE public.qa_execucoes e SET
    total            = (SELECT count(*) FROM public.qa_resultados WHERE execucao_id = v_exec),
    passou           = (SELECT count(*) FROM public.qa_resultados WHERE execucao_id = v_exec AND situacao = 'passou'),
    falhou           = (SELECT count(*) FROM public.qa_resultados WHERE execucao_id = v_exec AND situacao = 'falhou'),
    nao_implementado = (SELECT count(*) FROM public.qa_resultados WHERE execucao_id = v_exec AND situacao = 'nao_implementado'),
    erro             = (SELECT count(*) FROM public.qa_resultados WHERE execucao_id = v_exec AND situacao = 'erro'),
    observacao       = 'Corrida do Cypress (origem: '
                       || COALESCE(p_payload->>'origem', 'nao informada') || '). '
                       || v_total || ' teste(s) na suite, ' || v_gravados || ' ligado(s) a caso'
                       || CASE WHEN v_sem_caso > 0
                               THEN '. >>> ' || v_sem_caso || ' teste(s) de tela SEM caso documentado '
                                 || '(rodaram, mas nao aparecem no relatorio: falta linha em qa_cobertura_e2e).'
                               ELSE '. Todos os testes tem caso documentado.' END
  WHERE e.id = v_exec;

  RETURN v_exec;
END $$;

COMMENT ON FUNCTION public.qa_registrar_bateria_e2e(jsonb) IS
  'Grava no historico de QA o resultado de uma corrida do Cypress. Chamada pela Edge Function qa-registrar-e2e ao fim da suite no staging.';

REVOKE ALL ON FUNCTION public.qa_registrar_bateria_e2e(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.qa_registrar_bateria_e2e(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.qa_registrar_bateria_e2e(jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.qa_registrar_bateria_e2e(jsonb) TO service_role;

-- ─────────────────────────────────────────────────────────
-- 3) A view de cobertura passa a enxergar a tela
--
-- Antes, todo caso e2e caia em 'sem rotina — nao sera executado', o que
-- era verdade sobre o motor SQL e mentira sobre o sistema: o caso podia
-- ter spec verde no Cypress. Agora a view distingue os tres estados.
-- Coluna nova entra no fim (CREATE OR REPLACE VIEW so aceita assim).
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.qa_cobertura AS
SELECT
  c.codigo,
  c.titulo,
  c.prioridade,
  c.nivel,
  CASE
    WHEN i.codigo IS NOT NULL AND i.ativo       THEN 'coberto'
    WHEN i.codigo IS NOT NULL AND NOT i.ativo   THEN 'rotina desativada'
    WHEN e.codigo IS NOT NULL AND e.ativo       THEN 'coberto por teste de tela (Cypress)'
    WHEN e.codigo IS NOT NULL AND NOT e.ativo   THEN 'spec desativado'
    WHEN c.nivel = 'e2e'                        THEN 'sem spec — cobertura de tela pendente'
    ELSE 'sem rotina — nao sera executado'
  END AS cobertura,
  i.funcao_sql,
  e.spec AS spec_cypress
FROM public.qa_casos_teste c
LEFT JOIN public.qa_implementacoes i ON i.codigo = c.codigo
LEFT JOIN public.qa_cobertura_e2e  e ON e.codigo = c.codigo
WHERE c.status = 'aprovado';
