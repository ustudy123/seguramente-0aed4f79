-- =====================================================================
-- Os 127 testes de tela que ja existiam viram casos documentados
--
-- Ate aqui a pasta cypress/e2e era um conjunto de testes que ninguem
-- via: rodavam (quando rodavam) fora do catalogo de QA, e o painel nao
-- sabia da existencia deles. Do outro lado, 92 casos marcados 'e2e'
-- esperavam spec que nunca chegou. Os dois lados nao se tocavam.
--
-- Esta migration documenta o lado que ja existe: um caso por it(), com
-- o prefixo TELA- (nenhuma familia do catalogo usa esse prefixo), mais
-- a linha em qa_cobertura_e2e que liga caso <-> teste. A partir daqui a
-- corrida do Cypress cai no relatorio com codigo, e qa_cobertura mostra
-- 'coberto por teste de tela' em vez de 'nao implementado'.
--
-- Os titulos sao os titulos reais dos it(), extraidos dos arquivos —
-- e por eles que a ponte casa o resultado. Renomear um it() sem mexer
-- aqui quebra a ligacao; a funcao qa_registrar_bateria_e2e denuncia
-- isso contando os testes sem caso na observacao da execucao.
--
-- Idempotente: rodar duas vezes nao duplica nem quebra.
-- =====================================================================

-- ─────────────────────────────────────────────────────────
-- psicossocial.cy.ts — 50 teste(s) -> saude-seguranca/psicossocial
-- ─────────────────────────────────────────────────────────
INSERT INTO public.qa_casos_teste
  (modulo_id, codigo, titulo, tipo, prioridade, status, nivel, objetivo, observacoes)
SELECT m.id, v.codigo, v.titulo,
       v.tipo::public.qa_caso_tipo,
       'media'::public.qa_prioridade,
       'aprovado'::public.qa_caso_status,
       'e2e',
       'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.',
       'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.'
