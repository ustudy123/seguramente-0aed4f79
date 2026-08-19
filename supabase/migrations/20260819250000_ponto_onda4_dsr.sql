-- ============================================================================
-- ONDA 4 (parte 5) — Descanso Semanal Remunerado (DSR) e repouso de 24h
-- PONTO-132 / PONTO-133
--
-- Fecha a onda 4 com o repouso semanal, hoje ausente do cálculo:
--   (132) DSR (Lei 605/1949): apuração semanal de assiduidade que alimenta a
--         folha com dois eventos — o REFLEXO das horas extras sobre o repouso
--         (Súmula 172 do TST: a média das HE da semana entra no valor do DSR) e
--         a PERDA do DSR por falta injustificada na semana (Lei 605/49, art. 6º).
--   (133) Repouso semanal de 24 HORAS CONSECUTIVAS (CLT art. 67): sete dias
--         seguidos de trabalho sem esse repouso é violação autônoma — devida
--         ainda que tudo seja pago em dobro. Verificação semanal + alerta.
--
-- Tudo ADITIVO e de baixo risco: três funções novas (duas somente-leitura e um
-- monitor que só insere alertas, idempotente). Nada é chamado automaticamente,
-- não há gatilho em tabela quente, não se toca no motor de saldo nem em tabela
-- com tenant_id (sem tabela nova = sem cerca a instalar). A exportação para a
-- folha e a exibição no espelho consomem estas funções quando forem ligadas.
-- ============================================================================

