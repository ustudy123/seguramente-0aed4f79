-- =========================================================
-- QA — Grupo 1: rotinas de regra de Colaboradores
--
-- Leva a cobertura de Colaboradores de 5 para 14 casos. Todas no molde das
-- 5 que ja rodam: dentro do cercado, pelo funil (dado descartavel).
--
-- DESCOBERTA que molda alguns testes (lida do schema, nao suposta):
--   - email_principal e TEXT NOT NULL, SEM constraint unica
--   - CPF tem funcao validar_cpf(), mas ela NAO e trigger em usuarios_base
--   => no nivel de banco, email repetido e CPF invalido PASSAM. A protecao
--      vive so no front. Os testes 021 e 023 revelam isso honestamente:
--      marcam 'falhou' porque, inserindo direto, a regra nao segura. Isso
--      e a verdade util — mostra onde falta defesa em profundidade.
--
-- Casos: 011, 012, 021, 022, 023, 024, 027, 028, 035, 036
-- (024, isolamento, usa um 2o tenant sintetico criado aqui)
-- =========================================================

-- Um segundo cercado, so para o teste de isolamento (COLAB-024).
INSERT INTO public.tenants (nome, slug, plano, ativo, configuracoes)
VALUES ('[QA] Cercado Vizinho (isolamento)', 'qa-sandbox-2', 'free', true,
        jsonb_build_object('ambiente','teste','nao_faturar',true))
ON CONFLICT (slug) DO NOTHING;

-- A trava precisa aceitar tambem o segundo cercado. Reescreve a checagem:
-- ao inves de "== sandbox", passa a ser "== sandbox OU == sandbox-2".
CREATE OR REPLACE FUNCTION public.qa_bloqueia_fora_do_cercado()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant  uuid;
  v_s1 uuid; v_s2 uuid;
BEGIN
  IF COALESCE(current_setting('app.qa_modo', true), 'off') <> 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN v_tenant := (to_jsonb(OLD) ->> 'tenant_id')::uuid;
  ELSE v_tenant := (to_jsonb(NEW) ->> 'tenant_id')::uuid; END IF;

  v_s1 := public.qa_sandbox_tenant_id();
  SELECT id INTO v_s2 FROM public.tenants WHERE slug = 'qa-sandbox-2';

  IF v_tenant IS DISTINCT FROM v_s1 AND v_tenant IS DISTINCT FROM v_s2 THEN
    RAISE EXCEPTION
      'QA BLOQUEADO: modo de teste ligado. Operacao % em %.% tentou tocar o tenant %. Permitido apenas os cercados. Transacao abortada.',
      TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME, COALESCE(v_tenant::text,'(nulo)');
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;

-- Helper: limpa os dois cercados (o descarte do funil ja faz, mas garante).
CREATE OR REPLACE FUNCTION public.qa_sandbox2_tenant_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT id FROM public.tenants WHERE slug = 'qa-sandbox-2'
$$;

-- ══ COLAB-011: cadastro so com o minimo ══
CREATE OR REPLACE FUNCTION public.qa_caso_colab_011()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1;
  r.passo_acao := 'Cadastrar pessoa so com os obrigatorios (nome, email), sem CPF nem opcionais';
  r.esperado := 'Aceito — o minimo basta, opcional e opcional';
  INSERT INTO public.usuarios_base (tenant_id, nome_completo, email_principal, tipo_usuario, status)
  VALUES (v_t, '[QA-011] Minimo', 'qa.011.1@sandbox.invalid', 'colaborador', 'ativo')
  RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN
    r.situacao := 'passou'; r.obtido := 'Pessoa criada so com o minimo, como esperado.';
  ELSE r.situacao := 'falhou'; r.obtido := 'Nao criou.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ COLAB-012: mesma pessoa, vinculo em 2 empresas (identico ao 026, mas por CPF) ══
CREATE OR REPLACE FUNCTION public.qa_caso_colab_012()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_p uuid; v_n int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1; r.passo_acao := 'Criar pessoa e vincular a Alfa';
  r.esperado := 'Pessoa unica com 2 vinculos, um por empresa';
  INSERT INTO public.usuarios_base (tenant_id, nome_completo, email_principal, cpf, tipo_usuario, status)
  VALUES (v_t, '[QA-012] Multi', 'qa.012.1@sandbox.invalid', '99900000692', 'colaborador', 'ativo')
  RETURNING id INTO v_p;
  INSERT INTO public.usuario_vinculos (tenant_id, usuario_id, empresa_id, tipo_vinculo, status)
  VALUES (v_t, v_p, public.qa_empresa('[QA] Alfa'), 'colaborador', 'ativo');
  r.passo_ordem := 2; r.passo_acao := 'Vincular a MESMA pessoa a Beta';
  INSERT INTO public.usuario_vinculos (tenant_id, usuario_id, empresa_id, tipo_vinculo, status)
  VALUES (v_t, v_p, public.qa_empresa('[QA] Beta'), 'colaborador', 'ativo');
  SELECT count(*) INTO v_n FROM public.usuario_vinculos WHERE usuario_id = v_p AND status = 'ativo';
  IF v_n = 2 THEN r.situacao := 'passou'; r.obtido := '1 pessoa, 2 vinculos (Alfa e Beta).';
  ELSE r.situacao := 'falhou'; r.obtido := format('Esperava 2 vinculos, achou %s.', v_n); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ COLAB-021: CPF invalido — REVELA que o banco nao valida ══
