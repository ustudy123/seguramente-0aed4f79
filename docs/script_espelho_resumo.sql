-- ============================================================
-- Fechamento/espelho a partir da apuracao — 04/08/2026
-- Idempotente.
-- ============================================================

-- =====================================================================
-- Fechamento zerado: o espelho somava colunas que ninguém preenche mais
--
-- O PDF do espelho da Edina (07/2026) sai assim:
--   Horas Extras 50%: 0h 00min   Adicional Noturno: 0h 00min
--   Horas Extras 100%: 0h 00min  Total Faltas: 0
--   Total Atrasos: 0h 00min      Banco de Horas: 0h 00min
--
-- Não é a Edina: é todo mundo. O fechamento monta o espelho somando
-- ponto_diario.horas_extras_50_minutos, horas_extras_100_minutos,
-- adicional_noturno_minutos e atraso_minutos — colunas da consolidação
-- ANTIGA. A consolidação atual (_ponto_calc_dia) grava entrada, saída,
-- horas_trabalhadas, status e observação, e mais nada. As quatro colunas
-- ficaram órfãs e valem zero em todo lugar.
--
-- O banco_horas_saldo_minutos é pior: nem chega a ser gravado no
-- fechamento — só existe zerado no objeto de pré-visualização.
--
-- O número real do mês existe, e é o mesmo que o Banco de Horas mostra:
-- ponto_saldo_dias_competencia. Esta função agrega essa fonte para o
-- espelho, para as duas telas passarem a dizer a mesma coisa.
--
-- O QUE NÃO DÁ PARA RESGATAR AQUI, e por que não é omissão:
-- a apuração atual trabalha em minutos de saldo, não em percentuais. Ela
-- não separa hora extra 50% de 100%, nem apura adicional noturno. Fingir
-- que são zero é pior que não informar: zero afirma que não houve, e num
-- documento que o colaborador assina isso é declaração falsa. A tela e o
-- PDF passam a marcar esses campos como não apurados neste modelo, e o
-- adicional de feriado — esse sim calculado — aparece em campo próprio.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.ponto_espelho_resumo(
  p_tenant_id uuid,
  p_colaborador_cpf text,
  p_competencia text
)
RETURNS TABLE(
  dias_com_registro integer,
  dias_trabalhados integer,
  total_trabalhado_min integer,
  total_jornada_prevista_min integer,
  total_creditos_min integer,
  total_debitos_min integer,
  saldo_min integer,
  total_faltas integer,
  dias_protegidos integer,
  excedente_retido_min integer,
  dia_equalizacao date
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH d AS (
    SELECT * FROM public.ponto_saldo_dias_competencia(
      p_tenant_id, regexp_replace(COALESCE(p_colaborador_cpf, ''), '[^0-9]', '', 'g'), p_competencia)
  )
  SELECT
    count(*)::int,
    count(*) FILTER (WHERE d.trabalhado_min > 0)::int,
    COALESCE(sum(d.trabalhado_min), 0)::int,
    COALESCE(sum(d.jornada_min), 0)::int,
    COALESCE(sum(d.saldo_min) FILTER (WHERE d.saldo_min > 0), 0)::int,
    COALESCE(-sum(d.saldo_min) FILTER (WHERE d.saldo_min < 0), 0)::int,
    COALESCE(sum(d.saldo_min), 0)::int,
    -- Falta é dia com jornada esperada, sem trabalho e sem amparo. Dia
    -- protegido (atestado, férias, afastamento, feriado) não é falta.
    count(*) FILTER (
      WHERE NOT d.protegido AND d.jornada_min > 0 AND d.trabalhado_min = 0
    )::int,
    count(*) FILTER (WHERE d.protegido)::int,
    COALESCE(sum(d.excedente_retido_min), 0)::int,
    (SELECT min(x.dia) FROM d x WHERE x.equalizacao)
  FROM d;
$$;

REVOKE EXECUTE ON FUNCTION public.ponto_espelho_resumo(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ponto_espelho_resumo(uuid, text, text) TO authenticated;

-- Colunas novas do espelho. As antigas permanecem: apagar coluna de
-- documento já emitido apagaria o que aquele espelho dizia quando foi
-- assinado.
ALTER TABLE public.ponto_espelhos
  ADD COLUMN IF NOT EXISTS total_trabalhado_minutos integer,
  ADD COLUMN IF NOT EXISTS total_jornada_prevista_minutos integer,
  ADD COLUMN IF NOT EXISTS total_creditos_minutos integer,
  ADD COLUMN IF NOT EXISTS total_debitos_minutos integer,
  ADD COLUMN IF NOT EXISTS total_dias_trabalhados integer,
  ADD COLUMN IF NOT EXISTS total_dias_protegidos integer,
  ADD COLUMN IF NOT EXISTS total_excedente_retido_minutos integer,
  ADD COLUMN IF NOT EXISTS dia_equalizacao date;

COMMENT ON FUNCTION public.ponto_espelho_resumo(uuid, text, text) IS
  'Totais do espelho a partir da apuração (ponto_saldo_dias_competencia), a mesma fonte do Banco de Horas. Não devolve HE 50/100 nem adicional noturno: o modelo atual apura saldo em minutos, não percentuais.';

-- Versão por empresa: uma chamada devolve a competência inteira, para a
-- tela de fechamento não precisar de uma ida ao banco por colaborador.
CREATE OR REPLACE FUNCTION public.ponto_espelho_resumo_empresa(
  p_tenant_id uuid,
  p_empresa_id uuid,
  p_competencia text
)
RETURNS TABLE(
  colaborador_cpf text,
  colaborador_nome text,
  colaborador_id uuid,
  dias_com_registro integer,
  dias_trabalhados integer,
  total_trabalhado_min integer,
  total_jornada_prevista_min integer,
  total_creditos_min integer,
  total_debitos_min integer,
  saldo_min integer,
  total_faltas integer,
  dias_protegidos integer,
  excedente_retido_min integer,
  dia_equalizacao date
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ini date := to_date(p_competencia || '-01', 'YYYY-MM-DD');
  v_fim date := (to_date(p_competencia || '-01', 'YYYY-MM-DD') + interval '1 month - 1 day')::date;
  r RECORD;
BEGIN
  FOR r IN
    SELECT regexp_replace(pd.colaborador_cpf, '[^0-9]', '', 'g') AS cpf,
           max(pd.colaborador_nome) AS nome,
           max(pd.colaborador_id::text)::uuid AS cid
    FROM public.ponto_diario pd
    WHERE pd.tenant_id = p_tenant_id
      AND pd.data BETWEEN v_ini AND v_fim
      AND COALESCE(pd.colaborador_cpf, '') <> ''
      AND (p_empresa_id IS NULL OR pd.empresa_id = p_empresa_id OR pd.empresa_id IS NULL)
    GROUP BY 1
    ORDER BY 2
  LOOP
    RETURN QUERY
    SELECT r.cpf, r.nome, r.cid, s.*
    FROM public.ponto_espelho_resumo(p_tenant_id, r.cpf, p_competencia) s;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ponto_espelho_resumo_empresa(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ponto_espelho_resumo_empresa(uuid, uuid, text) TO authenticated;

-- CONFERENCIA (troque o CPF e a competencia)
-- SELECT * FROM public.ponto_espelho_resumo(
--   (SELECT tenant_id FROM public.ponto_diario WHERE colaborador_cpf='03452132978' LIMIT 1),
--   '03452132978','2026-07');
