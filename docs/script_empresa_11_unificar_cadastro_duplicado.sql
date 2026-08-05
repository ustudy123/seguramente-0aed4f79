-- =====================================================================
-- GUERRO & PAGNUSSAT: quatro cadastros, duas filiais, duas cópias
--
-- O que a consulta mostrou:
--
--   CNPJ .../0004-91   07cf2f4f…  ativo=true   105 pessoas   0 ponto
--                      2982611e…  ativo=FALSE  100 pessoas   0 ponto
--   CNPJ .../0041-36   c30c4a64…  ativo=true   196 pessoas   0 ponto
--                      9bd43dc5…  ativo=FALSE    0 pessoas   0 ponto
--
-- Não são duas empresas: são duas FILIAIS (0004 e 0041), cada uma
-- cadastrada duas vezes. A cópia de cada par já está DESATIVADA — só que
-- as admissões continuaram penduradas nela. Por isso as 100 pessoas
-- apareciam "em duas empresas": uma ativa e uma desativada.
--
-- E o mais importante: NENHUMA das quatro tem um único dia de ponto.
-- Este cliente não usa o módulo de ponto, então nada disso afetou
-- fechamento, espelho ou banco de horas em momento nenhum.
--
-- A limpeza é, portanto, de baixo risco: passar as admissões da cópia
-- desativada para a ativa de mesmo CNPJ.
-- =====================================================================

-- ===================== PARTE 1 — SIMULAÇÃO (leitura) =================
-- Rode primeiro. Mostra o que a Parte 2 faria, sem fazer.
WITH par AS (
  SELECT morta.tenant_id,
         morta.id  AS empresa_morta,
         viva.id   AS empresa_viva,
         COALESCE(viva.razao_social, viva.nome_fantasia) AS empresa,
         viva.cnpj
  FROM public.empresa_cadastro morta
  JOIN public.empresa_cadastro viva
    ON viva.tenant_id = morta.tenant_id
   AND viva.ativo = true
   AND regexp_replace(COALESCE(viva.cnpj, ''), '[^0-9]', '', 'g')
       = regexp_replace(COALESCE(morta.cnpj, ''), '[^0-9]', '', 'g')
   AND viva.id <> morta.id
  WHERE morta.ativo = false
    AND COALESCE(morta.cnpj, '') <> ''
    AND (SELECT count(*) FROM public.empresa_cadastro v2
          WHERE v2.tenant_id = morta.tenant_id
            AND v2.ativo = true
            AND v2.id <> morta.id
            AND regexp_replace(COALESCE(v2.cnpj, ''), '[^0-9]', '', 'g')
                = regexp_replace(COALESCE(morta.cnpj, ''), '[^0-9]', '', 'g')) = 1
)
SELECT p.empresa, p.cnpj, p.empresa_morta, p.empresa_viva,
       count(*) FILTER (WHERE ja_tem_na_viva)     AS marcar_como_duplicada,
       count(*) FILTER (WHERE NOT ja_tem_na_viva) AS transferir_para_a_ativa
FROM par p
JOIN LATERAL (
  SELECT EXISTS (
           SELECT 1 FROM public.admissoes b
           WHERE b.tenant_id = a.tenant_id
             AND b.empresa_id = p.empresa_viva
             AND regexp_replace(COALESCE(b.cpf, ''), '[^0-9]', '', 'g')
                 = regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g')
         ) AS ja_tem_na_viva
  FROM public.admissoes a
  WHERE a.tenant_id = p.tenant_id
    AND a.empresa_id = p.empresa_morta
    -- Mesmo filtro da execução: admissão já inativa não é tocada, e
    -- contá-la aqui faria a simulação prometer mais do que ela faz.
    AND COALESCE(a.inativo, false) = false
) x ON true
GROUP BY 1, 2, 3, 4
ORDER BY 1, 2;


