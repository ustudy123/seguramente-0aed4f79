
-- Re-create the policies that were already dropped
-- and create the security definer functions

-- 2. Create security definer function to fetch convite by token
CREATE OR REPLACE FUNCTION public.buscar_convite_por_token(p_token TEXT)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  campanha_id UUID,
  colaborador_id TEXT,
  colaborador_nome TEXT,
  colaborador_cpf TEXT,
  colaborador_cargo TEXT,
  colaborador_departamento TEXT,
  token TEXT,
  status TEXT,
  enviado_via TEXT,
  enviado_em TIMESTAMPTZ,
  iniciado_em TIMESTAMPTZ,
  concluido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  campanha_nome TEXT,
  campanha_descricao TEXT,
  campanha_tipo TEXT,
  campanha_status TEXT,
  campanha_data_inicio TEXT,
  campanha_data_fim TEXT,
  campanha_anonimo BOOLEAN,
  campanha_permite_identificacao_voluntaria BOOLEAN,
  campanha_mensagem_institucional TEXT,
  campanha_politica_uso_dados TEXT,
  campanha_blocos_dinamicos JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    c.id, c.tenant_id, c.campanha_id, c.colaborador_id, c.colaborador_nome,
    c.colaborador_cpf, c.colaborador_cargo, c.colaborador_departamento,
    c.token, c.status::TEXT, c.enviado_via, c.enviado_em, c.iniciado_em,
    c.concluido_em, c.created_at,
    camp.nome, camp.descricao, camp.tipo, camp.status::TEXT,
    camp.data_inicio, camp.data_fim, camp.anonimo,
    camp.permite_identificacao_voluntaria, camp.mensagem_institucional,
    camp.politica_uso_dados, camp.blocos_dinamicos
  FROM public.questionario_psicossocial_convites c
  JOIN public.questionario_psicossocial_campanhas camp ON camp.id = c.campanha_id
  WHERE c.token = UPPER(p_token)
  LIMIT 1;
$$;

-- 3. Create security definer function to update convite status by token
CREATE OR REPLACE FUNCTION public.atualizar_convite_por_token(p_token TEXT, p_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.questionario_psicossocial_convites
  SET 
    status = p_status,
    iniciado_em = CASE WHEN p_status = 'iniciado' THEN NOW() ELSE iniciado_em END,
    concluido_em = CASE WHEN p_status = 'concluido' THEN NOW() ELSE concluido_em END
  WHERE token = UPPER(p_token);
END;
$$;

-- 4. Create security definer function to save response via token
CREATE OR REPLACE FUNCTION public.salvar_resposta_psicossocial(
  p_token TEXT,
  p_respostas JSONB,
  p_indicadores JSONB,
  p_identificacao_voluntaria BOOLEAN,
  p_tempo_segundos INTEGER,
  p_user_agent TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_convite RECORD;
BEGIN
  SELECT * INTO v_convite
  FROM public.questionario_psicossocial_convites
  WHERE token = UPPER(p_token);

  IF v_convite IS NULL THEN
    RAISE EXCEPTION 'Convite não encontrado';
  END IF;

  IF v_convite.status = 'concluido' THEN
    RAISE EXCEPTION 'Este questionário já foi respondido';
  END IF;

  INSERT INTO public.questionario_psicossocial_respostas (
    tenant_id, campanha_id, convite_id, colaborador_id,
    respostas, indicadores, identificacao_voluntaria,
    tempo_resposta_segundos, user_agent, concluido_em
  ) VALUES (
    v_convite.tenant_id, v_convite.campanha_id, v_convite.id,
    v_convite.colaborador_id, p_respostas, p_indicadores,
    p_identificacao_voluntaria, p_tempo_segundos, p_user_agent, NOW()
  );

  UPDATE public.questionario_psicossocial_convites
  SET status = 'concluido', concluido_em = NOW()
  WHERE id = v_convite.id;
END;
$$;

-- 5. Grant execute permissions to anon role
GRANT EXECUTE ON FUNCTION public.buscar_convite_por_token(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.atualizar_convite_por_token(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.salvar_resposta_psicossocial(TEXT, JSONB, JSONB, BOOLEAN, INTEGER, TEXT) TO anon;