FROM public.qa_modulos m
CROSS JOIN (VALUES
    ('TELA-PSICO-001', 'TC-01: Criar campanha psicossocial com dados válidos', 'feliz'),
    ('TELA-PSICO-002', 'TC-02: Assistente de seleção de instrumento é exibido', 'alternativo'),
    ('TELA-PSICO-003', 'TC-03: Bloquear criação sem Setor + Função', 'negativo'),
    ('TELA-PSICO-004', 'TC-04: Autocomplete de Setor + Função funciona', 'feliz'),
    ('TELA-PSICO-005', 'TC-05: Cadastrar novo Setor/Função inexistente', 'feliz'),
    ('TELA-PSICO-006', 'TC-06: Múltiplos pares Setor + Função', 'feliz'),
    ('TELA-PSICO-007', 'TC-07: Distribuição gera link, QR Code e mensagens', 'feliz'),
    ('TELA-PSICO-008', 'TC-08: Acesso ao questionário sem login', 'negativo'),
    ('TELA-PSICO-009', 'TC-09: Tela de verificação WhatsApp é exibida', 'alternativo'),
    ('TELA-PSICO-010', 'TC-10: Código WhatsApp inválido é rejeitado', 'negativo'),
    ('TELA-PSICO-011', 'TC-11: Duplicidade de respostas é bloqueada', 'negativo'),
    ('TELA-PSICO-012', 'TC-12: Anonimato das respostas', 'feliz'),
    ('TELA-PSICO-013', 'TC-13: Resultados exibidos com 5+ respondentes', 'alternativo'),
    ('TELA-PSICO-014', 'TC-14: Agrupamento automático por privacidade', 'alternativo'),
    ('TELA-PSICO-015', 'TC-15: Mensagem de dados insuficientes para confidencialidade', 'feliz'),
    ('TELA-PSICO-016', 'TC-16: Cálculo de IPS ao encerrar campanha', 'alternativo'),
    ('TELA-PSICO-017', 'TC-17: Classificação IPS por faixas', 'feliz'),
    ('TELA-PSICO-018', 'TC-18: Gráfico radar e análise interpretativa', 'feliz'),
    ('TELA-PSICO-019', 'TC-19: Exportação de relatório PDF', 'feliz'),
    ('TELA-PSICO-020', 'TC-20: Integração com GRO', 'feliz'),
    ('TELA-PSICO-021', 'TC-21: Vínculo risco x Setor + Função no GRO', 'feliz'),
    ('TELA-PSICO-022', 'TC-22: Plano 5W2H para risco Alto — 60 dias', 'feliz'),
    ('TELA-PSICO-023', 'TC-23: Plano 5W2H para risco Crítico — 30 dias', 'feliz'),
    ('TELA-PSICO-024', 'TC-24: Bloquear arquivamento de risco Alto sem plano', 'negativo'),
    ('TELA-PSICO-025', 'TC-25: Bloquear arquivamento de risco Crítico sem plano', 'negativo'),
    ('TELA-PSICO-026', 'TC-26: Recomendação de AET quando IPS < 65', 'feliz'),
    ('TELA-PSICO-027', 'TC-27: AET obrigatória quando IPS < 50', 'negativo'),
    ('TELA-PSICO-028', 'TC-28: Recomendação AET por múltiplos fatores críticos', 'feliz'),
    ('TELA-PSICO-029', 'TC-29: AET por recorrência de riscos', 'feliz'),
    ('TELA-PSICO-030', 'TC-30: Dados psicossociais no módulo Ergonomia', 'feliz'),
    ('TELA-PSICO-031', 'TC-31: Reavaliação exigida após ação concluída', 'feliz'),
    ('TELA-PSICO-032', 'TC-32: Histórico de evolução do IPS', 'feliz'),
    ('TELA-PSICO-033', 'TC-33: Inventário PGR consolidado', 'feliz'),
    ('TELA-PSICO-034', 'TC-34: Exportação PDF do inventário PGR', 'feliz'),
    ('TELA-PSICO-035', 'TC-35: Bloquear data fim anterior à data início', 'negativo'),
    ('TELA-PSICO-036', 'TC-36: Campanha expirada sem respostas não gera erro', 'negativo'),
    ('TELA-PSICO-037', 'TC-37: Grupo com 5 respondentes — resultado exibido', 'alternativo'),
    ('TELA-PSICO-038', 'TC-38: Fallback para nível setor com 4 respondentes na função', 'feliz'),
    ('TELA-PSICO-039', 'TC-39: Empresa pequena — agrupamento seguro', 'alternativo'),
    ('TELA-PSICO-040', 'TC-40: Link inativo após encerramento da campanha', 'feliz'),
    ('TELA-PSICO-041', 'TC-41: Erro controlado na falha de envio WhatsApp', 'negativo'),
    ('TELA-PSICO-042', 'TC-42: Encerramento manual antecipado permitido', 'feliz'),
    ('TELA-PSICO-043', 'TC-43: Impedir duplicidade de pares Setor + Função', 'negativo'),
    ('TELA-PSICO-044', 'TC-44: Risco Alto/Crítico sem 5W2H é defeito crítico', 'feliz'),
    ('TELA-PSICO-045', 'TC-45: IPS 65 classificado como Estável', 'feliz'),
    ('TELA-PSICO-046', 'TC-46: IPS 50 classificado como Atenção', 'feliz'),
    ('TELA-PSICO-047', 'TC-47: PDF mantém acentuação e caracteres especiais', 'feliz'),
    ('TELA-PSICO-048', 'TC-48: Acesso negado para usuário sem permissão', 'negativo'),
    ('TELA-PSICO-049', 'TC-EXTRA: Guia Rápido abre e fecha corretamente', 'alternativo'),
    ('TELA-PSICO-050', 'TC-EXTRA: Tabs do dashboard carregam sem erro', 'feliz')
) AS v(codigo, titulo, tipo)
WHERE m.path = 'saude-seguranca/psicossocial'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.qa_cobertura_e2e (codigo, spec, teste)
SELECT v.codigo, 'cypress/e2e/psicossocial.cy.ts', v.teste
FROM (VALUES
    ('TELA-PSICO-001', 'TC-01: Criar campanha psicossocial com dados válidos'),
    ('TELA-PSICO-002', 'TC-02: Assistente de seleção de instrumento é exibido'),
    ('TELA-PSICO-003', 'TC-03: Bloquear criação sem Setor + Função'),
    ('TELA-PSICO-004', 'TC-04: Autocomplete de Setor + Função funciona'),
    ('TELA-PSICO-005', 'TC-05: Cadastrar novo Setor/Função inexistente'),
    ('TELA-PSICO-006', 'TC-06: Múltiplos pares Setor + Função'),
    ('TELA-PSICO-007', 'TC-07: Distribuição gera link, QR Code e mensagens'),
    ('TELA-PSICO-008', 'TC-08: Acesso ao questionário sem login'),
    ('TELA-PSICO-009', 'TC-09: Tela de verificação WhatsApp é exibida'),
    ('TELA-PSICO-010', 'TC-10: Código WhatsApp inválido é rejeitado'),
    ('TELA-PSICO-011', 'TC-11: Duplicidade de respostas é bloqueada'),
    ('TELA-PSICO-012', 'TC-12: Anonimato das respostas'),
    ('TELA-PSICO-013', 'TC-13: Resultados exibidos com 5+ respondentes'),
    ('TELA-PSICO-014', 'TC-14: Agrupamento automático por privacidade'),
    ('TELA-PSICO-015', 'TC-15: Mensagem de dados insuficientes para confidencialidade'),
    ('TELA-PSICO-016', 'TC-16: Cálculo de IPS ao encerrar campanha'),
    ('TELA-PSICO-017', 'TC-17: Classificação IPS por faixas'),
    ('TELA-PSICO-018', 'TC-18: Gráfico radar e análise interpretativa'),
    ('TELA-PSICO-019', 'TC-19: Exportação de relatório PDF'),
    ('TELA-PSICO-020', 'TC-20: Integração com GRO'),
    ('TELA-PSICO-021', 'TC-21: Vínculo risco x Setor + Função no GRO'),
    ('TELA-PSICO-022', 'TC-22: Plano 5W2H para risco Alto — 60 dias'),
    ('TELA-PSICO-023', 'TC-23: Plano 5W2H para risco Crítico — 30 dias'),
    ('TELA-PSICO-024', 'TC-24: Bloquear arquivamento de risco Alto sem plano'),
    ('TELA-PSICO-025', 'TC-25: Bloquear arquivamento de risco Crítico sem plano'),
    ('TELA-PSICO-026', 'TC-26: Recomendação de AET quando IPS < 65'),
    ('TELA-PSICO-027', 'TC-27: AET obrigatória quando IPS < 50'),
    ('TELA-PSICO-028', 'TC-28: Recomendação AET por múltiplos fatores críticos'),
    ('TELA-PSICO-029', 'TC-29: AET por recorrência de riscos'),
    ('TELA-PSICO-030', 'TC-30: Dados psicossociais no módulo Ergonomia'),
    ('TELA-PSICO-031', 'TC-31: Reavaliação exigida após ação concluída'),
    ('TELA-PSICO-032', 'TC-32: Histórico de evolução do IPS'),
    ('TELA-PSICO-033', 'TC-33: Inventário PGR consolidado'),
    ('TELA-PSICO-034', 'TC-34: Exportação PDF do inventário PGR'),
    ('TELA-PSICO-035', 'TC-35: Bloquear data fim anterior à data início'),
    ('TELA-PSICO-036', 'TC-36: Campanha expirada sem respostas não gera erro'),
    ('TELA-PSICO-037', 'TC-37: Grupo com 5 respondentes — resultado exibido'),
    ('TELA-PSICO-038', 'TC-38: Fallback para nível setor com 4 respondentes na função'),
    ('TELA-PSICO-039', 'TC-39: Empresa pequena — agrupamento seguro'),
    ('TELA-PSICO-040', 'TC-40: Link inativo após encerramento da campanha'),
    ('TELA-PSICO-041', 'TC-41: Erro controlado na falha de envio WhatsApp'),
    ('TELA-PSICO-042', 'TC-42: Encerramento manual antecipado permitido'),
    ('TELA-PSICO-043', 'TC-43: Impedir duplicidade de pares Setor + Função'),
    ('TELA-PSICO-044', 'TC-44: Risco Alto/Crítico sem 5W2H é defeito crítico'),
    ('TELA-PSICO-045', 'TC-45: IPS 65 classificado como Estável'),
    ('TELA-PSICO-046', 'TC-46: IPS 50 classificado como Atenção'),
    ('TELA-PSICO-047', 'TC-47: PDF mantém acentuação e caracteres especiais'),
    ('TELA-PSICO-048', 'TC-48: Acesso negado para usuário sem permissão'),
    ('TELA-PSICO-049', 'TC-EXTRA: Guia Rápido abre e fecha corretamente'),
    ('TELA-PSICO-050', 'TC-EXTRA: Tabs do dashboard carregam sem erro')
) AS v(codigo, teste)
WHERE EXISTS (SELECT 1 FROM public.qa_casos_teste c WHERE c.codigo = v.codigo)
ON CONFLICT (codigo) DO UPDATE
  SET spec = EXCLUDED.spec, teste = EXCLUDED.teste, ativo = true;

