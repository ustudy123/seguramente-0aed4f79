-- ============================================================================
-- ONDA 9 — Instrumento coletivo vigente NA competência: vigilância de vigência
-- PONTO-386
--
-- A apuração de horas (calcular_he_adicional_noturno_dia) JÁ escolhe o
-- instrumento coletivo (ponto_cct_config) cuja vigência cobre a DATA apurada —
-- reapurar uma competência antiga aplica a convenção da época, não a atual
-- (CF/88 art. 7º, XXVI; parametrização por CCT/ACT). O que faltava era a outra
-- metade do controle: NINGUÉM avisa quando um instrumento está para vencer ou
-- quando duas vigências se sobrepõem. Sem isso, uma CCT vence sem renovação e as
-- competências seguintes ficam sem parâmetro coletivo, ou dois instrumentos
-- ativos disputam a mesma competência (apuração ambígua).
--
-- O QUE FAZ (aditivo): cria ponto_cct_vigiar_vigencia(tenant, empresa) —
-- espelha ponto_certificado_vigiar_vencimento (onda 7). Gera alerta em
-- ponto_alertas para:
--   (a) VENCIMENTO — instrumento ativo a vencer em 60 dias (média), em 30 dias
--       (alta) ou já vencido (crítica);
--   (b) SOBREPOSIÇÃO — dois instrumentos ativos do mesmo escopo (empresa +
--       categoria) com vigências que se cruzam.
-- Idempotente (um alerta por instrumento/fase); só leitura de ponto_cct_config,
-- só escreve alertas. NÃO altera o motor de saldo, o espelho nem o fechamento —
-- a seleção por vigência na apuração continua exatamente como está.
--
-- Invocação: como os demais vigiar_ (certificado, comprovante 48h), roda pela
-- camada de aplicação (Edge Function de vigilância diária), não por cron aqui.
-- ============================================================================

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
  -- Título distinto por fase => escala de aviso (60 -> 30 -> vencido) sem
  -- duplicar dentro da mesma fase. data_referencia = vigencia_fim (fixa).
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

  -- (b) SOBREPOSICAO de vigencias no mesmo escopo (empresa + categoria). Com
  -- dois instrumentos ativos cobrindo a mesma data, a apuracao fica ambigua
  -- sobre qual rege a competencia. NULL de vigencia = aberto (-/+ infinito).
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
