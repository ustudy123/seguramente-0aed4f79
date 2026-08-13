-- =========================================================
-- QA — Admissão: casos derivados da Análise de Requisitos do módulo
-- (documento YE-DP-ADM-001, Google Doc "YE — Admissão/Pré-admissão —
-- Análise de Requisitos", data-base ago/2026).
--
-- MÉTODO: as 8 regras de negócio (RN-001..008), os 9 critérios de
-- aceite (CA-001..009), os 12 cenários de teste (seção 25) e os fluxos
-- alternativos (seção 9) foram cruzados um a um com a família
-- ADM-001..111 já registrada (23 casos). Como sempre: os casos
-- descrevem o que a LEI e o documento exigem, não o que o sistema
-- faz hoje.
--
-- JÁ COBERTO (sem caso novo; registrado para a rastreabilidade):
--   RN-001/CA-001 documentos obrigatórios ....... ADM-003/012 (checklist)
--   RN-002/CA-002 ASO antes do início / inapto .. ADM-060..063
--   RN-003/CA-003 eSocial S-2200 / S-2190 ....... ADM-090/091
--   Registro com dados legais (arts. 29/41) ..... ADM-001
--   CPF único / sem duplicidade ................. ADM-002/010/011
--   Arquivamento automático (CA-007, metade) .... ADM-100..108
--   Laudo restrito por função (seção 6) ......... ADM-107/110
--   Admissão cancelada sem sobras ............... ADM-111
--
-- SEM COBERTURA — este arquivo documenta 16 casos novos:
--   contrato: experiência ≤ 90 dias com prorrogação única (art. 445
--   §ú/451), determinado ≤ 2 anos (art. 445), intermitente por escrito
--   (art. 452-A); menor: bloqueio < 16 salvo aprendiz (CF 7º XXXIII) e
--   funções vedadas; cotas: aprendiz (art. 429) e PcD (Lei 8.213 art.
--   93) com recálculo; benefícios: opção de VT com renúncia escrita
--   (Lei 7.418); salário: piso do instrumento coletivo + igualdade
--   (Lei 14.611); checklist adaptativo por CCT (RN-008); fluxo:
--   assinatura pendente trava, admissão retroativa com justificativa,
--   ativação integrada do onboarding (CA-008), desistência com LGPD
--   (CA-009); eSocial: qualificação cadastral divergente e rejeição
--   traduzida sem duplicidade.
--
-- ESTA MIGRATION SÓ DOCUMENTA. Rotinas em leva futura.
-- =========================================================

SET lock_timeout = '10s';

DO $doc$
DECLARE v_mod uuid; v_antes int; v_depois int;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos
  WHERE path = 'estrutura-organizacional/colaboradores/admissao';
  IF v_mod IS NULL THEN RAISE EXCEPTION 'Módulo de admissão não encontrado.'; END IF;
  SELECT count(*) INTO v_antes FROM public.qa_casos_teste WHERE modulo_id = v_mod;

  INSERT INTO public.qa_casos_teste
    (modulo_id, codigo, titulo, tipo, prioridade, status, nivel,
     base_legal, objetivo, pre_condicoes, passos, resultado_esperado, observacoes)
  VALUES

  -- ══════════ A) MODALIDADE E LIMITES DO CONTRATO ══════════

  (v_mod, 'ADM-020', 'Experiência: máximo de 90 dias e uma única prorrogação',
   'negativo', 'alta', 'aprovado', 'api',
   'CLT, art. 445, parágrafo único; art. 451',
   'O contrato de experiência não pode exceder 90 dias, contada a soma dos períodos, e só admite UMA prorrogação dentro desse teto. Sistema que aceita 100 dias, ou uma segunda prorrogação, cria contrato que a Justiça converte em prazo indeterminado — com todas as verbas da conversão.',
   'Admissão em montagem com modalidade "experiência".',
   '[{"ordem":1,"acao":"Configurar experiência de 100 dias","resultado_esperado":"Recusado — limite legal de 90 dias somados"},
     {"ordem":2,"acao":"Configurar 45 + 45 dias (uma prorrogação)","resultado_esperado":"Aceito; alerta de término agendado para o fim de cada período"},
     {"ordem":3,"acao":"Tentar registrar SEGUNDA prorrogação","resultado_esperado":"Recusado — art. 451 admite prorrogação única"}]'::jsonb,
   '90 dias no total, prorrogação uma vez, nunca duas.',
   'Requisitos YE-DP-ADM-001: RN-004 / CA-004 / cenário "Experiência" (seção 25). Alimenta os alertas de término já usados pela tela Contratos de Experiência.'),

  (v_mod, 'ADM-021', 'Prazo determinado: teto de 2 anos, inclusive com prorrogação',
   'negativo', 'alta', 'aprovado', 'api',
   'CLT, art. 445, caput; art. 451',
   'Contrato por prazo determinado (fora da experiência) respeita o teto de 2 anos — a soma do período original com a prorrogação única não pode passar disso. Exceder o teto ou prorrogar duas vezes descaracteriza o prazo e o vínculo vira indeterminado por força de lei.',
   'Admissão com modalidade "prazo determinado".',
   '[{"ordem":1,"acao":"Configurar contrato determinado de 30 meses","resultado_esperado":"Recusado — teto legal de 2 anos"},
     {"ordem":2,"acao":"Configurar 18 meses e prorrogar por mais 6","resultado_esperado":"Aceito (24 meses no total, prorrogação única)"},
     {"ordem":3,"acao":"Tentar prorrogar novamente","resultado_esperado":"Recusado — descaracterizaria o prazo (art. 451)"}]'::jsonb,
   'Dois anos é o teto; prorrogação conta dentro dele.',
   'Requisitos YE-DP-ADM-001: RN-004 / base legal (arts. 445/451). Par do ADM-020, que trata a espécie "experiência".'),

  (v_mod, 'ADM-022', 'Intermitente: contrato escrito com o valor da hora garantido',
   'alternativo', 'media', 'aprovado', 'api',
   'CLT, art. 452-A (contrato de trabalho intermitente)',
   'A modalidade intermitente exige contrato ESCRITO com o valor da hora de trabalho, que não pode ser inferior ao mínimo horário nem ao dos demais empregados na mesma função. Sem essas cláusulas específicas, o contrato intermitente não se sustenta e o vínculo tende à forma comum.',
   'Admissão com modalidade "intermitente".',
   '[{"ordem":1,"acao":"Montar o contrato intermitente","resultado_esperado":"Modelo específico com valor da hora e cláusulas de convocação/aceite"},
     {"ordem":2,"acao":"Informar valor-hora abaixo do mínimo horário ou do pago à mesma função","resultado_esperado":"Recusado — piso do art. 452-A, §1º"}]'::jsonb,
   'Intermitente só por escrito e com a hora no piso.',
   'Requisitos YE-DP-ADM-001: base legal art. 452-A [OLC]/[VAL] / fluxo "Contrato intermitente" (seção 9). Cláusulas finais são [VAL] jurídico (seção 30).'),

  -- ══════════ B) TRABALHO DO MENOR ══════════

  (v_mod, 'ADM-030', 'Menor de 16 anos só entra como aprendiz, a partir dos 14',
   'negativo', 'alta', 'aprovado', 'api',
   'CF, art. 7º, XXXIII; CLT, art. 403',
   'É proibido qualquer trabalho a menores de 16 anos, salvo na condição de aprendiz a partir dos 14. A validação é pela idade NA DATA DE INÍCIO: candidato de 15 anos em contrato comum é admissão nula que o sistema não pode deixar passar; como aprendiz, exige a documentação própria (matrícula no programa).',
   'Candidatos fictícios de 15 e 17 anos em admissão.',
   '[{"ordem":1,"acao":"Admitir candidato de 15 anos em contrato comum","resultado_esperado":"Bloqueado — só na condição de aprendiz"},
     {"ordem":2,"acao":"Admitir o mesmo candidato como aprendiz","resultado_esperado":"Aceito, exigindo a documentação do programa de aprendizagem"},
     {"ordem":3,"acao":"Admitir candidato de 17 anos em contrato comum","resultado_esperado":"Aceito, com as restrições de menor sinalizadas (ADM-031)"}]'::jsonb,
   'Idade na data de início decide; 14–15 só aprendiz.',
   'Requisitos YE-DP-ADM-001: RN-005 / CA-005 / cenário "Menor/aprendiz" (seção 25).'),

  (v_mod, 'ADM-031', 'Menor de 18: vedado trabalho noturno, insalubre e perigoso',
   'negativo', 'alta', 'aprovado', 'api',
   'CF, art. 7º, XXXIII; CLT, arts. 404 e 405',
   'Admitido o menor de 18 (inclusive aprendiz), o sistema deve barrar a alocação em jornada noturna e em função/ambiente insalubre ou perigoso. A vedação é absoluta — não existe adicional que a compense — e o cruzamento é entre a idade do candidato e o cadastro de riscos da função (SST).',
   'Candidato de 17 anos; função cadastrada com risco de insalubridade e escala noturna disponível.',
   '[{"ordem":1,"acao":"Vincular o menor à função insalubre/perigosa","resultado_esperado":"Bloqueado, citando a vedação constitucional"},
     {"ordem":2,"acao":"Vincular o menor a escala com período noturno","resultado_esperado":"Bloqueado — trabalho noturno vedado ao menor"},
     {"ordem":3,"acao":"Vincular a função e turno diurnos sem riscos","resultado_esperado":"Aceito normalmente"}]'::jsonb,
   'Menor não vai para noite, insalubridade nem perigo — nunca.',
   'Requisitos YE-DP-ADM-001: RN-005 / alerta "Menor: função vedada" (seção 14). Depende do cadastro de riscos por função (integração SST, seção 17).'),

  -- ══════════ C) COTAS LEGAIS ══════════

  (v_mod, 'ADM-040', 'Cota de aprendizes: 5% a 15% das funções que demandam formação',
   'alternativo', 'media', 'aprovado', 'api',
   'CLT, art. 429; Lei 10.097/2000',
   'Estabelecimentos obrigados devem manter aprendizes entre 5% e 15% dos trabalhadores em funções que demandem formação profissional. O sistema calcula a base, o mínimo e o máximo por estabelecimento, mostra o realizado × exigido e sinaliza o risco — o enquadramento (porte/atividade) é parametrizável.',
   'Empresa fictícia com base de cálculo definida e nenhum aprendiz ativo.',
   '[{"ordem":1,"acao":"Consultar o painel de cotas do estabelecimento","resultado_esperado":"Base, mínimo (5%) e máximo (15%) calculados, com o realizado atual"},
     {"ordem":2,"acao":"Admitir um aprendiz","resultado_esperado":"O realizado da cota atualiza na conclusão da admissão"}]'::jsonb,
   'Cota calculada por estabelecimento, visível antes da autuação.',
   'Requisitos YE-DP-ADM-001: RN-006 / alerta "Cota em risco" (seção 14). Enquadramento é [RCE] — parametrização por cliente (seção 30).'),

  (v_mod, 'ADM-041', 'Cota de PcD: 2% a 5% a partir de 100 empregados, com recálculo',
   'alternativo', 'alta', 'aprovado', 'api',
   'Lei 8.213/1991, art. 93',
   'Empresa com 100 ou mais empregados deve preencher de 2% a 5% dos cargos com reabilitados ou pessoas com deficiência, por faixa de efetivo. Quando a base muda (admissões/desligamentos), a cota é RECALCULADA e o risco sinalizado — inclusive quando um desligamento derruba a empresa abaixo do exigido.',
   'Empresa fictícia com 120 empregados ativos e 2 PcD (cota exigida: 3).',
   '[{"ordem":1,"acao":"Consultar a cota com 120 ativos","resultado_esperado":"Exigido 3 (2% de 120, arredondamento para cima), realizado 2 — risco sinalizado"},
     {"ordem":2,"acao":"Alterar a base (admitir até 130 ativos)","resultado_esperado":"Cota recalculada automaticamente; alerta atualizado"}]'::jsonb,
   'Base mudou, cota recalcula, risco aparece — sem esperar fiscalização.',
   'Requisitos YE-DP-ADM-001: RN-006 / CA-006 / cenário "Cota PcD" (seção 25). Percentuais por faixa; base de cálculo é [RCE]/[DAE] (seção 30).'),

  -- ══════════ D) BENEFÍCIOS, PISO E INSTRUMENTO COLETIVO ══════════

  (v_mod, 'ADM-050', 'Vale-transporte: opção colhida na admissão, renúncia por escrito',
   'alternativo', 'media', 'aprovado', 'api',
   'Lei 7.418/1985; Decreto 10.854/2021',
   'O VT depende da OPÇÃO do empregado, informando endereço e meios de transporte; quem não quer, renuncia formalmente — e a renúncia vira termo arquivado. Descontar VT de quem renunciou, ou não ter prova da renúncia de quem depois reclama o benefício, são os dois erros que o termo evita.',
   'Coleta de admissão na etapa de benefícios.',
   '[{"ordem":1,"acao":"Candidato opta pelo VT informando trajeto/linhas","resultado_esperado":"Opção registrada; benefício e desconto (limite legal) preparados para a Folha"},
     {"ordem":2,"acao":"Candidato renuncia ao VT","resultado_esperado":"Termo de renúncia gerado, assinado e arquivado em Documentos; nenhum desconto configurado"}]'::jsonb,
   'Opção ou renúncia — sempre documentada, nunca presumida.',
   'Requisitos YE-DP-ADM-001: RN-007 / seção 12 (opção de VT) / seção 16 (termos). Percentual de desconto é parametrizável [DAE].'),

  (v_mod, 'ADM-051', 'Salário de admissão respeita o piso e a coerência interna',
   'negativo', 'alta', 'aprovado', 'api',
   'CCT/ACT da categoria (piso); CF, art. 7º, V; Lei 14.611/2023',
   'Na abertura da admissão o sistema confere o salário contra o piso do instrumento coletivo vigente para a categoria/função — abaixo do piso, bloqueia ou exige justificativa formal. E aponta incoerência com os salários praticados na mesma função (igualdade salarial, Lei 14.611), antes de virar passivo.',
   'Função com piso definido em instrumento coletivo vigente; colegas na mesma função com salários conhecidos.',
   '[{"ordem":1,"acao":"Abrir admissão com salário abaixo do piso da categoria","resultado_esperado":"Recusado (ou exige justificativa formal com trilha), citando o instrumento"},
     {"ordem":2,"acao":"Abrir admissão com salário destoante dos pares da função","resultado_esperado":"Alerta de coerência salarial para RH/Compliance, com os parâmetros da comparação"}]'::jsonb,
   'Piso é chão duro; discrepância entre pares é alerta.',
   'Requisitos YE-DP-ADM-001: RF-001 (verificação de piso na abertura) / base legal Lei 14.611 [VAL]. Depende do cadastro de instrumentos coletivos (seção 17).'),

  (v_mod, 'ADM-052', 'Checklist de documentos se adapta ao instrumento coletivo',
   'alternativo', 'media', 'aprovado', 'api',
   'CCT/ACT da categoria (exigências admissionais) [RCC]',
   'Convenções podem exigir documentos além do padrão (ex.: declaração específica, exame adicional). O checklist da coleta é uma camada parametrizável por empresa/categoria/vigência: registrada a exigência no instrumento, toda admissão daquela categoria passa a cobrá-la — sem mexer em código.',
   'Instrumento coletivo vigente com exigência de documento adicional cadastrada.',
   '[{"ordem":1,"acao":"Abrir admissão de colaborador da categoria coberta","resultado_esperado":"Checklist inclui o documento adicional exigido pelo instrumento"},
     {"ordem":2,"acao":"Abrir admissão de categoria sem a exigência","resultado_esperado":"Checklist padrão, sem o item extra"},
     {"ordem":3,"acao":"Tentar concluir a coleta sem o documento adicional","resultado_esperado":"Bloqueado como qualquer obrigatório (mesma regra do RN-001)"}]'::jsonb,
   'A convenção manda no checklist; o checklist obedece por parâmetro.',
   'Requisitos YE-DP-ADM-001: RN-008 / cenário "Regra coletiva" (seção 25). Complementa ADM-003/012 (checklist padrão).'),

  -- ══════════ E) FLUXO: ASSINATURA, RETROATIVA, ONBOARDING, DESISTÊNCIA ══════════

  (v_mod, 'ADM-070', 'Contrato e termos sem assinatura não concluem a admissão',
   'negativo', 'alta', 'aprovado', 'e2e',
   'CLT, arts. 29 e 442 (formalização); trilha de assinatura eletrônica (RNF-004)',
   'A admissão só conclui com contrato, ficha e termos ASSINADOS (candidato e empresa), cada assinatura com identidade, carimbo de tempo e integridade do documento. Concluir com assinatura pendente deixa a empresa sem a prova central do vínculo pactuado — e o arquivamento (ADM-100..) deve receber a versão assinada, não o rascunho.',
   'Admissão validada com contrato gerado e não assinado.',
   '[{"ordem":1,"acao":"Tentar concluir a admissão com o contrato pendente de assinatura","resultado_esperado":"Não conclui; pendência apontada às partes que faltam assinar"},
     {"ordem":2,"acao":"Colher as assinaturas eletrônicas","resultado_esperado":"Trilha registra signatário, data/hora e hash do documento"},
     {"ordem":3,"acao":"Concluir após assinado","resultado_esperado":"Versão ASSINADA arquivada em Documentos na pasta do colaborador"}]'::jsonb,
   'Sem assinatura não há conclusão; o que se arquiva é a versão assinada.',
   'Requisitos YE-DP-ADM-001: RF-006 / CA-007. O modelo de assinatura (plataforma/biometria) é [VAL]/[DAE] (seção 30); a trava independe do modelo.'),

  (v_mod, 'ADM-071', 'Admissão retroativa exige justificativa e acusa o eSocial em atraso',
   'excecao', 'alta', 'aprovado', 'api',
   'CLT, art. 29; eSocial S-2200 (prazo: dia anterior ao início)',
   'Data de início no passado é exceção operacional, não caminho normal: o sistema aceita SOMENTE com justificativa registrada em trilha e, como o S-2200 já está fora do prazo por definição, sinaliza o atraso e o risco de multa — sem fingir que a transmissão tardia é regular.',
   'Admissão com data de início anterior à data atual.',
   '[{"ordem":1,"acao":"Registrar admissão com início retroativo sem justificativa","resultado_esperado":"Recusado — justificativa obrigatória"},
     {"ordem":2,"acao":"Registrar com justificativa","resultado_esperado":"Aceito; trilha guarda autor, justificativa e datas"},
     {"ordem":3,"acao":"Preparar o eSocial do vínculo retroativo","resultado_esperado":"Transmissão marcada como FORA DO PRAZO, com alerta crítico e ação no Plano de Ação"}]'::jsonb,
   'Retroativa passa com rito — e o atraso do eSocial nunca fica escondido.',
   'Requisitos YE-DP-ADM-001: fluxo "Admissão retroativa" (seção 9) / RN-003. Complementa ADM-090 (o prazo em si).'),

  (v_mod, 'ADM-072', 'Conclusão ativa onboarding, Ponto, Benefícios e Folha — nas condições certas',
   'feliz', 'alta', 'aprovado', 'api',
   'Documento YE-DP-ADM-001, RF-008 / CA-008 (integração pós-admissão)',
   'Admissão concluída com eSocial aceito dispara a ativação integrada: onboarding iniciado, controle de ponto ativo desde o primeiro dia, benefícios conforme a opção e vínculo pronto para a Folha. As PRÉ-condições são a trava: cadastro completo, ASO apto e eSocial aceito — faltando qualquer uma, nada ativa.',
   'Admissão com todas as etapas cumpridas (documentos, ASO apto, contrato assinado, S-2200 aceito).',
   '[{"ordem":1,"acao":"Concluir a admissão íntegra","resultado_esperado":"Onboarding iniciado; Ponto, Benefícios e Folha ativados a partir da data de início"},
     {"ordem":2,"acao":"Tentar ativar com o eSocial ainda pendente/rejeitado","resultado_esperado":"Ativação retida; pendência apontada"},
     {"ordem":3,"acao":"Conferir o primeiro dia no Ponto","resultado_esperado":"Jornada do contrato aplicada desde o início do vínculo"}]'::jsonb,
   'Um clique de conclusão, todos os módulos alinhados — só quando tudo está pronto.',
   'Requisitos YE-DP-ADM-001: RF-008 / CA-008 / cenário "Normal" (seção 25). É a ponte com PONTO/FÉRIAS (aquisitivo nasce na admissão).'),

  (v_mod, 'ADM-073', 'Candidato não admitido: dados seguem retenção e descarte da LGPD',
   'excecao', 'alta', 'aprovado', 'api',
   'LGPD (Lei 13.709/2018), arts. 15 e 16; art. 11 (dados sensíveis)',
   'Desistência ou reprovação encerra a admissão preservando o histórico do PROCESSO, mas os dados pessoais do candidato entram na política de retenção: prazo definido, descarte/anonimização ao fim, e dados sensíveis (ASO) com tratamento mais rígido. Guardar para sempre "porque pode servir" é exatamente o que a LGPD veda.',
   'Admissão encerrada por desistência do candidato, com documentos e ASO coletados.',
   '[{"ordem":1,"acao":"Encerrar a admissão por desistência","resultado_esperado":"Processo encerrado com motivo; histórico do fluxo preservado"},
     {"ordem":2,"acao":"Consultar a situação dos dados do candidato","resultado_esperado":"Marcados com prazo de retenção da política; descarte/anonimização agendados"},
     {"ordem":3,"acao":"Vencido o prazo, conferir os dados","resultado_esperado":"Pessoais descartados/anonimizados; trilha registra o descarte sem expor o conteúdo"}]'::jsonb,
   'O processo fica na história; os dados do candidato têm prazo de validade.',
   'Requisitos YE-DP-ADM-001: CA-009 / RNF-003 / fluxo "Desistência" (seção 9). A política de prazos é [VAL] (seção 30). Complementa ADM-111 (documentos da admissão cancelada).'),

  -- ══════════ F) eSOCIAL: QUALIFICAÇÃO E REJEIÇÃO ══════════

  (v_mod, 'ADM-092', 'Divergência de qualificação cadastral é resolvida antes do envio',
   'excecao', 'alta', 'aprovado', 'api',
   'eSocial — qualificação cadastral (CPF × CNIS/dados cadastrais)',
   'CPF, nome e nascimento precisam bater com as bases do governo ANTES do S-2200 — divergência conhecida e não tratada é rejeição anunciada. A consulta de qualificação roda na validação da admissão, aponta o campo divergente em linguagem simples e trava o envio até a correção.',
   'Candidato fictício com data de nascimento divergente da base cadastral simulada.',
   '[{"ordem":1,"acao":"Rodar a validação de qualificação cadastral","resultado_esperado":"Divergência detectada, com o campo e a orientação de correção"},
     {"ordem":2,"acao":"Tentar transmitir o S-2200 com a divergência aberta","resultado_esperado":"Retido — corrige-se antes, não depois da rejeição"},
     {"ordem":3,"acao":"Corrigir o dado e revalidar","resultado_esperado":"Qualificação OK; transmissão liberada"}]'::jsonb,
   'Divergência se resolve em casa, antes de virar rejeição no governo.',
   'Requisitos YE-DP-ADM-001: fluxo "Dados divergentes" (seção 9) / RF-007 / alerta da seção 14. Complementa ADM-002 (unicidade do CPF).'),

  (v_mod, 'ADM-093', 'Rejeição do eSocial é traduzida e o reenvio não duplica o vínculo',
   'excecao', 'alta', 'aprovado', 'api',
   'eSocial — regras de retificação e recibos; boa prática de integração',
   'Retorno de rejeição do S-2200 chega em código técnico; o DP precisa da tradução (o que houve, onde corrigir, ação sugerida) e de reenvio SEGURO: corrigido o dado, o reenvio substitui/retifica — nunca cria segundo evento de admissão do mesmo vínculo. Duplicidade de S-2200 é passivo novo criado pela própria correção.',
   'Evento S-2200 rejeitado por inconsistência de dado cadastral.',
   '[{"ordem":1,"acao":"Receber a rejeição","resultado_esperado":"Explicação em linguagem simples + ação sugerida (Plano de Ação)"},
     {"ordem":2,"acao":"Corrigir e reenviar","resultado_esperado":"Evento aceito; nenhum duplicado do mesmo vínculo no ambiente"},
     {"ordem":3,"acao":"Conferir a trilha","resultado_esperado":"Rejeição, correção e recibo final encadeados"}]'::jsonb,
   'Rejeição vira instrução; reenvio vira retificação, nunca clone.',
   'Requisitos YE-DP-ADM-001: cenário "Com erro" (seção 25) / RF-007 / fila de reprocessamento (RNF-008). Espelha FERIAS-081 (mesma disciplina no S-2230).')

  ON CONFLICT (codigo) DO NOTHING;

  -- ---------------------------------------------------------
  -- Melhorias em casos existentes: referência cruzada ao documento
  -- (só acrescenta às observações, não reescreve)
  -- ---------------------------------------------------------
  UPDATE public.qa_casos_teste SET observacoes = observacoes ||
    ' Requisitos YE-DP-ADM-001: RN-001/CA-001 (documentos obrigatórios bloqueiam o avanço).'
  WHERE codigo IN ('ADM-003','ADM-012') AND position('YE-DP-ADM-001' IN observacoes) = 0;

  UPDATE public.qa_casos_teste SET observacoes = observacoes ||
    ' Requisitos YE-DP-ADM-001: RN-002/CA-002 (ASO apto antes do início; inapto impede).'
  WHERE codigo IN ('ADM-060','ADM-061','ADM-062','ADM-063') AND position('YE-DP-ADM-001' IN observacoes) = 0;

  UPDATE public.qa_casos_teste SET observacoes = observacoes ||
    ' Requisitos YE-DP-ADM-001: RN-003/CA-003 (S-2200 até o dia anterior; S-2190 em contingência) — a retroativa ganhou caso próprio (ADM-071) e a qualificação/rejeição também (ADM-092/093).'
  WHERE codigo IN ('ADM-090','ADM-091') AND position('YE-DP-ADM-001' IN observacoes) = 0;

  UPDATE public.qa_casos_teste SET observacoes = observacoes ||
    ' Requisitos YE-DP-ADM-001: seção 12 (dados do registro) e RF-005 (ficha de registro).'
  WHERE codigo = 'ADM-001' AND position('YE-DP-ADM-001' IN observacoes) = 0;

  UPDATE public.qa_casos_teste SET observacoes = observacoes ||
    ' Requisitos YE-DP-ADM-001: matriz de perfis (seção 6) — Recrutamento não vê laudo clínico detalhado.'
  WHERE codigo IN ('ADM-107','ADM-110') AND position('YE-DP-ADM-001' IN observacoes) = 0;

  UPDATE public.qa_casos_teste SET observacoes = observacoes ||
    ' Requisitos YE-DP-ADM-001: CA-009 — a retenção/descarte LGPD do candidato não admitido ganhou caso próprio (ADM-073).'
  WHERE codigo = 'ADM-111' AND position('YE-DP-ADM-001' IN observacoes) = 0;

  SELECT count(*) INTO v_depois FROM public.qa_casos_teste WHERE modulo_id = v_mod;
  RAISE NOTICE 'Admissão: % casos antes, % depois (esperado +16 na primeira execução).', v_antes, v_depois;
END $doc$;
