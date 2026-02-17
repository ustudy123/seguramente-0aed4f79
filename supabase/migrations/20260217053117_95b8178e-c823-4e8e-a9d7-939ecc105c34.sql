
-- Tabela de respostas dos eixos de bem-estar
CREATE TABLE public.bem_estar_respostas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  user_id UUID NOT NULL,
  eixo TEXT NOT NULL, -- autoconhecimento, sentido, relacoes, autonomia, autorrealizacao, atencao_plena, gratidao
  tipo TEXT NOT NULL, -- slider, reflexao, micro_acao
  valor_numerico INTEGER, -- 1-5 para sliders
  valor_texto TEXT, -- respostas textuais
  opcao_selecionada TEXT, -- para múltipla escolha
  anonimo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de entradas de gratidão
CREATE TABLE public.bem_estar_gratidao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  user_id UUID NOT NULL,
  conteudo TEXT, -- texto curto ou emoji
  tipo TEXT DEFAULT 'texto', -- texto, emoji
  anonimo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de configuração dos eixos (dados agregados para dashboard RH)
CREATE TABLE public.bem_estar_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  eixo TEXT NOT NULL,
  pergunta_ativa TEXT,
  frequencia_pergunta TEXT DEFAULT 'semanal', -- semanal, quinzenal
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bem_estar_respostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bem_estar_gratidao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bem_estar_config ENABLE ROW LEVEL SECURITY;

-- Policies for respostas (users can only see/manage their own)
CREATE POLICY "Users can view own respostas" ON public.bem_estar_respostas
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own respostas" ON public.bem_estar_respostas
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies for gratidão
CREATE POLICY "Users can view own gratidao" ON public.bem_estar_gratidao
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own gratidao" ON public.bem_estar_gratidao
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies for config (tenant-wide read, admin write)
CREATE POLICY "Users can view config" ON public.bem_estar_config
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid())
  );
CREATE POLICY "Admins can manage config" ON public.bem_estar_config
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Indexes
CREATE INDEX idx_bem_estar_respostas_user ON public.bem_estar_respostas(user_id, eixo);
CREATE INDEX idx_bem_estar_respostas_tenant ON public.bem_estar_respostas(tenant_id, eixo, created_at);
CREATE INDEX idx_bem_estar_gratidao_user ON public.bem_estar_gratidao(user_id, created_at);