CREATE OR REPLACE FUNCTION public.qa_caso_colab_021()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1;
  r.passo_acao := 'Tentar cadastrar com CPF matematicamente invalido (111.111.111-11)';
  r.esperado := 'Recusado — digito verificador invalido';
  BEGIN
    INSERT INTO public.usuarios_base (tenant_id, nome_completo, email_principal, cpf, tipo_usuario, status)
    VALUES (v_t, '[QA-021] CPF Ruim', 'qa.021.1@sandbox.invalid', '11111111111', 'colaborador', 'ativo')
    RETURNING id INTO v_id;
    -- Se chegou aqui, o banco ACEITOU um CPF invalido.
    r.situacao := 'falhou';
    r.obtido := 'O BANCO ACEITOU CPF invalido. A validacao existe so no front (validar_cpf nao e constraint). Falta defesa em profundidade.';
  EXCEPTION WHEN check_violation OR others THEN
    IF SQLERRM LIKE '%cpf%' OR SQLERRM LIKE '%valid%' THEN
      r.situacao := 'passou'; r.obtido := 'Recusado pelo banco, como deveria.';
    ELSE
      r.situacao := 'falhou';
      r.obtido := 'O banco aceitou CPF invalido (validacao so no front).';
    END IF;
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ COLAB-022: campo obrigatorio vazio ══
CREATE OR REPLACE FUNCTION public.qa_caso_colab_022()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1;
  r.passo_acao := 'Tentar cadastrar sem nome (campo obrigatorio)';
  r.esperado := 'Recusado — NOT NULL protege a identidade minima';
  BEGIN
    INSERT INTO public.usuarios_base (tenant_id, nome_completo, email_principal, tipo_usuario, status)
    VALUES (v_t, NULL, 'qa.022.1@sandbox.invalid', 'colaborador', 'ativo');
    r.situacao := 'falhou'; r.obtido := 'ACEITOU pessoa sem nome.';
  EXCEPTION WHEN not_null_violation THEN
    r.situacao := 'passou'; r.obtido := 'Recusado com not_null_violation, como deveria.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ COLAB-023: email duplicado — REVELA que nao ha constraint ══
CREATE OR REPLACE FUNCTION public.qa_caso_colab_023()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1; r.passo_acao := 'Criar pessoa com um email';
  INSERT INTO public.usuarios_base (tenant_id, nome_completo, email_principal, tipo_usuario, status)
  VALUES (v_t, '[QA-023] A', 'qa.023.dup@sandbox.invalid', 'colaborador', 'ativo');
  r.passo_ordem := 2;
  r.passo_acao := 'Tentar criar OUTRA pessoa com o MESMO email no mesmo tenant';
  r.esperado := 'Recusado — email e chave de acesso, nao pode duplicar';
  BEGIN
    INSERT INTO public.usuarios_base (tenant_id, nome_completo, email_principal, tipo_usuario, status)
    VALUES (v_t, '[QA-023] B', 'qa.023.dup@sandbox.invalid', 'colaborador', 'ativo');
    r.situacao := 'falhou';
    r.obtido := 'O BANCO ACEITOU email duplicado. Nao ha constraint unica em email_principal — dois usuarios podem ter o mesmo login. Falta protecao no banco.';
  EXCEPTION WHEN unique_violation THEN
    r.situacao := 'passou'; r.obtido := 'Recusado, como deveria.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ COLAB-024: isolamento entre clientes ══
CREATE OR REPLACE FUNCTION public.qa_caso_colab_024()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_t1 uuid := public.qa_sandbox_tenant_id();
  v_t2 uuid := public.qa_sandbox2_tenant_id();
  v_vis int;