-- ─────────────────────────────────────────────────────────
-- epi.cy.ts — 48 teste(s) -> saude-ocupacional/epi
-- ─────────────────────────────────────────────────────────
INSERT INTO public.qa_casos_teste
  (modulo_id, codigo, titulo, tipo, prioridade, status, nivel, objetivo, observacoes)
SELECT m.id, v.codigo, v.titulo,
       v.tipo::public.qa_caso_tipo,
       'media'::public.qa_prioridade,
       'aprovado'::public.qa_caso_status,
       'e2e',
       'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.',
       'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.'
FROM public.qa_modulos m
CROSS JOIN (VALUES
    ('TELA-EPI-001', 'CT-01: Cadastrar tipo de EPI com todos os campos obrigatórios', 'negativo'),
    ('TELA-EPI-002', 'CT-02: Bloquear cadastro de EPI sem CA', 'negativo'),
    ('TELA-EPI-003', 'CT-03: Bloquear cadastro de EPI com validade de CA inválida', 'negativo'),
    ('TELA-EPI-004', 'CT-04: Permitir cadastro com categoria padrão', 'feliz'),
    ('TELA-EPI-005', 'CT-05: Permitir cadastro com categoria personalizada', 'feliz'),
    ('TELA-EPI-006', 'CT-06: Registrar entrada manual no estoque', 'feliz'),
    ('TELA-EPI-007', 'CT-07: Registrar entrada por importação de XML NF-e', 'feliz'),
    ('TELA-EPI-008', 'CT-08: Validar composição do local em dois níveis', 'alternativo'),
    ('TELA-EPI-009', 'CT-09: Registrar entrega de EPI ao colaborador (wizard visível)', 'feliz'),
    ('TELA-EPI-010', 'CT-10: Wizard de entrega possui etapa de assinatura', 'feliz'),
    ('TELA-EPI-011', 'CT-11: Aba de histórico existe e registra movimentações', 'feliz'),
    ('TELA-EPI-012', 'CT-12: Sistema valida saldo antes da entrega', 'alternativo'),
    ('TELA-EPI-013', 'CT-13: Sistema bloqueia entrega com CA vencido', 'negativo'),
    ('TELA-EPI-014', 'CT-14: Botão/modal de devolução existe na lista de entregas', 'alternativo'),
    ('TELA-EPI-015', 'CT-15: Modal de devolução oferece destino Manutenção', 'feliz'),
    ('TELA-EPI-016', 'CT-16: Modal de devolução oferece destino Descarte', 'feliz'),
    ('TELA-EPI-017', 'CT-17: Devolução exige campo de observação', 'feliz'),
    ('TELA-EPI-018', 'CT-18: Aba de alertas exibe alertas de CA vencido', 'alternativo'),
    ('TELA-EPI-019', 'CT-19: Aba de alertas detecta estoque baixo', 'feliz'),
    ('TELA-EPI-020', 'CT-20: Alertas incluem EPIs próximos do vencimento', 'feliz'),
    ('TELA-EPI-021', 'CT-21: Alertas incluem atraso de troca', 'feliz'),
    ('TELA-EPI-022', 'CT-22: Dashboard de saldo por local é exibido', 'alternativo'),
    ('TELA-EPI-023', 'CT-23: Formulário de transferência está disponível', 'feliz'),
    ('TELA-EPI-024', 'CT-24: Aba Matriz de proteção é acessível', 'feliz'),
    ('TELA-EPI-025', 'CT-25: Matriz identifica pendências de EPI', 'feliz'),
    ('TELA-EPI-026', 'CT-26: Wizard de entrega acessa dados da matriz', 'feliz'),
    ('TELA-EPI-027', 'CT-27: Histórico de movimentações possui dados tabulares', 'feliz'),
    ('TELA-EPI-028', 'CT-28: Aba de auditoria IA está acessível', 'feliz'),
    ('TELA-EPI-029', 'CT-29: Wizard gera comprovante com assinatura', 'feliz'),
    ('TELA-EPI-030', 'CT-30: Rastreabilidade via histórico de movimentações', 'feliz'),
    ('TELA-EPI-031', 'CT-31: Matriz evidencia gaps de fornecimento por função', 'feliz'),
    ('TELA-EPI-032', 'CT-32: Entrega valida CA e rastreabilidade', 'alternativo'),
    ('TELA-EPI-033', 'CT-33: Registro formal de entrega com aceite documentado', 'feliz'),
    ('TELA-EPI-034', 'CT-34: Periodicidade de troca gera alertas', 'feliz'),
    ('TELA-EPI-035', 'CT-35: Matriz exibe EPIs obrigatórios por função', 'negativo'),
    ('TELA-EPI-036', 'CT-36: CA duplicado é bloqueado no cadastro', 'negativo'),
    ('TELA-EPI-037', 'CT-37: Entrada com quantidade inválida é bloqueada', 'negativo'),
    ('TELA-EPI-038', 'CT-38: Entrega com quantidade zero é bloqueada', 'negativo'),
    ('TELA-EPI-039', 'CT-39: Colaborador inativo é bloqueado na entrega', 'negativo'),
    ('TELA-EPI-040', 'CT-40: Devolução só disponível para entregas ativas', 'feliz'),
    ('TELA-EPI-041', 'CT-41: Destino Estoque requer estado compatível', 'feliz'),
    ('TELA-EPI-042', 'CT-42: Toda alteração de saldo gera movimentação', 'feliz'),
    ('TELA-EPI-043', 'CT-43: Sistema trata EPIs sem estoque mínimo configurado', 'feliz'),
    ('TELA-EPI-044', 'CT-44: Sistema sinaliza funções sem matriz definida', 'feliz'),
    ('TELA-EPI-045', 'CT-45: XML inválido é rejeitado na importação', 'negativo'),
    ('TELA-EPI-046', 'CT-46: Entrega incompleta não gera baixa no estoque', 'negativo'),
    ('TELA-EPI-047', 'CT-47: Controle de concorrência impede saldo negativo', 'negativo'),
    ('TELA-EPI-048', 'CT-48: Alerta preventivo sem bloqueio para EPI próximo do vencimento', 'negativo')
) AS v(codigo, titulo, tipo)
WHERE m.path = 'saude-ocupacional/epi'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.qa_cobertura_e2e (codigo, spec, teste)
SELECT v.codigo, 'cypress/e2e/epi.cy.ts', v.teste
FROM (VALUES
    ('TELA-EPI-001', 'CT-01: Cadastrar tipo de EPI com todos os campos obrigatórios'),
    ('TELA-EPI-002', 'CT-02: Bloquear cadastro de EPI sem CA'),
    ('TELA-EPI-003', 'CT-03: Bloquear cadastro de EPI com validade de CA inválida'),
    ('TELA-EPI-004', 'CT-04: Permitir cadastro com categoria padrão'),
    ('TELA-EPI-005', 'CT-05: Permitir cadastro com categoria personalizada'),
    ('TELA-EPI-006', 'CT-06: Registrar entrada manual no estoque'),
    ('TELA-EPI-007', 'CT-07: Registrar entrada por importação de XML NF-e'),
    ('TELA-EPI-008', 'CT-08: Validar composição do local em dois níveis'),
    ('TELA-EPI-009', 'CT-09: Registrar entrega de EPI ao colaborador (wizard visível)'),
    ('TELA-EPI-010', 'CT-10: Wizard de entrega possui etapa de assinatura'),
    ('TELA-EPI-011', 'CT-11: Aba de histórico existe e registra movimentações'),
    ('TELA-EPI-012', 'CT-12: Sistema valida saldo antes da entrega'),
    ('TELA-EPI-013', 'CT-13: Sistema bloqueia entrega com CA vencido'),
    ('TELA-EPI-014', 'CT-14: Botão/modal de devolução existe na lista de entregas'),
    ('TELA-EPI-015', 'CT-15: Modal de devolução oferece destino Manutenção'),
    ('TELA-EPI-016', 'CT-16: Modal de devolução oferece destino Descarte'),
    ('TELA-EPI-017', 'CT-17: Devolução exige campo de observação'),
    ('TELA-EPI-018', 'CT-18: Aba de alertas exibe alertas de CA vencido'),
    ('TELA-EPI-019', 'CT-19: Aba de alertas detecta estoque baixo'),
    ('TELA-EPI-020', 'CT-20: Alertas incluem EPIs próximos do vencimento'),
    ('TELA-EPI-021', 'CT-21: Alertas incluem atraso de troca'),
    ('TELA-EPI-022', 'CT-22: Dashboard de saldo por local é exibido'),
    ('TELA-EPI-023', 'CT-23: Formulário de transferência está disponível'),
    ('TELA-EPI-024', 'CT-24: Aba Matriz de proteção é acessível'),
    ('TELA-EPI-025', 'CT-25: Matriz identifica pendências de EPI'),
    ('TELA-EPI-026', 'CT-26: Wizard de entrega acessa dados da matriz'),
    ('TELA-EPI-027', 'CT-27: Histórico de movimentações possui dados tabulares'),
    ('TELA-EPI-028', 'CT-28: Aba de auditoria IA está acessível'),
    ('TELA-EPI-029', 'CT-29: Wizard gera comprovante com assinatura'),
    ('TELA-EPI-030', 'CT-30: Rastreabilidade via histórico de movimentações'),
    ('TELA-EPI-031', 'CT-31: Matriz evidencia gaps de fornecimento por função'),
    ('TELA-EPI-032', 'CT-32: Entrega valida CA e rastreabilidade'),
    ('TELA-EPI-033', 'CT-33: Registro formal de entrega com aceite documentado'),
    ('TELA-EPI-034', 'CT-34: Periodicidade de troca gera alertas'),
    ('TELA-EPI-035', 'CT-35: Matriz exibe EPIs obrigatórios por função'),
    ('TELA-EPI-036', 'CT-36: CA duplicado é bloqueado no cadastro'),
    ('TELA-EPI-037', 'CT-37: Entrada com quantidade inválida é bloqueada'),
    ('TELA-EPI-038', 'CT-38: Entrega com quantidade zero é bloqueada'),
    ('TELA-EPI-039', 'CT-39: Colaborador inativo é bloqueado na entrega'),
    ('TELA-EPI-040', 'CT-40: Devolução só disponível para entregas ativas'),
    ('TELA-EPI-041', 'CT-41: Destino Estoque requer estado compatível'),
    ('TELA-EPI-042', 'CT-42: Toda alteração de saldo gera movimentação'),
    ('TELA-EPI-043', 'CT-43: Sistema trata EPIs sem estoque mínimo configurado'),
    ('TELA-EPI-044', 'CT-44: Sistema sinaliza funções sem matriz definida'),
    ('TELA-EPI-045', 'CT-45: XML inválido é rejeitado na importação'),
    ('TELA-EPI-046', 'CT-46: Entrega incompleta não gera baixa no estoque'),
    ('TELA-EPI-047', 'CT-47: Controle de concorrência impede saldo negativo'),
    ('TELA-EPI-048', 'CT-48: Alerta preventivo sem bloqueio para EPI próximo do vencimento')
) AS v(codigo, teste)
WHERE EXISTS (SELECT 1 FROM public.qa_casos_teste c WHERE c.codigo = v.codigo)
ON CONFLICT (codigo) DO UPDATE
  SET spec = EXCLUDED.spec, teste = EXCLUDED.teste, ativo = true;

