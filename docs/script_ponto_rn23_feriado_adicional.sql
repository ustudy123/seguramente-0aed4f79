-- ============================================================================
-- ENTREGA — RN23: feriado trabalhado com adicional de 100% (PONTO-131/320/321/322)
--
-- ACHADO DA BANCADA (bateria do Ponto na homologacao, 27/08/2026): quatro casos
-- reprovaram com a mesma causa —
--     function public.ponto_feriado_adicional_competencia(uuid, uuid, text)
--     does not exist
--
-- A RN23 (Lei 605/1949 art. 9; Sumula 146 do TST) nasceu em DUAS migrations e
-- NENHUM script de entrega. Migration so alcanca o ambiente de teste — entao o
-- adicional de feriado nunca existiu na producao. Na pratica: feriado
-- trabalhado sem folga compensatoria vem sendo tratado como jornada comum, sem
-- a dobra, EM SILENCIO. Nenhum erro aparece: a apuracao apenas nao encontra a
-- funcao e o dia segue como dia normal.
--
-- POR QUE ESTE PACOTE NAO E A COPIA DAS MIGRATIONS
-- A primeira montagem deste script concatenava as duas migrations de origem na
-- ordem cronologica. A conferencia em replica reprovou: a migration de 13/08
-- carrega uma versao de ponto_feriados_trabalhados ANTERIOR a que a Onda 5
-- (escala 12x36) instalou depois — copiar as migrations teria REGREDIDO o
-- 12x36 que ja esta na producao/homologacao (o caso PONTO-151 caiu na prova).
-- Por isso as funcoes aqui sao o estado ATUAL do projeto, com todas as
-- correcoes posteriores embutidas, e nao o texto das migrations.
--
-- O QUE ENTRA
--   1. feriado_folga_compensatoria — onde o RH registra que um feriado
--      trabalhado foi compensado com folga em outro dia (o que afasta a dobra).
--   2. feriado_excecao + ponto_escalas.comportamento_feriado — como cada
--      escala trata feriado.
--   3. A cadeia de apuracao completa, incluindo os auxiliares de resolucao de
--      empresa de que ela depende.
--
-- NAO altera saldo de banco de horas: o adicional de feriado e verba de folha,
-- nao credito de compensacao — soma-lo ao saldo pagaria duas vezes.
-- Idempotente; roda inteiro em UMA transacao.
-- ============================================================================

SET lock_timeout = '10s';

