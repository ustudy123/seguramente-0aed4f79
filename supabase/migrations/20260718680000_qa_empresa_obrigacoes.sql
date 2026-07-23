-- =========================================================
-- QA — OBRIGAÇÕES DA EMPRESA (empresa_obrigacoes)
-- Item 3 da auditoria de cobertura
--
-- O QUE E: o registro de conformidade legal da empresa. Cada linha e uma
-- obrigacao (CIPA, SESMT, cota PcD, FAP, TAC...) com sua base legal, status
-- de conformidade e criticidade.
--
-- POR QUE IMPORTA: e aqui que o sistema responde "esta empresa esta em dia
-- com o que a lei exige?". E tem uma integracao que nenhum teste cobria: o
-- campo acao_gerada_id aponta para plano_acoes — uma obrigacao nao conforme
-- pode virar uma acao concreta no plano.
--
-- Schema REAL (lido):
--   categoria TEXT NOT NULL      -- comentario cita legal|sst|estrategica|financeira
--   subcategoria TEXT            -- comentario cita cipa|sesmt|pcd|fap|tac
--   titulo TEXT NOT NULL, descricao, base_legal
--   status TEXT CHECK (pendente|conforme|nao_conforme|em_adequacao|nao_aplicavel)
--   criticidade TEXT CHECK (baixa|media|alta|critica)
--   prazo_sugerido, responsavel_sugerido
--   acao_gerada_id UUID REFERENCES plano_acoes(id)   <-- SEM on delete
--   origem, origem_campo
--
-- DOIS PONTOS DE ATENCAO IDENTIFICADOS NA LEITURA:
--   1. status e criticidade TEM CHECK. categoria e subcategoria NAO — os
--      valores validos vivem apenas no comentario do codigo.
--   2. acao_gerada_id nao declara ON DELETE, o que no Postgres significa
--      NO ACTION: apagar uma acao referenciada deve ser bloqueado. E o mesmo
--      comportamento do DOC-014 (nao apagar pasta com documento dentro).
--
-- NAO ha trigger que gere a acao automaticamente — a geracao e feita pela
-- aplicacao. O caso OBRG-002 verifica que o VINCULO funciona; se a tela
-- realmente oferece o botao de gerar acao e teste de interface.
-- =========================================================

DO $trava$
BEGIN
  IF to_regclass('public.empresa_obrigacoes') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS qa_guarda_cercado ON public.empresa_obrigacoes;
    CREATE TRIGGER qa_guarda_cercado BEFORE INSERT OR UPDATE OR DELETE ON public.empresa_obrigacoes
      FOR EACH ROW EXECUTE FUNCTION public.qa_bloqueia_fora_do_cercado();
    INSERT INTO public.qa_tabelas_protegidas (tabela, motivo)
    VALUES ('empresa_obrigacoes', 'Conformidade legal da empresa.') ON CONFLICT (tabela) DO NOTHING;
  END IF;
