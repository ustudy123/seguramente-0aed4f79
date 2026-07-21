-- =========================================================
-- ADMISSÃO: documentos duplicados (18 no lugar de 9)
--
-- DIAGNÓSTICO (confirmado na base da Taeco): cada documento aparece
-- EXATAMENTE 2x (ou 4x na Hortência), com o bloco inteiro de documentos
-- obrigatórios repetido. Isso é a função de criar admissão (criarAdmissao)
-- rodando mais de uma vez para a MESMA admissão — duplo clique ou retry
-- após lentidão. Cada execução insere todos os documentos obrigatórios de
-- novo, e não havia constraint impedindo.
--
-- Não é upload duplicando (o upload já checa storage_path), nem erro de
-- exibição (a leitura filtra por admissao_id, sem JOIN). Os registros estão
-- duplicados de verdade na tabela.
--
-- CORREÇÃO EM DOIS PASSOS:
--   1) Remover as duplicatas PRESERVANDO o documento que foi enviado.
--      Regra de quem fica, por (admissao_id, nome):
--        a) a cópia COM arquivo (arquivo_url NOT NULL) tem prioridade;
--        b) entre as com arquivo, a mais RECENTE;
--        c) se nenhuma tem arquivo, a mais ANTIGA (o placeholder original).
--      Assim nunca se perde um upload.
--   2) Índice único (admissao_id, nome) — impede a duplicação de voltar,
--      mesmo que criarAdmissao dispare duas vezes.
--
-- Transação: dedup e constraint juntos, ou nada.
-- =========================================================

BEGIN;

-- ---------------------------------------------------------
-- 1) Dedup preservando o upload
-- ---------------------------------------------------------
WITH ranqueado AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY admissao_id, nome
      ORDER BY
        (arquivo_url IS NOT NULL) DESC,  -- quem tem arquivo, primeiro
        data_envio DESC NULLS LAST,       -- envio mais recente
        created_at DESC                   -- desempate: mais recente
    ) AS rn
  FROM public.admissao_documentos
)
DELETE FROM public.admissao_documentos
WHERE id IN (SELECT id FROM ranqueado WHERE rn > 1);

-- ---------------------------------------------------------
-- 2) Impede voltar a duplicar
-- ---------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS admissao_documentos_admissao_nome_uidx
  ON public.admissao_documentos (admissao_id, nome);

-- ---------------------------------------------------------
-- Verificação: não pode sobrar duplicata
-- ---------------------------------------------------------
DO $verifica$
DECLARE v_dups int;
BEGIN
  SELECT count(*) INTO v_dups FROM (
    SELECT admissao_id, nome
    FROM public.admissao_documentos
    GROUP BY admissao_id, nome
    HAVING count(*) > 1
  ) s;

  IF v_dups > 0 THEN
    RAISE EXCEPTION 'FALHOU: ainda há % par(es) duplicado(s).', v_dups;
  END IF;
  RAISE NOTICE 'OK: duplicatas removidas e índice único criado.';
END $verifica$;

COMMIT;
