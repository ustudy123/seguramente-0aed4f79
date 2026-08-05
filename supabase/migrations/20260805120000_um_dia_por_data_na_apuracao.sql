-- =====================================================================
-- Sábado aparecendo duas vezes na lista do Banco de Horas
--
-- Relato (Luiza e Adriana, 27/06): o mesmo sábado sai duas vezes —
-- uma com as marcações reais (07:50–12:00, 4h10, +4h10) e outra zerada
-- com o rótulo Equalização (0h00, −3h40).
--
-- Não é o dado: a varredura de ponto_diario não achou nenhuma data
-- repetida. Quem cria a segunda linha é a leitura.
--
-- ponto_saldo_dias_competencia percorre os dias e, no fim, ACRESCENTA
-- uma linha de equalização quando entende que o dia da equalização não
-- apareceu no laço. Quando essa linha cai num dia que já saiu, o dia
-- duplica — e o saldo do mês é debitado duas vezes, o que é pior que o
-- efeito visual: no caso da Adriana são 3h40 de débito que não existem.
--
-- Por que não corrigimos o ramo que emite a linha extra: a definição em
-- produção foi corrigida por remendo ao longo do tempo e não corresponde
-- a nenhum arquivo do repositório. Mexer no ramo errado quebraria o que
-- está certo sem resolver o que está errado.
--
-- A correção aqui é de outra ordem, e vale para qualquer ramo: a função
-- passa a garantir UM DIA POR DATA na saída. O corpo antigo continua
-- intacto, renomeado, e um invólucro agrupa o que ele devolve.
--
-- Dia que sai uma vez só — o caso normal — passa sem ser tocado: os
-- valores são exatamente os de antes. Só quando a mesma data aparece
-- duas vezes é que há junção, e ela segue o que a regra manda:
--   · dia protegido (atestado, férias, feriado) vence: saldo zero;
--   · senão, vale o que foi TRABALHADO na linha real e a MAIOR jornada
--     exigida entre as duas — no caso do sábado, a da equalização;
--   · o saldo é recalculado dessas duas, com a tolerância de 10 minutos
--     que a apuração já aplica.
-- =====================================================================

DO $renomeia$
BEGIN
  IF to_regprocedure('public.ponto_saldo_dias_competencia_bruto(uuid,text,text)') IS NULL THEN
    ALTER FUNCTION public.ponto_saldo_dias_competencia(uuid, text, text)
      RENAME TO ponto_saldo_dias_competencia_bruto;
    RAISE NOTICE 'Corpo da apuração preservado como ponto_saldo_dias_competencia_bruto.';
  ELSE
    RAISE NOTICE 'ponto_saldo_dias_competencia_bruto já existe — nada a renomear.';
  END IF;
END $renomeia$;

COMMENT ON FUNCTION public.ponto_saldo_dias_competencia_bruto(uuid, text, text) IS
  'Apuração dia a dia, sem garantia de uma linha por data. Não chame direto: use ponto_saldo_dias_competencia.';

CREATE OR REPLACE FUNCTION public.ponto_saldo_dias_competencia(
  p_tenant_id uuid,
  p_colaborador_cpf text,
  p_competencia text
)
RETURNS TABLE(
  dia date,
  entrada time without time zone,
  saida time without time zone,
  trabalhado_min integer,
  jornada_min integer,
  saldo_min integer,
  protegido boolean,
  equalizacao boolean,
  excedente_retido_min integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH bruto AS (
    SELECT * FROM public.ponto_saldo_dias_competencia_bruto(
      p_tenant_id, p_colaborador_cpf, p_competencia)
  ),
  agrupado AS (
    SELECT b.dia,
           count(*)                                      AS linhas,
           -- Entrada mais cedo e saída mais tarde entre as linhas do dia:
           -- a linha extra vem sem marcação, então na prática ficam as
           -- marcações reais.
           min(b.entrada)                                AS entrada,
           max(b.saida)                                  AS saida,
           max(b.trabalhado_min)                         AS trabalhado_min,
           max(b.jornada_min)                            AS jornada_min,
           max(b.saldo_min)                              AS saldo_unico,
           bool_or(b.protegido)                          AS protegido,
           bool_or(b.equalizacao)                        AS equalizacao,
           max(b.excedente_retido_min)                   AS excedente_retido_min
    FROM bruto b
    GROUP BY b.dia
  )
  SELECT a.dia,
         a.entrada,
         a.saida,
         a.trabalhado_min,
         -- Dia protegido não tem jornada a cobrar.
         CASE WHEN a.protegido AND a.linhas > 1 THEN 0 ELSE a.jornada_min END,
         CASE
           -- Dia que saiu uma vez só: nada muda, nem por arredondamento.
           WHEN a.linhas = 1 THEN a.saldo_unico
           -- Dia protegido não gera débito nem crédito.
           WHEN a.protegido THEN 0
           -- Tolerância de 10 minutos, a mesma da apuração.
           WHEN abs(a.trabalhado_min - a.jornada_min) <= 10 THEN 0
           ELSE a.trabalhado_min - a.jornada_min
         END,
         a.protegido,
         a.equalizacao,
         a.excedente_retido_min
  FROM agrupado a
  ORDER BY a.dia;
$$;

REVOKE EXECUTE ON FUNCTION public.ponto_saldo_dias_competencia(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ponto_saldo_dias_competencia(uuid, text, text) TO authenticated;

COMMENT ON FUNCTION public.ponto_saldo_dias_competencia(uuid, text, text) IS
  'Apuração dia a dia da competência, garantindo uma linha por data. Junta linhas repetidas (o dia da equalização emitido em duplicidade) em vez de deixar o dia sair duas vezes e o saldo ser contado duas vezes.';


-- FERRAMENTA DE CONFERÊNCIA -------------------------------------------
-- Quem ainda teria dia repetido se a junção não existisse. Serve para
-- medir o tamanho do problema e, depois, para achar a causa com calma.
CREATE OR REPLACE FUNCTION public.ponto_dias_repetidos_na_apuracao(
  p_tenant_id uuid,
  p_competencia text
)
RETURNS TABLE(
  colaborador_cpf text,
  colaborador_nome text,
  dia date,
  linhas integer,
  saldo_somado_min integer,
  saldo_apos_juncao_min integer
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
           max(pd.colaborador_nome) AS nome
    FROM public.ponto_diario pd
    WHERE pd.tenant_id = p_tenant_id
      AND pd.data BETWEEN v_ini AND v_fim
      AND COALESCE(pd.colaborador_cpf, '') <> ''
    GROUP BY 1
  LOOP
    RETURN QUERY
    SELECT r.cpf, r.nome, b.dia, count(*)::int,
           sum(b.saldo_min)::int,
           (SELECT s.saldo_min
              FROM public.ponto_saldo_dias_competencia(p_tenant_id, r.cpf, p_competencia) s
             WHERE s.dia = b.dia)
    FROM public.ponto_saldo_dias_competencia_bruto(p_tenant_id, r.cpf, p_competencia) b
    GROUP BY b.dia
    HAVING count(*) > 1;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ponto_dias_repetidos_na_apuracao(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ponto_dias_repetidos_na_apuracao(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.ponto_dias_repetidos_na_apuracao(uuid, text) IS
  'Dias que a apuração devolveria mais de uma vez, com o saldo antes e depois da junção. Mede quanto de débito indevido a duplicidade estava criando.';
