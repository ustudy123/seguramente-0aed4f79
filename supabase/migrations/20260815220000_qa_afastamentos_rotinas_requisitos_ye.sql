-- ============================================================================
-- QA AFASTAMENTOS — rotinas dos casos da análise de requisitos YE-DP-AFAST-001
-- (AFAST-010..080, documentados em 20260815210000). Todos os 14 são de nível
-- 'api': o módulo vive no banco (gatilhos de inteligência), então as sondas
-- exercitam as regras DE VERDADE — inserem afastamentos e conferem o que os
-- gatilhos produzem (marcadores, pendências, status, estabilidade).
--
-- ATENÇÃO DE MÉTODO: a inteligência foi reescrita em 24/07 (split BEFORE/
-- AFTER). Na versão de 23/07, a regra dos 15 dias VIRAVA o status para
-- aguardando_inss e a estabilidade gravava data_fim_estabilidade; a versão
-- AFTER de 24/07 (RETURN NULL) não consegue alterar a própria linha. As
-- sondas medem o comportamento VIVO — se a reescrita perdeu efeitos, é
-- exatamente o que o relatório deve acusar.
--
-- Padrão da casa: testa o que a LEI exige; divergência = falha proposital
-- com diagnóstico. Nenhuma funcionalidade é alterada.
-- ============================================================================

-- Helper: afastamento tipado no cercado
CREATE OR REPLACE FUNCTION public.qa_afast_tipado(
  p_nome text, p_semente int, p_inicio date, p_fim date, p_tipo text
)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.afastamentos
    (tenant_id, colaborador_nome, colaborador_cpf, data_inicio, data_fim,
     status, tipo_principal_new)
  VALUES (public.qa_sandbox_tenant_id(), p_nome, public.qa_cpf(p_semente),
          p_inicio, p_fim, 'ativo', p_tipo::public.afastamento_tipo_principal)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- AFAST-010 — matriz de efeitos por tipo + Tabela 18
