
ALTER TABLE public.ferias_assinatura_links
  ADD COLUMN IF NOT EXISTS colaborador_id UUID,
  ADD COLUMN IF NOT EXISTS empresa_id UUID,
  ADD COLUMN IF NOT EXISTS ferias_solicitacao_id UUID,
  ADD COLUMN IF NOT EXISTS tipo_documento TEXT DEFAULT 'aviso',
  ADD COLUMN IF NOT EXISTS documento_arquivado_id UUID;
