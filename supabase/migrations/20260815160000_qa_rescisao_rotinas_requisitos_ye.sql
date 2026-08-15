-- ============================================================================
-- QA RESCISÃO — rotinas dos casos da análise de requisitos YE-DP-RESC-001
-- (DESL-015..110, documentados em 20260815150000).
--
-- Dos 14 casos novos, NOVE são de nível 'api' e ganham rotina aqui:
--   DESL-015 (multa §8º/antecipação), DESL-025 (validação jurídica),
--   DESL-057 (guia FGTS Digital), DESL-083 (assistência ao menor),
--   DESL-093 (prazo S-2299), DESL-094 (rejeição/anti-duplicidade),
--   DESL-105 (complementar), DESL-106 (reversão com rito),
--   DESL-110 (perfil/dossiê).
-- Os cinco 'e2e' (DESL-023/024/045/046/082) verificam cálculo e fluxo que
-- vivem no React (calcularRescisao / DesligamentoForm) — cobertura do
-- Cypress, como definido na revisão de 31/07 da própria família.
--
-- Padrão da casa: testa o que a LEI exige; divergência = falha proposital
-- com diagnóstico. Nenhuma funcionalidade é alterada.
-- ============================================================================

-- DESL-015 — multa do §8º sinalizada no atraso; dia não útil antecipa
CREATE OR REPLACE FUNCTION public.qa_caso_desl_015()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_pgto text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o pagamento das verbas é registrado e conferido contra o prazo?';
  r.esperado := 'Data de pagamento gravada; atraso além do 10º dia acusa a multa do §8º; dia não útil antecipa a data-alvo';
  v_pgto := coalesce(public.qa_col_existe('folha_rescisoes', '%data_pagamento%'),
                     public.qa_col_existe('folha_rescisoes', '%pago_em%'),
                     public.qa_col_existe('admissoes', '%pagamento_rescis%'));
  -- só conta função que fale do PRAZO/MULTA da rescisão em si — "desligamento
  -- + prazo" solto pega o prazo do EXAME demissional (exame_demissional_pendencias)
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.proname NOT ILIKE '%exame%' AND p.proname NOT ILIKE '%demissional%'
    AND (p.prosrc ILIKE '%477%'
         OR (p.prosrc ILIKE '%rescis%' AND p.prosrc ILIKE '%multa%')
         OR (p.prosrc ILIKE '%data_pagamento%' AND p.prosrc ILIKE '%desligamento%'));

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO (metade boa, metade ausente): folha_rescisoes registra a data '
             || 'de pagamento (%s) — a matéria-prima existe —, mas NINGUÉM a confere contra '
             || 'o limite do art. 477: nenhuma função compara pagamento × (término + 10 '
             || 'dias), acusa o atraso ou projeta a multa do §8º (um salário ao empregado). '
             || 'O DESL-014 já provou que a data-limite aparece na tela (regra RNDES24, no '
             || 'React); do lado do banco, pagamento no 11º dia entra igual ao do 5º e o '
             || 'painel "rescisão no prazo" (seção 29) segue sem fonte. Também não há motor '
             || 'de antecipação por dia não útil (mesmo vazio do DEC13-031). Correção: '
             || 'conferência pagamento × limite (com antecipação via tabela feriados) + '
             || 'multa projetada e alerta no atraso.',
             coalesce(v_pgto, 'campo de data de pagamento AUSENTE'));
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Controle presente (campo: %s; funções: %s).',
                       coalesce(v_pgto, '—'), v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- DESL-025 — justa causa/indireta exigem validação de perfil competente