CREATE OR REPLACE FUNCTION public.qa_caso_afast_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_param text; v_cod text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): cada tipo de afastamento carrega efeito legal e código da Tabela 18?';
  r.esperado := 'Parametrização por tipo: interrupção × suspensão + código do eSocial, com vigência';
  SELECT string_agg(table_name, ', ') INTO v_param
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND (table_name ILIKE '%afastamento%tipo%' OR table_name ILIKE '%afastamento%efeito%'
         OR table_name ILIKE '%afastamento%config%');
  v_cod := coalesce(public.qa_col_existe('afastamentos', '%tabela_18%'),
                    public.qa_col_existe('afastamentos', '%codigo_esocial%'),
                    public.qa_col_existe(NULL, '%tabela18%'));

  IF v_param IS NULL AND v_cod IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o tipo do afastamento é só um NOME — o enum '
             || 'afastamento_tipo_principal tem um catálogo rico (18 tipos), mas nenhuma '
             || 'tabela parametriza o EFEITO legal de cada um (interrupção mantém salário '
             || 'e tempo; suspensão não) nem o código da Tabela 18 do eSocial que o S-2230 '
             || 'exige. As consequências ficam por conta de quem lê o nome do tipo: a '
             || 'inteligência trata alguns casos por lista fixa em código (acidentes, '
             || 'maternidade), e o resto não tem efeito definido em lugar nenhum. Correção: '
             || 'tabela de tipos com efeito (interrupção/suspensão), efeito no FGTS/tempo, '
             || 'código da Tabela 18 e vigência — a matriz por cliente é [VAL] (seção 30).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Parametrização presente (tabelas: %s; código: %s).',
                       coalesce(v_param, '—'), coalesce(v_cod, '—'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- AFAST-011 — sobreposição de períodos
CREATE OR REPLACE FUNCTION public.qa_caso_afast_011()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_cpf text := public.qa_cpf(9111); v_aceitou boolean := false;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao := 'Registrar dois afastamentos ATIVOS sobrepostos para o mesmo colaborador';
  r.esperado := 'O segundo é recusado — sobreposição é prorrogação ou é erro, nunca registro paralelo';
  INSERT INTO public.afastamentos
    (tenant_id, colaborador_nome, colaborador_cpf, data_inicio, data_fim, status)
  VALUES (v_t, '[QA-AFAST-011] Sobreposto', v_cpf, CURRENT_DATE - 20, CURRENT_DATE + 10, 'ativo');
  BEGIN
    INSERT INTO public.afastamentos
      (tenant_id, colaborador_nome, colaborador_cpf, data_inicio, data_fim, status)
    VALUES (v_t, '[QA-AFAST-011] Sobreposto', v_cpf, CURRENT_DATE - 5, CURRENT_DATE + 20, 'ativo');
    v_aceitou := true;
  EXCEPTION WHEN check_violation OR raise_exception OR exclusion_violation THEN
    v_aceitou := false; END;

  IF v_aceitou THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o banco aceitou dois afastamentos ATIVOS sobrepostos do mesmo CPF — '
             || 'não há constraint de exclusão nem validação de período. Com dois registros '
             || 'vigentes, o Ponto não sabe qual regra aplicar, a folha pode suspender duas '
             || 'vezes (ou nenhuma) e o eSocial recebe S-2230 conflitantes do mesmo vínculo. '
             || 'A inteligência até ACUMULA dias por CID, mas não impede o paralelismo. '
             || 'Correção: EXCLUDE USING gist (colaborador × daterange) para status ativos, '
             || 'com a prorrogação como caminho explícito (UPDATE do fim, com trilha).';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'A sobreposição foi recusada na gravação.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- AFAST-020 — 15 dias empresa / 16º INSS
CREATE OR REPLACE FUNCTION public.qa_caso_afast_020()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_id uuid; v_pend int; v_status text;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao := 'Registrar doença comum de 20 dias e conferir o que a inteligência produz';
  r.esperado := 'Pendência de INSS/S-2230 criada E status virado para aguardando_inss (Lei 8.213, art. 60)';
  v_id := public.qa_afast_tipado('[QA-AFAST-020] Doenca 20d', 9120,
                                 CURRENT_DATE - 20, CURRENT_DATE, 'doenca_comum');
  SELECT count(*) INTO v_pend FROM public.afastamentos_pendencias
  WHERE afastamento_id = v_id AND tipo_pendencia IN ('inss', 's2230');
  SELECT status_geral_new::text INTO v_status FROM public.afastamentos WHERE id = v_id;

  IF v_pend > 0 AND v_status = 'aguardando_inss' THEN
    r.situacao := 'passou';
    r.obtido := format('Regra viva: %s pendência(s) criada(s) e status %s.', v_pend, v_status);
  ELSIF v_pend > 0 THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO (regressão parcial na reescrita de 24/07): as PENDÊNCIAS dos '
             || '15 dias nasceram (%s: avaliar INSS + S-2230), mas o afastamento NÃO virou '
             || 'para aguardando_inss — ficou "%s". A versão de 23/07 fazia a virada no '
             || 'próprio registro (era o que habilitava o bloco de benefício INSS na tela); '
             || 'a reescrita de 24/07 moveu a inteligência para gatilho AFTER, que não '
             || 'altera a própria linha, e a virada se perdeu. Sem ela, o DP depende de ler '
             || 'a pendência — e a tela que filtra por status não mostra o caso. Correção: '
             || 'devolver a mudança de status ao gatilho BEFORE (afastamento_campos_before).',
             v_pend, coalesce(v_status, 'NULL'));
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('ACHADO (regressão da reescrita de 24/07): doença ÚNICA de 20 dias '
             || 'entrou sem pendência de INSS/S-2230 e com status "%s". A versão de 23/07 '
             || 'disparava a regra para afastamento único > 15 dias mesmo sem CID e virava '
             || 'o status para aguardando_inss; a versão viva só dispara pela ACUMULAÇÃO '
             || '(exige CID em afastamentos_saude + colaborador vinculado — que o '
             || 'formulário de atestado nem sempre preenche) e não muda status nenhum. '
             || 'Resultado: o caso mais comum — um atestado longo — passa em silêncio, a '
             || 'folha paga dias do INSS e o S-2230 do 16º dia perde o prazo. Correção: '
             || 'restaurar o ramo do afastamento único (basta dias_totais > 15) e a virada '
             || 'de status no gatilho BEFORE.',
             coalesce(v_status, 'NULL'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- AFAST-021 — recaída da mesma doença em 60 dias
CREATE OR REPLACE FUNCTION public.qa_caso_afast_021()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_acum text; v_prazo text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a acumulação por CID em 60 dias existe e produz o efeito completo?';
  r.esperado := 'Recaída soma os dias (sem novos 15 da empresa) e o S-2230 sai no 1º dia';
  SELECT left(p.prosrc, 1) INTO v_acum
  FROM pg_proc p WHERE p.proname = 'processar_inteligencia_afastamento'
    AND p.prosrc ILIKE '%60%' AND p.prosrc ILIKE '%cid%';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_prazo
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%recaida%' AND p.prosrc ILIKE '%prazo%';

  IF v_acum IS NOT NULL AND v_prazo IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO (metade boa, metade ausente): a ACUMULAÇÃO existe — a inteligência '
             || 'soma os dias de afastamentos com o mesmo CID em 60 dias e dispara a '
             || 'pendência de INSS quando o acumulado passa de 15 (a empresa não paga novos '
             || '15 dias, correto) — mas ela depende de o formulário preencher CID e '
             || 'colaborador vinculado, e a RECAÍDA não muda o PRAZO do S-2230: na recaída '
             || 'o evento vai no 1º DIA, não no 16º nem no dia 15 do mês seguinte, e '
             || 'nenhuma função trata esse relógio. Recaída identificada com prazo errado '
             || 'ainda é multa. Correção: prazo diferenciado na pendência de S-2230 quando '
             || 'a origem é acumulação por CID + garantir CID/vínculo obrigatórios no '
             || 'fluxo de atestado. Regra exata da recaída é [VAL] (seção 30).';
  ELSIF v_acum IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'A acumulação por CID em 60 dias não existe mais na inteligência do afastamento.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Acumulação viva e prazo de recaída tratado (%s).', v_prazo);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- AFAST-022 — o afastamento chega à folha
CREATE OR REPLACE FUNCTION public.qa_caso_afast_022()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o afastamento registrado vira lançamento de folha?';
  r.esperado := '15 dias pagos em rubrica própria; suspensão do 16º; origem rastreável — sem redigitação';
  -- exige que a função ESCREVA na folha — "afastamento + folha" solto pega as
  -- funções de exclusão de colaborador, que só CONTAM vínculos nas tabelas
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%afastamento%'
    AND (p.prosrc ILIKE '%INSERT INTO%folha_lancamentos%'
         OR p.prosrc ILIKE '%INSERT INTO%folha_itens%');

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o afastamento não chega à folha — nenhuma função gera lançamento a '
             || 'partir do afastamento registrado: os 15 dias pela empresa, a suspensão do '
             || '16º e a divisão da competência que atravessa a virada dependem de o DP '
             || 'REDIGITAR na folha o que o afastamento já sabe. É o primeiro elo do "erro '
             || 'em cadeia" que o documento descreve: registrado aqui, esquecido lá, a '
             || 'folha paga salário integral de quem está no INSS. Par do FOLHA-080 (visto '
             || 'do lado da folha). Correção: geração de lançamentos por competência a '
             || 'partir dos afastamentos vigentes, com origem rastreável e rubrica própria.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Reflexo na folha presente: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- AFAST-030 — CAT preparada até o 1º dia útil
CREATE OR REPLACE FUNCTION public.qa_caso_afast_030()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_id uuid; v_cat int; v_prazo text;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao := 'Registrar acidente típico e conferir a pendência de CAT e o prazo dela';
  r.esperado := 'Pendência de CAT criada com prazo no 1º dia útil seguinte (art. 22 da Lei 8.213)';
  v_id := public.qa_afast_tipado('[QA-AFAST-030] Acidente', 9130,
                                 CURRENT_DATE, CURRENT_DATE + 10, 'acidente_tipico');
  SELECT count(*) INTO v_cat FROM public.afastamentos_pendencias
  WHERE afastamento_id = v_id AND tipo_pendencia = 'cat';
  -- a COLUNA prazo existe; o que importa é se a inteligência a PREENCHE
  SELECT max(prazo)::text INTO v_prazo FROM public.afastamentos_pendencias
  WHERE afastamento_id = v_id AND tipo_pendencia = 'cat';

  IF v_cat > 0 AND v_prazo IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO (metade boa, metade sem relógio): o acidente DISPAROU a pendência de '
             || 'CAT (marcadores cat_obrigatoria/cat_pendente e pendências de CAT e S-2210 — '
             || 'a inteligência funciona), mas o PRAZO ficou vazio: a coluna '
             || 'afastamentos_pendencias.prazo existe e a inteligência não a preenche — o '
             || '"1º dia útil seguinte", o prazo mais curto do DP, vira prioridade textual '
             || 'sem relógio. Acidente na sexta dá CAT até segunda; sem o cálculo pelo '
             || 'calendário (tabela feriados), ninguém escala o alerta a tempo e a multa do '
             || 'art. 22 chega junto com a fiscalização. Correção: preencher prazo = 1º dia '
             || 'útil seguinte (imediato em óbito) na criação da pendência, com escalada '
             || 'crítica na aproximação.';
  ELSIF v_cat = 0 THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o acidente típico NÃO gerou pendência de CAT — a regra da '
             || 'inteligência não disparou. Conferir o gatilho.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('CAT disparada com prazo controlado (%s).', v_prazo);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- AFAST-031 — estabilidade acidentária de 12 meses
CREATE OR REPLACE FUNCTION public.qa_caso_afast_031()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_id uuid; v_marc int; v_fim date;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao := 'Registrar acidente com data de retorno e conferir a estabilidade gravada';
  r.esperado := 'data_fim_estabilidade = retorno + 12 meses (art. 118) — o registro que a Rescisão lê';
  v_id := public.qa_afast_tipado('[QA-AFAST-031] Estabilidade', 9131,
                                 CURRENT_DATE - 40, CURRENT_DATE - 5, 'acidente_tipico');
  SELECT count(*) INTO v_marc FROM public.afastamentos_marcadores
  WHERE afastamento_id = v_id AND marcador = 'estabilidade_provisoria';
  SELECT data_fim_estabilidade INTO v_fim FROM public.afastamentos WHERE id = v_id;

  IF v_fim = (CURRENT_DATE - 5 + interval '12 months')::date THEN
    r.situacao := 'passou';
    r.obtido := format('Estabilidade gravada até %s (retorno + 12 meses); marcador: %s.',
                       v_fim, v_marc);
  ELSIF v_marc > 0 AND v_fim IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO (regressão na reescrita de 24/07): o MARCADOR de estabilidade nasceu, '
             || 'mas data_fim_estabilidade ficou NULA — a versão de 23/07 gravava retorno + '
             || '12 meses no próprio registro (era esse campo que o mapa de estabilidades e '
             || 'a Rescisão liam); o gatilho AFTER de 24/07 não altera a própria linha e a '
             || 'gravação se perdeu. Sem a data, a estabilidade existe como etiqueta sem '
             || 'vencimento: o DESL-071 bloqueia dispensa lendo este campo, e o falso '
             || 'negativo do DESL-077 volta por outra porta. Correção: gravar '
             || 'data_fim_estabilidade no gatilho BEFORE (afastamento_campos_before), '
             || 'com expiração conferível.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('ACHADO (regressão da reescrita de 24/07): o acidente encerrado não '
             || 'criou estabilidade NENHUMA (marcador: %s; data_fim_estabilidade: %s). Duas '
             || 'perdas na mesma reescrita: a Regra 9 da inteligência trocou a lista de '
             || 'tipos — acidente_tipico/trajeto e doenca_ocupacional SAÍRAM (ficaram só '
             || 'b91, maternidade e sindical), justamente os casos do art. 118 — e a '
             || 'gravação de data_fim_estabilidade (retorno + 12 meses, versão de 23/07) '
             || 'desapareceu: a coluna ficou órfã. O DESL-071 bloqueia dispensa lendo esse '
             || 'campo; vazio, o falso negativo do DESL-077 volta por outra porta. '
             || 'Correção: devolver os tipos acidentários à Regra 9 e gravar '
             || 'data_fim_estabilidade no gatilho BEFORE (AFTER não altera a própria linha).',
             v_marc, coalesce(v_fim::text, 'NULL'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- AFAST-032 — FGTS por tipo de afastamento
CREATE OR REPLACE FUNCTION public.qa_caso_afast_032()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o efeito do afastamento no FGTS existe em algum lugar?';
  r.esperado := 'Acidente e serviço militar mantêm o depósito (art. 15, §5º); demais suspendem';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_est
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%afastamento%' AND p.prosrc ILIKE '%fgts%';

  IF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o FGTS do afastado não é tratado em lugar nenhum — nenhuma função '
             || 'cruza afastamento com FGTS. A regra tem dois lados que erram em direções '
             || 'opostas: no acidente de trabalho (e serviço militar) o depósito de 8% '
             || 'CONTINUA o afastamento inteiro (art. 15, §5º — não depositar é dívida que '
             || 'o FGTS Digital denuncia); na doença comum a partir do 16º e na licença '
             || 'sem remuneração, SUSPENDE (depositar é custo indevido). O efeito por tipo '
             || 'pertence à matriz do AFAST-010 e ao reflexo na folha do AFAST-022 — este '
             || 'caso garante que o FGTS não fique de fora dela. Efeitos exatos por tipo '
             || 'são [VAL] (seção 30).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Efeito no FGTS tratado por: %s.', v_est);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- AFAST-040 — maternidade/paternidade e Empresa Cidadã
CREATE OR REPLACE FUNCTION public.qa_caso_afast_040()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_adesao text; v_gest text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): os prazos da licença e a estabilidade gestante têm estrutura?';
  r.esperado := '120 (+60 Empresa Cidadã) / 5 (+15) dias parametrizados pela adesão; estabilidade gestante com vencimento';
  v_adesao := coalesce(public.qa_col_existe('empresa_cadastro', '%cidada%'),
                       public.qa_col_existe(NULL, '%empresa_cidada%'));
  v_gest := coalesce(public.qa_fns_com('%gestante%'),
                     public.qa_col_existe(NULL, '%estabilidade_gestante%'));

  IF v_adesao IS NULL AND v_gest IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a maternidade existe só como TIPO — licenca_maternidade está no '
             || 'enum e ganha marcador de estabilidade provisória, mas: (1) a adesão ao '
             || 'Empresa Cidadã não é cadastrada em lugar nenhum, então o sistema não sabe '
             || 'se a licença é de 120 ou 180 dias (nem 5 ou 20 na paternidade); (2) a '
             || 'estabilidade GESTANTE (confirmação da gravidez até 5 meses pós-parto — '
             || 'ADCT art. 10) não tem estrutura própria: o vencimento dela não é "fim da '
             || 'licença + 12 meses" como no acidente, é "parto + 5 meses", e nenhum campo '
             || 'ou função a calcula. A Rescisão bloqueia gestante (DESL-070) lendo o quê? '
             || 'Correção: adesão ao programa no cadastro da empresa (com vigência) + '
             || 'estabilidade tipada com regra de vencimento própria por espécie.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Estrutura presente (adesão: %s; gestante: %s).',
                       coalesce(v_adesao, '—'), coalesce(v_gest, '—'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- AFAST-050 — hipóteses e prazos do art. 473
CREATE OR REPLACE FUNCTION public.qa_caso_afast_050()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_param text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): as hipóteses do art. 473 existem com seus prazos?';
  r.esperado := 'Catálogo por hipótese (falecimento 2d, casamento 3d, doação de sangue 1/ano...) com limite conferido';
  SELECT string_agg(table_name, ', ') INTO v_param
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND (table_name ILIKE '%falta%justificada%' OR table_name ILIKE '%473%'
         OR table_name ILIKE '%hipotese%');

  IF v_param IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o art. 473 inteiro virou UM tipo genérico — falta_justificada_legal '
             || '— sem as hipóteses nem os prazos de cada uma: 2 dias por falecimento, 3 '
             || 'por casamento, 1 por ano para doar sangue, juízo pelo tempo necessário, '
             || 'pré-natal... Sem o catálogo, ninguém confere o LIMITE (4 dias de '
             || '"falecimento" passam como justificados quando 2 deveriam virar falta '
             || 'comum) nem o teto anual da doação de sangue. A decisão fica com o '
             || 'operador, caso a caso, sem trilha do enquadramento. Correção: catálogo de '
             || 'hipóteses (inciso, dias, frequência) parametrizável — CCTs ampliam '
             || 'hipóteses [RCC] — com o excedente tratado como falta comum e alertado.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Catálogo de hipóteses presente: %s.', v_param);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- AFAST-051 — suspensão disciplinar: teto de 30 dias
