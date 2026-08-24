-- ============================================================================
-- QA BEN — rotinas dos casos da análise de requisitos YE-DP-BEN-001
-- (BEN-001..080, documentados em 20260824100000). 14 casos de nível 'api'
-- ganham rotina; BEN-090 (portal) é de tela e fica para o Cypress.
--
-- Padrão da casa: sondas de escrita no sandbox (qa_modo_ligar) + auditorias
-- somente leitura em pg_proc/pg_policies/information_schema. Divergência
-- com a norma/documento = falha proposital com diagnóstico e correção
-- sugerida. Nenhuma funcionalidade é alterada.
-- ============================================================================

-- BEN-001 — elegibilidade aplicada
CREATE OR REPLACE FUNCTION public.qa_caso_ben_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_col text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): alguém lê regras_cargo/vinculo/unidade na adesão?';
  r.esperado := 'Elegibilidade conferida ao aderir — cargo fora da regra é bloqueado/sinalizado';
  v_col := public.qa_col_existe('beneficios_tipos', 'regras_cargo');
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%regras_cargo%' OR p.prosrc ILIKE '%regras_vinculo%'
         OR p.prosrc ILIKE '%regras_unidade%');

  IF v_col IS NOT NULL AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: as regras de elegibilidade estão cadastradas (regras_cargo, '
             || 'regras_vinculo, regras_unidade em beneficios_tipos) e NENHUMA função as '
             || 'lê — a adesão em beneficios_colaboradores aceita qualquer colaborador em '
             || 'qualquer benefício, e a regra vira anotação. Conceder fora da regra é '
             || 'custo sem controle e diferenciação sem critério (risco de equiparação); '
             || 'negar o que a CCT garante é passivo. Correção: validação de elegibilidade '
             || 'na adesão (gatilho ou função de adesão), com sinalização para o DP '
             || 'decidir a exceção documentada.';
  ELSIF v_col IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'As colunas de regras de elegibilidade não existem mais em beneficios_tipos.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Elegibilidade aplicada por: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- BEN-010 — VT sem termo de opção
CREATE OR REPLACE FUNCTION public.qa_caso_ben_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_tipo uuid; v_status text; v_termo text;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao := 'Registrar adesão de VT SEM termo de opção e ver se algo protesta';
  r.esperado := 'Bloqueio ou pendência de termo — o VT é optativo (Lei 7.418/85)';
  INSERT INTO public.beneficios_tipos (tenant_id, nome, categoria)
  VALUES (v_t, 'QA — Vale-transporte', 'transporte')
  RETURNING id INTO v_tipo;
  INSERT INTO public.beneficios_colaboradores
    (tenant_id, beneficio_tipo_id, colaborador_id, colaborador_nome, colaborador_cpf,
     valor, valor_desconto, data_inicio, status)
  VALUES (v_t, v_tipo, gen_random_uuid(), 'QA Colaborador Ben Dez', public.qa_cpf(70),
          220.00, 90.00, CURRENT_DATE, 'ativo');
  SELECT bc.status INTO v_status FROM public.beneficios_colaboradores bc
  WHERE bc.tenant_id = v_t AND bc.beneficio_tipo_id = v_tipo LIMIT 1;

  r.passo_ordem := 2;
  r.passo_acao := 'AUDITORIA: a adesão tem onde ancorar o termo de opção/recusa?';
  r.esperado := 'Vínculo com o termo assinado (documento) na adesão';
  v_termo := coalesce(public.qa_col_existe('beneficios_colaboradores', '%termo%'),
                      public.qa_col_existe('beneficios_colaboradores', '%documento%'),
                      public.qa_col_existe('beneficios_colaboradores', '%arquivo%'));

  IF v_status = 'ativo' AND v_termo IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a adesão de VT nasceu ATIVA, com desconto, sem termo de opção — e '
             || 'pior: não existe sequer COLUNA para ancorar o termo (ou a recusa) em '
             || 'beneficios_colaboradores. O VT é optativo por lei: descontar de quem não '
             || 'optou é desconto ilegal; conceder sem opção documentada perde a prova da '
             || 'natureza não salarial. A coleta na admissão existe (ADM-050) mas não se '
             || 'conecta ao benefício. Correção: vínculo obrigatório da adesão com o termo '
             || '(assinado, no módulo Documentos — padrão ADM-070); sem termo, adesão '
             || 'pendente, sem concessão nem desconto; recusa registrada com reopção '
             || 'possível.';
  ELSIF v_status IS DISTINCT FROM 'ativo' THEN
    r.situacao := 'passou';
    r.obtido := format('A adesão sem termo não se consumou (status: %s).', coalesce(v_status, 'NULL'));
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Há ancoragem para o termo (%s) — a sonda fina fica com a rotina de tela.', v_termo);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- BEN-011 — VT: menor entre 6% e custo
CREATE OR REPLACE FUNCTION public.qa_caso_ben_011()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_pct numeric; v_fns text;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao := 'Cadastrar VT com desconto de 15% no catálogo e ver se o teto legal segura';
  r.esperado := 'Percentual acima de 6% recusado ou limitado (Lei 7.418/85)';
  INSERT INTO public.beneficios_tipos
    (tenant_id, nome, categoria, tipo_desconto, percentual_desconto)
  VALUES (v_t, 'QA — VT quinze por cento', 'transporte', 'percentual', 15);
  SELECT bt.percentual_desconto INTO v_pct FROM public.beneficios_tipos bt
  WHERE bt.tenant_id = v_t AND bt.nome = 'QA — VT quinze por cento';

  r.passo_ordem := 2;
  r.passo_acao := 'AUDITORIA: existe motor que calcule o MENOR entre 6% do salário e o custo real?';
  r.esperado := 'Cálculo com os dois tetos e memória; home office dispensa o VT';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%beneficio%'
    AND (p.prosrc ILIKE '%0.06%' OR p.prosrc ILIKE '%salario%basico%');

  IF v_pct = 15 AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o catálogo aceitou VT com desconto de 15% — nenhum CHECK ou '
             || 'gatilho conhece o teto legal de 6%, e não existe motor que calcule o '
             || 'desconto correto (o MENOR entre 6% do salário básico e o custo real do '
             || 'transporte): beneficios_colaboradores guarda valor e valor_desconto '
             || 'digitados à mão. Passe barato deve descontar menos que 6%; reajuste '
             || 'salarial deve recalcular o teto — nada disso tem onde acontecer. O limite '
             || 'genérico na folha (FOLHA-030) não substitui a conta do benefício. '
             || 'Correção: teto de 6% validado no catálogo para a categoria transporte + '
             || 'motor de cálculo por competência (salário básico × 6% vs. custo, '
             || 'proporcional aos dias — BEN-050), com memória.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Teto tratado (percentual gravado: %s; motor: %s).',
                       coalesce(v_pct::text, 'recusado'), coalesce(v_fns, 'na gravação'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- BEN-012 — VR/VA: limite do PAT
CREATE OR REPLACE FUNCTION public.qa_caso_ben_012()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_pct numeric; v_param text;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao := 'Cadastrar VR com desconto de 50% do valor e ver se o limite do PAT segura';
  r.esperado := 'Participação do trabalhador limitada (PAT/CCT) — 50% não passa em silêncio';
  INSERT INTO public.beneficios_tipos
    (tenant_id, nome, categoria, tipo_desconto, percentual_desconto)
  VALUES (v_t, 'QA — VR cinquenta por cento', 'alimentacao', 'percentual', 50);
  SELECT bt.percentual_desconto INTO v_pct FROM public.beneficios_tipos bt
  WHERE bt.tenant_id = v_t AND bt.nome = 'QA — VR cinquenta por cento';

  r.passo_ordem := 2;
  r.passo_acao := 'AUDITORIA: existe parâmetro de limite do PAT/CCT em algum lugar?';
  r.esperado := 'Teto parametrizado e versionado, aplicado na competência';
  v_param := coalesce(public.qa_col_existe(NULL, '%limite%pat%'),
                      public.qa_col_existe('beneficios_tipos', '%limite%'),
                      public.qa_col_existe('beneficios_tipos', '%teto%'));

  IF v_pct = 50 AND v_param IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o VR aceitou desconto de 50% e não existe NENHUM parâmetro de '
             || 'limite (nem coluna de teto no catálogo, nem tabela de parâmetros do '
             || 'PAT): a participação do trabalhador — que o PAT limita como condição do '
             || 'benefício fiscal — é o que o operador digitar. Desconto acima do limite '
             || 'descaracteriza o VR (vira salário, com INSS/FGTS retroativos) e derruba '
             || 'o incentivo; a Lei 14.442/22 ainda veda rebate ao empregador, e o '
             || 'sistema não tem onde registrar essa vedação por fornecedora. Correção: '
             || 'teto parametrizado [VAL] por PAT/CCT, versionado por competência, '
             || 'validado no catálogo e na aplicação do desconto.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Limite tratado (percentual: %s; parâmetro: %s).',
                       coalesce(v_pct::text, 'recusado'), coalesce(v_param, 'na gravação'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- BEN-020 — ponte benefícios → Folha
CREATE OR REPLACE FUNCTION public.qa_caso_ben_020()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a adesão vira rubrica na Folha com incidência parametrizada?';
  r.esperado := 'Rubricas (desconto + patronal) geradas por competência, com incidência e memória';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    -- vínculo genérico/limpeza citam a tabela sem ser motor de benefício
    AND p.proname NOT IN ('colaborador_tem_vinculos', 'excluir_colaborador_forcado')
    AND p.prosrc ILIKE '%beneficios_colaboradores%'
    AND (p.prosrc ILIKE '%folha%' OR p.prosrc ILIKE '%rubrica%');

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: não existe ponte entre os benefícios e a Folha — nenhuma função '
             || 'lê beneficios_colaboradores para gerar rubricas de desconto/patronal na '
             || 'competência: o desconto vive parado no cadastro e entra na folha na mão, '
             || 'a cada mês, para cada colaborador. Sem o motor de incidências por '
             || 'benefício (RF-009), a natureza de cada rubrica (VT/VR não integram; '
             || 'utilidade do art. 458 pode integrar) fica na memória do operador — e '
             || 'benefício mal classificado vira salário com passivo previdenciário '
             || 'retroativo. A infraestrutura do outro lado existe (folha_rubricas, '
             || 'folha_itens, memória da família FOLHA). Correção: geração automática das '
             || 'rubricas por competência a partir das adesões ativas, com incidência '
             || 'parametrizada e versionada e memória de cálculo (padrão FOLHA-080).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Ponte com a Folha presente: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- BEN-030 — dependentes com regra
CREATE OR REPLACE FUNCTION public.qa_caso_ben_030()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_tab text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): existe estrutura de dependentes de benefício?';
  r.esperado := 'Dependentes com idade/parentesco/documentação validados, refletindo na operadora e no IRRF';
  SELECT string_agg(table_name, ', ') INTO v_tab
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND (table_name ILIKE '%dependente%');

  IF v_tab IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a estrutura de dependentes NÃO EXISTE — nenhuma tabela de '
             || 'dependentes no banco. Sem ela, o plano de saúde familiar não tem onde '
             || 'registrar as vidas (a fatura da operadora cobra por dependente e o '
             || 'sistema não sabe quantos são — a conciliação do BEN-042 nasce cega), o '
             || 'IRRF do titular não reflete os dependentes, e a regra de elegibilidade '
             || '(idade-limite, parentesco, documentação — RN-007) não tem onde morar. '
             || 'Correção: tabela de dependentes por titular (nome, nascimento, '
             || 'parentesco, documento, benefícios vinculados), com validação de regra na '
             || 'inclusão, alerta de idade a vencer e reflexo nas movimentações da '
             || 'operadora e no IRRF.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Estrutura de dependentes presente: %s.', v_tab);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- BEN-040 — manutenção do plano (arts. 30/31)
CREATE OR REPLACE FUNCTION public.qa_caso_ben_040()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_fns text; v_tab text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a rescisão calcula a manutenção do plano (arts. 30/31)?';
  r.esperado := 'Elegibilidade, período (1/3; mín. 6, máx. 24 meses), prazo de 30 dias e custo integral tratados';
  SELECT string_agg(table_name, ', ') INTO v_tab
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name ILIKE '%manutencao%plano%';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%art%30%plano%' OR p.prosrc ILIKE '%manutencao%plano%'
         OR (p.prosrc ILIKE '%9656%'));

  IF v_tab IS NULL AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: os arts. 30/31 da Lei 9.656/98 não existem no sistema — nenhuma '
             || 'tabela ou função trata a manutenção do plano do demitido sem justa causa '
             || '(1/3 do tempo de contribuição, mínimo 6 e máximo 24 meses, custo '
             || 'integral) nem do aposentado (10+ anos: vitalício), e ninguém controla o '
             || 'PRAZO DE 30 DIAS da opção — o mais perigoso do pós-rescisão: perder a '
             || 'comunicação é ação judicial quase certa, com reintegração ao plano e '
             || 'danos. O desligamento da casa é rico em pendências (família DESL) e não '
             || 'tem este item. Correção: na rescisão sem justa causa de titular '
             || 'contributário, calcular elegibilidade/período/custo, gerar a comunicação '
             || 'com prazo controlado e registrar a opção do ex-empregado (termo no '
             || 'módulo Documentos).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Manutenção tratada (tabelas: %s; funções: %s).',
                       coalesce(v_tab, '—'), coalesce(v_fns, '—'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- BEN-042 — operadoras e faturas conciliadas
CREATE OR REPLACE FUNCTION public.qa_caso_ben_042()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_tab text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): existem operadoras, movimentações e faturas com conciliação?';
  r.esperado := 'Fatura importada, comparada (vidas/valores/coparticipação) e paga só depois de conciliada';
  SELECT string_agg(table_name, ', ') INTO v_tab
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND (table_name ILIKE '%operadora%' OR table_name ILIKE '%fatura%'
         OR table_name ILIKE 'beneficios%movim%');

  IF v_tab IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o lado das operadoras não existe — sem cadastro de '
             || 'operadoras/planos (tabelas de preço por faixa etária, coparticipação), '
             || 'sem movimentações de inclusão/alteração/exclusão (o RF-012) e sem '
             || 'faturas: a conciliação mensal (vidas cobradas × vidas ativas, '
             || 'coparticipação por uso) não tem onde acontecer, e a fatura é paga na '
             || 'confiança. Vida fantasma de ex-colaborador cobrada por meses é o custo '
             || 'invisível clássico dos benefícios — exatamente o que a RN-013 manda '
             || 'bloquear ("fatura só é paga após conciliação"). Correção: estrutura '
             || 'operadora/plano/movimentação/fatura com conciliação obrigatória, glosa '
             || 'registrada e ação no Plano de Ação por divergência.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Estrutura de operadoras/faturas presente: %s.', v_tab);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- BEN-050 — proporcionalidade com o Ponto
