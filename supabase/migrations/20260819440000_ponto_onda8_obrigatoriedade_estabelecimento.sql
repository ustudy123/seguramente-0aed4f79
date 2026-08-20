-- ============================================================================
-- ONDA 8 (parte 3) — Obrigatoriedade do controle por ESTABELECIMENTO (>20)
-- PONTO-370
--
-- O controle de jornada é obrigatório quando o ESTABELECIMENTO passa de 20
-- trabalhadores — a contagem é POR ESTABELECIMENTO, não pela empresa inteira
-- (CLT art. 74, §2º, redação da Lei 13.874/2019). O sistema não tinha nenhuma
-- noção disso: tratava todo cliente igual, e um obrigado sem controle ativo não
-- recebia aviso — enquanto a Súmula 338 do TST joga a jornada alegada pelo
-- empregado contra o empregador que não controla.
--
-- O QUE FAZ (aditivo)
--   (1) empresa_cadastro.controle_ponto_obrigatorio: a sinalização por
--       estabelecimento (resolvida pela contagem).
--   (2) ponto_estabelecimento_trabalhadores(tenant, empresa): conta os
--       trabalhadores ATIVOS do estabelecimento.
--   (3) ponto_estabelecimento_obrigatoriedade_monitorar(tenant, empresa): resolve
--       a obrigatoriedade (obrigatoriedade do controle de jornada quando passa de
--       20, art. 74, §2º) e alerta o estabelecimento OBRIGADO que ainda não usa
--       controle de ponto.
--
-- GARANTIAS: não altera o motor de saldo, o espelho nem o fechamento. Só conta,
-- sinaliza e alerta. Aditivo e idempotente.
-- ============================================================================

ALTER TABLE public.empresa_cadastro
  ADD COLUMN IF NOT EXISTS controle_ponto_obrigatorio boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.empresa_cadastro.controle_ponto_obrigatorio IS
  'Sinaliza que o ESTABELECIMENTO e obrigado a controlar a jornada por passar de 20 trabalhadores (CLT art. 74, §2, Lei 13.874/2019). Resolvido pela contagem em ponto_estabelecimento_obrigatoriedade_monitorar.';

-- (2) Contagem de trabalhadores ativos do estabelecimento --------------------
CREATE OR REPLACE FUNCTION public.ponto_estabelecimento_trabalhadores(
  p_tenant_id  uuid,
  p_empresa_id uuid
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Trabalhadores ativos do estabelecimento (colaborador ativo = 'concluido').
  SELECT count(*)::int
  FROM public.admissoes a
  WHERE a.tenant_id = p_tenant_id
    AND a.empresa_id = p_empresa_id
    AND a.status = 'concluido'
    AND COALESCE(a.inativo, false) = false;
$$;

COMMENT ON FUNCTION public.ponto_estabelecimento_trabalhadores(uuid, uuid) IS
  'Conta os trabalhadores ativos de um estabelecimento (base da obrigatoriedade do art. 74, §2). PONTO-370.';

-- (3) Resolve a obrigatoriedade e alerta o obrigado sem controle --------------
CREATE OR REPLACE FUNCTION public.ponto_estabelecimento_obrigatoriedade_monitorar(
  p_tenant_id  uuid,
  p_empresa_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_n   int := 0;
  v_ins int;
  e     RECORD;
  v_trab int;
  v_obrig boolean;
BEGIN
  -- Para cada estabelecimento, a obrigatoriedade do controle de jornada nasce
  -- quando a contagem passa de 20 (art. 74, §2). Conta POR ESTABELECIMENTO.
  FOR e IN
    SELECT id, razao_social, COALESCE(usa_controle_ponto, false) AS usa
    FROM public.empresa_cadastro
    WHERE tenant_id = p_tenant_id
      AND (p_empresa_id IS NULL OR id = p_empresa_id)
  LOOP
    v_trab := public.ponto_estabelecimento_trabalhadores(p_tenant_id, e.id);
    v_obrig := v_trab > 20;

    UPDATE public.empresa_cadastro
       SET controle_ponto_obrigatorio = v_obrig
     WHERE id = e.id AND controle_ponto_obrigatorio IS DISTINCT FROM v_obrig;

    -- Obrigado que ainda NAO usa controle de ponto: alerta.
    IF v_obrig AND NOT e.usa THEN
      INSERT INTO public.ponto_alertas
        (tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
         tipo, severidade, titulo, descricao, data_referencia)
      SELECT p_tenant_id, e.id, NULL, NULL, NULL,
             'controle_ponto_obrigatorio', 'alta',
             'Estabelecimento obrigado ao controle de jornada sem controle ativo',
             format('O estabelecimento %s tem %s trabalhadores ativos (passa de 20) e e obrigado '
                 || 'ao controle de jornada (CLT art. 74, §2), mas ainda nao usa controle de ponto. '
                 || 'Sem controle, a jornada alegada pelo empregado prevalece (Sumula 338 do TST).',
                 COALESCE(e.razao_social,'-'), v_trab),
             CURRENT_DATE
      WHERE NOT EXISTS (
        SELECT 1 FROM public.ponto_alertas a
        WHERE a.tenant_id = p_tenant_id
          AND a.tipo = 'controle_ponto_obrigatorio'
          AND a.empresa_id = e.id
          AND a.data_referencia = CURRENT_DATE
      );
      GET DIAGNOSTICS v_ins = ROW_COUNT;
      v_n := v_n + v_ins;
    END IF;
  END LOOP;

  RETURN v_n;
END;
$$;

COMMENT ON FUNCTION public.ponto_estabelecimento_obrigatoriedade_monitorar(uuid, uuid) IS
  'Resolve a obrigatoriedade do controle de jornada por estabelecimento (passa de 20 trabalhadores, art. 74, §2) e alerta o estabelecimento obrigado que ainda nao usa controle de ponto. Idempotente por estabelecimento/dia. PONTO-370.';
