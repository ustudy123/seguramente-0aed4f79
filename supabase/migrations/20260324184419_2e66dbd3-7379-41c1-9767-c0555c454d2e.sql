
-- Trigger para auto-criar contrato de experiência ao concluir admissão com tipo "contrato_experiencia"
CREATE OR REPLACE FUNCTION public.auto_criar_contrato_experiencia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_config RECORD;
  v_duracao INT := 45;
  v_clausula BOOLEAN := false;
  v_data_fim TEXT;
BEGIN
  -- Só dispara quando status muda para 'concluido' e tipo é contrato de experiência
  IF NEW.status != 'concluido' OR OLD.status = 'concluido' THEN
    RETURN NEW;
  END IF;

  IF NEW.tipo_contrato NOT IN ('contrato_experiencia', 'clt_experiencia') THEN
    RETURN NEW;
  END IF;

  -- Verificar se já existe contrato para esta admissão
  IF EXISTS (SELECT 1 FROM contratos_experiencia WHERE admissao_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Buscar config da empresa
  SELECT duracao_primeiro_periodo, clausula_assecuratoria_padrao
  INTO v_config
  FROM empresa_experiencia_config
  WHERE tenant_id = NEW.tenant_id AND empresa_id = NEW.empresa_id;

  IF FOUND THEN
    v_duracao := v_config.duracao_primeiro_periodo;
    v_clausula := v_config.clausula_assecuratoria_padrao;
  END IF;

  v_data_fim := (NEW.data_admissao::date + (v_duracao - 1) * interval '1 day')::date::text;

  INSERT INTO contratos_experiencia (
    tenant_id, empresa_id, admissao_id,
    colaborador_nome, colaborador_cpf, cargo, departamento, filial,
    gestor_imediato, salario, jornada_trabalho,
    data_admissao, duracao_primeiro_periodo, data_fim_primeiro_periodo,
    clausula_assecuratoria, status
  ) VALUES (
    NEW.tenant_id, NEW.empresa_id, NEW.id,
    NEW.nome_completo, NEW.cpf, NEW.cargo, NEW.departamento, NEW.filial,
    NEW.gestor_imediato, NEW.salario, NEW.jornada_trabalho,
    NEW.data_admissao, v_duracao, v_data_fim,
    v_clausula, 'em_experiencia'
  );

  RETURN NEW;
END;
$$;

-- Criar trigger na tabela admissoes
DROP TRIGGER IF EXISTS trigger_auto_criar_contrato_experiencia ON public.admissoes;
CREATE TRIGGER trigger_auto_criar_contrato_experiencia
  AFTER UPDATE ON public.admissoes
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_criar_contrato_experiencia();

-- Trigger para atualizar admissão quando contrato é encerrado
CREATE OR REPLACE FUNCTION public.sync_admissao_contrato_experiencia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Ao encerrar, atualizar status da admissão para desligado
  IF NEW.status = 'encerrado' AND OLD.status != 'encerrado' AND NEW.admissao_id IS NOT NULL THEN
    UPDATE admissoes
    SET status = 'desligado',
        data_desligamento = NEW.data_encerramento,
        motivo_desligamento = CASE NEW.tipo_encerramento
          WHEN 'termino_normal' THEN 'Término de contrato de experiência'
          WHEN 'rescisao_antecipada_empregador' THEN 'Rescisão antecipada pelo empregador (experiência)'
          WHEN 'rescisao_antecipada_empregado' THEN 'Rescisão antecipada pelo empregado (experiência)'
          ELSE 'Encerramento de contrato de experiência'
        END
    WHERE id = NEW.admissao_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_admissao_encerramento ON public.contratos_experiencia;
CREATE TRIGGER trigger_sync_admissao_encerramento
  AFTER UPDATE ON public.contratos_experiencia
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_admissao_contrato_experiencia();
