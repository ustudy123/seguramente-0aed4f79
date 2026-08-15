-- ============================================================================
-- QA SST — rotinas dos casos da análise de requisitos YE-DP-SST-001
-- (SST-001..080, documentados em 20260815230000). Todos os 15 são de nível
-- 'api': o escopo é gestão documental e prazos, matéria de banco.
--
-- Padrão da casa: testa o que a NORMA e o documento exigem; divergência =
-- falha proposital com diagnóstico. Nenhuma funcionalidade é alterada.
-- ============================================================================

-- SST-001 — vigência viva dos documentos
CREATE OR REPLACE FUNCTION public.qa_caso_sst_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_status text; v_fns text;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao := 'Cadastrar PGR com vigência VENCIDA e conferir se o status reage';
  r.esperado := 'Documento vencido acusado (status/alerta) — nunca "vigente" com data no passado';
  INSERT INTO public.sst_documentos (tenant_id, tipo, data_emissao, data_vigencia, status)
  VALUES (v_t, 'PGR', CURRENT_DATE - 800, CURRENT_DATE - 30, 'vigente');
  SELECT s.status INTO v_status FROM public.sst_documentos s
  WHERE s.tenant_id = v_t AND s.tipo = 'PGR' AND s.data_vigencia = CURRENT_DATE - 30
  ORDER BY s.created_at DESC LIMIT 1;

  r.passo_ordem := 2;
  r.passo_acao := 'AUDITORIA: alguma rotina vigia data_vigencia (alerta de renovação / marcação de vencido)?';
  r.esperado := 'Janela de 60/30 dias avisando a renovação e vencimento acusado automaticamente';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%sst_documentos%'
    AND (p.prosrc ILIKE '%vigencia%' OR p.prosrc ILIKE '%vencid%');

  IF v_status = 'vigente' AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a vigência é decorativa — o PGR entrou com validade 30 dias no '
             || 'PASSADO e ficou "vigente": nenhum gatilho compara data_vigencia com o '
             || 'calendário, nenhuma rotina (pg_cron, como as demais do projeto) marca o '
             || 'vencido nem dispara a janela de renovação de 60/30 dias. O status só muda '
             || 'se alguém lembrar de editar — e o problema que o módulo existe para '
             || 'resolver ("documento vencido descoberto pela fiscalização") continua '
             || 'inteiro. Correção: rotina diária que marca vencido e alerta a renovação, '
             || 'com ação no Plano de Ação; nova versão preserva a anterior como '
             || '"substituido" (o status já prevê).';
  ELSIF v_status IS DISTINCT FROM 'vigente' THEN
    r.situacao := 'passou';
    r.obtido := format('Vencimento reagiu na gravação (status: %s).', coalesce(v_status, 'NULL'));
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Vigência vigiada por: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- SST-002 — extração rastreável com revisão humana
CREATE OR REPLACE FUNCTION public.qa_caso_sst_002()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_ia text; v_rev text; v_tab text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): os dados extraídos têm fonte, confiança e estado de revisão?';
  r.esperado := 'Dado extraído aponta o documento-fonte; baixa confiança exige revisão antes de produzir efeito';
  v_ia := public.qa_col_existe('sst_documentos', 'analise_ia');
  v_rev := coalesce(public.qa_col_existe('sst_documentos', '%revis%'),
                    public.qa_col_existe('sst_documentos', '%confianca%'));
  SELECT string_agg(table_name, ', ') INTO v_tab
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND (table_name ILIKE '%sst%extra%' OR table_name ILIKE '%sst%risco%'
         OR table_name ILIKE '%pgr%risco%');

  IF v_ia IS NOT NULL AND v_rev IS NULL AND v_tab IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO (o cofre existe, o inventário não): sst_documentos guarda o resultado '
             || 'da IA num JSONB solto (analise_ia) — sem nível de confiança, sem estado de '
             || 'revisão (quem validou a extração?) e sem tabela estruturada de dados '
             || 'extraídos (riscos, exames, periodicidades, enquadramentos) ligados ao '
             || 'documento-fonte. Um blob JSON não vira OS, ficha de EPI, agenda de exame '
             || 'nem adicional: os efeitos do RF-009/RF-010 não têm de onde partir, e a '
             || 'exigência de revisão humana (RNF-003 — dado errado vira adicional errado '
             || 'na folha) não tem onde morar. Correção: tabela de extração (dado + tipo + '
             || 'documento_id + confiança + revisor) como camada entre a IA e os efeitos.';
  ELSIF v_ia IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'A coluna analise_ia não existe mais em sst_documentos.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Estrutura de extração presente (revisão: %s; tabelas: %s).',
                       coalesce(v_rev, '—'), coalesce(v_tab, '—'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- SST-003 — ações do PGR no Plano de Ação
CREATE OR REPLACE FUNCTION public.qa_caso_sst_003()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o plano de ação do PGR vira tarefas no módulo Plano de Ação?';
  r.esperado := 'Medidas do PGR importado criadas como ações rastreáveis, vinculadas ao risco de origem';
  -- o módulo Plano de Ação vive nas tabelas plano_acoes/plano_tarefas —
  -- "acoes" solto casa com "informacoes"/"transacoes"
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%sst_documentos%'
    AND (p.prosrc ILIKE '%plano_acoes%' OR p.prosrc ILIKE '%plano_tarefas%');

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o "documento que vira ação" — a promessa central do módulo (seção '
             || '29) — não existe: nenhuma função converte as medidas do plano de ação do '
             || 'PGR em tarefas do módulo Plano de Ação. O PGR importado é arquivo parado: '
             || 'as medidas que ele propõe (com responsável e prazo, exigência da NR-1) não '
             || 'entram em fila nenhuma, e a fiscalização que pedir evidência de execução '
             || 'do plano recebe silêncio. O módulo Plano de Ação existe e tem família '
             || 'própria no motor — falta a ponte. Correção: na importação interpretada '
             || '(depende do SST-002), criar as ações com vínculo ao risco de origem, sem '
             || 'duplicar em reimportação.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Ponte PGR→Plano de Ação presente: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- SST-010 — OS por função com ciência
CREATE OR REPLACE FUNCTION public.qa_caso_sst_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_os text; v_risco text; v_ger text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a OS nasce dos riscos da função e cobra ciência?';
  r.esperado := 'OS gerada por função a partir do PGR, com assinatura/ciência rastreada e pendência para os novos';
  v_os := CASE WHEN to_regclass('public.ordens_servico') IS NOT NULL THEN 'ordens_servico' END;
  v_risco := coalesce(public.qa_col_existe('ordens_servico', '%risco%'),
                      public.qa_col_existe('ordens_servico', '%funcao%'),
                      public.qa_col_existe('ordens_servico', '%cargo%'));
  -- geração de verdade escreve na tabela; marcar_os_desatualizadas_apos_pgr
  -- só INVALIDA as OS quando chega PGR novo (meio caminho — bom, mas não gera)
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_ger
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%INSERT INTO%ordens_servico%'
    AND (p.prosrc ILIKE '%risco%' OR p.prosrc ILIKE '%pgr%' OR p.prosrc ILIKE '%sst_documentos%');

  IF v_os IS NOT NULL AND v_ger IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO (metade boa, metade manual): a infraestrutura de OS EXISTE — '
             || 'ordens_servico com links de assinatura (ordem_servico_links, com token e '
             || 'expiração, o mesmo desenho da experiência) — mas a OS é redigida à MÃO: '
             || 'nenhuma função a gera dos riscos da função extraídos do PGR (campos de '
             || 'vínculo: %s). A NR-1 (1.4.1) exige informar riscos e medidas por função; '
             || 'com a OS manual, função nova ou risco novo no PGR não regeram nada, e o '
             || 'colaborador admitido pode começar sem ciência assinada. O meio caminho já '
             || 'existe: marcar_os_desatualizadas_apos_pgr INVALIDA as OS quando chega PGR '
             || 'novo — falta a outra metade, gerar as novas. Correção: geração da OS por '
             || 'função a partir da extração (SST-002), com pendência de ciência para '
             || 'admitidos e mudanças de função.',
             coalesce(v_risco, 'nenhum'));
  ELSIF v_os IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'A tabela ordens_servico não existe mais nesta base.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('OS gerada dos riscos por: %s.', v_ger);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- SST-011 — ficha de EPI: CA vigente na entrega
CREATE OR REPLACE FUNCTION public.qa_caso_sst_011()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_ca text; v_trava text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a entrega de EPI confere o CA vigente?';
  r.esperado := 'Entrega bloqueada com CA vencido; ficha com assinatura e treinamento evidenciado';
  v_ca := coalesce(public.qa_col_existe('epi_tipos', 'ca_validade'),
                   public.qa_col_existe('epis', '%validade%'));
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_trava
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%epi_entregas%'
    AND (p.prosrc ILIKE '%ca_validade%' OR p.prosrc ILIKE '%validade%');
  IF v_trava IS NULL THEN
    SELECT string_agg(DISTINCT t.tgname, ', ') INTO v_trava
    FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid = 'public.epi_entregas'::regclass AND NOT t.tgisinternal
      AND t.tgname NOT ILIKE '%updated_at%' AND t.tgname NOT ILIKE 'qa\_%'
      AND p.prosrc ILIKE '%validade%';
  END IF;

  IF v_ca IS NOT NULL AND v_trava IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO (o dado existe, a trava não): o CA tem validade cadastrada '
             || '(%s — o subsistema de EPI é dos mais completos: tipos, CETs, entregas, '
             || 'estoque, e o EPI-001 já protege a baixa de estoque), mas NADA confere o CA '
             || 'na hora da ENTREGA: nenhum gatilho ou função compara ca_validade com a '
             || 'data — EPI de CA vencido sai do estoque e vira ficha normalmente. Pela '
             || 'NR-6, entrega com CA vencido equivale juridicamente a não ter entregue: '
             || 'no acidente, a empresa responde como se o colaborador estivesse '
             || 'desprotegido. E a neutralização da insalubridade que o EPI sustenta '
             || '(SST-050) cai junto. Correção: trava de CA vigente na entrega + alerta de '
             || 'CA a vencer com reposição antecipada (janela da seção 14).',
             v_ca);
  ELSIF v_ca IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'A validade do CA não existe mais no cadastro de EPI.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('CA conferido na entrega por: %s.', v_trava);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- SST-020 — periódico agendado pela periodicidade
