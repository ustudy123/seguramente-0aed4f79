-- Check if column exists first to avoid error
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ponto_ajustes' AND column_name = 'empresa_id') THEN
        ALTER TABLE public.ponto_ajustes ADD COLUMN empresa_id UUID REFERENCES public.empresa_cadastro(id);
    END IF;
END $$;

-- Explicitly grant permissions to ensure postgrest can see the new column
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ponto_ajustes TO authenticated;
GRANT ALL ON public.ponto_ajustes TO service_role;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';
