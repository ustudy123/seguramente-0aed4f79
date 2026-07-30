-- ============================================================================
-- QA Tier 3A — validação só no front, banco aceitava qualquer coisa
--
-- Base auditada antes. Entram aqui apenas os CHECKs com ZERO violações
-- existentes. Dois ficaram de fora por haver dado violando (ver o fim do
-- arquivo) e dois por não haver domínio confiável a congelar.
-- ============================================================================


-- ── PARTE 1 — correção dos dados que bloqueavam dois CHECKs ─────────────────
-- A auditoria encontrou 3 registros violando. Sem corrigi-los, EMP-041 e
-- META-034 falhariam na criação da constraint.

-- ALFAFLIX PROMOCAO DE VENDAS: mínimo 1 com máximo 0 é impossível por
-- construção — o "0" era campo não preenchido, não um teto real. Vira faixa
-- não configurada (NULL), que é o que de fato descreve a situação.
UPDATE public.empresa_cadastro
   SET aprendiz_quantidade_minima = NULL,
       aprendiz_quantidade_maxima = NULL
 WHERE id = '24fc5b7a-dddd-4078-bf8a-a6a29f51bc88';

-- Meta "teste": descartável.
DELETE FROM public.metas
 WHERE id = '5a880be4-34f6-492c-b498-0f1e788b9f84';

-- Meta de produtividade: fim 8 dias ANTES do início. O título diz "até o final
-- do próximo trimestre", então o fim correto é 30/06/2026 — a data de fim nunca
-- havia sido preenchida direito.
UPDATE public.metas
   SET data_fim = '2026-06-30'
 WHERE id = '96afe4cc-2b81-4de6-9be5-703517cda5ee';


-- ── CARGO-012 — faixa salarial coerente ─────────────────────────────────────
-- O banco aceitava mínimo 8000 com máximo 3000.
ALTER TABLE public.cargos
  DROP CONSTRAINT IF EXISTS cargos_faixa_salarial_coerente;
ALTER TABLE public.cargos
  ADD CONSTRAINT cargos_faixa_salarial_coerente
  CHECK (faixa_salarial_min IS NULL
      OR faixa_salarial_max IS NULL
      OR faixa_salarial_min <= faixa_salarial_max);


-- ── EMP-033 — percentual de cota PcD conforme Lei 8.213/91 ──────────────────
-- A lei prevê apenas 2, 3, 4 e 5%. Zero é permitido (empresa fora da obrigação).
ALTER TABLE public.empresa_cadastro
  DROP CONSTRAINT IF EXISTS empresa_pcd_percentual_lei8213;
ALTER TABLE public.empresa_cadastro
  ADD CONSTRAINT empresa_pcd_percentual_lei8213
  CHECK (pcd_percentual_exigido IS NULL
      OR pcd_percentual_exigido IN (0, 2, 3, 4, 5));


-- ── EMP-034 — não existe quantidade negativa de pessoas ─────────────────────
ALTER TABLE public.empresa_cadastro
  DROP CONSTRAINT IF EXISTS empresa_quantidades_nao_negativas;
ALTER TABLE public.empresa_cadastro
  ADD CONSTRAINT empresa_quantidades_nao_negativas
  CHECK (COALESCE(pcd_quantidade_exigida, 0)   >= 0
     AND COALESCE(pcd_quantidade_atual, 0)     >= 0
     AND COALESCE(total_colaboradores, 0)      >= 0
     AND COALESCE(aprendiz_quantidade_atual, 0) >= 0
     AND COALESCE(aprendiz_quantidade_minima, 0) >= 0
     AND COALESCE(aprendiz_quantidade_maxima, 0) >= 0);


-- ── EMP-041 — faixa de aprendiz coerente (destravado pela Parte 1) ──────────
ALTER TABLE public.empresa_cadastro
  DROP CONSTRAINT IF EXISTS empresa_aprendiz_faixa_coerente;
