
CREATE TABLE IF NOT EXISTS public.psicossocial_instrumento_dimensao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risco_nome TEXT NOT NULL,
  instrumento TEXT NOT NULL,
  dimensao TEXT NOT NULL,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_psico_instr_dim_risco ON public.psicossocial_instrumento_dimensao(risco_nome);
CREATE INDEX IF NOT EXISTS idx_psico_instr_dim_instr ON public.psicossocial_instrumento_dimensao(instrumento);
CREATE UNIQUE INDEX IF NOT EXISTS uq_psico_instr_dim ON public.psicossocial_instrumento_dimensao(risco_nome, instrumento, dimensao);

ALTER TABLE public.psicossocial_instrumento_dimensao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Catálogo público de mapeamento" ON public.psicossocial_instrumento_dimensao;
CREATE POLICY "Catálogo público de mapeamento"
  ON public.psicossocial_instrumento_dimensao FOR SELECT
  TO authenticated USING (true);

INSERT INTO public.psicossocial_instrumento_dimensao (risco_nome, instrumento, dimensao, descricao) VALUES
-- Excesso de demandas (sobrecarga)
('Excesso de demandas (sobrecarga)', 'COPSOQ_III', 'Quantitative demands / Work pace', 'Volume e ritmo de trabalho'),
('Excesso de demandas (sobrecarga)', 'SIPRO', 'CET-1 Ritmo / Volume', 'Bloco de carga quantitativa'),
('Excesso de demandas (sobrecarga)', 'JCQ', 'Psychological demands', 'Demandas psicológicas (Karasek)'),
('Excesso de demandas (sobrecarga)', 'ERI', 'Effort', 'Esforço extrínseco'),
('Excesso de demandas (sobrecarga)', 'HSE_MS', 'Demands', 'Padrão de demanda'),
-- Baixa demanda de trabalho (subcarga)
('Baixa demanda de trabalho (subcarga)', 'COPSOQ_III', 'Quantitative demands (low)', 'Subcarga quantitativa'),
('Baixa demanda de trabalho (subcarga)', 'SIPRO', 'CET-1 Ritmo / Volume (inv.)', 'Espelho invertido do ritmo'),
('Baixa demanda de trabalho (subcarga)', 'HSE_MS', 'Demands', 'Padrão de demanda (subutilização)'),
-- Baixo controle no trabalho / Falta de autonomia
('Baixo controle no trabalho / Falta de autonomia', 'COPSOQ_III', 'Influence at work; Possibilities for development', 'Influência e desenvolvimento'),
('Baixo controle no trabalho / Falta de autonomia', 'SIPRO', 'CET-4 Autonomia decisória', 'Bloco de autonomia'),
('Baixo controle no trabalho / Falta de autonomia', 'JCQ', 'Decision latitude / Skill discretion', 'Latitude decisória'),
('Baixo controle no trabalho / Falta de autonomia', 'HSE_MS', 'Control', 'Padrão de controle'),
-- Baixa clareza de papel/função
('Baixa clareza de papel/função', 'COPSOQ_III', 'Role clarity; Role conflicts', 'Clareza e conflito de papéis'),
('Baixa clareza de papel/função', 'SIPRO', 'CET-5 Papel e expectativa', 'Bloco de papel'),
('Baixa clareza de papel/função', 'HSE_MS', 'Role', 'Padrão de papel'),
-- Falta de suporte no trabalho
('Falta de suporte no trabalho', 'COPSOQ_III', 'Social support from colleagues / supervisors', 'Apoio social'),
('Falta de suporte no trabalho', 'SIPRO', 'CET-6 Apoio social', 'Bloco de apoio'),
('Falta de suporte no trabalho', 'JCQ', 'Social support', 'Suporte social'),
('Falta de suporte no trabalho', 'HSE_MS', 'Support (Peer/Manager)', 'Padrão de suporte'),
-- Más relações no ambiente de trabalho
('Más relações no ambiente de trabalho', 'COPSOQ_III', 'Quality of leadership; Conflicts', 'Liderança e conflitos'),
('Más relações no ambiente de trabalho', 'SIPRO', 'CET-7 Liderança', 'Bloco de liderança'),
('Más relações no ambiente de trabalho', 'HSE_MS', 'Relationships', 'Padrão de relações'),
-- Baixas recompensas e reconhecimento
('Baixas recompensas e reconhecimento', 'COPSOQ_III', 'Recognition; Rewards', 'Reconhecimento'),
('Baixas recompensas e reconhecimento', 'SIPRO', 'CET-8 Reconhecimento', 'Bloco de reconhecimento'),
('Baixas recompensas e reconhecimento', 'ERI', 'Reward (estima, salário, status)', 'Recompensa'),
-- Baixa justiça organizacional
('Baixa justiça organizacional', 'COPSOQ_III', 'Justice and respect', 'Justiça e respeito'),
('Baixa justiça organizacional', 'SIPRO', 'CET-9 Justiça processual', 'Bloco de justiça'),
('Baixa justiça organizacional', 'ERI', 'Reward (justiça)', 'Componente de justiça da recompensa'),
-- Assédio de qualquer natureza
('Assédio de qualquer natureza', 'COPSOQ_III', 'Bullying; Sexual harassment', 'Assédio moral e sexual'),
('Assédio de qualquer natureza', 'SIPRO', 'CET-Violência', 'Bloco de violência'),
('Assédio de qualquer natureza', 'HSE_MS', 'Relationships', 'Padrão de relações (violência)'),
-- Eventos violentos ou traumáticos
('Eventos violentos ou traumáticos', 'COPSOQ_III', 'Threats; Violence', 'Ameaças e violência física'),
('Eventos violentos ou traumáticos', 'SIPRO', 'CET-Violência', 'Bloco de violência'),
('Eventos violentos ou traumáticos', 'HSE_MS', 'Relationships', 'Padrão de relações (violência)'),
-- Má gestão de mudanças organizacionais
('Má gestão de mudanças organizacionais', 'COPSOQ_III', 'Predictability; Information flow', 'Previsibilidade'),
('Má gestão de mudanças organizacionais', 'SIPRO', 'CET-Mudança', 'Bloco de mudança'),
('Má gestão de mudanças organizacionais', 'HSE_MS', 'Change', 'Padrão de mudança'),
-- Trabalho em condições de difícil comunicação
('Trabalho em condições de difícil comunicação', 'COPSOQ_III', 'Information flow', 'Fluxo de informação'),
('Trabalho em condições de difícil comunicação', 'SIPRO', 'CET-Mudança / Comunicação', 'Bloco de comunicação organizacional'),
('Trabalho em condições de difícil comunicação', 'HSE_MS', 'Change', 'Padrão de mudança/comunicação'),
-- Trabalho remoto e isolado
('Trabalho remoto e isolado', 'COPSOQ_III', 'Social support (low); Sense of community', 'Apoio social e comunidade'),
('Trabalho remoto e isolado', 'SIPRO', 'CET-6 Apoio social (isolamento)', 'Bloco de apoio aplicado a isolamento'),
('Trabalho remoto e isolado', 'HSE_MS', 'Support (Peer/Manager)', 'Padrão de suporte (isolamento)');
