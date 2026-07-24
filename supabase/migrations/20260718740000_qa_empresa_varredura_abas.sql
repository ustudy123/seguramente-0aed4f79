-- =========================================================
-- QA — VARREDURA DO CADASTRO DE EMPRESAS
-- Cobertura das abas que faltavam, com foco em REGRA DE NEGOCIO
--
-- O cadastro tem 8 abas e a tabela empresa_cadastro tem 64 colunas. Os casos
-- anteriores (EMP-001 a 041, OBRG-*) cobriam dados basicos, cotas e
-- obrigacoes. Esta varredura fecha as demais:
--
--   ABA ENQUADRAMENTO LEGAL  -> CNAE, grau de risco e ajuste, SESMT, CIPA,
--                               FAP, TAC
--   ABA JORNADA E CONDICOES  -> jornada padrao, turnos, terceiro turno,
--                               escalas especiais, insalubridade,
--                               periculosidade, trabalho em altura,
--                               espaco confinado
--   HIERARQUIA               -> grupo economico
--   DADOS BASICOS (completar)-> tipo de pessoa, endereco, contato
--
-- O QUE JA ESTA PROTEGIDO NO BANCO (confirmado na leitura):
--   grau_risco e grau_risco_ajustado: CHECK BETWEEN 1 AND 4
--   sesmt_situacao: CHECK (proprio|terceirizado|inexistente)
--   cipa_situacao:  CHECK (nao_constituida|em_implantacao|ativa)
--
-- O QUE NAO TEM PROTECAO (alvo desta varredura):
--   fap_atual: NUMERIC(5,4) sem CHECK — mas a Lei 10.666/2003 limita o FAP
--     a 0,5000-2,0000. Fora dessa faixa nao existe FAP valido.
--   tipo_pessoa: TEXT DEFAULT 'pj' sem CHECK
--   grau_risco_justificativa: a tela EXIBE o campo quando o grau ajustado
--     difere do original, mas nao o exige
--   coerencia entre "obrigatorio" e "situacao" em SESMT e CIPA
--   datas de mandato da CIPA
--
-- CRITERIO DESTA VARREDURA: cada caso testa uma REGRA, nao um campo. Campos
-- que sao apenas texto livre sem consequencia (website, complemento) nao
-- geram caso — testa-los somaria contagem sem somar seguranca.
-- =========================================================

