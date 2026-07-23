-- =========================================================
-- QA — CONFIGURAÇÃO DE METAS, INDICADORES E A EXPANSÃO DA TABELA METAS
-- Item 2 da auditoria de cobertura + casos da especificação do Alexandre
--
-- DESCOBERTA AO INVESTIGAR: os casos META-001 a META-022 cobrem a tabela
-- 'metas' como ela era ANTES da migration de 30/03, que adicionou ~25 colunas
-- com regras proprias:
--   nivel (enum), workflow_status (enum), meta_pai_id (desdobramento
--   hierarquico), objetivo_estrategico, o indicador embutido (indicador_nome,
--   indicador_tipo, indicador_unidade, indicador_direcao, formula_medicao),
--   os valores (valor_baseline, valor_alvo, valor_atual, valor_minimo,
--   valor_maximo), unidade_id, setor_id, responsavel, aprovador.
-- Mesma licao do IDE-020: a definicao original nao conta a historia toda.
--
-- ARQUITETURA (apurada): o indicador existe em DOIS lugares
--   - embutido na propria meta (indicador_nome, indicador_tipo, ...)
--   - como catalogo separado em metas_indicadores (sem FK com metas)
-- Sao usos diferentes: a meta guarda o seu indicador; o catalogo serve para
-- reaproveitar definicoes. Os testes cobrem os dois.
--
-- ENUMS REAIS:
--   meta_nivel: estrategica | unidade | setor | individual
--   meta_workflow_status: rascunho | em_aprovacao | ativa | em_revisao |
--                         suspensa | encerrada | cancelada
--   indicador_tipo: quantitativo | qualitativo | percentual | financeiro |
--                   marco | hibrido
--   indicador_direcao: maior_melhor | menor_melhor | igual_melhor | faixa
--
-- ORIGEM DOS CASOS: especificação de testes do modal de Nova Meta trazida
-- pelo Alexandre. Os casos de interface (modal, scroll, placeholder, foco)
-- ficam para Cypress; aqui estao as regras que vivem no banco.
-- =========================================================

DO $trava$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['metas_configuracao','metas_indicadores'] LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS qa_guarda_cercado ON public.%I', t);
      EXECUTE format('CREATE TRIGGER qa_guarda_cercado BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.qa_bloqueia_fora_do_cercado()', t);
      INSERT INTO public.qa_tabelas_protegidas (tabela, motivo)
      VALUES (t, 'Configuracao e indicadores de metas.') ON CONFLICT (tabela) DO NOTHING;
    END IF;
  END LOOP;
END $trava$;

