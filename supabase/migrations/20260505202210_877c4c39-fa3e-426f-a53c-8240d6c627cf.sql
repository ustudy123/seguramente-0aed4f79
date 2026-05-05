ALTER TABLE public.estrategia_organograma 
ADD COLUMN colaborador_id UUID REFERENCES public.admissoes(id) ON DELETE SET NULL;

-- Atualizar RLS se necessário (geralmente herda permissões da tabela principal se não houver novas políticas complexas)
-- Mas vamos garantir que as políticas de SELECT permitam ver os dados do colaborador vinculado se necessário.
