-- ============================================================================
-- RECONSOLIDAR UMA COMPETENCIA — para a correcao do minuto alcancar o passado
--
-- ESTE ARQUIVO REESCREVE ponto_diario. Leia antes de colar.
--
-- SO RODE DEPOIS DE:
--   1. rodar o script_ponto_quanto_mudaria_reconsolidar.sql e obter VEREDITO
--      OK (nenhum dia perderia tempo);
--   2. reabrir a competencia, se ela estiver fechada (ver o fim deste arquivo).
--
-- O QUE FAZ
-- Manda a consolidacao diaria recalcular, dia a dia, os colaboradores que
-- REALMENTE bateram ponto na competencia, em empresa com o modulo ligado. E o
-- unico caminho para a correcao do minuto (PONTO-470) alcancar dias que ja
-- estavam gravados: as outras quatro correcoes agem na hora de calcular o
-- saldo e ja valem para o passado sem reescrever nada.
--
-- O QUE NAO FAZ, DE PROPOSITO
--   * NAO toca em quem nunca bateu ponto. Reconsolidar essa gente e
--     exatamente o que recria as faltas fantasma que limpamos em 01/09/2026 —
--     por isso o alvo exige marcacao no dia;
--   * NAO usa consolidar_ponto_dia_todos, que varre o quadro inteiro pelo
--     cadastro de admissoes e traria de volta o mesmo problema;
--   * NAO mexe em dia com situacao "justificado" nem em abono de afastamento:
--     a propria consolidacao preserva os dois;
--   * NAO apaga marcacao nenhuma. Ajuste aprovado vira marcacao no ato da
--     aprovacao, entao ele sobrevive a reconsolidacao.
--
-- A COPIA DE SEGURANCA
-- Antes de reescrever, guarda a linha inteira de cada dia que sera tocado em
-- backup_ponto_diario_reconsolidacao_AAAAMMDD. O comando que desfaz esta no
-- fim do arquivo. A producao nao tem Point-in-Time Recovery: esta copia e o
-- resgate.
--
-- SE DER TEMPO ESGOTADO: nada foi alterado — o editor roda o arquivo inteiro
-- numa transacao so. Me avise que eu divido por empresa.
--
-- Idempotente: rodar de novo recalcula os mesmos dias para os mesmos numeros
-- e mantem a copia do dia.
-- ============================================================================

SET lock_timeout = '10s';
SET statement_timeout = '600s';

-- ---------------------------------------------------------------------
-- 0) O alvo, definido uma vez e usado por todos os passos
-- ---------------------------------------------------------------------
DO $reconsolida$
DECLARE
  v_comp   text := '2026-08';   -- AJUSTE AQUI: competencia
  v_nome   text := 'backup_ponto_diario_reconsolidacao_' || to_char(CURRENT_DATE, 'YYYYMMDD');
  v_n      bigint;
  c        RECORD;
  v_dias   int := 0;
BEGIN
  -- 1) COPIA DE SEGURANCA da linha inteira de cada dia que sera tocado.
  IF to_regclass('public.' || v_nome) IS NOT NULL THEN
    EXECUTE format('SELECT count(*) FROM public.%I', v_nome) INTO v_n;
    RAISE NOTICE 'A copia % ja existe com % linha(s) — mantida como esta.', v_nome, v_n;
  ELSE
    EXECUTE format($sql$
      CREATE TABLE public.%I AS
      SELECT d.*
      FROM public.ponto_diario d
      JOIN public.empresa_cadastro e ON e.id = d.empresa_id
      WHERE COALESCE(e.usa_controle_ponto, false) = true
        AND to_char(d.data, 'YYYY-MM') = %L
        AND EXISTS (
          SELECT 1 FROM public.ponto_marcacoes m
          WHERE m.tenant_id = d.tenant_id
            AND m.colaborador_cpf = d.colaborador_cpf
            AND m.data_marcacao = d.data)
    $sql$, v_nome, v_comp);
    EXECUTE format('SELECT count(*) FROM public.%I', v_nome) INTO v_n;
    RAISE NOTICE 'Copia de seguranca criada: % com % linha(s).', v_nome, v_n;
  END IF;

  -- 2) A reconsolidacao, dia a dia, colaborador a colaborador.
  FOR c IN
    SELECT DISTINCT d.tenant_id, d.colaborador_cpf, d.data
    FROM public.ponto_diario d
    JOIN public.empresa_cadastro e ON e.id = d.empresa_id
    WHERE COALESCE(e.usa_controle_ponto, false) = true
      AND to_char(d.data, 'YYYY-MM') = v_comp
      AND EXISTS (
        SELECT 1 FROM public.ponto_marcacoes m
        WHERE m.tenant_id = d.tenant_id
          AND m.colaborador_cpf = d.colaborador_cpf
          AND m.data_marcacao = d.data)
    ORDER BY d.data
  LOOP
    BEGIN
      PERFORM public.consolidar_ponto_diario_manual(c.tenant_id, c.colaborador_cpf, c.data);
      v_dias := v_dias + 1;
    EXCEPTION WHEN OTHERS THEN
      -- Um dia problematico nao pode derrubar a competencia inteira.
      RAISE NOTICE 'Dia % do CPF ...%: %', c.data, right(c.colaborador_cpf, 3), SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '% dia(s) reconsolidado(s) na competencia %.', v_dias, v_comp;
