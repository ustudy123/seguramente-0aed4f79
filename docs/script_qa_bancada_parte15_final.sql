-- ============================================================================
-- ENTREGA — BANCADA DE QA NA PRODUCAO — parte 15 de 15
-- Cobertura de tela e conferencia final
--
-- POR QUE ESTA TRILHA EXISTE
-- A bancada de testes tem tres camadas: a ROTINA (uma funcao), o CASO
-- DOCUMENTADO (linha em qa_casos_teste) e a PONTE que liga uma a outra
-- (qa_implementacoes). Rotina e estrutura; caso e ponte sao dados. As tres
-- nasceram em migrations, que so alcancam o ambiente de teste — nunca a
-- producao. Resultado medido: a producao documenta 568 casos e executa 268,
-- enquanto o projeto documenta 822 e executa 565.
--
-- Esta trilha leva as tres camadas para a producao. A homologacao herda na
-- proxima copia (as tabelas do motor de QA sao copiadas de la na integra).
--
-- GARANTIAS
--   - Idempotente: rodar duas vezes nao duplica nem quebra.
--   - NAO altera nenhuma regra de negocio. So a bancada que as verifica.
--   - Modulo resolvido pelo CAMINHO, nao pelo identificador interno (os
--     identificadores diferem entre ambientes).
--   - A ponte so e criada quando a rotina existe de fato no destino.
--   - Cada rotina entra em bloco proprio: falha de uma vira NOTICE, nao
--     aborta o arquivo.
--   - O cercado (tenant isolado onde os testes rodam) JA existe na producao —
--     esta trilha nao mexe nele, nem em dado de cliente.
-- Roda inteiro em UMA transacao.
-- ============================================================================

SET lock_timeout = '10s';

-- (1) COBERTURA DE TELA — ponte entre o caso e2e e o teste do Cypress.

