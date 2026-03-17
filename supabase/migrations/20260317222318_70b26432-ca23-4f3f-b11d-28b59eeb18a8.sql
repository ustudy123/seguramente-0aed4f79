
-- ═══════════════════════════════════════════════════════════════════════════
-- GAP 1: Tabela de log para rastrear exportações GRO automáticas
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.gro_exportacoes_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  campanha_id UUID NOT NULL,
  exportado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  riscos_gerados INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'sucesso',
  UNIQUE(campanha_id)
);

ALTER TABLE public.gro_exportacoes_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_gro_exportacoes_log" ON public.gro_exportacoes_log
  USING (tenant_id = get_user_tenant_id());

-- ═══════════════════════════════════════════════════════════════════════════
-- GAP 2: Atualiza trigger de alertas psicossociais para cobrir nível ALTO
-- ═══════════════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS trg_gerar_alertas_psicossociais ON public.questionario_psicossocial_campanhas;

CREATE OR REPLACE FUNCTION public.gerar_alertas_psicossociais()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_elem JSONB;
  v_subject TEXT;
  v_value INTEGER;
  v_risk INTEGER;
  v_classificacao TEXT;
  v_tenant_id UUID;
  v_acao_id UUID;
  v_campanha_nome TEXT;
  v_isSipro BOOLEAN;
BEGIN
  IF NEW.radar_data IS NULL OR NEW.total_respostas < 5 THEN
    RETURN NEW;
  END IF;

  v_tenant_id := NEW.tenant_id;
  v_campanha_nome := NEW.nome;
  v_isSipro := COALESCE(NEW.instrumento, 'sipro') = 'sipro';

  FOR v_elem IN SELECT jsonb_array_elements(NEW.radar_data)
  LOOP
    v_subject := v_elem->>'subject';
    v_value := COALESCE((v_elem->>'value')::integer, 50);
    v_risk := CASE WHEN v_isSipro THEN v_value ELSE 100 - v_value END;

    IF v_risk >= 51 THEN
      v_classificacao := CASE WHEN v_risk >= 75 THEN 'critico' ELSE 'elevado' END;

      INSERT INTO public.psicossocial_alertas (
        tenant_id, campanha_id, dimensao_id, dimensao_nome,
        score_risco, score_ips, classificacao
      ) VALUES (
        v_tenant_id, NEW.id, v_subject, v_subject,
        v_risk, v_value, v_classificacao
      )
      ON CONFLICT (campanha_id, dimensao_id) DO UPDATE SET
        score_risco = EXCLUDED.score_risco,
        score_ips = EXCLUDED.score_ips,
        classificacao = EXCLUDED.classificacao,
        updated_at = now();

      -- GAP 2: Acao obrigatoria para ALTO (>= 51) E CRITICO (>= 75)
      SELECT pa.id INTO v_acao_id
      FROM public.plano_acoes pa
      WHERE pa.tenant_id = v_tenant_id
        AND pa.origem = 'psicossocial'
        AND pa.origem_id = NEW.id::text
        AND pa.descricao LIKE '%' || v_subject || '%'
      LIMIT 1;

      IF v_acao_id IS NULL THEN
        INSERT INTO public.plano_acoes (
          tenant_id, titulo, descricao, tipo, prioridade,
          status, origem, origem_id, origem_descricao,
          exige_evidencia, codigo, tempo_gasto_minutos,
          responsavel_nome
        ) VALUES (
          v_tenant_id,
          CASE WHEN v_risk >= 75
            THEN 'CRÍTICO: Risco psicossocial — ' || v_subject
            ELSE 'ALTO: Risco psicossocial — ' || v_subject
          END,
          'Ação obrigatória gerada automaticamente (NR-01 / ISO 45003). Dimensão "' || v_subject ||
          '" atingiu risco ' || CASE WHEN v_risk >= 75 THEN 'crítico' ELSE 'alto' END ||
          ' (' || v_risk || '/100) na campanha "' || v_campanha_nome || '". ' ||
          CASE WHEN v_risk >= 75
            THEN 'Intervenção imediata exigida. Prazo máximo: 30 dias.'
            ELSE 'Implementar medidas preventivas prioritárias. Prazo máximo: 60 dias.'
          END,
          'corretiva',
          CASE WHEN v_risk >= 75 THEN 'urgente' ELSE 'alta' END,
          'pendente',
          'psicossocial',
          NEW.id::text,
          'Alerta ' || CASE WHEN v_risk >= 75 THEN 'crítico' ELSE 'alto' END ||
          ' psicossocial — Campanha: ' || v_campanha_nome,
          true,
          'TEMP-PSI-' || gen_random_uuid()::text,
          0,
          'RH (a designar)'
        ) RETURNING id INTO v_acao_id;

        UPDATE public.psicossocial_alertas
        SET acao_id = v_acao_id
        WHERE campanha_id = NEW.id AND dimensao_id = v_subject;
      END IF;

    ELSE
      UPDATE public.psicossocial_alertas
        SET resolvido = true, resolvido_em = now()
        WHERE campanha_id = NEW.id AND dimensao_id = v_subject AND resolvido = false;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_gerar_alertas_psicossociais
  AFTER UPDATE OF radar_data ON public.questionario_psicossocial_campanhas
  FOR EACH ROW
  WHEN (NEW.radar_data IS DISTINCT FROM OLD.radar_data)
  EXECUTE FUNCTION public.gerar_alertas_psicossociais();

-- ═══════════════════════════════════════════════════════════════════════════
-- GAP 3: Campo reavaliacao em gro_riscos + triggers
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.gro_riscos
  ADD COLUMN IF NOT EXISTS necessita_reavaliacao BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reavaliacao_motivo TEXT,
  ADD COLUMN IF NOT EXISTS reavaliacao_solicitada_em TIMESTAMP WITH TIME ZONE;

-- Trigger: quando plano_acoes é concluído, marcar gro_riscos vinculados
CREATE OR REPLACE FUNCTION public.marcar_reavaliacao_gro_risco()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'concluida' AND OLD.status != 'concluida' THEN
    -- Vincular por acao_id direto
    UPDATE public.gro_riscos
    SET
      necessita_reavaliacao = true,
      reavaliacao_motivo = 'Ação vinculada concluída: "' || NEW.titulo || '". Avalie se o risco foi reduzido.',
      reavaliacao_solicitada_em = now()
    WHERE acao_id = NEW.id
      AND ativo = true;

    -- Vincular por campanha quando origem é psicossocial
    IF NEW.origem = 'psicossocial' AND NEW.origem_id IS NOT NULL THEN
      UPDATE public.gro_riscos
      SET
        necessita_reavaliacao = true,
        reavaliacao_motivo = 'Ação psicossocial concluída: "' || NEW.titulo || '". Reavalie o nível de risco da dimensão.',
        reavaliacao_solicitada_em = now()
      WHERE campanha_id::text = NEW.origem_id
        AND ativo = true
        AND necessita_reavaliacao = false;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_marcar_reavaliacao_gro ON public.plano_acoes;

CREATE TRIGGER trg_marcar_reavaliacao_gro
  AFTER UPDATE OF status ON public.plano_acoes
  FOR EACH ROW
  EXECUTE FUNCTION public.marcar_reavaliacao_gro_risco();

-- Trigger para limpar flag quando risco é marcado como revisado
CREATE OR REPLACE FUNCTION public.limpar_flag_reavaliacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status_gro = 'revisado' AND OLD.status_gro != 'revisado' THEN
    NEW.necessita_reavaliacao := false;
    NEW.reavaliacao_motivo := null;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_limpar_reavaliacao ON public.gro_riscos;

CREATE TRIGGER trg_limpar_reavaliacao
  BEFORE UPDATE OF status_gro ON public.gro_riscos
  FOR EACH ROW
  EXECUTE FUNCTION public.limpar_flag_reavaliacao();
