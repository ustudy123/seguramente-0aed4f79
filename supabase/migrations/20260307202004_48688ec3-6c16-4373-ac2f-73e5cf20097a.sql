
-- ============================================================
-- CONTROLE DE PARTICIPAÇÃO PSICOSSOCIAL
-- Modelo: Identificação técnica + Anonimização analítica
-- O sistema SABE quem respondeu, mas o RELATÓRIO não sabe
-- ============================================================

CREATE TABLE IF NOT EXISTS public.psicossocial_participacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campanha_id UUID NOT NULL REFERENCES public.questionario_psicossocial_campanhas(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  colaborador_id TEXT,
  colaborador_nome TEXT,
  colaborador_cpf TEXT,
  setor TEXT,
  cargo TEXT,
  unidade TEXT,
  turno TEXT,
  elegivel BOOLEAN NOT NULL DEFAULT TRUE,
  respondido BOOLEAN NOT NULL DEFAULT FALSE,
  respondido_em TIMESTAMPTZ,
  enviado_via TEXT DEFAULT 'link',
  enviado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (campanha_id, colaborador_cpf)
);

CREATE INDEX IF NOT EXISTS idx_participacoes_campanha ON public.psicossocial_participacoes(campanha_id);
CREATE INDEX IF NOT EXISTS idx_participacoes_token ON public.psicossocial_participacoes(token);
CREATE INDEX IF NOT EXISTS idx_participacoes_tenant ON public.psicossocial_participacoes(tenant_id);

ALTER TABLE public.psicossocial_participacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_can_manage_participacoes"
  ON public.psicossocial_participacoes
  FOR ALL
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE TRIGGER update_participacoes_updated_at
  BEFORE UPDATE ON public.psicossocial_participacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RPC: Validar token de participação (público, sem auth)
CREATE OR REPLACE FUNCTION public.validar_token_participacao(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec RECORD;
BEGIN
  SELECT
    p.id AS participacao_id,
    p.respondido,
    p.setor,
    p.cargo,
    p.unidade,
    p.turno,
    c.id AS campanha_id,
    c.nome AS campanha_nome,
    c.descricao AS campanha_descricao,
    c.status AS campanha_status,
    c.instrumento,
    c.data_inicio,
    c.data_fim,
    c.mensagem_institucional,
    c.politica_uso_dados
  INTO v_rec
  FROM public.psicossocial_participacoes p
  JOIN public.questionario_psicossocial_campanhas c ON c.id = p.campanha_id
  WHERE p.token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valido', false, 'erro', 'Link inválido ou expirado');
  END IF;

  IF v_rec.respondido THEN
    RETURN jsonb_build_object('valido', false, 'erro', 'Este link já foi utilizado. Cada colaborador pode responder apenas uma vez.');
  END IF;

  IF v_rec.campanha_status != 'ativa' THEN
    RETURN jsonb_build_object('valido', false, 'erro', 'Esta campanha não está mais ativa');
  END IF;

  RETURN jsonb_build_object(
    'valido', true,
    'participacao_id', v_rec.participacao_id,
    'campanha_id', v_rec.campanha_id,
    'campanha_nome', v_rec.campanha_nome,
    'campanha_descricao', v_rec.campanha_descricao,
    'campanha_status', v_rec.campanha_status,
    'instrumento', v_rec.instrumento,
    'data_inicio', v_rec.data_inicio,
    'data_fim', v_rec.data_fim,
    'mensagem_institucional', v_rec.mensagem_institucional,
    'politica_uso_dados', v_rec.politica_uso_dados,
    'setor', v_rec.setor,
    'cargo', v_rec.cargo,
    'unidade', v_rec.unidade,
    'turno', v_rec.turno
  );
END;
$$;

-- RPC: Salvar resposta por token de participação (público, sem auth)
CREATE OR REPLACE FUNCTION public.salvar_resposta_por_token_participacao(
  p_token TEXT,
  p_respostas JSONB,
  p_indicadores JSONB,
  p_tempo_segundos INTEGER DEFAULT 0,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_part RECORD;
  v_resposta_id UUID;
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

  UPDATE public.psicossocial_participacoes
  SET respondido = TRUE,
      respondido_em = NOW()
  WHERE id = v_part.id;

  INSERT INTO public.questionario_psicossocial_respostas (
    tenant_id,
    campanha_id,
    convite_id,
    colaborador_id,
    colaborador_nome,
    setor,
    cargo,
    respostas,
    indicadores,
    tempo_resposta_segundos,
    user_agent,
    ip_hash
  ) VALUES (
    v_part.tenant_id,
    v_part.campanha_id,
    NULL,
    NULL,
    NULL,
    v_part.setor,
    v_part.cargo,
    p_respostas,
    p_indicadores,
    p_tempo_segundos,
    p_user_agent,
    NULL
  )
  RETURNING id INTO v_resposta_id;

  RETURN jsonb_build_object('sucesso', true, 'resposta_id', v_resposta_id);
END;
$$;

-- VIEW: Estatísticas de participação por campanha
CREATE OR REPLACE VIEW public.psicossocial_participacao_stats AS
SELECT
  campanha_id,
  tenant_id,
  COUNT(*) AS total_elegiveis,
  COUNT(*) FILTER (WHERE respondido = TRUE) AS total_responderam,
  ROUND(
    COUNT(*) FILTER (WHERE respondido = TRUE)::NUMERIC / NULLIF(COUNT(*), 0) * 100,
    1
  ) AS taxa_participacao
FROM public.psicossocial_participacoes
GROUP BY campanha_id, tenant_id;

GRANT SELECT ON public.psicossocial_participacao_stats TO authenticated;
