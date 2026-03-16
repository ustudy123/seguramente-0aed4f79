
-- Tabela para armazenar OTPs de verificação por WhatsApp
CREATE TABLE public.psicossocial_otp_verificacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id UUID NOT NULL REFERENCES public.questionario_psicossocial_campanhas(id) ON DELETE CASCADE,
  telefone_hash TEXT NOT NULL,
  codigo TEXT NOT NULL,
  verificado BOOLEAN NOT NULL DEFAULT false,
  tentativas INT NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  verificado_em TIMESTAMPTZ,
  expira_em TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '10 minutes')
);

-- Índice para buscar por telefone_hash + campanha para evitar duplicatas
CREATE INDEX idx_psicossocial_otp_telefone_campanha 
  ON public.psicossocial_otp_verificacao(telefone_hash, campanha_id);

-- Índice para limpeza de expirados
CREATE INDEX idx_psicossocial_otp_expira ON public.psicossocial_otp_verificacao(expira_em);

-- Tabela para registrar telefones já usados por campanha (hash only)
CREATE TABLE public.psicossocial_telefone_usado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id UUID NOT NULL REFERENCES public.questionario_psicossocial_campanhas(id) ON DELETE CASCADE,
  telefone_hash TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(campanha_id, telefone_hash)
);

-- RLS: ambas tabelas precisam ser acessíveis pela edge function (anon)
ALTER TABLE public.psicossocial_otp_verificacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.psicossocial_telefone_usado ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas para anon (edge function usa service role, mas o frontend pode precisar)
CREATE POLICY "Anon pode inserir OTP" ON public.psicossocial_otp_verificacao FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon pode ler OTP" ON public.psicossocial_otp_verificacao FOR SELECT TO anon USING (true);
CREATE POLICY "Anon pode atualizar OTP" ON public.psicossocial_otp_verificacao FOR UPDATE TO anon USING (true);

CREATE POLICY "Anon pode ler telefone usado" ON public.psicossocial_telefone_usado FOR SELECT TO anon USING (true);
CREATE POLICY "Anon pode inserir telefone usado" ON public.psicossocial_telefone_usado FOR INSERT TO anon WITH CHECK (true);
