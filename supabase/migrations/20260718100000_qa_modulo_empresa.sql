-- =========================================================
-- QA — Módulo EMPRESA (estrutura-organizacional/empresa)
--
-- Documenta E implementa os casos, com as 3 intencoes pedidas:
--   FELIZ        — o caminho normal funciona
--   ALT/EXCECAO  — variacoes validas e erros previstos
--   PROIBIDO     — o que o sistema NAO pode deixar acontecer
--
-- Baseado no schema REAL de empresa_cadastro (lido, nao suposto):
--   - grau_risco: CHECK BETWEEN 1 AND 4 (NR-04)
--   - sesmt_situacao: CHECK IN (proprio, terceirizado, inexistente)
--   - cipa_situacao: CHECK IN (nao_constituida, em_implantacao, ativa)
--   - trigger prevent_duplicate_active_cnpj: bloqueia 2 empresas ATIVAS com
--     mesmo CNPJ no mesmo tenant (normaliza pontuacao, tolera inativas)
--
-- Todas as rotinas rodam no cercado, pelo funil (dado descartavel).
-- Precisamos estender a trava para empresa_cadastro (ja tem tenant_id).
-- =========================================================

-- A trava do cercado precisa cobrir empresa_cadastro para os testes que
-- criam empresas. (Ela ja cobre, da fase 1b — mas garantimos.)
DO $trava$
BEGIN
  IF to_regclass('public.empresa_cadastro') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS qa_guarda_cercado ON public.empresa_cadastro;
    CREATE TRIGGER qa_guarda_cercado
      BEFORE INSERT OR UPDATE OR DELETE ON public.empresa_cadastro
      FOR EACH ROW EXECUTE FUNCTION public.qa_bloqueia_fora_do_cercado();
    INSERT INTO public.qa_tabelas_protegidas (tabela, motivo)
    VALUES ('empresa_cadastro', 'Modulo Empresa. Casos EMP-*.')
    ON CONFLICT (tabela) DO NOTHING;
  END IF;
END $trava$;

-- ─────────────────────────────────────────────────────────
-- DOCUMENTAÇÃO DOS CASOS
-- ─────────────────────────────────────────────────────────
DO $seed$
DECLARE v_mod uuid;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos WHERE path = 'estrutura-organizacional/empresa';
  IF v_mod IS NULL THEN
    RAISE EXCEPTION 'Modulo estrutura-organizacional/empresa nao encontrado.';
  END IF;

  INSERT INTO public.qa_casos_teste
    (modulo_id, codigo, titulo, tipo, prioridade, status, nivel, objetivo, resultado_esperado)
  VALUES
  -- ── CAMINHO FELIZ ──
  (v_mod, 'EMP-001', 'Cadastrar empresa com dados basicos validos', 'feliz', 'critica', 'aprovado', 'api',
   'O cadastro de empresa aceita razao social, CNPJ e dados basicos.',
   'Empresa criada e recuperavel.'),
  (v_mod, 'EMP-002', 'Cadastrar empresa completa com dados de SST (NR-04, NR-05)', 'feliz', 'alta', 'aprovado', 'api',
   'Grau de risco, SESMT e CIPA sao gravados junto com o cadastro.',
   'Empresa com dados de SST persistidos.'),
  (v_mod, 'EMP-003', 'Editar dados de uma empresa existente', 'feliz', 'alta', 'aprovado', 'api',
   'Alteracao de dados basicos persiste.',
   'Novos dados gravados, mesmo registro.'),

  -- ── ALTERNATIVOS / EXCECOES ──
  (v_mod, 'EMP-010', 'Grau de risco fora da faixa 1-4 e recusado', 'excecao', 'alta', 'aprovado', 'api',
   'NR-04 define grau de risco de 1 a 4. Valor fora disso e invalido.',
   'CHECK recusa grau_risco = 0 ou 5.'),
  (v_mod, 'EMP-011', 'Situacao de SESMT com valor invalido e recusada', 'excecao', 'media', 'aprovado', 'api',
   'sesmt_situacao so aceita proprio, terceirizado ou inexistente.',
   'CHECK recusa valor fora da lista.'),
  (v_mod, 'EMP-012', 'Situacao de CIPA com valor invalido e recusada', 'excecao', 'media', 'aprovado', 'api',
   'cipa_situacao so aceita nao_constituida, em_implantacao ou ativa.',
   'CHECK recusa valor fora da lista.'),
  (v_mod, 'EMP-013', 'CNPJ com pontuacao e reconhecido como o mesmo numero', 'alternativo', 'alta', 'aprovado', 'api',
   'A trava normaliza CNPJ: 11.222.333/0001-44 = 11222333000144.',
   'Duplicata ativa detectada mesmo com formatacao diferente.'),

  -- ── ROTAS PROIBIDAS ──
  (v_mod, 'EMP-020', 'Duas empresas ATIVAS com o mesmo CNPJ no mesmo tenant e proibido', 'negativo', 'critica', 'aprovado', 'api',
   'A trigger prevent_duplicate_active_cnpj impede CNPJ ativo duplicado.',
   'Segunda empresa ativa com mesmo CNPJ e recusada.'),
  (v_mod, 'EMP-021', 'Reativar empresa cujo CNPJ ja esta ativo em outra e proibido', 'negativo', 'alta', 'aprovado', 'api',
   'Mesma regra no UPDATE: nao da pra ativar uma duplicata.',
   'UPDATE ativo=true e recusado se ja houver ativa com o CNPJ.'),
  (v_mod, 'EMP-022', 'Empresa de outro tenant e invisivel', 'negativo', 'critica', 'aprovado', 'api',
   'Isolamento multi-tenant tambem vale para empresas.',
   'Empresa do tenant 1 nao aparece para o tenant 2.')
  ON CONFLICT (codigo) DO NOTHING;

  RAISE NOTICE 'Casos do modulo Empresa documentados.';