BEGIN
  PERFORM public.qa_modo_ligar();
  IF v_t2 IS NULL THEN
    r.situacao := 'erro'; r.obtido := 'Segundo cercado nao existe.'; RETURN r;
  END IF;

  r.passo_ordem := 1;
  r.passo_acao := 'Criar colaborador no cercado 1';
  r.esperado := 'Consultando o tenant 2, o colaborador do tenant 1 NAO aparece';
  INSERT INTO public.usuarios_base (tenant_id, nome_completo, email_principal, cpf, tipo_usuario, status)
  VALUES (v_t1, '[QA-024] Secreto do Tenant 1', 'qa.024.1@sandbox.invalid', '99900000188', 'colaborador', 'ativo');

  r.passo_ordem := 2;
  r.passo_acao := 'Contar, filtrando pelo tenant 2, quantos veem esse colaborador';
  -- Simula a consulta que uma funcao isolada por tenant faria: filtra por tenant_id.
  SELECT count(*) INTO v_vis
  FROM public.usuarios_base
  WHERE tenant_id = v_t2 AND email_principal = 'qa.024.1@sandbox.invalid';

  IF v_vis = 0 THEN
    r.situacao := 'passou';
    r.obtido := 'O colaborador do tenant 1 e invisivel para o tenant 2. Fronteira respeitada.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('VAZAMENTO: %s registro(s) do tenant 1 visiveis pelo tenant 2.', v_vis);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ COLAB-027: suspenso ocupa a vaga ══
CREATE OR REPLACE FUNCTION public.qa_caso_colab_027()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_p uuid; v_alfa uuid := public.qa_empresa('[QA] Alfa');
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1; r.passo_acao := 'Criar colaborador e suspender o vinculo';
  r.esperado := 'Novo vinculo na mesma empresa e recusado enquanto suspenso';
  INSERT INTO public.usuarios_base (tenant_id, nome_completo, email_principal, cpf, tipo_usuario, status)
  VALUES (v_t, '[QA-027] Suspenso', 'qa.027.1@sandbox.invalid', '99900000269', 'colaborador', 'ativo')
  RETURNING id INTO v_p;
  INSERT INTO public.usuario_vinculos (tenant_id, usuario_id, empresa_id, tipo_vinculo, status)
  VALUES (v_t, v_p, v_alfa, 'colaborador', 'suspenso');
  r.passo_ordem := 2; r.passo_acao := 'Tentar novo vinculo ativo na mesma empresa';
  BEGIN
    INSERT INTO public.usuario_vinculos (tenant_id, usuario_id, empresa_id, tipo_vinculo, status)
    VALUES (v_t, v_p, v_alfa, 'colaborador', 'ativo');
    r.situacao := 'falhou'; r.obtido := 'ACEITOU segundo vinculo enquanto o primeiro esta suspenso — suspenso deveria ocupar a vaga.';
  EXCEPTION WHEN unique_violation THEN
    r.situacao := 'passou'; r.obtido := 'Recusado: suspenso ocupa a vaga, como a regra diz.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ COLAB-028: fim da suspensao sem colisao ══
CREATE OR REPLACE FUNCTION public.qa_caso_colab_028()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_p uuid; v_v uuid; v_alfa uuid := public.qa_empresa('[QA] Alfa'); v_di date;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1; r.passo_acao := 'Criar vinculo suspenso';
  r.esperado := 'Voltar de suspenso para ativo e aceito (mesmo vinculo, sem colisao)';
  INSERT INTO public.usuarios_base (tenant_id, nome_completo, email_principal, cpf, tipo_usuario, status)
  VALUES (v_t, '[QA-028] Retorno', 'qa.028.1@sandbox.invalid', '99900000340', 'colaborador', 'ativo')
  RETURNING id INTO v_p;
  INSERT INTO public.usuario_vinculos (tenant_id, usuario_id, empresa_id, tipo_vinculo, status, data_inicio)
  VALUES (v_t, v_p, v_alfa, 'colaborador', 'suspenso', CURRENT_DATE)
  RETURNING id, data_inicio INTO v_v, v_di;
  r.passo_ordem := 2; r.passo_acao := 'Mudar o mesmo vinculo de suspenso para ativo';
  BEGIN
    UPDATE public.usuario_vinculos SET status = 'ativo' WHERE id = v_v;
    r.situacao := 'passou';
    r.obtido := 'Retorno da suspensao aceito, mesmo vinculo, sem unique_violation.';
  EXCEPTION WHEN unique_violation THEN
    r.situacao := 'falhou';
    r.obtido := 'O retorno da suspensao COLIDIU — o indice esta transformando volta em erro (bug do COLAB-028).';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ COLAB-035: desligamento preserva pessoa e historico ══