CREATE OR REPLACE FUNCTION public.qa_caso_sst_020()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_param text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): alguém calcula e vigia a próxima data do exame periódico?';
  r.esperado := 'Próximo exame derivado da periodicidade do risco; alertas 30/15/7; vencido acusado';
  v_param := public.qa_col_existe(NULL, 'periodicidade_exame_meses');
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%periodicidade_exame%' OR p.prosrc ILIKE '%proximo_exame%'
         OR (p.prosrc ILIKE '%periodico%' AND p.prosrc ILIKE '%exame%'));

  IF v_param IS NOT NULL AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO (o parâmetro existe, o relógio não): a periodicidade está '
             || 'cadastrada (%s) e NINGUÉM a usa — nenhuma função calcula a próxima data do '
             || 'periódico a partir do último ASO, nenhuma rotina vigia vencimentos com a '
             || 'janela 30/15/7 da seção 14. O contraste incomoda: o exame DEMISSIONAL tem '
             || 'motor dedicado (exame_demissional_pendencias, DESL-060..067), enquanto o '
             || 'PERIÓDICO — que acontece dezenas de vezes mais — depende de planilha '
             || 'externa. ASO vencido de quem segue trabalhando é a autuação mais fácil da '
             || 'fiscalização. Correção: próxima data derivada de último ASO + '
             || 'periodicidade do risco, com rotina de alertas e painel de vencidos.',
             v_param);
  ELSIF v_param IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'O parâmetro periodicidade_exame_meses não existe mais.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Agenda do periódico viva: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- SST-021 — ASO de mudança de risco