CREATE OR REPLACE FUNCTION public.qa_caso_afast_051()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_aceitou boolean := false; v_id uuid;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao := 'Registrar suspensão disciplinar de 45 dias corridos';
  r.esperado := 'Recusada — o art. 474 limita a 30 dias; acima disso a lei converte em rescisão injusta';
  BEGIN
    v_id := public.qa_afast_tipado('[QA-AFAST-051] Suspensao 45d', 9151,
                                   CURRENT_DATE, CURRENT_DATE + 44, 'suspensao_disciplinar');
    v_aceitou := true;
  EXCEPTION WHEN check_violation OR raise_exception THEN v_aceitou := false; END;

  IF v_aceitou THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a suspensão disciplinar de 45 dias entrou sem resistência — nenhuma '
             || 'validação compara a duração com o teto do art. 474 quando o tipo é '
             || 'suspensao_disciplinar. O 31º dia não é "punição longa": é rescisão injusta '
             || 'por força de lei — o empregado pode se considerar dispensado com todas as '
             || 'verbas, e foi o próprio sistema que documentou a prova. Correção: validação '
             || 'tipo × duração na gravação (teto de 30 dias corridos), com alerta ao '
             || 'jurídico se alguém tentar.';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'A suspensão acima de 30 dias foi recusada.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- AFAST-060 — prazos do S-2230 por motivo/duração
