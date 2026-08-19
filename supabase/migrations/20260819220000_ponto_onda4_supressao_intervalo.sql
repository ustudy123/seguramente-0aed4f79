-- ============================================================================
-- ONDA 4 (parte 2) — Supressão de intervalo intrajornada
-- PONTO-060 / PONTO-061
--
-- Jornada acima de 6h com pausa menor que a devida (art. 71) gera SUPRESSÃO de
-- intervalo. A redação pós-reforma (CLT art. 71, §4º, 2017) manda:
--   · indenização de 50% SOBRE APENAS OS MINUTOS SUPRIMIDOS (não a hora cheia);
--   · natureza INDENIZATÓRIA (sem reflexos em DSR, férias, 13º ou FGTS).
-- A regra antiga (hora cheia, natureza salarial) foi revogada.
--
-- O QUE FAZ (aditivo)
--   (060) ponto_supressao_intervalo(jornada_min, gozado_min): calcula o intervalo
--         devido (pela faixa da parte 1), os minutos suprimidos e a indenização
--         de 50% sobre eles.
--   (061) gatilho na consolidação do dia: grava os minutos suprimidos em
--         ponto_diario.he_intervalo_suprimido_minutos e, havendo supressão,
--         alerta o RH (idempotente por dia) — inclusive a supressão TOTAL
--         (jornada corrida sem nenhuma pausa), que hoje passa invisível.
-- ============================================================================

-- (060) Cálculo da supressão -------------------------------------------------
CREATE OR REPLACE FUNCTION public.ponto_supressao_intervalo(
  p_jornada_min integer,
  p_gozado_min  integer
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  -- Supressao de intervalo (CLT art. 71, §4º pos-2017): indenizacao de 50%
  -- sobre APENAS os minutos suprimidos, com natureza indenizatoria (sem
  -- reflexos). O intervalo devido vem da faixa de jornada (parte 1).
  SELECT jsonb_build_object(
    'minutos_devidos',        d.devido,
    'minutos_gozados',        COALESCE(p_gozado_min, 0),
    'minutos_suprimidos',     GREATEST(0, d.devido - COALESCE(p_gozado_min, 0)),
    'percentual_indenizacao', 50,
    'natureza',               'indenizatoria',
    'indenizavel',            (GREATEST(0, d.devido - COALESCE(p_gozado_min, 0)) > 0)
  )
  FROM (SELECT public.ponto_intervalo_minimo_faixa(p_jornada_min) AS devido) d;
$$;

COMMENT ON FUNCTION public.ponto_supressao_intervalo(integer, integer) IS
  'Supressao de intervalo (CLT art. 71 §4º pos-2017): minutos devidos (pela faixa), gozados, suprimidos e a indenizacao de 50% sobre os suprimidos, natureza indenizatoria (sem reflexos).';

-- (061) Detecção na consolidação: grava os minutos suprimidos e alerta --------
CREATE OR REPLACE FUNCTION public.ponto_diario_supressao_intervalo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_jornada   int;
  v_gozado    int;
  v_suprimido int;
BEGIN
  v_jornada := COALESCE(floor(EXTRACT(EPOCH FROM NEW.horas_trabalhadas)/60)::int, 0);

  IF NEW.saida_almoco IS NOT NULL AND NEW.retorno_almoco IS NOT NULL THEN
    v_gozado := GREATEST(0, floor(EXTRACT(EPOCH FROM (NEW.retorno_almoco - NEW.saida_almoco))/60)::int);
  ELSE
    v_gozado := 0;
  END IF;

  v_suprimido := (public.ponto_supressao_intervalo(v_jornada, v_gozado)->>'minutos_suprimidos')::int;
  NEW.he_intervalo_suprimido_minutos := v_suprimido;

  -- Sinaliza a supressao (parcial ou total). Idempotente por colaborador/dia.
  IF v_suprimido > 0 AND NEW.tenant_id IS NOT NULL THEN
    INSERT INTO public.ponto_alertas
      (tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
       tipo, severidade, titulo, descricao, data_referencia)
    SELECT NEW.tenant_id, NEW.empresa_id, NEW.colaborador_id::text,
           NEW.colaborador_nome, NEW.colaborador_cpf,
           'intervalo_suprimido', 'alta',
           CASE WHEN v_gozado = 0 THEN 'Intervalo intrajornada nao usufruido (supressao total)'
                ELSE 'Intervalo intrajornada suprimido (parcial)' END,
           format('Jornada de %s min com %s min de pausa: %s min de intervalo suprimidos '
               || '(art. 71). Indenizacao de 50%% sobre os minutos suprimidos, natureza '
               || 'indenizatoria. Regularizar antes do fechamento.',
               v_jornada, v_gozado, v_suprimido),
           NEW.data
    WHERE NOT EXISTS (
      SELECT 1 FROM public.ponto_alertas a
      WHERE a.tenant_id = NEW.tenant_id
        AND a.colaborador_cpf = NEW.colaborador_cpf
        AND a.tipo = 'intervalo_suprimido'
        AND a.data_referencia = NEW.data
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ponto_diario_supressao_intervalo ON public.ponto_diario;
CREATE TRIGGER trg_ponto_diario_supressao_intervalo
  BEFORE INSERT OR UPDATE ON public.ponto_diario
  FOR EACH ROW EXECUTE FUNCTION public.ponto_diario_supressao_intervalo();

COMMENT ON FUNCTION public.ponto_diario_supressao_intervalo() IS
  'Na consolidacao do dia: grava he_intervalo_suprimido_minutos e alerta o RH quando ha supressao de intervalo (parcial ou total). Idempotente por colaborador/dia. CLT art. 71.';
