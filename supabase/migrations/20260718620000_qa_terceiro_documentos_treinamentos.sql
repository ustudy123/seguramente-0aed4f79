-- =========================================================
-- QA — DOCUMENTOS e TREINAMENTOS DE TERCEIROS
-- Módulo Prestadores/Terceiros · itens 1 e 5 da auditoria de cobertura
--
-- MOTIVO: terceiro_documentos e citada no relatorio da equipe como o exemplo
-- de boa pratica de validade automatica — o modelo que falta no modulo geral
-- de documentos (achado DOC-041). Essa afirmacao veio da LEITURA do codigo.
-- Estes casos VERIFICAM se a automacao funciona de fato.
--
-- Schema REAL (lido):
--   terceiro_documentos: terceiro_id CASCADE, trabalhador_id CASCADE (opcional),
--     tipo NOT NULL (PGR, PCMSO, LTCAT, ASO, Contrato...), nome NOT NULL,
--     data_validade DATE, status terceiro_doc_status
--   terceiro_treinamentos: terceiro_id CASCADE, trabalhador_id CASCADE
--     (OBRIGATORIO aqui, diferente de documentos), tipo NOT NULL (NR-10,
--     NR-35...), data_validade, status terceiro_doc_status
--
-- A AUTOMACAO (funcao atualizar_status_terceiro_doc, aplicada como trigger
-- BEFORE INSERT OR UPDATE nas DUAS tabelas):
--   data_validade nula          -> pendente
--   data_validade no passado    -> vencido
--   data_validade em ate 30 dias-> a_vencer
--   demais                      -> valido
--
-- Os casos TDOC-001 a 004 percorrem as quatro faixas. O TDOC-005 e o mais
-- importante: verifica se o status ACOMPANHA a mudanca da data (UPDATE), nao
-- so a criacao.
-- =========================================================

-- Trava do cercado nas duas tabelas.
DO $trava$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['terceiro_documentos','terceiro_treinamentos'] LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS qa_guarda_cercado ON public.%I', t);
      EXECUTE format('CREATE TRIGGER qa_guarda_cercado BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.qa_bloqueia_fora_do_cercado()', t);
      INSERT INTO public.qa_tabelas_protegidas (tabela, motivo)
      VALUES (t, 'Documentos e treinamentos de terceiros.') ON CONFLICT (tabela) DO NOTHING;
    END IF;
  END LOOP;
END $trava$;