END $reconsolida$;

-- ============================================================================
-- CONFERENCIA — o SQL Editor mostra apenas o ultimo resultado.
-- ============================================================================
WITH nome AS MATERIALIZED (
  SELECT 'backup_ponto_diario_reconsolidacao_' || to_char(CURRENT_DATE, 'YYYYMMDD') AS t,
         '2026-08'::text AS competencia   -- AJUSTE AQUI: a mesma competencia acima
),
copia AS MATERIALIZED (
  SELECT (xpath('/row/c/text()',
           query_to_xml('SELECT count(*) AS c, COALESCE(SUM(EXTRACT(EPOCH FROM horas_trabalhadas)/60), 0) AS m FROM public.'
                        || quote_ident(n.t), false, true, '')))[1]::text::bigint AS linhas,
         (xpath('/row/m/text()',
           query_to_xml('SELECT count(*) AS c, COALESCE(SUM(EXTRACT(EPOCH FROM horas_trabalhadas)/60), 0) AS m FROM public.'
                        || quote_ident(n.t), false, true, '')))[1]::text::numeric AS minutos
  FROM nome n
),
agora AS MATERIALIZED (
  SELECT count(*) AS linhas,
         COALESCE(SUM(EXTRACT(EPOCH FROM d.horas_trabalhadas) / 60), 0) AS minutos
  FROM public.ponto_diario d
  JOIN public.empresa_cadastro e ON e.id = d.empresa_id
  CROSS JOIN nome n
  WHERE COALESCE(e.usa_controle_ponto, false) = true
    AND to_char(d.data, 'YYYY-MM') = n.competencia
    AND EXISTS (
      SELECT 1 FROM public.ponto_marcacoes m
      WHERE m.tenant_id = d.tenant_id
        AND m.colaborador_cpf = d.colaborador_cpf
        AND m.data_marcacao = d.data)
)
SELECT 'dias na copia'::text                                        AS o_que,
       (SELECT linhas::text FROM copia)                             AS antes,
       (SELECT linhas::text FROM agora)                             AS depois,
       'guardados linha a linha em ' || (SELECT t FROM nome)         AS detalhe,
       CASE WHEN (SELECT linhas FROM copia) = (SELECT linhas FROM agora)
            THEN 'OK' ELSE 'CONFERIR: o numero de dias mudou' END    AS erro_tecnico
UNION ALL
SELECT 'minutos trabalhados',
       to_char((SELECT minutos FROM copia), 'FM999990'),
       to_char((SELECT minutos FROM agora), 'FM999990'),
       CASE WHEN (SELECT minutos FROM agora) >= (SELECT minutos FROM copia)
            THEN '+' ELSE '' END
         || to_char((SELECT minutos FROM agora) - (SELECT minutos FROM copia), 'FM999990')
         || ' min recuperados',
       CASE WHEN (SELECT minutos FROM agora) >= (SELECT minutos FROM copia)
            THEN 'OK — a reconsolidacao so somou tempo'
            ELSE 'PARE: a competencia PERDEU tempo. Desfaca com o comando no fim do arquivo e me avise.' END;

-- ---------------------------------------------------------------------
-- PARA DESFAZER (troque AAAAMMDD pela data de hoje):
--   UPDATE public.ponto_diario d
--      SET entrada = b.entrada, saida_almoco = b.saida_almoco,
--          retorno_almoco = b.retorno_almoco, saida = b.saida,
--          horas_trabalhadas = b.horas_trabalhadas, status = b.status,
--          observacao = b.observacao, updated_at = now()
--     FROM public.backup_ponto_diario_reconsolidacao_AAAAMMDD b
--    WHERE d.id = b.id;
--
-- REABRIR A COMPETENCIA, se estiver fechada (rode ANTES da reconsolidacao).
-- Arquiva os espelhos vigentes em ponto_espelhos_historico com numero de
-- versao e registra motivo, responsavel e trilha de auditoria:
--   SELECT public.ponto_reabrir_competencia(
--     '<tenant_id>'::uuid, '<empresa_id>'::uuid, '2026-08',
--     'Correcao do truncamento de minutos apurada em 01/09/2026 (PONTO-470)',
--     'contato@ustudy.com.br', 'Nome de quem autorizou');
--
-- DEPOIS DA RECONSOLIDACAO, atualizar o banco de horas e reemitir espelhos:
--   SELECT public.apurar_banco_horas('<tenant_id>'::uuid, '2026-08', '<empresa_id>'::uuid);
--   SELECT public.ponto_gerar_espelhos_competencia('<tenant_id>'::uuid, '2026-08', '<empresa_id>'::uuid);
-- E entao colher a ciencia do colaborador sobre o espelho novo.
-- ---------------------------------------------------------------------