-- (132) Apuração semanal do DSR: reflexo das HE + perda por falta -------------
CREATE OR REPLACE FUNCTION public.ponto_dsr_competencia(
  p_tenant_id       uuid,
  p_colaborador_cpf text,
  p_competencia     text
)
RETURNS TABLE(
  semana_inicio             date,
  semana_fim                date,
  dias_uteis_trabalhados    integer,
  he_semana_min             integer,
  reflexo_he_dsr_min        integer,
  teve_falta_injustificada  boolean,
  dsr_perdido               boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- DSR (Descanso Semanal Remunerado, Lei 605/1949): repouso semanal remunerado.
  -- Duas apuracoes semanais que alimentam a folha:
  --   (132a) REFLEXO das horas extras sobre o repouso (Sumula 172 do TST): a
  --          media das HE da semana entra no valor do DSR;
  --   (132b) PERDA do DSR por falta injustificada na semana (Lei 605/49 art. 6).
  -- Semana ISO (segunda a domingo), com o domingo como dia de repouso. Le os
  -- dias ja consolidados em ponto_diario.
  WITH dias AS (
    SELECT d.data,
           date_trunc('week', d.data)::date       AS semana,
           EXTRACT(ISODOW FROM d.data)::int        AS isodow,   -- 7 = domingo
           COALESCE(d.horas_extras_50_minutos, 0)
             + COALESCE(d.horas_extras_100_minutos, 0)          AS he_min,
           COALESCE(floor(EXTRACT(EPOCH FROM d.horas_trabalhadas)/60)::int, 0) AS trab_min,
           d.status,
           d.tipo_dia,
           d.observacao
    FROM public.ponto_diario d
    WHERE d.tenant_id = p_tenant_id
      AND regexp_replace(d.colaborador_cpf, '[^0-9]', '', 'g')
          = regexp_replace(COALESCE(p_colaborador_cpf, ''), '[^0-9]', '', 'g')
      AND to_char(d.data, 'YYYY-MM') = p_competencia
  ),
  por_semana AS (
    SELECT semana                                             AS semana_inicio,
           (semana + 6)                                       AS semana_fim,
           COUNT(*) FILTER (WHERE isodow <= 6 AND trab_min > 0) AS dias_uteis_trab,
           COALESCE(SUM(he_min), 0)                            AS he_semana,
           bool_or(
             isodow <= 6
             AND status = 'falta'
             AND COALESCE(tipo_dia, '') NOT IN ('ferias','atestado','afastamento','feriado')
             AND COALESCE(observacao, '') NOT ILIKE '%atestado%'
             AND COALESCE(observacao, '') NOT ILIKE '%justific%'
           )                                                   AS teve_falta
    FROM dias
    GROUP BY semana
  )
  SELECT
    semana_inicio,
    semana_fim,
    dias_uteis_trab::int,
    he_semana::int,
    CASE WHEN dias_uteis_trab > 0
         THEN ROUND(he_semana::numeric / dias_uteis_trab)::int
         ELSE 0 END                          AS reflexo_he_dsr_min,
    COALESCE(teve_falta, false)              AS teve_falta_injustificada,
    COALESCE(teve_falta, false)              AS dsr_perdido
  FROM por_semana
  ORDER BY semana_inicio;
$$;

COMMENT ON FUNCTION public.ponto_dsr_competencia(uuid, text, text) IS
  'Apuracao semanal do DSR (Lei 605/49): reflexo das HE sobre o repouso (Sumula 172) e perda do DSR por falta injustificada (art. 6). Alimenta a folha. Semana ISO, somente leitura.';

-- (133) Verificação do repouso semanal de 24h consecutivas --------------------
CREATE OR REPLACE FUNCTION public.ponto_repouso_semanal_verificar(
  p_tenant_id       uuid,
  p_colaborador_cpf text,
  p_ini             date,
  p_fim             date
)
RETURNS TABLE(
  sequencia_inicio   date,
  sequencia_fim      date,
  dias_consecutivos  integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- CLT art. 67: a cada semana e devido repouso semanal de 24 HORAS
  -- CONSECUTIVAS. Sete dias seguidos de trabalho sem esse repouso semanal e
  -- violacao autonoma — devida ainda que tudo seja pago em dobro. Detecta as
  -- sequencias de dias trabalhados consecutivos com 7 ou mais dias (ilhas por
  -- descontinuidade de datas: dias consecutivos tem (data - row_number) constante).
  WITH trab AS (
    SELECT DISTINCT d.data
    FROM public.ponto_diario d
    WHERE d.tenant_id = p_tenant_id
      AND regexp_replace(d.colaborador_cpf, '[^0-9]', '', 'g')
          = regexp_replace(COALESCE(p_colaborador_cpf, ''), '[^0-9]', '', 'g')
      AND d.data BETWEEN p_ini AND p_fim
      AND COALESCE(floor(EXTRACT(EPOCH FROM d.horas_trabalhadas)/60)::int, 0) > 0
  ),
  ilhas AS (
    SELECT data,
           data - (row_number() OVER (ORDER BY data))::int AS grupo
    FROM trab
  )
  SELECT MIN(data)   AS sequencia_inicio,
         MAX(data)   AS sequencia_fim,
         COUNT(*)::int AS dias_consecutivos
  FROM ilhas
  GROUP BY grupo
  HAVING COUNT(*) >= 7
  ORDER BY 1;
$$;

COMMENT ON FUNCTION public.ponto_repouso_semanal_verificar(uuid, text, date, date) IS
  'Detecta sequencias de 7+ dias trabalhados consecutivos sem repouso semanal de 24 horas consecutivas (CLT art. 67). Somente leitura.';

-- (133) Monitor: alerta o gestor sobre violacao do repouso semanal -----------
CREATE OR REPLACE FUNCTION public.ponto_repouso_semanal_monitorar(p_competencia text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ini date := to_date(p_competencia || '-01', 'YYYY-MM-DD');
  v_fim date := (to_date(p_competencia || '-01', 'YYYY-MM-DD') + INTERVAL '1 month - 1 day')::date;
  v_n   int  := 0;
  v_ins int;
  r     RECORD;
  s     RECORD;
BEGIN
  FOR r IN
    SELECT d.tenant_id,
           MAX(d.empresa_id::text)::uuid AS empresa_id,
           d.colaborador_cpf,
           MAX(d.colaborador_nome)    AS nome,
           MAX(d.colaborador_id::text) AS cid
    FROM public.ponto_diario d
    WHERE d.data BETWEEN v_ini AND v_fim
      AND d.tenant_id IS NOT NULL
    GROUP BY d.tenant_id, d.colaborador_cpf
  LOOP
    -- Alarga a janela em 6 dias para pegar a sequencia que cruza a virada do mes.
    FOR s IN
      SELECT * FROM public.ponto_repouso_semanal_verificar(
                      r.tenant_id, r.colaborador_cpf, v_ini - 6, v_fim)
    LOOP
      INSERT INTO public.ponto_alertas
        (tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
         tipo, severidade, titulo, descricao, data_referencia)
      SELECT r.tenant_id, r.empresa_id, r.cid, r.nome, r.colaborador_cpf,
             'repouso_semanal_art67', 'alta',
             'Sem repouso semanal de 24h (CLT art. 67)',
             format('%s dias trabalhados consecutivos (%s a %s) sem repouso semanal de 24 horas '
                 || 'consecutivas. Violacao autonoma do art. 67 — devida ainda que o trabalho seja '
                 || 'pago em dobro. Conceder o descanso semanal.',
                 s.dias_consecutivos, s.sequencia_inicio, s.sequencia_fim),
             s.sequencia_fim
      WHERE NOT EXISTS (
        SELECT 1 FROM public.ponto_alertas a
        WHERE a.tenant_id = r.tenant_id
          AND a.colaborador_cpf = r.colaborador_cpf
          AND a.tipo = 'repouso_semanal_art67'
          AND a.data_referencia = s.sequencia_fim
      );
      GET DIAGNOSTICS v_ins = ROW_COUNT;
      v_n := v_n + v_ins;
    END LOOP;
  END LOOP;
  RETURN v_n;
END;
$$;

COMMENT ON FUNCTION public.ponto_repouso_semanal_monitorar(text) IS
  'Varre a competencia e alerta o gestor sobre violacao do repouso semanal de 24h consecutivas (CLT art. 67). Idempotente por colaborador/sequencia. Retorna a quantidade de alertas novos.';
