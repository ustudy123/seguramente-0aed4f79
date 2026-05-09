
-- Adiciona snapshots de segmento (cargo, setor, unidade, GHE) nas respostas vindas de token de participação
ALTER TABLE public.questionario_psicossocial_respostas
  ADD COLUMN IF NOT EXISTS participacao_id uuid REFERENCES public.psicossocial_participacoes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS setor_snapshot text,
  ADD COLUMN IF NOT EXISTS cargo_snapshot text,
  ADD COLUMN IF NOT EXISTS unidade_snapshot text,
  ADD COLUMN IF NOT EXISTS ghe_id_snapshot uuid,
  ADD COLUMN IF NOT EXISTS ghe_nome_snapshot text;

CREATE INDEX IF NOT EXISTS idx_resp_psico_segmento
  ON public.questionario_psicossocial_respostas (campanha_id, setor_snapshot, cargo_snapshot, ghe_id_snapshot);

-- Reescreve a RPC para popular os snapshots e resolver GHE no momento da gravação
CREATE OR REPLACE FUNCTION public.salvar_resposta_por_token_participacao(
  p_token text,
  p_respostas jsonb,
  p_indicadores jsonb,
  p_tempo_segundos integer DEFAULT 0,
  p_user_agent text DEFAULT NULL,
  p_cpf_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_part RECORD;
  v_resposta_id uuid;
  v_ja boolean;
  v_ghe_id uuid;
  v_ghe_nome text;
  v_cargo_id uuid;
  v_dept_id uuid;
BEGIN
  SELECT
    p.id, p.campanha_id, p.tenant_id,
    p.respondido, p.setor, p.cargo, p.unidade, p.turno,
    c.status AS campanha_status
  INTO v_part
  FROM public.psicossocial_participacoes p
  JOIN public.questionario_psicossocial_campanhas c ON c.id = p.campanha_id
  WHERE p.token = p_token
  FOR UPDATE OF p
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Token inválido');
  END IF;
  IF v_part.respondido THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Este link já foi utilizado');
  END IF;
  IF v_part.campanha_status != 'ativa' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Campanha não está ativa');
  END IF;

  -- Trava de duplicidade de CPF dentro da mesma campanha
  IF p_cpf_hash IS NOT NULL AND length(p_cpf_hash) > 0 THEN
    SELECT EXISTS (
      SELECT 1 FROM public.questionario_psicossocial_respostas
      WHERE campanha_id = v_part.campanha_id AND cpf_hash = p_cpf_hash
    ) INTO v_ja;
    IF v_ja THEN
      RAISE EXCEPTION 'Este CPF já respondeu esta campanha.' USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  -- Resolve cargo_id e departamento_id pelo nome (case-insensitive)
  IF v_part.cargo IS NOT NULL THEN
    SELECT id INTO v_cargo_id
    FROM public.cargos
    WHERE tenant_id = v_part.tenant_id
      AND lower(nome) = lower(v_part.cargo)
    LIMIT 1;
  END IF;

  IF v_part.setor IS NOT NULL THEN
    SELECT id INTO v_dept_id
    FROM public.departamentos
    WHERE tenant_id = v_part.tenant_id
      AND lower(nome) = lower(v_part.setor)
    LIMIT 1;
  END IF;

  -- Lookup do GHE
  IF v_cargo_id IS NOT NULL OR v_dept_id IS NOT NULL THEN
    SELECT g.id, g.nome INTO v_ghe_id, v_ghe_nome
    FROM public.psicossocial_ghe g
    JOIN public.psicossocial_ghe_cargos gc ON gc.ghe_id = g.id
    WHERE g.tenant_id = v_part.tenant_id
      AND g.ativo = true
      AND (
        (v_cargo_id IS NOT NULL AND gc.cargo_id = v_cargo_id)
        OR (v_dept_id IS NOT NULL AND gc.departamento_id = v_dept_id)
      )
    LIMIT 1;
  END IF;

  UPDATE public.psicossocial_participacoes
  SET respondido = TRUE, respondido_em = NOW()
  WHERE id = v_part.id;

  INSERT INTO public.questionario_psicossocial_respostas (
    tenant_id, campanha_id, convite_id, colaborador_id,
    respostas, indicadores, tempo_resposta_segundos, user_agent,
    identificacao_voluntaria, cpf_hash,
    participacao_id, setor_snapshot, cargo_snapshot, unidade_snapshot,
    ghe_id_snapshot, ghe_nome_snapshot
  ) VALUES (
    v_part.tenant_id, v_part.campanha_id, NULL, NULL,
    p_respostas, p_indicadores, p_tempo_segundos, p_user_agent,
    FALSE, p_cpf_hash,
    v_part.id, v_part.setor, v_part.cargo, v_part.unidade,
    v_ghe_id, v_ghe_nome
  )
  RETURNING id INTO v_resposta_id;

  RETURN jsonb_build_object('sucesso', true, 'resposta_id', v_resposta_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.salvar_resposta_por_token_participacao(text, jsonb, jsonb, integer, text, text) TO anon, authenticated;
