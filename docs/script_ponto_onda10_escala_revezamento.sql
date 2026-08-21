-- ============================================================================
-- ENTREGA — ONDA 10 (parte 2): revezamento — jornada de 6h, salvo coletivo (ESC-031)
--
-- O turno ininterrupto de revezamento tem jornada constitucional de 6h (CF art.
-- 7º, XIV); só a negociação coletiva amplia (STF: até 8h por CCT/ACT). Hoje o
-- revezamento não existe como conceito: a modalidade só conhece 'fixa'/'movel' e
-- nada valida as 6h.
--
-- O QUE FAZ (aditivo, NÃO bloqueia o cadastro): tipifica 'revezamento' na
-- modalidade e estende a formalização (mesmo fio do ESC-001) — revezamento acima
-- de 6h sem instrumento COLETIVO gera pendência/alerta. Não altera o motor de
-- saldo, a apuração, o espelho nem o fechamento. Idempotente. Roda em UMA transação.
-- ============================================================================

SET lock_timeout = '10s';

ALTER TABLE public.ponto_escalas DROP CONSTRAINT IF EXISTS ponto_escalas_modalidade_check;
ALTER TABLE public.ponto_escalas ADD CONSTRAINT ponto_escalas_modalidade_check
  CHECK (modalidade IS NULL OR modalidade = ANY (ARRAY['fixa'::text, 'movel'::text, 'revezamento'::text]));

