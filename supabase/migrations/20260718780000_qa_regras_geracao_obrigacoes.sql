-- =========================================================
-- QA — REGRAS DE GERAÇÃO DE OBRIGAÇÕES A PARTIR DO CADASTRO
--
-- MOTIVO desta rodada (critica do Alexandre, e ela procede): os casos
-- anteriores testavam se o CAMPO GRAVA. "Grau de risco 3 e aceito" e um teste
-- fraco. A regra que importa e a CONSEQUENCIA: quando a empresa declara uma
-- condicao, o sistema gera a obrigacao correspondente?
--
-- O QUE FOI APURADO NO CODIGO:
--   Existe OBRIGACOES_TEMPLATES (src/types/empresa.ts) com 8 regras, cada uma
--   com uma condicao que le o cadastro e, quando verdadeira, indica uma
--   obrigacao a registrar:
--
--   1. Constituir CIPA          <- cipa_obrigatoria E situacao nao_constituida
--   2. Realizar eleicao da CIPA <- cipa_obrigatoria E situacao em_implantacao
--   3. Renovar mandato da CIPA  <- mandato vencido ou proximo do vencimento
--   4. Contratar/Adequar SESMT  <- sesmt_obrigatorio E situacao inexistente
--   5. Plano de adequacao PcD   <- pcd_obrigatoria E deficit (atual < exigida)
--   6. Plano de reducao do FAP  <- fap_atual > 1,5
--   7. Cumprir obrigacoes do TAC<- tac_possui
--   8. Avaliar grau de risco    <- grau 3 ou 4
--
--   A deteccao roda no FRONT, e a gravacao depende de o usuario clicar no
--   botao "Gerar Obrigacoes" na aba. NAO ha trigger no banco que faca isso.
--
-- O QUE ESTES CASOS TESTAM:
--   Para cada regra, montam um cadastro que satisfaz a condicao e verificam
--   se a obrigacao correspondente EXISTE. Como nao ha automacao no banco, o
--   esperado e que NAO exista — e e isso que os casos documentam, com o
--   impacto de negocio de cada lacuna.
--
--   Nao e defeito de codigo: a geracao por clique e uma decisao de produto
--   legitima (dar controle a quem cadastra). O ponto e outro: se ninguem
--   clicar, a empresa fica com obrigacoes legais nao registradas e nada
--   avisa. Os casos medem esse risco, regra a regra.
-- =========================================================

