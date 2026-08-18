-- ============================================================================
-- ENTREGA — ONDA 3 (parte 1): tolerância cumulativa dos dois tetos legais
-- Alvo: função de apuração public.ponto_saldo_dias_competencia_bruto
-- PONTO-041 / PONTO-042 / PONTO-352 (mantém PONTO-353, PONTO-040)
--
-- O QUE FAZ
--   CLT art. 58, §1º + TST Súmula 366: variação de registro não desconta nem
--   vira extra até 5 min POR MARCAÇÃO, observado o teto de 10 min DIÁRIOS.
--   Ultrapassado qualquer um, computa-se a TOTALIDADE que excede a jornada.
--   Duas correções no corpo de apuração:
--     (a) o encaixe de batida na escala passa a usar 5 min por marcação
--         (era 10 — o dobro do limite legal);
--     (b) o piso de tolerância deixa de ser um "abs(saldo) <= 10" cego: o
--         atraso/antecipação (déficit) é absorvido só até o teto POR MARCAÇÃO;
--         a sobra no dia mantém o teto DIÁRIO. Assim um déficit de 6 min numa
--         marcação passa a ser computado por inteiro, e a fronteira do teto
--         diário na sobra (10→0, 11→11) segue idêntica.
--
-- POR QUE ESTE SCRIPT É CIRÚRGICO (e não cola o corpo inteiro)
--   O corpo desta função, em produção, foi corrigido por remendo ao longo do
--   tempo e NÃO corresponde a nenhum arquivo do repositório (ver o comentário
--   em 20260805120000_um_dia_por_data_na_apuracao.sql). Colar um corpo inteiro
--   apagaria esses remendos. Este script, então, LÊ o corpo que estiver vivo
--   em produção e troca APENAS os trechos de tolerância. Se o corpo não casar
--   exatamente com o padrão esperado nessas linhas (por ter sido remendado
--   também ali), o script NÃO altera nada e avisa — para reconciliarmos à mão
--   antes, sem risco de mexer no cálculo errado.
--
--   Idempotente: rodar duas vezes não quebra nem duplica (reconhece o marcador
--   [onda3-tol] já aplicado).
-- ============================================================================

DO $entrega$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'ponto_saldo_dias_competencia_bruto'
    AND pg_get_function_identity_arguments(p.oid) = 'p_tenant_id uuid, p_colaborador_cpf text, p_competencia text'
  LIMIT 1;

  IF v_def IS NULL THEN
    RAISE NOTICE 'ponto_saldo_dias_competencia_bruto nao encontrada — nada a fazer.';
    RETURN;
  END IF;

  IF position('[onda3-tol]' in v_def) > 0 THEN
    RAISE NOTICE 'Ja aplicado (marcador [onda3-tol] presente). Nada a fazer.';
    RETURN;
  END IF;

  -- (a) padrao POR MARCACAO: 10 -> 5 (tres tokens)
  v_def := replace(v_def, 'v_interv := 0; v_tol_bat := 10;', 'v_interv := 0; v_tol_bat := 5;');
  v_def := replace(v_def, 'COALESCE(e.tolerancia_batida_min, 10)', 'COALESCE(e.tolerancia_batida_min, 5)');
  v_def := replace(v_def, 'COALESCE(v_tol_bat, 10)', 'COALESCE(v_tol_bat, 5)');

  -- (b1) deficit no caminho SEM batida (bloco exato: 8/10/8 espacos)
  v_def := replace(v_def,
    E'        IF abs(v_diff) <= COALESCE(v_tol, 0) THEN\n          v_diff := 0;\n        END IF;',
    E'        -- [onda3-tol] deficit absorvido so ate o teto POR MARCACAO\n'
 || E'        -- (art. 58 §1º / Sumula 366); sobra mantem o teto DIARIO.\n'
 || E'        IF v_diff < 0 THEN\n'
 || E'          IF abs(v_diff) <= COALESCE(v_tol_bat, 5) THEN\n'
 || E'            v_diff := 0;\n'
 || E'          END IF;\n'
 || E'        ELSIF abs(v_diff) <= COALESCE(v_tol, 0) THEN\n'
 || E'          v_diff := 0;\n'
 || E'        END IF;');

  -- (b2) piso final, valido para todos os caminhos (bloco exato: 4/6/4 espacos)
  v_def := replace(v_def,
    E'    IF abs(v_diff) <= 10 THEN\n      v_diff := 0;\n    END IF;',
    E'    -- [onda3-tol] dois tetos cumulativos (art. 58 §1º + Sumula 366):\n'
 || E'    -- deficit no teto POR MARCACAO; sobra no teto DIARIO (10). Estourou\n'
 || E'    -- qualquer um, computa-se a totalidade que excede a jornada.\n'
 || E'    IF v_diff < 0 THEN\n'
 || E'      IF abs(v_diff) <= COALESCE(v_tol_bat, 5) THEN\n'
 || E'        v_diff := 0;\n'
 || E'      END IF;\n'
 || E'    ELSIF v_diff <= 10 THEN\n'
 || E'      v_diff := 0;\n'
 || E'    END IF;');

  -- Guarda: as trocas todas ocorreram? Se nao casou, NAO aplica e avisa.
  IF position('[onda3-tol]' in v_def) = 0
     OR position('COALESCE(v_tol_bat, 5)' in v_def) = 0
     OR position('COALESCE(e.tolerancia_batida_min, 10)' in v_def) > 0 THEN
    RAISE NOTICE 'ATENCAO: corpo divergente nas linhas de tolerancia (provavel remendo proprio de producao). NADA foi alterado. Envie pg_get_functiondef(ponto_saldo_dias_competencia_bruto) para reconciliarmos a mao antes de aplicar.';
    RETURN;
  END IF;

  EXECUTE v_def;
  RAISE NOTICE 'Tolerancia cumulativa aplicada em ponto_saldo_dias_competencia_bruto.';
END $entrega$;

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA — o SQL Editor mostra apenas o último resultado.
-- Esperado depois de aplicar:  t | t | t | OK
--   marcador_aplicado : t  (o marcador [onda3-tol] está no corpo)
--   por_marcacao_5    : t  (o padrão 10 por marcação foi trocado por 5)
--   sem_padrao_antigo : t  (não sobrou COALESCE(e.tolerancia_batida_min, 10))
-- Se vier 'PENDENTE', o corpo em produção divergiu e nada foi alterado:
--   me envie o pg_get_functiondef que eu reconcilio.
-- ---------------------------------------------------------------------------
WITH def AS (
  SELECT pg_get_functiondef(p.oid) AS src
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'ponto_saldo_dias_competencia_bruto'
    AND pg_get_function_identity_arguments(p.oid) = 'p_tenant_id uuid, p_colaborador_cpf text, p_competencia text'
  LIMIT 1
)
SELECT
  (position('[onda3-tol]' in src) > 0)                                AS marcador_aplicado,
  (position('COALESCE(v_tol_bat, 5)' in src) > 0)                     AS por_marcacao_5,
  (position('COALESCE(e.tolerancia_batida_min, 10)' in src) = 0)      AS sem_padrao_antigo,
  CASE
    WHEN position('[onda3-tol]' in src) > 0
     AND position('COALESCE(v_tol_bat, 5)' in src) > 0
     AND position('COALESCE(e.tolerancia_batida_min, 10)' in src) = 0
      THEN 'OK'
    ELSE 'PENDENTE: corpo divergente, nada aplicado — reconciliar'
  END                                                                  AS erro_tecnico
FROM def;
