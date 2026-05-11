
ALTER TABLE public.ponto_escalas
  ADD COLUMN IF NOT EXISTS modalidade text NOT NULL DEFAULT 'fixa',
  ADD COLUMN IF NOT EXISTS dias_config jsonb,
  ADD COLUMN IF NOT EXISTS ciclo_horas_trabalho integer,
  ADD COLUMN IF NOT EXISTS ciclo_horas_descanso integer,
  ADD COLUMN IF NOT EXISTS ciclo_inicio_data date,
  ADD COLUMN IF NOT EXISTS ciclo_inicio_hora time;

ALTER TABLE public.ponto_escalas
  ADD CONSTRAINT ponto_escalas_modalidade_check
  CHECK (modalidade IN ('fixa','movel'));