DO $seed$
DECLARE v_mod uuid;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos WHERE path='estrutura-organizacional/empresa';
  IF v_mod IS NULL THEN RAISE EXCEPTION 'Modulo empresa nao encontrado.'; END IF;

  INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, nivel, objetivo, pre_condicoes, passos, resultado_esperado, observacoes)
  VALUES

  (v_mod,'REGRA-001','Deficit de cota PcD gera obrigacao de adequacao','feliz','critica','aprovado','api',
   'Verificar a REGRA, nao o campo: quando a empresa tem cota PcD obrigatoria e esta em deficit '
   '(tem menos PcDs do que a lei exige), o sistema deve registrar a obrigacao "Plano de adequacao '
   'da cota PCD". Regra em OBRIGACOES_TEMPLATES: pcd_obrigatoria E quantidade_atual menor que '
   'quantidade_exigida. Base legal: Lei 8.213/91 art. 93. Importa porque uma empresa em deficit '
   'esta irregular perante a lei — e a obrigacao registrada e o que transforma isso em plano de '
   'contratacao com prazo e responsavel.',
   'Precisa existir uma empresa com cota PcD obrigatoria e deficit.',
   '[
     {"ordem":1,"acao":"Cadastrar empresa com 350 empregados","onde_na_tela":"Empresas > Obrigacoes de Inclusao","dados":"Total: 350 (faixa de 3%, cota exigida 11)","resultado_esperado":"Cota calculada: 11 PcDs exigidos"},
     {"ordem":2,"acao":"Informar que a empresa tem apenas 4 PcDs","onde_na_tela":"Campo Quantidade Atual de PcD","dados":"PcDs atuais: 4 (deficit de 7)","resultado_esperado":"A tela sinaliza situacao irregular com deficit de 7"},
     {"ordem":3,"acao":"Conferir a aba de obrigacoes","onde_na_tela":"Empresas > aba Obrigacoes","dados":"-","resultado_esperado":"Deveria haver a obrigacao \"Plano de adequacao da cota PCD\", categoria legal, subcategoria pcd, criticidade alta, base legal Lei 8.213/91 art. 93"}
   ]'::jsonb,
   'A obrigacao de adequacao da cota deveria estar registrada. RESULTADO REAL: nao existe. A regra '
   'e avaliada no front e a obrigacao so e criada quando alguem clica no botao "Gerar Obrigacoes" '
   'na aba. Sem esse clique, a empresa fica em deficit sem nenhum registro de conformidade.',
   'IMPACTO: o deficit de PcD e a irregularidade mais fiscalizada da Lei de Cotas, com multa por '
   'vaga nao preenchida. Se a obrigacao nao e registrada, ela nao aparece no painel de '
   'conformidade, nao gera acao no plano e ninguem e responsabilizado por resolver — a empresa '
   'descobre em fiscalizacao. '
   'DECISAO DE PRODUTO: a geracao por clique da controle a quem cadastra, o que e legitimo. As '
   'opcoes sao (a) gerar automaticamente por trigger quando a condicao se torna verdadeira, '
   '(b) manter o clique mas destacar na tela quantas obrigacoes detectadas ainda nao foram '
   'registradas, ou (c) uma rotina periodica que sincronize. Hoje o botao existe e mostra a '
   'contagem, mas nada impede que ninguem clique.'),

  (v_mod,'REGRA-002','CIPA obrigatoria e nao constituida gera obrigacao','feliz','alta','aprovado','api',
   'Verificar a REGRA: quando a empresa e obrigada a ter CIPA e a situacao e "nao constituida", o '
   'sistema deve registrar a obrigacao "Constituir CIPA". Regra em OBRIGACOES_TEMPLATES: '
   'cipa_obrigatoria E cipa_situacao = nao_constituida. Base legal: NR-05. Importa porque a '
   'ausencia de CIPA em empresa obrigada e infracao autuavel, e o registro da obrigacao e o que '
   'coloca isso na fila de resolucao.',
   'Precisa existir uma empresa com CIPA obrigatoria e nao constituida.',
   '[
     {"ordem":1,"acao":"Marcar a CIPA como obrigatoria para a empresa","onde_na_tela":"Empresas > Enquadramento Legal > CIPA","dados":"CIPA obrigatoria: sim","resultado_esperado":"Marcado"},
     {"ordem":2,"acao":"Informar a situacao como nao constituida","onde_na_tela":"Campo Situacao CIPA","dados":"Situacao: nao_constituida","resultado_esperado":"Situacao gravada"},
     {"ordem":3,"acao":"Conferir a aba de obrigacoes","onde_na_tela":"Empresas > aba Obrigacoes","dados":"-","resultado_esperado":"Deveria haver a obrigacao \"Constituir CIPA\", categoria sst, subcategoria cipa, criticidade alta, base legal NR-05"}
   ]'::jsonb,
   'A obrigacao de constituir CIPA deveria estar registrada. RESULTADO REAL: nao existe sem o '
   'clique em "Gerar Obrigacoes".',
   'IMPACTO: empresa obrigada a ter CIPA sem CIPA constituida e infracao a NR-05, autuavel em '
   'fiscalizacao. Sem a obrigacao registrada, nao ha prazo, responsavel nem acompanhamento — a '
   'pendencia existe no cadastro mas nao no painel de conformidade. Mesma decisao de produto do '
   'REGRA-001.'),

  (v_mod,'REGRA-003','SESMT obrigatorio e inexistente gera obrigacao critica','feliz','critica','aprovado','api',
   'Verificar a REGRA: quando o SESMT e obrigatorio e a situacao e "inexistente", o sistema deve '
   'registrar a obrigacao "Contratar/Adequar SESMT" com criticidade CRITICA — a mais alta entre '
   'todos os templates. Regra: sesmt_obrigatorio E sesmt_situacao = inexistente. Base legal: '
   'NR-04. Importa porque o SESMT e o servico especializado que responde pela seguranca do '
   'trabalho; sua ausencia em empresa obrigada e das infracoes mais graves.',
   'Precisa existir uma empresa com SESMT obrigatorio e inexistente.',
   '[
     {"ordem":1,"acao":"Marcar o SESMT como obrigatorio","onde_na_tela":"Empresas > Enquadramento Legal > SESMT","dados":"SESMT obrigatorio: sim","resultado_esperado":"Marcado"},
     {"ordem":2,"acao":"Informar a situacao como inexistente","onde_na_tela":"Campo Situacao SESMT","dados":"Situacao: inexistente","resultado_esperado":"Situacao gravada"},
     {"ordem":3,"acao":"Conferir a aba de obrigacoes","onde_na_tela":"Empresas > aba Obrigacoes","dados":"-","resultado_esperado":"Deveria haver \"Contratar/Adequar SESMT\", criticidade critica, base legal NR-04"}
   ]'::jsonb,
   'A obrigacao de contratar SESMT deveria estar registrada, com criticidade critica. RESULTADO '
   'REAL: nao existe sem o clique.',
   'IMPACTO: esta e a obrigacao de maior criticidade entre os templates — o SESMT responde pela '
   'seguranca do trabalho na empresa. Sua ausencia nao registrada significa que a pendencia mais '
   'grave do cadastro nao aparece em nenhum painel. NOTA: o caso ENQ-012 ja verificava que essa '
   'combinacao e ACEITA no cadastro (e deve ser, pois a empresa pode estar irregular). Este caso '
   'verifica o passo seguinte: a irregularidade vira obrigacao registrada?'),

  (v_mod,'REGRA-004','FAP acima de 1,5 gera obrigacao de plano de reducao','feliz','media','aprovado','api',
   'Verificar a REGRA: quando o FAP da empresa passa de 1,5, o sistema deve registrar a obrigacao '
   '"Plano de reducao do FAP". Regra: fap_atual maior que 1,5. Importa porque o FAP multiplica a '
   'aliquota RAT — um FAP de 1,5 significa recolher 50% a mais que a aliquota base, e ele sobe '
   'quando a empresa tem historico de acidentes. Reduzi-lo e ganho financeiro direto e sinal de '
   'melhoria em seguranca.',
   'Precisa existir uma empresa com FAP acima de 1,5.',
   '[
     {"ordem":1,"acao":"Informar o FAP da empresa","onde_na_tela":"Empresas > Enquadramento Legal > FAP","dados":"FAP atual: 1,8000 (acima do limite de 1,5 que dispara a regra)","resultado_esperado":"FAP gravado"},
     {"ordem":2,"acao":"Conferir a aba de obrigacoes","onde_na_tela":"Empresas > aba Obrigacoes","dados":"-","resultado_esperado":"Deveria haver \"Plano de reducao do FAP\", categoria financeira, criticidade media"}
   ]'::jsonb,
   'A obrigacao de reduzir o FAP deveria estar registrada. RESULTADO REAL: nao existe sem o clique.',
   'IMPACTO: um FAP alto e dinheiro saindo todo mes e indicador de que a empresa tem historico '
   'acidentario acima da media do setor. Sem a obrigacao registrada, nao ha plano de reducao — a '
   'empresa continua pagando mais sem que ninguem seja responsavel por reverter.'),

  (v_mod,'REGRA-005','TAC assinado gera obrigacao de cumprimento','feliz','critica','aprovado','api',
   'Verificar a REGRA: quando a empresa declara possuir TAC (Termo de Ajustamento de Conduta), o '
   'sistema deve registrar a obrigacao de cumpri-lo, com criticidade critica. Regra: tac_possui. '
   'Importa porque o TAC e um compromisso firmado com o Ministerio Publico do Trabalho — o '
   'descumprimento gera multa por clausula violada e pode virar acao civil publica.',
   'Precisa existir uma empresa que declarou possuir TAC.',
   '[
     {"ordem":1,"acao":"Marcar que a empresa possui TAC","onde_na_tela":"Empresas > Enquadramento Legal > TAC","dados":"Possui TAC: sim","resultado_esperado":"Marcado"},
     {"ordem":2,"acao":"Conferir a aba de obrigacoes","onde_na_tela":"Empresas > aba Obrigacoes","dados":"-","resultado_esperado":"Deveria haver \"Cumprir obrigacoes do TAC\", categoria legal, criticidade critica"}
   ]'::jsonb,
   'A obrigacao de cumprir o TAC deveria estar registrada. RESULTADO REAL: nao existe sem o clique.',
   'IMPACTO: o TAC e compromisso judicial com o MPT. Cada clausula descumprida tem multa propria. '
   'Uma empresa que declarou ter TAC e nao tem nenhum acompanhamento registrado esta exposta ao '
   'risco mais caro do painel — e o cadastro sabe disso, mas o painel de conformidade nao.'),

  (v_mod,'REGRA-006','Grau de risco 3 ou 4 gera obrigacao de avaliacao','feliz','media','aprovado','api',
   'Verificar a REGRA: empresas com grau de risco 3 ou 4 (NR-04) devem ter registrada a obrigacao '
   '"Avaliar impacto do grau de risco elevado", porque exigem medidas preventivas adicionais. '
   'Regra: grau_risco >= 3. Importa porque o grau de risco define o dimensionamento do SESMT, a '
   'periodicidade de exames e a exigencia de programas — grau elevado significa mais obrigacoes.',
   'Precisa existir uma empresa com grau de risco 3 ou 4.',
   '[
     {"ordem":1,"acao":"Informar grau de risco 4 para a empresa","onde_na_tela":"Empresas > Enquadramento Legal","dados":"Grau de risco: 4","resultado_esperado":"Grau gravado"},
     {"ordem":2,"acao":"Conferir a aba de obrigacoes","onde_na_tela":"Empresas > aba Obrigacoes","dados":"-","resultado_esperado":"Deveria haver \"Avaliar impacto do grau de risco elevado\", categoria sst, criticidade media"}
   ]'::jsonb,
   'A obrigacao de avaliar o grau elevado deveria estar registrada. RESULTADO REAL: nao existe sem '
   'o clique.',
   'IMPACTO: grau 3 ou 4 puxa uma cadeia de exigencias (dimensionamento de SESMT, exames, '
   'programas). Sem a obrigacao registrada, a empresa pode nao ter avaliado o que o grau elevado '
   'implica para ela.'),

  (v_mod,'REGRA-010','Empresa sem deficit NAO deve gerar obrigacao de PcD','negativo','alta','aprovado','api',
   'Verificar a contraparte da regra: uma empresa que CUMPRE a cota de PcD nao deve ter a '
   'obrigacao de adequacao registrada. Regra: a condicao exige deficit (atual menor que exigida) — '
   'sem deficit, nao ha o que adequar. Importa para confirmar que a regra e precisa: gerar '
   'obrigacao para quem esta em dia poluiria o painel de conformidade com pendencias inexistentes.',
   'Precisa existir uma empresa com cota PcD cumprida.',
   '[
     {"ordem":1,"acao":"Cadastrar empresa com 350 empregados e 11 PcDs","onde_na_tela":"Empresas > Obrigacoes de Inclusao","dados":"Total: 350 | Cota exigida: 11 | PcDs atuais: 11 (sem deficit)","resultado_esperado":"Situacao regular"},
     {"ordem":2,"acao":"Conferir a aba de obrigacoes","onde_na_tela":"Empresas > aba Obrigacoes","dados":"-","resultado_esperado":"NAO deve haver obrigacao de adequacao da cota — a empresa esta em dia"}
   ]'::jsonb,
   'Nenhuma obrigacao de adequacao de cota e registrada para a empresa em dia. A regra distingue '
   'corretamente quem esta irregular de quem esta cumprindo.',
   'IMPACTO SE FALHAR: gerar obrigacao para empresa em dia poluiria o painel com pendencias falsas '
   '— e o painel perderia credibilidade, que e o pior que pode acontecer com um controle de '
   'conformidade.'),

  (v_mod,'REGRA-011','CIPA ativa NAO deve gerar obrigacao de constituir','negativo','media','aprovado','api',
   'Verificar a contraparte: empresa com CIPA ativa nao deve ter a obrigacao de constituir CIPA. '
   'Regra: a condicao exige situacao "nao_constituida". Importa pelo mesmo motivo do REGRA-010 — '
   'precisao do painel.',
   'Precisa existir uma empresa com CIPA obrigatoria e ativa.',
   '[
     {"ordem":1,"acao":"Marcar CIPA obrigatoria com situacao ativa","onde_na_tela":"Empresas > Enquadramento Legal > CIPA","dados":"CIPA obrigatoria: sim | Situacao: ativa","resultado_esperado":"Gravado"},
     {"ordem":2,"acao":"Conferir a aba de obrigacoes","onde_na_tela":"Empresas > aba Obrigacoes","dados":"-","resultado_esperado":"NAO deve haver obrigacao de constituir CIPA"}
   ]'::jsonb,
   'Nenhuma obrigacao de constituir CIPA para empresa que ja a tem ativa.',
   'IMPACTO SE FALHAR: pendencias falsas no painel de conformidade.')

  ON CONFLICT (codigo) DO NOTHING;
