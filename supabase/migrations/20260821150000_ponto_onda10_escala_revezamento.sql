-- ============================================================================
-- ONDA 10 (parte 2) — Revezamento: jornada de 6h, salvo negociação coletiva (ESC-031)
--
-- O turno ininterrupto de revezamento tem jornada constitucional de 6 HORAS
-- (CF art. 7º, XIV); só a negociação coletiva pode ampliá-la (o STF admite até
-- 8h por CCT/ACT). Hoje o revezamento não existe como conceito: a modalidade da
-- escala só conhece 'fixa'/'movel', nenhuma função valida as 6h, e uma indústria
-- em 3 turnos cadastrada como escala comum de 8h roda sem protesto — a 7ª e a 8ª
-- hora de TODOS os turnos viram extra em juízo, do período inteiro.
--
-- O QUE FAZ (aditivo, não bloqueia o cadastro): (1) tipifica 'revezamento' na
-- modalidade da escala; (2) estende a formalização (mesmo fio do ESC-001): uma
-- escala de revezamento com jornada acima de 6h sem instrumento COLETIVO (CCT/ACT
-- anexado ou coletivo vigente) gera PENDÊNCIA/alerta. Revezamento de até 6h é
-- regular (piso constitucional). Acordo individual NÃO autoriza ampliar (só o
-- coletivo, CF art. 7º, XIV).
--
-- GARANTIAS: não altera o motor de saldo, a apuração, o espelho nem o fechamento.
-- Só tipifica, verifica e sinaliza. Aditivo e idempotente. Sem gatilho em tabela
-- quente. A troca do CHECK só amplia o conjunto (superset) — nenhuma linha atual
-- deixa de passar.
-- ============================================================================

SET lock_timeout = '10s';

-- (1) Tipifica 'revezamento' na modalidade (amplia o conjunto; NULL segue válido).
ALTER TABLE public.ponto_escalas DROP CONSTRAINT IF EXISTS ponto_escalas_modalidade_check;
ALTER TABLE public.ponto_escalas ADD CONSTRAINT ponto_escalas_modalidade_check
  CHECK (modalidade IS NULL OR modalidade = ANY (ARRAY['fixa'::text, 'movel'::text, 'revezamento'::text]));

-- (2) Verificador estendido: 12x36 (art. 59-A) e revezamento (CF art. 7º, XIV).
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

  -- Coletivo (act/cct) vigente para o tenant.
  v_tem_col := EXISTS (
    SELECT 1 FROM public.ponto_acordos ac
    WHERE ac.tenant_id = e.tenant_id
      AND COALESCE(ac.ativo, false) = true
      AND ac.tipo IN ('act', 'cct')
      AND (ac.vigencia_inicio IS NULL OR ac.vigencia_inicio <= CURRENT_DATE)
      AND (ac.vigencia_fim    IS NULL OR ac.vigencia_fim    >= CURRENT_DATE)
  );

  -- 12x36 (art. 59-A): acordo individual ESCRITO, ACT ou CCT.
  IF COALESCE(e.tipo, '') = '12x36' THEN
    IF btrim(COALESCE(e.acordo_individual_url, '')) <> ''
       OR btrim(COALESCE(e.cct_act_url, '')) <> ''
       OR v_tem_col THEN
      RETURN 'regular';
    END IF;
    RETURN 'pendente';
  END IF;

  -- Revezamento (CF art. 7º, XIV): jornada de 6h; acima disso só com COLETIVO.
  -- Acordo individual não autoriza a ampliação — apenas CCT/ACT.
  IF COALESCE(e.modalidade, '') = 'revezamento' THEN
    IF COALESCE(e.jornada_diaria_minutos, 0) <= 360 THEN
      RETURN 'regular';                       -- até 6h é o piso constitucional
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

-- (3) Monitor estendido: pendência específica por natureza (12x36 x revezamento).
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
