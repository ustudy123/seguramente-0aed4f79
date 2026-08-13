-- =====================================================================
-- Feriado: traz para o repositório o que só existia na produção
--
-- PONTO-320/321/322 falhavam com
--   function public.feriado_comportamento(uuid, text, uuid, date) does not exist
--
-- A investigação mostrou que a dívida é maior que uma função. Três
-- objetos do adicional de feriado (RN23) foram criados direto na
-- produção e nunca versionados:
--
--   · a função  feriado_comportamento(tenant, cpf, colaborador, data)
--   · a tabela  feriado_excecao  (consultada por PontoFeriadoExcecoesTab)
--   · a coluna  ponto_escalas.comportamento_feriado (usada por
--     PontoEscalasTab)
--
-- Consequência: TODO ambiente montado a partir das migrations — o de
-- teste, o de homologação, uma réplica para investigar um chamado —
-- nasce com o adicional de feriado inoperante, e a apuração RN23 quebra
-- na primeira chamada. Mesmo precedente de `feriados` e de
-- `ponto_diario.tipo_dia`, ambos resgatados antes.
--
-- As definições abaixo foram extraídas da PRODUÇÃO, não reescritas de
-- memória: a função é cópia literal de pg_get_functiondef. Em produção
-- este arquivo é inócuo (tudo já existe); em banco novo, é o que faz o
-- feriado funcionar.
--
-- Regra que a função implementa, em três degraus:
--   1) exceção do colaborador PARA AQUELE DIA, se houver;
--   2) exceção geral do colaborador (data nula), se houver;
--   3) o comportamento da escala vigente dele;
--   e, na ausência de tudo, 'folga' — o padrão conservador, que é o que
--   a CLT presume para o feriado.
-- =====================================================================

SET lock_timeout = '10s';

-- ── 1) Comportamento de feriado na escala ────────────────────────────
ALTER TABLE public.ponto_escalas
  ADD COLUMN IF NOT EXISTS comportamento_feriado text DEFAULT 'folga';

COMMENT ON COLUMN public.ponto_escalas.comportamento_feriado IS
  'O que esta escala faz no feriado: folga (padrão) ou trabalha. Consultado por feriado_comportamento quando não há exceção para o colaborador.';

-- ── 2) Exceções por colaborador ──────────────────────────────────────
-- data preenchida = exceção para aquele feriado; data nula = regra geral
-- daquele colaborador, que vale para todos os feriados.
CREATE TABLE IF NOT EXISTS public.feriado_excecao (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL,
  colaborador_id uuid NOT NULL,
  data           date,
  comportamento  text NOT NULL,
  observacao     text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.feriado_excecao IS
  'Exceções de comportamento no feriado, por colaborador. Com data: vale só para aquele feriado. Sem data: regra geral do colaborador. Tem precedência sobre a escala.';

-- A função busca por (tenant, colaborador, data) e por (tenant,
-- colaborador, data IS NULL). Sem índice, cada dia de cada colaborador
-- vira uma varredura na tabela inteira durante a apuração do mês.
CREATE INDEX IF NOT EXISTS feriado_excecao_busca_idx
  ON public.feriado_excecao (tenant_id, colaborador_id, data);

ALTER TABLE public.feriado_excecao ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feriado_excecao TO authenticated;
GRANT ALL ON public.feriado_excecao TO service_role;

-- Política criada apenas se a tabela ainda não tiver nenhuma: em
-- produção a tabela já existe com a política dela, e não é papel deste
-- arquivo trocá-la por outra sem necessidade.
DO $pol$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname = 'public' AND tablename = 'feriado_excecao') THEN
    CREATE POLICY "Tenant gerencia feriado_excecao" ON public.feriado_excecao
      FOR ALL TO authenticated
      USING (tenant_id = public.current_user_tenant_id())
      WITH CHECK (tenant_id = public.current_user_tenant_id());
  END IF;
END $pol$;

