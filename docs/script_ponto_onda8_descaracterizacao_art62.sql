-- ============================================================================
-- ENTREGA — ONDA 8 (parte 2): controle de fato descaracteriza a dispensa (art. 62)
-- Alvo: ponto_detectar_descaracterizacao_art62 (nova)
-- PONTO-375  (depende da parte 1 — o enquadramento do art. 62)
--
-- A dispensa do art. 62 cai na Justica quando ha CONTROLE DE FATO: um vinculo
-- marcado como dispensado que, na pratica, acumula marcacoes reais. A rotina cruza
-- o enquadramento (dispensado_ponto) com as marcacoes reais recentes e gera um
-- alerta critico por colaborador, para RH/Juridico revisar o enquadramento antes
-- que a exclusao seja descaracterizada e as horas extras do periodo voltem.
--
-- GARANTIAS: so leitura das marcacoes + gravacao de alerta. Nao altera o motor de
-- saldo, o espelho, o fechamento nem o enquadramento. Aditivo e idempotente.
-- Roda inteiro em UMA transacao.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ponto_detectar_descaracterizacao_art62(
  p_tenant_id         uuid,
  p_empresa_id        uuid    DEFAULT NULL,
  p_dias              integer DEFAULT 60,
  p_min_dias_marcados integer DEFAULT 3
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_n   int := 0;
  v_ins int;
  r     RECORD;
BEGIN
  -- Dispensados do art. 62 com marcações reais recorrentes no período recente:
  -- controle de fato que descaracteriza a exclusão. Marcações desconsideradas
  -- não contam (não são batida válida).
  FOR r IN
    SELECT a.empresa_id, a.cpf, a.nome_completo, a.art62_inciso,
           count(DISTINCT m.data_marcacao) AS dias_marcados,
           max(m.data_marcacao) AS ultima
    FROM public.admissoes a
    JOIN public.ponto_marcacoes m
      ON m.tenant_id = a.tenant_id
     AND regexp_replace(COALESCE(m.colaborador_cpf,''),'[^0-9]','','g')
         = regexp_replace(COALESCE(a.cpf,''),'[^0-9]','','g')
     AND m.data_marcacao >= (CURRENT_DATE - p_dias)
     AND COALESCE(m.desconsiderada, false) = false
    WHERE a.tenant_id = p_tenant_id
      AND COALESCE(a.dispensado_ponto, false) = true
      AND COALESCE(a.inativo, false) = false
      AND (p_empresa_id IS NULL OR a.empresa_id = p_empresa_id)
    GROUP BY a.empresa_id, a.cpf, a.nome_completo, a.art62_inciso
    HAVING count(DISTINCT m.data_marcacao) >= p_min_dias_marcados
  LOOP
    INSERT INTO public.ponto_alertas
      (tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
       tipo, severidade, titulo, descricao, data_referencia)
    SELECT p_tenant_id, r.empresa_id, NULL, r.nome_completo, r.cpf,
           'descaracterizacao_art62', 'critica',
           'Controle de fato sobre dispensado do art. 62 (risco de descaracterizacao)',
           format('Vinculo enquadrado no art. 62 (inciso %s), portanto dispensado de controle, '
               || 'acumulou marcacoes reais em %s dia(s) nos ultimos %s dias (ultima em %s). '
               || 'Controle de fato descaracteriza a exclusao do art. 62 e traz as horas extras '
               || 'do periodo — revisar o enquadramento com RH/Juridico.',
               COALESCE(r.art62_inciso,'-'), r.dias_marcados, p_dias, to_char(r.ultima,'DD/MM/YYYY')),
           CURRENT_DATE
    WHERE NOT EXISTS (
      SELECT 1 FROM public.ponto_alertas a
      WHERE a.tenant_id = p_tenant_id
        AND a.tipo = 'descaracterizacao_art62'
        AND a.colaborador_cpf = r.cpf
        AND a.data_referencia = CURRENT_DATE
    );
    GET DIAGNOSTICS v_ins = ROW_COUNT;
    v_n := v_n + v_ins;
  END LOOP;

  RETURN v_n;
END;
$$;

COMMENT ON FUNCTION public.ponto_detectar_descaracterizacao_art62(uuid, uuid, integer, integer) IS
  'Detecta descaracterizacao da dispensa do art. 62: vinculo dispensado (dispensado_ponto) com marcacoes reais recorrentes no periodo recente gera alerta critico a RH/Juridico (controle de fato derruba a exclusao). Idempotente por colaborador/dia. PONTO-375.';

-- ---------------------------------------------------------------------------
-- CONFERENCIA — o SQL Editor mostra apenas o ultimo resultado.
-- Esperado: t | t | OK
--   deteccao_existe : t (ponto_detectar_descaracterizacao_art62)
--   confere_dispensa: t (a rotina cruza com o enquadramento dispensado_ponto)
-- ---------------------------------------------------------------------------
SELECT
  (to_regprocedure('public.ponto_detectar_descaracterizacao_art62(uuid,uuid,integer,integer)') IS NOT NULL) AS deteccao_existe,
  (public.qa_col_existe('admissoes','%dispensado_ponto%') IS NOT NULL)                                       AS confere_dispensa,
  CASE WHEN to_regprocedure('public.ponto_detectar_descaracterizacao_art62(uuid,uuid,integer,integer)') IS NOT NULL
        AND public.qa_col_existe('admissoes','%dispensado_ponto%') IS NOT NULL
       THEN 'OK' ELSE 'CONFERIR' END AS erro_tecnico;