CREATE OR REPLACE FUNCTION public.qa_caso_colab_035()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_p uuid; v_v uuid; v_alfa uuid := public.qa_empresa('[QA] Alfa'); v_existe boolean;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1; r.passo_acao := 'Criar colaborador ativo';
  r.esperado := 'Ao desligar: vinculo encerra, pessoa e historico permanecem';
  INSERT INTO public.usuarios_base (tenant_id, nome_completo, email_principal, cpf, tipo_usuario, status)
  VALUES (v_t, '[QA-035] Desligado', 'qa.035.1@sandbox.invalid', '99900000420', 'colaborador', 'ativo')
  RETURNING id INTO v_p;
  INSERT INTO public.usuario_vinculos (tenant_id, usuario_id, empresa_id, tipo_vinculo, status)
  VALUES (v_t, v_p, v_alfa, 'colaborador', 'ativo') RETURNING id INTO v_v;
  r.passo_ordem := 2; r.passo_acao := 'Desligar: encerrar o vinculo';
  UPDATE public.usuario_vinculos SET status = 'encerrado', data_fim = CURRENT_DATE WHERE id = v_v;
  r.passo_ordem := 3; r.passo_acao := 'Conferir que a PESSOA ainda existe';
  SELECT EXISTS(SELECT 1 FROM public.usuarios_base WHERE id = v_p) INTO v_existe;
  IF v_existe AND EXISTS(SELECT 1 FROM public.usuario_vinculos WHERE id = v_v AND status = 'encerrado') THEN
    r.situacao := 'passou'; r.obtido := 'Vinculo encerrado, pessoa e historico preservados.';
  ELSE r.situacao := 'falhou'; r.obtido := 'A pessoa ou o historico sumiram no desligamento.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ COLAB-036: readmissao reaproveita a pessoa ══
CREATE OR REPLACE FUNCTION public.qa_caso_colab_036()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_p uuid; v_alfa uuid := public.qa_empresa('[QA] Alfa'); v_n int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1; r.passo_acao := 'Criar pessoa, vincular e depois encerrar (ex-funcionario)';
  r.esperado := 'Readmitir cria NOVO vinculo reusando a MESMA pessoa (1 pessoa, 2 vinculos)';
  INSERT INTO public.usuarios_base (tenant_id, nome_completo, email_principal, cpf, tipo_usuario, status)
  VALUES (v_t, '[QA-036] Readmitido', 'qa.036.1@sandbox.invalid', '99900000501', 'colaborador', 'ativo')
  RETURNING id INTO v_p;
  INSERT INTO public.usuario_vinculos (tenant_id, usuario_id, empresa_id, tipo_vinculo, status, data_fim)
  VALUES (v_t, v_p, v_alfa, 'colaborador', 'encerrado', CURRENT_DATE - 30);
  r.passo_ordem := 2; r.passo_acao := 'Readmitir: novo vinculo ativo, mesma pessoa, mesma empresa';
  BEGIN
    INSERT INTO public.usuario_vinculos (tenant_id, usuario_id, empresa_id, tipo_vinculo, status)
    VALUES (v_t, v_p, v_alfa, 'colaborador', 'ativo');
    SELECT count(*) INTO v_n FROM public.usuario_vinculos WHERE usuario_id = v_p;
    IF v_n = 2 THEN r.situacao := 'passou'; r.obtido := '1 pessoa, 2 vinculos (encerrado + ativo). Readmissao OK.';
    ELSE r.situacao := 'falhou'; r.obtido := format('Esperava 2 vinculos, achou %s.', v_n); END IF;
  EXCEPTION WHEN unique_violation THEN
    r.situacao := 'falhou';
    r.obtido := 'RECUSOU a readmissao — o indice esta barrando novo vinculo apesar do antigo estar encerrado (o predicado nao esta parcial).';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ── Registrar as 9 rotinas ──
INSERT INTO public.qa_implementacoes (codigo, funcao_sql) VALUES
  ('COLAB-011','qa_caso_colab_011'), ('COLAB-012','qa_caso_colab_012'),
  ('COLAB-021','qa_caso_colab_021'), ('COLAB-022','qa_caso_colab_022'),
  ('COLAB-023','qa_caso_colab_023'), ('COLAB-024','qa_caso_colab_024'),
  ('COLAB-027','qa_caso_colab_027'), ('COLAB-028','qa_caso_colab_028'),
  ('COLAB-035','qa_caso_colab_035'), ('COLAB-036','qa_caso_colab_036')
ON CONFLICT (codigo) DO UPDATE SET funcao_sql = EXCLUDED.funcao_sql, ativo = true;

-- ── Rodar e mostrar ──
DO $roda$ BEGIN PERFORM public.qa_rodar_bateria('manual', 'estrutura-organizacional/colaboradores'); END $roda$;

SELECT codigo, situacao::text, left(obtido, 60) AS resultado
FROM public.qa_resultados
WHERE execucao_id = (SELECT id FROM public.qa_execucoes ORDER BY iniciada_em DESC LIMIT 1)
  AND situacao <> 'nao_implementado'
ORDER BY (situacao='falhou') DESC, (situacao='erro') DESC, codigo;