CREATE OR REPLACE FUNCTION public.qa_caso_desl_025()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_adm uuid; v_aceitou boolean := false; v_col text;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao := 'Desligar por JUSTA CAUSA direto no banco, sem validação jurídica nenhuma';
  r.esperado := 'Retido — o enquadramento do art. 482 exige aprovação de perfil competente com evidências';
  INSERT INTO public.admissoes
    (tenant_id, nome_completo, cpf, email, cargo, status, data_admissao)
  VALUES (v_t, '[QA-DESL-025] Colaborador', public.qa_cpf(8025),
          'qa.desl025@sandbox.invalid', 'Operador', 'concluido', CURRENT_DATE - 700)
  RETURNING id INTO v_adm;
  BEGIN
    UPDATE public.admissoes SET
      status = 'desligado', data_desligamento = CURRENT_DATE,
      motivo_desligamento = 'com_justa_causa'
    WHERE id = v_adm;
    v_aceitou := true;
  EXCEPTION WHEN check_violation OR raise_exception THEN v_aceitou := false; END;

  r.passo_ordem := 2;
  r.passo_acao := 'AUDITORIA: existe onde registrar a validação (quem aprovou o enquadramento)?';
  r.esperado := 'Campo/fluxo de aprovação jurídica com evidências e trilha';
  v_col := coalesce(public.qa_col_existe('admissoes', '%validacao%'),
                    public.qa_col_existe('admissoes', '%aprovad%'),
                    public.qa_col_existe('admissoes', '%juridic%'));

  IF v_aceitou AND v_col IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a justa causa entrou SEM RITO — o banco aceitou o desligamento pelo '
             || 'art. 482 sem validação de ninguém, e não existe campo para registrar quem '
             || 'aprovou o enquadramento nem as evidências que o sustentam. Justa causa é a '
             || 'modalidade que mais reverte em juízo: revertida, vira dispensa sem justa '
             || 'causa com todas as verbas (aviso, multa de 40%, seguro-desemprego) devidas '
             || 'de uma vez. A matriz do documento (seção 6) reserva a validação ao jurídico. '
             || 'Correção: transição para justa causa/indireta condicionada a registro de '
             || 'validação (validador + data + evidências), no mesmo desenho da dupla '
             || 'aprovação já pedida para reabertura.';
  ELSIF NOT v_aceitou THEN
    r.situacao := 'passou';
    r.obtido := 'A justa causa sem validação foi retida na gravação.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Aceita com campo de validação disponível (%s) — conferir a '
                       || 'obrigatoriedade no fluxo.', v_col);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- DESL-057 — guia rescisória no FGTS Digital + contingência
CREATE OR REPLACE FUNCTION public.qa_caso_desl_057()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_tab text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a guia rescisória do FGTS Digital tem estrutura?';
  r.esperado := 'Guia com base, percentual da modalidade e prazo; fila de reprocessamento na indisponibilidade';
  -- estrutura ESPECÍFICA de FGTS: hub_guias (Hub Contábil) é guia genérica
  -- digitada à mão (tipo texto livre) — não é geração de guia rescisória
  SELECT string_agg(table_name, ', ') INTO v_tab
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name ILIKE '%fgts%';
  v_fns := public.qa_fns_com('%fgts%');

  IF v_tab IS NULL AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o FGTS Digital não existe no banco — nenhuma tabela ou função '
             || 'específica de FGTS. A multa (40%/20%) é calculada no React '
             || '(calcularRescisao) e gravada como número em folha_rescisoes; o que existe '
             || 'de "guia" é o hub_guias do Hub Contábil, registro GENÉRICO digitado à mão '
             || '(tipo em texto livre, valor e vencimento manuais) — serve para anotar que '
             || 'a guia existe, não para GERÁ-LA com base, percentual da modalidade e prazo '
             || 'do FGTS rescisório. E não há fila de contingência para indisponibilidade '
             || 'do serviço (RNF-008): da apuração ao recolhimento, o caminho vive no '
             || 'navegador do DP. Correção: estrutura própria da guia rescisória (base, '
             || 'percentual, prazo, status, comprovante) alimentada pela rescisão + fila de '
             || 'reprocessamento, no desenho da transmissão do eSocial. Fluxo vigente do '
             || 'FGTS Digital é [VAL] (seção 30).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Estrutura específica de FGTS presente (tabelas: %s; funções: %s).',
                       coalesce(v_tab, '—'), coalesce(v_fns, '—'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- DESL-083 — quitação de menor exige assistência (art. 439)
CREATE OR REPLACE FUNCTION public.qa_caso_desl_083()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_adm uuid; v_aceitou boolean := false; v_col text;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao := 'Desligar colaborador de 17 anos sem nenhum dado de assistente legal';
  r.esperado := 'Retido — a quitação final do menor exige assistência do responsável (art. 439)';
  INSERT INTO public.admissoes
    (tenant_id, nome_completo, cpf, email, cargo, status, data_admissao, data_nascimento)
  VALUES (v_t, '[QA-DESL-083] Menor', public.qa_cpf(8083),
          'qa.desl083@sandbox.invalid', 'Aprendiz', 'concluido',
          CURRENT_DATE - 300, CURRENT_DATE - interval '17 years')
  RETURNING id INTO v_adm;
  BEGIN
    UPDATE public.admissoes SET
      status = 'desligado', data_desligamento = CURRENT_DATE,
      motivo_desligamento = 'pedido_demissao'
    WHERE id = v_adm;
    v_aceitou := true;
  EXCEPTION WHEN check_violation OR raise_exception THEN v_aceitou := false; END;

  r.passo_ordem := 2;
  r.passo_acao := 'AUDITORIA: existe onde registrar o assistente do menor na quitação?';
  r.esperado := 'Campo de responsável/assistente exigido quando a idade no término é < 18';
  v_col := coalesce(public.qa_col_existe(NULL, '%assistente%'),
                    public.qa_col_existe(NULL, '%responsavel_legal%'));

  IF v_aceitou AND v_col IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o menor de 18 foi desligado sem assistência — o banco não olhou a '
             || 'data de nascimento e não existe campo de assistente/responsável legal em '
             || 'lugar nenhum do sistema. O art. 439 permite ao menor assinar recibos do '
             || 'dia a dia, mas a QUITAÇÃO FINAL sem o responsável é nula: todas as verbas '
             || 'podem ser rediscutidas como se nunca quitadas. A idade já está no cadastro '
             || '(mesma fonte do ADM-030). Correção: quando idade no término < 18, exigir '
             || 'registro do assistente (nome/CPF/parentesco) e a assinatura dele junto à '
             || 'do menor no termo de quitação.';
  ELSIF NOT v_aceitou THEN
    r.situacao := 'passou';
    r.obtido := 'O desligamento do menor sem assistente foi retido.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Aceito com estrutura de assistente disponível (%s) — conferir a '
                       || 'exigência no fluxo de quitação.', v_col);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- DESL-093 — prazo do S-2299: 10 dias ou antes do pagamento
