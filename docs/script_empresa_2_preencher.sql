-- =====================================================================
-- Fechamento por empresa: preencher a empresa em branco
-- Parte 2 de 4 — rode UMA parte por vez, na ordem.
--
-- Por que em partes: o editor do Supabase roda o arquivo inteiro numa
-- transação só e tem tempo limite. Se uma parte estourar, tudo o que
-- veio antes é descartado. Em quatro execuções curtas, cada uma se
-- garante sozinha.
-- =====================================================================

-- Se der tempo esgotado, tire o comentário da linha abaixo e rode de
-- novo — ela amplia o limite só desta sessão.
-- SET statement_timeout = '600s';
-- b) PREENCHER O QUE ESTÁ EM BRANCO ------------------------------------
-- Só onde está NULL. Linha que já tem empresa não é tocada: se estiver
-- errada, é caso de cadastro, e sobrescrever aqui esconderia o problema.
-- O mapa CPF -> empresa entra como CTE MATERIALIZED dentro de cada
-- UPDATE: é calculado uma vez e reaproveitado pela junção.
--
-- Duas tentativas anteriores não serviram:
--   1. chamar ponto_empresa_do_cpf() por linha — roda uma varredura das
--      admissões para cada dia de ponto (60 mil dias = 29 s no banco de
--      teste; em produção, tempo esgotado);
--   2. montar o mapa numa tabela temporária — o editor do Supabase não
--      garante a mesma sessão entre um comando e outro, e o comando
--      seguinte não encontrava a tabela ("relation does not exist").
--
-- Com a CTE, cada UPDATE é um comando único e autossuficiente: não
-- depende de nada criado antes e roda em fração de segundo.

-- Uma tabela por bloco: se uma falhar, as outras continuam preenchidas.
DO $backfill$
DECLARE
  v_n int := 0;
BEGIN
  BEGIN
    WITH emp AS MATERIALIZED (
      SELECT DISTINCT ON (a.tenant_id, regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g'))
             a.tenant_id,
             regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g') AS cpf,
             a.empresa_id
      FROM public.admissoes a
      WHERE a.empresa_id IS NOT NULL AND COALESCE(a.cpf, '') <> ''
      ORDER BY a.tenant_id, 2, COALESCE(a.inativo, false), a.data_admissao DESC NULLS LAST
    )
    UPDATE public.ponto_diario pd
    SET empresa_id = m.empresa_id,
        updated_at = now()
    FROM emp m
    WHERE pd.empresa_id IS NULL
      AND m.tenant_id = pd.tenant_id
      AND m.cpf = regexp_replace(COALESCE(pd.colaborador_cpf, ''), '[^0-9]', '', 'g');
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE 'ponto_diario: % dias ganharam empresa.', v_n;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ponto_diario não preenchido: %', SQLERRM;
  END;

  BEGIN
    WITH emp AS MATERIALIZED (
      SELECT DISTINCT ON (a.tenant_id, regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g'))
             a.tenant_id,
             regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g') AS cpf,
             a.empresa_id
      FROM public.admissoes a
      WHERE a.empresa_id IS NOT NULL AND COALESCE(a.cpf, '') <> ''
      ORDER BY a.tenant_id, 2, COALESCE(a.inativo, false), a.data_admissao DESC NULLS LAST
    )
    UPDATE public.ponto_banco_horas bh
    SET empresa_id = m.empresa_id,
        updated_at = now()
    FROM emp m
    WHERE bh.empresa_id IS NULL
      AND m.tenant_id = bh.tenant_id
      AND m.cpf = regexp_replace(COALESCE(bh.colaborador_cpf, ''), '[^0-9]', '', 'g');
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE 'ponto_banco_horas: % registros ganharam empresa.', v_n;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ponto_banco_horas não preenchido: %', SQLERRM;
  END;

  BEGIN
    WITH emp AS MATERIALIZED (
      SELECT DISTINCT ON (a.tenant_id, regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g'))
             a.tenant_id,
             regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g') AS cpf,
             a.empresa_id
      FROM public.admissoes a
      WHERE a.empresa_id IS NOT NULL AND COALESCE(a.cpf, '') <> ''
      ORDER BY a.tenant_id, 2, COALESCE(a.inativo, false), a.data_admissao DESC NULLS LAST
    )
    UPDATE public.ponto_espelhos e
    SET empresa_id = m.empresa_id
    FROM emp m
    WHERE e.empresa_id IS NULL
      AND m.tenant_id = e.tenant_id
      AND m.cpf = regexp_replace(COALESCE(e.colaborador_cpf, ''), '[^0-9]', '', 'g');
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE 'ponto_espelhos: % espelhos ganharam empresa.', v_n;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ponto_espelhos não preenchido: %', SQLERRM;
  END;
END $backfill$;


