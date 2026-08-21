-- ============================================================================
-- ONDA 10 (parte 1) — Escala 12x36 só vale com acordo formal (ESC-001)
--
-- A escala 12x36 não é escolha administrativa: o art. 59-A da CLT a condiciona a
-- ACORDO INDIVIDUAL ESCRITO, ACT ou CCT. Hoje a 12x36 nasce ativa e é atribuída
-- sem que NADA cobre o acordo — as colunas existem (ponto_escalas.acordo_individual_url,
-- cct_act_url) e nenhuma função as lê. A apuração do ciclo funciona (PONTO-150/151),
-- o que agrava: o sistema apura direitinho uma escala juridicamente inexistente, e
-- toda hora além da 8ª vira extra com reflexos, do período inteiro (passivo clássico).
--
-- O QUE FAZ (aditivo, não bloqueia o cadastro): cria o VERIFICADOR de formalização
-- da escala e um MONITOR que gera PENDÊNCIA (alerta) para toda 12x36 ativa sem
-- acordo formal — acordo individual/CCT anexado (acordo_individual_url/cct_act_url)
-- OU um acordo coletivo (act/cct) vigente em ponto_acordos. Anexado o acordo, a
-- pendência não é mais gerada (regulariza). Espelha o padrão de PONTO-370/213.
--
-- GARANTIAS: não altera o motor de saldo, a apuração do ciclo, o espelho nem o
-- fechamento. Só verifica e sinaliza. Aditivo e idempotente. Sem gatilho em tabela
-- quente (é monitor sob demanda / agendável), sem tabela nova (sem cerca a instalar).
-- ============================================================================

-- Verificador: a formalização exigida por uma escala está em ordem?
-- Devolve 'regular' | 'pendente' | 'nao_se_aplica'. Lê acordo_individual_url e
-- cct_act_url da própria escala e, em falta, procura um coletivo vigente.
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

  -- Parte 1 cobre a 12x36 (art. 59-A). Outras modalidades que exigem instrumento
  -- coletivo entram nas partes seguintes desta onda.
  IF COALESCE(e.tipo, '') <> '12x36' THEN
    RETURN 'nao_se_aplica';
  END IF;

  -- Documento anexado na própria escala (acordo individual escrito, ACT ou CCT).
  v_tem_doc := btrim(COALESCE(e.acordo_individual_url, '')) <> ''
            OR btrim(COALESCE(e.cct_act_url, '')) <> '';

  -- Ou um acordo COLETIVO (act/cct) vigente para o tenant.
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

-- Monitor: gera a pendência de formalização para as 12x36 ativas sem acordo.
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
