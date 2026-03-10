
-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trg_gerar_alertas_psicossociais ON public.questionario_psicossocial_campanhas;

-- Create/replace the trigger function
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
BEGIN
  IF NEW.radar_data IS NULL OR NEW.total_respostas < 5 THEN
    RETURN NEW;
  END IF;

  v_tenant_id := NEW.tenant_id;
  v_campanha_nome := NEW.nome;

  FOR v_elem IN SELECT jsonb_array_elements(NEW.radar_data)
  LOOP
    v_subject := v_elem->>'subject';
    v_value := COALESCE((v_elem->>'value')::integer, 50);
    v_risk := 100 - v_value;

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

      IF v_risk >= 75 THEN
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
            'CRÍTICO: Risco psicossocial — ' || v_subject,
            'Ação obrigatória gerada automaticamente. Dimensão "' || v_subject || '" atingiu risco crítico (' || v_risk || '/100) na campanha "' || v_campanha_nome || '". Ação exigida conforme NR-01 / ISO 45003.',
            'corretiva',
            'urgente',
            'pendente',
            'psicossocial',
            NEW.id::text,
            'Alerta crítico psicossocial — Campanha: ' || v_campanha_nome,
            true,
            'TEMP-PSI-' || gen_random_uuid()::text,
            0,
            'RH (a designar)'
          ) RETURNING id INTO v_acao_id;

          UPDATE public.psicossocial_alertas
          SET acao_id = v_acao_id
          WHERE campanha_id = NEW.id AND dimensao_id = v_subject;
        END IF;
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
