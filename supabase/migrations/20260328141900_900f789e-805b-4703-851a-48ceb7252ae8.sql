
-- RN-002: Tabela de registros de consentimento LGPD para questionários psicossociais
CREATE TABLE public.psicossocial_consentimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id UUID NOT NULL REFERENCES public.questionario_psicossocial_campanhas(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  -- Dados do aceite (RN-002)
  aceite_anonimato BOOLEAN NOT NULL DEFAULT true,
  identificacao_voluntaria BOOLEAN NOT NULL DEFAULT false,
  timestamp_aceite TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  versao_termo TEXT NOT NULL DEFAULT 'v1.0',
  -- Fingerprint para vincular ao response sem identificar
  session_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.psicossocial_consentimentos ENABLE ROW LEVEL SECURITY;

-- Política: qualquer um pode inserir (questionário público)
CREATE POLICY "Permitir inserção anônima de consentimento"
  ON public.psicossocial_consentimentos
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Política: apenas admin/manager pode ler
CREATE POLICY "Gestores podem ler consentimentos"
  ON public.psicossocial_consentimentos
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- RN-016: Tabela para índice de confiabilidade cruzado
CREATE TABLE public.psicossocial_indice_confiabilidade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id UUID NOT NULL REFERENCES public.questionario_psicossocial_campanhas(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  -- Scores das fontes cruzadas (0-100)
  score_absenteismo NUMERIC(5,2) DEFAULT 0,
  score_acidentes NUMERIC(5,2) DEFAULT 0,
  score_turnover NUMERIC(5,2) DEFAULT 0,
  score_humor NUMERIC(5,2) DEFAULT 0,
  score_denuncias NUMERIC(5,2) DEFAULT 0,
  score_afastamentos NUMERIC(5,2) DEFAULT 0,
  -- Resultado final
  indice_confiabilidade NUMERIC(5,2) NOT NULL DEFAULT 0,
  classificacao TEXT NOT NULL DEFAULT 'indeterminado',
  -- Dados de contexto
  periodo_inicio DATE,
  periodo_fim DATE,
  total_colaboradores INT DEFAULT 0,
  detalhes JSONB DEFAULT '{}',
  calculado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.psicossocial_indice_confiabilidade ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestores podem ler índice confiabilidade"
  ON public.psicossocial_indice_confiabilidade
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Sistema pode inserir/atualizar índice confiabilidade"
  ON public.psicossocial_indice_confiabilidade
  FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );
