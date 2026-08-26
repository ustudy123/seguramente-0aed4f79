-- =====================================================================
-- Camada de QA e2e (relatório do Cypress) — script de entrega
--
-- O QUE É: a estrutura que faz o resultado da suíte Cypress aparecer no
-- painel "Testes automatizados → Cypress". São objetos NOVOS em relação à
-- produção — a tabela qa_cobertura_e2e (ponte caso↔teste), a coluna
-- qa_resultados.evidencia_png, e três funções (qa_registrar_bateria_e2e,
-- qa_resultados_da_bateria, qa_anexar_print_e2e) — mais as 139 linhas de
-- ponte (que it() cobre qual caso). Já vivem no repositório e no ambiente
-- de TESTE (via migrations); faltam na PRODUÇÃO, e por isso faltam também
-- na HOMOLOGAÇÃO (que copia a estrutura da produção).
--
-- POR QUE VAI PARA A PRODUÇÃO (e não só para a homologação):
-- a conferência de fidelidade da homologação compara ESTRUTURA (tabelas,
-- funções, colunas...) com a produção. Instalar esta camada só na
-- homologação a faria divergir da produção — a conferência acusaria, e o
-- modo rápido (so_finalizar) passaria a reprovar. Colando na PRODUÇÃO, a
-- próxima cópia (RECRIAR) traz a camada junto: o painel funciona na
-- homologação E a fidelidade continua de pé.
--
-- SEGURANÇA: é andaime de QA, igual ao motor que já existe na produção.
-- Tabela fechada por RLS (só admin lê), funções SECURITY DEFINER com
-- EXECUTE só para service_role/authenticated. Nenhum dado de cliente é
-- lido, alterado ou exposto. Nenhuma tabela de negócio é tocada.
--
-- IDEMPOTENTE: rodar duas vezes não quebra nem duplica (IF NOT EXISTS,
-- CREATE OR REPLACE, ON CONFLICT em tudo). Roda inteiro em uma transação.
-- Termina com UMA conferência (o SQL Editor só mostra o último resultado).
-- =====================================================================


-- ===================================================================
-- FONTE: supabase/migrations/20260811131000_qa_ponte_cypress.sql
-- ===================================================================
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


-- ===================================================================
-- FONTE: supabase/migrations/20260811132000_qa_casos_tela_cypress.sql
-- ===================================================================
-- =====================================================================
-- Os 127 testes de tela que ja existiam viram casos documentados
--
-- Ate aqui a pasta cypress/e2e era um conjunto de testes que ninguem
-- via: rodavam (quando rodavam) fora do catalogo de QA, e o painel nao
-- sabia da existencia deles. Do outro lado, 92 casos marcados 'e2e'
-- esperavam spec que nunca chegou. Os dois lados nao se tocavam.
--
-- Esta migration documenta o lado que ja existe: um caso por it(), com
-- o prefixo TELA- (nenhuma familia do catalogo usa esse prefixo), mais
-- a linha em qa_cobertura_e2e que liga caso <-> teste. A partir daqui a
-- corrida do Cypress cai no relatorio com codigo, e qa_cobertura mostra
-- 'coberto por teste de tela' em vez de 'nao implementado'.
--
-- Os titulos sao os titulos reais dos it(), extraidos dos arquivos —
-- e por eles que a ponte casa o resultado. Renomear um it() sem mexer
-- aqui quebra a ligacao; a funcao qa_registrar_bateria_e2e denuncia
-- isso contando os testes sem caso na observacao da execucao.
--
-- Idempotente: rodar duas vezes nao duplica nem quebra.
-- =====================================================================

-- ─────────────────────────────────────────────────────────
-- psicossocial.cy.ts — 50 teste(s) -> saude-seguranca/psicossocial
-- ─────────────────────────────────────────────────────────
INSERT INTO public.qa_casos_teste
  (modulo_id, codigo, titulo, tipo, prioridade, status, nivel, objetivo, observacoes)
SELECT m.id, v.codigo, v.titulo,
       v.tipo::public.qa_caso_tipo,
       'media'::public.qa_prioridade,
       'aprovado'::public.qa_caso_status,
       'e2e',
       'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.',
       'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.'