-- ---------------------------------------------------------------------------
-- (1) AS DUAS TABELAS DA RN23 — DDL extraido do proprio projeto, nao redigido
--     a mao. (A primeira montagem deste pacote inventou as colunas de
--     feriado_excecao e a cadeia quebrou com "column colaborador_id does not
--     exist" na prova em replica.)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feriado_excecao (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    colaborador_id uuid NOT NULL,
    data date,
    comportamento text NOT NULL,
    observacao text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.feriado_excecao IS 'Exceções de comportamento no feriado, por colaborador. Com data: vale só para aquele feriado. Sem data: regra geral do colaborador. Tem precedência sobre a escala.';

CREATE TABLE IF NOT EXISTS public.feriado_folga_compensatoria (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT public.current_user_tenant_id() NOT NULL,
    colaborador_id uuid NOT NULL,
    colaborador_cpf text NOT NULL,
    data_feriado date NOT NULL,
    data_folga date NOT NULL,
    observacao text,
    registrado_por uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_folga_compensatoria_ordem CHECK ((data_folga <> data_feriado))
);

COMMENT ON TABLE public.feriado_folga_compensatoria IS 'RN23 — folga concedida em troca de feriado trabalhado. A existência do registro afasta o pagamento em dobro (Lei 605/1949, art. 9º; Súmula 146 TST).';

-- Chaves e indices, um a um, sem abortar quando ja existirem.
DO $ddl$
BEGIN
  BEGIN
    ALTER TABLE ONLY public.feriado_excecao ADD CONSTRAINT feriado_excecao_pkey PRIMARY KEY (id);
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'feriado_excecao_pkey: %', SQLERRM; END;
  BEGIN
    ALTER TABLE ONLY public.feriado_folga_compensatoria ADD CONSTRAINT feriado_folga_compensatoria_pkey PRIMARY KEY (id);
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'feriado_folga_compensatoria_pkey: %', SQLERRM; END;
END $ddl$;

CREATE INDEX IF NOT EXISTS feriado_excecao_busca_idx
  ON public.feriado_excecao USING btree (tenant_id, colaborador_id, data);
CREATE INDEX IF NOT EXISTS idx_folga_compensatoria_periodo
  ON public.feriado_folga_compensatoria USING btree (tenant_id, data_feriado);
CREATE UNIQUE INDEX IF NOT EXISTS uq_folga_compensatoria_feriado
  ON public.feriado_folga_compensatoria USING btree (tenant_id, colaborador_cpf, data_feriado);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feriado_excecao TO authenticated;
GRANT ALL ON public.feriado_excecao TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feriado_folga_compensatoria TO authenticated;
GRANT ALL ON public.feriado_folga_compensatoria TO service_role;

ALTER TABLE public.feriado_excecao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feriado_folga_compensatoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant gerencia feriado_excecao" ON public.feriado_excecao;
CREATE POLICY "Tenant gerencia feriado_excecao" ON public.feriado_excecao TO authenticated
  USING ((tenant_id = public.current_user_tenant_id()))
  WITH CHECK ((tenant_id = public.current_user_tenant_id()));

DROP POLICY IF EXISTS "Tenant manage feriado_folga_compensatoria" ON public.feriado_folga_compensatoria;
CREATE POLICY "Tenant manage feriado_folga_compensatoria" ON public.feriado_folga_compensatoria TO authenticated
  USING ((tenant_id = public.current_user_tenant_id()))
  WITH CHECK ((tenant_id = public.current_user_tenant_id()));

-- ---------------------------------------------------------------------------
-- (2) COMO CADA ESCALA TRATA FERIADO
-- ---------------------------------------------------------------------------
ALTER TABLE public.ponto_escalas
  ADD COLUMN IF NOT EXISTS comportamento_feriado text;

COMMENT ON COLUMN public.ponto_escalas.comportamento_feriado IS
  'Como esta escala trata feriado (folga / trabalha / trabalha com adicional). Consultado por feriado_comportamento, que a exceção do colaborador sobrepõe.';

-- ---------------------------------------------------------------------------
-- (3) A CADEIA DE APURACAO — estado atual do projeto (com as correcoes
--     posteriores da Onda 4 e da Onda 5 ja embutidas).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.feriados_da_empresa(p_tenant_id uuid, p_empresa_id uuid, p_ini date, p_fim date)
 RETURNS TABLE(data date, nome text, origem text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH loc AS (
    -- Subselects escalares: devolve sempre UMA linha, com NULL quando a
    -- empresa não existe. Um JOIN aqui zeraria também os nacionais.
    SELECT
      (SELECT ec.estado FROM public.empresa_cadastro ec WHERE ec.id = p_empresa_id) AS uf,
      (SELECT ec.cidade FROM public.empresa_cadastro ec WHERE ec.id = p_empresa_id) AS cidade
  ),
  dias AS (
    SELECT g::date AS d FROM generate_series(p_ini, p_fim, interval '1 day') g
  ),
  candidatos AS (
    -- P0: tabela nomeada vinculada à filial
    SELECT d.d AS data, i.nome, 'tabela'::text AS origem, 0 AS prio
    FROM dias d
    JOIN public.feriado_tabela_empresas v ON v.empresa_id = p_empresa_id
    JOIN public.feriado_tabelas t
      ON t.id = v.tabela_id AND t.ativo = true AND t.tenant_id = p_tenant_id
     AND (t.ano IS NULL OR t.ano = EXTRACT(YEAR FROM d.d)::int)
    JOIN public.feriado_tabela_itens i
      ON i.tabela_id = t.id AND i.ativo = true AND i.tipo = 'feriado'
     AND (
       (i.recorrente = true
         AND i.dia = EXTRACT(DAY FROM d.d)::smallint
         AND i.mes = EXTRACT(MONTH FROM d.d)::smallint)
       OR (i.recorrente = false AND i.data = d.d)
     )
    WHERE p_empresa_id IS NOT NULL

    UNION ALL

    -- P1..P4: base public.feriados
    SELECT d.d, f.nome, f.abrangencia,
           CASE f.abrangencia
             WHEN 'filial' THEN 1 WHEN 'municipal' THEN 2
             WHEN 'estadual' THEN 3 ELSE 4 END
    FROM dias d
    CROSS JOIN loc
    JOIN public.feriados f
      ON COALESCE(f.ativo, true) = true AND f.tipo = 'feriado'
     AND (f.tenant_id IS NULL OR f.tenant_id = p_tenant_id)
     AND (
       (COALESCE(f.recorrente, false) = true
         AND f.dia = EXTRACT(DAY FROM d.d)::smallint
         AND f.mes = EXTRACT(MONTH FROM d.d)::smallint)
       OR (COALESCE(f.recorrente, false) = false AND f.data = d.d)
     )
     AND (
       f.abrangencia = 'nacional'
       OR (f.abrangencia = 'filial'
           AND p_empresa_id IS NOT NULL AND f.empresa_id = p_empresa_id)
       OR (f.abrangencia = 'estadual'
           AND loc.uf IS NOT NULL AND btrim(loc.uf) <> ''
           AND upper(btrim(f.uf)) = upper(btrim(loc.uf)))
       OR (f.abrangencia = 'municipal'
           AND loc.uf IS NOT NULL AND btrim(loc.uf) <> ''
           AND loc.cidade IS NOT NULL AND btrim(loc.cidade) <> ''
           AND upper(btrim(f.uf)) = upper(btrim(loc.uf))
           AND upper(btrim(f.municipio)) = upper(btrim(loc.cidade)))
     )
  )
  SELECT DISTINCT ON (c.data) c.data, c.nome, c.origem
  FROM candidatos c
  ORDER BY c.data, c.prio, c.nome;
$function$
;

CREATE OR REPLACE FUNCTION public.ponto_empresa_do_colaborador(p_colaborador_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT empresa_id FROM public.admissoes WHERE id = p_colaborador_id;
$function$
;

CREATE OR REPLACE FUNCTION public.ponto_empresa_do_cpf(p_tenant_id uuid, p_cpf text)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT a.empresa_id
  FROM public.admissoes a
  WHERE a.tenant_id = p_tenant_id
    AND a.empresa_id IS NOT NULL
    AND regexp_replace(COALESCE(a.cpf, ''), '[^0-9]', '', 'g')
        = regexp_replace(COALESCE(p_cpf, ''), '[^0-9]', '', 'g')
  ORDER BY COALESCE(a.inativo, false), a.data_admissao DESC NULLS LAST
  LIMIT 1;
$function$
;

CREATE OR REPLACE FUNCTION public.feriado_comportamento(p_tenant_id uuid, p_cpf text, p_colaborador_id uuid, p_data date)
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
$function$
;

CREATE OR REPLACE FUNCTION public.feriado_folga_compensatoria_touch()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END; $function$
;

CREATE OR REPLACE FUNCTION public.ponto_colaborador_id_por_cpf(p_tenant_id uuid, p_colaborador_cpf text)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_cid uuid;
BEGIN
  SELECT pd.colaborador_id INTO v_cid
  FROM public.ponto_diario pd
  WHERE pd.tenant_id = p_tenant_id AND pd.colaborador_cpf = p_colaborador_cpf
    AND pd.colaborador_id IS NOT NULL
  ORDER BY pd.data DESC LIMIT 1;

  IF v_cid IS NULL THEN
    SELECT pm.colaborador_id INTO v_cid
    FROM public.ponto_marcacoes pm
    WHERE pm.tenant_id = p_tenant_id AND pm.colaborador_cpf = p_colaborador_cpf
      AND pm.colaborador_id IS NOT NULL
    ORDER BY pm.created_at DESC LIMIT 1;
  END IF;

  RETURN v_cid;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.ponto_feriados_colaborador(p_tenant_id uuid, p_colaborador_id uuid, p_ini date, p_fim date)
 RETURNS TABLE(data date, nome text, origem text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT h.data, h.nome, h.origem
  FROM public.feriados_da_empresa(
         p_tenant_id,
         public.ponto_empresa_do_colaborador(p_colaborador_id),
         p_ini, p_fim) h
  ORDER BY h.data;
$function$
;

CREATE OR REPLACE FUNCTION public.ponto_feriados_trabalhados(p_tenant_id uuid, p_colaborador_cpf text, p_ini date, p_fim date)
 RETURNS TABLE(data date, feriado_nome text, origem text, comportamento text, trabalhado_min integer, folga_compensatoria_em date, adicional_100_min integer)
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
    CASE WHEN fc.data_folga IS NULL AND NOT COALESCE((SELECT c.eh_ciclo FROM public.ponto_apurar_ciclo_plantao_do_dia(p_tenant_id, p_colaborador_cpf, v_cid::text, h.data) c LIMIT 1), false) THEN t.trab_min ELSE 0 END AS adicional_100_min
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
$function$
;

CREATE OR REPLACE FUNCTION public.ponto_feriados_competencia(p_tenant_id uuid, p_colaborador_cpf text, p_competencia text)
 RETURNS TABLE(data date, feriado_nome text, origem text, trabalhado_min integer, folga_compensatoria_em date, adicional_100_min integer)
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
$function$
;

CREATE OR REPLACE FUNCTION public.ponto_feriado_adicional_competencia(p_tenant_id uuid, p_empresa_id uuid, p_competencia text)
 RETURNS TABLE(colaborador_cpf text, colaborador_nome text, qtd_feriados_trabalhados integer, minutos_trabalhados integer, minutos_adicional_100 integer, dias_compensados integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ini date;
  v_fim date;
BEGIN
  v_ini := to_date(p_competencia || '-01', 'YYYY-MM-DD');
  v_fim := (v_ini + interval '1 month - 1 day')::date;

  RETURN QUERY
  WITH colabs AS (
    SELECT DISTINCT pd.colaborador_cpf AS cpf,
           MAX(pd.colaborador_nome) AS nome
    FROM public.ponto_diario pd
    WHERE pd.tenant_id = p_tenant_id
      AND pd.data BETWEEN v_ini AND v_fim
      AND (p_empresa_id IS NULL OR pd.empresa_id = p_empresa_id)
    GROUP BY pd.colaborador_cpf
  ),
  apurado AS (
    SELECT c.cpf, c.nome, f.*
    FROM colabs c
    CROSS JOIN LATERAL public.ponto_feriados_trabalhados(p_tenant_id, c.cpf, v_ini, v_fim) f
  )
  SELECT
    a.cpf,
    a.nome,
    COUNT(*)::int,
    COALESCE(SUM(a.trabalhado_min), 0)::int,
    COALESCE(SUM(a.adicional_100_min), 0)::int,
    COUNT(*) FILTER (WHERE a.folga_compensatoria_em IS NOT NULL)::int
  FROM apurado a
  GROUP BY a.cpf, a.nome
  HAVING COUNT(*) > 0
  ORDER BY a.nome;
END;
$function$
;

DROP TRIGGER IF EXISTS trg_folga_compensatoria_touch ON public.feriado_folga_compensatoria;
CREATE TRIGGER trg_folga_compensatoria_touch
  BEFORE INSERT OR UPDATE ON public.feriado_folga_compensatoria
  FOR EACH ROW EXECUTE FUNCTION public.feriado_folga_compensatoria_touch();

REVOKE EXECUTE ON FUNCTION public.feriado_comportamento(uuid, text, uuid, date) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.feriado_comportamento(uuid, text, uuid, date) TO authenticated, service_role;

COMMENT ON TABLE public.feriado_folga_compensatoria IS
  'Registro da folga compensatoria de feriado trabalhado (art. 9, Lei 605/1949). Sua presenca afasta o adicional de 100% apurado por ponto_feriado_adicional_competencia. RN23.';
COMMENT ON FUNCTION public.ponto_feriado_adicional_competencia(uuid, uuid, text) IS
  'Minutos de feriado trabalhado com adicional de 100% por colaborador na competencia, descontando os feriados com folga compensatoria registrada. Verba de folha — nao entra no saldo de banco de horas. RN23 (Lei 605/1949 art. 9; Sumula 146 do TST).';

-- A tabela nova entra na trava do cercado de QA, quando o motor existir.
DO $cercas$
DECLARE v_n int;
BEGIN
  IF to_regprocedure('public.qa_instalar_cercas()') IS NULL THEN RETURN; END IF;
  SELECT count(*) INTO v_n FROM public.qa_instalar_cercas();
  RAISE NOTICE 'Cercas de QA conferidas: % tabela(s).', v_n;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Cercas nao puderam ser conferidas agora (%).', SQLERRM;
END $cercas$;

-- ---------------------------------------------------------------------------
-- CONFERENCIA — o SQL Editor mostra apenas o ultimo resultado.
-- Esperado: t | t | t | t | t | t | t | OK
--   rn23_apuracao   : ponto_feriado_adicional_competencia(uuid,uuid,text)
--   comportamento   : feriado_comportamento(uuid,text,uuid,date)
--   tabela_folga    : feriado_folga_compensatoria
--   tabela_excecao  : feriado_excecao
--   coluna_escala   : ponto_escalas.comportamento_feriado
--   cadeia_completa : as 4 funcoes de apoio da apuracao
--   preserva_12x36  : a distincao de plantao/12x36 continua em
--                     ponto_feriados_trabalhados (nao foi regredida)
-- ---------------------------------------------------------------------------
WITH x AS MATERIALIZED (
  SELECT
    (to_regprocedure('public.ponto_feriado_adicional_competencia(uuid,uuid,text)') IS NOT NULL) AS rn23_apuracao,
    (to_regprocedure('public.feriado_comportamento(uuid,text,uuid,date)') IS NOT NULL) AS comportamento,
    (to_regclass('public.feriado_folga_compensatoria') IS NOT NULL) AS tabela_folga,
    (to_regclass('public.feriado_excecao') IS NOT NULL) AS tabela_excecao,
    EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'ponto_escalas'
               AND column_name = 'comportamento_feriado') AS coluna_escala,
    (SELECT count(DISTINCT p.proname) = 4 FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname IN ('ponto_feriados_colaborador','ponto_colaborador_id_por_cpf',
                          'ponto_feriados_trabalhados','ponto_feriados_competencia')) AS cadeia_completa,
    EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'ponto_feriados_trabalhados'
               AND (p.prosrc ILIKE '%12x36%' OR p.prosrc ILIKE '%plantao%'
                    OR p.prosrc ILIKE '%ciclo_horas%')) AS preserva_12x36
)
SELECT rn23_apuracao, comportamento, tabela_folga, tabela_excecao, coluna_escala,
       cadeia_completa, preserva_12x36,
       CASE WHEN rn23_apuracao AND comportamento AND tabela_folga AND tabela_excecao
                 AND coluna_escala AND cadeia_completa AND preserva_12x36
            THEN 'OK' ELSE 'CONFERIR' END AS erro_tecnico
FROM x;
