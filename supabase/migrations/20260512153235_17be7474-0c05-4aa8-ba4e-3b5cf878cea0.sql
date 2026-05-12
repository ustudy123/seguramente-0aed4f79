
ALTER TABLE public.psicossocial_riscos
  ADD COLUMN IF NOT EXISTS severidade smallint;

-- Atualiza riscos padrão existentes
UPDATE public.psicossocial_riscos SET severidade = CASE nome
  WHEN 'Assédio de qualquer natureza' THEN 4
  WHEN 'Baixa clareza de papel/função' THEN 3
  WHEN 'Baixa demanda de trabalho (subcarga)' THEN 2
  WHEN 'Baixa justiça organizacional' THEN 3
  WHEN 'Baixas recompensas e reconhecimento' THEN 3
  WHEN 'Baixo controle no trabalho / Falta de autonomia' THEN 3
  WHEN 'Eventos violentos ou traumáticos' THEN 5
  WHEN 'Excesso de demandas (sobrecarga)' THEN 4
  WHEN 'Falta de suporte no trabalho' THEN 3
  WHEN 'Má gestão de mudanças organizacionais' THEN 3
  WHEN 'Más relações no ambiente de trabalho' THEN 3
  WHEN 'Trabalho em condições de difícil comunicação' THEN 2
  WHEN 'Trabalho remoto e isolado' THEN 3
  ELSE severidade
END
WHERE padrao = true;

-- Atualiza função de seed para incluir severidade nos novos tenants
CREATE OR REPLACE FUNCTION public.seed_psicossocial_riscos_padrao(_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.psicossocial_riscos (tenant_id, nome, descricao, padrao, ativo, severidade)
  VALUES
    (_tenant_id, 'Assédio de qualquer natureza', 'Conduta abusiva, repetitiva ou única, que atente contra a dignidade ou integridade psíquica do trabalhador (moral, sexual ou organizacional).', true, true, 4),
    (_tenant_id, 'Baixa clareza de papel/função', 'Falta de definição clara sobre responsabilidades, expectativas e limites do cargo.', true, true, 3),
    (_tenant_id, 'Baixa demanda de trabalho (subcarga)', 'Trabalho monótono, repetitivo ou abaixo das capacidades do trabalhador, gerando tédio e desengajamento.', true, true, 2),
    (_tenant_id, 'Baixa justiça organizacional', 'Percepção de injustiça nos processos, decisões e relações interpessoais dentro da organização.', true, true, 3),
    (_tenant_id, 'Baixas recompensas e reconhecimento', 'Desequilíbrio entre esforço empregado e reconhecimento (financeiro, simbólico ou de carreira).', true, true, 3),
    (_tenant_id, 'Baixo controle no trabalho / Falta de autonomia', 'Pouca participação nas decisões, ritmo, métodos ou organização do próprio trabalho.', true, true, 3),
    (_tenant_id, 'Eventos violentos ou traumáticos', 'Exposição a violência física, verbal, assaltos, acidentes graves ou ameaças no ambiente de trabalho.', true, true, 5),
    (_tenant_id, 'Excesso de demandas (sobrecarga)', 'Volume, ritmo ou complexidade de trabalho acima da capacidade do trabalhador.', true, true, 4),
    (_tenant_id, 'Falta de suporte no trabalho', 'Ausência de apoio técnico, social ou emocional de colegas e superiores.', true, true, 3),
    (_tenant_id, 'Má gestão de mudanças organizacionais', 'Mudanças impostas sem comunicação, participação ou suporte adequados.', true, true, 3),
    (_tenant_id, 'Más relações no ambiente de trabalho', 'Conflitos interpessoais, falta de cooperação ou clima organizacional negativo.', true, true, 3),
    (_tenant_id, 'Trabalho em condições de difícil comunicação', 'Barreiras físicas, tecnológicas ou organizacionais que dificultam a comunicação efetiva.', true, true, 2),
    (_tenant_id, 'Trabalho remoto e isolado', 'Atividades realizadas de forma isolada, com pouco contato social e suporte.', true, true, 3)
  ON CONFLICT DO NOTHING;
END;
$$;