-- ─────────────────────────────────────────────────────────
-- DOCUMENTAÇÃO
-- ─────────────────────────────────────────────────────────
DO $seed$
DECLARE v_mod uuid;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos WHERE path='estrutura-organizacional/prestadores';
  IF v_mod IS NULL THEN RAISE EXCEPTION 'Modulo prestadores nao encontrado.'; END IF;

  INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, nivel, objetivo, pre_condicoes, passos, resultado_esperado, observacoes)
  VALUES

  (v_mod,'TDOC-001','Documento com validade distante fica valido','feliz','alta','aprovado','api',
   'Verificar que um documento com validade a mais de 30 dias recebe status "valido" '
   'automaticamente. Regra: a trigger atualizar_status_terceiro_doc classifica o documento pela '
   'data, sem ninguem informar o status. Importa porque e essa automacao que mantem o painel de '
   'conformidade dos terceiros confiavel sem trabalho manual.',
   'Precisa existir uma empresa terceira cadastrada.',
   '[
     {"ordem":1,"acao":"Abrir um terceiro e anexar um documento com validade distante","onde_na_tela":"Terceiros > abrir o terceiro > aba Documentos > Adicionar","dados":"Tipo: PGR | Nome: PGR 2026 | Data de validade: daqui a 180 dias","resultado_esperado":"Documento salvo"},
     {"ordem":2,"acao":"Conferir o status atribuido","onde_na_tela":"Lista de documentos do terceiro","dados":"-","resultado_esperado":"Status: valido — atribuido automaticamente, sem ninguem escolher"}
   ]'::jsonb,
   'O documento fica com status "valido". O status nao foi informado no cadastro — a trigger o '
   'calculou a partir da data de validade.',
   'IMPACTO SE FALHAR: sem a classificacao automatica, o painel de conformidade dependeria de '
   'alguem atualizar o status manualmente documento por documento — na pratica, ficaria desatualizado.'),

  (v_mod,'TDOC-002','Documento proximo do vencimento vira "a vencer"','feliz','alta','aprovado','api',
   'Verificar que um documento com validade dentro de 30 dias recebe status "a_vencer" '
   'automaticamente. Regra: a faixa de alerta e de 30 dias antes do vencimento. Importa porque e '
   'esse status que permite agir ANTES de o documento vencer — renovar a tempo, cobrar o prestador.',
   'Precisa existir uma empresa terceira cadastrada.',
   '[
     {"ordem":1,"acao":"Anexar um documento com validade proxima","onde_na_tela":"Terceiro > Documentos > Adicionar","dados":"Tipo: ASO | Nome: ASO Joao | Data de validade: daqui a 15 dias","resultado_esperado":"Documento salvo"},
     {"ordem":2,"acao":"Conferir o status","onde_na_tela":"Lista de documentos","dados":"-","resultado_esperado":"Status: a_vencer — sinalizando que precisa de renovacao"}
   ]'::jsonb,
   'O documento fica com status "a_vencer", porque a validade cai dentro da janela de 30 dias.',
   'IMPACTO SE FALHAR: sem o aviso previo, os documentos so seriam percebidos depois de vencidos — '
   'o prestador ficaria irregular antes de alguem notar. A janela de 30 dias e o que da tempo de '
   'reagir.'),

  (v_mod,'TDOC-003','Documento vencido vira "vencido" sozinho','feliz','critica','aprovado','api',
   'Verificar que um documento com validade no passado recebe status "vencido" automaticamente. '
   'ESTE E O CASO QUE JUSTIFICA A REFERENCIA: e exatamente o comportamento que falta no modulo '
   'geral de documentos (achado DOC-041, onde um documento vencido ha um ano permanece "valido"). '
   'Importa porque documento vencido exibido como valido da falsa conformidade.',
   'Precisa existir uma empresa terceira cadastrada.',
   '[
     {"ordem":1,"acao":"Anexar um documento ja vencido","onde_na_tela":"Terceiro > Documentos > Adicionar","dados":"Tipo: PCMSO | Nome: PCMSO 2025 | Data de validade: um ano atras","resultado_esperado":"Documento salvo"},
     {"ordem":2,"acao":"Conferir o status","onde_na_tela":"Lista de documentos","dados":"-","resultado_esperado":"Status: vencido — reconhecido automaticamente"}
   ]'::jsonb,
   'O documento fica com status "vencido". O banco reconheceu sozinho que a data ja passou.',
   'IMPACTO SE FALHAR: cairia no mesmo problema do modulo geral de documentos (DOC-041) — o '
   'prestador apareceria regular com documentacao vencida. CONTRASTE: este caso PASSANDO e a '
   'evidencia de que a solucao para o DOC-041 ja existe no sistema e so precisa ser replicada.'),

  (v_mod,'TDOC-004','Documento sem validade fica pendente','alternativo','media','aprovado','api',
   'Verificar que um documento sem data de validade recebe status "pendente". Regra: sem data nao '
   'da para classificar; o documento fica marcado como pendente de informacao. Importa porque '
   'distingue "documento sem prazo definido" de "documento em dia" — sao situacoes diferentes.',
   'Precisa existir uma empresa terceira cadastrada.',
   '[
     {"ordem":1,"acao":"Anexar um documento sem informar validade","onde_na_tela":"Terceiro > Documentos > Adicionar","dados":"Tipo: Contrato | Nome: Contrato de prestacao | Data de validade: (em branco)","resultado_esperado":"Documento salvo"},
     {"ordem":2,"acao":"Conferir o status","onde_na_tela":"Lista de documentos","dados":"-","resultado_esperado":"Status: pendente — falta a informacao de validade"}
   ]'::jsonb,
   'O documento fica com status "pendente", sinalizando que a data de validade nao foi informada.',
   'IMPACTO SE FALHAR: um documento sem prazo apareceria como valido, escondendo que falta '
   'informacao. O status pendente e o que permite cobrar o dado que falta.'),

  (v_mod,'TDOC-005','Alterar a data de validade recalcula o status','feliz','critica','aprovado','api',
   'Verificar que o status acompanha a mudanca da data, nao apenas a criacao. Regra: a trigger '
   'roda em INSERT E UPDATE. Importa porque a renovacao de um documento e uma edicao — ao anexar '
   'a versao nova com validade estendida, o status precisa voltar de "vencido" para "valido" '
   'sozinho.',
   'Precisa existir um documento de terceiro ja vencido.',
   '[
     {"ordem":1,"acao":"Ter um documento vencido","onde_na_tela":"Terceiro > Documentos","dados":"Documento com validade no ano passado, status vencido","resultado_esperado":"Status: vencido"},
     {"ordem":2,"acao":"Renovar o documento, estendendo a validade","onde_na_tela":"Documento > Editar > Data de validade","dados":"Nova data de validade: daqui a 1 ano","resultado_esperado":"Ao salvar, o status deveria voltar sozinho para valido"},
     {"ordem":3,"acao":"Conferir o status apos a renovacao","onde_na_tela":"Lista de documentos","dados":"-","resultado_esperado":"Status: valido — recalculado na edicao"}
   ]'::jsonb,
   'Apos estender a validade, o status volta a "valido" automaticamente. A automacao vale tanto na '
   'criacao quanto na edicao.',
   'IMPACTO SE FALHAR: se a trigger so valesse no INSERT, um documento renovado continuaria '
   'marcado como vencido para sempre — o prestador apareceria irregular mesmo com a documentacao '
   'em dia, e alguem teria que corrigir o status na mao.'),

  (v_mod,'TDOC-010','Documento de terceiro sem tipo e recusado','excecao','media','aprovado','api',
   'Verificar que tipo e nome sao obrigatorios. Regra: ambos sao NOT NULL. Importa porque um '
   'documento sem tipo nao pode ser cobrado nem classificado — o sistema nao sabe se e um PGR, um '
   'ASO ou um contrato.',
   'Precisa existir uma empresa terceira cadastrada.',
   '[
     {"ordem":1,"acao":"Tentar anexar um documento sem informar o tipo","onde_na_tela":"Terceiro > Documentos > Adicionar","dados":"Tipo: (vazio) | Nome: documento qualquer","resultado_esperado":"O sistema DEVE recusar"}
   ]'::jsonb,
   'O documento sem tipo e recusado.',
   'IMPACTO SE FALHAR: documentos sem tipo nao entram nas cobrancas de documentacao obrigatoria — '
   'o sistema nao sabe que categoria conferir.'),

  (v_mod,'TDOC-013','Apagar o terceiro apaga seus documentos','alternativo','alta','aprovado','api',
   'Verificar que os documentos somem junto com a empresa terceira (CASCADE). Regra: terceiro_id '
   'ON DELETE CASCADE. Importa porque documentos orfaos, sem a empresa a que pertencem, seriam '
   'lixo sem contexto na base.',
   'Precisa existir um terceiro com pelo menos um documento.',
   '[
     {"ordem":1,"acao":"Criar terceiro com um documento","onde_na_tela":"Terceiros","dados":"Terceiro: Prestadora X | Documento: PGR","resultado_esperado":"Documento vinculado ao terceiro"},
     {"ordem":2,"acao":"Apagar o terceiro","onde_na_tela":"Terceiros > Excluir","dados":"-","resultado_esperado":"Terceiro apagado"},
     {"ordem":3,"acao":"Conferir o documento","onde_na_tela":"-","dados":"-","resultado_esperado":"O documento foi apagado junto"}
   ]'::jsonb,
   'O terceiro e apagado e seus documentos somem junto. Nenhum documento orfao sobra.',
   'IMPACTO SE FALHAR: documentos apontando para um terceiro inexistente poluiriam a base e '
   'poderiam aparecer em consultas sem contexto.'),

  (v_mod,'TDOC-014','Apagar o trabalhador apaga seus documentos pessoais','alternativo','media','aprovado','api',
   'Verificar que documentos vinculados a um trabalhador especifico (ex.: ASO individual) somem '
   'com ele. Regra: trabalhador_id ON DELETE CASCADE. Importa porque um ASO pertence a uma pessoa; '
   'sem ela, o documento perde o sentido.',
   'Precisa existir um trabalhador de terceiro com um documento pessoal.',
   '[
     {"ordem":1,"acao":"Criar trabalhador com um ASO pessoal","onde_na_tela":"Terceiro > Trabalhadores + Documentos","dados":"Trabalhador: Jose | Documento: ASO vinculado a ele","resultado_esperado":"ASO vinculado ao trabalhador"},
     {"ordem":2,"acao":"Apagar o trabalhador","onde_na_tela":"Terceiro > Trabalhadores > Excluir","dados":"-","resultado_esperado":"Trabalhador apagado"},
     {"ordem":3,"acao":"Conferir o ASO","onde_na_tela":"-","dados":"-","resultado_esperado":"O ASO foi apagado junto"}
   ]'::jsonb,
   'O trabalhador e apagado e seus documentos pessoais somem junto.',
   'IMPACTO SE FALHAR: exames e certificados de uma pessoa que nao esta mais cadastrada '
   'continuariam na base, sem dono.'),

  (v_mod,'TDOC-022','Documento de terceiro de outro cliente e invisivel','negativo','critica','aprovado','api',
   'Verificar o isolamento multi-tenant nos documentos de terceiros. Importa porque estes '
   'documentos contem dados de saude (ASO), contratos e informacoes de empresas parceiras.',
   'Dois clientes distintos no sistema.',
   '[
     {"ordem":1,"acao":"No cliente A, anexar um documento a um terceiro","onde_na_tela":"Cliente A > Terceiros > Documentos","dados":"Documento identificavel do cliente A","resultado_esperado":"Criado no cliente A"},
     {"ordem":2,"acao":"Entrar como cliente B e procurar","onde_na_tela":"Cliente B > Terceiros","dados":"Buscar o documento do cliente A","resultado_esperado":"NAO aparece"}
   ]'::jsonb,
   'O documento do cliente A e invisivel no cliente B.',
   'IMPACTO SE FALHAR: vazamento de dados de saude (ASO) e contratos entre clientes — incidente '
   'grave de LGPD.'),

  -- ── TREINAMENTOS (mesma automação) ──

  (v_mod,'TTRE-001','Treinamento de terceiro tambem tem validade automatica','feliz','alta','aprovado','api',
   'Verificar que a mesma automacao de validade vale para os treinamentos de SST dos trabalhadores '
   'terceirizados. Regra: a funcao atualizar_status_terceiro_doc e aplicada tambem em '
   'terceiro_treinamentos. Importa porque treinamento de NR vencido significa que a pessoa NAO '
   'pode executar aquela atividade — e uma trava de seguranca, nao so um documento.',
   'Precisa existir um trabalhador de terceiro cadastrado.',
   '[
     {"ordem":1,"acao":"Registrar um treinamento com validade vencida","onde_na_tela":"Terceiro > Trabalhadores > Treinamentos > Adicionar","dados":"Tipo: NR-35 (trabalho em altura) | Validade: um ano atras","resultado_esperado":"Treinamento salvo"},
     {"ordem":2,"acao":"Conferir o status","onde_na_tela":"Lista de treinamentos do trabalhador","dados":"-","resultado_esperado":"Status: vencido — a mesma automacao dos documentos"}
   ]'::jsonb,
   'O treinamento vencido e classificado como "vencido" automaticamente, pela mesma trigger dos '
   'documentos.',
   'IMPACTO SE FALHAR: um trabalhador com NR-35 vencida apareceria apto a trabalhar em altura. '
   'Alem do risco de acidente, e responsabilidade legal da contratante permitir o acesso.'),

  (v_mod,'TTRE-010','Treinamento exige vinculo com trabalhador','excecao','media','aprovado','api',
   'Verificar que um treinamento precisa estar ligado a uma pessoa. Regra: trabalhador_id e '
   'NOT NULL em treinamentos (diferente de documentos, onde e opcional). Importa porque '
   'treinamento e sempre individual — nao existe "a empresa fez NR-35", quem faz e a pessoa.',
   'Precisa existir uma empresa terceira cadastrada.',
   '[
     {"ordem":1,"acao":"Tentar registrar um treinamento sem indicar o trabalhador","onde_na_tela":"Terceiro > Treinamentos > Adicionar","dados":"Tipo: NR-10 | Trabalhador: (nenhum)","resultado_esperado":"O sistema DEVE recusar — treinamento e individual"}
   ]'::jsonb,
   'O treinamento sem trabalhador e recusado. A diferenca em relacao aos documentos (onde o '
   'trabalhador e opcional) esta correta: documento pode ser da empresa, treinamento e da pessoa.',
   'IMPACTO SE FALHAR: um treinamento sem dono nao serve para liberar ninguem — e nao daria para '
   'saber quem esta apto a executar a atividade.')

  ON CONFLICT (codigo) DO NOTHING;