-- ─────────────────────────────────────────────────────────
-- DOCUMENTAÇÃO
-- ─────────────────────────────────────────────────────────
DO $seed$
DECLARE v_mod uuid;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos WHERE path='estrutura-organizacional/empresa';
  IF v_mod IS NULL THEN RAISE EXCEPTION 'Modulo empresa nao encontrado.'; END IF;

  INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, nivel, objetivo, pre_condicoes, passos, resultado_esperado, observacoes)
  VALUES

  -- ══════════ ABA: ENQUADRAMENTO LEGAL ══════════

  (v_mod,'ENQ-001','Cadastrar o enquadramento completo da empresa','feliz','alta','aprovado','api',
   'Verificar que o enquadramento legal e gravado por inteiro: CNAE principal, grau de risco, '
   'situacao de SESMT e CIPA. Regra: o CNAE define a atividade economica e, por consequencia, o '
   'grau de risco da NR-04 — que determina as obrigacoes de SST da empresa. Importa porque este '
   'conjunto e a base legal de tudo o que o sistema vai exigir dessa empresa.',
   'Precisa existir uma empresa cadastrada.',
   '[
     {"ordem":1,"acao":"Abrir a aba de enquadramento legal","onde_na_tela":"Empresas > abrir a empresa > aba Enquadramento Legal","dados":"-","resultado_esperado":"Campos de CNAE, grau de risco, SESMT e CIPA visiveis"},
     {"ordem":2,"acao":"Informar o CNAE e a descricao da atividade","onde_na_tela":"Campos CNAE Principal e Descricao","dados":"CNAE: 4120-4/00 | Descricao: Construcao de edificios","resultado_esperado":"Campos aceitos"},
     {"ordem":3,"acao":"Informar grau de risco e a estrutura de SST","onde_na_tela":"Campos Grau de Risco, Situacao SESMT, Situacao CIPA","dados":"Grau de risco: 3 | SESMT: terceirizado | CIPA: ativa","resultado_esperado":"Campos aceitos"},
     {"ordem":4,"acao":"Salvar e reabrir","onde_na_tela":"Salvar","dados":"-","resultado_esperado":"Todo o enquadramento persistiu"}
   ]'::jsonb,
   'A empresa fica com CNAE 4120-4/00, grau de risco 3, SESMT terceirizado e CIPA ativa. Os dados '
   'persistem ao reabrir.',
   'IMPACTO SE FALHAR: sem o enquadramento, o sistema nao sabe quais obrigacoes de SST exigir da '
   'empresa — programas, treinamentos e prazos ficam sem base legal.'),

  (v_mod,'ENQ-010','FAP fora da faixa legal e aceito','excecao','critica','aprovado','api',
   'Verificar se o FAP respeita a faixa prevista em lei. Regra: o Fator Acidentario de Prevencao '
   '(Lei 10.666/2003) varia de 0,5000 a 2,0000 — multiplica a aliquota RAT que a empresa recolhe. '
   'Um FAP de 0,5 reduz a contribuicao pela metade; 2,0 dobra. Valores fora dessa faixa nao '
   'existem. Importa porque o FAP tem efeito financeiro direto sobre o recolhimento previdenciario.',
   'Precisa existir uma empresa cadastrada.',
   '[
     {"ordem":1,"acao":"Abrir o enquadramento legal da empresa","onde_na_tela":"Empresas > Enquadramento Legal > secao FAP","dados":"-","resultado_esperado":"Campo FAP visivel"},
     {"ordem":2,"acao":"Informar um FAP fora da faixa legal","onde_na_tela":"Campo FAP Atual","dados":"FAP: 5,0000 (a lei limita a 2,0000)","resultado_esperado":"Idealmente recusado — nao existe FAP acima de 2,0"}
   ]'::jsonb,
   'O FAP fora da faixa deveria ser recusado. RESULTADO REAL: o banco aceita — fap_atual e '
   'NUMERIC(5,4) sem CHECK de faixa.',
   'IMPACTO: o FAP multiplica a aliquota RAT no recolhimento previdenciario. Um valor invalido '
   'gravado distorce qualquer calculo ou projecao de custo que o use, e um FAP acima de 2,0 nao '
   'tem existencia legal — se aparecer em relatorio ou documento, e erro visivel para a '
   'contabilidade e para fiscalizacao. CORRECAO SUGERIDA: '
   'ALTER TABLE empresa_cadastro ADD CONSTRAINT fap_faixa_legal '
   'CHECK (fap_atual IS NULL OR fap_atual BETWEEN 0.5 AND 2.0);'),

  (v_mod,'ENQ-011','Grau de risco ajustado sem justificativa','excecao','alta','aprovado','api',
   'Verificar se e possivel ajustar o grau de risco sem justificar. Regra de negocio: o grau de '
   'risco vem da NR-04 conforme o CNAE. Ajusta-lo para cima ou para baixo e uma decisao tecnica '
   'que precisa de fundamentacao — a propria tela exibe o campo de justificativa justamente quando '
   'o ajustado difere do original. Importa porque o grau de risco define obrigacoes de SST; '
   'reduzi-lo sem fundamento e reduzir exigencias legais sem base.',
   'Precisa existir uma empresa com grau de risco definido.',
   '[
     {"ordem":1,"acao":"Abrir o enquadramento de uma empresa com grau de risco 4","onde_na_tela":"Empresas > Enquadramento Legal","dados":"Grau de risco (NR-04): 4","resultado_esperado":"Grau original exibido"},
     {"ordem":2,"acao":"Ajustar o grau para 1, sem preencher a justificativa","onde_na_tela":"Campo Grau de Risco Ajustado (a tela exibe o campo de justificativa ao detectar a diferenca)","dados":"Grau ajustado: 1 | Justificativa: (vazia)","resultado_esperado":"Idealmente recusado — ajuste exige fundamentacao"}
   ]'::jsonb,
   'O ajuste sem justificativa deveria ser recusado. RESULTADO REAL: o banco aceita — nao ha regra '
   'que vincule o ajuste a justificativa. A tela EXIBE o campo quando detecta a diferenca, mas nao '
   'o exige.',
   'IMPACTO: uma empresa pode ter o grau de risco reduzido de 4 para 1 sem qualquer registro do '
   'porque. O grau determina obrigacoes de SST (dimensionamento de SESMT, exames, treinamentos) — '
   'reduzi-lo sem fundamento reduz exigencias legais sem rastro, e em fiscalizacao nao ha como '
   'defender a decisao. CORRECAO SUGERIDA: '
   'ALTER TABLE empresa_cadastro ADD CONSTRAINT grau_ajustado_exige_justificativa '
   'CHECK (grau_risco_ajustado IS NULL OR grau_risco_ajustado = grau_risco '
   'OR (grau_risco_justificativa IS NOT NULL AND length(trim(grau_risco_justificativa)) > 0));'),

  (v_mod,'ENQ-012','SESMT obrigatorio mas declarado inexistente','excecao','alta','aprovado','api',
   'Verificar a coerencia entre a obrigatoriedade e a situacao do SESMT. Regra de negocio: se a '
   'empresa e obrigada a ter SESMT (pelo porte e grau de risco, conforme NR-04) e a situacao '
   'informada e "inexistente", ha uma irregularidade declarada. Importa porque essa combinacao '
   'deveria ao menos gerar um alerta ou uma obrigacao de conformidade, nao passar despercebida.',
   'Precisa existir uma empresa cadastrada.',
   '[
     {"ordem":1,"acao":"Marcar o SESMT como obrigatorio para a empresa","onde_na_tela":"Empresas > Enquadramento Legal > SESMT","dados":"SESMT obrigatorio: sim","resultado_esperado":"Marcado"},
     {"ordem":2,"acao":"Informar a situacao como inexistente","onde_na_tela":"Campo Situacao SESMT","dados":"Situacao: inexistente","resultado_esperado":"Aceito, mas deveria sinalizar a irregularidade"},
     {"ordem":3,"acao":"Conferir se algo foi sinalizado","onde_na_tela":"Aba Obrigacoes / painel de conformidade","dados":"-","resultado_esperado":"Idealmente uma obrigacao nao conforme seria registrada"}
   ]'::jsonb,
   'A combinacao e aceita pelo banco — e ate faz sentido permitir, porque a empresa PODE estar '
   'irregular e precisa poder registrar isso. RESULTADO REAL: aceita, e nada e sinalizado '
   'automaticamente.',
   'OBSERVACAO IMPORTANTE: este NAO e um defeito de dados — registrar que a empresa esta irregular '
   'e legitimo e necessario. O ponto e outro: a combinacao "obrigatorio + inexistente" e uma '
   'irregularidade conhecida que poderia alimentar automaticamente o painel de conformidade '
   '(empresa_obrigacoes, subcategoria sesmt, status nao_conforme). Hoje depende de alguem '
   'registrar manualmente. SUGESTAO DE PRODUTO, nao correcao de banco.'),

  (v_mod,'ENQ-013','Mandato da CIPA com fim antes do inicio','excecao','media','aprovado','api',
   'Verificar a coerencia das datas de mandato da CIPA. Regra: o mandato tem inicio e fim; o fim '
   'nao pode anteceder o inicio. Importa porque as datas controlam quando a proxima eleicao deve '
   'ocorrer — um periodo invertido quebra esse controle e pode fazer a empresa perder o prazo '
   'legal de renovacao.',
   'Precisa existir uma empresa com CIPA.',
   '[
     {"ordem":1,"acao":"Abrir o enquadramento e a secao da CIPA","onde_na_tela":"Empresas > Enquadramento Legal > CIPA","dados":"CIPA: ativa","resultado_esperado":"Campos de mandato visiveis"},
     {"ordem":2,"acao":"Informar o mandato com as datas invertidas","onde_na_tela":"Campos Inicio e Fim do Mandato","dados":"Inicio: 31/12/2026 | Fim: 01/01/2026","resultado_esperado":"Idealmente recusado"}
   ]'::jsonb,
   'O mandato invertido deveria ser recusado. RESULTADO REAL: o banco aceita — nao ha CHECK entre '
   'as datas.',
   'IMPACTO: o controle de renovacao da CIPA se baseia na data de fim do mandato. Um periodo '
   'invertido quebra o calculo de quando convocar a proxima eleicao — a empresa pode ficar com CIPA '
   'vencida sem alerta. CORRECAO SUGERIDA: '
   'ALTER TABLE empresa_cadastro ADD CONSTRAINT cipa_mandato_coerente '
   'CHECK (cipa_data_mandato_inicio IS NULL OR cipa_data_mandato_fim IS NULL '
   'OR cipa_data_mandato_inicio <= cipa_data_mandato_fim);'),

  (v_mod,'ENQ-014','Grau de risco ajustado respeita a faixa da NR-04','excecao','media','aprovado','api',
   'Verificar que o grau ajustado tambem esta limitado a 1-4. Regra: o ajuste continua sendo um '
   'grau de risco da NR-04 — nao pode sair da escala so por ser um ajuste. Importa para confirmar '
   'que a protecao existente no grau original tambem vale no ajustado.',
   'Precisa existir uma empresa cadastrada.',
   '[
     {"ordem":1,"acao":"Tentar informar um grau ajustado fora da escala","onde_na_tela":"Empresas > Enquadramento Legal > Grau de Risco Ajustado","dados":"Grau ajustado: 7 (a NR-04 vai ate 4)","resultado_esperado":"O sistema DEVE recusar"}
   ]'::jsonb,
   'O grau ajustado fora da escala e recusado, pelo mesmo CHECK que protege o grau original.',
   'IMPACTO SE FALHAR: um grau ajustado invalido corromperia a classificacao legal da empresa da '
   'mesma forma que o original — e o ajustado e o que prevalece quando existe.'),

  -- ══════════ ABA: JORNADA E CONDIÇÕES ══════════

  (v_mod,'JOR-001','Registrar jornada e condicoes de trabalho','feliz','alta','aprovado','api',
   'Verificar o registro do regime de trabalho e das condicoes do ambiente. Regra: a empresa '
   'declara a jornada padrao, se opera em terceiro turno, se usa escalas especiais, e se ha '
   'exposicao a insalubridade, periculosidade, trabalho em altura ou espaco confinado. Importa '
   'porque essas condicoes definem exigencias de SST — NR-35 para altura, NR-33 para espaco '
   'confinado, adicionais para insalubridade e periculosidade.',
   'Precisa existir uma empresa cadastrada.',
   '[
     {"ordem":1,"acao":"Abrir a aba de jornada e condicoes","onde_na_tela":"Empresas > abrir a empresa > aba Jornada e Condicoes","dados":"-","resultado_esperado":"Campos de jornada e condicoes visiveis"},
     {"ordem":2,"acao":"Informar a jornada e os turnos","onde_na_tela":"Campos Jornada Padrao e Terceiro Turno","dados":"Jornada: 44h semanais | Possui terceiro turno: sim | Escalas especiais: sim","resultado_esperado":"Campos aceitos"},
     {"ordem":3,"acao":"Marcar as condicoes do ambiente","onde_na_tela":"Secao Condicoes Especiais","dados":"Insalubridade: sim | Trabalho em altura: sim | Espaco confinado: nao | Periculosidade: nao","resultado_esperado":"Condicoes registradas"},
     {"ordem":4,"acao":"Salvar e reabrir","onde_na_tela":"Salvar","dados":"-","resultado_esperado":"Jornada e condicoes persistiram"}
   ]'::jsonb,
   'A empresa fica registrada com jornada de 44h, terceiro turno, escalas especiais, insalubridade '
   'e trabalho em altura. Tudo persiste.',
   'IMPACTO SE FALHAR: sem esse registro, o sistema nao sabe quais exigencias de SST se aplicam — '
   'trabalho em altura sem registro significa NR-35 nao cobrada, e exposicao a insalubridade sem '
   'registro significa adicional nao pago.'),

  (v_mod,'JOR-002','Turnos gravados como lista estruturada','feliz','media','aprovado','api',
   'Verificar que os turnos sao guardados como lista, nao como texto solto. Regra: turnos e um '
   'campo JSONB — permite registrar varios turnos, cada um com seus horarios. Importa porque uma '
   'empresa com tres turnos precisa registrar os tres, e o controle de jornada depende de saber os '
   'horarios de cada um.',
   'Precisa existir uma empresa cadastrada.',
   '[
     {"ordem":1,"acao":"Abrir a aba de jornada","onde_na_tela":"Empresas > Jornada e Condicoes > Turnos","dados":"-","resultado_esperado":"Secao de turnos visivel"},
     {"ordem":2,"acao":"Adicionar tres turnos","onde_na_tela":"Adicionar turno","dados":"1o turno 06:00-14:00 | 2o turno 14:00-22:00 | 3o turno 22:00-06:00","resultado_esperado":"Os tres turnos aparecem na lista"},
     {"ordem":3,"acao":"Salvar e reabrir","onde_na_tela":"Salvar","dados":"-","resultado_esperado":"Os tres turnos foram guardados com seus horarios"}
   ]'::jsonb,
   'Os tres turnos ficam guardados como lista estruturada, cada um com seus horarios.',
   'IMPACTO SE FALHAR: turnos em texto livre impedem qualquer calculo automatico de jornada, '
   'adicional noturno ou escala.'),

  (v_mod,'JOR-010','Terceiro turno sem turnos cadastrados','excecao','media','aprovado','api',
   'Verificar a coerencia entre declarar terceiro turno e cadastrar os turnos. Regra de negocio: '
   'se a empresa marca que opera em terceiro turno, deveria haver turnos registrados — inclusive '
   'porque o terceiro turno implica adicional noturno. Importa porque a declaracao sem os dados '
   'concretos nao permite calcular nada.',
   'Precisa existir uma empresa cadastrada.',
   '[
     {"ordem":1,"acao":"Marcar que a empresa opera em terceiro turno","onde_na_tela":"Empresas > Jornada e Condicoes","dados":"Possui terceiro turno: sim","resultado_esperado":"Marcado"},
     {"ordem":2,"acao":"Deixar a lista de turnos vazia e salvar","onde_na_tela":"Secao Turnos (vazia)","dados":"Turnos: (nenhum)","resultado_esperado":"Idealmente sinalizado — declarou terceiro turno sem informar os turnos"}
   ]'::jsonb,
   'A combinacao e aceita. RESULTADO REAL: o banco aceita terceiro turno declarado sem nenhum turno '
   'cadastrado.',
   'OBSERVACAO: e uma inconsistencia de preenchimento, nao um defeito grave — a empresa pode estar '
   'preenchendo aos poucos. O ponto e que ninguem e avisado. SUGESTAO: sinalizar na tela ou no '
   'checklist de cadastro (que ja existe como aba) que ha declaracao de terceiro turno sem turnos '
   'informados. Nao justifica CHECK no banco, que impediria o preenchimento gradual.'),

  -- ══════════ HIERARQUIA E DADOS BÁSICOS ══════════

  (v_mod,'HIER-001','Vincular empresa a um grupo economico','feliz','media','aprovado','api',
   'Verificar que uma empresa pode pertencer a um grupo economico. Regra: grupo_economico_id '
   'referencia grupos_economicos. Importa porque grupos economicos compartilham obrigacoes e '
   'permitem visao consolidada — e, no caso das cotas, a apuracao pode considerar o conjunto.',
   'Precisa existir um grupo economico cadastrado.',
   '[
     {"ordem":1,"acao":"Cadastrar um grupo economico","onde_na_tela":"Empresas > Grupos Economicos > Novo","dados":"Nome: Grupo Teste","resultado_esperado":"Grupo criado"},
     {"ordem":2,"acao":"Vincular a empresa ao grupo","onde_na_tela":"Empresas > abrir a empresa > campo Grupo Economico","dados":"Grupo: Grupo Teste","resultado_esperado":"Vinculo criado"},
     {"ordem":3,"acao":"Conferir","onde_na_tela":"Ficha da empresa","dados":"-","resultado_esperado":"A empresa aparece vinculada ao grupo"}
   ]'::jsonb,
   'A empresa fica vinculada ao grupo economico.',
   'IMPACTO SE FALHAR: sem o vinculo, nao ha visao consolidada por grupo — cada empresa e tratada '
   'isoladamente mesmo pertencendo ao mesmo controlador.'),

  (v_mod,'HIER-002','Apagar o grupo economico preserva as empresas','alternativo','alta','aprovado','api',
   'Verificar que apagar um grupo economico nao apaga as empresas dele. Regra: '
   'grupo_economico_id ON DELETE SET NULL. Importa porque uma reorganizacao societaria nao pode '
   'destruir os cadastros das empresas — elas continuam existindo, apenas deixam de pertencer '
   'aquele grupo.',
   'Precisa existir um grupo economico com pelo menos uma empresa vinculada.',
   '[
     {"ordem":1,"acao":"Ter um grupo com uma empresa vinculada","onde_na_tela":"Grupos Economicos","dados":"Grupo com empresa","resultado_esperado":"Vinculo existe"},
     {"ordem":2,"acao":"Apagar o grupo economico","onde_na_tela":"Grupos Economicos > Excluir","dados":"-","resultado_esperado":"Grupo apagado"},
     {"ordem":3,"acao":"Conferir a empresa","onde_na_tela":"Empresas","dados":"-","resultado_esperado":"A empresa AINDA EXISTE, agora sem grupo"}
   ]'::jsonb,
   'O grupo e apagado e a empresa sobrevive, sem vinculo. Nenhum cadastro de empresa e destruido.',
   'IMPACTO SE FALHAR: apagar um grupo destruiria os cadastros de todas as empresas dele — com '
   'colaboradores, documentos e historico pendurados. Perda catastrofica por uma operacao que '
   'deveria ser apenas organizacional.'),

  (v_mod,'DADO-010','Tipo de pessoa aceita valor fora de PJ/PF','excecao','media','aprovado','api',
   'Verificar se o tipo de pessoa tem lista fechada. Regra: os unicos valores possiveis sao pessoa '
   'juridica (pj) e pessoa fisica (pf) — o campo tem default "pj". Importa porque o tipo define '
   'qual documento identifica a empresa (CNPJ ou CPF) e como ela e tratada em obrigacoes legais.',
   'Nenhuma.',
   '[
     {"ordem":1,"acao":"Cadastrar empresa com tipo de pessoa fora da lista","onde_na_tela":"Via importacao ou API","dados":"Tipo de pessoa: mei (nao e um valor previsto; MEI e pj)","resultado_esperado":"Idealmente recusado"}
   ]'::jsonb,
   'O tipo invalido deveria ser recusado. RESULTADO REAL: o banco aceita — tipo_pessoa e TEXT com '
   'default "pj", sem CHECK.',
   'IMPACTO: o tipo de pessoa decide qual documento valida a identidade da empresa e como ela entra '
   'em obrigacoes legais. Um valor desconhecido deixa esse comportamento indefinido. CORRECAO '
   'SUGERIDA: ALTER TABLE empresa_cadastro ADD CONSTRAINT tipo_pessoa_valido '
   'CHECK (tipo_pessoa IN (''pj'',''pf''));')

  ON CONFLICT (codigo) DO NOTHING;