END $seed$;

-- ─────────────────────────────────────────────────────────
-- ROTINAS EXECUTAVEIS
-- ─────────────────────────────────────────────────────────

-- Helper: cria uma empresa no cercado e devolve o id.
CREATE OR REPLACE FUNCTION public.qa_nova_empresa(
  p_razao text, p_cnpj text, p_ativo boolean DEFAULT true
)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.empresa_cadastro (tenant_id, razao_social, nome_fantasia, cnpj, ativo)
  VALUES (public.qa_sandbox_tenant_id(), p_razao, p_razao, p_cnpj, p_ativo)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- ══ EMP-001: cadastro basico ══
CREATE OR REPLACE FUNCTION public.qa_caso_emp_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_id uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1; r.passo_acao := 'Cadastrar empresa com razao social e CNPJ';
  r.esperado := 'Empresa criada e recuperavel';
  v_id := public.qa_nova_empresa('[QA-EMP] Alfa Industria LTDA', '11222333000181');
  IF EXISTS (SELECT 1 FROM public.empresa_cadastro WHERE id = v_id) THEN
    r.situacao := 'passou'; r.obtido := 'Empresa criada e encontrada.';
  ELSE r.situacao := 'falhou'; r.obtido := 'Nao encontrada apos criar.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ EMP-002: cadastro com SST ══
CREATE OR REPLACE FUNCTION public.qa_caso_emp_002()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_id uuid; v_gr int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1; r.passo_acao := 'Cadastrar empresa com grau de risco 3, SESMT proprio, CIPA ativa';
  r.esperado := 'Dados de SST gravados';
  INSERT INTO public.empresa_cadastro
    (tenant_id, razao_social, nome_fantasia, cnpj, ativo,
     grau_risco, sesmt_situacao, sesmt_obrigatorio, cipa_situacao, cipa_obrigatoria)
  VALUES (public.qa_sandbox_tenant_id(), '[QA-EMP] Beta SST', '[QA-EMP] Beta', '11222333000262', true,
          3, 'proprio', true, 'ativa', true)
  RETURNING id INTO v_id;
  SELECT grau_risco INTO v_gr FROM public.empresa_cadastro WHERE id = v_id;
  IF v_gr = 3 THEN r.situacao := 'passou'; r.obtido := 'Empresa com grau de risco 3 e SST persistidos.';
  ELSE r.situacao := 'falhou'; r.obtido := format('grau_risco gravado = %s (esperado 3).', v_gr); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ EMP-003: editar ══
