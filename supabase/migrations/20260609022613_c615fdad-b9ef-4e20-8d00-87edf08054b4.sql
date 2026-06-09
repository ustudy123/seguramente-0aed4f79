-- Criar schema para funções que precisam de acesso sem auth.uid()
CREATE SCHEMA IF NOT EXISTS externo;

-- Mover e recriar a função de listagem
DROP FUNCTION IF EXISTS public.listar_ponto_externo(p_token text, p_dias integer);

CREATE OR REPLACE FUNCTION externo.listar_ponto_externo(p_token text, p_dias integer DEFAULT 45)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link RECORD;
  v_marcacoes JSONB;
  v_ajustes JSONB;
BEGIN
  SELECT * INTO v_link FROM public.ponto_links
  WHERE token = p_token AND ativo = true
    AND (data_expiracao IS NULL OR data_expiracao > now());
  IF NOT FOUND THEN
    RETURN json_build_object('error','Link inválido ou expirado.');
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', m.id,
    'data', m.data_marcacao,
    'hora', m.hora_marcacao,
    'tipo', m.tipo_marcacao
  ) ORDER BY m.data_marcacao DESC, m.hora_marcacao ASC), '[]'::jsonb)
  INTO v_marcacoes
  FROM public.ponto_marcacoes m
  WHERE m.colaborador_id = v_link.colaborador_id::uuid
    AND m.data_marcacao >= (CURRENT_DATE - (p_dias || ' days')::interval)::date
    AND m.data_marcacao <= CURRENT_DATE;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', a.id,
    'data', a.data_referencia,
    'hora', a.hora_solicitada,
    'tipo', a.tipo_marcacao,
    'tipo_ajuste', a.tipo_ajuste,
    'status', a.status,
    'motivo', a.motivo
  ) ORDER BY a.data_referencia DESC, a.created_at DESC), '[]'::jsonb)
  INTO v_ajustes
  FROM public.ponto_ajustes a
  WHERE a.colaborador_id = v_link.colaborador_id::uuid
    AND a.data_referencia >= (CURRENT_DATE - (p_dias || ' days')::interval)::date;

  RETURN json_build_object(
    'success', true,
    'colaborador_nome', v_link.colaborador_nome,
    'marcacoes', v_marcacoes,
    'ajustes', v_ajustes
  );
END;
$$;

-- Garantir acesso às roles anon e authenticated
GRANT USAGE ON SCHEMA externo TO anon, authenticated;
GRANT EXECUTE ON FUNCTION externo.listar_ponto_externo(text, integer) TO anon, authenticated;

-- Mover e recriar a função de submissão
DROP FUNCTION IF EXISTS public.solicitar_ajustes_ponto_externo_batch(p_token text, p_itens jsonb, p_motivo text, p_anexos jsonb);

CREATE OR REPLACE FUNCTION externo.solicitar_ajustes_ponto_externo_batch(
  p_token text,
  p_itens jsonb,
  p_motivo text DEFAULT NULL,
  p_anexos jsonb DEFAULT '[]'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link RECORD;
  v_item JSONB;
  v_data DATE;
  v_hora TIME;
  v_tipo TEXT;
  v_motivo_item TEXT;
  v_now TIMESTAMPTZ := now();
  v_ids UUID[] := ARRAY[]::UUID[];
  v_id UUID;
  v_count INT := 0;
BEGIN
  IF p_itens IS NULL OR jsonb_array_length(p_itens) = 0 THEN
    RETURN json_build_object('error','Inclua ao menos uma marcação para ajuste.');
  END IF;
  IF jsonb_array_length(p_itens) > 40 THEN
    RETURN json_build_object('error','Máximo de 40 ajustes por solicitação.');
  END IF;

  SELECT * INTO v_link FROM public.ponto_links
  WHERE token = p_token AND ativo = true
    AND (data_expiracao IS NULL OR data_expiracao > now());
  IF NOT FOUND THEN
    RETURN json_build_object('error','Link inválido ou expirado.');
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_data := (v_item->>'data')::date;
    v_hora := (v_item->>'hora')::time;
    v_tipo := v_item->>'tipo';
    v_motivo_item := COALESCE(NULLIF(trim(v_item->>'motivo'),''), NULLIF(trim(p_motivo),''));

    IF v_motivo_item IS NULL OR length(v_motivo_item) < 5 THEN
      RETURN json_build_object('error','Cada ajuste precisa de uma justificativa (mín. 5 caracteres).');
    END IF;
    IF v_tipo NOT IN ('entrada','saida','saida_almoco','retorno_almoco') THEN
      RETURN json_build_object('error','Tipo de marcação inválido: ' || COALESCE(v_tipo,'(vazio)'));
    END IF;
    IF v_data IS NULL OR v_hora IS NULL THEN
      RETURN json_build_object('error','Data e hora são obrigatórios para cada ajuste.');
    END IF;
    IF v_data > CURRENT_DATE THEN
      RETURN json_build_object('error','Não é permitido solicitar ajuste para data futura.');
    END IF;
    IF v_data = CURRENT_DATE AND (v_data + v_hora) > v_now THEN
      RETURN json_build_object('error','Não é permitido solicitar ajuste para horário futuro.');
    END IF;

    INSERT INTO public.ponto_ajustes (
      tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
      data_referencia, tipo_ajuste, tipo_marcacao,
      hora_solicitada, motivo, status, created_by_nome, anexos
    ) VALUES (
      v_link.tenant_id, v_link.colaborador_id::uuid, v_link.colaborador_nome, v_link.colaborador_cpf,
      v_data, 'inclusao', v_tipo,
      v_hora, v_motivo_item, 'pendente',
      v_link.colaborador_nome || ' (link externo)', COALESCE(p_anexos, '[]'::jsonb)
    ) RETURNING id INTO v_id;
    v_ids := v_ids || v_id;
    v_count := v_count + 1;
  END LOOP;

  RETURN json_build_object('success', true, 'total', v_count, 'ids', to_jsonb(v_ids));
END;
$$;

GRANT EXECUTE ON FUNCTION externo.solicitar_ajustes_ponto_externo_batch(text, jsonb, text, jsonb) TO anon, authenticated;

-- Criar política para permitir upload de arquivos por usuários anônimos no bucket ponto-ajustes-anexos
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM storage.buckets WHERE id = 'ponto-ajustes-anexos'
    ) THEN
        -- Permitir upload público para o caminho de links externos
        CREATE POLICY "Allow public upload to externo path"
        ON storage.objects FOR INSERT
        TO public
        WITH CHECK (bucket_id = 'ponto-ajustes-anexos' AND (storage.foldername(name))[1] = 'externo');
        
        -- Permitir leitura pública para que o gestor veja os anexos depois (ou via auth)
        -- Aqui mantemos restrito se necessário, mas para o link externo funcionar, o upload precisa ser permitido.
    END IF;
END $$;
