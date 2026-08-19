-- ============================================================================
-- ENTREGA — ONDA 4 (parte 2): supressão de intervalo intrajornada
-- Alvos: ponto_supressao_intervalo; gatilho ponto_diario_supressao_intervalo
-- PONTO-060 / PONTO-061
--
-- O QUE FAZ (CLT art. 71, §4º pós-2017)
--   Jornada acima de 6h com pausa menor que a devida gera supressão de intervalo:
--   indenização de 50% sobre APENAS os minutos suprimidos, natureza indenizatória
--   (sem reflexos). A função calcula; um gatilho na consolidação grava os minutos
--   suprimidos em ponto_diario.he_intervalo_suprimido_minutos e alerta o RH
--   (parcial ou total), idempotente por colaborador/dia.
--
-- Depende da parte 1 (faixas de intervalo, #16). Aditivo e idempotente. Sem backfill.
-- ============================================================================

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

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA — o SQL Editor mostra apenas o último resultado.
-- Esperado: t | t | 60 | 0 | OK
--   funcao_existe   : t   (ponto_supressao_intervalo)
--   gatilho_existe  : t   (deteccao na consolidacao)
--   supr_total      : 60  (8h30 sem pausa suprime 60 min)
--   supr_normal     : 0   (8h com 60min de pausa nao suprime)
-- ---------------------------------------------------------------------------
SELECT
  (to_regprocedure('public.ponto_supressao_intervalo(integer,integer)') IS NOT NULL) AS funcao_existe,
  (EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_ponto_diario_supressao_intervalo'
     AND tgrelid='public.ponto_diario'::regclass AND NOT tgisinternal)) AS gatilho_existe,
  (public.ponto_supressao_intervalo(510,0)->>'minutos_suprimidos')::int AS supr_total,
  (public.ponto_supressao_intervalo(480,60)->>'minutos_suprimidos')::int AS supr_normal,
  CASE
    WHEN to_regprocedure('public.ponto_supressao_intervalo(integer,integer)') IS NOT NULL
     AND (EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_ponto_diario_supressao_intervalo'
            AND tgrelid='public.ponto_diario'::regclass AND NOT tgisinternal))
     AND (public.ponto_supressao_intervalo(510,0)->>'minutos_suprimidos')::int = 60
     AND (public.ponto_supressao_intervalo(480,60)->>'minutos_suprimidos')::int = 0
      THEN 'OK' ELSE 'CONFERIR'
  END AS erro_tecnico;