ALTER TABLE public.empresa_cadastro
  ADD CONSTRAINT empresa_aprendiz_faixa_coerente
  CHECK (aprendiz_quantidade_minima IS NULL
      OR aprendiz_quantidade_maxima IS NULL
      OR aprendiz_quantidade_minima <= aprendiz_quantidade_maxima);


-- ── MCFG-021 — escala de avaliação coerente ─────────────────────────────────
ALTER TABLE public.metas_configuracao
  DROP CONSTRAINT IF EXISTS metas_config_escala_coerente;
ALTER TABLE public.metas_configuracao
  ADD CONSTRAINT metas_config_escala_coerente
  CHECK (escala_min IS NULL OR escala_max IS NULL OR escala_min <= escala_max);


-- ── META-012 — progresso dentro de 0-100 ────────────────────────────────────
-- O Plano de Ação já tinha esse CHECK (ACAO-013 passou); Metas não tinha.
ALTER TABLE public.metas
  DROP CONSTRAINT IF EXISTS metas_progresso_faixa;
ALTER TABLE public.metas
  ADD CONSTRAINT metas_progresso_faixa
  CHECK (progresso IS NULL OR (progresso >= 0 AND progresso <= 100));


-- ── META-034 — vigência coerente (destravado pela Parte 1) ──────────────────
ALTER TABLE public.metas
  DROP CONSTRAINT IF EXISTS metas_vigencia_coerente;
ALTER TABLE public.metas
  ADD CONSTRAINT metas_vigencia_coerente
  CHECK (data_inicio IS NULL OR data_fim IS NULL OR data_fim >= data_inicio);


-- ── META-035 — título não pode ser espaço em branco ─────────────────────────
-- NOT NULL não alcança string vazia mascarada; a meta aparecia sem título.
ALTER TABLE public.metas
  DROP CONSTRAINT IF EXISTS metas_titulo_nao_vazio;
ALTER TABLE public.metas
  ADD CONSTRAINT metas_titulo_nao_vazio
  CHECK (trim(COALESCE(titulo, '')) <> '');


-- ── DOC-042 — status de documento com domínio fechado ───────────────────────
-- documentos.status era TEXT livre e aceitou "abacaxi".
--
-- O domínio abaixo é a UNIÃO do que está em uso na base (valido 986, vencido 7,
-- vencendo 4, ativo 4) com o que o código grava ('valido', 'pendente'). Não há
-- enum declarado no schema, então esta é a melhor aproximação disponível.
--
-- SE ALGUMA TELA FALHAR AO SALVAR DOCUMENTO depois disto, o valor legítimo que
-- faltou aparece na mensagem de erro — basta adicioná-lo aqui e reaplicar.
-- Para reverter:  ALTER TABLE public.documentos DROP CONSTRAINT documentos_status_dominio;
ALTER TABLE public.documentos
  DROP CONSTRAINT IF EXISTS documentos_status_dominio;
ALTER TABLE public.documentos
  ADD CONSTRAINT documentos_status_dominio
  CHECK (status IN ('valido', 'vencido', 'vencendo', 'ativo', 'pendente'));


-- ============================================================================
-- NÃO INCLUÍDOS — e por quê
--
-- OBRG-020 (categoria/subcategoria de obrigações):
--   o relatório aponta que os valores válidos "vivem só no comentário do
--   código". Não encontrei lista definitiva — só 3 categorias em uso (legal,
--   sst, financeira). Congelar um domínio que não conheço barraria cadastro
--   legítimo. Precisa da lista oficial do produto antes.
--
-- META-033 (baseline/alvo vs direção):
--   deliberadamente fora. "Com maior_melhor o alvo deve superar o baseline"
--   não é sempre verdade — há metas legitimamente já atingidas no cadastro, e
--   metas de manutenção. Cabe alerta na tela, não bloqueio no banco.
-- ============================================================================
