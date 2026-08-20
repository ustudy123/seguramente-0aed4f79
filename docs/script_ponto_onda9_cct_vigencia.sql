-- ============================================================================
-- ENTREGA — ONDA 9: instrumento coletivo vigente NA competência (vigilância)
-- Alvo: nova função ponto_cct_vigiar_vigencia (leitura de ponto_cct_config)
-- PONTO-386
--
-- A apuração de horas (calcular_he_adicional_noturno_dia) JÁ escolhe o
-- instrumento coletivo cuja vigência cobre a DATA apurada — reapurar uma
-- competência antiga aplica a convenção da época (CF/88 art. 7º, XXVI). Faltava
-- a outra metade: ninguém avisa quando um instrumento vai vencer ou quando duas
-- vigências se sobrepõem. Sem isso, uma CCT vence sem renovação (competências
-- seguintes sem parâmetro) ou dois instrumentos disputam a mesma competência.
--
-- O QUE FAZ (aditivo): cria ponto_cct_vigiar_vigencia(tenant, empresa) —
-- gera alerta em ponto_alertas para (a) VENCIMENTO (60/30 dias/vencido) e
-- (b) SOBREPOSIÇÃO de vigências no mesmo escopo (empresa+categoria).
-- Idempotente; só lê ponto_cct_config e só escreve alertas. NÃO altera o motor
-- de saldo, o espelho nem o fechamento — a seleção por vigência na apuração fica
-- exatamente como está. Roda inteiro em UMA transação.
-- ============================================================================

SET lock_timeout = '10s';

