-- =========================================================
-- QA — Fase 1 e 2: o cercado de teste e o registro de execuções
--
-- O QUE ISTO FAZ:
--   1. Cria um cliente fictício ("cercado") onde o robô pode destruir
--      à vontade. Ele é um tenant igual aos outros — mesma tabela, mesmas
--      paredes — mas marcado como ambiente de teste em configuracoes.
--   2. Cria uma trava: qualquer escrita do robô passa por qa_assert_sandbox,
--      que ESTOURA se o tenant não for o cercado. É a rede de segurança que
--      não depende de o robô estar correto.
--   3. Cria as tabelas onde cada bateria e cada caso deixam resultado.
--
-- O QUE ISTO NÃO FAZ:
--   Não toca em nenhum dado de cliente. Não altera nenhuma tabela existente.
--   Só cria coisas novas. Rodar duas vezes não faz diferença.
-- =========================================================

-- ─────────────────────────────────────────────────────────
-- 1) O CERCADO
-- ─────────────────────────────────────────────────────────
INSERT INTO public.tenants (nome, slug, plano, ativo, configuracoes)
VALUES (
  '[QA] Cercado de Teste Automatizado',
  'qa-sandbox',
  'free',
  true,
  jsonb_build_object(
    'ambiente',    'teste',
    'nao_faturar', true,
    'aviso',       'Tenant sintético. O robô de QA cria e apaga dados aqui. Nao usar para cliente real.'
  )
)
ON CONFLICT (slug) DO NOTHING;

-- Uma empresa fictícia dentro do cercado. Os casos precisam de uma empresa
-- para testar "mesma pessoa duas vezes na mesma empresa".
INSERT INTO public.empresa_cadastro (tenant_id, razao_social, nome_fantasia, cnpj)
SELECT t.id, '[QA] Empresa Alfa (sintetica)', '[QA] Alfa', '00000000000191'
FROM public.tenants t
WHERE t.slug = 'qa-sandbox'
  AND NOT EXISTS (
    SELECT 1 FROM public.empresa_cadastro e
    WHERE e.tenant_id = t.id AND e.nome_fantasia = '[QA] Alfa'
  );

-- Uma segunda empresa: o COLAB-026 exige provar que a mesma pessoa PODE
-- existir em duas empresas do mesmo cliente.
INSERT INTO public.empresa_cadastro (tenant_id, razao_social, nome_fantasia, cnpj)
SELECT t.id, '[QA] Empresa Beta (sintetica)', '[QA] Beta', '00000000000272'
FROM public.tenants t
WHERE t.slug = 'qa-sandbox'
  AND NOT EXISTS (
    SELECT 1 FROM public.empresa_cadastro e
    WHERE e.tenant_id = t.id AND e.nome_fantasia = '[QA] Beta'
  );

-- ─────────────────────────────────────────────────────────
-- 2) A TRAVA — a rede que não depende de o robô estar certo
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_sandbox_tenant_id()
RETURNS uuid
LANGUAGE sql STABLE
AS $$ SELECT id FROM public.tenants WHERE slug = 'qa-sandbox' $$;

COMMENT ON FUNCTION public.qa_sandbox_tenant_id() IS
  'Id do cercado de teste. Único lugar onde o robô de QA pode escrever.';

CREATE OR REPLACE FUNCTION public.qa_assert_sandbox(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql STABLE
AS $$
DECLARE v_sandbox uuid;
BEGIN
  v_sandbox := public.qa_sandbox_tenant_id();

  IF v_sandbox IS NULL THEN
    RAISE EXCEPTION 'QA ABORTADO: o cercado de teste (slug qa-sandbox) nao existe.';
  END IF;

  IF p_tenant_id IS NULL OR p_tenant_id <> v_sandbox THEN
    RAISE EXCEPTION
      'QA ABORTADO: tentativa de escrever FORA do cercado. Alvo: %, permitido: %. Nenhuma alteracao foi feita.',
      COALESCE(p_tenant_id::text,'(nulo)'), v_sandbox;
  END IF;
END $$;

COMMENT ON FUNCTION public.qa_assert_sandbox(uuid) IS
  'Trava de seguranca do robo de QA. Toda escrita passa por aqui. Estoura se o alvo nao for o cercado — a transacao inteira aborta e nada e gravado.';

-- ─────────────────────────────────────────────────────────
-- 3) ONDE O RESULTADO FICA
-- ─────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.qa_disparo AS ENUM ('manual','agendado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.qa_situacao AS ENUM (
    'passou',            -- o sistema se comportou como o caso descreve
    'falhou',            -- o sistema fez diferente do que o caso descreve
    'nao_implementado',  -- o caso existe, a rotina que o executa nao
    'erro'               -- a rotina quebrou (problema do robo, nao do sistema)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Uma linha por bateria.
CREATE TABLE IF NOT EXISTS public.qa_execucoes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iniciada_em      timestamptz NOT NULL DEFAULT now(),
  terminada_em     timestamptz,
  disparo          public.qa_disparo NOT NULL DEFAULT 'manual',
  disparada_por    uuid REFERENCES public.usuarios_base(id),
  modulo_path      text,
  total            int NOT NULL DEFAULT 0,
  passou           int NOT NULL DEFAULT 0,
  falhou           int NOT NULL DEFAULT 0,
  nao_implementado int NOT NULL DEFAULT 0,
  erro             int NOT NULL DEFAULT 0,
  duracao_ms       int,
  observacao       text
);