CREATE OR REPLACE FUNCTION public.qa_caso_sst_021()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): mudança de função/risco exige ASO antes de efetivar?';
  r.esperado := 'Troca para função de risco diferente retida até o ASO de mudança; OS/ficha regeradas';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%mudanca%risco%' OR p.prosrc ILIKE '%mudanca%funcao%'
         OR (p.prosrc ILIKE '%exame%' AND p.prosrc ILIKE '%cargo%'));

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o ASO de mudança de risco não existe — dos cinco eventos de exame '
             || 'da NR-7, quatro têm dono (admissional ADM-060.., periódico SST-020, '
             || 'retorno AFAST-070, demissional DESL-060..) e a MUDANÇA é o único sem '
             || 'nenhuma estrutura: trocar um colaborador de função administrativa para '
             || 'função exposta não exige exame, não regera OS nem ficha de EPI e não '
             || 'revisa o adicional. A transferência silenciosa deixa a pessoa num risco '
             || 'que nenhum médico avaliou — e o exame DEPOIS da mudança não conserta: a '
             || 'NR-7 o exige ANTES. Correção: troca de cargo/função com risco diferente '
             || 'retida até ASO de mudança apto, disparando a regeração da OS/ficha '
             || '(SST-010/011) e a revisão do adicional (SST-050).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Mudança de risco tratada por: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- SST-030 — S-2220 até o dia 15
