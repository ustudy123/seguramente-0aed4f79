-- Metodologia 3 de campanha psicossocial: Entrevista Guiada Coletiva (Workshop).
-- O profissional (ex.: TST) reúne o grupo na empresa, lê as perguntas, sintetiza
-- a percepção coletiva e registra no sistema — mesma esteira (IA/evidências/
-- relatório) da entrevista guiada individual.

-- 1) Campanha aceita o novo tipo_instrumento
CREATE OR REPLACE FUNCTION public.validate_tipo_instrumento_campanha()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.tipo_instrumento NOT IN ('questionario','entrevista_guiada','entrevista_coletiva') THEN
    RAISE EXCEPTION 'tipo_instrumento inválido: %', NEW.tipo_instrumento;
  END IF;
  RETURN NEW;
END;
$$;

-- 2) Sessão de entrevista ganha os campos da modalidade coletiva
ALTER TABLE public.psicossocial_entrevistas
  ADD COLUMN IF NOT EXISTS tipo_sessao text NOT NULL DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS grupo_nome text,
  ADD COLUMN IF NOT EXISTS participantes_previstos int;

DO $$ BEGIN
  ALTER TABLE public.psicossocial_entrevistas
    ADD CONSTRAINT psicossocial_entrevistas_tipo_sessao_chk
    CHECK (tipo_sessao IN ('individual','coletiva'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
