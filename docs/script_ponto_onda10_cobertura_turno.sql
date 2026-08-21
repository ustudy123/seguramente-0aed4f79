-- ============================================================================
-- ENTREGA — ONDA 10 (parte 3): radar de cobertura de turno (ESC-021)
--
-- Um turno previsto sem colaborador disponível (quem estava atribuído entrou de
-- férias, se afastou ou foi desligado) precisa aparecer ANTES do dia. Hoje o
-- sistema tem os ingredientes (atribuições com vigência, afastamentos, férias,
-- desligamentos) e não os cruza.
--
-- O QUE FAZ (aditivo, somente leitura + alerta): projeta os próximos dias de cada
-- escala com atribuição vigente e acusa o dia em que TODOS os colaboradores
-- atribuídos estão indisponíveis — turno descoberto —, com alerta ao gestor.
-- Não bloqueia nada, não altera o motor de saldo, a apuração, o espelho nem o
-- fechamento. Idempotente. Roda inteiro em UMA transação.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ponto_escala_cobertura_listar(
  p_tenant_id uuid,
  p_empresa_id uuid DEFAULT NULL,
  p_dias_a_frente integer DEFAULT 7
)
RETURNS TABLE(escala_id uuid, escala_nome text, empresa_id uuid, data_descoberta date, motivo text)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH dias AS (
    SELECT (CURRENT_DATE + g)::date AS d
    FROM generate_series(1, GREATEST(1, LEAST(COALESCE(p_dias_a_frente, 7), 60))) AS g
  ),
  esc AS (
    SELECT e.id, e.nome, e.empresa_id
    FROM public.ponto_escalas e
    WHERE e.tenant_id = p_tenant_id
      AND COALESCE(e.ativa, true) = true
      AND (p_empresa_id IS NULL OR e.empresa_id = p_empresa_id)
      AND EXISTS (SELECT 1 FROM public.ponto_escala_atribuicoes a
                  WHERE a.escala_id = e.id AND COALESCE(a.ativa, true) = true)
  ),
  cobertura AS (
    SELECT e.id AS escala_id, e.nome, e.empresa_id, dd.d,
      (
           EXISTS (SELECT 1 FROM public.afastamentos af
                   WHERE af.tenant_id = p_tenant_id
                     AND af.colaborador_cpf = a.colaborador_cpf
                     AND COALESCE(af.status::text, '') <> 'encerrado'
                     AND af.data_inicio <= dd.d
                     AND (af.data_fim IS NULL OR af.data_fim >= dd.d))
        OR EXISTS (SELECT 1 FROM public.ferias_solicitacoes fs
                   WHERE fs.tenant_id = p_tenant_id
                     AND fs.colaborador_cpf = a.colaborador_cpf
                     AND fs.status ILIKE '%aprov%'
                     AND fs.data_inicio <= dd.d
                     AND (fs.data_fim IS NULL OR fs.data_fim >= dd.d))
        OR EXISTS (SELECT 1 FROM public.admissoes ad
                   WHERE ad.tenant_id = p_tenant_id
                     AND ad.cpf = a.colaborador_cpf
                     AND ad.status = 'desligado'
                     AND (ad.data_desligamento IS NULL OR ad.data_desligamento <= dd.d))
      ) AS indisponivel
    FROM esc e
    JOIN dias dd ON true
    JOIN public.ponto_escala_atribuicoes a
      ON a.escala_id = e.id
     AND COALESCE(a.ativa, true) = true
     AND a.data_inicio <= dd.d
     AND (a.data_fim IS NULL OR a.data_fim >= dd.d)
  )
  SELECT c.escala_id, c.nome, c.empresa_id, c.d,
         'Todos os colaboradores atribuidos ao turno estao indisponiveis (afastamento, ferias ou desligamento) neste dia.'::text
  FROM cobertura c
  GROUP BY c.escala_id, c.nome, c.empresa_id, c.d
  HAVING bool_and(c.indisponivel) = true
  ORDER BY c.d, c.nome;
$function$;

COMMENT ON FUNCTION public.ponto_escala_cobertura_listar(uuid, uuid, integer) IS
  'Radar de cobertura de turno: lista os dias em que uma escala com atribuicao vigente fica com TODOS os colaboradores indisponiveis (afastamento/ferias/desligamento) — turno descoberto. Somente leitura. ESC-021.';

CREATE OR REPLACE FUNCTION public.ponto_escala_cobertura_monitorar(
  p_tenant_id uuid,
  p_empresa_id uuid DEFAULT NULL,
  p_dias_a_frente integer DEFAULT 7
)
RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_n   int := 0;
  v_ins int;
  rec   RECORD;
BEGIN
  FOR rec IN
    SELECT * FROM public.ponto_escala_cobertura_listar(p_tenant_id, p_empresa_id, p_dias_a_frente)
  LOOP
    INSERT INTO public.ponto_alertas
      (tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
       tipo, severidade, titulo, descricao, data_referencia)
    SELECT p_tenant_id, rec.empresa_id, NULL, NULL, NULL,
           'escala_cobertura_descoberta', 'alta',
           'Turno descoberto previsto — escala sem colaborador disponivel',
           format('A escala "%s" tem turno previsto para %s sem nenhum colaborador disponivel: %s '
               || 'Projete a cobertura (troca de turno, hora extra combinada ou remanejamento) ANTES '
               || 'do dia — a virada de ultima hora costuma ser dobra de turno, que estoura a '
               || 'interjornada de 11h e a hora extra. [escala:%s]',
               COALESCE(rec.escala_nome, '-'), rec.data_descoberta, rec.motivo, rec.escala_id),
           rec.data_descoberta
    WHERE NOT EXISTS (
      SELECT 1 FROM public.ponto_alertas a
      WHERE a.tenant_id = p_tenant_id
        AND a.tipo = 'escala_cobertura_descoberta'
        AND a.data_referencia = rec.data_descoberta
        AND a.descricao LIKE '%[escala:' || rec.escala_id || ']%'
    );
    GET DIAGNOSTICS v_ins = ROW_COUNT;
    v_n := v_n + v_ins;
  END LOOP;

  RETURN v_n;
END;
$function$;

COMMENT ON FUNCTION public.ponto_escala_cobertura_monitorar(uuid, uuid, integer) IS
  'Gera alerta ao gestor para cada turno descoberto previsto (escala com atribuicao vigente e todos os colaboradores indisponiveis no dia). Idempotente por escala/dia. ESC-021.';

-- ---------------------------------------------------------------------------
-- CONFERENCIA — o SQL Editor mostra apenas o ultimo resultado.
-- Esperado: t | t | OK — o listador e o monitor existem e falam de turno/cobertura.
-- ---------------------------------------------------------------------------
SELECT
  (to_regprocedure('public.ponto_escala_cobertura_listar(uuid,uuid,integer)') IS NOT NULL)   AS listador_ok,
  (to_regprocedure('public.ponto_escala_cobertura_monitorar(uuid,uuid,integer)') IS NOT NULL) AS monitor_ok,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='ponto_escala_cobertura_monitorar'
      AND p.prosrc ILIKE '%turno%' AND (p.prosrc ILIKE '%cobertura%' OR p.prosrc ILIKE '%descobert%')
  ) THEN 'OK' ELSE 'CONFERIR' END AS erro_tecnico;