INSERT INTO public.qa_cobertura_e2e (codigo, spec, teste)
SELECT d.codigo::text, d.spec::text, d.teste::text
FROM (VALUES
    ('TELA-EPI-001', 'cypress/e2e/epi.cy.ts', 'CT-01: Cadastrar tipo de EPI com todos os campos obrigatórios'),
    ('TELA-EPI-002', 'cypress/e2e/epi.cy.ts', 'CT-02: Bloquear cadastro de EPI sem CA'),
    ('TELA-EPI-003', 'cypress/e2e/epi.cy.ts', 'CT-03: Bloquear cadastro de EPI com validade de CA inválida'),
    ('TELA-EPI-004', 'cypress/e2e/epi.cy.ts', 'CT-04: Permitir cadastro com categoria padrão'),
    ('TELA-EPI-005', 'cypress/e2e/epi.cy.ts', 'CT-05: Permitir cadastro com categoria personalizada'),
    ('TELA-EPI-006', 'cypress/e2e/epi.cy.ts', 'CT-06: Registrar entrada manual no estoque'),
    ('TELA-EPI-007', 'cypress/e2e/epi.cy.ts', 'CT-07: Registrar entrada por importação de XML NF-e'),
    ('TELA-EPI-008', 'cypress/e2e/epi.cy.ts', 'CT-08: Validar composição do local em dois níveis'),
    ('TELA-EPI-009', 'cypress/e2e/epi.cy.ts', 'CT-09: Registrar entrega de EPI ao colaborador (wizard visível)'),
    ('TELA-EPI-010', 'cypress/e2e/epi.cy.ts', 'CT-10: Wizard de entrega possui etapa de assinatura'),
    ('TELA-EPI-011', 'cypress/e2e/epi.cy.ts', 'CT-11: Aba de histórico existe e registra movimentações'),
    ('TELA-EPI-012', 'cypress/e2e/epi.cy.ts', 'CT-12: Sistema valida saldo antes da entrega'),
    ('TELA-EPI-013', 'cypress/e2e/epi.cy.ts', 'CT-13: Sistema bloqueia entrega com CA vencido'),
    ('TELA-EPI-014', 'cypress/e2e/epi.cy.ts', 'CT-14: Botão/modal de devolução existe na lista de entregas'),
    ('TELA-EPI-015', 'cypress/e2e/epi.cy.ts', 'CT-15: Modal de devolução oferece destino Manutenção'),
    ('TELA-EPI-016', 'cypress/e2e/epi.cy.ts', 'CT-16: Modal de devolução oferece destino Descarte'),
    ('TELA-EPI-017', 'cypress/e2e/epi.cy.ts', 'CT-17: Devolução exige campo de observação'),
    ('TELA-EPI-018', 'cypress/e2e/epi.cy.ts', 'CT-18: Aba de alertas exibe alertas de CA vencido'),
    ('TELA-EPI-019', 'cypress/e2e/epi.cy.ts', 'CT-19: Aba de alertas detecta estoque baixo'),
    ('TELA-EPI-020', 'cypress/e2e/epi.cy.ts', 'CT-20: Alertas incluem EPIs próximos do vencimento'),
    ('TELA-EPI-021', 'cypress/e2e/epi.cy.ts', 'CT-21: Alertas incluem atraso de troca'),
    ('TELA-EPI-022', 'cypress/e2e/epi.cy.ts', 'CT-22: Dashboard de saldo por local é exibido'),
    ('TELA-EPI-023', 'cypress/e2e/epi.cy.ts', 'CT-23: Formulário de transferência está disponível'),
    ('TELA-EPI-024', 'cypress/e2e/epi.cy.ts', 'CT-24: Aba Matriz de proteção é acessível'),
    ('TELA-EPI-025', 'cypress/e2e/epi.cy.ts', 'CT-25: Matriz identifica pendências de EPI'),
    ('TELA-EPI-026', 'cypress/e2e/epi.cy.ts', 'CT-26: Wizard de entrega acessa dados da matriz'),
    ('TELA-EPI-027', 'cypress/e2e/epi.cy.ts', 'CT-27: Histórico de movimentações possui dados tabulares'),
    ('TELA-EPI-028', 'cypress/e2e/epi.cy.ts', 'CT-28: Aba de auditoria IA está acessível'),
    ('TELA-EPI-029', 'cypress/e2e/epi.cy.ts', 'CT-29: Wizard gera comprovante com assinatura'),
    ('TELA-EPI-030', 'cypress/e2e/epi.cy.ts', 'CT-30: Rastreabilidade via histórico de movimentações'),
    ('TELA-EPI-031', 'cypress/e2e/epi.cy.ts', 'CT-31: Matriz evidencia gaps de fornecimento por função'),
    ('TELA-EPI-032', 'cypress/e2e/epi.cy.ts', 'CT-32: Entrega valida CA e rastreabilidade'),
    ('TELA-EPI-033', 'cypress/e2e/epi.cy.ts', 'CT-33: Registro formal de entrega com aceite documentado'),
    ('TELA-EPI-034', 'cypress/e2e/epi.cy.ts', 'CT-34: Periodicidade de troca gera alertas'),
    ('TELA-EPI-035', 'cypress/e2e/epi.cy.ts', 'CT-35: Matriz exibe EPIs obrigatórios por função'),
    ('TELA-EPI-036', 'cypress/e2e/epi.cy.ts', 'CT-36: CA duplicado é bloqueado no cadastro'),
    ('TELA-EPI-037', 'cypress/e2e/epi.cy.ts', 'CT-37: Entrada com quantidade inválida é bloqueada'),
    ('TELA-EPI-038', 'cypress/e2e/epi.cy.ts', 'CT-38: Entrega com quantidade zero é bloqueada'),
    ('TELA-EPI-039', 'cypress/e2e/epi.cy.ts', 'CT-39: Colaborador inativo é bloqueado na entrega'),
    ('TELA-EPI-040', 'cypress/e2e/epi.cy.ts', 'CT-40: Devolução só disponível para entregas ativas'),
    ('TELA-EPI-041', 'cypress/e2e/epi.cy.ts', 'CT-41: Destino Estoque requer estado compatível'),
    ('TELA-EPI-042', 'cypress/e2e/epi.cy.ts', 'CT-42: Toda alteração de saldo gera movimentação'),
    ('TELA-EPI-043', 'cypress/e2e/epi.cy.ts', 'CT-43: Sistema trata EPIs sem estoque mínimo configurado'),
    ('TELA-EPI-044', 'cypress/e2e/epi.cy.ts', 'CT-44: Sistema sinaliza funções sem matriz definida'),
    ('TELA-EPI-045', 'cypress/e2e/epi.cy.ts', 'CT-45: XML inválido é rejeitado na importação'),
    ('TELA-EPI-046', 'cypress/e2e/epi.cy.ts', 'CT-46: Entrega incompleta não gera baixa no estoque'),
    ('TELA-EPI-047', 'cypress/e2e/epi.cy.ts', 'CT-47: Controle de concorrência impede saldo negativo'),
    ('TELA-EPI-048', 'cypress/e2e/epi.cy.ts', 'CT-48: Alerta preventivo sem bloqueio para EPI próximo do vencimento'),
    ('TELA-IMPORT-001', 'cypress/e2e/importar-colaboradores.cy.ts', 'deve abrir o modal de importação ao clicar no botão ''Importar Colaboradores'' em qualquer aba'),
    ('TELA-INC-001', 'cypress/e2e/incidentes-acidentes.cy.ts', 'carrega o módulo e todas as abas principais'),
    ('TELA-INC-002', 'cypress/e2e/incidentes-acidentes.cy.ts', 'aplica filtros da aba ocorrências'),
    ('TELA-INC-003', 'cypress/e2e/incidentes-acidentes.cy.ts', 'cadastra um incidente com colaborador manual'),
    ('TELA-INC-004', 'cypress/e2e/incidentes-acidentes.cy.ts', 'cadastra um acidente com CAT emitida'),
    ('TELA-INC-005', 'cypress/e2e/incidentes-acidentes.cy.ts', 'cadastra um acidente sem CAT emitida'),
    ('TELA-INC-006', 'cypress/e2e/incidentes-acidentes.cy.ts', 'abre detalhes por linha, volta e usa ações do detalhe'),
    ('TELA-INC-007', 'cypress/e2e/incidentes-acidentes.cy.ts', 'abre edição pela tabela'),
    ('TELA-INC-008', 'cypress/e2e/incidentes-acidentes.cy.ts', 'acessa a aba pirâmide, muda filtros e abre camadas'),
    ('TELA-INC-009', 'cypress/e2e/incidentes-acidentes.cy.ts', 'abre o guia rápido'),
    ('TELA-PSICO-001', 'cypress/e2e/psicossocial.cy.ts', 'TC-01: Criar campanha psicossocial com dados válidos'),
    ('TELA-PSICO-002', 'cypress/e2e/psicossocial.cy.ts', 'TC-02: Assistente de seleção de instrumento é exibido'),
    ('TELA-PSICO-003', 'cypress/e2e/psicossocial.cy.ts', 'TC-03: Bloquear criação sem Setor + Função'),
    ('TELA-PSICO-004', 'cypress/e2e/psicossocial.cy.ts', 'TC-04: Autocomplete de Setor + Função funciona'),
    ('TELA-PSICO-005', 'cypress/e2e/psicossocial.cy.ts', 'TC-05: Cadastrar novo Setor/Função inexistente'),
    ('TELA-PSICO-006', 'cypress/e2e/psicossocial.cy.ts', 'TC-06: Múltiplos pares Setor + Função'),
    ('TELA-PSICO-007', 'cypress/e2e/psicossocial.cy.ts', 'TC-07: Distribuição gera link, QR Code e mensagens'),
    ('TELA-PSICO-008', 'cypress/e2e/psicossocial.cy.ts', 'TC-08: Acesso ao questionário sem login'),
    ('TELA-PSICO-009', 'cypress/e2e/psicossocial.cy.ts', 'TC-09: Tela de verificação WhatsApp é exibida'),
    ('TELA-PSICO-010', 'cypress/e2e/psicossocial.cy.ts', 'TC-10: Código WhatsApp inválido é rejeitado'),
    ('TELA-PSICO-011', 'cypress/e2e/psicossocial.cy.ts', 'TC-11: Duplicidade de respostas é bloqueada'),
    ('TELA-PSICO-012', 'cypress/e2e/psicossocial.cy.ts', 'TC-12: Anonimato das respostas'),
    ('TELA-PSICO-013', 'cypress/e2e/psicossocial.cy.ts', 'TC-13: Resultados exibidos com 5+ respondentes'),
    ('TELA-PSICO-014', 'cypress/e2e/psicossocial.cy.ts', 'TC-14: Agrupamento automático por privacidade'),
    ('TELA-PSICO-015', 'cypress/e2e/psicossocial.cy.ts', 'TC-15: Mensagem de dados insuficientes para confidencialidade'),
    ('TELA-PSICO-016', 'cypress/e2e/psicossocial.cy.ts', 'TC-16: Cálculo de IPS ao encerrar campanha'),
    ('TELA-PSICO-017', 'cypress/e2e/psicossocial.cy.ts', 'TC-17: Classificação IPS por faixas'),
    ('TELA-PSICO-018', 'cypress/e2e/psicossocial.cy.ts', 'TC-18: Gráfico radar e análise interpretativa'),
    ('TELA-PSICO-019', 'cypress/e2e/psicossocial.cy.ts', 'TC-19: Exportação de relatório PDF'),
    ('TELA-PSICO-020', 'cypress/e2e/psicossocial.cy.ts', 'TC-20: Integração com GRO'),
    ('TELA-PSICO-021', 'cypress/e2e/psicossocial.cy.ts', 'TC-21: Vínculo risco x Setor + Função no GRO'),
    ('TELA-PSICO-022', 'cypress/e2e/psicossocial.cy.ts', 'TC-22: Plano 5W2H para risco Alto — 60 dias'),
    ('TELA-PSICO-023', 'cypress/e2e/psicossocial.cy.ts', 'TC-23: Plano 5W2H para risco Crítico — 30 dias'),
    ('TELA-PSICO-024', 'cypress/e2e/psicossocial.cy.ts', 'TC-24: Bloquear arquivamento de risco Alto sem plano'),
    ('TELA-PSICO-025', 'cypress/e2e/psicossocial.cy.ts', 'TC-25: Bloquear arquivamento de risco Crítico sem plano'),
    ('TELA-PSICO-026', 'cypress/e2e/psicossocial.cy.ts', 'TC-26: Recomendação de AET quando IPS < 65'),
    ('TELA-PSICO-027', 'cypress/e2e/psicossocial.cy.ts', 'TC-27: AET obrigatória quando IPS < 50'),
    ('TELA-PSICO-028', 'cypress/e2e/psicossocial.cy.ts', 'TC-28: Recomendação AET por múltiplos fatores críticos'),
    ('TELA-PSICO-029', 'cypress/e2e/psicossocial.cy.ts', 'TC-29: AET por recorrência de riscos'),
    ('TELA-PSICO-030', 'cypress/e2e/psicossocial.cy.ts', 'TC-30: Dados psicossociais no módulo Ergonomia'),
    ('TELA-PSICO-031', 'cypress/e2e/psicossocial.cy.ts', 'TC-31: Reavaliação exigida após ação concluída'),
    ('TELA-PSICO-032', 'cypress/e2e/psicossocial.cy.ts', 'TC-32: Histórico de evolução do IPS'),
    ('TELA-PSICO-033', 'cypress/e2e/psicossocial.cy.ts', 'TC-33: Inventário PGR consolidado'),
    ('TELA-PSICO-034', 'cypress/e2e/psicossocial.cy.ts', 'TC-34: Exportação PDF do inventário PGR'),
    ('TELA-PSICO-035', 'cypress/e2e/psicossocial.cy.ts', 'TC-35: Bloquear data fim anterior à data início'),
    ('TELA-PSICO-036', 'cypress/e2e/psicossocial.cy.ts', 'TC-36: Campanha expirada sem respostas não gera erro'),
    ('TELA-PSICO-037', 'cypress/e2e/psicossocial.cy.ts', 'TC-37: Grupo com 5 respondentes — resultado exibido'),
    ('TELA-PSICO-038', 'cypress/e2e/psicossocial.cy.ts', 'TC-38: Fallback para nível setor com 4 respondentes na função'),
    ('TELA-PSICO-039', 'cypress/e2e/psicossocial.cy.ts', 'TC-39: Empresa pequena — agrupamento seguro'),
    ('TELA-PSICO-040', 'cypress/e2e/psicossocial.cy.ts', 'TC-40: Link inativo após encerramento da campanha'),
    ('TELA-PSICO-041', 'cypress/e2e/psicossocial.cy.ts', 'TC-41: Erro controlado na falha de envio WhatsApp'),
    ('TELA-PSICO-042', 'cypress/e2e/psicossocial.cy.ts', 'TC-42: Encerramento manual antecipado permitido'),
    ('TELA-PSICO-043', 'cypress/e2e/psicossocial.cy.ts', 'TC-43: Impedir duplicidade de pares Setor + Função'),
    ('TELA-PSICO-044', 'cypress/e2e/psicossocial.cy.ts', 'TC-44: Risco Alto/Crítico sem 5W2H é defeito crítico'),
    ('TELA-PSICO-045', 'cypress/e2e/psicossocial.cy.ts', 'TC-45: IPS 65 classificado como Estável'),
    ('TELA-PSICO-046', 'cypress/e2e/psicossocial.cy.ts', 'TC-46: IPS 50 classificado como Atenção'),
    ('TELA-PSICO-047', 'cypress/e2e/psicossocial.cy.ts', 'TC-47: PDF mantém acentuação e caracteres especiais'),
    ('TELA-PSICO-048', 'cypress/e2e/psicossocial.cy.ts', 'TC-48: Acesso negado para usuário sem permissão'),
    ('TELA-PSICO-049', 'cypress/e2e/psicossocial.cy.ts', 'TC-EXTRA: Guia Rápido abre e fecha corretamente'),
    ('TELA-PSICO-050', 'cypress/e2e/psicossocial.cy.ts', 'TC-EXTRA: Tabs do dashboard carregam sem erro'),
    ('TELA-SWOT-001', 'cypress/e2e/swot.cy.ts', 'CT-SWOT-001 — Listar SWOTs do escopo'),
    ('TELA-SWOT-002', 'cypress/e2e/swot.cy.ts', 'CT-SWOT-002 — Estado vazio'),
    ('TELA-SWOT-003', 'cypress/e2e/swot.cy.ts', 'CT-SWOT-003 — Troca de escopo'),
    ('TELA-SWOT-004', 'cypress/e2e/swot.cy.ts', 'CT-SWOT-004 — Abrir SWOT clicando no card'),
    ('TELA-SWOT-005', 'cypress/e2e/swot.cy.ts', 'CT-SWOT-010 — Criar SWOT (caminho feliz)'),
    ('TELA-SWOT-006', 'cypress/e2e/swot.cy.ts', 'CT-SWOT-011 — Título obrigatório'),
    ('TELA-SWOT-007', 'cypress/e2e/swot.cy.ts', 'CT-SWOT-012 — Período inválido (formato)'),
    ('TELA-SWOT-008', 'cypress/e2e/swot.cy.ts', 'CT-SWOT-013 — Fechar modal com dados preenchidos'),
    ('TELA-SWOT-009', 'cypress/e2e/swot.cy.ts', 'CT-SWOT-014 — Duplo clique no Criar Análise'),
    ('TELA-SWOT-010', 'cypress/e2e/swot.cy.ts', 'CT-SWOT-020 — Adicionar item em Força'),
    ('TELA-SWOT-011', 'cypress/e2e/swot.cy.ts', 'CT-SWOT-021 — Adicionar item em cada quadrante'),
    ('TELA-SWOT-012', 'cypress/e2e/swot.cy.ts', 'CT-SWOT-022 — Campos obrigatórios para item (descrição vazia)'),
    ('TELA-SWOT-013', 'cypress/e2e/swot.cy.ts', 'CT-SWOT-023 — Limites de texto (BVA)'),
    ('TELA-SWOT-014', 'cypress/e2e/swot.cy.ts', 'CT-SWOT-024 — Excluir item'),
    ('TELA-SWOT-015', 'cypress/e2e/swot.cy.ts', 'CT-SWOT-025 — Excluir SWOT'),
    ('TELA-SWOT-016', 'cypress/e2e/swot.cy.ts', 'CT-SWOT-026 — Voltar da tela de detalhe'),
    ('TELA-SWOT-017', 'cypress/e2e/swot.cy.ts', 'CT-SWOT-027 — Concorrência: adicionar itens em sequência rápida'),
    ('TELA-SWOT-018', 'cypress/e2e/swot.cy.ts', 'CT-SWOT-028 — Concorrência: exclusão de item já removido (graceful)'),
    ('TELA-SWOT-019', 'cypress/e2e/swot.cy.ts', 'CT-SWOT-029 — Resiliência: UI não trava após operações')
) AS d(codigo, spec, teste)
WHERE EXISTS (SELECT 1 FROM public.qa_casos_teste c WHERE c.codigo = d.codigo::text)
ON CONFLICT DO NOTHING;