FROM public.qa_modulos m
CROSS JOIN (VALUES
    ('TELA-PSICO-001', 'TC-01: Criar campanha psicossocial com dados válidos', 'feliz'),
    ('TELA-PSICO-002', 'TC-02: Assistente de seleção de instrumento é exibido', 'alternativo'),
    ('TELA-PSICO-003', 'TC-03: Bloquear criação sem Setor + Função', 'negativo'),
    ('TELA-PSICO-004', 'TC-04: Autocomplete de Setor + Função funciona', 'feliz'),
    ('TELA-PSICO-005', 'TC-05: Cadastrar novo Setor/Função inexistente', 'feliz'),
    ('TELA-PSICO-006', 'TC-06: Múltiplos pares Setor + Função', 'feliz'),
    ('TELA-PSICO-007', 'TC-07: Distribuição gera link, QR Code e mensagens', 'feliz'),
    ('TELA-PSICO-008', 'TC-08: Acesso ao questionário sem login', 'negativo'),
    ('TELA-PSICO-009', 'TC-09: Tela de verificação WhatsApp é exibida', 'alternativo'),
    ('TELA-PSICO-010', 'TC-10: Código WhatsApp inválido é rejeitado', 'negativo'),
    ('TELA-PSICO-011', 'TC-11: Duplicidade de respostas é bloqueada', 'negativo'),
    ('TELA-PSICO-012', 'TC-12: Anonimato das respostas', 'feliz'),
    ('TELA-PSICO-013', 'TC-13: Resultados exibidos com 5+ respondentes', 'alternativo'),
    ('TELA-PSICO-014', 'TC-14: Agrupamento automático por privacidade', 'alternativo'),
    ('TELA-PSICO-015', 'TC-15: Mensagem de dados insuficientes para confidencialidade', 'feliz'),
    ('TELA-PSICO-016', 'TC-16: Cálculo de IPS ao encerrar campanha', 'alternativo'),
    ('TELA-PSICO-017', 'TC-17: Classificação IPS por faixas', 'feliz'),
    ('TELA-PSICO-018', 'TC-18: Gráfico radar e análise interpretativa', 'feliz'),
    ('TELA-PSICO-019', 'TC-19: Exportação de relatório PDF', 'feliz'),
    ('TELA-PSICO-020', 'TC-20: Integração com GRO', 'feliz'),
    ('TELA-PSICO-021', 'TC-21: Vínculo risco x Setor + Função no GRO', 'feliz'),
    ('TELA-PSICO-022', 'TC-22: Plano 5W2H para risco Alto — 60 dias', 'feliz'),
    ('TELA-PSICO-023', 'TC-23: Plano 5W2H para risco Crítico — 30 dias', 'feliz'),
    ('TELA-PSICO-024', 'TC-24: Bloquear arquivamento de risco Alto sem plano', 'negativo'),
    ('TELA-PSICO-025', 'TC-25: Bloquear arquivamento de risco Crítico sem plano', 'negativo'),
    ('TELA-PSICO-026', 'TC-26: Recomendação de AET quando IPS < 65', 'feliz'),
    ('TELA-PSICO-027', 'TC-27: AET obrigatória quando IPS < 50', 'negativo'),
    ('TELA-PSICO-028', 'TC-28: Recomendação AET por múltiplos fatores críticos', 'feliz'),
    ('TELA-PSICO-029', 'TC-29: AET por recorrência de riscos', 'feliz'),
    ('TELA-PSICO-030', 'TC-30: Dados psicossociais no módulo Ergonomia', 'feliz'),
    ('TELA-PSICO-031', 'TC-31: Reavaliação exigida após ação concluída', 'feliz'),
    ('TELA-PSICO-032', 'TC-32: Histórico de evolução do IPS', 'feliz'),
    ('TELA-PSICO-033', 'TC-33: Inventário PGR consolidado', 'feliz'),
    ('TELA-PSICO-034', 'TC-34: Exportação PDF do inventário PGR', 'feliz'),
    ('TELA-PSICO-035', 'TC-35: Bloquear data fim anterior à data início', 'negativo'),
    ('TELA-PSICO-036', 'TC-36: Campanha expirada sem respostas não gera erro', 'negativo'),
    ('TELA-PSICO-037', 'TC-37: Grupo com 5 respondentes — resultado exibido', 'alternativo'),
    ('TELA-PSICO-038', 'TC-38: Fallback para nível setor com 4 respondentes na função', 'feliz'),
    ('TELA-PSICO-039', 'TC-39: Empresa pequena — agrupamento seguro', 'alternativo'),
    ('TELA-PSICO-040', 'TC-40: Link inativo após encerramento da campanha', 'feliz'),
    ('TELA-PSICO-041', 'TC-41: Erro controlado na falha de envio WhatsApp', 'negativo'),
    ('TELA-PSICO-042', 'TC-42: Encerramento manual antecipado permitido', 'feliz'),
    ('TELA-PSICO-043', 'TC-43: Impedir duplicidade de pares Setor + Função', 'negativo'),
    ('TELA-PSICO-044', 'TC-44: Risco Alto/Crítico sem 5W2H é defeito crítico', 'feliz'),
    ('TELA-PSICO-045', 'TC-45: IPS 65 classificado como Estável', 'feliz'),
    ('TELA-PSICO-046', 'TC-46: IPS 50 classificado como Atenção', 'feliz'),
    ('TELA-PSICO-047', 'TC-47: PDF mantém acentuação e caracteres especiais', 'feliz'),
    ('TELA-PSICO-048', 'TC-48: Acesso negado para usuário sem permissão', 'negativo'),
    ('TELA-PSICO-049', 'TC-EXTRA: Guia Rápido abre e fecha corretamente', 'alternativo'),
    ('TELA-PSICO-050', 'TC-EXTRA: Tabs do dashboard carregam sem erro', 'feliz')
) AS v(codigo, titulo, tipo)
WHERE m.path = 'saude-seguranca/psicossocial'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.qa_cobertura_e2e (codigo, spec, teste)
SELECT v.codigo, 'cypress/e2e/psicossocial.cy.ts', v.teste
FROM (VALUES
    ('TELA-PSICO-001', 'TC-01: Criar campanha psicossocial com dados válidos'),
    ('TELA-PSICO-002', 'TC-02: Assistente de seleção de instrumento é exibido'),
    ('TELA-PSICO-003', 'TC-03: Bloquear criação sem Setor + Função'),
    ('TELA-PSICO-004', 'TC-04: Autocomplete de Setor + Função funciona'),
    ('TELA-PSICO-005', 'TC-05: Cadastrar novo Setor/Função inexistente'),
    ('TELA-PSICO-006', 'TC-06: Múltiplos pares Setor + Função'),
    ('TELA-PSICO-007', 'TC-07: Distribuição gera link, QR Code e mensagens'),
    ('TELA-PSICO-008', 'TC-08: Acesso ao questionário sem login'),
    ('TELA-PSICO-009', 'TC-09: Tela de verificação WhatsApp é exibida'),
    ('TELA-PSICO-010', 'TC-10: Código WhatsApp inválido é rejeitado'),
    ('TELA-PSICO-011', 'TC-11: Duplicidade de respostas é bloqueada'),
    ('TELA-PSICO-012', 'TC-12: Anonimato das respostas'),
    ('TELA-PSICO-013', 'TC-13: Resultados exibidos com 5+ respondentes'),
    ('TELA-PSICO-014', 'TC-14: Agrupamento automático por privacidade'),
    ('TELA-PSICO-015', 'TC-15: Mensagem de dados insuficientes para confidencialidade'),
    ('TELA-PSICO-016', 'TC-16: Cálculo de IPS ao encerrar campanha'),
    ('TELA-PSICO-017', 'TC-17: Classificação IPS por faixas'),
    ('TELA-PSICO-018', 'TC-18: Gráfico radar e análise interpretativa'),
    ('TELA-PSICO-019', 'TC-19: Exportação de relatório PDF'),
    ('TELA-PSICO-020', 'TC-20: Integração com GRO'),
    ('TELA-PSICO-021', 'TC-21: Vínculo risco x Setor + Função no GRO'),
    ('TELA-PSICO-022', 'TC-22: Plano 5W2H para risco Alto — 60 dias'),
    ('TELA-PSICO-023', 'TC-23: Plano 5W2H para risco Crítico — 30 dias'),
    ('TELA-PSICO-024', 'TC-24: Bloquear arquivamento de risco Alto sem plano'),
    ('TELA-PSICO-025', 'TC-25: Bloquear arquivamento de risco Crítico sem plano'),
    ('TELA-PSICO-026', 'TC-26: Recomendação de AET quando IPS < 65'),
    ('TELA-PSICO-027', 'TC-27: AET obrigatória quando IPS < 50'),
    ('TELA-PSICO-028', 'TC-28: Recomendação AET por múltiplos fatores críticos'),
    ('TELA-PSICO-029', 'TC-29: AET por recorrência de riscos'),
    ('TELA-PSICO-030', 'TC-30: Dados psicossociais no módulo Ergonomia'),
    ('TELA-PSICO-031', 'TC-31: Reavaliação exigida após ação concluída'),
    ('TELA-PSICO-032', 'TC-32: Histórico de evolução do IPS'),
    ('TELA-PSICO-033', 'TC-33: Inventário PGR consolidado'),
    ('TELA-PSICO-034', 'TC-34: Exportação PDF do inventário PGR'),
    ('TELA-PSICO-035', 'TC-35: Bloquear data fim anterior à data início'),
    ('TELA-PSICO-036', 'TC-36: Campanha expirada sem respostas não gera erro'),
    ('TELA-PSICO-037', 'TC-37: Grupo com 5 respondentes — resultado exibido'),
    ('TELA-PSICO-038', 'TC-38: Fallback para nível setor com 4 respondentes na função'),
    ('TELA-PSICO-039', 'TC-39: Empresa pequena — agrupamento seguro'),
    ('TELA-PSICO-040', 'TC-40: Link inativo após encerramento da campanha'),
    ('TELA-PSICO-041', 'TC-41: Erro controlado na falha de envio WhatsApp'),
    ('TELA-PSICO-042', 'TC-42: Encerramento manual antecipado permitido'),
    ('TELA-PSICO-043', 'TC-43: Impedir duplicidade de pares Setor + Função'),
    ('TELA-PSICO-044', 'TC-44: Risco Alto/Crítico sem 5W2H é defeito crítico'),
    ('TELA-PSICO-045', 'TC-45: IPS 65 classificado como Estável'),
    ('TELA-PSICO-046', 'TC-46: IPS 50 classificado como Atenção'),
    ('TELA-PSICO-047', 'TC-47: PDF mantém acentuação e caracteres especiais'),
    ('TELA-PSICO-048', 'TC-48: Acesso negado para usuário sem permissão'),
    ('TELA-PSICO-049', 'TC-EXTRA: Guia Rápido abre e fecha corretamente'),
    ('TELA-PSICO-050', 'TC-EXTRA: Tabs do dashboard carregam sem erro')
) AS v(codigo, teste)
WHERE EXISTS (SELECT 1 FROM public.qa_casos_teste c WHERE c.codigo = v.codigo)
ON CONFLICT (codigo) DO UPDATE
  SET spec = EXCLUDED.spec, teste = EXCLUDED.teste, ativo = true;