CREATE OR REPLACE FUNCTION public.ponto_cct_vigiar_vigencia(
  p_tenant_id uuid,
  p_empresa_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_n   integer := 0;
  v_ins integer;
BEGIN
  -- (a) VENCIMENTO do instrumento coletivo: 60 dias / 30 dias / já vencido.
  INSERT INTO public.ponto_alertas
    (tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
     tipo, severidade, titulo, descricao, data_referencia)
  SELECT c.tenant_id, c.empresa_id, NULL, NULL, NULL,
         'cct_vigencia_vencimento',
         CASE WHEN c.vigencia_fim <  CURRENT_DATE            THEN 'critica'
              WHEN c.vigencia_fim <= CURRENT_DATE + 30       THEN 'alta'
              ELSE 'media' END,
         CASE WHEN c.vigencia_fim <  CURRENT_DATE
                THEN format('Instrumento coletivo "%s" VENCIDO', c.nome)
              WHEN c.vigencia_fim <= CURRENT_DATE + 30
                THEN format('Instrumento coletivo "%s" a vencer em ate 30 dias', c.nome)
              ELSE format('Instrumento coletivo "%s" a vencer em ate 60 dias', c.nome) END,
         format('O instrumento coletivo "%s"%s tem vigencia ate %s. A apuracao usa o '
             || 'instrumento vigente NA competencia (CF art. 7, XXVI); sem renovacao, as '
             || 'competencias seguintes ficam sem parametro coletivo. Renovar o instrumento '
             || 'ou cadastrar o novo com a nova vigencia.',
             c.nome,
             COALESCE(' (' || c.sindicato || ')', ''),
             to_char(c.vigencia_fim, 'DD/MM/YYYY')),
         c.vigencia_fim
  FROM public.ponto_cct_config c
  WHERE c.tenant_id = p_tenant_id
    AND (p_empresa_id IS NULL OR c.empresa_id = p_empresa_id)
    AND COALESCE(c.ativo, true) = true
    AND c.vigencia_fim IS NOT NULL
    AND c.vigencia_fim <= CURRENT_DATE + 60
    AND NOT EXISTS (
      SELECT 1 FROM public.ponto_alertas a
      WHERE a.tenant_id = c.tenant_id
        AND a.tipo = 'cct_vigencia_vencimento'
        AND a.data_referencia = c.vigencia_fim
        AND COALESCE(a.empresa_id::text, '') = COALESCE(c.empresa_id::text, '')
        AND a.titulo = (CASE WHEN c.vigencia_fim <  CURRENT_DATE
                    THEN format('Instrumento coletivo "%s" VENCIDO', c.nome)
                  WHEN c.vigencia_fim <= CURRENT_DATE + 30
                    THEN format('Instrumento coletivo "%s" a vencer em ate 30 dias', c.nome)
                  ELSE format('Instrumento coletivo "%s" a vencer em ate 60 dias', c.nome) END)
    );
  GET DIAGNOSTICS v_ins = ROW_COUNT;
  v_n := v_n + v_ins;

  -- (b) SOBREPOSICAO de vigencias no mesmo escopo (empresa + categoria).
  INSERT INTO public.ponto_alertas
    (tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
     tipo, severidade, titulo, descricao, data_referencia)
  SELECT c.tenant_id, c.empresa_id, NULL, NULL, NULL,
         'cct_vigencia_sobreposta', 'alta',
         format('Instrumentos coletivos com vigencias sobrepostas: "%s"', c.nome),
         format('O instrumento "%s" (vigencia %s a %s) se sobrepoe a outro instrumento '
             || 'ativo do mesmo escopo (empresa/categoria). Com vigencias sobrepostas, a '
             || 'apuracao fica ambigua sobre qual instrumento rege a competencia (CF art. 7, '
             || 'XXVI). Ajustar as vigencias para que cada competencia tenha um unico '
             || 'instrumento vigente.',
             c.nome,
             COALESCE(to_char(c.vigencia_inicio, 'DD/MM/YYYY'), 'aberta'),
             COALESCE(to_char(c.vigencia_fim,    'DD/MM/YYYY'), 'aberta')),
         COALESCE(c.vigencia_inicio, CURRENT_DATE)
  FROM public.ponto_cct_config c
  WHERE c.tenant_id = p_tenant_id
    AND (p_empresa_id IS NULL OR c.empresa_id = p_empresa_id)
    AND COALESCE(c.ativo, true) = true
    AND EXISTS (
      SELECT 1 FROM public.ponto_cct_config o
      WHERE o.tenant_id = c.tenant_id
        AND o.id <> c.id
        AND COALESCE(o.ativo, true) = true
        AND COALESCE(o.empresa_id::text, '')            = COALESCE(c.empresa_id::text, '')
        AND COALESCE(o.categoria_profissional, '')      = COALESCE(c.categoria_profissional, '')
        AND COALESCE(c.vigencia_inicio, DATE '-infinity') <= COALESCE(o.vigencia_fim,    DATE 'infinity')
        AND COALESCE(o.vigencia_inicio, DATE '-infinity') <= COALESCE(c.vigencia_fim,    DATE 'infinity')
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.ponto_alertas a
      WHERE a.tenant_id = c.tenant_id
        AND a.tipo = 'cct_vigencia_sobreposta'
        AND a.titulo = format('Instrumentos coletivos com vigencias sobrepostas: "%s"', c.nome)
        AND COALESCE(a.empresa_id::text, '') = COALESCE(c.empresa_id::text, '')
    );
  GET DIAGNOSTICS v_ins = ROW_COUNT;
  v_n := v_n + v_ins;

  RETURN v_n;
END;
$function$;

COMMENT ON FUNCTION public.ponto_cct_vigiar_vigencia(uuid, uuid) IS
  'Vigilancia da vigencia dos instrumentos coletivos (ponto_cct_config): alerta vencimento (60/30 dias/vencido) e sobreposicao de vigencias no mesmo escopo. Complementa a selecao por vigencia que a apuracao (calcular_he_adicional_noturno_dia) ja faz. Somente leitura de ponto_cct_config; idempotente. PONTO-386 (CF art. 7, XXVI).';

-- ---------------------------------------------------------------------------
-- CONFERENCIA — o SQL Editor mostra apenas o ultimo resultado.
-- Esperado: t | t | OK
--   vigilancia_ok : t (a funcao ponto_cct_vigiar_vigencia existe)
--   apuracao_ok   : t (a apuracao ja filtra por vigencia — ponto_cct_config)
-- ---------------------------------------------------------------------------
SELECT
  (to_regprocedure('public.ponto_cct_vigiar_vigencia(uuid, uuid)') IS NOT NULL)  AS vigilancia_ok,
  EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname='public' AND p.proname='calcular_he_adicional_noturno_dia'
            AND p.prosrc ILIKE '%ponto_cct_config%' AND p.prosrc ILIKE '%vigencia%') AS apuracao_ok,
  CASE WHEN to_regprocedure('public.ponto_cct_vigiar_vigencia(uuid, uuid)') IS NOT NULL
        AND EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                    WHERE n.nspname='public' AND p.proname='calcular_he_adicional_noturno_dia'
                      AND p.prosrc ILIKE '%ponto_cct_config%' AND p.prosrc ILIKE '%vigencia%')
       THEN 'OK' ELSE 'CONFERIR' END AS erro_tecnico;
