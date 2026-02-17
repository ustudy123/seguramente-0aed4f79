
ALTER TABLE public.empresa_cadastro
ADD COLUMN tipo_pessoa TEXT NOT NULL DEFAULT 'pj',
ADD COLUMN cpf TEXT,
ADD COLUMN cei TEXT,
ADD COLUMN caepf TEXT;
