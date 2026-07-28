-- ============================================================================
-- Psicossocial: preencher ghe_id_snapshot das respostas (estratificação por GHE)
--
-- PROBLEMA: as funções de gravação de resposta anônima
-- (salvar_resposta_anonima_campanha / salvar_resposta_por_token_participacao)
-- nunca gravaram ghe_id_snapshot. Resultado: 100% das respostas ficam sem GHE,
-- e o relatório/plano de ação/tela de resultados replicam o agregado da
-- campanha em TODOS os GHEs — todos com o mesmo score.
--
-- SOLUÇÃO: reaproveitar exatamente o cruzamento que contar_respondentes_por_ghe
-- já faz — cpf_hash -> admissão (cargo|depto) -> GHE — mas para PERSISTIR o
-- ghe_id_snapshot na resposta, em vez de só contar.
--
-- ANONIMATO (LGPD): idêntico à função de contagem. O CPF nunca sai do banco; o
-- cruzamento usa o hash SHA-256(cpf || '::' || campanha_id) que a resposta já
-- grava. O hash inclui o campanha_id, então o mesmo CPF gera hashes diferentes
-- por campanha — não rastreia a pessoa entre campanhas.
--
-- IMPORTANTE: o passado anônimo continua anônimo. Isto não "descobre quem
-- respondeu"; apenas atribui cada resposta ao GHE ao qual o cargo/depto da
-- pessoa pertence, que é agregação, não identificação.
--
-- Quando um cpf_hash casa mais de um GHE (composição sobreposta), fica com o de
-- menor código — determinístico. Quando não casa nenhum, permanece NULL e a
-- resposta segue contando só no consolidado.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.preencher_ghe_snapshot_respostas(p_campanha_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_tenant     uuid;
  v_atualizadas integer := 0;
BEGIN
  IF p_campanha_ids IS NULL OR array_length(p_campanha_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  -- Segurança: só o tenant dono das campanhas.
  SELECT DISTINCT c.tenant_id INTO v_tenant
    FROM public.questionario_psicossocial_campanhas c
   WHERE c.id = ANY(p_campanha_ids)
   LIMIT 1;

  IF v_tenant IS NULL OR v_tenant <> public.get_user_tenant_id() THEN
    RAISE EXCEPTION 'Sem permissão para estas campanhas.';
  END IF;

  WITH
  camp AS (
    SELECT c.id AS campanha_id, c.empresa_id, c.tenant_id
      FROM public.questionario_psicossocial_campanhas c
     WHERE c.id = ANY(p_campanha_ids)
  ),
  -- Admissões ativas, com o hash reproduzido por campanha
  adm AS (
    SELECT
      cm.campanha_id,
      encode(
        digest(
          convert_to(regexp_replace(a.cpf, '[^0-9]', '', 'g') || '::' || cm.campanha_id::text, 'UTF8'),
          'sha256'::text
        ),
        'hex'
      ) AS cpf_hash,
      lower(trim(a.cargo))        AS cargo,
      lower(trim(a.departamento)) AS depto
    FROM public.admissoes a
    JOIN camp cm
      ON cm.tenant_id = a.tenant_id
     AND (cm.empresa_id IS NULL OR cm.empresa_id = a.empresa_id)
    WHERE a.cpf IS NOT NULL AND a.cpf <> ''
      AND (a.status IS NULL OR lower(a.status::text) NOT IN ('desligado','demitido','inativo'))
  ),
  ghes_empresa AS (
    SELECT g.id AS ghe_id, g.codigo
      FROM public.psicossocial_ghe g
      JOIN camp cm
        ON cm.tenant_id = g.tenant_id
       AND (g.empresa_id IS NULL OR cm.empresa_id IS NULL OR g.empresa_id = cm.empresa_id)
  ),
  ghe_pares AS (
    SELECT
      gc.ghe_id,
      ge.codigo,
      lower(trim(c.nome))               AS cargo,
      COALESCE(lower(trim(d.nome)), '')  AS depto
    FROM public.psicossocial_ghe_cargos gc
    JOIN ghes_empresa ge      ON ge.ghe_id = gc.ghe_id
    JOIN public.cargos c      ON c.id = gc.cargo_id
    LEFT JOIN public.departamentos d ON d.id = gc.departamento_id
  ),
  resp AS (
    SELECT r.id AS resposta_id, r.campanha_id, r.cpf_hash
      FROM public.questionario_psicossocial_respostas r
     WHERE r.campanha_id = ANY(p_campanha_ids)
       AND r.cpf_hash IS NOT NULL AND r.cpf_hash <> ''
       AND r.ghe_id_snapshot IS NULL   -- só as que ainda não têm
  ),
  -- resposta -> admissão (hash) -> GHE (cargo|depto). Quando casa mais de um
  -- GHE, escolhe o de menor código (determinístico).
  resp_ghe AS (
    SELECT DISTINCT ON (r.resposta_id)
      r.resposta_id,
      gp.ghe_id
    FROM resp r
    JOIN adm a
      ON a.campanha_id = r.campanha_id
     AND a.cpf_hash    = r.cpf_hash
    JOIN ghe_pares gp
      ON gp.cargo = a.cargo
     AND (gp.depto = a.depto OR gp.depto = '')
    ORDER BY r.resposta_id, gp.codigo NULLS LAST
  )
  UPDATE public.questionario_psicossocial_respostas r
     SET ghe_id_snapshot = rg.ghe_id,
         ghe_nome_snapshot = (SELECT nome FROM public.psicossocial_ghe WHERE id = rg.ghe_id)
    FROM resp_ghe rg
   WHERE r.id = rg.resposta_id
     AND rg.ghe_id IS NOT NULL;

  GET DIAGNOSTICS v_atualizadas = ROW_COUNT;
  RETURN v_atualizadas;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.preencher_ghe_snapshot_respostas(uuid[]) TO authenticated;