CREATE OR REPLACE FUNCTION public.qa_caso_sst_030()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_tela text; v_prazo text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o S-2220 tem relógio — ASO registrado projeta o dia 15?';
  r.esperado := 'Data-limite (dia 15 do mês seguinte ao ASO) projetada, vigiada e atraso acusado';
  SELECT string_agg(DISTINCT tipo_evento, ', ') INTO v_tela
  FROM (SELECT DISTINCT tipo_evento FROM public.esocial_transmissoes
        WHERE tipo_evento ILIKE '%2220%' LIMIT 3) s;
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_prazo
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%2220%' AND p.prosrc ILIKE '%prazo%');

  IF v_prazo IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o S-2220 não tem relógio — a fila de transmissão aceita o evento '
             || 'quando a TELA o monta, mas nenhuma função projeta a data-limite (dia 15 '
             || 'do mês seguinte à emissão do ASO), nenhum alerta corre até lá e a '
             || 'transmissão tardia entra como regular. Cada ASO emitido e não transmitido '
             || 'é multa acumulando por competência em silêncio — e como o ASO vive em '
             || 'campos da admissão e em eventos de saúde, sem gatilho ninguém nem sabe '
             || 'QUAIS ASOs ainda devem evento. Correção: registro do ASO dispara a '
             || 'preparação do S-2220 com data-limite; pendências e atrasos visíveis '
             || '(mesmo desenho pedido para o S-2230 no AFAST-060 e o S-1299 no '
             || 'FOLHA-060 — um motor de prazos do eSocial serve aos três).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Prazo do S-2220 controlado por: %s (eventos na fila: %s).',
                       v_prazo, coalesce(v_tela, 'nenhum'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- SST-031 — S-2240 acompanha a exposição
CREATE OR REPLACE FUNCTION public.qa_caso_sst_031()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_hist text; v_ger text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a exposição a agentes tem histórico e gera S-2240?';
  r.esperado := 'Exposição por colaborador (agente, período, EPI) registrada; S-2240 na admissão e a cada alteração';
  SELECT string_agg(table_name, ', ') INTO v_hist
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND (table_name ILIKE '%exposicao%' OR table_name ILIKE '%agente%nocivo%'
         OR table_name ILIKE '%ltcat%');
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_ger
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%2240%';

  IF v_hist IS NULL AND v_ger IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a exposição a agentes nocivos não tem registro estruturado — o '
             || 'LTCAT entra em sst_documentos como arquivo, mas nenhuma tabela guarda '
             || 'QUEM está exposto a QUAL agente desde QUANDO (com o EPI que atenua), e '
             || 'nenhuma função gera o S-2240 na admissão ou na mudança de exposição. O '
             || 'S-2240 é a matéria-prima do PPP eletrônico: cada mês sem o registro é um '
             || 'mês de aposentadoria especial que ninguém vai conseguir reconstituir '
             || 'quando o INSS pedir — o furo só aparece anos depois, sem conserto. '
             || 'Correção: histórico de exposição por colaborador (extraído do LTCAT — '
             || 'depende do SST-002) + geração do S-2240 com prazo dia 15, alimentando o '
             || 'PPP (SST-060).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Exposição estruturada (tabelas: %s; geração: %s).',
                       coalesce(v_hist, '—'), coalesce(v_ger, '—'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- SST-040 — CIPA: dimensionamento, mandato e atas
CREATE OR REPLACE FUNCTION public.qa_caso_sst_040()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_tab text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a CIPA existe no sistema?';
  r.esperado := 'Dimensionamento pelo Quadro I, mandato controlado e atas arquivadas';
  -- palavra inteira: "parti[cipa]coes" contém "cipa" e engana o LIKE
  SELECT string_agg(table_name, ', ') INTO v_tab
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name ~* '(^|_)cipa(_|$)';

  DECLARE v_dim text; v_atas text;
  BEGIN
    SELECT string_agg(DISTINCT p.proname, ', ') INTO v_dim
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
      AND p.prosrc ILIKE '%cipa%'
      AND (p.prosrc ILIKE '%dimension%' OR p.prosrc ILIKE '%quadro%');
    SELECT string_agg(table_name, ', ') INTO v_atas
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name ~* '(^|_)cipa(_|$)' AND table_name ILIKE '%ata%';

    IF v_tab IS NOT NULL AND (v_dim IS NULL OR v_atas IS NULL) THEN
      r.situacao := 'falhou';
      r.obtido := format('ACHADO (a comissão existe, a régua e a prova não): cipa_composicao '
               || 'está de pé com representação, condição e MANDATO (início/fim) — a '
               || 'estrutura viva que o DESL-073 usa para a estabilidade do cipeiro — mas '
               || 'faltam as outras duas pernas da NR-5: o DIMENSIONAMENTO pelo Quadro I '
               || '(%s — efetivo × grupo do CNAE decide quantos titulares/suplentes, ou o '
               || 'designado; o efetivo e o CNAE o cadastro já tem) e as ATAS mensais '
               || 'arquivadas (%s), que são a prova de que a comissão funciona. Sem a '
               || 'régua, ninguém sabe se a composição cadastrada é a exigida; sem as '
               || 'atas, a CIPA existe só no cadastro. Correção: cálculo do Quadro I por '
               || 'estabelecimento + registro de reuniões/atas em Documentos + alerta de '
               || 'fim de mandato (eleição com 60 dias).',
               coalesce('há: ' || v_dim, 'nenhuma função'),
               coalesce('há: ' || v_atas, 'nenhuma tabela'));
    ELSIF v_tab IS NULL THEN
      r.situacao := 'falhou';
      r.obtido := 'A estrutura de CIPA não existe nesta base.';
    ELSE
      r.situacao := 'passou';
      r.obtido := format('CIPA completa (composição: %s; dimensionamento: %s; atas: %s).',
                         v_tab, v_dim, v_atas);
    END IF;
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- SST-041 — canal de denúncias de assédio
CREATE OR REPLACE FUNCTION public.qa_caso_sst_041()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_tab text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): existe canal formal de denúncias com sigilo?';
  r.esperado := 'Denúncia anônima com protocolo, acesso restrito ao fluxo de apuração e prazo vigiado';
  -- a ouvidoria é o canal real; marketplace_denuncias é reclamação de loja
  SELECT string_agg(table_name, ', ') INTO v_tab
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND (table_name ILIKE 'ouvidoria%' OR table_name ILIKE '%assedio%');

  IF v_tab IS NOT NULL THEN
    DECLARE v_anon text; v_restr int; v_prazo text;
    BEGIN
      v_anon := public.qa_col_existe('ouvidoria', 'anonimo');
      SELECT count(*) INTO v_restr FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'ouvidoria'
        AND policyname ILIKE 'perfil_restringe%';
      v_prazo := coalesce(public.qa_col_existe('ouvidoria', '%prazo%'),
                          public.qa_col_existe('ouvidoria', '%data_limite%'));
      IF v_anon IS NOT NULL AND (v_restr = 0 OR v_prazo IS NULL) THEN
        r.situacao := 'falhou';
        r.obtido := format('ACHADO (o canal existe, o sigilo e o prazo mancam): a ouvidoria '
                 || 'está de pé (%s) e aceita denúncia ANÔNIMA (coluna anonimo — o requisito '
                 || 'central da Lei 14.457 atendido), mas: (1) a tabela está FORA da camada '
                 || 'perfil_restringe_leitura_* (%s políticas) — quem tem acesso ao módulo lê '
                 || 'as denúncias, inclusive potencialmente o gestor da área denunciada, e '
                 || 'para canal de assédio o sigilo precisa ser mais duro que o do CID; e '
                 || '(2) não há prazo de apuração vigiado (%s) — a lei pede tratativa, não '
                 || 'caixa de entrada. Correção: política restritiva própria (fluxo de '
                 || 'apuração, não módulo) + log de tentativas de acesso + prazo de '
                 || 'tratativa com alerta.',
                 v_tab, v_restr, coalesce(v_prazo, 'nenhum campo'));
      ELSE
        r.situacao := 'passou';
        r.obtido := format('Canal com anonimato, restrição e prazo (%s).', v_tab);
      END IF;
    END;
  ELSE
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o canal de denúncias da Lei 14.457/2022 não existe — nenhuma '
             || 'tabela de ouvidoria ou assédio. A família PSICO cobre o outro braço da '
             || 'lei (avaliação de riscos psicossociais), mas o CANAL formal — denúncia '
             || 'anônima com protocolo, apuração com prazo e sigilo — não tem onde '
             || 'existir. Correção: registro anônimo com protocolo + fluxo de apuração '
             || 'restrito + log de tentativas de acesso + prazo de tratativa vigiado.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- SST-050 — laudo → adicional, com neutralização por EPI
CREATE OR REPLACE FUNCTION public.qa_caso_sst_050()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o enquadramento do laudo alimenta o adicional — e o EPI o neutraliza?';
  r.esperado := 'Laudo→função→adicional com fonte rastreável; neutralização viva (CA vencido religa)';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%insalubr%' OR p.prosrc ILIKE '%periculos%' OR p.prosrc ILIKE '%neutraliza%')
    AND (p.prosrc ILIKE '%laudo%' OR p.prosrc ILIKE '%sst_documentos%' OR p.prosrc ILIKE '%cargo%');

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o laudo e o adicional vivem em mundos separados — nenhuma função '
             || 'liga o enquadramento (que deveria sair do laudo importado) à função/'
             || 'colaborador que a Folha usa para calcular os 10/20/40% ou os 30% '
             || '(o motor de cálculo existe no React — adicionais.ts, FOLHA-021 — mas a '
             || 'ORIGEM do enquadramento é digitação). E a via de volta tampouco existe: '
             || 'EPI eficaz pode NEUTRALIZAR a insalubridade e cessar o adicional (CLT '
             || 'art. 191, [VAL]), com o vínculo vivo — CA vencido religa o adicional '
             || '(SST-011). Sem as duas pontes, ou se paga adicional que o EPI eliminou, '
             || 'ou se corta adicional sem laudo que sustente. Correção: enquadramento por '
             || 'função com laudo-fonte (depende do SST-002) + estado de neutralização '
             || 'amarrado à entrega e ao CA do EPI.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Ponte laudo→adicional presente: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- SST-060 — PPP do histórico de exposição
CREATE OR REPLACE FUNCTION public.qa_caso_sst_060()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o PPP tem estrutura para ser gerado?';
  r.esperado := 'PPP montado do histórico de exposição (LTCAT/S-2240), entregue no desligamento e sob demanda';
  v_est := coalesce((SELECT string_agg(table_name, ', ')
                     FROM information_schema.tables
                     WHERE table_schema = 'public' AND table_name ILIKE '%ppp%'),
                    public.qa_fns_com('%ppp%'));

  IF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o PPP não existe no sistema — nenhuma tabela ou função. O Perfil '
             || 'Profissiográfico é a biografia previdenciária da exposição: obrigatório '
             || 'na rescisão de quem trabalhou exposto e a base da aposentadoria especial '
             || '(Lei 8.213, arts. 57-58), hoje gerado eletronicamente a partir dos '
             || 'S-2240. A cadeia inteira está pendente: sem histórico de exposição '
             || '(SST-031) não há S-2240, e sem S-2240 não há PPP — e esse é o tipo de '
             || 'dívida que não se paga depois: exposição não registrada em 2026 é '
             || 'benefício negado em 2046. Correção: na ordem, SST-002 (extração) → '
             || 'SST-031 (exposição/S-2240) → geração do PPP no desligamento e sob '
             || 'demanda, anexado ao dossiê da rescisão (DESL-082).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Estrutura de PPP presente: %s.', v_est);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- SST-070 — coerência documental