CREATE OR REPLACE FUNCTION public.qa_caso_desl_093()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_col text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a transmissão do S-2299 tem prazo projetado e vigiado?';
  r.esperado := 'Data-limite = mín(pagamento, término + 10 dias); aproximação alerta; atraso é acusado';
  IF to_regclass('public.esocial_transmissoes') IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'A tabela de transmissões do eSocial não existe nesta base.';
    RETURN r;
  END IF;
  v_col := coalesce(public.qa_col_existe('esocial_transmissoes', '%prazo%'),
                    public.qa_col_existe('esocial_transmissoes', '%data_limite%'),
                    public.qa_col_existe('esocial_transmissoes', '%vencimento%'));
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%2299%' AND p.prosrc ILIKE '%prazo%');

  IF v_col IS NULL AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o S-2299 não tem relógio — esocial_transmissoes não guarda prazo '
             || 'nem data-limite (só status e retorno), e nenhuma função projeta o '
             || 'vencimento do evento de desligamento. O prazo tem regra dupla: até 10 dias '
             || 'do desligamento, ANTECIPADO se o pagamento das verbas vier antes — dois '
             || 'relógios, vence o primeiro. Sem a projeção, a transmissão tardia entra '
             || 'como se regular fosse e a multa por atraso de obrigação acessória chega '
             || 'sem aviso. Somado ao DESL-091 (o evento do desligamento nem chega à fila), '
             || 'o quadro é: sem evento E sem prazo. Correção: data-limite calculada na '
             || 'criação do evento + alertas de aproximação + marcação explícita de FORA '
             || 'DO PRAZO na transmissão tardia.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Prazo controlado (campo: %s; funções: %s).',
                       coalesce(v_col, '—'), coalesce(v_fns, '—'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- DESL-094 — rejeição do S-2299 traduzida; reenvio sem duplicidade
CREATE OR REPLACE FUNCTION public.qa_caso_desl_094()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_unq text; v_trad text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a fila do eSocial tem anti-duplicidade e tradução de rejeição?';
  r.esperado := 'Reenvio corrigido retifica (nunca segundo S-2299 do mesmo vínculo) e a rejeição vira instrução';
  IF to_regclass('public.esocial_transmissoes') IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'A tabela de transmissões do eSocial não existe nesta base.';
    RETURN r;
  END IF;
  SELECT string_agg(conname, ', ') INTO v_unq
  FROM pg_constraint WHERE conrelid = 'public.esocial_transmissoes'::regclass AND contype = 'u';
  v_trad := coalesce(public.qa_fns_com('%rejeic%esocial%'), public.qa_fns_com('%esocial%rejei%'));

  IF v_unq IS NULL AND v_trad IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO (quarto da série ADM-093 / FERIAS-081 / DEC13-050, agora no evento '
             || 'que ENCERRA o vínculo): esocial_transmissoes segue sem unicidade — o mesmo '
             || 'S-2299 pode ser gravado e enviado duas vezes — e nenhuma função traduz '
             || 'rejeições: o retorno técnico chega cru e o reenvio fica por conta do '
             || 'operador. Desligamento duplicado no governo é o pior da série: trava os '
             || 'eventos futuros do CPF (readmissão inclusive) até alguém excluir o evento '
             || 'errado no portal. Correção: chave natural (vínculo + tipo + competência) '
             || 'na fila + rotina que interpreta a rejeição e conduz retificação — uma vez, '
             || 'para as quatro famílias que dependem dela.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Proteções presentes (unicidade: %s; tradução: %s).',
                       coalesce(v_unq, '—'), coalesce(v_trad, '—'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- DESL-105 — rescisão complementar com vínculo à original
CREATE OR REPLACE FUNCTION public.qa_caso_desl_105()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_col text; v_fns text; v_unq text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a rescisão complementar tem onde existir?';
  r.esperado := 'Diferença apurada como registro próprio, vinculado à rescisão original, com reflexo no eSocial';
  v_col := coalesce(public.qa_col_existe('folha_rescisoes', '%complementar%'),
                    public.qa_col_existe('folha_rescisoes', '%origem%'),
                    public.qa_col_existe('folha_rescisoes', '%rescisao_pai%'));
  v_fns := public.qa_fns_com('%complementar%');
  SELECT string_agg(conname, ', ') INTO v_unq
  FROM pg_constraint WHERE conrelid = 'public.folha_rescisoes'::regclass AND contype = 'u';

  IF v_col IS NULL AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: a rescisão complementar não tem onde viver — folha_rescisoes '
             || 'não tem marcação de complementar nem vínculo a uma rescisão de origem, e '
             || 'nenhuma função apura diferenças. O agravante: a tabela também não tem '
             || 'unicidade (%s), então uma segunda rescisão do mesmo colaborador entra '
             || 'como linha solta — indistinguível de duplicata, de erro ou de '
             || 'complementar de verdade. Dissídio retroativo é rotina anual em categoria '
             || 'organizada: sem a estrutura, cada reajuste vira ou passivo ignorado ou '
             || 'edição da rescisão quitada (fraude de trilha). Correção: tipo '
             || '(original/complementar) + referência à rescisão-mãe + apuração da '
             || 'diferença com memória própria e S-2299 complementar.',
             coalesce('constraints: ' || v_unq, 'nenhuma constraint de unicidade'));
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Estrutura presente (campos: %s; funções: %s).',
                       coalesce(v_col, '—'), coalesce(v_fns, '—'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- DESL-106 — reversão do desligamento só com rito e estorno
CREATE OR REPLACE FUNCTION public.qa_caso_desl_106()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_adm uuid; v_reativou boolean := false; v_status text; v_data date;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao := 'Desligar um colaborador e depois "reativá-lo" com UPDATE direto, sem rito nenhum';
  r.esperado := 'Bloqueado — reversão exige fluxo próprio: motivo, dupla aprovação, estorno e tratamento do eSocial';
  INSERT INTO public.admissoes
    (tenant_id, nome_completo, cpf, email, cargo, status, data_admissao)
  VALUES (v_t, '[QA-DESL-106] Colaborador', public.qa_cpf(8106),
          'qa.desl106@sandbox.invalid', 'Operador', 'concluido', CURRENT_DATE - 600)
  RETURNING id INTO v_adm;
  UPDATE public.admissoes SET
    status = 'desligado', data_desligamento = CURRENT_DATE - 20,
    motivo_desligamento = 'sem_justa_causa'
  WHERE id = v_adm;

  BEGIN
    UPDATE public.admissoes SET
      status = 'concluido', data_desligamento = NULL, motivo_desligamento = NULL
    WHERE id = v_adm;
    v_reativou := true;
  EXCEPTION WHEN check_violation OR raise_exception THEN v_reativou := false; END;

  r.passo_ordem := 2;
  r.passo_acao := 'Conferir o que sobrou do desligamento revertido';
  SELECT status::text, data_desligamento INTO v_status, v_data
  FROM public.admissoes WHERE id = v_adm;

  IF v_reativou AND v_status = 'concluido' AND v_data IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a reversão foi um UPDATE qualquer — o colaborador desligado voltou '
             || 'a "concluído" com data e motivo APAGADOS, sem aprovação, sem motivo de '
             || 'reversão, sem estorno das verbas e sem tratar o S-2299 (se transmitido, o '
             || 'governo continua com um desligamento que a empresa diz não existir). É a '
             || 'outra face do DESL-002: como o desligamento é colunas na admissão e não '
             || 'evento, desfazê-lo é apagar história. Correção: fluxo de reversão com '
             || 'motivo + dupla aprovação, evento de desligamento preservado como '
             || 'histórico, estorno rastreado das verbas e exclusão/retificação formal do '
             || 'evento no eSocial (mesma disciplina do FERIAS-054 e DEC13-070).';
  ELSIF NOT v_reativou THEN
    r.situacao := 'passou';
    r.obtido := 'A reativação direta foi bloqueada — reversão só por fluxo próprio.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Reativação controlada (status: %s; histórico preservado: %s).',
                       v_status, coalesce(v_data::text, 'apagado'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- DESL-110 — dossiê rescisório restrito por perfil
CREATE OR REPLACE FUNCTION public.qa_caso_desl_110()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_restr int; v_proprio int; v_perfil text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): as políticas de folha_rescisoes separam papel, equipe e o próprio?';
  r.esperado := 'Camada RESTRICTIVE por perfil; colaborador só o próprio dossiê; gestor só a equipe';
  SELECT count(*) INTO v_restr
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'folha_rescisoes'
    AND permissive = 'RESTRICTIVE';
  SELECT count(*) INTO v_proprio
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'folha_rescisoes'
    AND (qual ILIKE '%auth.uid%' OR qual ILIKE '%colaborador%uid%' OR qual ILIKE '%departamento%');
  SELECT string_agg(DISTINCT p.polname, ', ') INTO v_perfil
  FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
  WHERE c.relname = 'folha_rescisoes' AND p.polname ILIKE 'perfil_restringe%';

  IF v_restr = 0 AND v_proprio = 0 THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO (par do DEC13-071, agora no dado mais sensível do ciclo): '
             || 'folha_rescisoes tem só a política de tenant — qualquer usuário autenticado '
             || 'da empresa lê TODAS as rescisões: verbas, motivo do desligamento (justa '
             || 'causa inclusive) e, por tabela irmã, o rastro de saúde da estabilidade. A '
             || 'matriz do documento (seção 6) é explícita: colaborador só o próprio '
             || 'dossiê, gestor só a equipe, jurídico/DP/financeiro por papel. A tabela '
             || 'está fora da camada perfil_restringe_leitura_* que já protege as tabelas '
             || 'sensíveis do sistema (a rotina PERFIL-003 cobra exatamente isso de tabela '
             || 'nova). Correção: política RESTRICTIVE via perfil_permite_modulo + regra '
             || 'de próprio registro/equipe, no padrão das 20 tabelas já cobertas.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Camadas presentes (restritivas: %s; próprio/equipe: %s; perfil: %s).',
                       v_restr, v_proprio, coalesce(v_perfil, '—'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- Registro no motor
INSERT INTO public.qa_implementacoes (codigo, funcao_sql, ativo) VALUES
  ('DESL-015','qa_caso_desl_015',true), ('DESL-025','qa_caso_desl_025',true),
  ('DESL-057','qa_caso_desl_057',true), ('DESL-083','qa_caso_desl_083',true),
  ('DESL-093','qa_caso_desl_093',true), ('DESL-094','qa_caso_desl_094',true),
  ('DESL-105','qa_caso_desl_105',true), ('DESL-106','qa_caso_desl_106',true),
  ('DESL-110','qa_caso_desl_110',true)
ON CONFLICT (codigo) DO UPDATE SET funcao_sql = EXCLUDED.funcao_sql, ativo = true;