CREATE INDEX IF NOT EXISTS qa_execucoes_iniciada_idx
  ON public.qa_execucoes(iniciada_em DESC);

-- Uma linha por caso, por bateria. É daqui que sai o relatório.
CREATE TABLE IF NOT EXISTS public.qa_resultados (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execucao_id    uuid NOT NULL REFERENCES public.qa_execucoes(id) ON DELETE CASCADE,
  caso_id        uuid REFERENCES public.qa_casos_teste(id) ON DELETE SET NULL,
  codigo         text NOT NULL,
  situacao       public.qa_situacao NOT NULL,
  duracao_ms     int,
  passo_ordem    int,      -- em qual passo parou
  passo_acao     text,     -- o que ele estava tentando fazer
  esperado       text,     -- o que o caso dizia que deveria acontecer
  obtido         text,     -- o que aconteceu de verdade
  erro_tecnico   text,     -- mensagem crua do banco, para diagnostico
  detalhe        jsonb,
  criado_em      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS qa_resultados_execucao_idx ON public.qa_resultados(execucao_id);
CREATE INDEX IF NOT EXISTS qa_resultados_codigo_idx   ON public.qa_resultados(codigo);

-- Só um resultado por caso por bateria.
CREATE UNIQUE INDEX IF NOT EXISTS qa_resultados_exec_codigo_uidx
  ON public.qa_resultados(execucao_id, codigo);

-- ─────────────────────────────────────────────────────────
-- 4) O GUARDA CONTRA DESCOLAMENTO
--    Documentação e rotina são dois artefatos. Eles descolam.
--    Esta view faz o descolamento aparecer em vez de apodrecer.
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.qa_implementacoes (
  codigo      text PRIMARY KEY,
  funcao_sql  text NOT NULL,
  ativo       boolean NOT NULL DEFAULT true,
  criado_em   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.qa_implementacoes IS
  'Liga cada caso documentado a rotina que o executa. Sem isto, documentacao e robo descolam em silencio.';

CREATE OR REPLACE VIEW public.qa_cobertura AS
SELECT
  c.codigo,
  c.titulo,
  c.prioridade,
  c.nivel,
  CASE
    WHEN i.codigo IS NULL THEN 'sem rotina — nao sera executado'
    WHEN NOT i.ativo      THEN 'rotina desativada'
    ELSE 'coberto'
  END AS cobertura,
  i.funcao_sql
FROM public.qa_casos_teste c
LEFT JOIN public.qa_implementacoes i ON i.codigo = c.codigo
WHERE c.status = 'aprovado';

COMMENT ON VIEW public.qa_cobertura IS
  'Todo caso aprovado que nao tem rotina aparece aqui. E a lista do que o robo NAO testa, apesar de documentado.';

-- ─────────────────────────────────────────────────────────
-- Conferência
-- ─────────────────────────────────────────────────────────
SELECT 'cercado criado'        AS item,
       COALESCE((SELECT nome FROM public.tenants WHERE slug='qa-sandbox'), '>>> FALHOU') AS valor
UNION ALL
SELECT 'empresas no cercado',
       (SELECT count(*)::text FROM public.empresa_cadastro
        WHERE tenant_id = public.qa_sandbox_tenant_id()) || '   (esperado: 2)'
UNION ALL
SELECT 'trava instalada',
       COALESCE(to_regprocedure('public.qa_assert_sandbox(uuid)')::text, '>>> FALHOU')
UNION ALL
SELECT 'tabela de baterias',
       COALESCE(to_regclass('public.qa_execucoes')::text, '>>> FALHOU')
UNION ALL
SELECT 'tabela de resultados',
       COALESCE(to_regclass('public.qa_resultados')::text, '>>> FALHOU')
UNION ALL
SELECT 'casos aprovados sem rotina ainda',
       (SELECT count(*)::text FROM public.qa_cobertura WHERE cobertura <> 'coberto')
       || '   (esperado: 23 — nenhuma rotina existe ainda)';