-- ─────────────────────────────────────────────────────────
-- epi.cy.ts — 48 teste(s) -> saude-ocupacional/epi
-- ─────────────────────────────────────────────────────────
INSERT INTO public.qa_casos_teste
  (modulo_id, codigo, titulo, tipo, prioridade, status, nivel, objetivo, observacoes)
SELECT m.id, v.codigo, v.titulo,
       v.tipo::public.qa_caso_tipo,
       'media'::public.qa_prioridade,
       'aprovado'::public.qa_caso_status,
       'e2e',
       'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.',
       'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.'
FROM public.qa_modulos m
CROSS JOIN (VALUES
    ('TELA-EPI-001', 'CT-01: Cadastrar tipo de EPI com todos os campos obrigatórios', 'negativo'),
    ('TELA-EPI-002', 'CT-02: Bloquear cadastro de EPI sem CA', 'negativo'),
    ('TELA-EPI-003', 'CT-03: Bloquear cadastro de EPI com validade de CA inválida', 'negativo'),
    ('TELA-EPI-004', 'CT-04: Permitir cadastro com categoria padrão', 'feliz'),
    ('TELA-EPI-005', 'CT-05: Permitir cadastro com categoria personalizada', 'feliz'),
    ('TELA-EPI-006', 'CT-06: Registrar entrada manual no estoque', 'feliz'),
    ('TELA-EPI-007', 'CT-07: Registrar entrada por importação de XML NF-e', 'feliz'),
    ('TELA-EPI-008', 'CT-08: Validar composição do local em dois níveis', 'alternativo'),
    ('TELA-EPI-009', 'CT-09: Registrar entrega de EPI ao colaborador (wizard visível)', 'feliz'),
    ('TELA-EPI-010', 'CT-10: Wizard de entrega possui etapa de assinatura', 'feliz'),
    ('TELA-EPI-011', 'CT-11: Aba de histórico existe e registra movimentações', 'feliz'),
    ('TELA-EPI-012', 'CT-12: Sistema valida saldo antes da entrega', 'alternativo'),
    ('TELA-EPI-013', 'CT-13: Sistema bloqueia entrega com CA vencido', 'negativo'),
    ('TELA-EPI-014', 'CT-14: Botão/modal de devolução existe na lista de entregas', 'alternativo'),
    ('TELA-EPI-015', 'CT-15: Modal de devolução oferece destino Manutenção', 'feliz'),
    ('TELA-EPI-016', 'CT-16: Modal de devolução oferece destino Descarte', 'feliz'),
    ('TELA-EPI-017', 'CT-17: Devolução exige campo de observação', 'feliz'),
    ('TELA-EPI-018', 'CT-18: Aba de alertas exibe alertas de CA vencido', 'alternativo'),
    ('TELA-EPI-019', 'CT-19: Aba de alertas detecta estoque baixo', 'feliz'),
    ('TELA-EPI-020', 'CT-20: Alertas incluem EPIs próximos do vencimento', 'feliz'),
    ('TELA-EPI-021', 'CT-21: Alertas incluem atraso de troca', 'feliz'),
    ('TELA-EPI-022', 'CT-22: Dashboard de saldo por local é exibido', 'alternativo'),
    ('TELA-EPI-023', 'CT-23: Formulário de transferência está disponível', 'feliz'),
    ('TELA-EPI-024', 'CT-24: Aba Matriz de proteção é acessível', 'feliz'),
    ('TELA-EPI-025', 'CT-25: Matriz identifica pendências de EPI', 'feliz'),
    ('TELA-EPI-026', 'CT-26: Wizard de entrega acessa dados da matriz', 'feliz'),
    ('TELA-EPI-027', 'CT-27: Histórico de movimentações possui dados tabulares', 'feliz'),
    ('TELA-EPI-028', 'CT-28: Aba de auditoria IA está acessível', 'feliz'),
    ('TELA-EPI-029', 'CT-29: Wizard gera comprovante com assinatura', 'feliz'),
    ('TELA-EPI-030', 'CT-30: Rastreabilidade via histórico de movimentações', 'feliz'),
    ('TELA-EPI-031', 'CT-31: Matriz evidencia gaps de fornecimento por função', 'feliz'),
    ('TELA-EPI-032', 'CT-32: Entrega valida CA e rastreabilidade', 'alternativo'),
    ('TELA-EPI-033', 'CT-33: Registro formal de entrega com aceite documentado', 'feliz'),
    ('TELA-EPI-034', 'CT-34: Periodicidade de troca gera alertas', 'feliz'),
    ('TELA-EPI-035', 'CT-35: Matriz exibe EPIs obrigatórios por função', 'negativo'),
    ('TELA-EPI-036', 'CT-36: CA duplicado é bloqueado no cadastro', 'negativo'),
    ('TELA-EPI-037', 'CT-37: Entrada com quantidade inválida é bloqueada', 'negativo'),
    ('TELA-EPI-038', 'CT-38: Entrega com quantidade zero é bloqueada', 'negativo'),
    ('TELA-EPI-039', 'CT-39: Colaborador inativo é bloqueado na entrega', 'negativo'),
    ('TELA-EPI-040', 'CT-40: Devolução só disponível para entregas ativas', 'feliz'),
    ('TELA-EPI-041', 'CT-41: Destino Estoque requer estado compatível', 'feliz'),
    ('TELA-EPI-042', 'CT-42: Toda alteração de saldo gera movimentação', 'feliz'),
    ('TELA-EPI-043', 'CT-43: Sistema trata EPIs sem estoque mínimo configurado', 'feliz'),
    ('TELA-EPI-044', 'CT-44: Sistema sinaliza funções sem matriz definida', 'feliz'),
    ('TELA-EPI-045', 'CT-45: XML inválido é rejeitado na importação', 'negativo'),
    ('TELA-EPI-046', 'CT-46: Entrega incompleta não gera baixa no estoque', 'negativo'),
    ('TELA-EPI-047', 'CT-47: Controle de concorrência impede saldo negativo', 'negativo'),
    ('TELA-EPI-048', 'CT-48: Alerta preventivo sem bloqueio para EPI próximo do vencimento', 'negativo')
) AS v(codigo, titulo, tipo)
WHERE m.path = 'saude-ocupacional/epi'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.qa_cobertura_e2e (codigo, spec, teste)
SELECT v.codigo, 'cypress/e2e/epi.cy.ts', v.teste
FROM (VALUES
    ('TELA-EPI-001', 'CT-01: Cadastrar tipo de EPI com todos os campos obrigatórios'),
    ('TELA-EPI-002', 'CT-02: Bloquear cadastro de EPI sem CA'),
    ('TELA-EPI-003', 'CT-03: Bloquear cadastro de EPI com validade de CA inválida'),
    ('TELA-EPI-004', 'CT-04: Permitir cadastro com categoria padrão'),
    ('TELA-EPI-005', 'CT-05: Permitir cadastro com categoria personalizada'),
    ('TELA-EPI-006', 'CT-06: Registrar entrada manual no estoque'),
    ('TELA-EPI-007', 'CT-07: Registrar entrada por importação de XML NF-e'),
    ('TELA-EPI-008', 'CT-08: Validar composição do local em dois níveis'),
    ('TELA-EPI-009', 'CT-09: Registrar entrega de EPI ao colaborador (wizard visível)'),
    ('TELA-EPI-010', 'CT-10: Wizard de entrega possui etapa de assinatura'),
    ('TELA-EPI-011', 'CT-11: Aba de histórico existe e registra movimentações'),
    ('TELA-EPI-012', 'CT-12: Sistema valida saldo antes da entrega'),
    ('TELA-EPI-013', 'CT-13: Sistema bloqueia entrega com CA vencido'),
    ('TELA-EPI-014', 'CT-14: Botão/modal de devolução existe na lista de entregas'),
    ('TELA-EPI-015', 'CT-15: Modal de devolução oferece destino Manutenção'),
    ('TELA-EPI-016', 'CT-16: Modal de devolução oferece destino Descarte'),
    ('TELA-EPI-017', 'CT-17: Devolução exige campo de observação'),
    ('TELA-EPI-018', 'CT-18: Aba de alertas exibe alertas de CA vencido'),
    ('TELA-EPI-019', 'CT-19: Aba de alertas detecta estoque baixo'),
    ('TELA-EPI-020', 'CT-20: Alertas incluem EPIs próximos do vencimento'),
    ('TELA-EPI-021', 'CT-21: Alertas incluem atraso de troca'),
    ('TELA-EPI-022', 'CT-22: Dashboard de saldo por local é exibido'),
    ('TELA-EPI-023', 'CT-23: Formulário de transferência está disponível'),
    ('TELA-EPI-024', 'CT-24: Aba Matriz de proteção é acessível'),
    ('TELA-EPI-025', 'CT-25: Matriz identifica pendências de EPI'),
    ('TELA-EPI-026', 'CT-26: Wizard de entrega acessa dados da matriz'),
    ('TELA-EPI-027', 'CT-27: Histórico de movimentações possui dados tabulares'),
    ('TELA-EPI-028', 'CT-28: Aba de auditoria IA está acessível'),
    ('TELA-EPI-029', 'CT-29: Wizard gera comprovante com assinatura'),
    ('TELA-EPI-030', 'CT-30: Rastreabilidade via histórico de movimentações'),
    ('TELA-EPI-031', 'CT-31: Matriz evidencia gaps de fornecimento por função'),
    ('TELA-EPI-032', 'CT-32: Entrega valida CA e rastreabilidade'),
    ('TELA-EPI-033', 'CT-33: Registro formal de entrega com aceite documentado'),
    ('TELA-EPI-034', 'CT-34: Periodicidade de troca gera alertas'),
    ('TELA-EPI-035', 'CT-35: Matriz exibe EPIs obrigatórios por função'),
    ('TELA-EPI-036', 'CT-36: CA duplicado é bloqueado no cadastro'),
    ('TELA-EPI-037', 'CT-37: Entrada com quantidade inválida é bloqueada'),
    ('TELA-EPI-038', 'CT-38: Entrega com quantidade zero é bloqueada'),
    ('TELA-EPI-039', 'CT-39: Colaborador inativo é bloqueado na entrega'),
    ('TELA-EPI-040', 'CT-40: Devolução só disponível para entregas ativas'),
    ('TELA-EPI-041', 'CT-41: Destino Estoque requer estado compatível'),
    ('TELA-EPI-042', 'CT-42: Toda alteração de saldo gera movimentação'),
    ('TELA-EPI-043', 'CT-43: Sistema trata EPIs sem estoque mínimo configurado'),
    ('TELA-EPI-044', 'CT-44: Sistema sinaliza funções sem matriz definida'),
    ('TELA-EPI-045', 'CT-45: XML inválido é rejeitado na importação'),
    ('TELA-EPI-046', 'CT-46: Entrega incompleta não gera baixa no estoque'),
    ('TELA-EPI-047', 'CT-47: Controle de concorrência impede saldo negativo'),
    ('TELA-EPI-048', 'CT-48: Alerta preventivo sem bloqueio para EPI próximo do vencimento')
) AS v(codigo, teste)
WHERE EXISTS (SELECT 1 FROM public.qa_casos_teste c WHERE c.codigo = v.codigo)
ON CONFLICT (codigo) DO UPDATE
  SET spec = EXCLUDED.spec, teste = EXCLUDED.teste, ativo = true;