-- ─────────────────────────────────────────────────────────
-- DOCUMENTAÇÃO
-- ─────────────────────────────────────────────────────────
DO $seed$
DECLARE v_mod uuid;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos WHERE path='planejamento-gestao/metas';
  IF v_mod IS NULL THEN RAISE EXCEPTION 'Modulo metas nao encontrado.'; END IF;

  INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, nivel, objetivo, pre_condicoes, passos, resultado_esperado, observacoes)
  VALUES

  -- ══ CONFIGURAÇÃO ══
  (v_mod,'MCFG-001','Cada cliente tem uma configuracao de metas','feliz','alta','aprovado','api',
   'Verificar que a configuracao de metas e criada por cliente, com os padroes corretos. Regra: '
   'metas_configuracao tem UNIQUE(tenant_id) — uma configuracao por cliente. Ela parametriza os '
   'niveis habilitados, o que e obrigatorio e como funciona a aprovacao. Importa porque as regras '
   'do modulo Metas VARIAM entre clientes; e esta tabela que decide.',
   'Nenhuma alem de ter o cliente cadastrado.',
   '[
     {"ordem":1,"acao":"Abrir as configuracoes do modulo Metas","onde_na_tela":"Menu > Planejamento e Gestao > Metas > Configuracoes","dados":"-","resultado_esperado":"Tela de parametrizacao aberta"},
     {"ordem":2,"acao":"Conferir os valores padrao","onde_na_tela":"Secoes de niveis e obrigatoriedades","dados":"-","resultado_esperado":"Niveis habilitados: estrategica, unidade, setor, individual. Exigir indicador: sim. Exigir objetivo estrategico: nao. Escala de 0 a 100."}
   ]'::jsonb,
   'A configuracao existe com os quatro niveis habilitados, indicador obrigatorio, objetivo '
   'estrategico opcional e escala de 0 a 100.',
   'IMPACTO SE FALHAR: sem configuracao, o modulo nao sabe quais niveis oferecer nem o que exigir — '
   'o cadastro de metas fica sem regra definida.'),

  (v_mod,'MCFG-002','Alterar os niveis habilitados','feliz','media','aprovado','api',
   'Verificar que o cliente pode restringir quais niveis de meta sao usados. Regra: '
   'niveis_habilitados e um array; o cliente pode deixar so os que usa. Importa porque nem toda '
   'empresa trabalha com os quatro niveis — uma menor pode usar so metas individuais.',
   'Precisa existir a configuracao do cliente.',
   '[
     {"ordem":1,"acao":"Abrir as configuracoes de Metas","onde_na_tela":"Metas > Configuracoes > Niveis","dados":"-","resultado_esperado":"Lista de niveis com os habilitados marcados"},
     {"ordem":2,"acao":"Desmarcar niveis que a empresa nao usa","onde_na_tela":"Selecao de niveis","dados":"Deixar habilitados apenas: estrategica e individual","resultado_esperado":"Somente os dois ficam marcados"},
     {"ordem":3,"acao":"Salvar e reabrir","onde_na_tela":"Salvar","dados":"-","resultado_esperado":"A restricao persistiu; ao criar uma meta, so esses dois niveis sao oferecidos"}
   ]'::jsonb,
   'A configuracao passa a ter apenas dois niveis habilitados, e a alteracao persiste.',
   'IMPACTO SE FALHAR: o cliente seria obrigado a conviver com niveis que nao usa, poluindo o '
   'cadastro. ORIGEM: caso CT06 da especificacao (nao exibir niveis nao habilitados). NOTA: este '
   'caso verifica que a configuracao GRAVA a restricao. Se a tela realmente esconde os niveis '
   'desabilitados e teste de interface (Cypress).'),

  (v_mod,'MCFG-003','Ligar a obrigatoriedade de objetivo estrategico','feliz','alta','aprovado','api',
   'Verificar que o cliente pode tornar obrigatorio o vinculo da meta com um objetivo estrategico. '
   'Regra: exigir_objetivo_estrategico vem desligado por padrao e pode ser ligado. Importa porque '
   'empresas com planejamento estrategico maduro querem que toda meta se conecte a ele; outras nao.',
   'Precisa existir a configuracao do cliente.',
   '[
     {"ordem":1,"acao":"Abrir as configuracoes de Metas","onde_na_tela":"Metas > Configuracoes > Obrigatoriedades","dados":"-","resultado_esperado":"Opcao Exigir objetivo estrategico visivel, desligada"},
     {"ordem":2,"acao":"Ligar a obrigatoriedade","onde_na_tela":"Toggle Exigir objetivo estrategico","dados":"Ligar","resultado_esperado":"Opcao ligada"},
     {"ordem":3,"acao":"Salvar e conferir","onde_na_tela":"Salvar > reabrir","dados":"-","resultado_esperado":"A obrigatoriedade persistiu"}
   ]'::jsonb,
   'A configuracao passa a exigir objetivo estrategico, e a alteracao persiste.',
   'IMPACTO SE FALHAR: a parametrizacao nao seria respeitada e o comportamento do cadastro ficaria '
   'fixo para todos os clientes. ORIGEM: casos CT14 e CT49 da especificacao. NOTA: este caso '
   'verifica que a configuracao GRAVA. Se o cadastro de meta realmente BLOQUEIA quando falta o '
   'vinculo e regra de aplicacao — hoje nao ha nada no banco que force isso (ver MCFG-030).'),

  (v_mod,'MCFG-020','Duas configuracoes para o mesmo cliente e proibido','negativo','alta','aprovado','api',
   'Verificar que nao da para criar duas configuracoes para o mesmo cliente. Regra: '
   'UNIQUE(tenant_id). Importa porque duas configuracoes gerariam regras conflitantes — qual vale?',
   'Precisa existir uma configuracao para o cliente.',
   '[
     {"ordem":1,"acao":"Ter a configuracao do cliente criada","onde_na_tela":"Metas > Configuracoes","dados":"-","resultado_esperado":"Configuracao existe"},
     {"ordem":2,"acao":"Tentar criar uma SEGUNDA configuracao para o mesmo cliente","onde_na_tela":"Via importacao ou API","dados":"Nova configuracao, mesmo cliente","resultado_esperado":"O sistema DEVE recusar"}
   ]'::jsonb,
   'A segunda configuracao e recusada. Cada cliente tem exatamente uma.',
   'IMPACTO SE FALHAR: duas configuracoes com regras diferentes para o mesmo cliente — o modulo nao '
   'saberia qual seguir, e o comportamento ficaria imprevisivel.'),

  (v_mod,'MCFG-021','Escala de avaliacao invertida','excecao','media','aprovado','api',
   'Verificar se o banco aceita uma escala com minimo maior que o maximo. Regra: escala_min deve '
   'ser menor que escala_max (padrao 0 a 100). Importa porque uma escala invertida torna impossivel '
   'avaliar o atingimento — nenhum valor cabe nela.',
   'Precisa existir a configuracao do cliente.',
   '[
     {"ordem":1,"acao":"Alterar a escala de avaliacao para valores invertidos","onde_na_tela":"Metas > Configuracoes > Escala de avaliacao","dados":"Escala minima: 100 | Escala maxima: 0","resultado_esperado":"Idealmente recusado — o minimo nao pode exceder o maximo"}
   ]'::jsonb,
   'A escala invertida deveria ser recusada. RESULTADO REAL: o banco aceita — nao ha CHECK de '
   'coerencia entre escala_min e escala_max.',
   'IMPACTO: escala invertida quebra o calculo de atingimento das metas. CORRECAO SUGERIDA: '
   'ALTER TABLE metas_configuracao ADD CONSTRAINT escala_coerente '
   'CHECK (escala_min < escala_max). MESMO PADRAO dos achados CARGO-012 (faixa salarial) e EMP-041 '
   '(faixa de aprendiz) — vale corrigir os tres juntos.'),

  (v_mod,'MCFG-030','A configuracao e apenas informativa para o banco','excecao','alta','aprovado','api',
   'Verificar se as obrigatoriedades definidas na configuracao sao aplicadas pelo banco. Regra '
   'esperada: com exigir_objetivo_estrategico ligado, uma meta sem objetivo deveria ser recusada. '
   'Este caso revela onde a parametrizacao e efetivamente aplicada. Importa porque uma configuracao '
   'que ninguem aplica e apenas decoracao.',
   'Precisa existir a configuracao do cliente com exigir_objetivo_estrategico ligado.',
   '[
     {"ordem":1,"acao":"Ligar a obrigatoriedade de objetivo estrategico na configuracao","onde_na_tela":"Metas > Configuracoes","dados":"Exigir objetivo estrategico: sim","resultado_esperado":"Configuracao gravada"},
     {"ordem":2,"acao":"Criar uma meta SEM informar o objetivo estrategico","onde_na_tela":"Via importacao ou API (fora da tela, que validaria)","dados":"Titulo: Meta sem objetivo | Ano: 2026 | Objetivo estrategico: (vazio)","resultado_esperado":"Idealmente recusado, ja que a configuracao exige"}
   ]'::jsonb,
   'A meta sem objetivo deveria ser recusada quando a configuracao exige. RESULTADO REAL: o banco '
   'aceita — a parametrizacao e lida e aplicada pelo front, sem nada que a garanta no banco.',
   'IMPACTO: dados que entrem por importacao ou API ignoram completamente a parametrizacao do '
   'cliente. Uma empresa que exige vinculo estrategico em toda meta pode receber metas sem vinculo '
   'por esses caminhos. MESMO PADRAO dos demais achados (regra no front, ausente no banco). '
   'CORRECAO SUGERIDA: uma trigger que leia metas_configuracao e valide na gravacao. NOTA: e uma '
   'decisao de produto — validar parametrizacao no banco adiciona acoplamento; a alternativa e '
   'garantir que todo caminho de entrada passe pela mesma validacao da aplicacao.'),

  -- ══ CATÁLOGO DE INDICADORES ══
  (v_mod,'MIND-001','Cadastrar um indicador no catalogo','feliz','media','aprovado','api',
   'Verificar o cadastro de um indicador reutilizavel. Regra: metas_indicadores e um catalogo de '
   'definicoes (nome, tipo, unidade, direcao, formula) que pode ser reaproveitado entre metas. '
   'Importa porque padronizar indicadores evita que cada meta invente sua propria forma de medir a '
   'mesma coisa.',
   'Nenhuma alem do acesso ao modulo.',
   '[
     {"ordem":1,"acao":"Abrir o catalogo de indicadores","onde_na_tela":"Metas > Indicadores > Novo","dados":"-","resultado_esperado":"Formulario aberto"},
     {"ordem":2,"acao":"Preencher a definicao do indicador","onde_na_tela":"Campos Nome, Tipo, Unidade, Direcao, Formula","dados":"Nome: Taxa de acidentes | Tipo: quantitativo | Unidade: % | Direcao: menor_melhor | Formula: (acidentes no mes / total de colaboradores) * 100","resultado_esperado":"Campos aceitos"},
     {"ordem":3,"acao":"Salvar","onde_na_tela":"Salvar","dados":"-","resultado_esperado":"Indicador disponivel no catalogo"}
   ]'::jsonb,
   'O indicador Taxa de acidentes existe no catalogo, com tipo quantitativo, direcao menor_melhor e '
   'a formula preservada.',
   'IMPACTO SE FALHAR: sem catalogo, cada meta define seu indicador do zero — a mesma metrica '
   'acaba medida de formas diferentes em metas diferentes, impedindo comparacao. ORIGEM: casos '
   'CT22 a CT31 e CT45 da especificacao.'),

  (v_mod,'MIND-010','Indicador com tipo invalido e recusado','excecao','media','aprovado','api',
   'Verificar que o tipo do indicador respeita a lista fechada. Regra: indicador_tipo aceita '
   'quantitativo, qualitativo, percentual, financeiro, marco ou hibrido. Importa porque o tipo '
   'determina como o indicador e medido e apresentado.',
   'Nenhuma.',
   '[
     {"ordem":1,"acao":"Tentar cadastrar um indicador com tipo fora da lista","onde_na_tela":"Metas > Indicadores > Novo > campo Tipo","dados":"Tipo: aproximado (nao existe na lista)","resultado_esperado":"O sistema DEVE recusar"}
   ]'::jsonb,
   'O tipo invalido e recusado. Somente os seis tipos previstos sao aceitos.',
   'IMPACTO SE FALHAR: um tipo desconhecido quebraria a logica de medicao e apresentacao do '
   'indicador. ORIGEM: caso CT24 da especificacao.'),

  (v_mod,'MIND-011','Indicador com direcao invalida e recusado','excecao','media','aprovado','api',
   'Verificar que a direcao do indicador respeita a lista fechada. Regra: indicador_direcao aceita '
   'maior_melhor, menor_melhor, igual_melhor ou faixa. Importa porque a direcao define se atingir a '
   'meta e subir ou descer o numero — errar isso inverte a avaliacao de desempenho.',
   'Nenhuma.',
   '[
     {"ordem":1,"acao":"Tentar cadastrar um indicador com direcao fora da lista","onde_na_tela":"Metas > Indicadores > Novo > campo Direcao","dados":"Direcao: crescente (o correto seria maior_melhor)","resultado_esperado":"O sistema DEVE recusar"}
   ]'::jsonb,
   'A direcao invalida e recusada. Somente as quatro direcoes previstas sao aceitas.',
   'IMPACTO SE FALHAR: uma direcao invalida deixaria o sistema sem saber se o indicador melhora '
   'subindo ou descendo — a avaliacao de atingimento sairia invertida. ORIGEM: caso CT29.'),

  (v_mod,'MIND-020','Indicadores com o mesmo nome sao aceitos','excecao','baixa','aprovado','api',
   'Verificar se o catalogo permite dois indicadores com o mesmo nome no mesmo cliente. Regra '
   'esperada: o nome deveria identificar o indicador de forma unica dentro do catalogo. Importa '
   'porque dois indicadores "Taxa de acidentes" com formulas diferentes geram ambiguidade na hora '
   'de escolher qual usar.',
   'Precisa existir um indicador cadastrado.',
   '[
     {"ordem":1,"acao":"Cadastrar um indicador","onde_na_tela":"Metas > Indicadores > Novo","dados":"Nome: Taxa de acidentes","resultado_esperado":"Cadastrado"},
     {"ordem":2,"acao":"Cadastrar outro com o MESMO nome","onde_na_tela":"Metas > Indicadores > Novo","dados":"Nome: Taxa de acidentes (repetido), formula diferente","resultado_esperado":"Idealmente recusado ou sinalizado"}
   ]'::jsonb,
   'O nome duplicado deveria ser recusado ou ao menos sinalizado. RESULTADO REAL: o banco aceita — '
   'nao ha restricao de unicidade no nome do indicador.',
   'IMPACTO: indicadores homonimos com definicoes diferentes causam confusao na escolha e '
   'impossibilitam comparar metas que usam "o mesmo" indicador. Prioridade baixa: o catalogo tende '
   'a ser pequeno e administrado por poucas pessoas. CORRECAO SUGERIDA (se for decisao do produto): '
   'indice unico em (tenant_id, lower(nome)) para indicadores ativos.'),

  -- ══ A EXPANSÃO DA TABELA METAS ══
  (v_mod,'META-030','Nivel da meta respeita a lista fechada','excecao','alta','aprovado','api',
   'Verificar que o nivel da meta so aceita os valores previstos. Regra: meta_nivel aceita '
   'estrategica, unidade, setor ou individual. Importa porque o nivel define a que camada da '
   'organizacao a meta pertence e como ela e desdobrada e aprovada.',
   'Nenhuma.',
   '[
     {"ordem":1,"acao":"Tentar criar uma meta com nivel fora da lista","onde_na_tela":"Nova Meta > campo Nivel","dados":"Nivel: departamental (o correto seria setor)","resultado_esperado":"O sistema DEVE recusar"}
   ]'::jsonb,
   'O nivel invalido e recusado. Somente os quatro niveis previstos sao aceitos.',
   'IMPACTO SE FALHAR: um nivel desconhecido quebraria o desdobramento e a logica de aprovacao, que '
   'dependem de saber a que camada a meta pertence. ORIGEM: casos CT04 a CT06.'),

  (v_mod,'META-031','Desdobramento: meta filha aponta para a meta pai','feliz','alta','aprovado','api',
   'Verificar que uma meta pode se desdobrar em outra, formando hierarquia. Regra: meta_pai_id '
   'referencia outra meta. Importa porque o desdobramento e o que liga a estrategia a execucao — '
   'uma meta estrategica se desdobra em metas de unidade, setor e individuais.',
   'Precisa existir uma meta para servir de pai.',
   '[
     {"ordem":1,"acao":"Criar a meta estrategica (a pai)","onde_na_tela":"Nova Meta","dados":"Titulo: Reduzir acidentes em 30% | Nivel: estrategica","resultado_esperado":"Meta criada"},
     {"ordem":2,"acao":"Criar uma meta de setor desdobrada dela","onde_na_tela":"Meta estrategica > Desdobrar (ou Nova Meta > Meta pai)","dados":"Titulo: Reduzir acidentes na producao | Nivel: setor | Meta pai: a estrategica","resultado_esperado":"Meta filha criada, ligada a pai"},
     {"ordem":3,"acao":"Conferir a hierarquia","onde_na_tela":"Visualizacao de desdobramento","dados":"-","resultado_esperado":"A meta de setor aparece abaixo da estrategica"}
   ]'::jsonb,
   'A meta filha referencia a meta pai. A hierarquia de desdobramento se forma.',
   'IMPACTO SE FALHAR: sem desdobramento, as metas ficam soltas e a estrategia nao se conecta a '
   'execucao. ORIGEM: caso CT44 da especificacao (meta estrategica apta a desdobramento).'),

  (v_mod,'META-032','Apagar a meta pai preserva as filhas','alternativo','alta','aprovado','api',
   'Verificar que apagar uma meta pai nao destroi as metas desdobradas dela. Regra: meta_pai_id '
   'ON DELETE SET NULL — as filhas perdem o vinculo mas sobrevivem. Importa porque cancelar uma '
   'meta estrategica nao deveria apagar todo o trabalho desdobrado nos setores.',
   'Precisa existir uma meta pai com pelo menos uma filha.',
   '[
     {"ordem":1,"acao":"Montar o desdobramento","onde_na_tela":"Metas","dados":"Meta estrategica com uma meta de setor desdobrada","resultado_esperado":"Hierarquia montada"},
     {"ordem":2,"acao":"Apagar a meta estrategica (a pai)","onde_na_tela":"Meta > Excluir","dados":"-","resultado_esperado":"Meta pai apagada"},
     {"ordem":3,"acao":"Conferir a meta de setor","onde_na_tela":"Metas","dados":"-","resultado_esperado":"A meta de setor AINDA EXISTE, agora sem meta pai"}
   ]'::jsonb,
   'A meta pai e apagada e as filhas sobrevivem, sem o vinculo. O trabalho desdobrado nao se perde.',
   'IMPACTO SE FALHAR: cancelar uma meta estrategica destruiria todas as metas de unidade, setor e '
   'individuais derivadas dela — perda de trabalho e de historico de desempenho.'),

  (v_mod,'META-033','Baseline maior que o valor alvo','excecao','media','aprovado','api',
   'Verificar se o banco aceita um baseline incoerente com o alvo. Contexto: com direcao '
   '"maior_melhor", o alvo deveria ser MAIOR que o ponto de partida (baseline); o contrario '
   'sugere erro de digitacao. Importa porque a incoerencia distorce o calculo de atingimento.',
   'Nenhuma.',
   '[
     {"ordem":1,"acao":"Criar meta com direcao maior_melhor e valores invertidos","onde_na_tela":"Nova Meta > secao Indicador","dados":"Direcao: maior_melhor | Baseline: 100 | Valor alvo: 50 (menor que o baseline)","resultado_esperado":"Idealmente alertado ou recusado"}
   ]'::jsonb,
   'A incoerencia deveria ser ao menos sinalizada. RESULTADO REAL: o banco aceita qualquer '
   'combinacao — nao ha validacao entre baseline, alvo e direcao.',
   'IMPACTO: com baseline 100, alvo 50 e direcao "maior e melhor", a meta ja nasce atingida ou o '
   'calculo de progresso sai negativo. ORIGEM: caso EC05 da especificacao. NOTA: esta e uma regra '
   'que depende da direcao — com "menor_melhor", baseline maior que o alvo e o esperado. Por isso a '
   'validacao adequada e no front ou por trigger que considere a direcao, nao um CHECK simples.'),

  (v_mod,'META-034','Data fim anterior a data inicio','excecao','alta','aprovado','api',
   'Verificar se o banco aceita um periodo de vigencia invertido. Regra: data_fim deve ser igual ou '
   'posterior a data_inicio. Importa porque um periodo invertido gera meta com vigencia impossivel, '
   'quebrando calculos de prazo e alertas.',
   'Nenhuma.',
   '[
     {"ordem":1,"acao":"Criar uma meta com o periodo invertido","onde_na_tela":"Nova Meta > campos Data Inicio e Data Fim","dados":"Data inicio: 31/12/2026 | Data fim: 01/01/2026 (anterior ao inicio)","resultado_esperado":"Idealmente recusado"}
   ]'::jsonb,
   'O periodo invertido deveria ser recusado. RESULTADO REAL: o banco aceita — nao ha CHECK entre '
   'data_inicio e data_fim.',
   'IMPACTO: meta com vigencia impossivel quebra o calculo de prazo restante, os alertas de '
   'vencimento e os relatorios por periodo. ORIGEM: casos CT19 e CT20 da especificacao. '
   'CORRECAO SUGERIDA: ALTER TABLE metas ADD CONSTRAINT metas_periodo_coerente '
   'CHECK (data_inicio IS NULL OR data_fim IS NULL OR data_inicio <= data_fim);'),

  (v_mod,'META-035','Titulo com apenas espacos em branco','excecao','media','aprovado','api',
   'Verificar se o banco aceita um titulo composto so de espacos. Regra: NOT NULL impede o titulo '
   'nulo, mas nao impede a string "   ", que e vazia na pratica. Importa porque uma meta com titulo '
   'em branco aparece vazia nas listas, driblando a obrigatoriedade.',
   'Nenhuma.',
   '[
     {"ordem":1,"acao":"Criar uma meta com titulo formado so por espacos","onde_na_tela":"Nova Meta > campo Titulo","dados":"Titulo: (tres espacos em branco) | Ano: 2026","resultado_esperado":"Idealmente recusado — conteudo vazio mascarado"}
   ]'::jsonb,
   'O titulo em branco deveria ser recusado. RESULTADO REAL: o banco aceita — NOT NULL nao alcanca '
   'strings compostas apenas de espacos.',
   'IMPACTO: metas aparecem sem titulo nas listas e paineis, mesmo com a obrigatoriedade '
   '"cumprida". ORIGEM: caso EC01 da especificacao. CORRECAO SUGERIDA: '
   'CHECK (length(trim(titulo)) > 0) — vale avaliar o mesmo padrao nos demais campos de nome '
   'obrigatorios do sistema.')

  ON CONFLICT (codigo) DO NOTHING;
