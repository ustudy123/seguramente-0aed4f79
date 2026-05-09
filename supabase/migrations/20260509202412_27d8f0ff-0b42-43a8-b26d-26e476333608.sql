
ALTER TABLE public.questionario_psicossocial_respostas
  ADD COLUMN IF NOT EXISTS cpf_hash text;

CREATE INDEX IF NOT EXISTS idx_qps_respostas_campanha_cpfhash
  ON public.questionario_psicossocial_respostas (campanha_id, cpf_hash);

CREATE OR REPLACE FUNCTION public.validar_cpf_colaborador_campanha(p_campanha_id uuid, p_cpf text, p_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_empresa_id uuid;
  v_cpf_limpo text;
  v_existe boolean;
  v_ja_respondeu boolean;
BEGIN
  v_cpf_limpo := regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g');

  IF length(v_cpf_limpo) <> 11 THEN
    RETURN jsonb_build_object('valido_colaborador', false, 'ja_respondeu', false, 'erro', 'CPF inválido');
  END IF;

  SELECT tenant_id, empresa_id INTO v_tenant_id, v_empresa_id
  FROM public.questionario_psicossocial_campanhas
  WHERE id = p_campanha_id;

  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('valido_colaborador', false, 'ja_respondeu', false, 'erro', 'Campanha não encontrada');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.admissoes a
    WHERE a.tenant_id = v_tenant_id
      AND a.status = 'concluido'
      AND regexp_replace(coalesce(a.cpf, ''), '[^0-9]', '', 'g') = v_cpf_limpo
      AND (v_empresa_id IS NULL OR a.empresa_id = v_empresa_id)
  ) INTO v_existe;

  SELECT EXISTS (
    SELECT 1
    FROM public.questionario_psicossocial_respostas r
    WHERE r.campanha_id = p_campanha_id
      AND r.cpf_hash = p_hash
  ) INTO v_ja_respondeu;

  RETURN jsonb_build_object(
    'valido_colaborador', v_existe,
    'ja_respondeu', coalesce(v_ja_respondeu, false)
  );
END;
$function$;