-- ─────────────────────────────────────────────────────────
-- incidentes-acidentes.cy.ts — 9 teste(s) -> saude-seguranca/incidentes-acidentes
-- ─────────────────────────────────────────────────────────
INSERT INTO public.qa_casos_teste
  (modulo_id, codigo, titulo, tipo, prioridade, status, nivel, objetivo, observacoes)
SELECT m.id, v.codigo, v.titulo,
       v.tipo::public.qa_caso_tipo,
       'media'::public.qa_prioridade,
       'aprovado'::public.qa_caso_status,
       'e2e',
       'Teste de tela ja existente em cypress/e2e/incidentes-acidentes.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.',
       'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.'
FROM public.qa_modulos m
CROSS JOIN (VALUES
    ('TELA-INC-001', 'carrega o módulo e todas as abas principais', 'feliz'),
    ('TELA-INC-002', 'aplica filtros da aba ocorrências', 'alternativo'),
    ('TELA-INC-003', 'cadastra um incidente com colaborador manual', 'feliz'),
    ('TELA-INC-004', 'cadastra um acidente com CAT emitida', 'feliz'),
    ('TELA-INC-005', 'cadastra um acidente sem CAT emitida', 'feliz'),
    ('TELA-INC-006', 'abre detalhes por linha, volta e usa ações do detalhe', 'alternativo'),
    ('TELA-INC-007', 'abre edição pela tabela', 'alternativo'),
    ('TELA-INC-008', 'acessa a aba pirâmide, muda filtros e abre camadas', 'alternativo'),
    ('TELA-INC-009', 'abre o guia rápido', 'alternativo')
) AS v(codigo, titulo, tipo)
WHERE m.path = 'saude-seguranca/incidentes-acidentes'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.qa_cobertura_e2e (codigo, spec, teste)
SELECT v.codigo, 'cypress/e2e/incidentes-acidentes.cy.ts', v.teste
FROM (VALUES
    ('TELA-INC-001', 'carrega o módulo e todas as abas principais'),
    ('TELA-INC-002', 'aplica filtros da aba ocorrências'),
    ('TELA-INC-003', 'cadastra um incidente com colaborador manual'),
    ('TELA-INC-004', 'cadastra um acidente com CAT emitida'),
    ('TELA-INC-005', 'cadastra um acidente sem CAT emitida'),
    ('TELA-INC-006', 'abre detalhes por linha, volta e usa ações do detalhe'),
    ('TELA-INC-007', 'abre edição pela tabela'),
    ('TELA-INC-008', 'acessa a aba pirâmide, muda filtros e abre camadas'),
    ('TELA-INC-009', 'abre o guia rápido')
) AS v(codigo, teste)
WHERE EXISTS (SELECT 1 FROM public.qa_casos_teste c WHERE c.codigo = v.codigo)
ON CONFLICT (codigo) DO UPDATE
  SET spec = EXCLUDED.spec, teste = EXCLUDED.teste, ativo = true;