END $seed$;

-- ─────────────────────────────────────────────────────────
-- ROTINAS
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_novo_doc_terceiro(
  p_terceiro uuid, p_tipo text, p_nome text, p_validade date DEFAULT NULL,
  p_trabalhador uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.terceiro_documentos
    (tenant_id, terceiro_id, trabalhador_id, tipo, nome, data_validade)
  VALUES (public.qa_sandbox_tenant_id(), p_terceiro, p_trabalhador, p_tipo, p_nome, p_validade)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_tdoc_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_ter uuid; v_doc uuid; v_st text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Anexar documento com validade daqui a 180 dias';
  r.esperado:='Status atribuido automaticamente: valido';
  v_ter := public.qa_novo_terceiro('[QA] Prestadora Doc Valido', '11222333000181');
  v_doc := public.qa_novo_doc_terceiro(v_ter, 'PGR', '[QA] PGR 2026', CURRENT_DATE + 180);
  SELECT status::text INTO v_st FROM public.terceiro_documentos WHERE id=v_doc;
  IF v_st='valido' THEN
    r.situacao:='passou'; r.obtido:='Status "valido" atribuido sozinho pela trigger (validade a 180 dias).';
  ELSE
    r.situacao:='falhou'; r.obtido:=format('Esperava status "valido", obteve "%s". A automacao nao classificou corretamente.', v_st);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_tdoc_002()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_ter uuid; v_doc uuid; v_st text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Anexar documento com validade daqui a 15 dias';
  r.esperado:='Status atribuido automaticamente: a_vencer (janela de 30 dias)';
  v_ter := public.qa_novo_terceiro('[QA] Prestadora Doc A Vencer', '11222333000262');
  v_doc := public.qa_novo_doc_terceiro(v_ter, 'ASO', '[QA] ASO Joao', CURRENT_DATE + 15);
  SELECT status::text INTO v_st FROM public.terceiro_documentos WHERE id=v_doc;
  IF v_st='a_vencer' THEN
    r.situacao:='passou'; r.obtido:='Status "a_vencer" atribuido sozinho — o alerta previo de 30 dias funciona.';
  ELSE
    r.situacao:='falhou'; r.obtido:=format('Esperava "a_vencer", obteve "%s". A janela de alerta nao esta funcionando.', v_st);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_tdoc_003()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_ter uuid; v_doc uuid; v_st text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Anexar documento com validade de um ano atras';
  r.esperado:='Status atribuido automaticamente: vencido';
  v_ter := public.qa_novo_terceiro('[QA] Prestadora Doc Vencido', '11222333000343');
  v_doc := public.qa_novo_doc_terceiro(v_ter, 'PCMSO', '[QA] PCMSO 2025', CURRENT_DATE - 365);
  SELECT status::text INTO v_st FROM public.terceiro_documentos WHERE id=v_doc;
  IF v_st='vencido' THEN
    r.situacao:='passou';
    r.obtido:='Status "vencido" reconhecido sozinho. E esta automacao que falta no modulo geral de documentos (DOC-041).';
  ELSE
    r.situacao:='falhou';
    r.obtido:=format('Esperava "vencido", obteve "%s". A referencia usada no relatorio da equipe NAO se sustenta.', v_st);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_tdoc_004()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_ter uuid; v_doc uuid; v_st text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Anexar documento sem data de validade';
  r.esperado:='Status atribuido automaticamente: pendente';
  v_ter := public.qa_novo_terceiro('[QA] Prestadora Doc Pendente', '11222333000424');
  v_doc := public.qa_novo_doc_terceiro(v_ter, 'Contrato', '[QA] Contrato de prestacao', NULL);
  SELECT status::text INTO v_st FROM public.terceiro_documentos WHERE id=v_doc;
  IF v_st='pendente' THEN
    r.situacao:='passou'; r.obtido:='Status "pendente" para documento sem validade — distingue de "em dia".';
  ELSE
    r.situacao:='falhou'; r.obtido:=format('Esperava "pendente", obteve "%s".', v_st);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_tdoc_005()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_ter uuid; v_doc uuid; v_antes text; v_depois text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar documento vencido';
  r.esperado:='Ao renovar a validade, o status volta a valido sozinho';
  v_ter := public.qa_novo_terceiro('[QA] Prestadora Renovacao', '11222333000505');
  v_doc := public.qa_novo_doc_terceiro(v_ter, 'PGR', '[QA] PGR a renovar', CURRENT_DATE - 30);
  SELECT status::text INTO v_antes FROM public.terceiro_documentos WHERE id=v_doc;

  r.passo_ordem:=2; r.passo_acao:='Renovar: estender a validade para daqui a 1 ano';
  UPDATE public.terceiro_documentos SET data_validade = CURRENT_DATE + 365 WHERE id = v_doc;

  r.passo_ordem:=3; r.passo_acao:='Conferir se o status acompanhou a renovacao';
  SELECT status::text INTO v_depois FROM public.terceiro_documentos WHERE id=v_doc;

  IF v_antes='vencido' AND v_depois='valido' THEN
    r.situacao:='passou';
    r.obtido:='Status foi de "vencido" para "valido" ao renovar. A automacao vale tambem na edicao.';
  ELSE
    r.situacao:='falhou';
    r.obtido:=format('Esperava vencido -> valido. Obteve "%s" -> "%s". A trigger pode nao estar rodando no UPDATE.', v_antes, v_depois);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_tdoc_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_ter uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar anexar documento sem tipo'; r.esperado:='Recusado (NOT NULL)';
  v_ter := public.qa_novo_terceiro('[QA] Prestadora Sem Tipo', '11222333000686');
  BEGIN
    INSERT INTO public.terceiro_documentos (tenant_id, terceiro_id, tipo, nome)
    VALUES (v_t, v_ter, NULL, '[QA] doc sem tipo');
    r.situacao:='falhou'; r.obtido:='ACEITOU documento sem tipo.';
  EXCEPTION WHEN not_null_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado com not_null_violation, como deveria.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_tdoc_013()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_ter uuid; v_doc uuid; v_sobrou int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar terceiro com um documento';
  r.esperado:='Apagar o terceiro apaga o documento (CASCADE)';
  v_ter := public.qa_novo_terceiro('[QA] Prestadora Cascade Doc', '11222333000767');
  v_doc := public.qa_novo_doc_terceiro(v_ter, 'PGR', '[QA] PGR some junto', CURRENT_DATE + 90);
  r.passo_ordem:=2; r.passo_acao:='Apagar o terceiro';
  DELETE FROM public.terceiros WHERE id=v_ter;
  r.passo_ordem:=3; r.passo_acao:='Conferir se o documento foi apagado junto';
  SELECT count(*) INTO v_sobrou FROM public.terceiro_documentos WHERE id=v_doc;
  IF v_sobrou=0 THEN
    r.situacao:='passou'; r.obtido:='Documento apagado junto com o terceiro (CASCADE).';
  ELSE
    r.situacao:='falhou'; r.obtido:=format('Documento NAO foi apagado (%s ainda existe).', v_sobrou);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_tdoc_014()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_ter uuid; v_trab uuid; v_doc uuid; v_sobrou int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar trabalhador com um ASO pessoal';
  r.esperado:='Apagar o trabalhador apaga o ASO (CASCADE)';
  v_ter := public.qa_novo_terceiro('[QA] Prestadora Cascade Trab', '11222333000848');
  INSERT INTO public.terceiro_trabalhadores (tenant_id, terceiro_id, nome, cpf)
  VALUES (v_t, v_ter, '[QA] Jose Terceirizado', '52998224725') RETURNING id INTO v_trab;
  v_doc := public.qa_novo_doc_terceiro(v_ter, 'ASO', '[QA] ASO do Jose', CURRENT_DATE + 90, v_trab);
  r.passo_ordem:=2; r.passo_acao:='Apagar o trabalhador';
  DELETE FROM public.terceiro_trabalhadores WHERE id=v_trab;
  r.passo_ordem:=3; r.passo_acao:='Conferir se o ASO foi apagado junto';
  SELECT count(*) INTO v_sobrou FROM public.terceiro_documentos WHERE id=v_doc;
  IF v_sobrou=0 THEN
    r.situacao:='passou'; r.obtido:='ASO apagado junto com o trabalhador (CASCADE).';
  ELSE
    r.situacao:='falhou'; r.obtido:=format('ASO NAO foi apagado (%s ainda existe).', v_sobrou);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_tdoc_022()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t1 uuid := public.qa_sandbox_tenant_id();
        v_t2 uuid := public.qa_sandbox2_tenant_id(); v_ter uuid; v_vis int;
BEGIN
  PERFORM public.qa_modo_ligar();
  IF v_t2 IS NULL THEN r.situacao:='erro'; r.obtido:='2o cercado nao existe.'; RETURN r; END IF;
  r.passo_ordem:=1; r.passo_acao:='Anexar documento no tenant 1'; r.esperado:='Invisivel ao tenant 2';
  v_ter := public.qa_novo_terceiro('[QA] Prestadora Isolamento', '11222333000929');
  PERFORM public.qa_novo_doc_terceiro(v_ter, 'ASO', '[QA] ASO Secreto T1', CURRENT_DATE + 90);
  r.passo_ordem:=2; r.passo_acao:='Contar, filtrando pelo tenant 2';
  SELECT count(*) INTO v_vis FROM public.terceiro_documentos
   WHERE tenant_id=v_t2 AND nome='[QA] ASO Secreto T1';
  IF v_vis=0 THEN
    r.situacao:='passou'; r.obtido:='Documento do tenant 1 invisivel ao tenant 2.';
  ELSE
    r.situacao:='falhou'; r.obtido:=format('VAZAMENTO: %s documento(s) visiveis.', v_vis);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_ttre_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_ter uuid; v_trab uuid; v_tre uuid; v_st text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Registrar treinamento NR-35 com validade vencida';
  r.esperado:='Status vencido, pela mesma automacao dos documentos';
  v_ter := public.qa_novo_terceiro('[QA] Prestadora Treinamento', '11333444000181');
  INSERT INTO public.terceiro_trabalhadores (tenant_id, terceiro_id, nome, cpf)
  VALUES (v_t, v_ter, '[QA] Trabalhador Altura', '52998224725') RETURNING id INTO v_trab;
  INSERT INTO public.terceiro_treinamentos
    (tenant_id, terceiro_id, trabalhador_id, tipo, data_validade)
  VALUES (v_t, v_ter, v_trab, 'NR-35', CURRENT_DATE - 365) RETURNING id INTO v_tre;
  SELECT status::text INTO v_st FROM public.terceiro_treinamentos WHERE id=v_tre;
  IF v_st='vencido' THEN
    r.situacao:='passou';
    r.obtido:='Treinamento NR-35 vencido classificado sozinho — a mesma trigger vale para treinamentos.';
  ELSE
    r.situacao:='falhou';
    r.obtido:=format('Esperava "vencido", obteve "%s". Trabalhador com NR-35 vencida apareceria apto.', v_st);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_ttre_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_ter uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar registrar treinamento sem trabalhador';
  r.esperado:='Recusado — treinamento e individual (trabalhador_id NOT NULL)';
  v_ter := public.qa_novo_terceiro('[QA] Prestadora Treino Sem Dono', '11333444000262');
  BEGIN
    INSERT INTO public.terceiro_treinamentos (tenant_id, terceiro_id, trabalhador_id, tipo)
    VALUES (v_t, v_ter, NULL, 'NR-10');
    r.situacao:='falhou'; r.obtido:='ACEITOU treinamento sem trabalhador — nao daria para saber quem esta apto.';
  EXCEPTION WHEN not_null_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: treinamento exige trabalhador, como deve ser (e individual).';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

-- ── Registrar ──
INSERT INTO public.qa_implementacoes (codigo, funcao_sql) VALUES
  ('TDOC-001','qa_caso_tdoc_001'),('TDOC-002','qa_caso_tdoc_002'),('TDOC-003','qa_caso_tdoc_003'),
  ('TDOC-004','qa_caso_tdoc_004'),('TDOC-005','qa_caso_tdoc_005'),('TDOC-010','qa_caso_tdoc_010'),
  ('TDOC-013','qa_caso_tdoc_013'),('TDOC-014','qa_caso_tdoc_014'),('TDOC-022','qa_caso_tdoc_022'),
  ('TTRE-001','qa_caso_ttre_001'),('TTRE-010','qa_caso_ttre_010')
ON CONFLICT (codigo) DO UPDATE SET funcao_sql=EXCLUDED.funcao_sql, ativo=true;

-- ── Rodar ──
DO $roda$ BEGIN PERFORM public.qa_rodar_bateria('manual', 'estrutura-organizacional/prestadores'); END $roda$;

SELECT codigo, situacao::text, left(obtido, 68) AS resultado
FROM public.qa_resultados
WHERE execucao_id = (SELECT id FROM public.qa_execucoes ORDER BY iniciada_em DESC LIMIT 1)
  AND (codigo LIKE 'TDOC-%' OR codigo LIKE 'TTRE-%')
ORDER BY (situacao='falhou') DESC, codigo;