-- ===================== PARTE 2 — EXECUÇÃO ============================
-- Só rode depois de conferir a simulação acima.
--
-- O que faz, para cada empresa DESATIVADA que tem uma gêmea ATIVA de
-- mesmo CNPJ no mesmo cliente:
--   · admissão cuja pessoa JÁ tem cadastro na empresa ativa
--       -> marcada como inativa (é a cópia; a boa já existe);
--   · admissão sem correspondente na ativa
--       -> transferida para a empresa ativa;
--   · qualquer outro registro apontando para a cópia (ponto, espelho,
--     banco de horas, escala…) -> repontado para a ativa.
--
-- Nada é apagado, e cada linha tocada fica registrada em
-- admissoes_limpeza_duplicidade — dá para desfazer consultando de lá.
--
-- NÃO é baixa de contrato: não grava data de desligamento nem mexe em
-- vínculo. É remoção de cadastro duplicado.

CREATE TABLE IF NOT EXISTS public.admissoes_limpeza_duplicidade (
  id bigserial PRIMARY KEY,
  admissao_id uuid,
  tenant_id uuid,
  empresa_de uuid,
  empresa_para uuid,
  acao text,
  executado_em timestamptz NOT NULL DEFAULT now()
);

DO $limpeza$
DECLARE
  p RECORD;
  t RECORD;
  v_marcadas int; v_movidas int; v_outras int; v_n int;
BEGIN
  FOR p IN
    SELECT morta.tenant_id, morta.id AS morta, viva.id AS viva,
           COALESCE(viva.razao_social, viva.nome_fantasia) AS nome
    FROM public.empresa_cadastro morta
    JOIN public.empresa_cadastro viva
      ON viva.tenant_id = morta.tenant_id
     AND viva.ativo = true
     AND regexp_replace(COALESCE(viva.cnpj, ''), '[^0-9]', '', 'g')
         = regexp_replace(COALESCE(morta.cnpj, ''), '[^0-9]', '', 'g')
     AND viva.id <> morta.id
    WHERE morta.ativo = false
      AND COALESCE(morta.cnpj, '') <> ''
      -- Só quando a gêmea ativa é UMA. Com duas ou mais, não há como
      -- saber para qual transferir, e dividir por acaso seria pior que
      -- não fazer nada: a consulta de ambiguidade no fim lista esses.
      AND (SELECT count(*) FROM public.empresa_cadastro v2
            WHERE v2.tenant_id = morta.tenant_id
              AND v2.ativo = true
              AND v2.id <> morta.id
              AND regexp_replace(COALESCE(v2.cnpj, ''), '[^0-9]', '', 'g')
                  = regexp_replace(COALESCE(morta.cnpj, ''), '[^0-9]', '', 'g')) = 1
  LOOP
    -- 1) DUPLICADAS: a pessoa já tem cadastro na empresa ativa.
    --    Ficam onde estão, apenas marcadas como inativas.
    WITH alvo AS (
      SELECT a.id
      FROM public.admissoes a
      WHERE a.tenant_id = p.tenant_id
        AND a.empresa_id = p.morta
        AND COALESCE(a.inativo, false) = false
        AND EXISTS (
          SELECT 1 FROM public.admissoes b
          WHERE b.tenant_id = a.tenant_id
            AND b.empresa_id = p.viva
            AND regexp_replace(COALESCE(b.cpf, ''), '[^0-9]', '', 'g')
                = regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g')
        )
    ),
    registro AS (
      INSERT INTO public.admissoes_limpeza_duplicidade
        (admissao_id, tenant_id, empresa_de, empresa_para, acao)
      SELECT id, p.tenant_id, p.morta, NULL, 'marcada_inativa' FROM alvo
      RETURNING admissao_id
    )
    UPDATE public.admissoes a
    SET inativo = true
    WHERE a.id IN (SELECT admissao_id FROM registro);
    GET DIAGNOSTICS v_marcadas = ROW_COUNT;

    -- 2) SEM CORRESPONDENTE na ativa: passam para ela.
    WITH alvo AS (
      SELECT a.id
      FROM public.admissoes a
      WHERE a.tenant_id = p.tenant_id
        AND a.empresa_id = p.morta
        AND NOT EXISTS (
          SELECT 1 FROM public.admissoes b
          WHERE b.tenant_id = a.tenant_id
            AND b.empresa_id = p.viva
            AND regexp_replace(COALESCE(b.cpf, ''), '[^0-9]', '', 'g')
                = regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g')
        )
    ),
    registro AS (
      INSERT INTO public.admissoes_limpeza_duplicidade
        (admissao_id, tenant_id, empresa_de, empresa_para, acao)
      SELECT id, p.tenant_id, p.morta, p.viva, 'transferida' FROM alvo
      RETURNING admissao_id
    )
    UPDATE public.admissoes a
    SET empresa_id = p.viva
    WHERE a.id IN (SELECT admissao_id FROM registro);
    GET DIAGNOSTICS v_movidas = ROW_COUNT;

    -- 3) TODO O RESTO que aponta para a cópia (ponto, espelho, banco de
    --    horas, escala…). Percorre as tabelas que têm empresa_id, para
    --    não depender de uma lista escrita à mão que envelhece.
    v_outras := 0;
    FOR t IN
      SELECT c.table_name
      FROM information_schema.columns c
      JOIN information_schema.tables tb
        ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name
       AND tb.table_type = 'BASE TABLE'
      WHERE c.table_schema = 'public'
        AND c.column_name = 'empresa_id'
        AND c.table_name NOT IN ('empresa_cadastro', 'admissoes',
                                 'admissoes_limpeza_duplicidade')
    LOOP
      BEGIN
        EXECUTE format(
          'UPDATE public.%I SET empresa_id = $1 WHERE empresa_id = $2', t.table_name)
          USING p.viva, p.morta;
        GET DIAGNOSTICS v_n = ROW_COUNT;
        v_outras := v_outras + v_n;
      EXCEPTION WHEN OTHERS THEN
        -- Colisão de chave única ou tabela protegida: registra e segue.
        RAISE NOTICE '  % não repontada: %', t.table_name, SQLERRM;
      END;
    END LOOP;

    RAISE NOTICE '% : % duplicada(s) marcada(s), % transferida(s), % outro(s) registro(s) repontado(s).',
      p.nome, v_marcadas, v_movidas, v_outras;
  END LOOP;