CREATE OR REPLACE FUNCTION public.qa_caso_ben_050()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o benefício consome os dias efetivos do Ponto?';
  r.esperado := 'VT/VR proporcionais aos dias trabalhados; afastamento ajusta a concessão';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    -- vínculo genérico/limpeza citam a tabela sem ser motor de benefício
    AND p.proname NOT IN ('colaborador_tem_vinculos', 'excluir_colaborador_forcado')
    AND p.prosrc ILIKE '%beneficios_colaboradores%'
    AND (p.prosrc ILIKE '%ponto%' OR p.prosrc ILIKE '%dias%'
         OR p.prosrc ILIKE '%afastament%');

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o benefício não conversa com o Ponto — beneficios_colaboradores '
             || 'guarda valor e desconto FIXOS e nenhuma função os ajusta pelos dias '
             || 'efetivos da competência: colaborador afastado há dois meses segue com VT '
             || 'e VR cheios (custo indevido) ou tem o benefício cortado na mão (erro '
             || 'para o outro lado). O Ponto já apura os dias por colaborador '
             || '(ponto_saldo_dias_competencia_bruto, usada por férias) — o dado existe, '
             || 'o consumo não. Correção: apuração mensal do benefício proporcional aos '
             || 'dias efetivos (RN-011), com a regra de afastamento parametrizada por '
             || 'benefício/CCT e memória de cálculo.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Proporcionalidade presente: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- BEN-051 — CCT versionada alcança benefícios