-- ---------------------------------------------------------------------------
-- CONFERENCIA FINAL — o retrato da bancada inteira, no mesmo formato do
-- diagnostico que mediu o buraco. Esperado com todas as partes aplicadas:
--   822 | 800 | 565 | 257 | 0 | OK
-- ---------------------------------------------------------------------------
WITH base AS MATERIALIZED (
  SELECT c.status, c.nivel,
         i.codigo IS NOT NULL AS tem_ponte,
         (i.codigo IS NOT NULL
          AND to_regprocedure('public.' || i.funcao_sql || '()') IS NOT NULL) AS rotina_existe
  FROM public.qa_casos_teste c
  JOIN public.qa_modulos m ON m.id = c.modulo_id
  LEFT JOIN public.qa_implementacoes i ON i.codigo = c.codigo AND i.ativo
),
x AS MATERIALIZED (
  SELECT count(*) AS no_catalogo,
         count(*) FILTER (WHERE status = 'aprovado') AS aprovados,
         count(*) FILTER (WHERE status = 'aprovado' AND rotina_existe) AS com_rotina,
         count(*) FILTER (WHERE status = 'aprovado' AND nivel = 'e2e') AS de_tela_e2e,
         count(*) FILTER (WHERE status = 'aprovado' AND tem_ponte AND NOT rotina_existe) AS ponte_orfa
  FROM base
)
SELECT no_catalogo, aprovados, com_rotina, de_tela_e2e, ponte_orfa,
       CASE WHEN no_catalogo >= 822 AND com_rotina >= 565 AND ponte_orfa = 0
            THEN 'OK' ELSE 'CONFERIR' END AS erro_tecnico
FROM x;