END $seed$;

-- ─────────────────────────────────────────────────────────
-- ROTINAS
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_limpa_config_metas(p_tenant uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM public.metas_configuracao WHERE tenant_id = p_tenant;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_mcfg_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
        v_niveis text[]; v_ind boolean; v_obj boolean; v_min int; v_max int;
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_limpa_config_metas(v_t);
  r.passo_ordem:=1; r.passo_acao:='Criar a configuracao de metas do cliente';
  r.esperado:='Quatro niveis, indicador obrigatorio, objetivo opcional, escala 0-100';
  INSERT INTO public.metas_configuracao (tenant_id) VALUES (v_t) RETURNING id INTO v_id;
  SELECT niveis_habilitados, exigir_indicador, exigir_objetivo_estrategico, escala_min, escala_max
    INTO v_niveis, v_ind, v_obj, v_min, v_max
    FROM public.metas_configuracao WHERE id=v_id;
  IF array_length(v_niveis,1)=4 AND v_ind AND NOT v_obj AND v_min=0 AND v_max=100 THEN
    r.situacao:='passou';
    r.obtido:='Configuracao criada com os padroes: 4 niveis, indicador obrigatorio, objetivo estrategico opcional, escala 0-100.';
  ELSE
    r.situacao:='falhou';
    r.obtido:=format('Padroes inesperados: niveis=%s, exigir_indicador=%s, exigir_objetivo=%s, escala=%s-%s.',
                     array_length(v_niveis,1), v_ind, v_obj, v_min, v_max);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_mcfg_002()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid; v_niveis text[];
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_limpa_config_metas(v_t);
  r.passo_ordem:=1; r.passo_acao:='Restringir os niveis habilitados a estrategica e individual';
  r.esperado:='A restricao persiste';
  INSERT INTO public.metas_configuracao (tenant_id) VALUES (v_t) RETURNING id INTO v_id;
  UPDATE public.metas_configuracao
     SET niveis_habilitados = ARRAY['estrategica','individual'] WHERE id=v_id;
  SELECT niveis_habilitados INTO v_niveis FROM public.metas_configuracao WHERE id=v_id;
  IF array_length(v_niveis,1)=2 AND 'estrategica'=ANY(v_niveis) AND 'individual'=ANY(v_niveis) THEN
    r.situacao:='passou'; r.obtido:='Niveis restringidos a estrategica e individual, como configurado.';
  ELSE
    r.situacao:='falhou'; r.obtido:=format('Niveis gravados: %s.', v_niveis);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_mcfg_003()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid; v_obj boolean;
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_limpa_config_metas(v_t);
  r.passo_ordem:=1; r.passo_acao:='Ligar a obrigatoriedade de objetivo estrategico';
  r.esperado:='A obrigatoriedade persiste';
  INSERT INTO public.metas_configuracao (tenant_id) VALUES (v_t) RETURNING id INTO v_id;
  UPDATE public.metas_configuracao SET exigir_objetivo_estrategico = true WHERE id=v_id;
  SELECT exigir_objetivo_estrategico INTO v_obj FROM public.metas_configuracao WHERE id=v_id;
  IF v_obj THEN
    r.situacao:='passou'; r.obtido:='Obrigatoriedade de objetivo estrategico ligada e persistida.';
  ELSE
    r.situacao:='falhou'; r.obtido:='A configuracao nao persistiu.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_mcfg_020()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_limpa_config_metas(v_t);
  r.passo_ordem:=1; r.passo_acao:='Criar a configuracao do cliente';
  r.esperado:='Uma segunda configuracao para o mesmo cliente e recusada';
  INSERT INTO public.metas_configuracao (tenant_id) VALUES (v_t);
  r.passo_ordem:=2; r.passo_acao:='Tentar criar uma SEGUNDA configuracao para o mesmo cliente';
  BEGIN
    INSERT INTO public.metas_configuracao (tenant_id) VALUES (v_t);
    r.situacao:='falhou'; r.obtido:='ACEITOU duas configuracoes para o mesmo cliente — regras conflitantes.';
  EXCEPTION WHEN unique_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: cada cliente tem uma unica configuracao, como esperado.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_mcfg_021()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid; v_min int; v_max int;
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_limpa_config_metas(v_t);
  r.passo_ordem:=1; r.passo_acao:='Gravar escala de avaliacao invertida (minimo 100, maximo 0)';
  r.esperado:='Idealmente recusado — o minimo nao pode exceder o maximo';
  BEGIN
    INSERT INTO public.metas_configuracao (tenant_id, escala_min, escala_max)
    VALUES (v_t, 100, 0) RETURNING id INTO v_id;
    SELECT escala_min, escala_max INTO v_min, v_max FROM public.metas_configuracao WHERE id=v_id;
    r.situacao:='falhou';
    r.obtido:=format('O BANCO ACEITOU escala de %s a %s (invertida). Sem CHECK de coerencia — mesmo padrao de CARGO-012 e EMP-041.', v_min, v_max);
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: a escala precisa ter minimo menor que o maximo.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_mcfg_030()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_meta uuid; v_obj text;
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_limpa_config_metas(v_t);
  r.passo_ordem:=1; r.passo_acao:='Ligar exigir_objetivo_estrategico na configuracao do cliente';
  INSERT INTO public.metas_configuracao (tenant_id, exigir_objetivo_estrategico) VALUES (v_t, true);

  r.passo_ordem:=2;
  r.passo_acao:='Criar uma meta SEM objetivo estrategico, com a configuracao exigindo';
  r.esperado:='Idealmente recusado, ja que a configuracao do cliente exige o vinculo';
  BEGIN
    INSERT INTO public.metas (tenant_id, titulo, ano)
    VALUES (v_t, '[QA] Meta sem objetivo estrategico', 2026) RETURNING id INTO v_meta;
    SELECT objetivo_estrategico INTO v_obj FROM public.metas WHERE id=v_meta;
    r.situacao:='falhou';
    r.obtido:='O BANCO ACEITOU meta sem objetivo estrategico mesmo com a configuracao exigindo. A parametrizacao e aplicada so pelo front — importacao e API a ignoram.';
  EXCEPTION WHEN check_violation OR not_null_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: o banco aplica a parametrizacao do cliente.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_mind_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
        v_tipo text; v_dir text; v_form text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Cadastrar o indicador "Taxa de acidentes" no catalogo';
  r.esperado:='Tipo, direcao e formula preservados';
  INSERT INTO public.metas_indicadores (tenant_id, nome, tipo, unidade_medida, direcao, formula)
  VALUES (v_t, '[QA] Taxa de acidentes', 'quantitativo', '%', 'menor_melhor',
          '(acidentes no mes / total de colaboradores) * 100')
  RETURNING id INTO v_id;
  SELECT tipo::text, direcao::text, formula INTO v_tipo, v_dir, v_form
    FROM public.metas_indicadores WHERE id=v_id;
  IF v_tipo='quantitativo' AND v_dir='menor_melhor' AND v_form LIKE '%acidentes%' THEN
    r.situacao:='passou';
    r.obtido:='Indicador no catalogo: quantitativo, menor_melhor, com a formula preservada.';
  ELSE
    r.situacao:='falhou';
    r.obtido:=format('tipo=%s, direcao=%s, formula preservada=%s.', v_tipo, v_dir, v_form IS NOT NULL);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_mind_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar indicador com tipo "aproximado" (fora da lista)';
  r.esperado:='Recusado pelo enum';
  BEGIN
    INSERT INTO public.metas_indicadores (tenant_id, nome, tipo)
    VALUES (v_t, '[QA] Indicador Tipo Invalido', 'aproximado');
    r.situacao:='falhou'; r.obtido:='ACEITOU tipo fora da lista.';
  EXCEPTION WHEN invalid_text_representation OR check_violation THEN
    r.situacao:='passou';
    r.obtido:='Recusado: tipo so aceita quantitativo/qualitativo/percentual/financeiro/marco/hibrido.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_mind_011()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar indicador com direcao "crescente" (fora da lista)';
  r.esperado:='Recusado pelo enum';
  BEGIN
    INSERT INTO public.metas_indicadores (tenant_id, nome, direcao)
    VALUES (v_t, '[QA] Indicador Direcao Invalida', 'crescente');
    r.situacao:='falhou'; r.obtido:='ACEITOU direcao fora da lista.';
  EXCEPTION WHEN invalid_text_representation OR check_violation THEN
    r.situacao:='passou';
    r.obtido:='Recusado: direcao so aceita maior_melhor/menor_melhor/igual_melhor/faixa.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_mind_020()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_qtd int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Cadastrar dois indicadores com o mesmo nome';
  r.esperado:='Idealmente o segundo seria recusado ou sinalizado';
  INSERT INTO public.metas_indicadores (tenant_id, nome, formula)
  VALUES (v_t, '[QA] Indicador Homonimo', 'formula A');
  BEGIN
    INSERT INTO public.metas_indicadores (tenant_id, nome, formula)
    VALUES (v_t, '[QA] Indicador Homonimo', 'formula B diferente');
    SELECT count(*) INTO v_qtd FROM public.metas_indicadores
     WHERE tenant_id=v_t AND nome='[QA] Indicador Homonimo';
    r.situacao:='falhou';
    r.obtido:=format('O BANCO ACEITOU %s indicadores com o mesmo nome e formulas diferentes. Sem restricao de unicidade no catalogo.', v_qtd);
  EXCEPTION WHEN unique_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: o nome do indicador e unico no catalogo.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_meta_030()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar meta com nivel "departamental" (fora da lista)';
  r.esperado:='Recusado pelo enum';
  BEGIN
    INSERT INTO public.metas (tenant_id, titulo, ano, nivel)
    VALUES (v_t, '[QA] Meta Nivel Invalido', 2026, 'departamental');
    r.situacao:='falhou'; r.obtido:='ACEITOU nivel fora da lista.';
  EXCEPTION WHEN invalid_text_representation OR check_violation THEN
    r.situacao:='passou';
    r.obtido:='Recusado: nivel so aceita estrategica/unidade/setor/individual.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_meta_031()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_pai uuid; v_filha uuid; v_pai_da_filha uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar a meta estrategica (pai)';
  r.esperado:='A meta de setor referencia a estrategica como pai';
  INSERT INTO public.metas (tenant_id, titulo, ano, nivel)
  VALUES (v_t, '[QA] Reduzir acidentes em 30%', 2026, 'estrategica') RETURNING id INTO v_pai;
  r.passo_ordem:=2; r.passo_acao:='Criar a meta de setor desdobrada dela';
  INSERT INTO public.metas (tenant_id, titulo, ano, nivel, meta_pai_id)
  VALUES (v_t, '[QA] Reduzir acidentes na producao', 2026, 'setor', v_pai) RETURNING id INTO v_filha;
  SELECT meta_pai_id INTO v_pai_da_filha FROM public.metas WHERE id=v_filha;
  IF v_pai_da_filha = v_pai THEN
    r.situacao:='passou'; r.obtido:='Desdobramento criado: a meta de setor aponta para a estrategica.';
  ELSE
    r.situacao:='falhou'; r.obtido:='A meta filha nao referenciou a meta pai.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_meta_032()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_pai uuid; v_filha uuid; v_existe boolean; v_pai_da_filha uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Montar o desdobramento (pai e filha)';
  r.esperado:='Apagar a pai preserva a filha, sem o vinculo';
  INSERT INTO public.metas (tenant_id, titulo, ano, nivel)
  VALUES (v_t, '[QA] Estrategica Que Sera Apagada', 2026, 'estrategica') RETURNING id INTO v_pai;
  INSERT INTO public.metas (tenant_id, titulo, ano, nivel, meta_pai_id)
  VALUES (v_t, '[QA] Meta De Setor Sobrevivente', 2026, 'setor', v_pai) RETURNING id INTO v_filha;
  r.passo_ordem:=2; r.passo_acao:='Apagar a meta pai';
  DELETE FROM public.metas WHERE id=v_pai;
  r.passo_ordem:=3; r.passo_acao:='Conferir que a filha sobreviveu, sem meta pai';
  SELECT EXISTS(SELECT 1 FROM public.metas WHERE id=v_filha) INTO v_existe;
  SELECT meta_pai_id INTO v_pai_da_filha FROM public.metas WHERE id=v_filha;
  IF v_existe AND v_pai_da_filha IS NULL THEN
    r.situacao:='passou';
    r.obtido:='A meta de setor sobreviveu e ficou sem meta pai (SET NULL). O desdobramento nao foi destruido.';
  ELSE
    r.situacao:='falhou';
    r.obtido:=format('Filha existe=%s, meta_pai_id=%s.', v_existe, v_pai_da_filha);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_meta_033()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
        v_base numeric; v_alvo numeric;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1;
  r.passo_acao:='Criar meta com direcao maior_melhor, baseline 100 e alvo 50 (invertido)';
  r.esperado:='Idealmente alertado — com maior_melhor, o alvo deveria superar o baseline';
  BEGIN
    INSERT INTO public.metas (tenant_id, titulo, ano, indicador_direcao, valor_baseline, valor_alvo)
    VALUES (v_t, '[QA] Meta Baseline Invertido', 2026, 'maior_melhor', 100, 50)
    RETURNING id INTO v_id;
    SELECT valor_baseline, valor_alvo INTO v_base, v_alvo FROM public.metas WHERE id=v_id;
    r.situacao:='falhou';
    r.obtido:=format('O BANCO ACEITOU baseline %s e alvo %s com direcao "maior e melhor" — a meta ja nasce atingida. Sem validacao entre baseline, alvo e direcao.', v_base, v_alvo);
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: o banco valida a coerencia entre baseline, alvo e direcao.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_meta_034()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
        v_ini date; v_fim date;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar meta com data fim anterior a data inicio';
  r.esperado:='Idealmente recusado — periodo de vigencia impossivel';
  BEGIN
    INSERT INTO public.metas (tenant_id, titulo, ano, data_inicio, data_fim)
    VALUES (v_t, '[QA] Meta Periodo Invertido', 2026, DATE '2026-12-31', DATE '2026-01-01')
    RETURNING id INTO v_id;
    SELECT data_inicio, data_fim INTO v_ini, v_fim FROM public.metas WHERE id=v_id;
    r.situacao:='falhou';
    r.obtido:=format('O BANCO ACEITOU vigencia de %s ate %s (fim antes do inicio). Sem CHECK de coerencia entre as datas.', v_ini, v_fim);
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: a data fim precisa ser posterior ao inicio.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_meta_035()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid; v_tit text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar meta com titulo formado so por espacos em branco';
  r.esperado:='Idealmente recusado — conteudo vazio mascarado';
  BEGIN
    INSERT INTO public.metas (tenant_id, titulo, ano)
    VALUES (v_t, '   ', 2026) RETURNING id INTO v_id;
    SELECT titulo INTO v_tit FROM public.metas WHERE id=v_id;
    r.situacao:='falhou';
    r.obtido:=format('O BANCO ACEITOU titulo com %s espacos em branco. NOT NULL nao alcanca string vazia mascarada — a meta aparece sem titulo nas listas.', length(v_tit));
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: titulo precisa ter conteudo real, nao so espacos.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

-- ── Registrar ──
INSERT INTO public.qa_implementacoes (codigo, funcao_sql) VALUES
  ('MCFG-001','qa_caso_mcfg_001'),('MCFG-002','qa_caso_mcfg_002'),('MCFG-003','qa_caso_mcfg_003'),
  ('MCFG-020','qa_caso_mcfg_020'),('MCFG-021','qa_caso_mcfg_021'),('MCFG-030','qa_caso_mcfg_030'),
  ('MIND-001','qa_caso_mind_001'),('MIND-010','qa_caso_mind_010'),('MIND-011','qa_caso_mind_011'),
  ('MIND-020','qa_caso_mind_020'),
  ('META-030','qa_caso_meta_030'),('META-031','qa_caso_meta_031'),('META-032','qa_caso_meta_032'),
  ('META-033','qa_caso_meta_033'),('META-034','qa_caso_meta_034'),('META-035','qa_caso_meta_035')
ON CONFLICT (codigo) DO UPDATE SET funcao_sql=EXCLUDED.funcao_sql, ativo=true;

-- ── Rodar ──
DO $roda$ BEGIN PERFORM public.qa_rodar_bateria('manual', 'planejamento-gestao/metas'); END $roda$;

SELECT codigo, situacao::text, left(obtido, 70) AS resultado
FROM public.qa_resultados
WHERE execucao_id = (SELECT id FROM public.qa_execucoes ORDER BY iniciada_em DESC LIMIT 1)
  AND (codigo LIKE 'MCFG-%' OR codigo LIKE 'MIND-%' OR codigo IN ('META-030','META-031','META-032','META-033','META-034','META-035'))
ORDER BY (situacao='falhou') DESC, codigo;