-- ─────────────────────────────────────────────────────────
-- incidentes-acidentes.cy.ts — 9 teste(s) -> saude-seguranca/incidentes-acidentes
-- ─────────────────────────────────────────────────────────
INSERT INTO public.qa_casos_teste
  (modulo_id, codigo, titulo, tipo, prioridade, status, nivel, objetivo, observacoes)
SELECT m.id, v.codigo, v.titulo,
       v.tipo::public.qa_caso_tipo,
       'media'::public.qa_prioridade,
       'aprovado'::public.qa_caso_status,
       'e2e',
       'Teste de tela ja existente em cypress/e2e/incidentes-acidentes.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.',
       'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.'
FROM public.qa_modulos m
CROSS JOIN (VALUES
    ('TELA-INC-001', 'carrega o módulo e todas as abas principais', 'feliz'),
    ('TELA-INC-002', 'aplica filtros da aba ocorrências', 'alternativo'),
    ('TELA-INC-003', 'cadastra um incidente com colaborador manual', 'feliz'),
    ('TELA-INC-004', 'cadastra um acidente com CAT emitida', 'feliz'),
    ('TELA-INC-005', 'cadastra um acidente sem CAT emitida', 'feliz'),
    ('TELA-INC-006', 'abre detalhes por linha, volta e usa ações do detalhe', 'alternativo'),
    ('TELA-INC-007', 'abre edição pela tabela', 'alternativo'),
    ('TELA-INC-008', 'acessa a aba pirâmide, muda filtros e abre camadas', 'alternativo'),
    ('TELA-INC-009', 'abre o guia rápido', 'alternativo')
) AS v(codigo, titulo, tipo)
WHERE m.path = 'saude-seguranca/incidentes-acidentes'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.qa_cobertura_e2e (codigo, spec, teste)
SELECT v.codigo, 'cypress/e2e/incidentes-acidentes.cy.ts', v.teste
FROM (VALUES
    ('TELA-INC-001', 'carrega o módulo e todas as abas principais'),
    ('TELA-INC-002', 'aplica filtros da aba ocorrências'),
    ('TELA-INC-003', 'cadastra um incidente com colaborador manual'),
    ('TELA-INC-004', 'cadastra um acidente com CAT emitida'),
    ('TELA-INC-005', 'cadastra um acidente sem CAT emitida'),
    ('TELA-INC-006', 'abre detalhes por linha, volta e usa ações do detalhe'),
    ('TELA-INC-007', 'abre edição pela tabela'),
    ('TELA-INC-008', 'acessa a aba pirâmide, muda filtros e abre camadas'),
    ('TELA-INC-009', 'abre o guia rápido')
) AS v(codigo, teste)
WHERE EXISTS (SELECT 1 FROM public.qa_casos_teste c WHERE c.codigo = v.codigo)
ON CONFLICT (codigo) DO UPDATE
  SET spec = EXCLUDED.spec, teste = EXCLUDED.teste, ativo = true;

