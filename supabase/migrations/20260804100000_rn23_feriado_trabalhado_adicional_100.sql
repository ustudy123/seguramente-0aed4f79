-- =====================================================================
-- RN23 — Feriado trabalhado: folga compensatória e adicional de 100%
--
-- Hoje o sistema já SABE que o dia é feriado e que houve marcação
-- (_ponto_class_feriado devolve tipo_dia='feriado' e fer_trab=true), mas
-- para no rótulo: as horas do feriado seguem para o banco de horas como
-- jornada comum. A Lei 605/1949 art. 9º e a Súmula 146 do TST exigem o
-- pagamento em dobro do feriado trabalhado QUANDO NÃO HÁ folga
-- compensatória em outro dia — e hoje não existe onde registrar essa folga,
-- então o adicional não tem como ser decidido nem apurado.
--
-- Este migration entrega as duas peças que faltavam:
--
--   1. feriado_folga_compensatoria — onde o RH registra que determinado
--      feriado trabalhado foi compensado com folga em outro dia. É o que
--      afasta o pagamento em dobro (art. 9º, parte final).
--   2. As funções de apuração que, a partir do feriado resolvido pela
--      filial (feriados_da_empresa) cruzado com o ponto do dia, devolvem
--      os minutos com adicional de 100% por colaborador/competência,
--      prontos para a folha, sem lançamento manual.
--
-- Não altera saldo de banco de horas: o adicional de feriado é verba de
-- folha, não crédito de compensação — somá-lo ao saldo pagaria duas vezes.
-- =====================================================================

-- 1) REGISTRO DA FOLGA COMPENSATÓRIA ----------------------------------
CREATE TABLE IF NOT EXISTS public.feriado_folga_compensatoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_user_tenant_id(),
  colaborador_id uuid NOT NULL,
  colaborador_cpf text NOT NULL,
  -- o feriado que foi trabalhado
  data_feriado date NOT NULL,
  -- o dia de folga concedido em troca (art. 9º, Lei 605/1949)
  data_folga date NOT NULL,
  observacao text,
  registrado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_folga_compensatoria_ordem CHECK (data_folga <> data_feriado)
);

-- Um feriado trabalhado é compensado no máximo uma vez.
CREATE UNIQUE INDEX IF NOT EXISTS uq_folga_compensatoria_feriado
  ON public.feriado_folga_compensatoria (tenant_id, colaborador_cpf, data_feriado);
CREATE INDEX IF NOT EXISTS idx_folga_compensatoria_periodo
  ON public.feriado_folga_compensatoria (tenant_id, data_feriado);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feriado_folga_compensatoria TO authenticated;
GRANT ALL ON public.feriado_folga_compensatoria TO service_role;
ALTER TABLE public.feriado_folga_compensatoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant manage feriado_folga_compensatoria" ON public.feriado_folga_compensatoria;
CREATE POLICY "Tenant manage feriado_folga_compensatoria" ON public.feriado_folga_compensatoria
  FOR ALL TO authenticated
  USING (tenant_id = public.current_user_tenant_id())
  WITH CHECK (tenant_id = public.current_user_tenant_id());

CREATE OR REPLACE FUNCTION public.feriado_folga_compensatoria_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_folga_compensatoria_touch ON public.feriado_folga_compensatoria;
CREATE TRIGGER trg_folga_compensatoria_touch
  BEFORE INSERT OR UPDATE ON public.feriado_folga_compensatoria
  FOR EACH ROW EXECUTE FUNCTION public.feriado_folga_compensatoria_touch();

-- 2) FERIADOS DO COLABORADOR NUM PERÍODO ------------------------------
-- Wrapper de leitura para a tela (rótulo "FERIADO" na lista de dias do
-- Banco de Horas, RN14–RN16): resolve a filial do colaborador e delega
-- para a fonte única. Mesma resposta que o espelho dá dia a dia.
CREATE OR REPLACE FUNCTION public.ponto_feriados_colaborador(
  p_tenant_id uuid,
  p_colaborador_id uuid,
  p_ini date,
  p_fim date
)
RETURNS TABLE(data date, nome text, origem text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT h.data, h.nome, h.origem
  FROM public.feriados_da_empresa(
         p_tenant_id,
         public.ponto_empresa_do_colaborador(p_colaborador_id),
         p_ini, p_fim) h
  ORDER BY h.data;
$$;

-- 2b) CPF -> colaborador_id (a tela de Banco de Horas trabalha por CPF) --
CREATE OR REPLACE FUNCTION public.ponto_colaborador_id_por_cpf(
  p_tenant_id uuid,
  p_colaborador_cpf text
)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