CREATE OR REPLACE FUNCTION public.ponto_escala_formalizacao_status(p_escala_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  e         RECORD;
  v_tem_col boolean;
BEGIN
  SELECT id, tenant_id, tipo, modalidade, jornada_diaria_minutos,
         acordo_individual_url, cct_act_url
    INTO e
  FROM public.ponto_escalas
  WHERE id = p_escala_id;

  IF NOT FOUND THEN
    RETURN 'nao_se_aplica';
  END IF;

  v_tem_col := EXISTS (
    SELECT 1 FROM public.ponto_acordos ac
    WHERE ac.tenant_id = e.tenant_id
      AND COALESCE(ac.ativo, false) = true
      AND ac.tipo IN ('act', 'cct')
      AND (ac.vigencia_inicio IS NULL OR ac.vigencia_inicio <= CURRENT_DATE)
      AND (ac.vigencia_fim    IS NULL OR ac.vigencia_fim    >= CURRENT_DATE)
  );

  IF COALESCE(e.tipo, '') = '12x36' THEN
    IF btrim(COALESCE(e.acordo_individual_url, '')) <> ''
       OR btrim(COALESCE(e.cct_act_url, '')) <> ''
       OR v_tem_col THEN
      RETURN 'regular';
    END IF;
    RETURN 'pendente';
  END IF;

  IF COALESCE(e.modalidade, '') = 'revezamento' THEN
    IF COALESCE(e.jornada_diaria_minutos, 0) <= 360 THEN
      RETURN 'regular';
    END IF;
    IF btrim(COALESCE(e.cct_act_url, '')) <> '' OR v_tem_col THEN
      RETURN 'regular';
    END IF;
    RETURN 'pendente';
  END IF;

  RETURN 'nao_se_aplica';
END;
$function$;

COMMENT ON FUNCTION public.ponto_escala_formalizacao_status(uuid) IS
  'Formalizacao da escala: 12x36 exige acordo (art. 59-A); revezamento acima de 6h exige instrumento COLETIVO (CF art. 7, XIV). Le acordo_individual_url/cct_act_url e o coletivo vigente. Devolve regular | pendente | nao_se_aplica. ESC-001/ESC-031.';

CREATE OR REPLACE FUNCTION public.ponto_escala_formalizacao_monitorar(
  p_tenant_id uuid,
  p_empresa_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_n     int := 0;
  v_ins   int;
  esc     RECORD;
  v_tipo  text;
  v_tit   text;
  v_desc  text;
BEGIN
  FOR esc IN
    SELECT id, empresa_id, nome, tipo, modalidade, jornada_diaria_minutos
    FROM public.ponto_escalas
    WHERE tenant_id = p_tenant_id
      AND COALESCE(ativa, true) = true
      AND (COALESCE(tipo, '') = '12x36' OR COALESCE(modalidade, '') = 'revezamento')
      AND (p_empresa_id IS NULL OR empresa_id = p_empresa_id)
  LOOP
    IF public.ponto_escala_formalizacao_status(esc.id) <> 'pendente' THEN
      CONTINUE;
    END IF;

    IF COALESCE(esc.tipo, '') = '12x36' THEN
      v_tipo := 'escala_formalizacao_pendente';
      v_tit  := 'Escala 12x36 sem acordo formal (art. 59-A)';
      v_desc := format('A escala "%s" e 12x36 e esta ativa, mas nao tem acordo formal anexado '
                 || '(acordo individual escrito, ACT ou CCT) nem coletivo vigente. O art. 59-A '
                 || 'da CLT condiciona a 12x36 a esse acordo; sem ele a jornada e invalida e '
                 || 'toda hora alem da 8a vira extra com reflexos. Anexe o acordo assinado e '
                 || 'arquive no modulo Documentos para regularizar. [escala:%s]',
                 COALESCE(esc.nome, '-'), esc.id);
    ELSE
      v_tipo := 'escala_revezamento_sem_coletivo';
      v_tit  := 'Revezamento acima de 6h sem instrumento coletivo (CF art. 7, XIV)';
      v_desc := format('A escala "%s" e de revezamento com jornada de %s min (acima de 6h) e nao '
                 || 'tem instrumento coletivo (CCT/ACT) que autorize a ampliacao. O turno '
                 || 'ininterrupto de revezamento tem jornada constitucional de 6h; so a '
                 || 'negociacao coletiva amplia (o STF admite ate 8h). Sem o coletivo, a 7a e a '
                 || '8a hora de todos os turnos viram extra. Anexe a CCT/ACT ou ajuste a jornada '
                 || 'para 6h. [escala:%s]',
                 COALESCE(esc.nome, '-'), COALESCE(esc.jornada_diaria_minutos, 0), esc.id);
    END IF;

    INSERT INTO public.ponto_alertas
      (tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
       tipo, severidade, titulo, descricao, data_referencia)
    SELECT p_tenant_id, esc.empresa_id, NULL, NULL, NULL,
           v_tipo, 'alta', v_tit, v_desc, CURRENT_DATE
    WHERE NOT EXISTS (
      SELECT 1 FROM public.ponto_alertas a
      WHERE a.tenant_id = p_tenant_id
        AND a.tipo = v_tipo
        AND a.data_referencia = CURRENT_DATE
        AND a.descricao LIKE '%[escala:' || esc.id || ']%'
    );
    GET DIAGNOSTICS v_ins = ROW_COUNT;
    v_n := v_n + v_ins;
  END LOOP;

  RETURN v_n;
END;
$function$;

COMMENT ON FUNCTION public.ponto_escala_formalizacao_monitorar(uuid, uuid) IS
  'Gera pendencia (alerta) para 12x36 sem acordo (art. 59-A) e revezamento acima de 6h sem coletivo (CF art. 7, XIV). Idempotente por escala/dia. Nao bloqueia o cadastro. ESC-001/ESC-031.';

-- ---------------------------------------------------------------------------
-- CONFERENCIA — o SQL Editor mostra apenas o ultimo resultado.
-- Esperado: t | t | t | OK
--   modalidade_ok : a modalidade aceita 'revezamento'
--   status_ok     : o verificador menciona revezamento
--   monitor_ok    : o monitor existe
-- ---------------------------------------------------------------------------
SELECT
  (pg_get_constraintdef(c.oid) ILIKE '%revezamento%')                                    AS modalidade_ok,
  EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
          WHERE n.nspname='public' AND p.proname='ponto_escala_formalizacao_status'
            AND p.prosrc ILIKE '%revezamento%')                                          AS status_ok,
  (to_regprocedure('public.ponto_escala_formalizacao_monitorar(uuid,uuid)') IS NOT NULL) AS monitor_ok,
  CASE WHEN (pg_get_constraintdef(c.oid) ILIKE '%revezamento%')
        AND EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                    WHERE n.nspname='public' AND p.proname='ponto_escala_formalizacao_status'
                      AND p.prosrc ILIKE '%revezamento%')
       THEN 'OK' ELSE 'CONFERIR' END AS erro_tecnico
FROM pg_constraint c
WHERE c.conrelid = 'public.ponto_escalas'::regclass
  AND c.conname = 'ponto_escalas_modalidade_check';
