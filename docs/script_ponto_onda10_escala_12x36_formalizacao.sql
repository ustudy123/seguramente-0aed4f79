-- ============================================================================
-- ENTREGA — ONDA 10 (parte 1): escala 12x36 só vale com acordo formal (ESC-001)
--
-- O art. 59-A da CLT condiciona a 12x36 a acordo individual ESCRITO, ACT ou CCT.
-- Hoje a 12x36 nasce ativa e é atribuída sem que nada cobre o acordo — as colunas
-- existem (ponto_escalas.acordo_individual_url, cct_act_url) e nenhuma função as lê.
--
-- O QUE FAZ (aditivo, NÃO bloqueia o cadastro): cria o verificador de formalização
-- da escala e um monitor que gera PENDÊNCIA (alerta) para toda 12x36 ativa sem
-- acordo formal (documento anexado ou coletivo act/cct vigente). Anexado o acordo,
-- a pendência deixa de ser gerada. Não altera o motor de saldo, a apuração do ciclo,
-- o espelho nem o fechamento. Idempotente. Roda inteiro em UMA transação.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ponto_escala_formalizacao_status(p_escala_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  e         RECORD;
  v_tem_doc boolean;
  v_tem_col boolean;
BEGIN
  SELECT id, tenant_id, tipo, acordo_individual_url, cct_act_url
    INTO e
  FROM public.ponto_escalas
  WHERE id = p_escala_id;

  IF NOT FOUND THEN
    RETURN 'nao_se_aplica';
  END IF;

  IF COALESCE(e.tipo, '') <> '12x36' THEN
    RETURN 'nao_se_aplica';
  END IF;

  v_tem_doc := btrim(COALESCE(e.acordo_individual_url, '')) <> ''
            OR btrim(COALESCE(e.cct_act_url, '')) <> '';

  v_tem_col := EXISTS (
    SELECT 1 FROM public.ponto_acordos ac
    WHERE ac.tenant_id = e.tenant_id
      AND COALESCE(ac.ativo, false) = true
      AND ac.tipo IN ('act', 'cct')
      AND (ac.vigencia_inicio IS NULL OR ac.vigencia_inicio <= CURRENT_DATE)
      AND (ac.vigencia_fim    IS NULL OR ac.vigencia_fim    >= CURRENT_DATE)
  );

  IF v_tem_doc OR v_tem_col THEN
    RETURN 'regular';
  END IF;

  RETURN 'pendente';
END;
$function$;

COMMENT ON FUNCTION public.ponto_escala_formalizacao_status(uuid) IS
  'Formalizacao da escala 12x36 (art. 59-A): le acordo_individual_url/cct_act_url e o coletivo vigente em ponto_acordos. Devolve regular | pendente | nao_se_aplica. ESC-001.';

CREATE OR REPLACE FUNCTION public.ponto_escala_formalizacao_monitorar(
  p_tenant_id uuid,
  p_empresa_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_n   int := 0;
  v_ins int;
  esc   RECORD;
BEGIN
  FOR esc IN
    SELECT id, empresa_id, nome
    FROM public.ponto_escalas
    WHERE tenant_id = p_tenant_id
      AND COALESCE(tipo, '') = '12x36'
      AND COALESCE(ativa, true) = true
      AND (p_empresa_id IS NULL OR empresa_id = p_empresa_id)
  LOOP
    IF public.ponto_escala_formalizacao_status(esc.id) = 'pendente' THEN
      INSERT INTO public.ponto_alertas
        (tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
         tipo, severidade, titulo, descricao, data_referencia)
      SELECT p_tenant_id, esc.empresa_id, NULL, NULL, NULL,
             'escala_formalizacao_pendente', 'alta',
             'Escala 12x36 sem acordo formal (art. 59-A)',
             format('A escala "%s" e 12x36 e esta ativa, mas nao tem acordo formal anexado '
                 || '(acordo individual escrito, ACT ou CCT) nem coletivo vigente. O art. 59-A '
                 || 'da CLT condiciona a 12x36 a esse acordo; sem ele a jornada e invalida e '
                 || 'toda hora alem da 8a vira extra com reflexos. Anexe o acordo assinado e '
                 || 'arquive no modulo Documentos para regularizar. [escala:%s]',
                 COALESCE(esc.nome, '-'), esc.id),
             CURRENT_DATE
      WHERE NOT EXISTS (
        SELECT 1 FROM public.ponto_alertas a
        WHERE a.tenant_id = p_tenant_id
          AND a.tipo = 'escala_formalizacao_pendente'
          AND a.data_referencia = CURRENT_DATE
          AND a.descricao LIKE '%[escala:' || esc.id || ']%'
      );
      GET DIAGNOSTICS v_ins = ROW_COUNT;
      v_n := v_n + v_ins;
    END IF;
  END LOOP;

  RETURN v_n;
END;
$function$;

COMMENT ON FUNCTION public.ponto_escala_formalizacao_monitorar(uuid, uuid) IS
  'Gera pendencia (alerta) para 12x36 ativa sem acordo formal (art. 59-A). Idempotente por escala/dia. Nao bloqueia o cadastro. ESC-001.';

-- ---------------------------------------------------------------------------
-- CONFERENCIA — o SQL Editor mostra apenas o ultimo resultado.
-- Esperado: t | t | OK — o verificador e o monitor existem e leem o acordo.
-- ---------------------------------------------------------------------------
SELECT
  (to_regprocedure('public.ponto_escala_formalizacao_status(uuid)') IS NOT NULL)      AS verificador_ok,
  (to_regprocedure('public.ponto_escala_formalizacao_monitorar(uuid,uuid)') IS NOT NULL) AS monitor_ok,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='ponto_escala_formalizacao_status'
      AND (p.prosrc ILIKE '%acordo_individual_url%' OR p.prosrc ILIKE '%cct_act_url%')
  ) THEN 'OK' ELSE 'CONFERIR' END AS erro_tecnico;