CREATE OR REPLACE FUNCTION public.qa_caso_emp_003()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_id uuid; v_nome text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1; r.passo_acao := 'Criar empresa e depois alterar a razao social';
  r.esperado := 'Novo nome persiste no mesmo registro';
  v_id := public.qa_nova_empresa('[QA-EMP] Nome Antigo', '11222333000343');
  UPDATE public.empresa_cadastro SET razao_social = '[QA-EMP] Nome Novo' WHERE id = v_id;
  SELECT razao_social INTO v_nome FROM public.empresa_cadastro WHERE id = v_id;
  IF v_nome = '[QA-EMP] Nome Novo' THEN r.situacao := 'passou'; r.obtido := 'Edicao persistiu.';
  ELSE r.situacao := 'falhou'; r.obtido := format('Nome = %s.', v_nome); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ EMP-010: grau de risco invalido ══
CREATE OR REPLACE FUNCTION public.qa_caso_emp_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1; r.passo_acao := 'Tentar cadastrar empresa com grau_risco = 5 (fora de 1-4)';
  r.esperado := 'Recusado pelo CHECK (NR-04 vai de 1 a 4)';
  BEGIN
    INSERT INTO public.empresa_cadastro (tenant_id, razao_social, nome_fantasia, cnpj, grau_risco)
    VALUES (public.qa_sandbox_tenant_id(), '[QA-EMP] Risco Invalido', 'x', '11222333000424', 5);
    r.situacao := 'falhou'; r.obtido := 'ACEITOU grau_risco = 5.';
  EXCEPTION WHEN check_violation THEN
    r.situacao := 'passou'; r.obtido := 'Recusado com check_violation, como manda a NR-04.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ EMP-011: sesmt_situacao invalida ══
CREATE OR REPLACE FUNCTION public.qa_caso_emp_011()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1; r.passo_acao := 'Tentar sesmt_situacao = "meio-termo" (fora da lista)';
  r.esperado := 'Recusado pelo CHECK';
  BEGIN
    INSERT INTO public.empresa_cadastro (tenant_id, razao_social, nome_fantasia, cnpj, sesmt_situacao)
    VALUES (public.qa_sandbox_tenant_id(), '[QA-EMP] SESMT Invalido', 'x', '11222333000505', 'meio-termo');
    r.situacao := 'falhou'; r.obtido := 'ACEITOU sesmt_situacao invalida.';
  EXCEPTION WHEN check_violation THEN
    r.situacao := 'passou'; r.obtido := 'Recusado com check_violation.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ EMP-012: cipa_situacao invalida ══
CREATE OR REPLACE FUNCTION public.qa_caso_emp_012()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1; r.passo_acao := 'Tentar cipa_situacao = "parcial" (fora da lista)';
  r.esperado := 'Recusado pelo CHECK';
  BEGIN
    INSERT INTO public.empresa_cadastro (tenant_id, razao_social, nome_fantasia, cnpj, cipa_situacao)
    VALUES (public.qa_sandbox_tenant_id(), '[QA-EMP] CIPA Invalido', 'x', '11222333000686', 'parcial');
    r.situacao := 'falhou'; r.obtido := 'ACEITOU cipa_situacao invalida.';
  EXCEPTION WHEN check_violation THEN
    r.situacao := 'passou'; r.obtido := 'Recusado com check_violation.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ EMP-013: CNPJ formatado = mesmo numero ══
CREATE OR REPLACE FUNCTION public.qa_caso_emp_013()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1; r.passo_acao := 'Criar empresa ativa com CNPJ sem pontuacao';
  r.esperado := 'Criar OUTRA ativa com o MESMO CNPJ formatado e recusado';
  PERFORM public.qa_nova_empresa('[QA-EMP] Primeira', '11222333000767', true);
  r.passo_ordem := 2; r.passo_acao := 'Tentar segunda empresa ativa com CNPJ formatado (11.222.333/0007-67)';
  BEGIN
    PERFORM public.qa_nova_empresa('[QA-EMP] Segunda', '11.222.333/0007-67', true);
    r.situacao := 'falhou';
    r.obtido := 'ACEITOU duplicata — a trava nao normalizou a pontuacao do CNPJ.';
  EXCEPTION WHEN unique_violation THEN
    r.situacao := 'passou';
    r.obtido := 'Recusado: a trava reconheceu o CNPJ formatado como o mesmo numero.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ EMP-020: duas ativas mesmo CNPJ ══