CREATE OR REPLACE FUNCTION public.qa_caso_afast_060()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_pend text; v_prazo text; v_ger text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o S-2230 tem a tabela de prazos e a geração do evento?';
  r.esperado := 'Prazo por motivo/duração (dia 15; 16º dia; 1º dia na recaída; término) + evento gerado';
  SELECT left(p.prosrc, 1) INTO v_pend
  FROM pg_proc p WHERE p.proname = 'processar_inteligencia_afastamento'
    AND p.prosrc ILIKE '%s2230%';
  -- a coluna prazo existe; conta apenas se alguma função a PREENCHE
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_prazo
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%afastamentos_pendencias%' AND p.prosrc ILIKE '%prazo%';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_ger
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%S-2230%' AND p.prosrc ILIKE '%esocial_transmissoes%');

  IF v_pend IS NOT NULL AND (v_prazo IS NULL OR v_ger IS NULL) THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO (o lembrete existe, o relógio e o evento não): a inteligência cria a '
             || 'pendência de S-2230 na doença longa — mas (1) a pendência não tem '
             || 'data-limite, e o prazo do S-2230 é uma TABELA: dia 15 do mês seguinte na '
             || 'regra geral, 16º DIA do afastamento na doença > 15 dias, 1º dia na '
             || 'recaída, dia 15 seguinte no término — cada motivo com seu relógio; e (2) '
             || 'nenhuma função GERA o evento para esocial_transmissoes — o afastamento '
             || 'não existe para o governo, mesmo vazio dos S-1200/S-2299 (FOLHA-060, '
             || 'DESL-091). Correção: data-limite por motivo/duração na pendência + '
             || 'geração do S-2230 (afastamento e término) na fila com anti-duplicidade '
             || '(série ADM-093..DESL-094). Prazos vigentes são [VAL].';
  ELSIF v_pend IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'A pendência de S-2230 sumiu da inteligência do afastamento.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Prazos e geração presentes (prazo: %s; geração: %s).',
                       coalesce(v_prazo, '—'), coalesce(v_ger, '—'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- AFAST-070 — retorno de afastamento longo exige ASO
CREATE OR REPLACE FUNCTION public.qa_caso_afast_070()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_id uuid; v_pend int; v_encerrou boolean := false;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao := 'Registrar afastamento de 45 dias e conferir a exigência de ASO de retorno';
  r.esperado := 'Pendência de ASO criada e o encerramento condicionado ao exame (NR-7)';
  v_id := public.qa_afast_tipado('[QA-AFAST-070] Longo 45d', 9170,
                                 CURRENT_DATE - 45, CURRENT_DATE, 'doenca_comum');
  SELECT count(*) INTO v_pend FROM public.afastamentos_pendencias
  WHERE afastamento_id = v_id AND tipo_pendencia = 'aso_retorno';

  r.passo_ordem := 2;
  r.passo_acao := 'Encerrar o afastamento SEM registrar o ASO de retorno';
  r.esperado := 'Retido — retorno de afastamento ≥ 30 dias só se completa com o exame';
  BEGIN
    UPDATE public.afastamentos SET status = 'encerrado' WHERE id = v_id;
    v_encerrou := true;
  EXCEPTION WHEN check_violation OR raise_exception THEN v_encerrou := false; END;

  IF v_pend > 0 AND v_encerrou THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO (a pendência existe, a trava não): o afastamento de 45 dias GEROU a '
             || 'pendência de ASO de retorno (a inteligência acertou — NR-7 exige o exame '
             || 'antes da retomada em afastamento ≥ 30 dias), mas o ENCERRAMENTO passou '
             || 'direto com a pendência aberta: nada condiciona o fim do afastamento ao '
             || 'exame. Encerrado, o Ponto volta a cobrar marcação e a pessoa volta ao '
             || 'posto sem o crivo médico — exatamente o que a norma quis impedir (e um '
             || 'risco real se o afastamento foi psiquiátrico ou acidentário). Correção: '
             || 'encerramento retido enquanto houver pendência de aso_retorno aberta, com '
             || 'exceção justificada em trilha (alta administrativa) para não travar '
             || 'operação legítima.';
  ELSIF v_pend = 0 THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o afastamento de 45 dias NÃO gerou pendência de ASO de retorno — '
             || 'a regra dos 30 dias da inteligência não disparou. Conferir o gatilho.';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'Pendência criada e encerramento retido até o ASO.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- AFAST-080 — sigilo do CID: restrição + log de acesso
CREATE OR REPLACE FUNCTION public.qa_caso_afast_080()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_atest int; v_saude int; v_log text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o CID está restrito e o acesso a ele é logado?';
  r.esperado := 'Camada de perfil sobre atestados/afastamentos_saude + log específico de acesso ao CID';
  SELECT count(*) INTO v_atest FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'atestados'
    AND policyname ILIKE 'perfil_restringe%';
  SELECT count(*) INTO v_saude FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'afastamentos_saude'
    AND policyname ILIKE 'perfil_restringe%';
  -- "cid" solto casa com "cidade" (gerar_estrutura_padrao_pastas) — exige a
  -- coluna clínica de verdade no corpo da função
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_log
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%cid_principal%' OR p.prosrc ILIKE '%cid_codigo%')
    AND (p.prosrc ILIKE '%log%' OR p.prosrc ILIKE '%acesso%' OR p.prosrc ILIKE '%audit%');

  IF v_atest > 0 AND v_saude > 0 AND v_log IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO (a porta tem tranca, mas ninguém anota quem entrou): as DUAS '
             || 'tabelas com CID estão na camada de perfil (atestados: %s política(s); '
             || 'afastamentos_saude: %s) — a restrição de leitura existe e é das melhores '
             || 'do sistema. O que falta é o LOG ESPECÍFICO de acesso ao CID que o '
             || 'documento exige (seção 22: "log de acesso específico ao CID"; seção 29: '
             || '"cofre do CID"): nenhuma função registra QUEM consultou o diagnóstico de '
             || 'QUEM e quando. Para dado sensível do art. 11 da LGPD, a trilha de acesso '
             || 'é parte da conformidade — numa investigação de vazamento, hoje não há o '
             || 'que consultar. Correção: leitura do CID via função SECURITY DEFINER que '
             || 'registra o acesso (leitor, titular, registro, hora) em tabela append-only.',
             v_atest, v_saude);
  ELSIF v_atest = 0 OR v_saude = 0 THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO GRAVE: tabela com CID fora da camada de perfil (atestados: %s; '
             || 'afastamentos_saude: %s políticas) — diagnóstico legível além do SST.',
             v_atest, v_saude);
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Restrição e log presentes (log: %s).', v_log);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- Registro no motor
INSERT INTO public.qa_implementacoes (codigo, funcao_sql, ativo) VALUES
  ('AFAST-010','qa_caso_afast_010',true), ('AFAST-011','qa_caso_afast_011',true),
  ('AFAST-020','qa_caso_afast_020',true), ('AFAST-021','qa_caso_afast_021',true),
  ('AFAST-022','qa_caso_afast_022',true), ('AFAST-030','qa_caso_afast_030',true),
  ('AFAST-031','qa_caso_afast_031',true), ('AFAST-032','qa_caso_afast_032',true),
  ('AFAST-040','qa_caso_afast_040',true), ('AFAST-050','qa_caso_afast_050',true),
  ('AFAST-051','qa_caso_afast_051',true), ('AFAST-060','qa_caso_afast_060',true),
  ('AFAST-070','qa_caso_afast_070',true), ('AFAST-080','qa_caso_afast_080',true)
ON CONFLICT (codigo) DO UPDATE SET funcao_sql = EXCLUDED.funcao_sql, ativo = true;
