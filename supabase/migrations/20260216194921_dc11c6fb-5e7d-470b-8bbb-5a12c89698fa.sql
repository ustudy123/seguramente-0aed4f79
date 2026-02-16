-- Add unique constraint for upsert on trilha_progresso
ALTER TABLE public.trilha_progresso
ADD CONSTRAINT trilha_progresso_unique_entry
UNIQUE (tenant_id, trilha_id, modulo_id, colaborador_id);