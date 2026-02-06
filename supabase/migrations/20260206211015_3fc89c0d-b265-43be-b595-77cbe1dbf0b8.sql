-- Adicionar política de acesso público para buscar convite por token
CREATE POLICY "Acesso público para buscar convite por token" 
  ON public.questionario_psicossocial_convites 
  FOR SELECT 
  USING (true);

-- Verificar e adicionar política para campanhas também
CREATE POLICY "Acesso público para ler campanhas via convite" 
  ON public.questionario_psicossocial_campanhas 
  FOR SELECT 
  USING (true);

-- Verificar política para inserir respostas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'questionario_psicossocial_respostas' 
    AND policyname = 'Acesso público para inserir respostas via token'
  ) THEN
    CREATE POLICY "Acesso público para inserir respostas via token"
      ON public.questionario_psicossocial_respostas
      FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;