-- ─────────────────────────────────────────────────────────
-- swot.cy.ts — 19 teste(s) -> planejamento-gestao/planejamento-estrategico
-- ─────────────────────────────────────────────────────────
INSERT INTO public.qa_casos_teste
  (modulo_id, codigo, titulo, tipo, prioridade, status, nivel, objetivo, observacoes)
SELECT m.id, v.codigo, v.titulo,
       v.tipo::public.qa_caso_tipo,
       'media'::public.qa_prioridade,
       'aprovado'::public.qa_caso_status,
       'e2e',
       'Teste de tela ja existente em cypress/e2e/swot.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.',
       'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.'
FROM public.qa_modulos m
CROSS JOIN (VALUES
    ('TELA-SWOT-001', 'CT-SWOT-001 — Listar SWOTs do escopo', 'alternativo'),
    ('TELA-SWOT-002', 'CT-SWOT-002 — Estado vazio', 'negativo'),
    ('TELA-SWOT-003', 'CT-SWOT-003 — Troca de escopo', 'feliz'),
    ('TELA-SWOT-004', 'CT-SWOT-004 — Abrir SWOT clicando no card', 'feliz'),
    ('TELA-SWOT-005', 'CT-SWOT-010 — Criar SWOT (caminho feliz)', 'feliz'),
    ('TELA-SWOT-006', 'CT-SWOT-011 — Título obrigatório', 'negativo'),
    ('TELA-SWOT-007', 'CT-SWOT-012 — Período inválido (formato)', 'negativo'),
    ('TELA-SWOT-008', 'CT-SWOT-013 — Fechar modal com dados preenchidos', 'feliz'),
    ('TELA-SWOT-009', 'CT-SWOT-014 — Duplo clique no Criar Análise', 'feliz'),
    ('TELA-SWOT-010', 'CT-SWOT-020 — Adicionar item em Força', 'feliz'),
    ('TELA-SWOT-011', 'CT-SWOT-021 — Adicionar item em cada quadrante', 'feliz'),
    ('TELA-SWOT-012', 'CT-SWOT-022 — Campos obrigatórios para item (descrição vazia)', 'negativo'),
    ('TELA-SWOT-013', 'CT-SWOT-023 — Limites de texto (BVA)', 'feliz'),
    ('TELA-SWOT-014', 'CT-SWOT-024 — Excluir item', 'feliz'),
    ('TELA-SWOT-015', 'CT-SWOT-025 — Excluir SWOT', 'feliz'),
    ('TELA-SWOT-016', 'CT-SWOT-026 — Voltar da tela de detalhe', 'feliz'),
    ('TELA-SWOT-017', 'CT-SWOT-027 — Concorrência: adicionar itens em sequência rápida', 'feliz'),
    ('TELA-SWOT-018', 'CT-SWOT-028 — Concorrência: exclusão de item já removido (graceful)', 'feliz'),
    ('TELA-SWOT-019', 'CT-SWOT-029 — Resiliência: UI não trava após operações', 'negativo')
) AS v(codigo, titulo, tipo)
WHERE m.path = 'planejamento-gestao/planejamento-estrategico'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.qa_cobertura_e2e (codigo, spec, teste)
SELECT v.codigo, 'cypress/e2e/swot.cy.ts', v.teste
FROM (VALUES
    ('TELA-SWOT-001', 'CT-SWOT-001 — Listar SWOTs do escopo'),
    ('TELA-SWOT-002', 'CT-SWOT-002 — Estado vazio'),
    ('TELA-SWOT-003', 'CT-SWOT-003 — Troca de escopo'),
    ('TELA-SWOT-004', 'CT-SWOT-004 — Abrir SWOT clicando no card'),
    ('TELA-SWOT-005', 'CT-SWOT-010 — Criar SWOT (caminho feliz)'),
    ('TELA-SWOT-006', 'CT-SWOT-011 — Título obrigatório'),
    ('TELA-SWOT-007', 'CT-SWOT-012 — Período inválido (formato)'),
    ('TELA-SWOT-008', 'CT-SWOT-013 — Fechar modal com dados preenchidos'),
    ('TELA-SWOT-009', 'CT-SWOT-014 — Duplo clique no Criar Análise'),
    ('TELA-SWOT-010', 'CT-SWOT-020 — Adicionar item em Força'),
    ('TELA-SWOT-011', 'CT-SWOT-021 — Adicionar item em cada quadrante'),
    ('TELA-SWOT-012', 'CT-SWOT-022 — Campos obrigatórios para item (descrição vazia)'),
    ('TELA-SWOT-013', 'CT-SWOT-023 — Limites de texto (BVA)'),
    ('TELA-SWOT-014', 'CT-SWOT-024 — Excluir item'),
    ('TELA-SWOT-015', 'CT-SWOT-025 — Excluir SWOT'),
    ('TELA-SWOT-016', 'CT-SWOT-026 — Voltar da tela de detalhe'),
    ('TELA-SWOT-017', 'CT-SWOT-027 — Concorrência: adicionar itens em sequência rápida'),
    ('TELA-SWOT-018', 'CT-SWOT-028 — Concorrência: exclusão de item já removido (graceful)'),
    ('TELA-SWOT-019', 'CT-SWOT-029 — Resiliência: UI não trava após operações')
) AS v(codigo, teste)
WHERE EXISTS (SELECT 1 FROM public.qa_casos_teste c WHERE c.codigo = v.codigo)
ON CONFLICT (codigo) DO UPDATE
  SET spec = EXCLUDED.spec, teste = EXCLUDED.teste, ativo = true;