-- ─────────────────────────────────────────────────────────
-- swot.cy.ts — 19 teste(s) -> planejamento-gestao/planejamento-estrategico
-- ─────────────────────────────────────────────────────────
INSERT INTO public.qa_casos_teste
  (modulo_id, codigo, titulo, tipo, prioridade, status, nivel, objetivo, observacoes)
SELECT m.id, v.codigo, v.titulo,
       v.tipo::public.qa_caso_tipo,
       'media'::public.qa_prioridade,
       'aprovado'::public.qa_caso_status,
       'e2e',
       'Teste de tela ja existente em cypress/e2e/swot.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.',
       'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.'
FROM public.qa_modulos m
CROSS JOIN (VALUES
    ('TELA-SWOT-001', 'CT-SWOT-001 — Listar SWOTs do escopo', 'alternativo'),
    ('TELA-SWOT-002', 'CT-SWOT-002 — Estado vazio', 'negativo'),
    ('TELA-SWOT-003', 'CT-SWOT-003 — Troca de escopo', 'feliz'),
    ('TELA-SWOT-004', 'CT-SWOT-004 — Abrir SWOT clicando no card', 'feliz'),
    ('TELA-SWOT-005', 'CT-SWOT-010 — Criar SWOT (caminho feliz)', 'feliz'),
    ('TELA-SWOT-006', 'CT-SWOT-011 — Título obrigatório', 'negativo'),
    ('TELA-SWOT-007', 'CT-SWOT-012 — Período inválido (formato)', 'negativo'),
    ('TELA-SWOT-008', 'CT-SWOT-013 — Fechar modal com dados preenchidos', 'feliz'),
    ('TELA-SWOT-009', 'CT-SWOT-014 — Duplo clique no Criar Análise', 'feliz'),
    ('TELA-SWOT-010', 'CT-SWOT-020 — Adicionar item em Força', 'feliz'),
    ('TELA-SWOT-011', 'CT-SWOT-021 — Adicionar item em cada quadrante', 'feliz'),
    ('TELA-SWOT-012', 'CT-SWOT-022 — Campos obrigatórios para item (descrição vazia)', 'negativo'),
    ('TELA-SWOT-013', 'CT-SWOT-023 — Limites de texto (BVA)', 'feliz'),
    ('TELA-SWOT-014', 'CT-SWOT-024 — Excluir item', 'feliz'),
    ('TELA-SWOT-015', 'CT-SWOT-025 — Excluir SWOT', 'feliz'),
    ('TELA-SWOT-016', 'CT-SWOT-026 — Voltar da tela de detalhe', 'feliz'),
    ('TELA-SWOT-017', 'CT-SWOT-027 — Concorrência: adicionar itens em sequência rápida', 'feliz'),
    ('TELA-SWOT-018', 'CT-SWOT-028 — Concorrência: exclusão de item já removido (graceful)', 'feliz'),
    ('TELA-SWOT-019', 'CT-SWOT-029 — Resiliência: UI não trava após operações', 'negativo')
) AS v(codigo, titulo, tipo)
WHERE m.path = 'planejamento-gestao/planejamento-estrategico'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.qa_cobertura_e2e (codigo, spec, teste)
SELECT v.codigo, 'cypress/e2e/swot.cy.ts', v.teste
FROM (VALUES
    ('TELA-SWOT-001', 'CT-SWOT-001 — Listar SWOTs do escopo'),
    ('TELA-SWOT-002', 'CT-SWOT-002 — Estado vazio'),
    ('TELA-SWOT-003', 'CT-SWOT-003 — Troca de escopo'),
    ('TELA-SWOT-004', 'CT-SWOT-004 — Abrir SWOT clicando no card'),
    ('TELA-SWOT-005', 'CT-SWOT-010 — Criar SWOT (caminho feliz)'),
    ('TELA-SWOT-006', 'CT-SWOT-011 — Título obrigatório'),
    ('TELA-SWOT-007', 'CT-SWOT-012 — Período inválido (formato)'),
    ('TELA-SWOT-008', 'CT-SWOT-013 — Fechar modal com dados preenchidos'),
    ('TELA-SWOT-009', 'CT-SWOT-014 — Duplo clique no Criar Análise'),
    ('TELA-SWOT-010', 'CT-SWOT-020 — Adicionar item em Força'),
    ('TELA-SWOT-011', 'CT-SWOT-021 — Adicionar item em cada quadrante'),
    ('TELA-SWOT-012', 'CT-SWOT-022 — Campos obrigatórios para item (descrição vazia)'),
    ('TELA-SWOT-013', 'CT-SWOT-023 — Limites de texto (BVA)'),
    ('TELA-SWOT-014', 'CT-SWOT-024 — Excluir item'),
    ('TELA-SWOT-015', 'CT-SWOT-025 — Excluir SWOT'),
    ('TELA-SWOT-016', 'CT-SWOT-026 — Voltar da tela de detalhe'),
    ('TELA-SWOT-017', 'CT-SWOT-027 — Concorrência: adicionar itens em sequência rápida'),
    ('TELA-SWOT-018', 'CT-SWOT-028 — Concorrência: exclusão de item já removido (graceful)'),
    ('TELA-SWOT-019', 'CT-SWOT-029 — Resiliência: UI não trava após operações')
) AS v(codigo, teste)
WHERE EXISTS (SELECT 1 FROM public.qa_casos_teste c WHERE c.codigo = v.codigo)
ON CONFLICT (codigo) DO UPDATE
  SET spec = EXCLUDED.spec, teste = EXCLUDED.teste, ativo = true;

