
-- Fix trigger variable type
CREATE OR REPLACE FUNCTION public.auto_criar_contrato_experiencia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config RECORD;
  v_duracao INT := 45;
  v_clausula BOOLEAN := false;
  v_data_fim DATE;
BEGIN
  IF NOT (
    (NEW.status = 'concluido' AND OLD.status != 'concluido' AND NEW.tipo_contrato IN ('contrato_experiencia', 'clt_experiencia'))
    OR
    (NEW.status = 'concluido' AND NEW.tipo_contrato IN ('contrato_experiencia', 'clt_experiencia') AND OLD.tipo_contrato NOT IN ('contrato_experiencia', 'clt_experiencia'))
  ) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM contratos_experiencia WHERE admissao_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT duracao_primeiro_periodo, clausula_assecuratoria_padrao
  INTO v_config
  FROM empresa_experiencia_config
  WHERE tenant_id = NEW.tenant_id AND empresa_id = NEW.empresa_id;

  IF FOUND THEN
    v_duracao := v_config.duracao_primeiro_periodo;
    v_clausula := v_config.clausula_assecuratoria_padrao;
  END IF;

  v_data_fim := NEW.data_admissao::date + (v_duracao - 1);

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

-- Insert missing contracts
INSERT INTO contratos_experiencia (
  tenant_id, empresa_id, admissao_id,
  colaborador_nome, colaborador_cpf, cargo, departamento, filial,
  gestor_imediato, salario, jornada_trabalho,
  data_admissao, duracao_primeiro_periodo, data_fim_primeiro_periodo,
  clausula_assecuratoria, status
)
SELECT
  a.tenant_id, a.empresa_id, a.id,
  a.nome_completo, a.cpf, a.cargo, a.departamento, a.filial,
  a.gestor_imediato, a.salario, a.jornada_trabalho,
  a.data_admissao, 45, (a.data_admissao::date + 44),
  false, 'em_experiencia'
FROM admissoes a
WHERE a.tipo_contrato IN ('contrato_experiencia', 'clt_experiencia')
  AND a.status = 'concluido'
  AND NOT EXISTS (SELECT 1 FROM contratos_experiencia ce WHERE ce.admissao_id = a.id);
