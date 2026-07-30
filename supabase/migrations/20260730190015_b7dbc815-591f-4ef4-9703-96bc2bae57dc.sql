CREATE OR REPLACE FUNCTION public.preencher_ghe_snapshot_respostas(p_campanha_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_tenant uuid;
  v_count integer := 0;
BEGIN
  IF p_campanha_ids IS NULL OR array_length(p_campanha_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  SELECT DISTINCT c.tenant_id INTO v_tenant
  FROM public.questionario_psicossocial_campanhas c
  WHERE c.id = ANY(p_campanha_ids)
  LIMIT 1;

  IF v_tenant IS NULL OR v_tenant <> public.get_user_tenant_id() THEN
    RAISE EXCEPTION 'Sem permissão para estas campanhas.';
  END IF;

  WITH camp AS (
    SELECT c.id AS campanha_id, c.empresa_id, c.tenant_id
    FROM public.questionario_psicossocial_campanhas c
    WHERE c.id = ANY(p_campanha_ids)
  ),
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
    SELECT DISTINCT g.id AS ghe_id
    FROM public.psicossocial_ghe g
    JOIN camp cm
      ON cm.tenant_id = g.tenant_id
     AND (g.empresa_id IS NULL OR cm.empresa_id IS NULL OR g.empresa_id = cm.empresa_id)
  ),
  ghe_pares AS (
    SELECT
      gc.ghe_id,
      lower(trim(c.nome))               AS cargo,
      COALESCE(lower(trim(d.nome)), '') AS depto
    FROM public.psicossocial_ghe_cargos gc
    JOIN public.cargos c ON c.id = gc.cargo_id
    LEFT JOIN public.departamentos d ON d.id = gc.departamento_id
    WHERE gc.ghe_id IN (SELECT ghe_id FROM ghes_empresa)
  ),
  resp AS (
    SELECT r.id AS resposta_id, r.campanha_id, r.cpf_hash
    FROM public.questionario_psicossocial_respostas r
    WHERE r.campanha_id = ANY(p_campanha_ids)
      AND r.ghe_id_snapshot IS NULL
      AND r.cpf_hash IS NOT NULL AND r.cpf_hash <> ''
  ),
  resp_ghe AS (
    SELECT DISTINCT r.resposta_id, gp.ghe_id
    FROM resp r
    JOIN adm a
      ON a.campanha_id = r.campanha_id
     AND a.cpf_hash    = r.cpf_hash
    JOIN ghe_pares gp
      ON gp.cargo = a.cargo
     AND (gp.depto = a.depto OR gp.depto = '')
  ),
  unicos AS (
    SELECT resposta_id, min(ghe_id) AS ghe_id
    FROM resp_ghe
    GROUP BY resposta_id
    HAVING count(DISTINCT ghe_id) = 1
  )
  UPDATE public.questionario_psicossocial_respostas r
  SET ghe_id_snapshot   = u.ghe_id,
      ghe_nome_snapshot = g.nome
  FROM unicos u
  JOIN public.psicossocial_ghe g ON g.id = u.ghe_id
  WHERE r.id = u.resposta_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.preencher_ghe_snapshot_respostas(uuid[]) TO authenticated;