-- ─────────────────────────────────────────────────────────
-- importar-colaboradores.cy.ts — 1 teste(s) -> estrutura-organizacional/colaboradores
-- ─────────────────────────────────────────────────────────
INSERT INTO public.qa_casos_teste
  (modulo_id, codigo, titulo, tipo, prioridade, status, nivel, objetivo, observacoes)
SELECT m.id, v.codigo, v.titulo,
       v.tipo::public.qa_caso_tipo,
       'media'::public.qa_prioridade,
       'aprovado'::public.qa_caso_status,
       'e2e',
       'Teste de tela ja existente em cypress/e2e/importar-colaboradores.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.',
       'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.'
FROM public.qa_modulos m
CROSS JOIN (VALUES
    ('TELA-IMPORT-001', 'deve abrir o modal de importação ao clicar no botão ''Importar Colaboradores'' em qualquer aba', 'feliz')
) AS v(codigo, titulo, tipo)
WHERE m.path = 'estrutura-organizacional/colaboradores'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.qa_cobertura_e2e (codigo, spec, teste)
SELECT v.codigo, 'cypress/e2e/importar-colaboradores.cy.ts', v.teste
FROM (VALUES
    ('TELA-IMPORT-001', 'deve abrir o modal de importação ao clicar no botão ''Importar Colaboradores'' em qualquer aba')
) AS v(codigo, teste)
WHERE EXISTS (SELECT 1 FROM public.qa_casos_teste c WHERE c.codigo = v.codigo)
ON CONFLICT (codigo) DO UPDATE
  SET spec = EXCLUDED.spec, teste = EXCLUDED.teste, ativo = true;

-- Conferencia: quantos casos de tela ficaram documentados e ligados.
DO $conf$
DECLARE v_casos int; v_ligados int;
BEGIN
  SELECT count(*) INTO v_casos   FROM public.qa_casos_teste  WHERE codigo LIKE 'TELA-%';
  SELECT count(*) INTO v_ligados FROM public.qa_cobertura_e2e WHERE codigo LIKE 'TELA-%';
  RAISE NOTICE 'Casos de tela documentados: %; ligados a um it(): %.', v_casos, v_ligados;
END $conf$;


-- ===================================================================
-- FONTE: supabase/migrations/20260812140000_qa_e2e_evidencia_print.sql
-- ===================================================================
-- =====================================================================
-- Print da falha do Cypress embutido no painel de QA
--
-- Pedido: ver os prints das falhas DENTRO da própria página de QA, não
-- só na esteira. Em vez de mexer no Storage (bucket, RLS, URL assinada),
-- guardamos o PNG como base64 no próprio resultado do teste e a tela
-- mostra inline (data URI). Menos peças, e o print viaja junto do
-- resultado que já vai para o painel.
--
-- Só falha tem print (o Cypress só fotografa quando quebra). O envio é
-- limitado no lado do Cypress (tamanho por imagem e quantidade), então a
-- coluna não vira despejo de dados: em corrida verde, fica tudo NULL.
-- =====================================================================

ALTER TABLE public.qa_resultados
  ADD COLUMN IF NOT EXISTS evidencia_png text;

COMMENT ON COLUMN public.qa_resultados.evidencia_png IS
  'Print da falha (PNG em base64, sem prefixo data:). Preenchido só por corridas do Cypress, só em teste que falhou. NULL no resto.';

-- ─────────────────────────────────────────────────────────
-- qa_registrar_bateria_e2e — agora grava também o print
-- (CREATE OR REPLACE: reproduz a função inteira com a coluna nova)
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
      v_sem_caso := v_sem_caso + 1;
      CONTINUE;
    END IF;

    SELECT c.id INTO v_caso FROM public.qa_casos_teste c WHERE c.codigo = v_codigo;

    INSERT INTO public.qa_resultados
      (execucao_id, caso_id, codigo, situacao, passo_acao, esperado, obtido,
       erro_tecnico, duracao_ms, evidencia_png)
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
       NULLIF(v_item->>'duracao_ms', '')::int,
       NULLIF(v_item->>'evidencia_png', ''))
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