-- ── 3) A função, cópia literal da produção ───────────────────────────
CREATE OR REPLACE FUNCTION public.feriado_comportamento(
  p_tenant_id uuid,
  p_cpf text,
  p_colaborador_id uuid,
  p_data date
)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_comp TEXT;
BEGIN
  SELECT comportamento INTO v_comp FROM public.feriado_excecao
  WHERE tenant_id = p_tenant_id AND colaborador_id = p_colaborador_id AND data = p_data LIMIT 1;
  IF v_comp IS NOT NULL THEN RETURN v_comp; END IF;

  SELECT comportamento INTO v_comp FROM public.feriado_excecao
  WHERE tenant_id = p_tenant_id AND colaborador_id = p_colaborador_id AND data IS NULL LIMIT 1;
  IF v_comp IS NOT NULL THEN RETURN v_comp; END IF;

  SELECT e.comportamento_feriado INTO v_comp
  FROM public.ponto_escala_atribuicoes a
  JOIN public.ponto_escalas e ON e.id = a.escala_id
  WHERE a.tenant_id = p_tenant_id
    AND (a.colaborador_cpf = p_cpf OR a.colaborador_id = p_colaborador_id::text)
    AND COALESCE(a.ativa, true) = true
    AND a.data_inicio <= p_data AND (a.data_fim IS NULL OR a.data_fim >= p_data)
  ORDER BY a.data_inicio DESC LIMIT 1;

  RETURN COALESCE(v_comp, 'folga');
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.feriado_comportamento(uuid, text, uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.feriado_comportamento(uuid, text, uuid, date) TO authenticated, service_role;

-- ── 4) A tabela nova entra na trava do cercado de QA ─────────────────
DO $cercas$
DECLARE v_n int;
BEGIN
  IF to_regprocedure('public.qa_instalar_cercas()') IS NULL THEN RETURN; END IF;
  SELECT count(*) INTO v_n FROM public.qa_instalar_cercas();
  RAISE NOTICE 'Cercas de QA conferidas: % tabela(s).', v_n;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Cercas não puderam ser conferidas agora (%).', SQLERRM;
END $cercas$;

-- ── Conferência da própria migration ─────────────────────────────────
DO $verifica$
DECLARE v_falta text := '';
BEGIN
  IF to_regprocedure('public.feriado_comportamento(uuid,text,uuid,date)') IS NULL THEN
    v_falta := v_falta || ' feriado_comportamento';
  END IF;
  IF to_regclass('public.feriado_excecao') IS NULL THEN
    v_falta := v_falta || ' feriado_excecao';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'ponto_escalas'
                    AND column_name = 'comportamento_feriado') THEN
    v_falta := v_falta || ' ponto_escalas.comportamento_feriado';
  END IF;
  IF v_falta <> '' THEN
    RAISE EXCEPTION 'Resgate incompleto:%', v_falta;
  END IF;
  RAISE NOTICE 'OK: adicional de feriado (RN23) passa a existir em banco montado pelas migrations.';
END $verifica$;

