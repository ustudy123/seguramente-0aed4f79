-- ============================================================================
-- QA Tier 3B — unicidade (e o que a auditoria revelou)
--
-- Dos quatro achados de duplicidade, DOIS foram fechados aqui. Os outros dois
-- (CPF) pararam num problema maior que o relatado — está documentado no fim
-- deste arquivo porque precisa de decisão de negócio, não de código.
-- ============================================================================


-- ── Limpeza dos registros de demonstração que causavam a duplicidade ────────

-- COLAB-023: "Wallas teste 2" e "Maiana Silva" compartilhavam o mesmo e-mail,
-- cadastrados com 9 minutos de diferença. O primeiro é registro de teste, sem
-- admissões nem documentos vinculados.
DELETE FROM public.usuarios_base
 WHERE id = 'fa4716e6-1084-4d84-ad69-9196a1356170';

-- TER-020: "exemplo 1" duplicava o CNPJ de "LN - ON IMOVEIS LTDA", criado 35
-- minutos depois. Tinha um trabalhador vinculado, também de demonstração
-- (nome "Teste") — removido em cascata.
DELETE FROM public.terceiros
 WHERE id = '94c8a814-cfb1-492f-a067-c95a16807c8a';


-- ── COLAB-023 — e-mail único por cliente ────────────────────────────────────
-- E-mail é chave de acesso: dois usuários com o mesmo login é falha de
-- autenticação, não só de cadastro. Normalizado (minúsculas, sem espaços) para
-- que 'A@x.com' e 'a@x.com ' não passem como contas diferentes.
DROP INDEX IF EXISTS usuarios_base_email_tenant_uidx;
CREATE UNIQUE INDEX usuarios_base_email_tenant_uidx
  ON public.usuarios_base (tenant_id, lower(trim(email_principal)))
  WHERE email_principal IS NOT NULL AND trim(email_principal) <> '';


-- ── TER-020 — CNPJ de terceiro único por cliente ────────────────────────────
-- Mesma lógica do índice de empresa_cadastro, que já reconhece o CNPJ
-- formatado como o mesmo número (o caso EMP-013 passa por causa dele).
DROP INDEX IF EXISTS terceiros_cnpj_tenant_uidx;
CREATE UNIQUE INDEX terceiros_cnpj_tenant_uidx
  ON public.terceiros (tenant_id, regexp_replace(cnpj, '[^0-9]', '', 'g'))
  WHERE cnpj IS NOT NULL AND cnpj <> '';


-- ============================================================================
-- NÃO INCLUÍDOS
--
-- MIND-020 (nome de indicador único):
--   Nenhuma duplicata na base — o índice entraria limpo. Fora de propósito: o
--   nome do indicador é texto livre, e dois indicadores homônimos em contextos
--   distintos podem ser legítimos. O próprio caso admite "recusado OU
--   sinalizado"; sinalizar na tela é mais adequado que bloquear no banco.
--
-- COLAB-033 / ADM-002 (CPF único) — PENDÊNCIA DE DADOS, NÃO DE CÓDIGO:
--
--   A auditoria de 29/07/2026 sobre public.admissoes encontrou:
--     • 1.235 CPFs com mais de uma admissão
--     •    18 deles atribuídos a PESSOAS DIFERENTES → 61 registros
--     • 1.217 com a mesma pessoa repetida
--
--   Os 18 são o problema grave, e MAIOR que o descrito no relatório (que falava
--   em duplicidade por pontuação). Não é a mesma pessoa duas vezes: é o mesmo
--   CPF em pessoas distintas. O caso extremo é 22566481091, com DOZE nomes
--   diferentes, todos ativos — doze vínculos para um trabalhador no eSocial,
--   onde o CPF é a chave. Há implicação de LGPD: o dado pessoal de um está
--   vinculado ao registro dos outros onze.
--
--   Os 1.217 são a duplicação por importação repetida de planilha, já conhecida
--   (ex.: Vilson Antonio Cecagno com 10 admissões concluídas).
--
--   RESSALVA na contagem: parte dos 18 é falso positivo de grafia — por exemplo
--   10513899928 aparece como "Cleiton Alves de Oliveira | Cleiton Alves De
--   Oliveira", mesma pessoa com maiúscula diferente. O número real é um pouco
--   menor, mas os casos de 12 e 6 nomes são inequívocos.
--
--   POR QUE NÃO HÁ CORREÇÃO AQUI: para os 61 registros com CPF trocado, o valor
--   correto não é derivável do banco — alguém precisa conferir o documento da
--   pessoa. Para os 1.217, deduplicar exige decidir caso a caso qual registro
--   permanece e o que fazer com documentos, afastamentos e férias pendurados
--   nos demais. É trabalho de projeto, com conferência do cliente, não migração.
--
--   O índice único parcial sobre admissões ativas continua sendo o alvo — mas
--   só depois da limpeza, senão falha na criação.
-- ============================================================================
