
-- GAP 2: Estender geração automática de planos de ação para riscos "Alto" (51-74)
-- além dos já existentes "Crítico" (>=75).

CREATE OR REPLACE FUNCTION public.gerar_alertas_psicossociais()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_campanha_nome text;
  v_total int;
BEGIN
  SELECT tenant_id, nome, total_respostas 
  INTO v_tenant_id, v_campanha_nome, v_total
  FROM public.questionario_psicossocial_campanhas
  WHERE id = NEW.campanha_id;

  IF v_tenant_id IS NULL OR v_total < 5 THEN RETURN NEW; END IF;
  IF NEW.indicadores IS NULL OR NEW.indicadores->'radar' IS NULL THEN RETURN NEW; END IF;

  -- Inserir alertas para dimensões em risco elevado, alto ou crítico
  INSERT INTO public.psicossocial_alertas (
    tenant_id, campanha_id, dimensao_id, dimensao_nome,
    score_risco, score_ips, classificacao, resolvido
  )
  SELECT
    v_tenant_id,
    NEW.campanha_id,
    (elem->>'subject'),
    (elem->>'subject'),
    (100 - (elem->>'value')::numeric)::int,
    (NEW.indicadores->>'IPS')::int,
    CASE
      WHEN (100 - (elem->>'value')::numeric) >= 75 THEN 'critico'
      WHEN (100 - (elem->>'value')::numeric) >= 51 THEN 'alto'
      ELSE 'elevado'
    END,
    false
  FROM jsonb_array_elements(NEW.indicadores->'radar') AS elem
  WHERE (100 - (elem->>'value')::numeric) >= 35
    AND NOT EXISTS (
      SELECT 1 FROM public.psicossocial_alertas pa
      WHERE pa.tenant_id = v_tenant_id
        AND pa.campanha_id = NEW.campanha_id
        AND pa.dimensao_id = (elem->>'subject')
        AND pa.resolvido = false
    )
  ON CONFLICT DO NOTHING;

  -- Gerar ações 5W2H automáticas para Crítico (prazo 30d) e Alto (prazo 60d)
  INSERT INTO public.plano_acoes (
    tenant_id,
    titulo,
    descricao,
    porque,
    onde,
    como,
    tipo,
    prioridade,
    origem_modulo,
    origem_descricao,
    exige_evidencia,
    codigo,
    progresso,
    status,
    tempo_gasto_minutos,
    prazo
  )
  SELECT
    v_tenant_id,
    CASE
      WHEN (100 - (elem->>'value')::numeric) >= 75
        THEN 'Intervenção Urgente — ' || (elem->>'subject') || ' [Crítico]'
      ELSE 'Ação Preventiva — ' || (elem->>'subject') || ' [Alto]'
    END,
    'Risco psicossocial identificado na campanha "' || v_campanha_nome || '". Dimensão: ' || (elem->>'subject') || '. Score de risco: ' || (100 - (elem->>'value')::numeric)::int || '/100.',
    'Score de risco ' || (100 - (elem->>'value')::numeric)::int || '/100 na dimensão ' || (elem->>'subject'),
    'Toda a organização',
    CASE
      WHEN (100 - (elem->>'value')::numeric) >= 75
        THEN 'Realizar diagnóstico aprofundado, envolver liderança, implementar intervenção imediata. Considerar AET (NR-17) para análise ergopsicossocial completa.'
      ELSE 'Monitorar evolução, implementar ações preventivas. Reavaliar em 60 dias conforme ISO 45003.'
    END,
    'corretiva',
    CASE
      WHEN (100 - (elem->>'value')::numeric) >= 75 THEN 'imediato'
      ELSE 'urgente'
    END,
    'psicossocial',
    'Campanha: ' || v_campanha_nome || ' — Gerado automaticamente',
    true,
    '',
    0,
    'pendente',
    0,
    CASE
      WHEN (100 - (elem->>'value')::numeric) >= 75 THEN CURRENT_DATE + INTERVAL '30 days'
      ELSE CURRENT_DATE + INTERVAL '60 days'
    END
  FROM jsonb_array_elements(NEW.indicadores->'radar') AS elem
  WHERE (100 - (elem->>'value')::numeric) >= 51
    AND NOT EXISTS (
      SELECT 1 FROM public.psicossocial_alertas pa
      WHERE pa.tenant_id = v_tenant_id
        AND pa.campanha_id = NEW.campanha_id
        AND pa.dimensao_id = (elem->>'subject')
        AND pa.acao_criada_id IS NOT NULL
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gerar_alertas_psicossociais ON public.questionario_psicossocial_respostas;
CREATE TRIGGER trg_gerar_alertas_psicossociais
  AFTER INSERT ON public.questionario_psicossocial_respostas
  FOR EACH ROW
  EXECUTE FUNCTION public.gerar_alertas_psicossociais();

-- GAP 1: Rastrear exportação automática ao GRO para evitar duplicidade
ALTER TABLE public.questionario_psicossocial_campanhas
  ADD COLUMN IF NOT EXISTS gro_exportado_em timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS gro_riscos_count int DEFAULT 0;
