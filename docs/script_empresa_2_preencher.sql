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
-- O mapa CPF -> empresa é montado UMA vez, numa tabela temporária com
-- índice. Chamar ponto_empresa_do_cpf() dentro do UPDATE parece mais
-- simples, mas roda a função (e uma varredura das admissões) por linha:
-- em 60 mil dias de ponto isso levou 29 s no banco de teste, e em
-- produção estourou o tempo limite do editor. Por junção: 0,3 s.
DROP TABLE IF EXISTS _empresa_do_cpf;
CREATE TEMP TABLE _empresa_do_cpf AS
SELECT DISTINCT ON (a.tenant_id, regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g'))
       a.tenant_id,
       regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g') AS cpf,
       a.empresa_id
FROM public.admissoes a
WHERE a.empresa_id IS NOT NULL
  AND COALESCE(a.cpf, '') <> ''
ORDER BY a.tenant_id, 2, COALESCE(a.inativo, false), a.data_admissao DESC NULLS LAST;

CREATE INDEX ON _empresa_do_cpf (tenant_id, cpf);
ANALYZE _empresa_do_cpf;

-- Uma tabela por bloco: se uma falhar, as outras continuam preenchidas.
DO $backfill$
DECLARE
  v_n int := 0;
BEGIN
  BEGIN
    UPDATE public.ponto_diario pd
    SET empresa_id = m.empresa_id,
        updated_at = now()
    FROM _empresa_do_cpf m
    WHERE pd.empresa_id IS NULL
      AND m.tenant_id = pd.tenant_id
      AND m.cpf = regexp_replace(COALESCE(pd.colaborador_cpf, ''), '[^0-9]', '', 'g');
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE 'ponto_diario: % dias ganharam empresa.', v_n;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ponto_diario não preenchido: %', SQLERRM;
  END;

  BEGIN
    UPDATE public.ponto_banco_horas bh
    SET empresa_id = m.empresa_id,
        updated_at = now()
    FROM _empresa_do_cpf m
    WHERE bh.empresa_id IS NULL
      AND m.tenant_id = bh.tenant_id
      AND m.cpf = regexp_replace(COALESCE(bh.colaborador_cpf, ''), '[^0-9]', '', 'g');
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE 'ponto_banco_horas: % registros ganharam empresa.', v_n;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ponto_banco_horas não preenchido: %', SQLERRM;
  END;

  BEGIN
    UPDATE public.ponto_espelhos e
    SET empresa_id = m.empresa_id
    FROM _empresa_do_cpf m
    WHERE e.empresa_id IS NULL
      AND m.tenant_id = e.tenant_id
      AND m.cpf = regexp_replace(COALESCE(e.colaborador_cpf, ''), '[^0-9]', '', 'g');
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE 'ponto_espelhos: % espelhos ganharam empresa.', v_n;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ponto_espelhos não preenchido: %', SQLERRM;
  END;
END $backfill$;

DROP TABLE IF EXISTS _empresa_do_cpf;