END $seed$;

-- ─────────────────────────────────────────────────────────
-- ROTINAS
-- ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.qa_caso_enq_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
        v_cnae text; v_grau int; v_sesmt text; v_cipa text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Cadastrar enquadramento: CNAE 4120-4/00, grau 3, SESMT terceirizado, CIPA ativa';
  r.esperado:='Todo o enquadramento persistido';
  INSERT INTO public.empresa_cadastro
    (tenant_id, razao_social, cnpj, cnae_principal, cnae_descricao,
     grau_risco, sesmt_situacao, cipa_situacao)
  VALUES (v_t, '[QA] Construtora Enquadrada', '11222333000181', '4120-4/00',
          'Construcao de edificios', 3, 'terceirizado', 'ativa')
  RETURNING id INTO v_id;
  SELECT cnae_principal, grau_risco, sesmt_situacao, cipa_situacao
    INTO v_cnae, v_grau, v_sesmt, v_cipa FROM public.empresa_cadastro WHERE id=v_id;
  IF v_cnae='4120-4/00' AND v_grau=3 AND v_sesmt='terceirizado' AND v_cipa='ativa' THEN
    r.situacao:='passou';
    r.obtido:='Enquadramento completo: CNAE 4120-4/00, grau 3, SESMT terceirizado, CIPA ativa.';
  ELSE
    r.situacao:='falhou';
    r.obtido:=format('cnae=%s, grau=%s, sesmt=%s, cipa=%s.', v_cnae, v_grau, v_sesmt, v_cipa);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_enq_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid; v_fap numeric;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Gravar FAP = 5,0000 (a Lei 10.666/2003 limita a 2,0000)';
  r.esperado:='Idealmente recusado — nao existe FAP acima de 2,0';
  BEGIN
    INSERT INTO public.empresa_cadastro (tenant_id, razao_social, cnpj, fap_atual)
    VALUES (v_t, '[QA] FAP Invalido', '11222333000262', 5.0000) RETURNING id INTO v_id;
    SELECT fap_atual INTO v_fap FROM public.empresa_cadastro WHERE id=v_id;
    r.situacao:='falhou';
    r.obtido:=format('O BANCO ACEITOU FAP = %s. A faixa legal e 0,5000 a 2,0000 (Lei 10.666/2003). O FAP multiplica a aliquota RAT — valor invalido distorce o recolhimento previdenciario.', v_fap);
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: FAP restrito a faixa legal de 0,5 a 2,0.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_enq_011()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
        v_orig int; v_ajus int; v_just text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1;
  r.passo_acao:='Gravar empresa com grau de risco 4 ajustado para 1, sem justificativa';
  r.esperado:='Idealmente recusado — o ajuste exige fundamentacao tecnica';
  BEGIN
    INSERT INTO public.empresa_cadastro
      (tenant_id, razao_social, cnpj, grau_risco, grau_risco_ajustado, grau_risco_justificativa)
    VALUES (v_t, '[QA] Grau Ajustado Sem Justificativa', '11222333000343', 4, 1, NULL)
    RETURNING id INTO v_id;
    SELECT grau_risco, grau_risco_ajustado, grau_risco_justificativa
      INTO v_orig, v_ajus, v_just FROM public.empresa_cadastro WHERE id=v_id;
    r.situacao:='falhou';
    r.obtido:=format('O BANCO ACEITOU ajuste de grau %s para %s sem justificativa. O grau de risco define obrigacoes de SST — reduzi-lo sem fundamento reduz exigencias legais sem deixar rastro.', v_orig, v_ajus);
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: ajustar o grau de risco exige justificativa.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_enq_012()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
        v_obrig boolean; v_sit text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Gravar SESMT obrigatorio com situacao "inexistente"';
  r.esperado:='Aceito (a empresa pode estar irregular), mas a irregularidade fica sem sinalizacao';
  INSERT INTO public.empresa_cadastro
    (tenant_id, razao_social, cnpj, sesmt_obrigatorio, sesmt_situacao)
  VALUES (v_t, '[QA] SESMT Irregular', '11222333000424', true, 'inexistente')
  RETURNING id INTO v_id;
  SELECT sesmt_obrigatorio, sesmt_situacao INTO v_obrig, v_sit
    FROM public.empresa_cadastro WHERE id=v_id;
  IF v_obrig AND v_sit='inexistente' THEN
    r.situacao:='passou';
    r.obtido:='Combinacao aceita, como deve ser — a empresa PODE estar irregular e precisa poder registrar. Nada e sinalizado automaticamente; hoje depende de registro manual no painel de conformidade.';
  ELSE
    r.situacao:='falhou'; r.obtido:=format('obrigatorio=%s, situacao=%s.', v_obrig, v_sit);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_enq_013()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
        v_ini date; v_fim date;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Gravar mandato da CIPA com fim antes do inicio';
  r.esperado:='Idealmente recusado';
  BEGIN
    INSERT INTO public.empresa_cadastro
      (tenant_id, razao_social, cnpj, cipa_situacao,
       cipa_data_mandato_inicio, cipa_data_mandato_fim)
    VALUES (v_t, '[QA] CIPA Mandato Invertido', '11222333000505', 'ativa',
            DATE '2026-12-31', DATE '2026-01-01') RETURNING id INTO v_id;
    SELECT cipa_data_mandato_inicio, cipa_data_mandato_fim INTO v_ini, v_fim
      FROM public.empresa_cadastro WHERE id=v_id;
    r.situacao:='falhou';
    r.obtido:=format('O BANCO ACEITOU mandato de %s ate %s (fim antes do inicio). O controle de renovacao da CIPA usa a data de fim — periodo invertido quebra o calculo da proxima eleicao.', v_ini, v_fim);
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: o fim do mandato precisa ser posterior ao inicio.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_enq_014()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar grau de risco ajustado = 7 (a NR-04 vai ate 4)';
  r.esperado:='Recusado pelo CHECK';
  BEGIN
    INSERT INTO public.empresa_cadastro
      (tenant_id, razao_social, cnpj, grau_risco, grau_risco_ajustado)
    VALUES (v_t, '[QA] Grau Ajustado Invalido', '11222333000686', 2, 7);
    r.situacao:='falhou'; r.obtido:='ACEITOU grau ajustado fora da escala 1-4.';
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou';
    r.obtido:='Recusado: o grau ajustado tambem esta limitado a 1-4, como o original.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_jor_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
        v_jor text; v_3t boolean; v_esc boolean; v_ins boolean; v_alt boolean;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1;
  r.passo_acao:='Registrar jornada 44h, terceiro turno, escalas especiais, insalubridade e trabalho em altura';
  r.esperado:='Jornada e condicoes persistidas';
  INSERT INTO public.empresa_cadastro
    (tenant_id, razao_social, cnpj, jornada_padrao, possui_terceiro_turno,
     possui_escalas_especiais, insalubridade, trabalho_altura, espaco_confinado, periculosidade)
  VALUES (v_t, '[QA] Industria Tres Turnos', '11222333000767', '44h semanais',
          true, true, true, true, false, false) RETURNING id INTO v_id;
  SELECT jornada_padrao, possui_terceiro_turno, possui_escalas_especiais,
         insalubridade, trabalho_altura
    INTO v_jor, v_3t, v_esc, v_ins, v_alt FROM public.empresa_cadastro WHERE id=v_id;
  IF v_jor='44h semanais' AND v_3t AND v_esc AND v_ins AND v_alt THEN
    r.situacao:='passou';
    r.obtido:='Jornada 44h, terceiro turno, escalas especiais, insalubridade e trabalho em altura registrados.';
  ELSE
    r.situacao:='falhou';
    r.obtido:=format('jornada=%s, 3turno=%s, escalas=%s, insalubridade=%s, altura=%s.',
                     v_jor, v_3t, v_esc, v_ins, v_alt);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_jor_002()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid; v_qtd int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Registrar tres turnos com seus horarios';
  r.esperado:='Os tres turnos guardados como lista estruturada';
  INSERT INTO public.empresa_cadastro (tenant_id, razao_social, cnpj, turnos)
  VALUES (v_t, '[QA] Empresa Com Turnos', '11222333000848',
    '[{"nome":"1o turno","inicio":"06:00","fim":"14:00"},
      {"nome":"2o turno","inicio":"14:00","fim":"22:00"},
      {"nome":"3o turno","inicio":"22:00","fim":"06:00"}]'::jsonb)
  RETURNING id INTO v_id;
  SELECT jsonb_array_length(turnos) INTO v_qtd FROM public.empresa_cadastro WHERE id=v_id;
  IF v_qtd = 3 THEN
    r.situacao:='passou'; r.obtido:='3 turnos guardados como lista, cada um com inicio e fim.';
  ELSE
    r.situacao:='falhou'; r.obtido:=format('Esperava 3 turnos, achou %s.', v_qtd);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_jor_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
        v_3t boolean; v_qtd int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Declarar terceiro turno sem cadastrar nenhum turno';
  r.esperado:='Aceito, mas a inconsistencia de preenchimento fica sem sinalizacao';
  INSERT INTO public.empresa_cadastro
    (tenant_id, razao_social, cnpj, possui_terceiro_turno, turnos)
  VALUES (v_t, '[QA] Terceiro Turno Sem Turnos', '11222333000929', true, '[]'::jsonb)
  RETURNING id INTO v_id;
  SELECT possui_terceiro_turno, jsonb_array_length(turnos) INTO v_3t, v_qtd
    FROM public.empresa_cadastro WHERE id=v_id;
  IF v_3t AND v_qtd = 0 THEN
    r.situacao:='passou';
    r.obtido:='Aceito: terceiro turno declarado com lista de turnos vazia. E preenchimento gradual, nao defeito — mas ninguem e avisado da pendencia.';
  ELSE
    r.situacao:='falhou'; r.obtido:=format('3turno=%s, turnos=%s.', v_3t, v_qtd);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_hier_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_grupo uuid; v_emp uuid; v_grupo_da_emp uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Cadastrar um grupo economico';
  r.esperado:='A empresa fica vinculada ao grupo';
  INSERT INTO public.grupos_economicos (tenant_id, nome)
  VALUES (v_t, '[QA] Grupo Teste') RETURNING id INTO v_grupo;
  r.passo_ordem:=2; r.passo_acao:='Vincular a empresa ao grupo';
  INSERT INTO public.empresa_cadastro (tenant_id, razao_social, cnpj, grupo_economico_id)
  VALUES (v_t, '[QA] Empresa Do Grupo', '11333444000181', v_grupo) RETURNING id INTO v_emp;
  SELECT grupo_economico_id INTO v_grupo_da_emp FROM public.empresa_cadastro WHERE id=v_emp;
  IF v_grupo_da_emp = v_grupo THEN
    r.situacao:='passou'; r.obtido:='Empresa vinculada ao grupo economico.';
  ELSE
    r.situacao:='falhou'; r.obtido:='A empresa nao referenciou o grupo.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_hier_002()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_grupo uuid; v_emp uuid; v_existe boolean; v_grupo_da_emp uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar grupo com uma empresa vinculada';
  r.esperado:='Apagar o grupo preserva a empresa (SET NULL)';
  INSERT INTO public.grupos_economicos (tenant_id, nome)
  VALUES (v_t, '[QA] Grupo Que Sera Apagado') RETURNING id INTO v_grupo;
  INSERT INTO public.empresa_cadastro (tenant_id, razao_social, cnpj, grupo_economico_id)
  VALUES (v_t, '[QA] Empresa Sobrevivente', '11333444000262', v_grupo) RETURNING id INTO v_emp;

  r.passo_ordem:=2; r.passo_acao:='Apagar o grupo economico';
  DELETE FROM public.grupos_economicos WHERE id=v_grupo;

  r.passo_ordem:=3; r.passo_acao:='Conferir que a empresa sobreviveu';
  SELECT EXISTS(SELECT 1 FROM public.empresa_cadastro WHERE id=v_emp) INTO v_existe;
  SELECT grupo_economico_id INTO v_grupo_da_emp FROM public.empresa_cadastro WHERE id=v_emp;
  IF v_existe AND v_grupo_da_emp IS NULL THEN
    r.situacao:='passou';
    r.obtido:='Grupo apagado; a empresa sobreviveu, agora sem grupo (SET NULL). Nenhum cadastro destruido.';
  ELSE
    r.situacao:='falhou';
    r.obtido:=format('Empresa existe=%s, grupo=%s. Se a empresa sumiu, apagar um grupo destroi cadastros inteiros.',
                     v_existe, v_grupo_da_emp);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_dado_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid; v_tipo text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Cadastrar empresa com tipo de pessoa = "mei"';
  r.esperado:='Idealmente recusado — so pj e pf sao valores previstos';
  BEGIN
    INSERT INTO public.empresa_cadastro (tenant_id, razao_social, cnpj, tipo_pessoa)
    VALUES (v_t, '[QA] Tipo Pessoa Invalido', '11333444000343', 'mei') RETURNING id INTO v_id;
    SELECT tipo_pessoa INTO v_tipo FROM public.empresa_cadastro WHERE id=v_id;
    r.situacao:='falhou';
    r.obtido:=format('O BANCO ACEITOU tipo_pessoa = "%s". So pj e pf sao previstos (MEI e uma pj). O tipo decide qual documento identifica a empresa.', v_tipo);
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: tipo de pessoa restrito a pj ou pf.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