-- 3) APURAÇÃO DO FERIADO TRABALHADO -----------------------------------
-- Um dia entra na apuração quando é feriado para a filial do colaborador
-- E existe tempo trabalhado registrado no ponto daquele dia.
--
-- adicional_100_min = minutos trabalhados no feriado, quando não houver
-- folga compensatória registrada. Com folga registrada, zero: a folga já
-- quita a obrigação e pagar também seria duplicidade.
CREATE OR REPLACE FUNCTION public.ponto_feriados_trabalhados(
  p_tenant_id uuid,
  p_colaborador_cpf text,
  p_ini date,
  p_fim date
)
RETURNS TABLE(
  data date,
  feriado_nome text,
  origem text,
  comportamento text,
  trabalhado_min integer,
  folga_compensatoria_em date,
  adicional_100_min integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cid uuid;
  v_emp uuid;
BEGIN
  v_cid := public.ponto_colaborador_id_por_cpf(p_tenant_id, p_colaborador_cpf);
  IF v_cid IS NULL THEN RETURN; END IF;
  v_emp := public.ponto_empresa_do_colaborador(v_cid);

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
$$;

-- 3b) FERIADOS DA COMPETÊNCIA PARA A TELA -----------------------------
-- Uma chamada devolve tudo que a lista de dias do Banco de Horas precisa:
-- o rótulo "FERIADO" (RN23, primeira parte) vale para TODO feriado do mês,
-- trabalhado ou não; os campos de adicional só se preenchem quando houve
-- trabalho no dia.
CREATE OR REPLACE FUNCTION public.ponto_feriados_competencia(
  p_tenant_id uuid,
  p_colaborador_cpf text,
  p_competencia text
)
RETURNS TABLE(
  data date,
  feriado_nome text,
  origem text,
  trabalhado_min integer,
  folga_compensatoria_em date,
  adicional_100_min integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cid uuid;
  v_ini date;
  v_fim date;
BEGIN
  v_cid := public.ponto_colaborador_id_por_cpf(p_tenant_id, p_colaborador_cpf);
  IF v_cid IS NULL THEN RETURN; END IF;

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
  FROM public.feriados_da_empresa(
         p_tenant_id, public.ponto_empresa_do_colaborador(v_cid), v_ini, v_fim) h
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
$$;

-- 4) CONSOLIDADO DA COMPETÊNCIA (integração com a folha) --------------
-- Mesma granularidade que a folha já consome para horas extras e
-- adicionais: um total por colaborador na competência 'YYYY-MM'.
CREATE OR REPLACE FUNCTION public.ponto_feriado_adicional_competencia(
  p_tenant_id uuid,
  p_empresa_id uuid,
  p_competencia text
)
RETURNS TABLE(
  colaborador_cpf text,
  colaborador_nome text,
  qtd_feriados_trabalhados integer,
  minutos_trabalhados integer,
  minutos_adicional_100 integer,
  dias_compensados integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

REVOKE EXECUTE ON FUNCTION public.ponto_colaborador_id_por_cpf(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ponto_feriados_competencia(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ponto_colaborador_id_por_cpf(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ponto_feriados_competencia(uuid, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.ponto_feriados_colaborador(uuid, uuid, date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ponto_feriados_trabalhados(uuid, text, date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ponto_feriado_adicional_competencia(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ponto_feriados_colaborador(uuid, uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ponto_feriados_trabalhados(uuid, text, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ponto_feriado_adicional_competencia(uuid, uuid, text) TO authenticated;

COMMENT ON TABLE public.feriado_folga_compensatoria IS
  'RN23 — folga concedida em troca de feriado trabalhado. A existência do registro afasta o pagamento em dobro (Lei 605/1949, art. 9º; Súmula 146 TST).';
COMMENT ON FUNCTION public.ponto_feriado_adicional_competencia(uuid, uuid, text) IS
  'RN23 — total de minutos com adicional de 100% por feriado trabalhado sem folga compensatória, por colaborador, na competência YYYY-MM.';
