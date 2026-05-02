-- Adiciona empresa_id em empresa_obrigacoes para isolamento
ALTER TABLE public.empresa_obrigacoes 
ADD COLUMN empresa_id UUID REFERENCES public.empresa_cadastro(id) ON DELETE CASCADE;

-- Adiciona aprendiz_obrigatorio em empresa_cadastro
ALTER TABLE public.empresa_cadastro 
ADD COLUMN aprendiz_obrigatorio BOOLEAN DEFAULT false;

-- Atualiza políticas de RLS para incluir o novo campo se necessário (geralmente tenant_id já cobre, mas é boa prática garantir)
CREATE INDEX idx_empresa_obrigacoes_empresa_id ON public.empresa_obrigacoes(empresa_id);
