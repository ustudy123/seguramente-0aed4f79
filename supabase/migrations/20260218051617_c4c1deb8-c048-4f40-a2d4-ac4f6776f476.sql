
-- Trigger: ao concluir trilha de onboarding com conexao_pdi, criar PDI automaticamente
CREATE OR REPLACE FUNCTION public.auto_criar_pdi_onboarding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_trilha RECORD;
  v_processo RECORD;
  v_pdi_id UUID;
  v_meta_id UUID;
  v_data_inicio DATE := CURRENT_DATE;
  v_data_fim DATE := CURRENT_DATE + INTERVAL '6 months';
BEGIN
  -- Buscar trilha associada
  SELECT * INTO v_trilha
  FROM public.trilhas
  WHERE id = NEW.trilha_id;

  -- Só processar trilhas de onboarding com conexao_pdi ativo
  IF v_trilha.tipo != 'onboarding' OR v_trilha.conexao_pdi IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Buscar processo de onboarding vinculado
  SELECT * INTO v_processo
  FROM public.onboarding_processos
  WHERE trilha_id = NEW.trilha_id
    AND tenant_id = NEW.tenant_id
  LIMIT 1;

  -- Verificar se já existe PDI de onboarding para este colaborador
  IF EXISTS (
    SELECT 1 FROM public.pdis
    WHERE tenant_id = NEW.tenant_id
      AND colaborador_id = NEW.colaborador_id
      AND gatilho = 'onboarding'
  ) THEN
    -- Atualizar o PDI existente como concluído
    UPDATE public.pdis
    SET status = 'concluido',
        progresso = 100,
        observacoes = COALESCE(observacoes, '') || E'\n[Marco: Integração concluída em ' || CURRENT_DATE::text || ' — Pontos: ' || NEW.pontos_obtidos::text || ']'
    WHERE tenant_id = NEW.tenant_id
      AND colaborador_id = NEW.colaborador_id
      AND gatilho = 'onboarding'
      AND status != 'concluido';
    RETURN NEW;
  END IF;

  -- Criar PDI
  INSERT INTO public.pdis (
    tenant_id, colaborador_id, colaborador_nome,
    titulo, descricao, periodo, data_inicio, data_fim,
    status, progresso, gatilho, criado_por_nome
  ) VALUES (
    NEW.tenant_id,
    NEW.colaborador_id,
    NEW.colaborador_nome,
    'PDI — Integração ' || NEW.colaborador_nome,
    'PDI gerado automaticamente ao concluir o onboarding. Utilize este plano para registrar metas de desenvolvimento para o período inicial na empresa.',
    'semestral',
    v_data_inicio,
    v_data_fim,
    'ativo',
    0,
    'onboarding',
    'Sistema (automático)'
  ) RETURNING id INTO v_pdi_id;

  -- Criar meta: Integração Concluída (já concluída)
  INSERT INTO public.pdi_metas (
    tenant_id, pdi_id, titulo, descricao,
    categoria, status, progresso, peso,
    data_inicio, data_fim
  ) VALUES (
    NEW.tenant_id,
    v_pdi_id,
    'Integração Concluída',
    'Marco de conclusão do programa de onboarding. Trilha finalizada com ' || NEW.pontos_obtidos::text || ' pontos. Certificado: ' || NEW.codigo || '.',
    'competencia',
    'concluida',
    100,
    1,
    v_data_inicio,
    CURRENT_DATE
  ) RETURNING id INTO v_meta_id;

  -- Criar meta: Desenvolvimento Inicial (para o gestor preencher)
  INSERT INTO public.pdi_metas (
    tenant_id, pdi_id, titulo, descricao,
    categoria, status, progresso, peso,
    data_inicio, data_fim
  ) VALUES (
    NEW.tenant_id,
    v_pdi_id,
    'Desenvolvimento Inicial — Primeiros 90 dias',
    'Defina junto ao gestor as metas de desenvolvimento para os primeiros meses. Utilize as informações do onboarding como base.',
    'resultado',
    'nao_iniciada',
    0,
    2,
    v_data_inicio,
    v_data_fim
  );

  -- Atualizar processo de onboarding como concluído
  IF v_processo.id IS NOT NULL THEN
    UPDATE public.onboarding_processos
    SET status = 'concluido',
        data_conclusao = NOW()
    WHERE id = v_processo.id;
  END IF;

  RETURN NEW;
END;
$function$;

-- Criar trigger na tabela de certificados
DROP TRIGGER IF EXISTS trg_auto_pdi_onboarding ON public.trilha_certificados;
CREATE TRIGGER trg_auto_pdi_onboarding
  AFTER INSERT ON public.trilha_certificados
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_criar_pdi_onboarding();
