-- Fix existing PDI-originated plano_acoes records to include collaborator name
UPDATE public.plano_acoes 
SET responsavel_nome = 'Maria',
    origem_descricao = 'PDI — Colaborador: Maria | Meta: meta 1'
WHERE origem_descricao = 'PDI — Meta: meta 1'
  AND responsavel_nome IS NULL;