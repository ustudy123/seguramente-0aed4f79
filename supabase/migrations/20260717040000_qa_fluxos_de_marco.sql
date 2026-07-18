-- =========================================================
-- QA — Fluxos de março, dentro do cercado seguro
--
-- O agente de março (ai-qa-agent, 06/03) testava admissão, atestado e EPI
-- escrevendo DIRETO nas tabelas dos clientes reais, sem cercado e via IA.
-- Estes fluxos preservam O QUE ele testava e trocam COMO:
--
--   - rodam dentro do cercado (tenant [QA]), nunca em cliente real
--   - passam pelo funil qa_executar_descartavel: o dado nunca persiste
--   - são determinísticos: sem OpenAI, sem resultado que varia
--
-- Cada fluxo segue o padrão do agente original: cria -> verifica ->
-- altera -> verifica o EFEITO -> (o descarte do funil limpa tudo).
--
-- ANTES das rotinas: a trava precisa cobrir as tabelas novas. Hoje ela
-- cobre 3 (usuarios_base, usuario_vinculos, empresa_cadastro). Os fluxos
-- de março tocam admissoes, atestados, epis e epi_entregas — TODAS com
-- tenant_id, então a trava alcança. Só falta instalar o gatilho nelas.
-- =========================================================

-- ─────────────────────────────────────────────────────────
-- 1) ESTENDER A TRAVA às tabelas de março
-- ─────────────────────────────────────────────────────────
DO $trava$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT * FROM (VALUES
      ('admissoes',    'Fluxo admissao. Agente de marco INSERT/UPDATE/DELETE aqui.'),
      ('atestados',    'Fluxo atestado.'),
      ('epis',         'Fluxo EPI — estoque.'),
      ('epi_entregas', 'Fluxo EPI — entrega dispara baixa de estoque.')
    ) AS x(tabela, motivo)
  LOOP
    IF to_regclass('public.' || t.tabela) IS NULL THEN
      RAISE NOTICE 'Pulando %: nao existe.', t.tabela; CONTINUE;
    END IF;
    EXECUTE format('DROP TRIGGER IF EXISTS qa_guarda_cercado ON public.%I', t.tabela);
    EXECUTE format(
      'CREATE TRIGGER qa_guarda_cercado
         BEFORE INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.qa_bloqueia_fora_do_cercado()', t.tabela);
    INSERT INTO public.qa_tabelas_protegidas (tabela, motivo)
    VALUES (t.tabela, t.motivo) ON CONFLICT (tabela) DO UPDATE SET motivo = EXCLUDED.motivo;
    RAISE NOTICE 'Trava estendida a public.%', t.tabela;
  END LOOP;
END $trava$;

-- ─────────────────────────────────────────────────────────
-- FLUXO ADMISSÃO — ADM-001
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_caso_adm_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_id uuid; v_status text;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Criar admissao em andamento';
  r.esperado    := 'Admissao criada, status avanca para aprovado e persiste';
  INSERT INTO public.admissoes (tenant_id, nome_completo, cpf, email, cargo, status)
  VALUES (v_t, '[QA-ADM] Candidato Teste', '99900000188',
          'qa.adm.1@sandbox.invalid', 'Analista (teste)', 'rascunho')
  RETURNING id INTO v_id;

  r.passo_ordem := 2;
  r.passo_acao  := 'Verificar que a admissao existe com o status inicial';
  PERFORM 1 FROM public.admissoes WHERE id = v_id AND status = 'rascunho';
  IF NOT FOUND THEN
    r.situacao := 'falhou'; r.obtido := 'Admissao nao encontrada apos criar.';
    RETURN r;
  END IF;

  r.passo_ordem := 3;
  r.passo_acao  := 'Avancar o status da admissao para aprovada';
  UPDATE public.admissoes SET status = 'aprovado' WHERE id = v_id;

  r.passo_ordem := 4;
  r.passo_acao  := 'Confirmar que o novo status persistiu';
  SELECT status INTO v_status FROM public.admissoes WHERE id = v_id;
  IF v_status = 'aprovado' THEN
    r.situacao := 'passou';
    r.obtido   := 'Admissao criada, avancada para aprovado e persistida.';
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('Status esperado aprovado, obtido %s.', v_status);
  END IF;
  r.detalhe := jsonb_build_object('admissao_id', v_id);
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- ─────────────────────────────────────────────────────────
-- FLUXO ATESTADO — ATE-001
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_caso_ate_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_id uuid;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Registrar atestado medico';
  r.esperado    := 'Atestado criado e recuperavel';
  INSERT INTO public.atestados (tenant_id, colaborador_nome, tipo, data_emissao,
                                profissional_nome, profissional_registro)
  VALUES (v_t, '[QA-ATE] Colaborador', 'assistencial', CURRENT_DATE,
          '[QA] Dr. Teste', 'CRM-QA-0000')
  RETURNING id INTO v_id;

  r.passo_ordem := 2;
  r.passo_acao  := 'Verificar que o atestado foi gravado';
  PERFORM 1 FROM public.atestados WHERE id = v_id;
  IF FOUND THEN
    r.situacao := 'passou';
    r.obtido   := 'Atestado registrado e recuperado.';
  ELSE
    r.situacao := 'falhou';
    r.obtido   := 'Atestado nao encontrado apos criar.';
  END IF;
  r.detalhe := jsonb_build_object('atestado_id', v_id);
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- ─────────────────────────────────────────────────────────
-- FLUXO EPI — EPI-001: o mais rico. A entrega deve baixar o estoque.
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_caso_epi_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_tipo uuid; v_epi uuid; v_antes int; v_depois int;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Criar tipo de EPI e um item com estoque 100';
  r.esperado    := 'Apos entregar 2 unidades, o estoque cai para 98';

  INSERT INTO public.epi_tipos (tenant_id, nome)
  VALUES (v_t, '[QA-EPI] Luva Teste')
  RETURNING id INTO v_tipo;

  INSERT INTO public.epis (tenant_id, tipo_id, ca, quantidade_estoque, quantidade_minima)
  VALUES (v_t, v_tipo, 'CA-QA-0000', 100, 10)
  RETURNING id INTO v_epi;

  r.passo_ordem := 2;
  r.passo_acao  := 'Ler o estoque inicial';
  SELECT quantidade_estoque INTO v_antes FROM public.epis WHERE id = v_epi;

  r.passo_ordem := 3;
  r.passo_acao  := 'Registrar entrega de 2 unidades';
  INSERT INTO public.epi_entregas (tenant_id, epi_id, colaborador_nome, colaborador_cpf,
                                   quantidade, data_entrega, status)
  VALUES (v_t, v_epi, '[QA-EPI] Colaborador', '99900000269', 2, CURRENT_DATE, 'ativa');

  r.passo_ordem := 4;
  r.passo_acao  := 'Verificar se o estoque baixou de 100 para 98';
  SELECT quantidade_estoque INTO v_depois FROM public.epis WHERE id = v_epi;

  IF v_depois = v_antes - 2 THEN
    r.situacao := 'passou';
    r.obtido   := format('Estoque baixou de %s para %s. Trigger de entrega funciona.', v_antes, v_depois);
  ELSIF v_depois = v_antes THEN
    r.situacao := 'falhou';
    r.obtido   := format('Estoque continuou em %s. A entrega NAO baixou o estoque — trigger ausente ou quebrada.', v_depois);
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('Estoque foi de %s para %s (esperado %s).', v_antes, v_depois, v_antes - 2);
  END IF;
  r.detalhe := jsonb_build_object('epi_id', v_epi, 'antes', v_antes, 'depois', v_depois);
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- ─────────────────────────────────────────────────────────
-- Registrar os fluxos. Como nao ha modulo/casos documentados para eles
-- ainda, criamos os modulos e casos minimos para o motor enxergar.
-- ─────────────────────────────────────────────────────────
INSERT INTO public.qa_modulos (path, label)
VALUES ('rh-dp/admissao', 'Admissao'),
       ('saude-ocupacional/atestados', 'Atestados'),
       ('saude-ocupacional/epi', 'EPI')
ON CONFLICT (path) DO NOTHING;

INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, nivel, objetivo)
SELECT m.id, v.cod, v.tit, 'feliz', 'alta', 'aprovado', 'api', v.obj
FROM (VALUES
  ('rh-dp/admissao',            'ADM-001', 'Admissao: criar e avancar status', 'Ciclo basico de admissao, herdado do agente de marco.'),
  ('saude-ocupacional/atestados','ATE-001','Atestado: registrar e recuperar',  'Registro de atestado, herdado do agente de marco.'),
  ('saude-ocupacional/epi',     'EPI-001', 'EPI: entrega baixa o estoque',      'Entrega de EPI deve decrementar o estoque. Herdado do agente de marco.')
) AS v(path, cod, tit, obj)
JOIN public.qa_modulos m ON m.path = v.path
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.qa_implementacoes (codigo, funcao_sql) VALUES
  ('ADM-001', 'qa_caso_adm_001'),
  ('ATE-001', 'qa_caso_ate_001'),
  ('EPI-001', 'qa_caso_epi_001')
ON CONFLICT (codigo) DO UPDATE SET funcao_sql = EXCLUDED.funcao_sql, ativo = true;