CREATE OR REPLACE FUNCTION public.qa_caso_sst_070()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): alguém cruza PGR × PCMSO × LTCAT × S-2240?';
  r.esperado := 'Conferência de coerência apontando risco sem exame, agente sem inventário, exposição sem laudo';
  -- exige cruzamento de RISCOS — "PGR + PCMSO" soltos casam com a função que
  -- cria a árvore de pastas padrão (os nomes das pastas contêm as siglas)
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.proname NOT ILIKE '%pasta%'
    AND (p.prosrc ILIKE '%coerencia%'
         OR (p.prosrc ILIKE '%pgr%' AND p.prosrc ILIKE '%pcmso%' AND p.prosrc ILIKE '%risco%'));

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: os documentos não conversam — nenhuma função cruza o que o PGR '
             || 'inventariou com o que o PCMSO examina, o que o LTCAT mediu e o que o '
             || 'S-2240 declara. A NR-7 exige o PCMSO BASEADO no PGR; divergência entre '
             || 'eles (risco inventariado sem exame previsto, agente medido que o '
             || 'inventário não conhece) é a primeira coisa que a fiscalização procura, '
             || 'porque derruba a credibilidade do conjunto — e hoje cada documento é um '
             || 'PDF isolado em sst_documentos, sem base comum de riscos para comparar. '
             || 'Depende da extração estruturada (SST-002). [BPR] com fundamento nas NRs. '
             || 'Correção: conferência de coerência sobre a base extraída, com relatório '
             || 'de divergências arquivado como evidência.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Coerência conferida por: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- SST-080 — sigilo do dado clínico: restrição + log