REVOKE ALL ON FUNCTION public.qa_registrar_bateria_e2e(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.qa_registrar_bateria_e2e(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.qa_registrar_bateria_e2e(jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.qa_registrar_bateria_e2e(jsonb) TO service_role;

-- ─────────────────────────────────────────────────────────
-- qa_resultados_da_bateria — devolve o print para a tela
-- Acrescentar uma coluna muda o tipo de retorno, e CREATE OR REPLACE
-- recusa isso ("cannot change return type"). Por isso DROP + CREATE.
-- É atômico dentro da transação da migration.
-- ─────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.qa_resultados_da_bateria(uuid);
CREATE OR REPLACE FUNCTION public.qa_resultados_da_bateria(p_execucao_id uuid)
RETURNS TABLE(
  codigo text, situacao text, passo_ordem int, passo_acao text,
  esperado text, obtido text, erro_tecnico text, duracao_ms int,
  titulo text, objetivo text, pre_condicoes text,
  passos jsonb, resultado_esperado text, observacoes text,
  evidencia_png text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.codigo, r.situacao::text, r.passo_ordem, r.passo_acao,
         r.esperado, r.obtido, r.erro_tecnico, r.duracao_ms,
         c.titulo, c.objetivo, c.pre_condicoes,
         c.passos, c.resultado_esperado, c.observacoes,
         r.evidencia_png
  FROM public.qa_resultados r
  LEFT JOIN public.qa_casos_teste c ON c.codigo = r.codigo
  WHERE r.execucao_id = p_execucao_id
    AND public.is_superadmin(auth.uid())
  ORDER BY
    CASE r.situacao WHEN 'falhou' THEN 0 WHEN 'erro' THEN 1
                    WHEN 'passou' THEN 2 ELSE 3 END,
    r.codigo;
$$;

REVOKE EXECUTE ON FUNCTION public.qa_resultados_da_bateria(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.qa_resultados_da_bateria(uuid) TO authenticated;

-- Conferência
SELECT 'coluna' AS item,
       (SELECT count(*) FROM information_schema.columns
        WHERE table_schema='public' AND table_name='qa_resultados'
          AND column_name='evidencia_png')::text AS valor
UNION ALL
SELECT 'qa_resultados_da_bateria devolve evidencia_png',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.routines
         WHERE routine_schema='public' AND routine_name='qa_resultados_da_bateria'
       ) THEN 'ok' ELSE 'FALTA' END;


-- ===================================================================
-- FONTE: supabase/migrations/20260812170000_qa_e2e_anexar_print.sql
-- ===================================================================
-- =====================================================================
-- Anexar o print da falha numa 2ª chamada, pequena e separada
--
-- Por que: a 1ª corrida com tudo junto (resultados + prints base64 no
-- MESMO corpo) deu HTTP 504 — o corpo de ~1,2 MB estoura o limite do
-- gateway e a função fica pendurada até o timeout de 150s.
--
-- Solução: desacoplar. O reporter manda os resultados primeiro (leve,
-- garante o pass/fail no painel) e recebe o id da execução; depois manda
-- CADA print numa chamada própria e pequena. Esta função é o destino
-- dessas chamadas: acha a linha do resultado por (execução, spec, teste)
-- e cola o print nela. Idempotente: reenviar sobrescreve.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.qa_anexar_print_e2e(
  p_execucao_id  uuid,
  p_spec         text,
  p_teste        text,
  p_evidencia_png text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_codigo text;
  v_n      int;
BEGIN
  IF p_evidencia_png IS NULL OR btrim(p_evidencia_png) = '' THEN
    RETURN false;
  END IF;

  -- O reporter conhece (spec, teste), não o código do caso — a ligação
  -- vive no banco. Resolve aqui, do mesmo jeito que a gravação faz.
  SELECT e.codigo INTO v_codigo
  FROM public.qa_cobertura_e2e e
  WHERE e.ativo AND e.spec = p_spec AND e.teste = p_teste;

  IF v_codigo IS NULL THEN
    RETURN false; -- teste sem caso documentado: não há linha para anexar
  END IF;

  UPDATE public.qa_resultados
  SET evidencia_png = p_evidencia_png
  WHERE execucao_id = p_execucao_id AND codigo = v_codigo;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n > 0;
END $$;

COMMENT ON FUNCTION public.qa_anexar_print_e2e(uuid, text, text, text) IS
  'Cola o print (PNG base64) numa linha de qa_resultados já criada, por (execucao, spec, teste). Chamada uma vez por print pela Edge Function, para o corpo ficar pequeno e não estourar o gateway.';

REVOKE ALL ON FUNCTION public.qa_anexar_print_e2e(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qa_anexar_print_e2e(uuid, text, text, text) TO service_role;

SELECT 'qa_anexar_print_e2e' AS funcao,
       to_regprocedure('public.qa_anexar_print_e2e(uuid, text, text, text)')::text AS existe;


-- ===================================================================
-- FONTE: supabase/migrations/20260819181500_qa_cobertura_desligamento_lote1.sql
-- ===================================================================
-- =====================================================================
-- Ponte QA ↔ Cypress — Desligamento, 1ª leva
--
-- Liga os casos e2e DOCUMENTADOS DESL-011 e DESL-012 aos it() reais do
-- novo spec cypress/e2e/desligamento.cy.ts. Sem esta ponte, a guarda
-- (scripts/verificar-cobertura-e2e.mjs) acusaria os it() novos como
-- "inventados" e reprovaria a esteira.
--
-- teste = título EXATO do it() (é por ele que a corrida casa o resultado).
-- Idempotente: rodar duas vezes não duplica.
-- =====================================================================

INSERT INTO public.qa_cobertura_e2e (codigo, spec, teste)
VALUES
  ('DESL-011', 'cypress/e2e/desligamento.cy.ts',
   'DESL-011: Data de desligamento não pode ser anterior à admissão'),
  ('DESL-012', 'cypress/e2e/desligamento.cy.ts',
   'DESL-012: Data de desligamento futura é bloqueada')
ON CONFLICT (codigo) DO NOTHING;


-- ===================================================================
-- FONTE: supabase/migrations/20260819181600_qa_cobertura_desligamento_lote2.sql
-- ===================================================================
-- =====================================================================
-- Ponte QA ↔ Cypress — Desligamento, 2ª leva
--
-- Liga os casos e2e DOCUMENTADOS DESL-010, DESL-020 e DESL-021 aos it()
-- reais do spec cypress/e2e/desligamento.cy.ts. Sem esta ponte, a guarda
-- (scripts/verificar-cobertura-e2e.mjs) acusaria os it() novos como
-- "inventados" e reprovaria a esteira.
--
-- Casos desta leva (validações de formulário, ZERO mutação no banco):
--   DESL-010 — Data de desligamento é obrigatória (botão desabilitado sem data)
--   DESL-020 — Motivo do desligamento é obrigatório (botão desabilitado sem motivo)
--   DESL-021 — Lista de motivos cobre as hipóteses legais de extinção
--
-- teste = título EXATO do it() (é por ele que a corrida casa o resultado).
-- Idempotente: rodar duas vezes não duplica.
-- =====================================================================

INSERT INTO public.qa_cobertura_e2e (codigo, spec, teste)
VALUES
  ('DESL-010', 'cypress/e2e/desligamento.cy.ts',
   'DESL-010: Data de desligamento é obrigatória'),
  ('DESL-020', 'cypress/e2e/desligamento.cy.ts',
   'DESL-020: Motivo do desligamento é obrigatório'),
  ('DESL-021', 'cypress/e2e/desligamento.cy.ts',
   'DESL-021: Motivos disponíveis cobrem as hipóteses legais de extinção')
ON CONFLICT (codigo) DO NOTHING;


-- ===================================================================
-- FONTE: supabase/migrations/20260819181700_qa_cobertura_empresa_lote1.sql
-- ===================================================================
-- =====================================================================
-- Ponte QA ↔ Cypress — Empresa (checklist de cadastro), 1ª leva
--
-- Liga os casos e2e DOCUMENTADOS EMP-014 e ENQ-018 aos it() reais do novo
-- spec cypress/e2e/empresa.cy.ts. Sem esta ponte, a guarda
-- (scripts/verificar-cobertura-e2e.mjs) acusaria os it() novos como
-- "inventados" e reprovaria a esteira.
--
-- Casos desta leva (obrigatoriedade condicional no checklist, ZERO mutação):
--   EMP-014 — Documento exigido acompanha o tipo de pessoa (CNPJ x CPF)
--   ENQ-018 — Mandato e membros viram obrigatórios com CIPA ativa
--
-- teste = título EXATO do it() (é por ele que a corrida casa o resultado).
-- Idempotente: rodar duas vezes não duplica.
-- =====================================================================

INSERT INTO public.qa_cobertura_e2e (codigo, spec, teste)
VALUES
  ('EMP-014', 'cypress/e2e/empresa.cy.ts',
   'EMP-014: Documento exigido acompanha o tipo de pessoa'),
  ('ENQ-018', 'cypress/e2e/empresa.cy.ts',
   'ENQ-018: Mandato e membros viram obrigatórios com CIPA ativa')
ON CONFLICT (codigo) DO NOTHING;


-- ===================================================================
-- FONTE: supabase/migrations/20260819181800_qa_cobertura_empresa_lote2.sql
-- ===================================================================
-- =====================================================================
-- Ponte QA ↔ Cypress — Empresa (checklist e hierarquia), 2ª leva
--
-- Liga os casos e2e DOCUMENTADOS CHK-001, CHK-003 e HIER-003 aos it()
-- reais do spec cypress/e2e/empresa.cy.ts. Sem esta ponte, a guarda
-- (scripts/verificar-cobertura-e2e.mjs) acusaria os it() novos como
-- "inventados" e reprovaria a esteira.
--
-- Casos desta leva (ZERO mutação — só leem/alternam o formulário novo):
--   CHK-001  — Checklist reflete o preenchimento em tempo real
--   CHK-003  — Quantidade zero conta como preenchida
--   HIER-003 — Alternar entre matriz e filial limpa o vínculo anterior
--
-- teste = título EXATO do it() (é por ele que a corrida casa o resultado).
-- Idempotente: rodar duas vezes não duplica.
-- =====================================================================

INSERT INTO public.qa_cobertura_e2e (codigo, spec, teste)
VALUES
  ('CHK-001', 'cypress/e2e/empresa.cy.ts',
   'CHK-001: Checklist reflete o preenchimento em tempo real'),
  ('CHK-003', 'cypress/e2e/empresa.cy.ts',
   'CHK-003: Quantidade zero conta como preenchida'),
  ('HIER-003', 'cypress/e2e/empresa.cy.ts',
   'HIER-003: Alternar entre matriz e filial limpa o vínculo anterior')
ON CONFLICT (codigo) DO NOTHING;


-- ===================================================================
-- FONTE: supabase/migrations/20260819181900_qa_cobertura_empresa_rascunho.sql
-- ===================================================================
-- =====================================================================
-- Ponte QA ↔ Cypress — Empresa (rascunho de cadastro), leva 5
--
-- Liga os casos e2e DOCUMENTADOS RASC-001 e RASC-004 aos it() reais do
-- spec cypress/e2e/empresa.cy.ts. Sem esta ponte, a guarda
-- (scripts/verificar-cobertura-e2e.mjs) acusaria os it() novos como
-- "inventados" e reprovaria a esteira.
--
-- Casos desta leva (rascunho vive só no localStorage — ZERO mutação no banco):
--   RASC-001 — Rascunho é restaurado ao voltar sem ter salvo
--   RASC-004 — Novo cadastro não herda rascunho de tentativa anterior
--
-- (RASC-002 "Descartar rascunho" não tem ação observável na tela — o
--  handleDescartarRascunho existe mas não está ligado a nenhum botão —,
--  então fica para o motor/ambiente local, não para teste de tela.)
--
-- teste = título EXATO do it(). Idempotente: rodar duas vezes não duplica.
-- =====================================================================

INSERT INTO public.qa_cobertura_e2e (codigo, spec, teste)
VALUES
  ('RASC-001', 'cypress/e2e/empresa.cy.ts',
   'RASC-001: Rascunho é restaurado ao voltar sem ter salvo'),
  ('RASC-004', 'cypress/e2e/empresa.cy.ts',
   'RASC-004: Novo cadastro não herda rascunho de tentativa anterior')
ON CONFLICT (codigo) DO NOTHING;


-- =====================================================================
-- Recarrega o cache do PostgREST (sem isto, a função recém-criada pode
-- responder "Could not find the function ... in the schema cache" até o
-- próximo reload automático) e confere a instalação numa ÚNICA saída.
-- =====================================================================
NOTIFY pgrst, 'reload schema';

SELECT
  to_regprocedure('public.qa_registrar_bateria_e2e(jsonb)')       IS NOT NULL AS fn_registrar_ok,
  to_regprocedure('public.qa_anexar_print_e2e(uuid,text,text,text)') IS NOT NULL AS fn_anexar_ok,
  to_regprocedure('public.qa_resultados_da_bateria(uuid)')        IS NOT NULL AS fn_resultados_ok,
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='qa_resultados'
            AND column_name='evidencia_png')                       AS coluna_print_ok,
  (SELECT count(*) FROM public.qa_cobertura_e2e)                   AS linhas_ponte;
