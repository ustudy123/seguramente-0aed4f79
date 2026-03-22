CREATE TABLE IF NOT EXISTS public.funcao_treinamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  cargo_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'video',
  url TEXT NOT NULL,
  descricao TEXT,
  obrigatorio BOOLEAN NOT NULL DEFAULT true,
  carga_horaria_min INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.funcao_treinamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_funcao_treinamentos" ON public.funcao_treinamentos FOR SELECT USING (tenant_id IN (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid()));
CREATE POLICY "tenant_insert_funcao_treinamentos" ON public.funcao_treinamentos FOR INSERT WITH CHECK (tenant_id IN (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid()));
CREATE POLICY "tenant_update_funcao_treinamentos" ON public.funcao_treinamentos FOR UPDATE USING (tenant_id IN (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid()));
CREATE POLICY "tenant_delete_funcao_treinamentos" ON public.funcao_treinamentos FOR DELETE USING (tenant_id IN (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_funcao_treinamentos_cargo ON public.funcao_treinamentos(cargo_id);
CREATE INDEX IF NOT EXISTS idx_funcao_treinamentos_tenant ON public.funcao_treinamentos(tenant_id);