-- =====================================================================
-- PONTO-320 · O feriado trabalhado não aparecia na apuração do adicional
--
-- Com a função resgatada, a rotina PONTO-320 deixou de quebrar mas
-- passou a falhar por um segundo motivo, este de conteúdo: o feriado
-- trabalhado simplesmente não entrava na apuração.
--
-- A cadeia RN23 descobre a empresa do colaborador assim:
--
--   v_cid := ponto_colaborador_id_por_cpf(tenant, cpf)   -- lê ponto_diario
--   v_emp := ponto_empresa_do_colaborador(v_cid)         -- lê admissoes.id
--
-- O primeiro passo devolve o `colaborador_id` GRAVADO NA LINHA de ponto,
-- que nem sempre é o id da admissão — quem gravou a linha pode ter posto
-- outro identificador. O segundo passo procura esse valor em
-- admissoes.id e não acha: devolve NULL. Com empresa nula,
-- feriados_da_empresa não devolve os feriados daquela unidade, e o dia
-- trabalhado no feriado desaparece da apuração — sem erro, sem aviso.
--
-- Na prática: adicional de 100% não pago (Lei 605/1949, art. 9º; Súmula
-- 146 do TST) em silêncio, sempre que a linha de ponto tiver sido criada
-- por um caminho que não carimbou o id da admissão.
--
-- Correção: a empresa passa a ser resolvida com queda para o CPF
-- (ponto_empresa_do_cpf), que consulta a admissão pelo CPF — a chave
-- estável deste sistema, a mesma da unicidade de ponto_diario. E o
-- colaborador, quando a linha de ponto não o resolve, também é buscado
-- na admissão em vez de abortar a apuração.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.ponto_feriados_trabalhados(
  p_tenant_id uuid, p_colaborador_cpf text, p_ini date, p_fim date
)
RETURNS TABLE(data date, feriado_nome text, origem text, comportamento text,
              trabalhado_min integer, folga_compensatoria_em date,
              adicional_100_min integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cid uuid;
  v_emp uuid;
BEGIN
  v_cid := public.ponto_colaborador_id_por_cpf(p_tenant_id, p_colaborador_cpf);
  IF v_cid IS NULL THEN
    SELECT a.id INTO v_cid FROM public.admissoes a
    WHERE a.tenant_id = p_tenant_id
      AND regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g')
          = regexp_replace(COALESCE(p_colaborador_cpf, ''), '[^0-9]', '', 'g')
    ORDER BY COALESCE(a.inativo, false), a.data_admissao DESC NULLS LAST
    LIMIT 1;
  END IF;
  IF v_cid IS NULL THEN RETURN; END IF;

  -- A empresa vem da admissão pelo CPF quando o id da linha de ponto não
  -- corresponde a uma admissão. Sem isso o feriado da unidade some.
  v_emp := COALESCE(public.ponto_empresa_do_colaborador(v_cid),
                    public.ponto_empresa_do_cpf(p_tenant_id, p_colaborador_cpf));

  RETURN QUERY
  SELECT
    h.data,
    h.nome,
    h.origem,
    public.feriado_comportamento(p_tenant_id, p_colaborador_cpf, v_cid, h.data) AS comportamento,
    t.trab_min,
    fc.data_folga,
    CASE WHEN fc.data_folga IS NULL THEN t.trab_min ELSE 0 END AS adicional_100_min
  FROM public.feriados_da_empresa(p_tenant_id, v_emp, p_ini, p_fim) h
  JOIN LATERAL (
    SELECT COALESCE((EXTRACT(EPOCH FROM pd.horas_trabalhadas) / 60)::int, 0) AS trab_min
    FROM public.ponto_diario pd
    WHERE pd.tenant_id = p_tenant_id
      AND pd.colaborador_cpf = p_colaborador_cpf
      AND pd.data = h.data
    LIMIT 1
  ) t ON t.trab_min > 0
  LEFT JOIN public.feriado_folga_compensatoria fc
    ON fc.tenant_id = p_tenant_id
   AND fc.colaborador_cpf = p_colaborador_cpf
   AND fc.data_feriado = h.data
  ORDER BY h.data;
END;
$function$;

-- Mesma fragilidade na função que alimenta a lista de dias da tela.
CREATE OR REPLACE FUNCTION public.ponto_feriados_competencia(
  p_tenant_id uuid, p_colaborador_cpf text, p_competencia text
)
RETURNS TABLE(data date, feriado_nome text, origem text, trabalhado_min integer,
              folga_compensatoria_em date, adicional_100_min integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cid uuid;
  v_emp uuid;
  v_ini date;
  v_fim date;
BEGIN
  v_cid := public.ponto_colaborador_id_por_cpf(p_tenant_id, p_colaborador_cpf);
  IF v_cid IS NULL THEN
    SELECT a.id INTO v_cid FROM public.admissoes a
    WHERE a.tenant_id = p_tenant_id
      AND regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g')
          = regexp_replace(COALESCE(p_colaborador_cpf, ''), '[^0-9]', '', 'g')
    ORDER BY COALESCE(a.inativo, false), a.data_admissao DESC NULLS LAST
    LIMIT 1;
  END IF;
  IF v_cid IS NULL THEN RETURN; END IF;

  v_emp := COALESCE(public.ponto_empresa_do_colaborador(v_cid),
                    public.ponto_empresa_do_cpf(p_tenant_id, p_colaborador_cpf));

  v_ini := to_date(p_competencia || '-01', 'YYYY-MM-DD');
  v_fim := (v_ini + interval '1 month - 1 day')::date;

  RETURN QUERY
  SELECT
    h.data,
    h.nome,
    h.origem,
    COALESCE(t.trab_min, 0),
    fc.data_folga,
    CASE WHEN COALESCE(t.trab_min, 0) > 0 AND fc.data_folga IS NULL
         THEN t.trab_min ELSE 0 END
  FROM public.feriados_da_empresa(p_tenant_id, v_emp, v_ini, v_fim) h
  LEFT JOIN LATERAL (
    SELECT COALESCE((EXTRACT(EPOCH FROM pd.horas_trabalhadas) / 60)::int, 0) AS trab_min
    FROM public.ponto_diario pd
    WHERE pd.tenant_id = p_tenant_id
      AND pd.colaborador_cpf = p_colaborador_cpf
      AND pd.data = h.data
    LIMIT 1
  ) t ON true
  LEFT JOIN public.feriado_folga_compensatoria fc
    ON fc.tenant_id = p_tenant_id
   AND fc.colaborador_cpf = p_colaborador_cpf
   AND fc.data_feriado = h.data
  ORDER BY h.data;
END;
$function$;