END $trava$;

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

  (v_mod,'OBRG-001','Registrar uma obrigacao legal da empresa','feliz','alta','aprovado','api',
   'Verificar o registro de uma obrigacao de conformidade. Regra: cada obrigacao tem categoria, '
   'titulo, base legal, status e criticidade. Importa porque este e o painel que responde se a '
   'empresa esta em dia com a lei — e o que orienta o que precisa ser resolvido primeiro.',
   'Precisa existir uma empresa cadastrada.',
   '[
     {"ordem":1,"acao":"Abrir as obrigacoes da empresa","onde_na_tela":"Empresas > abrir a empresa > aba Obrigacoes / Conformidade","dados":"-","resultado_esperado":"Lista de obrigacoes exibida"},
     {"ordem":2,"acao":"Registrar uma obrigacao de SST","onde_na_tela":"Nova Obrigacao","dados":"Categoria: sst | Subcategoria: cipa | Titulo: Constituir CIPA | Base legal: NR-05 | Criticidade: alta","resultado_esperado":"Campos aceitos"},
     {"ordem":3,"acao":"Salvar","onde_na_tela":"Salvar","dados":"-","resultado_esperado":"Obrigacao registrada com status pendente"}
   ]'::jsonb,
   'A obrigacao "Constituir CIPA" existe, categoria sst, subcategoria cipa, base legal NR-05, '
   'criticidade alta e status inicial pendente.',
   'IMPACTO SE FALHAR: sem registrar obrigacoes, a empresa nao tem visao do que a lei exige dela — '
   'a conformidade vira controle informal, fora do sistema.'),

  (v_mod,'OBRG-002','Obrigacao nao conforme vinculada a uma acao do plano','feliz','alta','aprovado','api',
   'Verificar a integracao entre conformidade e execucao: uma obrigacao pode apontar para a acao '
   'criada para resolve-la. Regra: acao_gerada_id referencia plano_acoes. Importa porque e o que '
   'transforma "estamos irregulares" em "alguem esta resolvendo, com prazo e responsavel" — sem '
   'isso, o painel de conformidade so aponta problemas sem encaminhamento.',
   'Precisa existir uma empresa e uma acao no plano de acao.',
   '[
     {"ordem":1,"acao":"Registrar uma obrigacao nao conforme","onde_na_tela":"Empresa > Obrigacoes > Nova","dados":"Categoria: legal | Subcategoria: pcd | Titulo: Cumprir cota de PcD | Status: nao_conforme","resultado_esperado":"Obrigacao registrada como nao conforme"},
     {"ordem":2,"acao":"Gerar uma acao no plano para resolver a obrigacao","onde_na_tela":"Obrigacao > botao Gerar Acao","dados":"Acao: Contratar PcDs para atingir a cota","resultado_esperado":"Acao criada no plano de acao"},
     {"ordem":3,"acao":"Conferir o vinculo","onde_na_tela":"Obrigacao > campo Acao gerada","dados":"-","resultado_esperado":"A obrigacao aponta para a acao criada"}
   ]'::jsonb,
   'A obrigacao nao conforme referencia a acao do plano criada para resolve-la. Conformidade e '
   'execucao ficam ligadas.',
   'IMPACTO SE FALHAR: o painel de conformidade apontaria irregularidades sem nenhum encaminhamento '
   '— saber que esta irregular sem que ninguem seja responsavel por corrigir. NOTA: este caso '
   'verifica que o VINCULO funciona no banco. Nao ha trigger que gere a acao automaticamente; a '
   'geracao e feita pela aplicacao, e se a tela oferece esse caminho e teste de interface.'),

  (v_mod,'OBRG-010','Obrigacao sem categoria ou titulo e recusada','excecao','media','aprovado','api',
   'Verificar que categoria e titulo sao obrigatorios. Regra: ambos NOT NULL. Importa porque uma '
   'obrigacao sem titulo nao comunica o que precisa ser feito, e sem categoria nao entra em nenhum '
   'agrupamento do painel.',
   'Precisa existir uma empresa cadastrada.',
   '[
     {"ordem":1,"acao":"Tentar registrar uma obrigacao sem titulo","onde_na_tela":"Empresa > Obrigacoes > Nova","dados":"Categoria: legal | Titulo: (vazio)","resultado_esperado":"O sistema DEVE recusar"}
   ]'::jsonb,
   'A obrigacao sem titulo e recusada.',
   'IMPACTO SE FALHAR: obrigacoes em branco no painel de conformidade — ninguem sabe o que precisa '
   'ser resolvido.'),

  (v_mod,'OBRG-011','Status de conformidade respeita a lista fechada','excecao','alta','aprovado','api',
   'Verificar que o status so aceita os valores previstos. Regra: CHECK com pendente, conforme, '
   'nao_conforme, em_adequacao e nao_aplicavel. Importa porque o painel agrupa por status para '
   'mostrar o que esta em dia e o que nao esta — um valor fora da lista sumiria da visao.',
   'Precisa existir uma empresa cadastrada.',
   '[
     {"ordem":1,"acao":"Tentar registrar obrigacao com status fora da lista","onde_na_tela":"Empresa > Obrigacoes > campo Status","dados":"Status: resolvido (o correto seria conforme)","resultado_esperado":"O sistema DEVE recusar"}
   ]'::jsonb,
   'O status invalido e recusado. Somente os cinco valores previstos sao aceitos.',
   'IMPACTO SE FALHAR: uma obrigacao com status desconhecido nao aparece em nenhum filtro do painel '
   '— some da visao de conformidade sem que ninguem perceba.'),

  (v_mod,'OBRG-012','Criticidade respeita a lista fechada','excecao','media','aprovado','api',
   'Verificar que a criticidade so aceita os valores previstos. Regra: CHECK com baixa, media, alta '
   'e critica. Importa porque a criticidade define a ordem de atendimento — e o que diz por onde '
   'comecar quando ha varias pendencias.',
   'Precisa existir uma empresa cadastrada.',
   '[
     {"ordem":1,"acao":"Tentar registrar obrigacao com criticidade fora da lista","onde_na_tela":"Empresa > Obrigacoes > campo Criticidade","dados":"Criticidade: urgentissima (nao existe na lista)","resultado_esperado":"O sistema DEVE recusar"}
   ]'::jsonb,
   'A criticidade invalida e recusada. Somente baixa, media, alta e critica sao aceitas.',
   'IMPACTO SE FALHAR: criticidade invalida quebra a priorizacao — a obrigacao nao entra na ordem '
   'correta de atendimento.'),

  (v_mod,'OBRG-013','Nao da para apagar a acao vinculada a uma obrigacao','negativo','alta','aprovado','api',
   'Verificar que o banco protege o vinculo entre obrigacao e acao. Regra: acao_gerada_id nao '
   'declara ON DELETE, o que significa NO ACTION — a exclusao da acao e bloqueada enquanto a '
   'obrigacao apontar para ela. Importa porque apagar a acao deixaria a obrigacao apontando para '
   'o nada, e a irregularidade ficaria sem encaminhamento silenciosamente.',
   'Precisa existir uma obrigacao vinculada a uma acao do plano.',
   '[
     {"ordem":1,"acao":"Ter uma obrigacao com acao gerada","onde_na_tela":"Empresa > Obrigacoes","dados":"Obrigacao nao conforme, com acao vinculada","resultado_esperado":"Vinculo existe"},
     {"ordem":2,"acao":"Tentar apagar a acao no plano de acao","onde_na_tela":"Plano de Acao > abrir a acao > Excluir","dados":"-","resultado_esperado":"O sistema DEVE recusar — ha uma obrigacao apontando para ela"},
     {"ordem":3,"acao":"Conferir que ambas continuam","onde_na_tela":"Plano de Acao e Obrigacoes","dados":"-","resultado_esperado":"Acao e obrigacao intactas, vinculo preservado"}
   ]'::jsonb,
   'A exclusao da acao e RECUSADA enquanto a obrigacao a referenciar. O vinculo entre conformidade '
   'e execucao esta protegido.',
   'IMPACTO SE FALHAR: apagar a acao deixaria a obrigacao apontando para um registro inexistente. '
   'A empresa continuaria irregular, com o painel mostrando que "ha uma acao" que na verdade nao '
   'existe mais. MESMO PADRAO do DOC-014 (nao apagar pasta com documento) — protecao por NO ACTION.'),

  (v_mod,'OBRG-020','Categoria e subcategoria aceitam texto livre','excecao','media','aprovado','api',
   'Verificar se categoria e subcategoria tem lista fechada. Contexto: o codigo documenta os '
   'valores esperados em comentario (categoria: legal, sst, estrategica, financeira; subcategoria: '
   'cipa, sesmt, pcd, fap, tac), mas o comentario nao e regra. Importa porque o painel de '
   'conformidade agrupa por categoria — um valor divergente cria um grupo orfao.',
   'Precisa existir uma empresa cadastrada.',
   '[
     {"ordem":1,"acao":"Registrar obrigacao com categoria fora do previsto","onde_na_tela":"Via importacao ou API","dados":"Categoria: juridico (o previsto seria legal) | Subcategoria: banana","resultado_esperado":"Idealmente recusado, ja que ha uma lista esperada"}
   ]'::jsonb,
   'A categoria divergente deveria ser recusada. RESULTADO REAL: o banco aceita qualquer texto — '
   'categoria e subcategoria sao TEXT sem CHECK; os valores validos vivem apenas no comentario.',
   'IMPACTO: o painel agrupa por categoria. Uma obrigacao com categoria "juridico" em vez de '
   '"legal" cria um grupo separado, e quem olhar o grupo "legal" nao a vera — a pendencia some da '
   'visao. MESMO PADRAO do achado DOC-042 (status como texto livre). CORRECAO SUGERIDA: '
   'ALTER TABLE empresa_obrigacoes ADD CONSTRAINT obrigacoes_categoria_valida '
   'CHECK (categoria IN (''legal'',''sst'',''estrategica'',''financeira'')); '
   'e avaliar o mesmo para subcategoria, que tende a crescer com o tempo.'),

  (v_mod,'OBRG-022','Obrigacoes de outro cliente sao invisiveis','negativo','critica','aprovado','api',
   'Verificar o isolamento multi-tenant nas obrigacoes. Importa porque o painel de conformidade '
   'revela exatamente onde a empresa esta irregular perante a lei — informacao sensivel, com '
   'implicacao juridica.',
   'Dois clientes distintos no sistema.',
   '[
     {"ordem":1,"acao":"No cliente A, registrar uma obrigacao nao conforme","onde_na_tela":"Cliente A > Empresa > Obrigacoes","dados":"Obrigacao identificavel, status nao_conforme","resultado_esperado":"Criada no cliente A"},
     {"ordem":2,"acao":"Entrar como cliente B e procurar","onde_na_tela":"Cliente B > Empresa > Obrigacoes","dados":"Buscar a obrigacao do cliente A","resultado_esperado":"NAO aparece"}
   ]'::jsonb,
   'A obrigacao do cliente A e invisivel no cliente B.',
   'IMPACTO SE FALHAR: exporia as irregularidades legais de uma empresa para outra — informacao '
   'com potencial de uso comercial ou juridico contra o cliente exposto.')

  ON CONFLICT (codigo) DO NOTHING;