-- ── Registrar ──
INSERT INTO public.qa_implementacoes (codigo, funcao_sql) VALUES
  ('ENQ-001','qa_caso_enq_001'),('ENQ-010','qa_caso_enq_010'),('ENQ-011','qa_caso_enq_011'),
  ('ENQ-012','qa_caso_enq_012'),('ENQ-013','qa_caso_enq_013'),('ENQ-014','qa_caso_enq_014'),
  ('JOR-001','qa_caso_jor_001'),('JOR-002','qa_caso_jor_002'),('JOR-010','qa_caso_jor_010'),
  ('HIER-001','qa_caso_hier_001'),('HIER-002','qa_caso_hier_002'),
  ('DADO-010','qa_caso_dado_010')
ON CONFLICT (codigo) DO UPDATE SET funcao_sql=EXCLUDED.funcao_sql, ativo=true;

-- ── Rodar ──
DO $roda$ BEGIN PERFORM public.qa_rodar_bateria('manual', 'estrutura-organizacional/empresa'); END $roda$;

SELECT codigo, situacao::text, left(obtido, 68) AS resultado
FROM public.qa_resultados
WHERE execucao_id = (SELECT id FROM public.qa_execucoes ORDER BY iniciada_em DESC LIMIT 1)
  AND (codigo LIKE 'ENQ-%' OR codigo LIKE 'JOR-%' OR codigo LIKE 'HIER-%' OR codigo LIKE 'DADO-%')
ORDER BY (situacao='falhou') DESC, codigo;