END $limpeza$;

-- Conferência: deve vir vazio (nenhuma empresa desativada com admissão
-- ativa pendurada).
SELECT COALESCE(e.razao_social, e.nome_fantasia) AS empresa_desativada,
       e.cnpj,
       count(*) AS admissoes_ativas_penduradas
FROM public.admissoes a
JOIN public.empresa_cadastro e ON e.id = a.empresa_id
WHERE e.ativo = false
  AND COALESCE(a.inativo, false) = false
GROUP BY 1, 2
ORDER BY 3 DESC;


-- AMBIGUIDADE: cópias desativadas com MAIS DE UMA empresa ativa de mesmo
-- CNPJ. O script não toca nelas — não há como saber para qual
-- transferir. Se aparecer alguma linha aqui, me avise.
SELECT morta.tenant_id,
       COALESCE(morta.razao_social, morta.nome_fantasia) AS copia_desativada,
       morta.cnpj,
       (SELECT count(*) FROM public.empresa_cadastro v
         WHERE v.tenant_id = morta.tenant_id AND v.ativo = true AND v.id <> morta.id
           AND regexp_replace(COALESCE(v.cnpj, ''), '[^0-9]', '', 'g')
               = regexp_replace(COALESCE(morta.cnpj, ''), '[^0-9]', '', 'g')) AS empresas_ativas_com_esse_cnpj,
       (SELECT count(*) FROM public.admissoes a
         WHERE a.empresa_id = morta.id AND COALESCE(a.inativo, false) = false) AS admissoes_penduradas
FROM public.empresa_cadastro morta
WHERE morta.ativo = false
  AND COALESCE(morta.cnpj, '') <> ''
  AND (SELECT count(*) FROM public.empresa_cadastro v
        WHERE v.tenant_id = morta.tenant_id AND v.ativo = true AND v.id <> morta.id
          AND regexp_replace(COALESCE(v.cnpj, ''), '[^0-9]', '', 'g')
              = regexp_replace(COALESCE(morta.cnpj, ''), '[^0-9]', '', 'g')) > 1
ORDER BY 5 DESC;
