-- ============================================================================
-- QA — atualiza a DISPOSIÇÃO dos 6 casos de TELA do Ponto (as-built 2026-08-20)
--
-- A disposição atual desses casos foi gravada em 05/08/2026 (migration
-- 20260805140000), ANTES das ondas 2–9, com o motivo genérico "o motor de
-- apuração ainda não existe" aplicado de uma vez a todos os PONTO-%. Hoje o
-- motor existe e boa parte do apoio de banco desses casos já foi construída.
-- Esta migration corrige a disposição dos 6 casos de nível e2e (tela) para
-- refletir a AUDITORIA AS-BUILT do código React (PontoExterno, comprovante,
-- geofence, selfie), caso a caso. Não muda nenhuma rotina de teste nem o
-- resultado da bateria — só o texto de disposição mostrado no relatório.
--
-- Idempotente (UPDATE por código). Só documentação/metadado de QA.
-- ============================================================================

-- PONTO-002 — não restringe horário de marcação: JÁ ATENDIDO.
UPDATE public.qa_casos_teste SET
  disposicao        = 'comportamento_correto',
  disposicao_motivo = 'AS-BUILT 2026-08-20: a vedação legal já é cumprida. O backend '
    || 'registrar_ponto_externo NÃO tem trava de horário/janela, e a tela de marcação '
    || '(PontoExterno) não condiciona o botão à hora do dia — qualquer horário é aceito. '
    || 'Falta apenas o teste de tela automatizado (Cypress) para comprovar a regra; o '
    || 'comportamento em si está correto. Divergência de horário é item da apuração (alerta, '
    || 'nunca bloqueio).',
  disposicao_em     = now(),
  disposicao_por    = 'Desenvolvimento'
WHERE codigo = 'PONTO-002';

-- PONTO-005 — comprovante após cada batida: banco pronto, falta expor na tela.
UPDATE public.qa_casos_teste SET
  disposicao        = 'aguardando_construcao',
  disposicao_motivo = 'AS-BUILT 2026-08-20: o BANCO está pronto (onda 7 — tabela '
    || 'ponto_comprovantes, emissão com NSR+hash, prazo de 48h e a extração pelo próprio '
    || 'trabalhador; casos 380/381/359 verdes). Falta a TELA: o comprovante (pdfMarca/'
    || 'cartaoPonto) só é gerado na aba de relatórios do RH (PontoRelatoriosTab); na tela do '
    || 'trabalhador, após bater, aparece só a confirmação — sem botão de baixar o comprovante '
    || 'nem acesso às últimas 48h. Construir o acesso autônomo do trabalhador (Portaria 671).',
  disposicao_em     = now(),
  disposicao_por    = 'Desenvolvimento'
WHERE codigo = 'PONTO-005';

-- PONTO-006 — cerca registra e sinaliza, nunca bloqueia: 2 de 3 prontos.
UPDATE public.qa_casos_teste SET
  disposicao        = 'aguardando_construcao',
  disposicao_motivo = 'AS-BUILT 2026-08-20: "nunca bloqueia" ATENDIDO (a tela não trava a '
    || 'marcação por geofence — o botão não olha a cerca) e "registra" ATENDIDO (o banco grava '
    || 'latitude/longitude/dentro_cerca/geofence_ref). Falta o "sinaliza": a GeofenceConfigCard '
    || 'é só configuração do RH; o trabalhador não recebe aviso "fora da área" e não há alerta '
    || 'de fora-da-cerca na apuração. Construir apenas o sinal (badge/alerta), sem bloquear.',
  disposicao_em     = now(),
  disposicao_por    = 'Desenvolvimento'
WHERE codigo = 'PONTO-006';

-- PONTO-195 — ciência do espelho com ressalva: banco tem o campo, falta a tela.
UPDATE public.qa_casos_teste SET
  disposicao        = 'aguardando_construcao',
  disposicao_motivo = 'AS-BUILT 2026-08-20: o BANCO suporta (coluna ponto_espelhos.ressalva_texto '
    || 'existe e a onda 6 já bloqueia o fechamento sem ciência — caso 387 verde). Falta a TELA '
    || 'por inteiro: não existe nenhuma interface de ciência/ressalva no módulo (busca por '
    || 'ciência/ressalva/concordar/discordar não achou nada no ponto). O trabalhador não tem '
    || 'onde dar ciência do espelho nem registrar discordância. É a maior das seis telas.',
  disposicao_em     = now(),
  disposicao_por    = 'Desenvolvimento'
WHERE codigo = 'PONTO-195';

-- PONTO-254 — selfie é dado comum até haver verificação facial: decisão de produto.
UPDATE public.qa_casos_teste SET
  disposicao        = 'decisao_de_produto',
  disposicao_motivo = 'AS-BUILT 2026-08-20: não há verificação facial em lugar nenhum — a selfie '
    || 'é capturada e guardada como foto. Ou seja, hoje ela É dado comum de fato (estado '
    || 'correto). O que falta é DECISÃO de produto/LGPD: classificar e avisar explicitamente que '
    || 'a selfie é dado comum enquanto não houver biometria, e definir o gatilho que a '
    || 'reclassificaria como dado sensível (art. 5º, II / art. 11 da LGPD) se um dia entrar '
    || 'reconhecimento facial. Sem essa definição, não há o que construir na tela.',
  disposicao_em     = now(),
  disposicao_por    = 'Desenvolvimento'
WHERE codigo = 'PONTO-254';

-- PONTO-363 — aviso de tratamento na tela de marcação: decisão de conteúdo + tela.
UPDATE public.qa_casos_teste SET
  disposicao        = 'decisao_de_produto',
  disposicao_motivo = 'AS-BUILT 2026-08-20: a tela (PontoExterno) tem só um rodapé mínimo '
    || '("Geolocalização e horário capturados automaticamente • Dados protegidos"): diz O QUE, '
    || 'mas não POR QUÊ (finalidade), não é destacado e não linka política de privacidade — não '
    || 'cumpre um aviso de tratamento LGPD (arts. 9º e 18). Depende de DECISÃO de conteúdo '
    || '(texto do aviso, finalidades, link da política) e então da construção do aviso visível '
    || 'e acessível na tela de marcação.',
  disposicao_em     = now(),
  disposicao_por    = 'Desenvolvimento'
WHERE codigo = 'PONTO-363';
