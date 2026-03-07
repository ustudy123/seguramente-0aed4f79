
-- Adiciona token público único para cada campanha psicossocial
-- O link deve ser geral (não individual) para garantir anonimato
ALTER TABLE public.questionario_psicossocial_campanhas
  ADD COLUMN IF NOT EXISTS token_publico TEXT UNIQUE DEFAULT NULL;

-- Gera tokens para campanhas existentes
UPDATE public.questionario_psicossocial_campanhas
SET token_publico = encode(gen_random_bytes(12), 'hex')
WHERE token_publico IS NULL;

-- Cria índice para busca rápida por token
CREATE INDEX IF NOT EXISTS idx_psicossocial_campanhas_token
  ON public.questionario_psicossocial_campanhas (token_publico);

-- Permite leitura pública da campanha ativa via token (para o questionário anônimo)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'questionario_psicossocial_campanhas' 
    AND policyname = 'Acesso público a campanha ativa via token'
  ) THEN
    CREATE POLICY "Acesso público a campanha ativa via token"
      ON public.questionario_psicossocial_campanhas
      FOR SELECT
      USING (token_publico IS NOT NULL AND status = 'ativa');
  END IF;
END $$;
