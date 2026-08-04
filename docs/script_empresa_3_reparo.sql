-- =====================================================================
-- Fechamento por empresa: devolver quem foi carimbado errado
-- Parte 3 de 4 — rode UMA parte por vez, na ordem.
--
-- Por que em partes: o editor do Supabase roda o arquivo inteiro numa
-- transação só e tem tempo limite. Se uma parte estourar, tudo o que
-- veio antes é descartado. Em quatro execuções curtas, cada uma se
-- garante sozinha.
-- =====================================================================

-- SET statement_timeout = '600s';
-- =====================================================================
-- Limpar o que o fechamento sem empresa deixou carimbado errado
--
-- Complemento do 20260804230000. Aquele conserta daqui para a frente e
-- preenche o que estava em branco. Falta o que ficou preenchido ERRADO:
-- enquanto o "Fechar Período" ignorava a empresa selecionada, ele
-- carimbava TODO colaborador do tenant com a empresa que estava na barra
-- do topo. Quem é da empresa B ficou registrado como se fosse da A.
--
-- O critério do reparo é estreito de propósito:
--   corrige só a linha cuja empresa NÃO É NENHUMA das empresas em que
--   aquele CPF tem admissão.
--
-- Isso separa o carimbo errado da atribuição legítima. Quem trocou de
-- empresa no meio da história tem ponto antigo na empresa antiga — e ali
-- a empresa da linha É uma das empresas do CPF, então nada é tocado.
-- Realinhar tudo pelo cadastro atual reescreveria o passado dessas
-- pessoas, que é justamente o que um espelho não pode sofrer.
--
-- Não mexe em ponto_fechamentos: os totais dele foram somados sobre o
-- tenant inteiro e não têm conserto por UPDATE — é refazer o fechamento,
-- agora por empresa.
-- =====================================================================