END $seed$;

-- ─────────────────────────────────────────────────────────
-- ROTINAS
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_nova_obrigacao(
  p_categoria text, p_titulo text, p_status text DEFAULT 'pendente',
  p_criticidade text DEFAULT 'media', p_subcategoria text DEFAULT NULL,
  p_acao uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.empresa_obrigacoes
    (tenant_id, categoria, subcategoria, titulo, status, criticidade, acao_gerada_id)
  VALUES (public.qa_sandbox_tenant_id(), p_categoria, p_subcategoria, p_titulo,
          p_status, p_criticidade, p_acao)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_obrg_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
        v_cat text; v_sub text; v_st text; v_crit text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Registrar a obrigacao "Constituir CIPA" (NR-05)';
  r.esperado:='Obrigacao registrada com status pendente';
  INSERT INTO public.empresa_obrigacoes
    (tenant_id, categoria, subcategoria, titulo, base_legal, criticidade)
  VALUES (v_t, 'sst', 'cipa', '[QA] Constituir CIPA', 'NR-05', 'alta') RETURNING id INTO v_id;
  SELECT categoria, subcategoria, status, criticidade INTO v_cat, v_sub, v_st, v_crit
    FROM public.empresa_obrigacoes WHERE id=v_id;
  IF v_cat='sst' AND v_sub='cipa' AND v_st='pendente' AND v_crit='alta' THEN
    r.situacao:='passou';
    r.obtido:='Obrigacao registrada: sst/cipa, NR-05, criticidade alta, status inicial pendente.';
  ELSE
    r.situacao:='falhou';
    r.obtido:=format('Valores inesperados: %s/%s, status=%s, criticidade=%s.', v_cat, v_sub, v_st, v_crit);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_obrg_002()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_acao uuid; v_obr uuid; v_acao_da_obr uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar a acao no plano para resolver a irregularidade';
  r.esperado:='A obrigacao referencia a acao criada';
  v_acao := public.qa_nova_acao('[QA] Contratar PcDs para atingir a cota');
  r.passo_ordem:=2; r.passo_acao:='Registrar a obrigacao nao conforme, vinculada a essa acao';
  v_obr := public.qa_nova_obrigacao('legal', '[QA] Cumprir cota de PcD', 'nao_conforme', 'alta', 'pcd', v_acao);
  SELECT acao_gerada_id INTO v_acao_da_obr FROM public.empresa_obrigacoes WHERE id=v_obr;
  IF v_acao_da_obr = v_acao THEN
    r.situacao:='passou';
    r.obtido:='Obrigacao nao conforme ligada a acao do plano — conformidade e execucao conectadas.';
  ELSE
    r.situacao:='falhou'; r.obtido:='A obrigacao nao referenciou a acao.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_obrg_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar registrar obrigacao sem titulo'; r.esperado:='Recusado (NOT NULL)';
  BEGIN
    INSERT INTO public.empresa_obrigacoes (tenant_id, categoria, titulo)
    VALUES (v_t, 'legal', NULL);
    r.situacao:='falhou'; r.obtido:='ACEITOU obrigacao sem titulo.';
  EXCEPTION WHEN not_null_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado com not_null_violation, como deveria.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_obrg_011()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar status "resolvido" (fora da lista)';
  r.esperado:='Recusado pelo CHECK';
  BEGIN
    PERFORM public.qa_nova_obrigacao('legal', '[QA] Status Invalido', 'resolvido');
    r.situacao:='falhou'; r.obtido:='ACEITOU status fora da lista.';
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou';
    r.obtido:='Recusado: status so aceita pendente/conforme/nao_conforme/em_adequacao/nao_aplicavel.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_obrg_012()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar criticidade "urgentissima" (fora da lista)';
  r.esperado:='Recusado pelo CHECK';
  BEGIN
    PERFORM public.qa_nova_obrigacao('legal', '[QA] Criticidade Invalida', 'pendente', 'urgentissima');
    r.situacao:='falhou'; r.obtido:='ACEITOU criticidade fora da lista.';
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: criticidade so aceita baixa/media/alta/critica.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_obrg_013()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_acao uuid; v_obr uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar acao e obrigacao vinculada a ela';
  r.esperado:='Apagar a acao e recusado enquanto a obrigacao apontar para ela';
  v_acao := public.qa_nova_acao('[QA] Acao Protegida Por Obrigacao');
  v_obr := public.qa_nova_obrigacao('legal', '[QA] Obrigacao Com Acao', 'nao_conforme', 'alta', 'tac', v_acao);
  r.passo_ordem:=2; r.passo_acao:='Tentar apagar a acao que a obrigacao referencia';
  BEGIN
    DELETE FROM public.plano_acoes WHERE id=v_acao;
    r.situacao:='falhou';
    r.obtido:='APAGOU a acao vinculada — a obrigacao ficou apontando para um registro inexistente.';
  EXCEPTION WHEN foreign_key_violation THEN
    r.situacao:='passou';
    r.obtido:='Recusado: o banco protege o vinculo, nao deixa apagar a acao que resolve a obrigacao.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_obrg_020()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_id uuid; v_cat text; v_sub text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1;
  r.passo_acao:='Tentar categoria "juridico" e subcategoria "banana" (fora do previsto)';
  r.esperado:='Idealmente recusado — ha uma lista esperada documentada no codigo';
  BEGIN
    v_id := public.qa_nova_obrigacao('juridico', '[QA] Categoria Livre', 'pendente', 'media', 'banana');
    SELECT categoria, subcategoria INTO v_cat, v_sub FROM public.empresa_obrigacoes WHERE id=v_id;
    r.situacao:='falhou';
    r.obtido:=format('O BANCO ACEITOU categoria "%s" e subcategoria "%s". Sao TEXT sem CHECK — os valores validos vivem so no comentario do codigo. Uma obrigacao assim some do agrupamento do painel.', v_cat, v_sub);
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: categoria e subcategoria tem lista fechada.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_obrg_022()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t1 uuid := public.qa_sandbox_tenant_id();
        v_t2 uuid := public.qa_sandbox2_tenant_id(); v_vis int;
BEGIN
  PERFORM public.qa_modo_ligar();
  IF v_t2 IS NULL THEN r.situacao:='erro'; r.obtido:='2o cercado nao existe.'; RETURN r; END IF;
  r.passo_ordem:=1; r.passo_acao:='Registrar obrigacao no tenant 1'; r.esperado:='Invisivel ao tenant 2';
  INSERT INTO public.empresa_obrigacoes (tenant_id, categoria, titulo, status)
  VALUES (v_t1, 'legal', '[QA] Irregularidade Secreta T1', 'nao_conforme');
  r.passo_ordem:=2; r.passo_acao:='Contar, filtrando pelo tenant 2';
  SELECT count(*) INTO v_vis FROM public.empresa_obrigacoes
   WHERE tenant_id=v_t2 AND titulo='[QA] Irregularidade Secreta T1';
  IF v_vis=0 THEN
    r.situacao:='passou'; r.obtido:='Obrigacao do tenant 1 invisivel ao tenant 2.';
  ELSE
    r.situacao:='falhou'; r.obtido:=format('VAZAMENTO: %s obrigacao(oes) visiveis.', v_vis);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

-- ── Registrar ──
INSERT INTO public.qa_implementacoes (codigo, funcao_sql) VALUES
  ('OBRG-001','qa_caso_obrg_001'),('OBRG-002','qa_caso_obrg_002'),('OBRG-010','qa_caso_obrg_010'),
  ('OBRG-011','qa_caso_obrg_011'),('OBRG-012','qa_caso_obrg_012'),('OBRG-013','qa_caso_obrg_013'),
  ('OBRG-020','qa_caso_obrg_020'),('OBRG-022','qa_caso_obrg_022')
ON CONFLICT (codigo) DO UPDATE SET funcao_sql=EXCLUDED.funcao_sql, ativo=true;

-- ── Rodar ──
DO $roda$ BEGIN PERFORM public.qa_rodar_bateria('manual', 'estrutura-organizacional/empresa'); END $roda$;

SELECT codigo, situacao::text, left(obtido, 70) AS resultado
FROM public.qa_resultados
WHERE execucao_id = (SELECT id FROM public.qa_execucoes ORDER BY iniciada_em DESC LIMIT 1)
  AND codigo LIKE 'OBRG-%'
ORDER BY (situacao='falhou') DESC, codigo;