CREATE OR REPLACE FUNCTION public.qa_caso_sst_080()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_ev int; v_at int; v_log text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o dado clínico está restrito e o acesso é logado?';
  r.esperado := 'Tabelas clínicas na camada de perfil; aptidão circula sem diagnóstico; log próprio de acesso';
  SELECT count(*) INTO v_ev FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'eventos_saude'
    AND policyname ILIKE 'perfil_restringe%';
  SELECT count(*) INTO v_at FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'atestados'
    AND policyname ILIKE 'perfil_restringe%';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_log
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%eventos_saude%' OR p.prosrc ILIKE '%cid_principal%')
    AND (p.prosrc ILIKE '%log%' OR p.prosrc ILIKE '%acesso%' OR p.prosrc ILIKE '%audit%');

  IF v_ev > 0 AND v_at > 0 AND v_log IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO (mesma tranca sem caderno do AFAST-080, agora no acervo '
             || 'clínico inteiro): eventos_saude (%s política(s)) e atestados (%s) estão '
             || 'na camada de perfil — a restrição de leitura existe e funciona — mas '
             || 'NENHUMA função registra o ACESSO ao dado clínico: quem abriu o exame de '
             || 'quem, quando. O documento pede log específico (seção 22) e o "cofre '
             || 'clínico" (seção 29) é isso: leitura por função que anota o leitor. A '
             || 'separação aptidão × diagnóstico até se sustenta hoje (o apto/inapto vive '
             || 'em campos administrativos da admissão, fora das tabelas clínicas), mas '
             || 'numa investigação de vazamento não há trilha para consultar. Correção: '
             || 'acesso ao clínico via função SECURITY DEFINER com registro append-only '
             || '(leitor, titular, registro, hora) — uma vez, servindo CID (AFAST-080) e '
             || 'exames.',
             v_ev, v_at);
  ELSIF v_ev = 0 OR v_at = 0 THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO GRAVE: tabela clínica fora da camada de perfil '
             || '(eventos_saude: %s; atestados: %s políticas).', v_ev, v_at);
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
  ('SST-001','qa_caso_sst_001',true), ('SST-002','qa_caso_sst_002',true),
  ('SST-003','qa_caso_sst_003',true), ('SST-010','qa_caso_sst_010',true),
  ('SST-011','qa_caso_sst_011',true), ('SST-020','qa_caso_sst_020',true),
  ('SST-021','qa_caso_sst_021',true), ('SST-030','qa_caso_sst_030',true),
  ('SST-031','qa_caso_sst_031',true), ('SST-040','qa_caso_sst_040',true),
  ('SST-041','qa_caso_sst_041',true), ('SST-050','qa_caso_sst_050',true),
  ('SST-060','qa_caso_sst_060',true), ('SST-070','qa_caso_sst_070',true),
  ('SST-080','qa_caso_sst_080',true)
ON CONFLICT (codigo) DO UPDATE SET funcao_sql = EXCLUDED.funcao_sql, ativo = true;
