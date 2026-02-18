
-- Tabela para respostas de percepção cultural no onboarding
CREATE TABLE public.onboarding_percepcao_cultural (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  processo_id UUID REFERENCES public.onboarding_processos(id) ON DELETE CASCADE,
  colaborador_id TEXT NOT NULL,
  colaborador_nome TEXT NOT NULL,
  pergunta_chave TEXT NOT NULL,
  pergunta_texto TEXT NOT NULL,
  resposta TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'cultura',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_percepcao_cultural ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation percepcao" ON public.onboarding_percepcao_cultural
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

CREATE INDEX idx_percepcao_cultural_tenant ON public.onboarding_percepcao_cultural(tenant_id);
CREATE INDEX idx_percepcao_cultural_processo ON public.onboarding_percepcao_cultural(processo_id);