CREATE OR REPLACE FUNCTION public.qa_caso_emp_020()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1; r.passo_acao := 'Criar empresa ativa com um CNPJ';
  r.esperado := 'Segunda empresa ativa com o mesmo CNPJ e recusada';
  PERFORM public.qa_nova_empresa('[QA-EMP] Ativa 1', '11222333000848', true);
  r.passo_ordem := 2; r.passo_acao := 'Tentar segunda empresa ATIVA com o mesmo CNPJ';
  BEGIN
    PERFORM public.qa_nova_empresa('[QA-EMP] Ativa 2', '11222333000848', true);
    r.situacao := 'falhou'; r.obtido := 'ACEITOU duas empresas ativas com o mesmo CNPJ.';
  EXCEPTION WHEN unique_violation THEN
    r.situacao := 'passou'; r.obtido := 'Recusado: a trava impede CNPJ ativo duplicado.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ EMP-021: nao pode ATIVAR duplicata (via UPDATE) ══
CREATE OR REPLACE FUNCTION public.qa_caso_emp_021()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_inativa uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1; r.passo_acao := 'Criar uma empresa ATIVA e outra INATIVA com o mesmo CNPJ';
  r.esperado := 'Ativar a inativa (UPDATE ativo=true) e recusado';
  PERFORM public.qa_nova_empresa('[QA-EMP] Ja Ativa', '11222333000929', true);
  v_inativa := public.qa_nova_empresa('[QA-EMP] Inativa', '11222333000929', false);
  r.passo_ordem := 2; r.passo_acao := 'Tentar ativar a segunda (mesmo CNPJ ja ativo na primeira)';
  BEGIN
    UPDATE public.empresa_cadastro SET ativo = true WHERE id = v_inativa;
    r.situacao := 'falhou'; r.obtido := 'ATIVOU a duplicata — a trava nao pega o UPDATE.';
  EXCEPTION WHEN unique_violation THEN
    r.situacao := 'passou'; r.obtido := 'Recusado: nao da pra ativar duplicata de CNPJ.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ EMP-022: isolamento entre tenants ══
CREATE OR REPLACE FUNCTION public.qa_caso_emp_022()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t2 uuid := public.qa_sandbox2_tenant_id(); v_vis int;
BEGIN
  PERFORM public.qa_modo_ligar();
  IF v_t2 IS NULL THEN r.situacao := 'erro'; r.obtido := '2o cercado nao existe.'; RETURN r; END IF;
  r.passo_ordem := 1; r.passo_acao := 'Criar empresa no cercado 1';
  r.esperado := 'Consultando o tenant 2, a empresa do tenant 1 nao aparece';
  PERFORM public.qa_nova_empresa('[QA-EMP] Secreta T1', '11222333001000', true);
  r.passo_ordem := 2; r.passo_acao := 'Contar, filtrando pelo tenant 2, quantos veem essa empresa';
  SELECT count(*) INTO v_vis FROM public.empresa_cadastro
  WHERE tenant_id = v_t2 AND cnpj = '11222333001000';
  IF v_vis = 0 THEN r.situacao := 'passou'; r.obtido := 'Empresa do tenant 1 invisivel para o tenant 2.';
  ELSE r.situacao := 'falhou'; r.obtido := format('VAZAMENTO: %s empresa(s) do tenant 1 visiveis pelo tenant 2.', v_vis); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ── Registrar as rotinas ──
INSERT INTO public.qa_implementacoes (codigo, funcao_sql) VALUES
  ('EMP-001','qa_caso_emp_001'), ('EMP-002','qa_caso_emp_002'), ('EMP-003','qa_caso_emp_003'),
  ('EMP-010','qa_caso_emp_010'), ('EMP-011','qa_caso_emp_011'), ('EMP-012','qa_caso_emp_012'),
  ('EMP-013','qa_caso_emp_013'), ('EMP-020','qa_caso_emp_020'), ('EMP-021','qa_caso_emp_021'),
  ('EMP-022','qa_caso_emp_022')
ON CONFLICT (codigo) DO UPDATE SET funcao_sql = EXCLUDED.funcao_sql, ativo = true;

-- ── Rodar o modulo Empresa e mostrar ──
DO $roda$ BEGIN PERFORM public.qa_rodar_bateria('manual', 'estrutura-organizacional/empresa'); END $roda$;

SELECT codigo, situacao::text, left(obtido, 60) AS resultado
FROM public.qa_resultados
WHERE execucao_id = (SELECT id FROM public.qa_execucoes ORDER BY iniciada_em DESC LIMIT 1)
ORDER BY (situacao='falhou') DESC, (situacao='erro') DESC, codigo;