CREATE OR REPLACE FUNCTION public.qa_caso_ben_051()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_cct text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a camada CCT alcança os benefícios?';
  r.esperado := 'Benefício/valor de CCT aplicados pela vigência, com tabela versionada';
  SELECT string_agg(table_name, ', ') INTO v_cct
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND (table_name ILIKE '%cct%' OR table_name ILIKE '%convenc%')
    AND table_name NOT ILIKE 'psicossocial%';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%beneficio%'
    AND (p.prosrc ILIKE '%cct%' OR p.prosrc ILIKE '%convenc%');

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO (a camada existe, não chega aqui): a parametrização por '
             || 'instrumento coletivo já é realidade no ponto e na folha (%s — com '
             || 'vigência por competência, PONTO-386), mas NADA a liga aos benefícios: '
             || 'cesta básica, VR mínimo e seguro de vida instituídos pela convenção da '
             || 'categoria não têm onde ser parametrizados por vigência — beneficios_'
             || 'tipos é um catálogo plano, sem instrumento nem versão. CCT nova exige '
             || 'reconfiguração manual, e a anterior se perde (competência antiga fica '
             || 'sem prova do valor da época). Correção: vínculo benefício × instrumento '
             || 'coletivo × vigência, versionado, aplicado pela data — o padrão que '
             || 'ponto_cct_config/folha_cct já praticam.',
             coalesce(v_cct, 'ponto_cct_config, folha_cct'));
  ELSE
    r.situacao := 'passou';
    r.obtido := format('CCT alcança os benefícios por: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- BEN-060 — termo no módulo Documentos
CREATE OR REPLACE FUNCTION public.qa_caso_ben_060()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_col text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a adesão gera termo e o arquiva no módulo Documentos?';
  r.esperado := 'Termo assinado com trilha, vinculado à adesão e arquivado com metadados';
  v_col := coalesce(public.qa_col_existe('beneficios_colaboradores', '%termo%'),
                    public.qa_col_existe('beneficios_colaboradores', '%documento%'),
                    public.qa_col_existe('beneficios_colaboradores', '%assinatura%'));
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.proname NOT IN ('colaborador_tem_vinculos', 'excluir_colaborador_forcado')
    AND p.prosrc ILIKE '%beneficio%'
    AND (p.prosrc ILIKE '%termo%' OR p.prosrc ILIKE '%assinatura%');

  IF v_col IS NULL AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a adesão não gera termo — sem coluna de vínculo com documento em '
             || 'beneficios_colaboradores e sem função que gere/colha/arquive o termo de '
             || 'opção ou adesão. O padrão da casa existe e é maduro (assinatura com '
             || 'trilha em ADM-070/DESL-082; guarda com metadados no módulo Documentos) — '
             || 'os benefícios ficaram fora dele. Sem termo: a opção do VT não se prova '
             || '(BEN-010), as condições do plano e os dependentes aceitos não se provam, '
             || 'e a manutenção dos arts. 30/31 (BEN-040) não tem onde registrar a opção '
             || 'do ex-empregado. Correção: termo gerado na adesão/recusa, assinado com '
             || 'trilha e arquivado no Documentos, com o id do documento na adesão '
             || '(RN-012).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Termo tratado (vínculo: %s; funções: %s).',
                       coalesce(v_col, '—'), coalesce(v_fns, '—'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- BEN-070 — PLR só com acordo
CREATE OR REPLACE FUNCTION public.qa_caso_ben_070()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_tab text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): existe estrutura de PLR (acordo, apuração, limite de 2/ano)?';
  r.esperado := 'PLR só é isenta com acordo prévio válido; IR em tabela própria; máx. 2 pagamentos/ano';
  SELECT string_agg(table_name, ', ') INTO v_tab
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name ILIKE '%plr%';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%plr%';

  IF v_tab IS NULL AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a PLR não existe no sistema — sem tabela de programa/acordo, sem '
             || 'apuração, sem controle dos dois pagamentos anuais e do IR em tabela '
             || 'própria. O risco é específico: pagamento rotulado de PLR sem acordo '
             || 'prévio válido (comissão paritária + sindicato, Lei 10.101/2000) é '
             || 'salário disfarçado — INSS, FGTS e reflexos retroativos sobre cada '
             || 'centavo, e é a Receita quem cobra. Enquanto a empresa não tiver '
             || 'programa, tudo bem não ter estrutura; o perigo é pagar "PLR" pela folha '
             || 'sem o cinto. Correção (quando houver programa): registro do acordo como '
             || 'condição do pagamento isento, limite de 2/ano e IR próprio (RF-014).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Estrutura de PLR presente (tabelas: %s; funções: %s).',
                       coalesce(v_tab, '—'), coalesce(v_fns, '—'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- BEN-071 — consignado dentro da margem
CREATE OR REPLACE FUNCTION public.qa_caso_ben_071()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_tab text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): existe controle de consignado e margem consignável?';
  r.esperado := 'Desconto de consignado validado contra a margem; excedente bloqueado';
  SELECT string_agg(table_name, ', ') INTO v_tab
  FROM information_schema.tables
  WHERE table_schema = 'public' AND (table_name ILIKE '%consign%' OR table_name ILIKE '%margem%');
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%consign%' OR p.prosrc ILIKE '%margem_consign%');

  IF v_tab IS NULL AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: consignado e margem consignável não existem no sistema — sem '
             || 'cadastro de convênios, sem cálculo de margem sobre a remuneração '
             || 'disponível, sem trava de desconto. Se um convênio de consignado for '
             || 'operado hoje, o desconto entra na folha como lançamento manual sem teto: '
             || 'acima da margem é ilegal (Lei 10.820/2003) e derruba o líquido do '
             || 'colaborador abaixo do vital — e salário reduzido por afastamento exige '
             || 'recálculo da margem que ninguém fará à mão. Correção (quando houver '
             || 'convênio): margem consignável parametrizada [VAL], validação de cada '
             || 'contrato contra ela e bloqueio do excedente com alerta (RF-015).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Consignado tratado (tabelas: %s; funções: %s).',
                       coalesce(v_tab, '—'), coalesce(v_fns, '—'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- BEN-080 — adesão de saúde é dado sensível
CREATE OR REPLACE FUNCTION public.qa_caso_ben_080()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_aberta int; v_perfil int;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): quem consegue LER as adesões de benefícios?';
  r.esperado := 'Leitura restrita por perfil (LGPD art. 11) — plano de saúde é dado de saúde por inferência';
  SELECT count(*) INTO v_aberta FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'beneficios_colaboradores'
    AND cmd = 'SELECT' AND policyname ILIKE '%tenant%';
  SELECT count(*) INTO v_perfil FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'beneficios_colaboradores'
    AND policyname ILIKE '%perfil%';

  IF v_aberta > 0 AND v_perfil = 0 THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: beneficios_colaboradores tem leitura aberta ao tenant '
             || '("Usuários podem ver benefícios do tenant") e NENHUMA política '
             || 'perfil_restringe_leitura_* — qualquer usuário lista quem tem plano de '
             || 'saúde, valores e descontos de todos os colegas. Adesão a plano é dado '
             || 'de saúde por inferência (LGPD art. 11), e a camada de perfil da casa já '
             || 'protege ~20 tabelas sensíveis (atestados, eventos_saude, '
             || 'folha_rescisoes...) — os benefícios ficaram fora. Mesma família do '
             || 'FOLHA-090 (salários) e do EPI-041 (biometria). Correção: política '
             || 'RESTRICTIVE por perfil na tabela, com o colaborador vendo apenas as '
             || 'próprias adesões, e log de consulta quando a estrutura de saúde '
             || 'crescer (dependentes, coparticipação).';
  ELSIF v_aberta = 0 THEN
    r.situacao := 'passou';
    r.obtido := 'A leitura aberta ao tenant não existe mais — política revista.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Camada de perfil presente (%s política(s)).', v_perfil);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ── Registro no motor ──
INSERT INTO public.qa_implementacoes (codigo, funcao_sql) VALUES
  ('BEN-001', 'qa_caso_ben_001'),
  ('BEN-010', 'qa_caso_ben_010'),
  ('BEN-011', 'qa_caso_ben_011'),
  ('BEN-012', 'qa_caso_ben_012'),
  ('BEN-020', 'qa_caso_ben_020'),
  ('BEN-030', 'qa_caso_ben_030'),
  ('BEN-040', 'qa_caso_ben_040'),
  ('BEN-042', 'qa_caso_ben_042'),
  ('BEN-050', 'qa_caso_ben_050'),
  ('BEN-051', 'qa_caso_ben_051'),
  ('BEN-060', 'qa_caso_ben_060'),
  ('BEN-070', 'qa_caso_ben_070'),
  ('BEN-071', 'qa_caso_ben_071'),
  ('BEN-080', 'qa_caso_ben_080')
ON CONFLICT (codigo) DO UPDATE SET funcao_sql = EXCLUDED.funcao_sql;

DO $fim$
BEGIN
  RAISE NOTICE 'QA BEN: 14 rotinas registradas (BEN-001..080). BEN-090 é de tela (Cypress).';
END $fim$;