END $seed$;

-- ─────────────────────────────────────────────────────────
-- ROTINAS
-- ─────────────────────────────────────────────────────────

-- helper: monta empresa no cercado e devolve se a obrigacao esperada existe
CREATE OR REPLACE FUNCTION public.qa_obrigacao_existe(
  p_empresa uuid, p_subcategoria text)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE v_existe boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.empresa_obrigacoes
     WHERE tenant_id = public.qa_sandbox_tenant_id()
       AND subcategoria = p_subcategoria
       AND origem = 'cadastro_empresa'
  ) INTO v_existe;
  RETURN v_existe;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_regra_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_emp uuid;
        v_exig int; v_atual int; v_deficit int; v_tem_obrig boolean;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Cadastrar empresa com 350 empregados e cota exigida de 11 PcDs';
  r.esperado:='Com deficit, deve existir a obrigacao "Plano de adequacao da cota PCD"';
  INSERT INTO public.empresa_cadastro
    (tenant_id, razao_social, cnpj, total_colaboradores,
     pcd_obrigatoria, pcd_percentual_exigido, pcd_quantidade_exigida, pcd_quantidade_atual)
  VALUES (v_t, '[QA] Empresa Em Deficit PcD', '11555666000181', 350, true, 3, 11, 4)
  RETURNING id INTO v_emp;

  r.passo_ordem:=2; r.passo_acao:='Conferir o deficit';
  SELECT pcd_quantidade_exigida, pcd_quantidade_atual INTO v_exig, v_atual
    FROM public.empresa_cadastro WHERE id=v_emp;
  v_deficit := v_exig - v_atual;

  r.passo_ordem:=3; r.passo_acao:='Verificar se a obrigacao de adequacao da cota foi registrada';
  v_tem_obrig := public.qa_obrigacao_existe(v_emp, 'pcd');

  IF v_tem_obrig THEN
    r.situacao:='passou';
    r.obtido:=format('Deficit de %s PcDs (exige %s, tem %s) e a obrigacao de adequacao esta registrada.',
                     v_deficit, v_exig, v_atual);
  ELSE
    r.situacao:='falhou';
    r.obtido:=format('Empresa em deficit de %s PcDs (exige %s, tem %s) e NAO ha obrigacao de adequacao registrada. A regra existe em OBRIGACOES_TEMPLATES mas so vira registro quando alguem clica em "Gerar Obrigacoes" na aba. Sem o clique, a irregularidade nao entra no painel de conformidade.',
                     v_deficit, v_exig, v_atual);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_regra_002()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_emp uuid; v_tem boolean;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Cadastrar empresa com CIPA obrigatoria e nao constituida';
  r.esperado:='Deve existir a obrigacao "Constituir CIPA" (NR-05)';
  INSERT INTO public.empresa_cadastro
    (tenant_id, razao_social, cnpj, cipa_obrigatoria, cipa_situacao)
  VALUES (v_t, '[QA] Empresa Sem CIPA', '11555666000262', true, 'nao_constituida')
  RETURNING id INTO v_emp;

  r.passo_ordem:=2; r.passo_acao:='Verificar se a obrigacao de constituir CIPA foi registrada';
  v_tem := public.qa_obrigacao_existe(v_emp, 'cipa');

  IF v_tem THEN
    r.situacao:='passou'; r.obtido:='CIPA obrigatoria e nao constituida: obrigacao registrada.';
  ELSE
    r.situacao:='falhou';
    r.obtido:='Empresa obrigada a ter CIPA, situacao nao_constituida, e NAO ha obrigacao registrada. Infracao a NR-05 sem entrada no painel de conformidade — depende do clique em "Gerar Obrigacoes".';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_regra_003()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_emp uuid; v_tem boolean;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Cadastrar empresa com SESMT obrigatorio e inexistente';
  r.esperado:='Deve existir a obrigacao "Contratar/Adequar SESMT", criticidade critica';
  INSERT INTO public.empresa_cadastro
    (tenant_id, razao_social, cnpj, sesmt_obrigatorio, sesmt_situacao)
  VALUES (v_t, '[QA] Empresa Sem SESMT', '11555666000343', true, 'inexistente')
  RETURNING id INTO v_emp;

  r.passo_ordem:=2; r.passo_acao:='Verificar se a obrigacao de contratar SESMT foi registrada';
  v_tem := public.qa_obrigacao_existe(v_emp, 'sesmt');

  IF v_tem THEN
    r.situacao:='passou'; r.obtido:='SESMT obrigatorio e inexistente: obrigacao critica registrada.';
  ELSE
    r.situacao:='falhou';
    r.obtido:='Empresa obrigada a ter SESMT, situacao inexistente, e NAO ha obrigacao registrada. E a obrigacao de maior criticidade entre os templates — a pendencia mais grave do cadastro fica fora do painel.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_regra_004()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_emp uuid;
        v_fap numeric; v_tem boolean;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Cadastrar empresa com FAP 1,8000 (acima do limite de 1,5)';
  r.esperado:='Deve existir a obrigacao "Plano de reducao do FAP"';
  INSERT INTO public.empresa_cadastro (tenant_id, razao_social, cnpj, fap_atual)
  VALUES (v_t, '[QA] Empresa FAP Alto', '11555666000424', 1.8000) RETURNING id INTO v_emp;
  SELECT fap_atual INTO v_fap FROM public.empresa_cadastro WHERE id=v_emp;

  r.passo_ordem:=2; r.passo_acao:='Verificar se a obrigacao de reducao do FAP foi registrada';
  v_tem := public.qa_obrigacao_existe(v_emp, 'fap');

  IF v_tem THEN
    r.situacao:='passou'; r.obtido:=format('FAP %s acima de 1,5: obrigacao de reducao registrada.', v_fap);
  ELSE
    r.situacao:='falhou';
    r.obtido:=format('FAP em %s (acima de 1,5) e NAO ha obrigacao de reducao registrada. A empresa recolhe %s%% a mais de RAT sem plano de reversao.',
                     v_fap, round((v_fap - 1) * 100));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_regra_005()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_emp uuid; v_tem boolean;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Cadastrar empresa que declara possuir TAC';
  r.esperado:='Deve existir a obrigacao "Cumprir obrigacoes do TAC", criticidade critica';
  INSERT INTO public.empresa_cadastro (tenant_id, razao_social, cnpj, tac_possui)
  VALUES (v_t, '[QA] Empresa Com TAC', '11555666000505', true) RETURNING id INTO v_emp;

  r.passo_ordem:=2; r.passo_acao:='Verificar se a obrigacao de cumprir o TAC foi registrada';
  v_tem := public.qa_obrigacao_existe(v_emp, 'tac');

  IF v_tem THEN
    r.situacao:='passou'; r.obtido:='TAC declarado: obrigacao de cumprimento registrada.';
  ELSE
    r.situacao:='falhou';
    r.obtido:='Empresa declarou possuir TAC e NAO ha obrigacao de cumprimento registrada. O TAC e compromisso com o MPT, com multa por clausula descumprida — o maior risco financeiro do painel fica sem acompanhamento.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_regra_006()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_emp uuid;
        v_grau int; v_tem boolean;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Cadastrar empresa com grau de risco 4 (o mais alto da NR-04)';
  r.esperado:='Deve existir a obrigacao "Avaliar impacto do grau de risco elevado"';
  INSERT INTO public.empresa_cadastro (tenant_id, razao_social, cnpj, grau_risco)
  VALUES (v_t, '[QA] Empresa Grau 4', '11555666000686', 4) RETURNING id INTO v_emp;
  SELECT grau_risco INTO v_grau FROM public.empresa_cadastro WHERE id=v_emp;

  r.passo_ordem:=2; r.passo_acao:='Verificar se a obrigacao de avaliacao foi registrada';
  v_tem := public.qa_obrigacao_existe(v_emp, 'grau_risco');

  IF v_tem THEN
    r.situacao:='passou'; r.obtido:=format('Grau de risco %s: obrigacao de avaliacao registrada.', v_grau);
  ELSE
    r.situacao:='falhou';
    r.obtido:=format('Grau de risco %s (elevado) e NAO ha obrigacao de avaliacao registrada. O grau elevado puxa exigencias adicionais que ficam sem acompanhamento.', v_grau);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_regra_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_emp uuid; v_tem boolean;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Cadastrar empresa que CUMPRE a cota (350 empregados, 11 exigidos, 11 atuais)';
  r.esperado:='NAO deve haver obrigacao de adequacao — a empresa esta em dia';
  INSERT INTO public.empresa_cadastro
    (tenant_id, razao_social, cnpj, total_colaboradores,
     pcd_obrigatoria, pcd_percentual_exigido, pcd_quantidade_exigida, pcd_quantidade_atual)
  VALUES (v_t, '[QA] Empresa Cota Cumprida', '11555666000767', 350, true, 3, 11, 11)
  RETURNING id INTO v_emp;

  r.passo_ordem:=2; r.passo_acao:='Verificar que NAO ha obrigacao de adequacao';
  v_tem := public.qa_obrigacao_existe(v_emp, 'pcd');

  IF NOT v_tem THEN
    r.situacao:='passou';
    r.obtido:='Empresa em dia (11 exigidos, 11 atuais) e nenhuma obrigacao de adequacao registrada, como deve ser.';
  ELSE
    r.situacao:='falhou';
    r.obtido:='Ha obrigacao de adequacao para empresa SEM deficit. A regra estaria imprecisa, poluindo o painel com pendencia falsa.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_regra_011()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_emp uuid; v_tem boolean;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Cadastrar empresa com CIPA obrigatoria e ATIVA';
  r.esperado:='NAO deve haver obrigacao de constituir CIPA';
  INSERT INTO public.empresa_cadastro
    (tenant_id, razao_social, cnpj, cipa_obrigatoria, cipa_situacao)
  VALUES (v_t, '[QA] Empresa CIPA Ativa', '11555666000848', true, 'ativa') RETURNING id INTO v_emp;

  r.passo_ordem:=2; r.passo_acao:='Verificar que NAO ha obrigacao de constituir';
  v_tem := public.qa_obrigacao_existe(v_emp, 'cipa');

  IF NOT v_tem THEN
    r.situacao:='passou';
    r.obtido:='CIPA ativa e nenhuma obrigacao de constituir registrada, como deve ser.';
  ELSE
    r.situacao:='falhou';
    r.obtido:='Ha obrigacao de constituir CIPA para empresa que ja a tem ativa — pendencia falsa no painel.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

-- ── Registrar ──
INSERT INTO public.qa_implementacoes (codigo, funcao_sql) VALUES
  ('REGRA-001','qa_caso_regra_001'),('REGRA-002','qa_caso_regra_002'),('REGRA-003','qa_caso_regra_003'),
  ('REGRA-004','qa_caso_regra_004'),('REGRA-005','qa_caso_regra_005'),('REGRA-006','qa_caso_regra_006'),
  ('REGRA-010','qa_caso_regra_010'),('REGRA-011','qa_caso_regra_011')
ON CONFLICT (codigo) DO UPDATE SET funcao_sql=EXCLUDED.funcao_sql, ativo=true;

-- ── Rodar ──
DO $roda$ BEGIN PERFORM public.qa_rodar_bateria('manual', 'estrutura-organizacional/empresa'); END $roda$;

SELECT codigo, situacao::text, left(obtido, 76) AS resultado
FROM public.qa_resultados
WHERE execucao_id = (SELECT id FROM public.qa_execucoes ORDER BY iniciada_em DESC LIMIT 1)
  AND codigo LIKE 'REGRA-%'
ORDER BY codigo;
