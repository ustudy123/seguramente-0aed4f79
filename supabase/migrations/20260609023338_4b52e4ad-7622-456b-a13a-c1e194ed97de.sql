-- Permitir upload de anexos para usuários autenticados no bucket de ponto-ajustes-anexos
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'ponto-ajustes-anexos') THEN
        -- Política para usuários autenticados fazerem upload de seus próprios anexos (prefixados com seu ID)
        -- No frontend use: `${user.id}/${dataReferencia}/${Date.now()}_${safeName}`
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'objects' 
            AND schemaname = 'storage' 
            AND policyname = 'Authenticated users can upload ponto adjustments'
        ) THEN
            CREATE POLICY "Authenticated users can upload ponto adjustments"
            ON storage.objects FOR INSERT
            TO authenticated
            WITH CHECK (
                bucket_id = 'ponto-ajustes-anexos' AND
                (storage.foldername(name))[1] = auth.uid()::text
            );
        END IF;

        -- Política para usuários autenticados lerem seus próprios anexos
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'objects' 
            AND schemaname = 'storage' 
            AND policyname = 'Authenticated users can view their own ponto adjustments'
        ) THEN
            CREATE POLICY "Authenticated users can view their own ponto adjustments"
            ON storage.objects FOR SELECT
            TO authenticated
            USING (
                bucket_id = 'ponto-ajustes-anexos' AND
                (storage.foldername(name))[1] = auth.uid()::text
            );
        END IF;
    END IF;
END $$;

-- Garantir que a política de INSERT na tabela ponto_ajustes esteja correta
-- O erro "new row violates row-level security policy" em INSERT geralmente significa que o WITH CHECK falhou.
-- A política atual exige tenant_id = get_user_tenant_id().

-- Vamos reforçar a política de inserção para garantir que ela funcione com o tenant_id correto.
DROP POLICY IF EXISTS "Usuários podem solicitar ajustes" ON public.ponto_ajustes;
CREATE POLICY "Usuários podem solicitar ajustes" ON public.ponto_ajustes 
FOR INSERT TO authenticated 
WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

GRANT INSERT ON public.ponto_ajustes TO authenticated;
