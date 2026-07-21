-- =========================================================
-- QA — Módulo ORGANOGRAMA DETALHADO (6 casos)
-- FECHA o bloco Estrutura Organizacional no padrao detalhado.
--
-- O organograma e uma ARVORE: nos que apontam para um pai (parent_id),
-- formando a hierarquia da empresa. O caso mais interessante e o ORG-013:
-- apagar um no do MEIO promove os filhos (SET NULL) em vez de destruir toda
-- a subarvore abaixo dele.
--
-- Padrao aprovado: objetivo (regra+porque), pre_condicoes, passos com dados
-- exatos+tela, resultado_esperado, observacoes (impacto+correcao).
-- =========================================================

DO $d$
DECLARE v_mod uuid;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos WHERE path='estrutura-organizacional/organograma';
  IF v_mod IS NULL THEN RAISE EXCEPTION 'Modulo organograma nao encontrado.'; END IF;

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar a criacao de um no do organograma (um cargo ou funcao na estrutura). Regra: um '
             || 'no tem um titulo e representa uma posicao na hierarquia. Importa porque o organograma '
             || 'desenha quem responde a quem — base para entender a cadeia de comando e responsabilidades '
             || 'de SST (quem e responsavel por cada area).',
    pre_condicoes = 'Usuario com permissao de editar a estrutura organizacional.',
    passos = '[
      {"ordem":1,"acao":"Abrir o organograma","onde_na_tela":"Menu > Estrutura Organizacional > Organograma","dados":"-","resultado_esperado":"Tela do organograma exibida"},
      {"ordem":2,"acao":"Adicionar um no","onde_na_tela":"Botao Adicionar No (ou Novo Cargo na estrutura)","dados":"Titulo: Diretor Geral","resultado_esperado":"Campo aceita o titulo"},
      {"ordem":3,"acao":"Salvar","onde_na_tela":"Confirmar/Salvar","dados":"-","resultado_esperado":"O no Diretor Geral aparece no organograma"}
    ]'::jsonb,
    resultado_esperado = 'O no Diretor Geral existe no organograma do cliente.',
    observacoes = 'IMPACTO SE FALHAR: sem criar nos, nao ha como desenhar a estrutura hierarquica — a '
                || 'cadeia de comando e as responsabilidades por area ficam indefinidas.'
  WHERE codigo='ORG-001';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que um no pode apontar para outro como PAI, formando a hierarquia. Regra: '
             || 'parent_id liga um no ao seu superior — assim se monta a arvore (ex.: Gerente responde ao '
             || 'Diretor). Importa porque a relacao pai-filho e o que transforma uma lista de cargos em um '
             || 'organograma de verdade.',
    pre_condicoes = 'Precisa existir pelo menos um no para servir de pai.',
    passos = '[
      {"ordem":1,"acao":"Criar o no superior (o pai)","onde_na_tela":"Organograma > Adicionar No","dados":"Titulo: Diretor","resultado_esperado":"No Diretor criado"},
      {"ordem":2,"acao":"Criar um no subordinado, indicando o Diretor como pai","onde_na_tela":"Adicionar No > campo Superior/Pai","dados":"Titulo: Gerente | Superior: Diretor","resultado_esperado":"O Gerente e criado abaixo do Diretor"},
      {"ordem":3,"acao":"Conferir a hierarquia","onde_na_tela":"Visualizacao do organograma","dados":"-","resultado_esperado":"O Gerente aparece ligado abaixo do Diretor na arvore"}
    ]'::jsonb,
    resultado_esperado = 'O no Gerente tem o Diretor como pai. O organograma mostra a ligacao hierarquica '
                       || 'entre eles.',
    observacoes = 'IMPACTO SE FALHAR: sem a relacao pai-filho, os cargos existem soltos, sem hierarquia — '
                || 'o organograma nao representa a cadeia de comando real.'
  WHERE codigo='ORG-002';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que um no do organograma pode referenciar um cargo existente do cadastro. '
             || 'Regra: o no pode se ligar a um cargo ja cadastrado, conectando a estrutura visual ao '
             || 'cadastro de cargos. Importa porque evita redigitar — o organograma reaproveita os cargos '
             || 'que ja existem, mantendo tudo consistente.',
    pre_condicoes = 'Precisa existir um cargo cadastrado no modulo de Cargos.',
    passos = '[
      {"ordem":1,"acao":"Adicionar um no ao organograma","onde_na_tela":"Organograma > Adicionar No","dados":"Titulo: Analista","resultado_esperado":"No criado"},
      {"ordem":2,"acao":"Ligar o no a um cargo existente","onde_na_tela":"Propriedades do no > campo Cargo","dados":"Cargo: Analista de RH (um cargo ja cadastrado)","resultado_esperado":"O no passa a referenciar o cargo"},
      {"ordem":3,"acao":"Conferir a ligacao","onde_na_tela":"Propriedades do no","dados":"-","resultado_esperado":"O no aparece vinculado ao cargo Analista de RH"}
    ]'::jsonb,
    resultado_esperado = 'O no do organograma esta ligado ao cargo Analista de RH do cadastro. A estrutura '
                       || 'visual e o cadastro de cargos ficam conectados.',
    observacoes = 'IMPACTO SE FALHAR: se o no nao pudesse referenciar um cargo, o organograma viraria uma '
                || 'estrutura paralela desconectada do cadastro — duas fontes de verdade que divergem.'
  WHERE codigo='ORG-003';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que um no sem titulo e recusado. Regra: titulo e NOT NULL. Importa porque um no '
             || 'sem titulo aparece em branco no organograma e nao representa nenhuma posicao '
             || 'identificavel.',
    pre_condicoes = 'Nenhuma.',
    passos = '[
      {"ordem":1,"acao":"Abrir o organograma e adicionar um no","onde_na_tela":"Organograma > Adicionar No","dados":"-","resultado_esperado":"Formulario do no aberto"},
      {"ordem":2,"acao":"Deixar o titulo vazio e tentar salvar","onde_na_tela":"Campo Titulo (vazio) + Salvar","dados":"Titulo: (vazio)","resultado_esperado":"O sistema DEVE recusar — titulo e obrigatorio"}
    ]'::jsonb,
    resultado_esperado = 'O no sem titulo e recusado. Nenhum no em branco entra no organograma.',
    observacoes = 'IMPACTO SE FALHAR: nos em branco poluem o organograma e nao representam posicao '
                || 'nenhuma — a estrutura fica com caixas vazias sem sentido.'
  WHERE codigo='ORG-010';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que apagar um no do MEIO da hierarquia promove os filhos, em vez de destruir '
             || 'toda a subarvore. Regra: parent_id ON DELETE SET NULL — quando o pai e apagado, os filhos '
             || 'perdem o pai (viram raiz ou orfaos) mas SOBREVIVEM. Importa porque apagar um cargo '
             || 'intermediario (ex.: um nivel de gerencia extinto) nao deveria apagar todos os '
             || 'subordinados abaixo dele.',
    pre_condicoes = 'Precisa existir uma hierarquia de 3 niveis: avo > pai > filho (para apagar o pai do '
                  || 'meio e ver o que acontece com o filho).',
    passos = '[
      {"ordem":1,"acao":"Montar uma hierarquia de 3 niveis","onde_na_tela":"Organograma","dados":"Diretor (topo) > Gerente (meio) > Analista (base), cada um filho do anterior","resultado_esperado":"Arvore de 3 niveis montada"},
      {"ordem":2,"acao":"Apagar o no do MEIO (o Gerente)","onde_na_tela":"Organograma > no Gerente > Excluir","dados":"-","resultado_esperado":"O Gerente e apagado"},
      {"ordem":3,"acao":"Conferir o que aconteceu com o Analista (o filho)","onde_na_tela":"Organograma","dados":"-","resultado_esperado":"O Analista AINDA EXISTE, agora sem o Gerente como pai (foi promovido/desassociado, nao apagado)"}
    ]'::jsonb,
    resultado_esperado = 'O no do meio (Gerente) e apagado, mas o filho (Analista) sobrevive, agora sem '
                       || 'aquele pai. A subarvore nao foi destruida — os filhos foram promovidos (SET NULL).',
    observacoes = 'IMPACTO SE FALHAR: se apagar um no do meio apagasse toda a subarvore, remover um nivel '
                || 'de gerencia extinto destruiria todos os cargos subordinados — perda catastrofica da '
                || 'estrutura. O SET NULL preserva os filhos, apenas os desconecta do pai removido.'
  WHERE codigo='ORG-013';

  UPDATE public.qa_casos_teste SET
    objetivo = 'Verificar que um no do organograma de um cliente e invisivel para outro. Regra: '
             || 'isolamento multi-tenant. Importa porque o organograma revela a estrutura interna e a '
             || 'cadeia de comando de um cliente — informacao estrategica que nao pode vazar.',
    pre_condicoes = 'Dois clientes distintos no sistema.',
    passos = '[
      {"ordem":1,"acao":"No cliente A, criar um no no organograma","onde_na_tela":"Cliente A > Organograma > Adicionar No","dados":"Titulo: Cargo Secreto do A","resultado_esperado":"No criado no cliente A"},
      {"ordem":2,"acao":"Entrar como cliente B e procurar esse no","onde_na_tela":"Cliente B > Organograma","dados":"Procurar pelo titulo do no do cliente A","resultado_esperado":"O no do cliente A NAO aparece para o cliente B"}
    ]'::jsonb,
    resultado_esperado = 'O no do cliente A e invisivel no cliente B. A estrutura organizacional de um '
                       || 'cliente nao vaza para outro.',
    observacoes = 'IMPACTO SE FALHAR: exporia a estrutura interna e a hierarquia de um cliente a outro — '
                || 'informacao estrategica sensivel. Protecao RLS por tenant.'
  WHERE codigo='ORG-022';

  RAISE NOTICE 'Modulo ORGANOGRAMA detalhado: 6 casos. Bloco Estrutura Organizacional COMPLETO no padrao.';
END $d$;

SELECT codigo, left(objetivo,46) AS objetivo, jsonb_array_length(passos) AS passos,
       (observacoes IS NOT NULL) AS impacto
FROM public.qa_casos_teste WHERE codigo LIKE 'ORG-%'
  AND modulo_id=(SELECT id FROM public.qa_modulos WHERE path='estrutura-organizacional/organograma')
ORDER BY codigo;
