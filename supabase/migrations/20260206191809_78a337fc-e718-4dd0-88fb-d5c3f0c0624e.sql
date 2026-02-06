-- Adicionar campos obrigatórios conforme resolução médica na tabela atestados
ALTER TABLE public.atestados
ADD COLUMN IF NOT EXISTS profissional_uf TEXT,
ADD COLUMN IF NOT EXISTS profissional_rqe TEXT,
ADD COLUMN IF NOT EXISTS profissional_telefone TEXT,
ADD COLUMN IF NOT EXISTS profissional_email TEXT,
ADD COLUMN IF NOT EXISTS profissional_endereco TEXT,
ADD COLUMN IF NOT EXISTS cid_autorizado BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS unidade_afastamento TEXT DEFAULT 'dias',
ADD COLUMN IF NOT EXISTS horas_afastamento INTEGER;

-- Comentários para documentação
COMMENT ON COLUMN public.atestados.profissional_uf IS 'UF do registro profissional (ex: SP, RJ)';
COMMENT ON COLUMN public.atestados.profissional_rqe IS 'Registro de Qualificação de Especialista, quando houver';
COMMENT ON COLUMN public.atestados.profissional_telefone IS 'Telefone profissional do médico';
COMMENT ON COLUMN public.atestados.profissional_email IS 'E-mail profissional do médico';
COMMENT ON COLUMN public.atestados.profissional_endereco IS 'Endereço profissional ou residencial do médico';
COMMENT ON COLUMN public.atestados.cid_autorizado IS 'Se o paciente autorizou a inclusão do CID no atestado';
COMMENT ON COLUMN public.atestados.unidade_afastamento IS 'Unidade do tempo de afastamento: dias ou horas';
COMMENT ON COLUMN public.atestados.horas_afastamento IS 'Quantidade de horas de afastamento, quando aplicável';