-- ─────────────────────────────────────────────────────────
-- importar-colaboradores.cy.ts — 1 teste(s) -> estrutura-organizacional/colaboradores
-- ─────────────────────────────────────────────────────────
INSERT INTO public.qa_casos_teste
  (modulo_id, codigo, titulo, tipo, prioridade, status, nivel, objetivo, observacoes)
SELECT m.id, v.codigo, v.titulo,
       v.tipo::public.qa_caso_tipo,
       'media'::public.qa_prioridade,
       'aprovado'::public.qa_caso_status,
       'e2e',
       'Teste de tela ja existente em cypress/e2e/importar-colaboradores.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.',
       'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.'
FROM public.qa_modulos m
CROSS JOIN (VALUES
    ('TELA-IMPORT-001', 'deve abrir o modal de importação ao clicar no botão ''Importar Colaboradores'' em qualquer aba', 'feliz')
) AS v(codigo, titulo, tipo)
WHERE m.path = 'estrutura-organizacional/colaboradores'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.qa_cobertura_e2e (codigo, spec, teste)
SELECT v.codigo, 'cypress/e2e/importar-colaboradores.cy.ts', v.teste
FROM (VALUES
    ('TELA-IMPORT-001', 'deve abrir o modal de importação ao clicar no botão ''Importar Colaboradores'' em qualquer aba')
) AS v(codigo, teste)
WHERE EXISTS (SELECT 1 FROM public.qa_casos_teste c WHERE c.codigo = v.codigo)
ON CONFLICT (codigo) DO UPDATE
  SET spec = EXCLUDED.spec, teste = EXCLUDED.teste, ativo = true;

-- Conferencia: quantos casos de tela ficaram documentados e ligados.
DO $conf$
DECLARE v_casos int; v_ligados int;
BEGIN
  SELECT count(*) INTO v_casos   FROM public.qa_casos_teste  WHERE codigo LIKE 'TELA-%';
  SELECT count(*) INTO v_ligados FROM public.qa_cobertura_e2e WHERE codigo LIKE 'TELA-%';
  RAISE NOTICE 'Casos de tela documentados: %; ligados a um it(): %.', v_casos, v_ligados;
END $conf$;
