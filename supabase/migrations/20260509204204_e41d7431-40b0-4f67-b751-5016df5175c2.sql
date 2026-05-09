
-- Remove mapeamentos antigos (em inglês) para reescrever em PT
DELETE FROM public.psicossocial_instrumento_dimensao
WHERE instrumento IN ('COPSOQ_III', 'HSE_MS', 'SIPRO');

-- ============================================================
-- COPSOQ III  (dimensões PT em src/data/instrumentos/copsoq.ts)
-- ============================================================
INSERT INTO public.psicossocial_instrumento_dimensao (instrumento, risco_nome, dimensao) VALUES
('COPSOQ_III','Baixa clareza de papel/função','Clareza de Papéis'),
('COPSOQ_III','Baixa clareza de papel/função','Conflito de Papéis'),
('COPSOQ_III','Baixa demanda de trabalho (subcarga)','Demanda Quantitativa'),
('COPSOQ_III','Baixa justiça organizacional','Reconhecimento e Recompensas'),
('COPSOQ_III','Baixas recompensas e reconhecimento','Reconhecimento e Recompensas'),
('COPSOQ_III','Baixo controle no trabalho / Falta de autonomia','Influência e Controle'),
('COPSOQ_III','Excesso de demandas (sobrecarga)','Demanda Quantitativa'),
('COPSOQ_III','Excesso de demandas (sobrecarga)','Demanda Cognitiva'),
('COPSOQ_III','Excesso de demandas (sobrecarga)','Demanda Emocional'),
('COPSOQ_III','Falta de suporte no trabalho','Suporte dos Colegas'),
('COPSOQ_III','Falta de suporte no trabalho','Suporte da Liderança'),
('COPSOQ_III','Má gestão de mudanças organizacionais','Previsibilidade'),
('COPSOQ_III','Más relações no ambiente de trabalho','Suporte da Liderança'),
('COPSOQ_III','Más relações no ambiente de trabalho','Suporte dos Colegas'),
('COPSOQ_III','Trabalho em condições de difícil comunicação','Previsibilidade'),
('COPSOQ_III','Trabalho remoto e isolado','Suporte dos Colegas');

-- ============================================================
-- HSE-MS  (dimensões PT em src/data/instrumentos/hse.ts)
-- ============================================================
INSERT INTO public.psicossocial_instrumento_dimensao (instrumento, risco_nome, dimensao) VALUES
('HSE_MS','Assédio de qualquer natureza','Relacionamentos'),
('HSE_MS','Baixa clareza de papel/função','Função'),
('HSE_MS','Baixa demanda de trabalho (subcarga)','Demanda'),
('HSE_MS','Baixo controle no trabalho / Falta de autonomia','Controle'),
('HSE_MS','Eventos violentos ou traumáticos','Relacionamentos'),
('HSE_MS','Excesso de demandas (sobrecarga)','Demanda'),
('HSE_MS','Falta de suporte no trabalho','Suporte do Gestor'),
('HSE_MS','Falta de suporte no trabalho','Suporte dos Pares'),
('HSE_MS','Má gestão de mudanças organizacionais','Gestão de Mudanças'),
('HSE_MS','Más relações no ambiente de trabalho','Relacionamentos'),
('HSE_MS','Trabalho em condições de difícil comunicação','Gestão de Mudanças'),
('HSE_MS','Trabalho remoto e isolado','Suporte dos Pares');

-- ============================================================
-- SIPRO  (dimensões PT em src/data/instrumentos/sipro.ts)
-- ============================================================
INSERT INTO public.psicossocial_instrumento_dimensao (instrumento, risco_nome, dimensao) VALUES
('SIPRO','Assédio de qualquer natureza','Sinais Precoces'),
('SIPRO','Baixa clareza de papel/função','Clareza de Papéis'),
('SIPRO','Baixa demanda de trabalho (subcarga)','Demandas Quantitativas e Ritmo'),
('SIPRO','Baixa justiça organizacional','Reconhecimento e Justiça'),
('SIPRO','Baixas recompensas e reconhecimento','Reconhecimento e Justiça'),
('SIPRO','Baixo controle no trabalho / Falta de autonomia','Autonomia e Controle'),
('SIPRO','Eventos violentos ou traumáticos','Sinais Precoces'),
('SIPRO','Excesso de demandas (sobrecarga)','Demandas Quantitativas e Ritmo'),
('SIPRO','Excesso de demandas (sobrecarga)','Demandas Cognitivas'),
('SIPRO','Excesso de demandas (sobrecarga)','Demandas Emocionais'),
('SIPRO','Falta de suporte no trabalho','Relacionamentos e Suporte'),
('SIPRO','Má gestão de mudanças organizacionais','Sinais Precoces'),
('SIPRO','Más relações no ambiente de trabalho','Relacionamentos e Suporte'),
('SIPRO','Trabalho em condições de difícil comunicação','Sinais Precoces'),
('SIPRO','Trabalho remoto e isolado','Relacionamentos e Suporte');