-- DIAGNÓSTICO — rode antes, para ver o tamanho do estrago -------------
CREATE OR REPLACE FUNCTION public.ponto_empresa_atribuida_errada(p_tenant_id uuid)
RETURNS TABLE(
  tabela text,
  colaborador_cpf text,
  colaborador_nome text,
  competencia text,
  empresa_atual uuid,
  empresa_do_cadastro uuid
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH errado AS (
    SELECT 'ponto_espelhos'::text AS tabela, e.colaborador_cpf, e.colaborador_nome,
           e.competencia, e.empresa_id, e.tenant_id
    FROM public.ponto_espelhos e
    WHERE e.tenant_id = p_tenant_id AND e.empresa_id IS NOT NULL
    UNION ALL
    SELECT 'ponto_banco_horas', b.colaborador_cpf, b.colaborador_nome,
           b.competencia, b.empresa_id, b.tenant_id
    FROM public.ponto_banco_horas b
    WHERE b.tenant_id = p_tenant_id AND b.empresa_id IS NOT NULL
  )
  SELECT x.tabela, x.colaborador_cpf, x.colaborador_nome, x.competencia,
         x.empresa_id, public.ponto_empresa_do_cpf(x.tenant_id, x.colaborador_cpf)
  FROM errado x
  WHERE NOT EXISTS (
    SELECT 1 FROM public.admissoes a
    WHERE a.tenant_id = x.tenant_id
      AND a.empresa_id = x.empresa_id
      AND regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g')
          = regexp_replace(COALESCE(x.colaborador_cpf, ''), '[^0-9]', '', 'g')
  )
  ORDER BY 1, 3, 4;
$$;

REVOKE EXECUTE ON FUNCTION public.ponto_empresa_atribuida_errada(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ponto_empresa_atribuida_errada(uuid) TO authenticated;

COMMENT ON FUNCTION public.ponto_empresa_atribuida_errada(uuid) IS
  'Espelhos e bancos de horas atribuídos a uma empresa em que o colaborador não tem admissão — resíduo do fechamento que ignorava a empresa selecionada.';


-- REPARO ---------------------------------------------------------------
-- Cada UPDATE é um comando único e autossuficiente, com dois mapas como
-- CTE MATERIALIZED:
--   emp      -> a empresa correta de cada CPF
--   vinculos -> todas as empresas em que aquele CPF já teve admissão
--
-- Nada de tabela temporária: o editor do Supabase não garante a mesma
-- sessão entre um comando e outro, e a tabela criada num comando não era
-- encontrada no seguinte. E nada de chamar a função por linha: em base
-- grande isso esgota o tempo.

DO $reparo$
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
    ),
    vinculos AS MATERIALIZED (
      SELECT DISTINCT a.tenant_id,
             regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g') AS cpf,
             a.empresa_id
      FROM public.admissoes a
      WHERE a.empresa_id IS NOT NULL AND COALESCE(a.cpf, '') <> ''
    )
    UPDATE public.ponto_espelhos e
    SET empresa_id = m.empresa_id
    FROM emp m
    WHERE e.empresa_id IS NOT NULL
      AND m.tenant_id = e.tenant_id
      AND m.cpf = regexp_replace(COALESCE(e.colaborador_cpf, ''), '[^0-9]', '', 'g')
      AND m.empresa_id IS DISTINCT FROM e.empresa_id
      AND NOT EXISTS (
        SELECT 1 FROM vinculos v
        WHERE v.tenant_id = e.tenant_id AND v.cpf = m.cpf AND v.empresa_id = e.empresa_id
      );
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE 'ponto_espelhos: % espelhos devolvidos à empresa certa.', v_n;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ponto_espelhos não corrigido: %', SQLERRM;
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
    ),
    vinculos AS MATERIALIZED (
      SELECT DISTINCT a.tenant_id,
             regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g') AS cpf,
             a.empresa_id
      FROM public.admissoes a
      WHERE a.empresa_id IS NOT NULL AND COALESCE(a.cpf, '') <> ''
    )
    UPDATE public.ponto_banco_horas b
    SET empresa_id = m.empresa_id,
        updated_at = now()
    FROM emp m
    WHERE b.empresa_id IS NOT NULL
      AND m.tenant_id = b.tenant_id
      AND m.cpf = regexp_replace(COALESCE(b.colaborador_cpf, ''), '[^0-9]', '', 'g')
      AND m.empresa_id IS DISTINCT FROM b.empresa_id
      AND NOT EXISTS (
        SELECT 1 FROM vinculos v
        WHERE v.tenant_id = b.tenant_id AND v.cpf = m.cpf AND v.empresa_id = b.empresa_id
      );
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE 'ponto_banco_horas: % registros devolvidos à empresa certa.', v_n;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ponto_banco_horas não corrigido: %', SQLERRM;
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
    ),
    vinculos AS MATERIALIZED (
      SELECT DISTINCT a.tenant_id,
             regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g') AS cpf,
             a.empresa_id
      FROM public.admissoes a
      WHERE a.empresa_id IS NOT NULL AND COALESCE(a.cpf, '') <> ''
    )
    UPDATE public.ponto_diario d
    SET empresa_id = m.empresa_id,
        updated_at = now()
    FROM emp m
    WHERE d.empresa_id IS NOT NULL
      AND m.tenant_id = d.tenant_id
      AND m.cpf = regexp_replace(COALESCE(d.colaborador_cpf, ''), '[^0-9]', '', 'g')
      AND m.empresa_id IS DISTINCT FROM d.empresa_id
      AND NOT EXISTS (
        SELECT 1 FROM vinculos v
        WHERE v.tenant_id = d.tenant_id AND v.cpf = m.cpf AND v.empresa_id = d.empresa_id
      );
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE 'ponto_diario: % dias devolvidos à empresa certa.', v_n;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ponto_diario não corrigido: %', SQLERRM;
  END;
END $reparo$;
